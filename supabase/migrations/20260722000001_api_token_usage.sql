-- =====================================================================
-- API token usage / cost ledger: public.api_token_usage
-- =====================================================================
-- Append-only record of Gemini/Gemma spend. One row per successful API
-- call (single upload, batch upload, suplidores scan batch, …).
--
-- Token counts come from the provider's usage_metadata. Cost is computed
-- at write time from ENV rates keyed by thinking_level (rapido / moderado /
-- profundo); the per-1M rates used are stored on the row so historical
-- spend stays auditable if rates change later.
--
-- Visibility (RLS + read endpoints):
--   - admins / superadmins → every row in the organization
--   - collaborators        → only their own rows
--
-- Writes are expected from the Python backend (service role) or a trusted
-- Nuxt server route after resolving the caller. The self-insert policy is
-- defense-in-depth for any future authenticated client write.
-- =====================================================================

create table if not exists public.api_token_usage (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  -- Who triggered the API call (nullable if the actor can no longer be resolved).
  actor_id             uuid references auth.users (id) on delete set null,
  -- Optional client the call was performed for.
  client_id            uuid references public.clients (id) on delete set null,
  -- UI thinking level that selected the model (drives ENV cost rates).
  thinking_level       text not null,
  -- Concrete model id used for the call.
  model                text not null,
  -- Call site: gastos_single | gastos_batch | suplidores_batch | …
  source               text not null,
  input_tokens         integer not null default 0
                         check (input_tokens >= 0),
  output_tokens        integer not null default 0
                         check (output_tokens >= 0),
  total_tokens         integer not null default 0
                         check (total_tokens >= 0),
  -- USD rates (per 1M tokens) that were applied when the row was written.
  input_cost_per_1m    numeric(18, 8) not null default 0
                         check (input_cost_per_1m >= 0),
  output_cost_per_1m   numeric(18, 8) not null default 0
                         check (output_cost_per_1m >= 0),
  -- Computed: (input_tokens/1e6)*input_cost_per_1m
  --         + (output_tokens/1e6)*output_cost_per_1m
  cost_usd             numeric(18, 8) not null default 0
                         check (cost_usd >= 0),
  -- Free-form extras: filenames, batch size, page counts, …
  metadata             jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  constraint api_token_usage_thinking_level_check check (
    thinking_level in ('rapido', 'moderado', 'profundo')
  ),
  constraint api_token_usage_source_check check (
    char_length(source) between 1 and 64
  )
);

create index if not exists api_token_usage_org_time_idx
  on public.api_token_usage (organization_id, created_at desc);

create index if not exists api_token_usage_actor_idx
  on public.api_token_usage (actor_id);

create index if not exists api_token_usage_client_idx
  on public.api_token_usage (client_id);

create index if not exists api_token_usage_level_idx
  on public.api_token_usage (thinking_level);

alter table public.api_token_usage enable row level security;

-- Read: own rows, or (for org admins) any row in their org, or superadmins.
drop policy if exists "api_token_usage_select" on public.api_token_usage;
create policy "api_token_usage_select"
  on public.api_token_usage
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
        and up.organization_id = api_token_usage.organization_id
    )
  );

-- Write: a user may only insert their own rows, scoped to their active org
-- (superadmins may write to any org). Service-role writes bypass RLS.
drop policy if exists "api_token_usage_insert_self" on public.api_token_usage;
create policy "api_token_usage_insert_self"
  on public.api_token_usage
  for insert
  to authenticated
  with check (
    actor_id = (select auth.uid())
    and (
      public.is_superadmin()
      or organization_id = (select public.current_user_org())
    )
  );

grant select, insert on table public.api_token_usage to authenticated;
grant all on table public.api_token_usage to service_role;
