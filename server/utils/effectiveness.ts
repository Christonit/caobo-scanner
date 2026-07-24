import type { H3Event } from "h3";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  EffectivenessCsat,
  EffectivenessSessionStatus,
} from "~/types/database.types";

// Feature gate for the effectiveness telemetry endpoints. Mirrors the client
// `useFeatureFlags().effectiveness` flag (runtimeConfig.public.features),
// overridable per environment with NUXT_PUBLIC_FEATURES_EFFECTIVENESS=true.
// Env overrides arrive as strings, so accept both boolean and "true"/"false".
export function isEffectivenessEnabled(event: H3Event): boolean {
  const config = useRuntimeConfig(event);
  const features = (config.public as { features?: Record<string, unknown> })
    .features;
  const value = features?.effectiveness;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return false;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export const EFFECTIVENESS_STATUSES: readonly EffectivenessSessionStatus[] = [
  "in_progress",
  "exported",
  "discarded",
  "abandoned",
];

export function isSessionStatus(v: unknown): v is EffectivenessSessionStatus {
  return (
    typeof v === "string" &&
    (EFFECTIVENESS_STATUSES as readonly string[]).includes(v)
  );
}

export function isCsat(v: unknown): v is EffectivenessCsat {
  return v === "good" || v === "bad";
}

export function toInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// Best-effort auth email lookup for per-employee rollups. Never throws — a
// missing email just leaves the column null.
export async function lookupUserEmail(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

// Only accept a client_id that actually belongs to the caller's org, so a
// spoofed body can never attribute a session to another org's client.
export async function resolveOwnedClientId(
  admin: SupabaseClient<Database>,
  organizationId: string,
  clientId: unknown,
): Promise<string | null> {
  if (!isUuid(clientId)) return null;
  const { data } = await admin
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data?.id ?? null;
}
