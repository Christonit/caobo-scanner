-- Roles rework + superadmin support.
--
-- Role model becomes: 'admin' | 'collaborator' (stored on public.user_profiles,
-- scoped to exactly one organization) plus a separate, org-less 'superadmin'
-- flag stored in public.superadmins. Superadmins have no user_profiles row —
-- they pick which organization to act on client-side (see useOrganization.ts)
-- and are granted access to every tenant table via additive RLS policies
-- below, layered on top of (not replacing) the existing per-org policies.

-- 1. Rename the legacy 'member' role value to 'collaborator' and lock the
--    column down with a check constraint so future typos fail loudly.
update public.user_profiles set role = 'collaborator' where role = 'member';

alter table public.user_profiles
  alter column role set default 'collaborator';

alter table public.user_profiles
  drop constraint if exists user_profiles_role_check;

alter table public.user_profiles
  add constraint user_profiles_role_check check (role in ('admin', 'collaborator'));

-- 2. Superadmins table — membership is org-less and managed only via the
--    service role (setup scripts / dashboard), never through the app's
--    normal RLS-governed client.
create table if not exists public.superadmins (
    "user_id" uuid primary key references auth.users(id) on delete cascade,
    "created_at" timestamp with time zone default now() not null
);

alter table public.superadmins owner to postgres;
alter table public.superadmins enable row level security;

drop policy if exists "superadmins_self_select" on public.superadmins;
create policy "superadmins_self_select" on public.superadmins
    for select to authenticated
    using (user_id = auth.uid());

grant select on table public.superadmins to authenticated;
grant all on table public.superadmins to service_role;

-- 3. is_superadmin() helper — SECURITY DEFINER so it can be called from any
--    RLS policy without granting broad SELECT on public.superadmins.
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

-- 4. Additive "superadmin sees everything" policies. These are separate,
--    permissive policies layered on top of the existing org-scoped ones
--    (Postgres OR's permissive policies together per command), so none of
--    the existing per-org policies need to change.
drop policy if exists "organizations_superadmin_all" on public.organizations;
create policy "organizations_superadmin_all" on public.organizations
    for all to authenticated
    using (public.is_superadmin())
    with check (public.is_superadmin());

drop policy if exists "user_profiles_superadmin_all" on public.user_profiles;
create policy "user_profiles_superadmin_all" on public.user_profiles
    for all to authenticated
    using (public.is_superadmin())
    with check (public.is_superadmin());

drop policy if exists "clients_superadmin_all" on public.clients;
create policy "clients_superadmin_all" on public.clients
    for all to authenticated
    using (public.is_superadmin())
    with check (public.is_superadmin());

drop policy if exists "documents_superadmin_all" on public.documents;
create policy "documents_superadmin_all" on public.documents
    for all to authenticated
    using (public.is_superadmin())
    with check (public.is_superadmin());

drop policy if exists "reports_superadmin_all" on public.reports;
create policy "reports_superadmin_all" on public.reports
    for all to authenticated
    using (public.is_superadmin())
    with check (public.is_superadmin());

drop policy if exists "templates_superadmin_all" on public.templates;
create policy "templates_superadmin_all" on public.templates
    for all to authenticated
    using (public.is_superadmin())
    with check (public.is_superadmin());

drop policy if exists "activity_logs_superadmin_all" on public.activity_logs;
create policy "activity_logs_superadmin_all" on public.activity_logs
    for all to authenticated
    using (public.is_superadmin())
    with check (public.is_superadmin());

drop policy if exists "client_business_rules_superadmin_all" on public.client_business_rules;
create policy "client_business_rules_superadmin_all" on public.client_business_rules
    for all to authenticated
    using (public.is_superadmin())
    with check (public.is_superadmin());

drop policy if exists "business_rule_attributes_superadmin_all" on public.business_rule_attributes;
create policy "business_rule_attributes_superadmin_all" on public.business_rule_attributes
    for all to authenticated
    using (public.is_superadmin())
    with check (public.is_superadmin());

drop policy if exists "client_documents_superadmin_all" on public.client_documents;
create policy "client_documents_superadmin_all" on public.client_documents
    for all to authenticated
    using (public.is_superadmin())
    with check (public.is_superadmin());

drop policy if exists "document_attributes_superadmin_all" on public.document_attributes;
create policy "document_attributes_superadmin_all" on public.document_attributes
    for all to authenticated
    using (public.is_superadmin())
    with check (public.is_superadmin());

drop policy if exists "client_suplidores_superadmin_all" on public.client_suplidores;
create policy "client_suplidores_superadmin_all" on public.client_suplidores
    for all to authenticated
    using (public.is_superadmin())
    with check (public.is_superadmin());

drop policy if exists "client_tax_column_mappings_superadmin_all" on public.client_tax_column_mappings;
create policy "client_tax_column_mappings_superadmin_all" on public.client_tax_column_mappings
    for all to authenticated
    using (public.is_superadmin())
    with check (public.is_superadmin());
