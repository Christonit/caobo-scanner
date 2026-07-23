-- Expand activity_events.action CHECK for document / annotation / suplidor
-- CRUD. Safe to re-run if 20260721000003 already shipped the full list
-- (drop + recreate is idempotent on the constraint name).

alter table public.activity_events
  drop constraint if exists activity_events_action_check;

alter table public.activity_events
  add constraint activity_events_action_check check (
    action in (
      'client_created',
      'client_updated',
      'document_added',
      'document_updated',
      'document_removed',
      'annotation_added',
      'annotation_updated',
      'annotation_removed',
      'suplidor_added',
      'suplidor_updated',
      'suplidor_removed',
      'gastos_analyzed',
      'gastos_exported',
      'suplidores_analyzed',
      'suplidores_stored',
      'suplidores_exported',
      'rows_deferred',
      'export_rated'
    )
  );

-- Optional helper index for grouping extraction events by session_id in metadata.
create index if not exists activity_events_session_id_idx
  on public.activity_events ((metadata ->> 'session_id'))
  where metadata ? 'session_id';
