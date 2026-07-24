import { readBody } from "h3";

// Close an effectiveness session. Sent on export (`exported`), on
// discard/clear (`discarded`), or on page unload (`abandoned`). Only
// advances an already-open session so a late unload beacon never overwrites
// a real `exported` outcome.
export default defineEventHandler(async (event) => {
  if (!isEffectivenessEnabled(event)) {
    setResponseStatus(event, 204);
    return { ok: false };
  }

  let body: {
    sessionId?: string;
    organizationId?: string | null;
    status?: string;
    endedAt?: string | null;
  };
  try {
    body = (await readBody(event)) ?? {};
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Cuerpo inválido." });
  }

  if (!isUuid(body.sessionId)) {
    throw createError({ statusCode: 400, statusMessage: "sessionId inválido." });
  }
  if (!isSessionStatus(body.status) || body.status === "in_progress") {
    throw createError({ statusCode: 400, statusMessage: "status inválido." });
  }

  const admin = useSupabaseAdmin(event);
  const ctx = await resolveActivityContext(event, admin, body.organizationId);

  const endedAt =
    typeof body.endedAt === "string" && body.endedAt
      ? body.endedAt
      : new Date().toISOString();

  // Only close a session that is still in_progress. This makes the terminal
  // outcome first-write-wins (an `exported` close beats a later `abandoned`
  // unload beacon).
  const { error } = await admin
    .from("effectiveness_sessions")
    .update({
      status: body.status,
      ended_at: endedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.sessionId)
    .eq("organization_id", ctx.organizationId)
    .eq("status", "in_progress");

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  setResponseStatus(event, 202);
  return { ok: true };
});
