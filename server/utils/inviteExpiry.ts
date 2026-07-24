// Invite / magic-link / recovery tokens all share Supabase Auth's
// "Email OTP expiration" setting (default 3600s / 1 hour).
//
// Keep this in sync with:
//   - Hosted: Authentication → Sign In / Providers → Email → Email OTP expiration
//   - Local:  [auth.email] otp_expiry in supabase/config.toml
//
// Note: this is only the *clock* used by the Equipo UI badge. A link can
// still die earlier if (a) a new invite/reset is generated for the same
// user (previous token is invalidated), or (b) the one-time token was
// already consumed (including by an email security scanner prefetch).
export function getInviteExpirySeconds(): number {
  const raw = process.env.SUPABASE_INVITE_EXPIRY_SECONDS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3600;
}

export function isInviteExpired(
  sentAt: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!sentAt) return true;
  const sentMs = Date.parse(sentAt);
  if (Number.isNaN(sentMs)) return true;
  return nowMs - sentMs > getInviteExpirySeconds() * 1000;
}
