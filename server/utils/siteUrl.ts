import type { H3Event } from "h3";
import { getRequestURL } from "h3";

/**
 * Public origin used in Auth email links (invite, reset password).
 *
 * Prefer NUXT_PUBLIC_SITE_URL in production — behind Railway/Docker,
 * getRequestURL() often sees only the internal listen address (localhost)
 * unless x-forwarded-* is trusted, and spoofable Host headers are a poor
 * source of truth for links emailed to teammates.
 */
export function getSiteUrl(event: H3Event): string {
  const configured = (
    useRuntimeConfig(event).public.siteUrl as string | undefined
  )?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return getRequestURL(event, {
    xForwardedHost: true,
    xForwardedProto: true,
  }).origin;
}
