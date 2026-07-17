import { readBody } from "h3";

// Enables/disables a member's ability to sign in (Supabase auth "ban"),
// without deleting their profile or history. Admins can't disable
// themselves — that would lock them out with no way back in.
export default defineEventHandler(async (event) => {
  const body = await readBody<{
    userId?: string;
    disabled?: boolean;
    organizationId?: string;
  }>(event);

  const userId = body?.userId?.trim();
  const disabled = Boolean(body?.disabled);

  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "Falta el miembro." });
  }

  const admin = useSupabaseAdmin(event);
  const caller = await authorizeTeamCaller(event, admin, body?.organizationId);

  if (userId === caller.userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "No puedes deshabilitar tu propia cuenta.",
    });
  }

  const { data: targetProfile, error: profileError } = await admin
    .from("user_profiles")
    .select("id, organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw createError({ statusCode: 500, statusMessage: profileError.message });
  }
  if (!targetProfile || targetProfile.organization_id !== caller.organizationId) {
    throw createError({ statusCode: 404, statusMessage: "Miembro no encontrado." });
  }

  // ~100 years — effectively indefinite until explicitly re-enabled.
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: disabled ? "876000h" : "none",
  });

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: updateError.message });
  }

  return { ok: true, userId, disabled };
});
