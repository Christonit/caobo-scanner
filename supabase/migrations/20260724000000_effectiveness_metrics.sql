-- =====================================================================
-- Tool effectiveness metrics: effectiveness_sessions + effectiveness_runs
-- =====================================================================
-- Purpose-built telemetry for the "tool vs manual" effectiveness study
-- (see docs/tool-vs-manual-effectiveness-test.md). Kept separate from the
-- general activity_events stream because the questions are different:
--   - how long a batch takes (session start -> end, AI time)
--   - how many receipts an employee scans (page_count per user/email)
--   - first-pass quality (critical fields empty / incomplete / invalid)
--   - reanalysis load (runs after the first Procesar)
--   - binary CSAT (good | bad) after the first Procesar of a session
--
-- Writes come in via feature-flagged Nitro endpoints
-- (server/api/effectiveness/**) using navigator.sendBeacon, resolved with
-- the service role so the client can never spoof actor / org. The RLS
-- policies below are defense-in-depth for any future direct client write.
--
-- A "session" is one work unit: first PDF drop -> discard / reload / export.
-- A "run" is one Procesar (run_index = 1) or reanalysis (run_index >= 2).
-- =====================================================================

create table if not exists public.effectiveness_sessions (
  -- Client-minted UUID (shared with the in-app extraction workflow id) so
  -- runs / csat / end beacons can reference the session even if they arrive
  -- before the create beacon; the run endpoint upserts this row if missing.
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  user_id               uuid references auth.users (id) on delete set null,
  -- Denormalized at write time for easy per-employee rollups even if the
  -- auth user is later removed.
  user_email            text,
  client_id             uuid references public.clients (id) on delete set null,
  client_name           text,
  status                text not null default 'in_progress',
  started_at            timestamptz not null default now(),
  ended_at              timestamptz,
  -- First Procesar click + wall time of that first AI batch.
  first_process_at      timestamptz,
  first_process_ai_ms   integer,
  -- Sum of every run's AI duration in the session.
  total_ai_ms           integer not null default 0,
  -- Unique pages/rows processed in the session (volume metric).
  page_count            integer not null default 0,
  -- Number of runs after the first (reanalysis load).
  reanalysis_count      integer not null default 0,
  csat                  text,
  csat_at               timestamptz,
  csat_comment          text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint effectiveness_sessions_status_check check (
    status in ('in_progress', 'exported', 'discarded', 'abandoned')
  ),
  constraint effectiveness_sessions_csat_check check (
    csat is null or csat in ('good', 'bad')
  )
);

create table if not exists public.effectiveness_runs (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null references public.effectiveness_sessions (id) on delete cascade,
  -- Denormalized for RLS / analytics queries without a join.
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  user_id               uuid references auth.users (id) on delete set null,
  client_id             uuid references public.clients (id) on delete set null,
  run_index             integer not null,
  is_reanalysis         boolean not null default false,
  pages_in_run          integer not null default 0,
  ai_duration_ms        integer,
  -- Pages with zero critical-field failures on this pass.
  pages_ok              integer not null default 0,
  -- Pages with at least one critical-field failure.
  pages_with_failures   integer not null default 0,
  -- pages_ok / pages_in_run * 100.
  correctness_pct       numeric(5, 2),
  -- Per-field failure counts, e.g. {"ncf": 4, "documento": 3}.
  field_failures        jsonb not null default '{}'::jsonb,
  -- Per-field failure reasons, e.g. {"ncf": {"empty": 1, "invalid_length": 3}}.
  failure_reasons       jsonb not null default '{}'::jsonb,
  started_at            timestamptz,
  finished_at           timestamptz,
  created_at            timestamptz not null default now(),
  -- Beacon retries must not insert the same run twice.
  constraint effectiveness_runs_session_run_unique unique (session_id, run_index)
);

create index if not exists effectiveness_sessions_org_time_idx
  on public.effectiveness_sessions (organization_id, started_at desc);

create index if not exists effectiveness_sessions_user_time_idx
  on public.effectiveness_sessions (user_id, started_at desc);

create index if not exists effectiveness_sessions_client_idx
  on public.effectiveness_sessions (client_id);

create index if not exists effectiveness_runs_session_idx
  on public.effectiveness_runs (session_id, run_index);

create index if not exists effectiveness_runs_org_time_idx
  on public.effectiveness_runs (organization_id, finished_at desc);

-- GIN index so "most common failing field" queries over field_failures keys
-- stay fast as the table grows.
create index if not exists effectiveness_runs_field_failures_idx
  on public.effectiveness_runs using gin (field_failures);

-- ---------------------------------------------------------------------
-- Row level security (mirrors activity_events: own rows, org admins see
-- their org, superadmins see everything; server writes with service role).
-- ---------------------------------------------------------------------
alter table public.effectiveness_sessions enable row level security;
alter table public.effectiveness_runs enable row level security;

drop policy if exists "effectiveness_sessions_select" on public.effectiveness_sessions;
create policy "effectiveness_sessions_select"
  on public.effectiveness_sessions
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_superadmin()
    or exists (
      select 1
      from public.user_profiles up
      where up.id = (select auth.uid())
        and up.role = 'admin'
        and up.organization_id = effectiveness_sessions.organization_id
    )
  );

drop policy if exists "effectiveness_sessions_insert_self" on public.effectiveness_sessions;
create policy "effectiveness_sessions_insert_self"
  on public.effectiveness_sessions
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      public.is_superadmin()
      or organization_id = (select public.current_user_org())
    )
  );

drop policy if exists "effectiveness_runs_select" on public.effectiveness_runs;
create policy "effectiveness_runs_select"
  on public.effectiveness_runs
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_superadmin()
    or exists (
      select 1
      from public.user_profiles up
      where up.id = (select auth.uid())
        and up.role = 'admin'
        and up.organization_id = effectiveness_runs.organization_id
    )
  );

drop policy if exists "effectiveness_runs_insert_self" on public.effectiveness_runs;
create policy "effectiveness_runs_insert_self"
  on public.effectiveness_runs
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      public.is_superadmin()
      or organization_id = (select public.current_user_org())
    )
  );

grant select, insert on table public.effectiveness_sessions to authenticated;
grant select, insert on table public.effectiveness_runs to authenticated;
grant all on table public.effectiveness_sessions to service_role;
grant all on table public.effectiveness_runs to service_role;
