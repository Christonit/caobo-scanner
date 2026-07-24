import { readBody } from "h3";

// Create (or upsert) an effectiveness session — called once when the first
// PDF of a batch is dropped. The session id is minted client-side and shared
// with the in-app extraction workflow id so later run / csat / end beacons
// can reference it. Idempotent: a repeated create keeps the earliest row.
//
// Beacon endpoint (navigator.sendBeacon → service-role write); the client can
// never spoof user_id / organization_id.
export default defineEventHandler(async (event) => {
  if (!isEffectivenessEnabled(event)) {
    setResponseStatus(event, 204);
    return { ok: false };
  }

  let body: {
    sessionId?: string;
    organizationId?: string | null;
    clientId?: string | null;
    clientName?: string | null;
    startedAt?: string | null;
    pageCount?: number | null;
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
  const email = await lookupUserEmail(admin, ctx.userId);

  const clientName =
    typeof body.clientName === "string" ? body.clientName.slice(0, 300) : null;
  const startedAt =
    typeof body.startedAt === "string" && body.startedAt
      ? body.startedAt
      : new Date().toISOString();
  const pageCount = Math.max(0, toInt(body.pageCount) ?? 0);

  // Insert if new; if the session already exists (create beacon retried, or a
  // run beacon raced ahead and seeded it), leave the original timing intact.
  const { error } = await admin
    .from("effectiveness_sessions")
    .upsert(
      {
        id: body.sessionId,
        organization_id: ctx.organizationId,
        user_id: ctx.userId,
        user_email: email,
        client_id: clientId,
        client_name: clientName,
        status: "in_progress",
        started_at: startedAt,
        page_count: pageCount,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  setResponseStatus(event, 202);
  return { ok: true, sessionId: body.sessionId };
});
