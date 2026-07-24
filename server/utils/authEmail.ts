import type { SupabaseClient } from "@supabase/supabase-js";

// =====================================================================
// Auth emails via Resend (invite / recovery).
// =====================================================================
// When RESEND_API_KEY is set, team invite + password-reset emails are
// built with Supabase admin `generateLink` (no Supabase SMTP send) and
// delivered through Resend's HTTP API.
//
// Without a verified domain, Resend only allows `onboarding@resend.dev`
// → the account owner's inbox. For inviting teammates, verify a domain
// (or subdomain) in Resend and set RESEND_FROM_EMAIL to an address there.
// =====================================================================

type GenerateLinkType = "invite" | "recovery";

export type AuthEmailResult = {
  userId: string;
  email: string;
  actionLink: string;
};

function resendConfig() {
  const config = useRuntimeConfig();
  const apiKey = String(config.resendApiKey || "").trim();
  const fromEmail =
    String(config.resendFromEmail || "").trim() || "onboarding@resend.dev";
  const fromName = String(config.resendFromName || "").trim() || "Caobo Recibos";
  return { apiKey, fromEmail, fromName };
}

/** True when the server can send through Resend. */
export function isResendConfigured(): boolean {
  return Boolean(resendConfig().apiKey);
}

/** Human-readable message from opaque Auth / Resend errors (often `{}`). */
export function formatEmailError(err: unknown, fallback: string): string {
  if (err == null) return fallback;
  if (typeof err === "string" && err.trim() && err.trim() !== "{}") {
    return err.trim();
  }
  if (typeof err === "object") {
    const e = err as Record<string, unknown>;
    for (const key of ["message", "msg", "error", "statusMessage"] as const) {
      const v = e[key];
      if (typeof v === "string" && v.trim() && v.trim() !== "{}") {
        return v.trim();
      }
    }
    try {
      const s = JSON.stringify(err);
      if (s && s !== "{}" && s !== "null") return s;
    } catch {
      /* ignore */
    }
  }
  return fallback;
}

async function sendResendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const { apiKey, fromEmail, fromName } = resendConfig();
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "RESEND_API_KEY no está configurada en el servidor.",
    });
  }

  const from =
    fromName && !fromEmail.includes("<")
      ? `${fromName} <${fromEmail}>`
      : fromEmail;

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });
  } catch (e) {
    throw createError({
      statusCode: 502,
      statusMessage: formatEmailError(
        e,
        "No se pudo contactar a Resend.",
      ),
    });
  }

  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    name?: string;
    id?: string;
  };

  if (!response.ok) {
    const detail =
      body.message ||
      body.name ||
      `Resend HTTP ${response.status}`;
    // Common onboarding limitation: only send to the account owner.
    const hint =
      /only send|testing emails|verify a domain|own email/i.test(detail)
        ? " Verifica un dominio en Resend (o un subdominio) y pon RESEND_FROM_EMAIL a una dirección de ese dominio."
        : "";
    throw createError({
      statusCode: 400,
      statusMessage: `${detail}${hint}`,
    });
  }
}

async function generateAuthLink(
  admin: SupabaseClient,
  opts: {
    type: GenerateLinkType;
    email: string;
    redirectTo: string;
    data?: Record<string, unknown>;
  },
): Promise<AuthEmailResult> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: opts.type,
    email: opts.email,
    options: {
      redirectTo: opts.redirectTo,
      data: opts.data,
    },
  });

  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: formatEmailError(
        error,
        "No se pudo generar el enlace de autenticación.",
      ),
    });
  }

  const hashedToken = data?.properties?.hashed_token;
  const userId = data?.user?.id;
  const email = data?.user?.email || opts.email;

  if (!hashedToken || !userId) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "Supabase no devolvió un enlace de autenticación válido.",
    });
  }

  // We deliberately do NOT use `data.properties.action_link`. That link
  // points at Supabase's hosted /auth/v1/verify endpoint, which — for PKCE
  // projects — redirects back with a `?code=...` param meant to be redeemed
  // via `exchangeCodeForSession()`. That call requires a `code_verifier`
  // that only ever exists in the browser that *initiated* the flow, which
  // never happens here since the link is generated server-side. It would
  // fail with "PKCE code verifier not found in storage" 100% of the time,
  // regardless of device/browser.
  //
  // `hashed_token` has no such requirement: `supabase.auth.verifyOtp({
  // token_hash, type })` redeems it directly against Supabase, with no
  // local state needed, so it works from any device/browser — exactly what
  // a link delivered by email requires. See:
  // https://github.com/supabase/supabase-js/issues/950
  const separator = opts.redirectTo.includes("?") ? "&" : "?";
  const actionLink = `${opts.redirectTo}${separator}token_hash=${encodeURIComponent(
    hashedToken,
  )}&type=${encodeURIComponent(opts.type)}`;

  return { userId, email, actionLink };
}

function inviteHtml(actionLink: string, fullName: string | null): string {
  const greeting = fullName ? `Hola ${escapeHtml(fullName)},` : "Hola,";
  return `
    <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
      <p>${greeting}</p>
      <p>Te invitaron a unirte a <strong>Caobo Recibos</strong>.</p>
      <p>
        <a href="${escapeAttr(actionLink)}"
           style="display:inline-block;background:#059669;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">
          Aceptar invitación
        </a>
      </p>
      <p style="color:#64748b;font-size:13px;">
        Si el botón no funciona, copia y pega este enlace:<br/>
        <a href="${escapeAttr(actionLink)}">${escapeHtml(actionLink)}</a>
      </p>
    </div>
  `.trim();
}

function recoveryHtml(actionLink: string): string {
  return `
    <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
      <p>Hola,</p>
      <p>Recibimos una solicitud para restablecer tu contraseña en <strong>Caobo Recibos</strong>.</p>
      <p>
        <a href="${escapeAttr(actionLink)}"
           style="display:inline-block;background:#059669;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">
          Restablecer contraseña
        </a>
      </p>
      <p style="color:#64748b;font-size:13px;">
        Si no pediste este cambio, puedes ignorar este correo.<br/>
        Enlace directo:<br/>
        <a href="${escapeAttr(actionLink)}">${escapeHtml(actionLink)}</a>
      </p>
    </div>
  `.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

/**
 * Create (or refresh) an invite and email the action link via Resend.
 * Returns the auth user id for membership provisioning.
 */
export async function sendInviteEmailWithResend(
  admin: SupabaseClient,
  opts: {
    email: string;
    fullName?: string | null;
    redirectTo: string;
  },
): Promise<AuthEmailResult> {
  const result = await generateAuthLink(admin, {
    type: "invite",
    email: opts.email,
    redirectTo: opts.redirectTo,
    data: opts.fullName ? { full_name: opts.fullName } : undefined,
  });

  await sendResendEmail({
    to: result.email,
    subject: "Invitación a Caobo Recibos",
    html: inviteHtml(result.actionLink, opts.fullName ?? null),
  });

  return result;
}

/** Email a password-recovery link via Resend (admin-initiated reset). */
export async function sendRecoveryEmailWithResend(
  admin: SupabaseClient,
  opts: { email: string; redirectTo: string },
): Promise<AuthEmailResult> {
  const result = await generateAuthLink(admin, {
    type: "recovery",
    email: opts.email,
    redirectTo: opts.redirectTo,
  });

  await sendResendEmail({
    to: result.email,
    subject: "Restablecer contraseña — Caobo Recibos",
    html: recoveryHtml(result.actionLink),
  });

  return result;
}
