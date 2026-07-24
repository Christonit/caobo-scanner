import { getQuery } from "h3";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/types/database.types";
import {
  SPEND_RANGE_KEYS,
  type SpendBucket,
  type SpendLeaderboardResponse,
  type SpendRangeKey,
} from "~/types/spend";

// Spend leaderboard for /leaderboard: who is burning tokens (and dollars) on
// Gemini calls, bucketed by local calendar day.
//
// Admin-only: collaborators can read their own api_token_usage rows through
// RLS, but a per-user ranking of the whole team is management data, so this
// route rejects them outright (403) instead of silently narrowing the scope.
//
// Aggregation happens here rather than in Postgres so the reporting timezone
// stays a request-time concern and no migration is needed to ship the view.
// Rows are one-per-API-call, so a 30-day window is small; the page cap below
// keeps a pathological org from allocating unbounded memory.

const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

/** Longest rolling window we report on (charts, day detail, "últimos 30 días"). */
const ROLLING_DAYS = 30;

/** Sentinel for "rows with no client attached" in the ?clientId filter. */
const UNASSIGNED_CLIENT = "none";

interface UsageRow {
  created_at: string;
  actor_id: string | null;
  client_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | string | null;
}

function emptyBucket(): SpendBucket {
  return { tokens: 0, inputTokens: 0, outputTokens: 0, cost: 0, calls: 0 };
}

function emptyRanges(): Record<SpendRangeKey, SpendBucket> {
  return Object.fromEntries(
    SPEND_RANGE_KEYS.map((range) => [range, emptyBucket()]),
  ) as Record<SpendRangeKey, SpendBucket>;
}

function toCount(value: number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// numeric(18,8) can come back as a string depending on the client/driver.
function toCost(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function accumulate(bucket: SpendBucket, row: UsageRow): void {
  const input = toCount(row.input_tokens);
  const output = toCount(row.output_tokens);
  const total = toCount(row.total_tokens) || input + output;
  bucket.tokens += total;
  bucket.inputTokens += input;
  bucket.outputTokens += output;
  bucket.cost += toCost(row.cost_usd);
  bucket.calls += 1;
}

async function fetchUsageRows(
  admin: SupabaseClient<Database>,
  organizationId: string,
  sinceIso: string,
): Promise<{ rows: UsageRow[]; truncated: boolean }> {
  const rows: UsageRow[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await admin
      .from("api_token_usage")
      .select(
        "created_at, actor_id, client_id, input_tokens, output_tokens, total_tokens, cost_usd",
      )
      .eq("organization_id", organizationId)
      .gte("created_at", sinceIso)
      // id breaks created_at ties so paging can't skip or repeat a row.
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message });
    }

    const batch = (data ?? []) as UsageRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return { rows, truncated: false };
  }

  return { rows, truncated: true };
}

/** Names + emails for the actors present in the window (emails need auth.users). */
async function resolveActors(
  admin: SupabaseClient<Database>,
  actorIds: string[],
): Promise<Map<string, { name: string | null; email: string | null }>> {
  const actors = new Map<string, { name: string | null; email: string | null }>();
  if (!actorIds.length) return actors;

  const { data: profiles } = await admin
    .from("user_profiles")
    .select("id, full_name")
    .in("id", actorIds);
  for (const p of profiles ?? []) {
    actors.set(p.id, { name: p.full_name, email: null });
  }

  await Promise.all(
    actorIds.map(async (id) => {
      const { data: authUser } = await admin.auth.admin.getUserById(id);
      const existing = actors.get(id) ?? { name: null, email: null };
      existing.email = authUser?.user?.email ?? null;
      if (!existing.name) {
        const meta = authUser?.user?.user_metadata as
          | { full_name?: string }
          | undefined;
        existing.name = meta?.full_name ?? null;
      }
      actors.set(id, existing);
    }),
  );

  return actors;
}

