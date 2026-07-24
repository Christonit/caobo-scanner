import { readBody } from "h3";

// Sends a "reset your password" email to a member on an admin's behalf.
// The member sets their own new password via the same /auth/callback flow
// used for invites — the admin never sees or sets the password directly.
//
// Prefer Resend + generateLink(recovery) when RESEND_API_KEY is set so a
// misconfigured Supabase SMTP sender (e.g. @gmail.com) does not 500 with `{}`.
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
    userId,
  );
  if (authUserError || !authUser?.user?.email) {
    throw createError({
      statusCode: 404,
      statusMessage: "No se encontró el correo de ese miembro.",
    });
  }

  const siteUrl = getSiteUrl(event);
  // Route through /auth/callback so it can catch PASSWORD_RECOVERY before the
  // page listener is set up — going straight to /auth/reset-password causes a
  // race where supabase-js processes the hash before onMounted fires.
  const redirectTo = `${siteUrl}/auth/callback`;
  const email = authUser.user.email;

  if (isResendConfigured()) {
    await sendRecoveryEmailWithResend(admin, { email, redirectTo });
  } else {
    const { error: resetError } = await admin.auth.resetPasswordForEmail(
      email,
      // /auth/callback detects PASSWORD_RECOVERY and redirects to
      // /auth/reset-password — avoids the race on the reset page itself.
      { redirectTo },
    );

    if (resetError) {
      throw createError({
        statusCode: 500,
        statusMessage: formatEmailError(
          resetError,
          "No se pudo enviar el correo de restablecimiento. Configura RESEND_API_KEY o Custom SMTP (sender en un dominio verificado en Resend, no @gmail.com).",
        ),
      });
    }
  }

  return { ok: true, email };
});
