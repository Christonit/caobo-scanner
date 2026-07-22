// Invite / magic-link / recovery tokens all share Supabase Auth's
// "Email OTP expiration" setting (default 3600s / 1 hour). Keep this in
// sync with Authentication → Providers → Email → Email OTP expiration
// (hosted) or [auth.email] otp_expiry in supabase/config.toml (local).
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
