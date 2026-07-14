-- =====================================================================
-- client_documents: add a document-level "comment" column
-- =====================================================================
-- document_attributes already has a per-attribute `description` (surfaced
-- in the UI as "Comentario") that is fed to the LLM extraction prompt. This
-- adds the equivalent free-text comment at the *document* level (e.g. the
-- "Gastos" container itself), so users can give the AI broader context that
-- applies to every attribute in that document, not just one row.
-- =====================================================================

alter table public.client_documents
  add column if not exists comment text;
