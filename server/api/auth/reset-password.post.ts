import { serverSupabaseUser } from "#supabase/server";

// Self-service password reset: any authenticated user can request a reset
// link for their own account. Sends via Resend when configured, else falls
// back to Supabase SMTP. This is separate from the admin-initiated reset in
// /api/team/members/reset-password (which requires admin role).
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "No autenticado." });
  }

  const email = user.email;
  if (!email) {
    throw createError({
      statusCode: 400,
      statusMessage: "Tu cuenta no tiene correo asociado.",
    });
  }

  const admin = useSupabaseAdmin(event);
  const siteUrl = getSiteUrl(event);
  const redirectTo = `${siteUrl}/auth/callback`;

  if (isResendConfigured()) {
    await sendRecoveryEmailWithResend(admin, { email, redirectTo });
  } else {
    const { error: resetError } = await admin.auth.resetPasswordForEmail(
      email,
      { redirectTo },
    );
    if (resetError) {
      throw createError({
        statusCode: 500,
        statusMessage: formatEmailError(
          resetError,
          "No se pudo enviar el correo. Configura RESEND_API_KEY o Custom SMTP en Supabase.",
        ),
      });
    }
  }

  return { ok: true, email };
});