export default defineEventHandler(async (event): Promise<SpendLeaderboardResponse> => {
  const query = getQuery(event) as {
    organizationId?: string;
    clientId?: string;
    timezone?: string;
  };

  const admin = useSupabaseAdmin(event);
  const ctx = await resolveActivityContext(event, admin, query.organizationId);

  if (ctx.role !== "admin" && ctx.role !== "superadmin") {
    throw createError({
      statusCode: 403,
      statusMessage: "Solo un administrador puede ver el consumo del equipo.",
    });
  }

  const timeZone = isValidTimeZone(query.timezone)
    ? query.timezone
    : DEFAULT_REPORT_TIMEZONE;

  const now = new Date();
  const todayKey = localDayKey(now, timeZone);
  const yesterdayKey = shiftDayKey(todayKey, -1);
  const thisMonthKey = monthKeyOf(todayKey);
  const lastMonthKey = shiftMonthKey(thisMonthKey, -1);

  const rollingStartKey = shiftDayKey(todayKey, -(ROLLING_DAYS - 1));
  // The previous calendar month can start earlier than the rolling window.
  const lastMonthStartKey = firstDayOfMonthKey(lastMonthKey);
  const windowStartKey =
    lastMonthStartKey < rollingStartKey ? lastMonthStartKey : rollingStartKey;

  const { rows, truncated } = await fetchUsageRows(
    admin,
    ctx.organizationId,
    startOfLocalDayUtc(windowStartKey, timeZone).toISOString(),
  );

  // Client options are derived from the *unfiltered* window so picking a client
  // never removes the other clients from the dropdown.
  const clientIds = [
    ...new Set(rows.map((r) => r.client_id).filter(Boolean) as string[]),
  ];
  const clientNames = new Map<string, string>();
  if (clientIds.length) {
    // Service role, so soft-deleted clients still resolve to a readable name.
    const { data: clientRows } = await admin
      .from("clients")
      .select("id, name, deleted_at")
      .in("id", clientIds);
    for (const c of clientRows ?? []) {
      clientNames.set(c.id, c.deleted_at ? `${c.name} (eliminado)` : c.name);
    }
  }
  const hasUnassigned = rows.some((r) => !r.client_id);

  const clientFilter = (query.clientId ?? "").trim();
  const scoped =
    clientFilter === UNASSIGNED_CLIENT
      ? rows.filter((r) => !r.client_id)
      : clientFilter
        ? rows.filter((r) => r.client_id === clientFilter)
        : rows;

  // --- Ranges -------------------------------------------------------------
  // Rolling ranges include today (a 7-day range is today + the 6 before it).
  const rangeStarts = {
    last5: shiftDayKey(todayKey, -4),
    last7: shiftDayKey(todayKey, -6),
    last15: shiftDayKey(todayKey, -14),
    last30: rollingStartKey,
  };

  const inRange: Record<SpendRangeKey, (dayKey: string) => boolean> = {
    today: (k) => k === todayKey,
    yesterday: (k) => k === yesterdayKey,
    last5: (k) => k >= rangeStarts.last5 && k <= todayKey,
    last7: (k) => k >= rangeStarts.last7 && k <= todayKey,
    last15: (k) => k >= rangeStarts.last15 && k <= todayKey,
    last30: (k) => k >= rangeStarts.last30 && k <= todayKey,
    thisMonth: (k) => monthKeyOf(k) === thisMonthKey && k <= todayKey,
    lastMonth: (k) => monthKeyOf(k) === lastMonthKey,
  };

  // --- Aggregation --------------------------------------------------------
  const totals = emptyRanges();

  const perDay = new Map<string, SpendBucket>();
  const perDayUser = new Map<string, Map<string, SpendBucket>>();
  const perUser = new Map<string, Record<SpendRangeKey, SpendBucket>>();

  for (const row of scoped) {
    const dayKey = localDayKey(new Date(row.created_at), timeZone);
    const actorId = row.actor_id ?? "";

    let userRanges = perUser.get(actorId);
    if (!userRanges) {
      userRanges = emptyRanges();
      perUser.set(actorId, userRanges);
    }

    for (const range of SPEND_RANGE_KEYS) {
      if (!inRange[range](dayKey)) continue;
      accumulate(totals[range], row);
      accumulate(userRanges[range], row);
    }

    // Daily series only covers the rolling window (chart + day detail).
    if (dayKey >= rollingStartKey && dayKey <= todayKey) {
      let day = perDay.get(dayKey);
      if (!day) {
        day = emptyBucket();
        perDay.set(dayKey, day);
      }
      accumulate(day, row);

      let dayUsers = perDayUser.get(dayKey);
      if (!dayUsers) {
        dayUsers = new Map<string, SpendBucket>();
        perDayUser.set(dayKey, dayUsers);
      }
      let dayUser = dayUsers.get(actorId);
      if (!dayUser) {
        dayUser = emptyBucket();
        dayUsers.set(actorId, dayUser);
      }
      accumulate(dayUser, row);
    }
  }

  const actors = await resolveActors(
    admin,
    [...perUser.keys()].filter(Boolean),
  );

  function actorLabel(actorId: string): {
    name: string | null;
    email: string | null;
  } {
    if (!actorId) return { name: null, email: null };
    return actors.get(actorId) ?? { name: null, email: null };
  }

  // Zero-filled so the chart keeps its day spacing on quiet days.
  const days = dayKeyRange(rollingStartKey, todayKey).map((dayKey) => {
    const bucket = perDay.get(dayKey) ?? emptyBucket();
    const byUser = [...(perDayUser.get(dayKey)?.entries() ?? [])]
      .map(([actorId, b]) => ({
        userId: actorId || null,
        ...actorLabel(actorId),
        ...b,
      }))
      .sort((a, b) => b.cost - a.cost || b.tokens - a.tokens);
    return { date: dayKey, ...bucket, byUser };
  });

  const leaderboard = [...perUser.entries()]
    .map(([actorId, ranges]) => ({
      userId: actorId || null,
      ...actorLabel(actorId),
      ...ranges,
    }))
    .sort(
      (a, b) =>
        b.last30.cost - a.last30.cost || b.last30.tokens - a.last30.tokens,
    );

  return {
    role: ctx.role,
    organizationId: ctx.organizationId,
    timezone: timeZone,
    generatedAt: now.toISOString(),
    // The UI warns when the window was capped so numbers aren't read as final.
    truncated,
    window: { startDate: windowStartKey, endDate: todayKey },
    rollingStartDate: rollingStartKey,
    clients: [...clientNames.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
    hasUnassignedClient: hasUnassigned,
    totals,
    days,
    leaderboard,
  };
});
