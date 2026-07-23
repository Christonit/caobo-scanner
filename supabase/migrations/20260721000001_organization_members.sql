-- Multi-organization memberships.
--
-- Today public.user_profiles is 1:1 with auth.users and stores a single
-- (organization_id, role). That row remains the *active* org used by
-- current_user_org() / RLS. This migration adds public.organization_members
-- so a user can belong to many orgs and switch which one is active.
--
-- Switching updates user_profiles.organization_id + role to the chosen
-- membership — no RLS policy rewrites required.

-- ---------- 0. Ensure superadmin helper exists ----------
-- Some environments never applied 20260716000001_roles_and_superadmin.sql.
-- Create the minimal dependency this file needs (idempotent).
create table if not exists public.superadmins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.superadmins enable row level security;

drop policy if exists "superadmins_self_select" on public.superadmins;
create policy "superadmins_self_select" on public.superadmins
  for select to authenticated
  using (user_id = (select auth.uid()));

grant select on table public.superadmins to authenticated;
grant all on table public.superadmins to service_role;

create or replace function public.is_superadmin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.superadmins s where s.user_id = uid
  );
$$;

revoke all on function public.is_superadmin(uuid) from public;
grant execute on function public.is_superadmin(uuid) to anon, authenticated, service_role;

-- ---------- 1. Membership table ----------
create table if not exists public.organization_members (
  user_id         uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role            text not null default 'collaborator'
                    check (role in ('admin', 'collaborator')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (user_id, organization_id)
);

create index if not exists organization_members_org_idx
  on public.organization_members (organization_id);

alter table public.organization_members enable row level security;

-- Members can read their own membership rows (needed by the sidebar switcher).
drop policy if exists "organization_members_select_own" on public.organization_members;
create policy "organization_members_select_own"
  on public.organization_members
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_superadmin()
  );

-- Org admins (active org) can manage memberships for their org.
-- Superadmins can manage any org's memberships.
drop policy if exists "organization_members_admin_all" on public.organization_members;
create policy "organization_members_admin_all"
  on public.organization_members
  for all
  to authenticated
  using (
    public.is_superadmin()
    or (
      organization_id = (select public.current_user_org())
      and exists (
        select 1
        from public.user_profiles up
        where up.id = (select auth.uid())
          and up.role = 'admin'
      )
    )
  )
  with check (
    public.is_superadmin()
    or (
      organization_id = (select public.current_user_org())
      and exists (
        select 1
        from public.user_profiles up
        where up.id = (select auth.uid())
          and up.role = 'admin'
      )
    )
  );

grant select, insert, update, delete on table public.organization_members to authenticated;
grant all on table public.organization_members to service_role;

-- ---------- 2. Backfill from existing profiles ----------
insert into public.organization_members (user_id, organization_id, role, created_at, updated_at)
select id, organization_id, role, created_at, updated_at
from public.user_profiles
on conflict (user_id, organization_id) do update
  set role = excluded.role,
      updated_at = now();

-- ---------- 3. Keep members in sync when a profile is upserted ----------
-- (onboarding / invite / seed still write user_profiles; this trigger
-- mirrors that into organization_members without breaking callers.)
create or replace function public.sync_organization_member_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is null then
    return new;
  end if;
  insert into public.organization_members (user_id, organization_id, role)
  values (new.id, new.organization_id, new.role)
  on conflict (user_id, organization_id) do update
    set role = excluded.role,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_organization_member on public.user_profiles;
create trigger trg_sync_organization_member
  after insert or update of organization_id, role
  on public.user_profiles
  for each row
  execute function public.sync_organization_member_from_profile();

-- ---------- 4. switch_organization(p_organization_id) ----------
-- Validates the caller is a member of the target org, then points
-- user_profiles at that membership (active org for RLS).
create or replace function public.switch_organization(p_organization_id uuid)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_role text;
  v_org  public.organizations;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select m.role into v_role
  from public.organization_members m
  where m.user_id = v_user
    and m.organization_id = p_organization_id;

  if v_role is null then
    raise exception 'not a member of that organization' using errcode = '42501';
  end if;

  select * into v_org
  from public.organizations
  where id = p_organization_id
    and deleted_at is null;

  if v_org.id is null then
    raise exception 'organization not found' using errcode = 'P0002';
  end if;

  update public.user_profiles
  set organization_id = p_organization_id,
      role = v_role,
      updated_at = now()
  where id = v_user;

  if not found then
    raise exception 'user profile missing' using errcode = 'P0002';
  end if;

  return v_org;
end;
$$;

revoke all on function public.switch_organization(uuid) from public;
grant execute on function public.switch_organization(uuid) to authenticated;

-- ---------- 5. create_organization also registers a membership ----------
-- Replace the existing bootstrap RPC so new orgs land in both tables.
create or replace function public.create_organization(
  p_name      text,
  p_slug      text default null,
  p_full_name text default null
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org  public.organizations;
  v_slug text;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- First-time bootstrap only: users who already have a profile should join
  -- additional orgs via invite, not by creating a second "first" org here.
  if exists (select 1 from public.user_profiles where id = v_user) then
    raise exception 'user already belongs to an organization'
      using errcode = '23505';
  end if;

  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'organization name must be at least 2 characters'
      using errcode = '22023';
  end if;

  v_slug := coalesce(
    nullif(trim(p_slug), ''),
    regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g')
  );
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then v_slug := 'org'; end if;

  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.organizations (name, slug)
  values (trim(p_name), v_slug)
  returning * into v_org;

  insert into public.user_profiles (id, organization_id, role, full_name)
  values (v_user, v_org.id, 'admin', nullif(trim(p_full_name), ''));
  -- trigger also inserts organization_members

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, text) from public;
grant execute on function public.create_organization(text, text, text) to authenticated;
