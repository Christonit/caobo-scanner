import { readBody } from "h3";

// Ingest endpoint for the activity logger. Called via navigator.sendBeacon
// from the browser (keeps telemetry out of the visible network tab / fetch
// waterfall). Only *successful* actions are sent by the client.
//
// The beacon carries the Supabase auth cookie (same-origin), so we resolve
// the caller server-side and write with the service role — the client can
// never spoof actor_id or organization_id.
export default defineEventHandler(async (event) => {
  let body: {
    organizationId?: string | null;
    action?: string;
    clientId?: string | null;
    targetLabel?: string | null;
    metadata?: Record<string, unknown> | null;
  };
  try {
    body = (await readBody(event)) ?? {};
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Cuerpo inválido." });
  }

  if (!isActivityAction(body.action)) {
    throw createError({ statusCode: 400, statusMessage: "Acción no válida." });
  }

  const admin = useSupabaseAdmin(event);
  const ctx = await resolveActivityContext(event, admin, body.organizationId);

  // Only accept a client_id that actually belongs to the caller's org.
  let clientId: string | null = null;
  if (body.clientId) {
    const { data: client } = await admin
      .from("clients")
      .select("id")
      .eq("id", body.clientId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    clientId = client?.id ?? null;
  }

  const metadata =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? body.metadata
      : {};

  const targetLabel =
    typeof body.targetLabel === "string"
      ? body.targetLabel.slice(0, 300)
      : null;

  const { error } = await admin.from("activity_events").insert({
    organization_id: ctx.organizationId,
    actor_id: ctx.userId,
    action: body.action,
    client_id: clientId,
    target_label: targetLabel,
    metadata,
  });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  // Beacons ignore the body; 202 keeps semantics clear for the fetch fallback.
  setResponseStatus(event, 202);
  return { ok: true };
});
