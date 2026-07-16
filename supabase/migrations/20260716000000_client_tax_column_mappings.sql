-- =====================================================================
-- Client Tax Column Mappings
-- =====================================================================
-- The "Carga Masiva" export template has 5 generic tax columns
-- (Impuesto 1..5). Which semantic amount (ITBIS, Selectivo, Descuento,
-- Propina) is written into which of those 5 slots varies per client, per
-- their own accounting/business rules. This table stores that mapping so
-- the backend export can place each amount in the right column instead of
-- the previous hardcoded ITBIS -> Impuesto 1 / Selectivo -> Impuesto 2.
--
-- One row per client. Each *_column value is either null (do not export
-- that amount to any column) or an integer 1..5 identifying the Impuesto
-- slot. Uniqueness across the 4 columns (no two fields sharing a slot) is
-- enforced in the application layer, not in the database.
-- =====================================================================

create table if not exists public.client_tax_column_mappings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  itbis_column smallint check (itbis_column between 1 and 5),
  selectivo_column smallint check (selectivo_column between 1 and 5),
  descuento_column smallint check (descuento_column between 1 and 5),
  propina_column smallint check (propina_column between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_tax_column_mappings_client_unique unique (client_id)
);

create index if not exists client_tax_column_mappings_client_id_idx
  on public.client_tax_column_mappings (client_id);

alter table public.client_tax_column_mappings enable row level security;

drop policy if exists "client_tax_column_mappings_select_org" on public.client_tax_column_mappings;
drop policy if exists "client_tax_column_mappings_insert_org" on public.client_tax_column_mappings;
drop policy if exists "client_tax_column_mappings_update_org" on public.client_tax_column_mappings;
drop policy if exists "client_tax_column_mappings_delete_org" on public.client_tax_column_mappings;

create policy "client_tax_column_mappings_select_org"
  on public.client_tax_column_mappings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.clients c
      where c.id = client_tax_column_mappings.client_id
        and c.organization_id = (select public.current_user_org())
    )
  );

create policy "client_tax_column_mappings_insert_org"
  on public.client_tax_column_mappings
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.clients c
      where c.id = client_tax_column_mappings.client_id
        and c.organization_id = (select public.current_user_org())
    )
  );

create policy "client_tax_column_mappings_update_org"
  on public.client_tax_column_mappings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.clients c
      where c.id = client_tax_column_mappings.client_id
        and c.organization_id = (select public.current_user_org())
    )
  )
  with check (
    exists (
      select 1
      from public.clients c
      where c.id = client_tax_column_mappings.client_id
        and c.organization_id = (select public.current_user_org())
    )
  );

create policy "client_tax_column_mappings_delete_org"
  on public.client_tax_column_mappings
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.clients c
      where c.id = client_tax_column_mappings.client_id
        and c.organization_id = (select public.current_user_org())
    )
  );

grant select, insert, update, delete on table public.client_tax_column_mappings to authenticated;
