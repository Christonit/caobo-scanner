-- =====================================================================
-- Client extraction document preferences
-- =====================================================================
-- Concepto Id / Tipo de Pago Id / Tipo de Gasto context catalogs are
-- configured once per client (on the client detail page) instead of on
-- every extraction run. Nullable FKs so an unconfigured client can still
-- exist; ON DELETE SET NULL clears a preference if its document is removed.
-- =====================================================================

alter table public.clients
  add column if not exists concepto_document_id uuid
    references public.client_documents (id) on delete set null,
  add column if not exists tipo_de_pago_document_id uuid
    references public.client_documents (id) on delete set null,
  add column if not exists tipo_de_gasto_context_document_id uuid
    references public.client_documents (id) on delete set null;

create index if not exists clients_concepto_document_id_idx
  on public.clients (concepto_document_id)
  where concepto_document_id is not null;

create index if not exists clients_tipo_de_pago_document_id_idx
  on public.clients (tipo_de_pago_document_id)
  where tipo_de_pago_document_id is not null;

create index if not exists clients_tipo_de_gasto_context_document_id_idx
  on public.clients (tipo_de_gasto_context_document_id)
  where tipo_de_gasto_context_document_id is not null;
