-- =====================================================================
-- Clients EAV: client_documents + document_attributes
-- =====================================================================
-- Clients already exist and are org-scoped. This migration:
--   1. Replaces the coarse clients_org_isolation ALL policy with explicit
--      SELECT/INSERT/UPDATE/DELETE policies keyed on current_user_org()
--      (authenticated inserts were being denied by the old policy).
--   2. Adds client_documents (named document groups per client, e.g. "Gastos").
--   3. Adds document_attributes (inverted EAV rows: Concepto / Tipo de Pago
--      style metadata with optional ERP document_id + description).
--
-- IDs: clients use uuid. client_documents use uuid. document_attributes use
-- bigint identity so attribute "Id" values stay integer-friendly for ERP
-- JSON payloads (see the aggregation query at the bottom of this file).
-- =====================================================================

-- ---------- 1. Clients RLS (org-scoped, shared across the org) ----------
alter table public.clients enable row level security;

drop policy if exists "clients_org_isolation" on public.clients;
drop policy if exists "clients_select_org" on public.clients;
drop policy if exists "clients_insert_org" on public.clients;
drop policy if exists "clients_update_org" on public.clients;
drop policy if exists "clients_delete_org" on public.clients;

create policy "clients_select_org"
  on public.clients
  for select
  to authenticated
  using (organization_id = (select public.current_user_org()));

create policy "clients_insert_org"
  on public.clients
  for insert
  to authenticated
  with check (organization_id = (select public.current_user_org()));

create policy "clients_update_org"
  on public.clients
  for update
  to authenticated
  using (organization_id = (select public.current_user_org()))
  with check (organization_id = (select public.current_user_org()));

create policy "clients_delete_org"
  on public.clients
  for delete
  to authenticated
  using (organization_id = (select public.current_user_org()));

grant select, insert, update, delete on table public.clients to authenticated;

-- ---------- 2. client_documents ----------
create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  document_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_documents_client_name_unique unique (client_id, document_name)
);

create index if not exists client_documents_client_id_idx
  on public.client_documents (client_id);

alter table public.client_documents enable row level security;

drop policy if exists "client_documents_select_org" on public.client_documents;
drop policy if exists "client_documents_insert_org" on public.client_documents;
drop policy if exists "client_documents_update_org" on public.client_documents;
drop policy if exists "client_documents_delete_org" on public.client_documents;

create policy "client_documents_select_org"
  on public.client_documents
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.clients c
      where c.id = client_documents.client_id
        and c.organization_id = (select public.current_user_org())
    )
  );

create policy "client_documents_insert_org"
  on public.client_documents
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.clients c
      where c.id = client_documents.client_id
        and c.organization_id = (select public.current_user_org())
    )
  );

create policy "client_documents_update_org"
  on public.client_documents
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.clients c
      where c.id = client_documents.client_id
        and c.organization_id = (select public.current_user_org())
    )
  )
  with check (
    exists (
      select 1
      from public.clients c
      where c.id = client_documents.client_id
        and c.organization_id = (select public.current_user_org())
    )
  );

create policy "client_documents_delete_org"
  on public.client_documents
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.clients c
      where c.id = client_documents.client_id
        and c.organization_id = (select public.current_user_org())
    )
  );

grant select, insert, update, delete on table public.client_documents to authenticated;

-- ---------- 3. document_attributes (inverted EAV) ----------
create table if not exists public.document_attributes (
  id bigint generated always as identity primary key,
  client_document_id uuid not null
    references public.client_documents (id) on delete cascade,
  document_type text not null,
  document_id integer,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists document_attributes_client_document_id_idx
  on public.document_attributes (client_document_id);

alter table public.document_attributes enable row level security;

drop policy if exists "document_attributes_select_org" on public.document_attributes;
drop policy if exists "document_attributes_insert_org" on public.document_attributes;
drop policy if exists "document_attributes_update_org" on public.document_attributes;
drop policy if exists "document_attributes_delete_org" on public.document_attributes;

create policy "document_attributes_select_org"
  on public.document_attributes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.client_documents cd
      join public.clients c on c.id = cd.client_id
      where cd.id = document_attributes.client_document_id
        and c.organization_id = (select public.current_user_org())
    )
  );

create policy "document_attributes_insert_org"
  on public.document_attributes
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.client_documents cd
      join public.clients c on c.id = cd.client_id
      where cd.id = document_attributes.client_document_id
        and c.organization_id = (select public.current_user_org())
    )
  );

create policy "document_attributes_update_org"
  on public.document_attributes
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.client_documents cd
      join public.clients c on c.id = cd.client_id
      where cd.id = document_attributes.client_document_id
        and c.organization_id = (select public.current_user_org())
    )
  )
  with check (
    exists (
      select 1
      from public.client_documents cd
      join public.clients c on c.id = cd.client_id
      where cd.id = document_attributes.client_document_id
        and c.organization_id = (select public.current_user_org())
    )
  );

create policy "document_attributes_delete_org"
  on public.document_attributes
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.client_documents cd
      join public.clients c on c.id = cd.client_id
      where cd.id = document_attributes.client_document_id
        and c.organization_id = (select public.current_user_org())
    )
  );

grant select, insert, update, delete on table public.document_attributes to authenticated;

-- Example ERP payload query (not a migration object — reference only):
--
-- SELECT
--   cd.document_name || ' (Document)' AS document,
--   COALESCE(
--     json_agg(
--       json_build_object(
--         'Id', da.id,
--         'document_type', da.document_type,
--         'document_id', da.document_id,
--         'description', da.description
--       )
--       ORDER BY da.id ASC
--     ) FILTER (WHERE da.id IS NOT NULL),
--     '[]'::json
--   ) AS attributes_list
-- FROM public.client_documents cd
-- LEFT JOIN public.document_attributes da ON cd.id = da.client_document_id
-- WHERE cd.client_id = '<client-uuid>'
--   AND cd.document_name = 'Gastos'
-- GROUP BY cd.id, cd.document_name;
