-- =====================================================================
-- Client Business Rules: client_business_rules + business_rule_attributes
-- =====================================================================
-- Optional, per-client "business rules" context used to help the backend
-- / AI make better decisions when processing documents for a client (e.g.
-- special classification rules, exceptions, conventions). Structurally
-- mirrors client_documents / document_attributes (an inverted EAV):
--   1. client_business_rules: named rule groups per client, e.g.
--      "Clasificacion de gastos".
--   2. business_rule_attributes: individual rule rows (a short label +
--      free-text description that gets fed to the AI as context).
--
-- IDs: client_business_rules use uuid. business_rule_attributes use
-- bigint identity, consistent with document_attributes.
-- =====================================================================

-- ---------- 1. client_business_rules ----------
create table if not exists public.client_business_rules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  rule_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_business_rules_client_name_unique unique (client_id, rule_name)
);

create index if not exists client_business_rules_client_id_idx
  on public.client_business_rules (client_id);

alter table public.client_business_rules enable row level security;

drop policy if exists "client_business_rules_select_org" on public.client_business_rules;
drop policy if exists "client_business_rules_insert_org" on public.client_business_rules;
drop policy if exists "client_business_rules_update_org" on public.client_business_rules;
drop policy if exists "client_business_rules_delete_org" on public.client_business_rules;

create policy "client_business_rules_select_org"
  on public.client_business_rules
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.clients c
      where c.id = client_business_rules.client_id
        and c.organization_id = (select public.current_user_org())
    )
  );

create policy "client_business_rules_insert_org"
  on public.client_business_rules
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.clients c
      where c.id = client_business_rules.client_id
        and c.organization_id = (select public.current_user_org())
    )
  );

create policy "client_business_rules_update_org"
  on public.client_business_rules
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.clients c
      where c.id = client_business_rules.client_id
        and c.organization_id = (select public.current_user_org())
    )
  )
  with check (
    exists (
      select 1
      from public.clients c
      where c.id = client_business_rules.client_id
        and c.organization_id = (select public.current_user_org())
    )
  );

create policy "client_business_rules_delete_org"
  on public.client_business_rules
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.clients c
      where c.id = client_business_rules.client_id
        and c.organization_id = (select public.current_user_org())
    )
  );

grant select, insert, update, delete on table public.client_business_rules to authenticated;

-- ---------- 2. business_rule_attributes (inverted EAV) ----------
create table if not exists public.business_rule_attributes (
  id bigint generated always as identity primary key,
  client_business_rule_id uuid not null
    references public.client_business_rules (id) on delete cascade,
  rule_type text not null,
  rule_value text,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists business_rule_attributes_client_business_rule_id_idx
  on public.business_rule_attributes (client_business_rule_id);

alter table public.business_rule_attributes enable row level security;

drop policy if exists "business_rule_attributes_select_org" on public.business_rule_attributes;
drop policy if exists "business_rule_attributes_insert_org" on public.business_rule_attributes;
drop policy if exists "business_rule_attributes_update_org" on public.business_rule_attributes;
drop policy if exists "business_rule_attributes_delete_org" on public.business_rule_attributes;

create policy "business_rule_attributes_select_org"
  on public.business_rule_attributes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.client_business_rules cbr
      join public.clients c on c.id = cbr.client_id
      where cbr.id = business_rule_attributes.client_business_rule_id
        and c.organization_id = (select public.current_user_org())
    )
  );

create policy "business_rule_attributes_insert_org"
  on public.business_rule_attributes
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.client_business_rules cbr
      join public.clients c on c.id = cbr.client_id
      where cbr.id = business_rule_attributes.client_business_rule_id
        and c.organization_id = (select public.current_user_org())
    )
  );

create policy "business_rule_attributes_update_org"
  on public.business_rule_attributes
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.client_business_rules cbr
      join public.clients c on c.id = cbr.client_id
      where cbr.id = business_rule_attributes.client_business_rule_id
        and c.organization_id = (select public.current_user_org())
    )
  )
  with check (
    exists (
      select 1
      from public.client_business_rules cbr
      join public.clients c on c.id = cbr.client_id
      where cbr.id = business_rule_attributes.client_business_rule_id
        and c.organization_id = (select public.current_user_org())
    )
  );

create policy "business_rule_attributes_delete_org"
  on public.business_rule_attributes
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.client_business_rules cbr
      join public.clients c on c.id = cbr.client_id
      where cbr.id = business_rule_attributes.client_business_rule_id
        and c.organization_id = (select public.current_user_org())
    )
  );

grant select, insert, update, delete on table public.business_rule_attributes to authenticated;

-- Example AI-context aggregation query (not a migration object — reference only):
--
-- SELECT
--   cbr.rule_name,
--   COALESCE(
--     json_agg(
--       json_build_object(
--         'Id', bra.id,
--         'rule_type', bra.rule_type,
--         'rule_value', bra.rule_value,
--         'description', bra.description
--       )
--       ORDER BY bra.id ASC
--     ) FILTER (WHERE bra.id IS NOT NULL),
--     '[]'::json
--   ) AS rules_list
-- FROM public.client_business_rules cbr
-- LEFT JOIN public.business_rule_attributes bra ON cbr.id = bra.client_business_rule_id
-- WHERE cbr.client_id = '<client-uuid>'
-- GROUP BY cbr.id, cbr.rule_name;
