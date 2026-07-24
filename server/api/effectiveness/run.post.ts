import { readBody } from "h3";

// Persist one Procesar / reanalysis run and roll its totals up onto the
// parent session. Sent via navigator.sendBeacon after the AI batch resolves.
//
// The run carries programmatic first-pass quality only: per-field critical
// failures (empty / incomplete / invalid_length / required_missing) computed
// client-side before the user edits anything. No raw AI JSON is stored here.
export default defineEventHandler(async (event) => {
  if (!isEffectivenessEnabled(event)) {
    setResponseStatus(event, 204);
    return { ok: false };
  }

  let body: {
    sessionId?: string;
    organizationId?: string | null;
    clientId?: string | null;
    runIndex?: number;
    isReanalysis?: boolean;
    pagesInRun?: number;
    aiDurationMs?: number | null;
    pagesOk?: number;
    pagesWithFailures?: number;
    correctnessPct?: number | null;
    fieldFailures?: Record<string, number> | null;
    failureReasons?: Record<string, Record<string, number>> | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  };
  try {
    body = (await readBody(event)) ?? {};
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Cuerpo inválido." });
  }

  if (!isUuid(body.sessionId)) {
    throw createError({ statusCode: 400, statusMessage: "sessionId inválido." });
  }

  const admin = useSupabaseAdmin(event);
  const ctx = await resolveActivityContext(event, admin, body.organizationId);

  const clientId = await resolveOwnedClientId(
    admin,
    ctx.organizationId,
    body.clientId,
  );

  const runIndex = Math.max(1, toInt(body.runIndex) ?? 1);
  const isReanalysis = body.isReanalysis === true || runIndex > 1;
  const pagesInRun = Math.max(0, toInt(body.pagesInRun) ?? 0);
  const aiDurationMs = toInt(body.aiDurationMs);
  const pagesOk = Math.max(0, toInt(body.pagesOk) ?? 0);
  const pagesWithFailures = Math.max(0, toInt(body.pagesWithFailures) ?? 0);
  const correctnessPct =
    body.correctnessPct == null ? null : Number(body.correctnessPct);
  const fieldFailures =
    body.fieldFailures && typeof body.fieldFailures === "object"
      ? body.fieldFailures
      : {};
  const failureReasons =
    body.failureReasons && typeof body.failureReasons === "object"
      ? body.failureReasons
      : {};
  const finishedAt =
    typeof body.finishedAt === "string" && body.finishedAt
      ? body.finishedAt
      : new Date().toISOString();
  const startedAt =
    typeof body.startedAt === "string" && body.startedAt
      ? body.startedAt
      : null;

  // Safety net: seed the parent session if its create beacon has not landed
  // yet (sendBeacon ordering is not guaranteed). ignoreDuplicates keeps the
  // real create's richer data (email / client name) when it arrives/arrived.
  const email = await lookupUserEmail(admin, ctx.userId);
  await admin.from("effectiveness_sessions").upsert(
    {
      id: body.sessionId,
      organization_id: ctx.organizationId,
      user_id: ctx.userId,
      user_email: email,
      client_id: clientId,
      status: "in_progress",
      started_at: startedAt ?? new Date().toISOString(),
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  // Upsert on (session_id, run_index) so a retried beacon does not
  // double-count pages / AI time on the parent session.
  const { data: insertedRun, error: runError } = await admin
    .from("effectiveness_runs")
    .upsert(
      {
        session_id: body.sessionId,
        organization_id: ctx.organizationId,
        user_id: ctx.userId,
        client_id: clientId,
        run_index: runIndex,
        is_reanalysis: isReanalysis,
        pages_in_run: pagesInRun,
        ai_duration_ms: aiDurationMs,
        pages_ok: pagesOk,
        pages_with_failures: pagesWithFailures,
        correctness_pct: Number.isFinite(correctnessPct as number)
          ? (correctnessPct as number)
          : null,
        field_failures: fieldFailures,
        failure_reasons: failureReasons,
        started_at: startedAt,
        finished_at: finishedAt,
      },
      {
        onConflict: "session_id,run_index",
        ignoreDuplicates: true,
      },
    )
    .select("id")
    .maybeSingle();

  if (runError) {
    throw createError({ statusCode: 500, statusMessage: runError.message });
  }

  // Duplicate beacon → row already existed; skip session rollup.
  if (!insertedRun) {
    setResponseStatus(event, 202);
    return { ok: true, duplicate: true };
  }

  // Roll the run up onto the session. Low concurrency (one user's own
  // session) makes read-modify-write safe enough for telemetry.
  const { data: session } = await admin
    .from("effectiveness_sessions")
    .select(
      "total_ai_ms, page_count, reanalysis_count, first_process_at, first_process_ai_ms",
    )
    .eq("id", body.sessionId)
    .maybeSingle();

  if (session) {
    const update: Record<string, unknown> = {
      total_ai_ms: (session.total_ai_ms ?? 0) + (aiDurationMs ?? 0),
      updated_at: new Date().toISOString(),
    };
    if (isReanalysis) {
      update.reanalysis_count = (session.reanalysis_count ?? 0) + 1;
    }
    // First Procesar defines the session's page volume + first-pass timing.
    if (runIndex === 1 && !session.first_process_at) {
      update.first_process_at = finishedAt;
      update.first_process_ai_ms = aiDurationMs;
      update.page_count = pagesInRun;
    }
    await admin
      .from("effectiveness_sessions")
      .update(update)
      .eq("id", body.sessionId);
  }

  setResponseStatus(event, 202);
  return { ok: true };
});
