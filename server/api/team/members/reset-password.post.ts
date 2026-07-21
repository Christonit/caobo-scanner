import { getRequestURL, readBody } from "h3";

// Sends a "reset your password" email to a member on an admin's behalf.
// The member sets their own new password via the same /auth/callback flow
// used for invites — the admin never sees or sets the password directly.
export default defineEventHandler(async (event) => {
  const body = await readBody<{
    userId?: string;
    organizationId?: string;
  }>(event);

  const userId = body?.userId?.trim();
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "Falta el miembro." });
  }

  const admin = useSupabaseAdmin(event);
  const caller = await authorizeTeamCaller(event, admin, body?.organizationId);

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

  const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(
    userId
  );
  if (authUserError || !authUser?.user?.email) {
    throw createError({
      statusCode: 404,
      statusMessage: "No se encontró el correo de ese miembro.",
    });
  }

  const siteUrl = getRequestURL(event).origin;
  const { error: resetError } = await admin.auth.resetPasswordForEmail(
    authUser.user.email,
    // Point directly at the set-password page so the PKCE code is exchanged
    // there, keeping the PASSWORD_RECOVERY session alive when updateUser runs.
    { redirectTo: `${siteUrl}/auth/reset-password` }
  );

  if (resetError) {
    throw createError({ statusCode: 500, statusMessage: resetError.message });
  }

  return { ok: true, email: authUser.user.email };
});
