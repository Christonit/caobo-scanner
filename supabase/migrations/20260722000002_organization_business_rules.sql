-- =====================================================================
-- Organization Business Rules: organization_business_rules +
-- organization_business_rule_attributes
-- =====================================================================
-- Org-wide "Anotaciones del Negocio" — same inverted-EAV shape as
-- client_business_rules / business_rule_attributes, but scoped to the
-- organization so they apply on every inference call for every client.
-- =====================================================================

-- ---------- 1. organization_business_rules ----------
create table if not exists public.organization_business_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  rule_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_business_rules_org_name_unique
    unique (organization_id, rule_name)
);

create index if not exists organization_business_rules_organization_id_idx
  on public.organization_business_rules (organization_id);

alter table public.organization_business_rules enable row level security;

drop policy if exists "organization_business_rules_select_org"
  on public.organization_business_rules;
drop policy if exists "organization_business_rules_insert_org"
  on public.organization_business_rules;
drop policy if exists "organization_business_rules_update_org"
  on public.organization_business_rules;
drop policy if exists "organization_business_rules_delete_org"
  on public.organization_business_rules;

create policy "organization_business_rules_select_org"
  on public.organization_business_rules
  for select
  to authenticated
  using (organization_id = (select public.current_user_org()));

create policy "organization_business_rules_insert_org"
  on public.organization_business_rules
  for insert
  to authenticated
  with check (organization_id = (select public.current_user_org()));

create policy "organization_business_rules_update_org"
  on public.organization_business_rules
  for update
  to authenticated
  using (organization_id = (select public.current_user_org()))
  with check (organization_id = (select public.current_user_org()));

create policy "organization_business_rules_delete_org"
  on public.organization_business_rules
  for delete
  to authenticated
  using (organization_id = (select public.current_user_org()));

drop policy if exists "organization_business_rules_superadmin_all"
  on public.organization_business_rules;
create policy "organization_business_rules_superadmin_all"
  on public.organization_business_rules
  for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

grant select, insert, update, delete
  on table public.organization_business_rules to authenticated;

-- ---------- 2. organization_business_rule_attributes ----------
create table if not exists public.organization_business_rule_attributes (
  id bigint generated always as identity primary key,
  organization_business_rule_id uuid not null
    references public.organization_business_rules (id) on delete cascade,
  rule_type text not null,
  rule_value text,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists organization_business_rule_attributes_rule_id_idx
  on public.organization_business_rule_attributes (organization_business_rule_id);

alter table public.organization_business_rule_attributes enable row level security;

drop policy if exists "organization_business_rule_attributes_select_org"
  on public.organization_business_rule_attributes;
drop policy if exists "organization_business_rule_attributes_insert_org"
  on public.organization_business_rule_attributes;
drop policy if exists "organization_business_rule_attributes_update_org"
  on public.organization_business_rule_attributes;
drop policy if exists "organization_business_rule_attributes_delete_org"
  on public.organization_business_rule_attributes;

create policy "organization_business_rule_attributes_select_org"
  on public.organization_business_rule_attributes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_business_rules obr
      where obr.id = organization_business_rule_attributes.organization_business_rule_id
        and obr.organization_id = (select public.current_user_org())
    )
  );

create policy "organization_business_rule_attributes_insert_org"
  on public.organization_business_rule_attributes
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.organization_business_rules obr
      where obr.id = organization_business_rule_attributes.organization_business_rule_id
        and obr.organization_id = (select public.current_user_org())
    )
  );

create policy "organization_business_rule_attributes_update_org"
  on public.organization_business_rule_attributes
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.organization_business_rules obr
      where obr.id = organization_business_rule_attributes.organization_business_rule_id
        and obr.organization_id = (select public.current_user_org())
    )
  )
  with check (
    exists (
      select 1
      from public.organization_business_rules obr
      where obr.id = organization_business_rule_attributes.organization_business_rule_id
        and obr.organization_id = (select public.current_user_org())
    )
  );

create policy "organization_business_rule_attributes_delete_org"
  on public.organization_business_rule_attributes
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.organization_business_rules obr
      where obr.id = organization_business_rule_attributes.organization_business_rule_id
        and obr.organization_id = (select public.current_user_org())
    )
  );

drop policy if exists "organization_business_rule_attributes_superadmin_all"
  on public.organization_business_rule_attributes;
create policy "organization_business_rule_attributes_superadmin_all"
  on public.organization_business_rule_attributes
  for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

grant select, insert, update, delete
  on table public.organization_business_rule_attributes to authenticated;
