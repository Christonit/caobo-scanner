-- =====================================================================
-- Activity logger: public.activity_events
-- =====================================================================
-- Append-only stream of *successful* user actions, org-scoped, used by the
-- /activity view. Distinct from the legacy (unused) public.activity_logs
-- table: this one is purpose-built for the activity logger — flexible
-- action set, an optional client reference, a denormalized human label
-- (so rows still read well even if the client is later deleted) and a
-- free-form metadata jsonb (page counts, suplidores counts, ratings…).
--
-- Visibility model (enforced by RLS + the read endpoint):
--   - admins / superadmins → every event in the organization
--   - collaborators        → only their own events
--
-- Writes come in via the beacon endpoint (navigator.sendBeacon →
-- /api/activity/log) using the service role after the server has resolved
-- the caller. The self-insert RLS policy below is defense-in-depth for any
-- future direct client write.
-- =====================================================================

create table if not exists public.activity_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id        uuid references auth.users (id) on delete set null,
  action          text not null,
  -- Optional client the action was performed for/against.
  client_id       uuid references public.clients (id) on delete set null,
  -- Denormalized label captured at write time (client name, or a short
  -- human summary) so the feed renders without extra joins and survives
  -- client deletion.
  target_label    text,
  -- Action-specific details: { pages, count, is_rescan, rating, ... }.
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  constraint activity_events_action_check check (
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
  )
);

create index if not exists activity_events_org_time_idx
  on public.activity_events (organization_id, created_at desc);

create index if not exists activity_events_actor_idx
  on public.activity_events (actor_id);

create index if not exists activity_events_client_idx
  on public.activity_events (client_id);

alter table public.activity_events enable row level security;

-- Read: own rows, or (for org admins) any row in their org, or superadmins.
drop policy if exists "activity_events_select" on public.activity_events;
create policy "activity_events_select"
  on public.activity_events
  for select
  to authenticated
  using (
    actor_id = (select auth.uid())
    or public.is_superadmin()
    or exists (
      select 1
      from public.user_profiles up
      where up.id = (select auth.uid())
        and up.role = 'admin'
        and up.organization_id = activity_events.organization_id
    )
  );

-- Write: a user may only insert their own events, scoped to their active org
-- (superadmins may write to any org they are acting on). The server endpoint
-- uses the service role and bypasses this; kept as defense-in-depth.
drop policy if exists "activity_events_insert_self" on public.activity_events;
create policy "activity_events_insert_self"
  on public.activity_events
  for insert
  to authenticated
  with check (
    actor_id = (select auth.uid())
    and (
      public.is_superadmin()
      or organization_id = (select public.current_user_org())
    )
  );

grant select, insert on table public.activity_events to authenticated;
grant all on table public.activity_events to service_role;
