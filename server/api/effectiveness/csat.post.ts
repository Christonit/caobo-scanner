import { readBody } from "h3";

// Record the binary CSAT (good | bad) captured after Excel export of a
// session. One answer per session; a later beacon overwrites the earlier one.
export default defineEventHandler(async (event) => {
  if (!isEffectivenessEnabled(event)) {
    setResponseStatus(event, 204);
    return { ok: false };
  }

  let body: {
    sessionId?: string;
    organizationId?: string | null;
    csat?: string;
    comment?: string | null;
  };
  try {
    body = (await readBody(event)) ?? {};
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Cuerpo inválido." });
  }

  if (!isUuid(body.sessionId)) {
    throw createError({ statusCode: 400, statusMessage: "sessionId inválido." });
  }
  if (!isCsat(body.csat)) {
    throw createError({ statusCode: 400, statusMessage: "csat inválido." });
  }

  const admin = useSupabaseAdmin(event);
  const ctx = await resolveActivityContext(event, admin, body.organizationId);

  const comment =
    typeof body.comment === "string" && body.comment.trim()
      ? body.comment.trim().slice(0, 1000)
      : null;

  // Scope the update to the caller's org so a spoofed sessionId cannot touch
  // another org's row.
  const { error } = await admin
    .from("effectiveness_sessions")
    .update({
      csat: body.csat,
      csat_at: new Date().toISOString(),
      csat_comment: comment,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.sessionId)
    .eq("organization_id", ctx.organizationId);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  setResponseStatus(event, 202);
  return { ok: true };
});
