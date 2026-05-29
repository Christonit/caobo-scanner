-- =====================================================================
-- Caobo Recibos – bootstrap RPC + profile fields
-- =====================================================================
-- This migration ALIGNS the live schema with what the Nuxt app expects.
-- It is safe to run on the existing production project (idempotent).
--
-- It does three things:
--   1. Adds full_name / avatar_url columns to public.user_profiles so the
--      UI has somewhere to put a display name and avatar.
--   2. Adds public.current_user_org(), a SECURITY DEFINER helper that
--      RLS policies can use to look up the calling user's organization.
--   3. Adds public.create_organization(p_name, p_slug?, p_full_name?),
--      a SECURITY DEFINER RPC that lets a newly authenticated user
--      create their first organization AND their own user_profiles row
--      in a single transaction. This is required because the existing
--      *_org_isolation RLS policies make direct INSERTs into either
--      table impossible from the client (the policies require existing
--      membership, which a brand-new user does not yet have).
--
-- After this migration, sign-up flow becomes:
--   client -> supabase.rpc('create_organization', { p_name, p_full_name })
-- and the RPC takes care of the bootstrap atomically.
-- =====================================================================

-- ---------- 1. Profile fields the UI needs ----------
alter table public.user_profiles
  add column if not exists full_name  text,
  add column if not exists avatar_url text;

-- ---------- 2. Helper: current user's organization ----------
create or replace function public.current_user_org()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id
  from public.user_profiles
  where id = (select auth.uid())
  limit 1;
$$;

revoke all on function public.current_user_org() from public;
grant execute on function public.current_user_org() to authenticated;

-- ---------- 3. Bootstrap RPC: create org + admin membership ----------
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

  -- One organization per user under the current schema
  -- (user_profiles.id is the PK and FKs to auth.users.id).
  if exists (select 1 from public.user_profiles where id = v_user) then
    raise exception 'user already belongs to an organization'
      using errcode = '23505';
  end if;

  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'organization name must be at least 2 characters'
      using errcode = '22023';
  end if;

  -- Derive the slug if the caller did not provide one.
  v_slug := coalesce(
    nullif(trim(p_slug), ''),
    regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g')
  );
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then v_slug := 'org'; end if;

  -- De-duplicate the slug if necessary.
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.organizations (name, slug)
  values (trim(p_name), v_slug)
  returning * into v_org;

  insert into public.user_profiles (id, organization_id, role, full_name)
  values (v_user, v_org.id, 'admin', nullif(trim(p_full_name), ''));

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, text) from public;
grant execute on function public.create_organization(text, text, text) to authenticated;
