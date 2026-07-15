-- =====================================================================
-- Client Suplidores: client_suplidores
-- =====================================================================
-- Per-client registry of suppliers (suplidores) extracted from receipts
-- via AI, used to pre-check whether a supplier is already registered on
-- the DGII Carga Masiva platform before uploading a batch.
--
-- Columns match the platform's suplidores upload template:
--   documento  → RNC / Cédula / Pasaporte (digits only, max 20 chars)
--   nombre     → supplier name / razón social (max 255 chars)
--   tipo_de_factura → Formal | Informal | Internacional | Pagos al exterior
--   registered_on_platform → set to true once the suplidor is confirmed
--                             as registered in the platform
--
-- Uniqueness: (client_id, documento) — same supplier cannot appear twice
-- for the same client. Suplidores without a documento use nombre as the
-- natural key instead via a partial unique index.
-- =====================================================================

create table if not exists public.client_suplidores (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  nombre text not null,
  documento text,
  tipo_de_factura text,
  registered_on_platform boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Only one row per (client, documento) when documento is present.
  constraint client_suplidores_client_documento_unique unique (client_id, documento)
);

create index if not exists client_suplidores_client_id_idx
  on public.client_suplidores (client_id);

-- Partial unique index on nombre for rows without a documento value.
create unique index if not exists client_suplidores_client_nombre_no_doc_idx
  on public.client_suplidores (client_id, nombre)
  where documento is null;

alter table public.client_suplidores enable row level security;

drop policy if exists "client_suplidores_select_org" on public.client_suplidores;
drop policy if exists "client_suplidores_insert_org" on public.client_suplidores;
drop policy if exists "client_suplidores_update_org" on public.client_suplidores;
drop policy if exists "client_suplidores_delete_org" on public.client_suplidores;

create policy "client_suplidores_select_org"
  on public.client_suplidores
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.clients c
      where c.id = client_suplidores.client_id
        and c.organization_id = (select public.current_user_org())
    )
  );

create policy "client_suplidores_insert_org"
  on public.client_suplidores
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.clients c
      where c.id = client_suplidores.client_id
        and c.organization_id = (select public.current_user_org())
    )
  );

create policy "client_suplidores_update_org"
  on public.client_suplidores
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.clients c
      where c.id = client_suplidores.client_id
        and c.organization_id = (select public.current_user_org())
    )
  )
  with check (
    exists (
      select 1
      from public.clients c
      where c.id = client_suplidores.client_id
        and c.organization_id = (select public.current_user_org())
    )
  );

create policy "client_suplidores_delete_org"
  on public.client_suplidores
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.clients c
      where c.id = client_suplidores.client_id
        and c.organization_id = (select public.current_user_org())
    )
  );

grant select, insert, update, delete on table public.client_suplidores to authenticated;
