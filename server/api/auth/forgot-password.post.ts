import { readBody } from "h3";

// Public self-service "forgot my password" endpoint for logged-out users.
// Unlike calling supabase.auth.resetPasswordForEmail() straight from the
// browser (see pages/forgot-password.vue's previous implementation), this
// route uses the *admin* client + our own token_hash-based link (see
// server/utils/authEmail.ts) so the reset link works from any device or
// browser — not just the one that submitted this form.
//
// Calling resetPasswordForEmail() from the browser stores a PKCE
// code_verifier in that browser's localStorage and mails a `?code=...`
// link. That only redeems successfully in the *same* browser that
// requested it — opening the email on a phone, in a different browser, or
// even the same browser after clearing storage reliably fails with "PKCE
// code verifier not found in storage", which is exactly the "still expired"
// symptom this route fixes.
//
// Never reveals whether an email is registered (avoid user enumeration):
// always responds { ok: true } regardless of whether we actually sent
// anything.
export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string }>(event);
  const email = body?.email?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: "Correo inválido." });
  }

  const admin = useSupabaseAdmin(event);
  const siteUrl = getSiteUrl(event);
  const redirectTo = `${siteUrl}/auth/callback`;

  const authUser = await findAuthUserByEmail(admin, email);
  if (!authUser) {
    // Don't leak whether the account exists — respond as if it worked.
    return { ok: true };
  }

  if (isResendConfigured()) {
    await sendRecoveryEmailWithResend(admin, { email: authUser.email!, redirectTo });
  } else {
    const { error: resetError } = await admin.auth.resetPasswordForEmail(
      authUser.email!,
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

  return { ok: true };
});

async function findAuthUserByEmail(
  admin: ReturnType<typeof useSupabaseAdmin>,
  email: string,
) {
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message });
    }
    const found = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === email,
    );
    if (found) return found;
    if (data.users.length < 200) break;
  }
  return null;
}
