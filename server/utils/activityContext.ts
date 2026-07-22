import type { H3Event } from "h3";
import { serverSupabaseUser } from "#supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/types/database.types";

export type ActivityRole = "admin" | "collaborator" | "superadmin";

export interface ActivityContext {
  userId: string;
  organizationId: string;
  role: ActivityRole;
}

// Resolves who the caller is and which organization the activity belongs to.
//
// Unlike authorizeTeamCaller (which requires admin), this allows any signed-in
// member — collaborators must be able to log (and read) their own activity.
//   - Members: org + role come from user_profiles; a body/query-supplied
//     organizationId is ignored so a user can never target another org.
//   - Superadmins: have no user_profiles row, so they must supply the org
//     they're acting on (the switcher's active org).
export async function resolveActivityContext(
  event: H3Event,
  admin: SupabaseClient<Database>,
  requestedOrganizationId?: string | null,
): Promise<ActivityContext> {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "No autenticado." });
  }

  // @nuxtjs/supabase v2 returns JWT claims; the user UUID lives in `sub`.
  const userId = (user as { sub?: string; id?: string }).sub ?? user.id;
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "No autenticado." });
  }

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("organization_id, role")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) {
    throw createError({ statusCode: 500, statusMessage: profileError.message });
  }

  if (profile) {
    return {
      userId,
      organizationId: profile.organization_id,
      role: profile.role as "admin" | "collaborator",
    };
  }

  const { data: superadminRow, error: superadminError } = await admin
    .from("superadmins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (superadminError) {
    throw createError({
      statusCode: 500,
      statusMessage: superadminError.message,
    });
  }
  if (!superadminRow) {
    throw createError({ statusCode: 403, statusMessage: "No autorizado." });
  }

  if (!requestedOrganizationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Selecciona una organización primero.",
    });
  }

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id")
    .eq("id", requestedOrganizationId)
    .maybeSingle();
  if (orgError) {
    throw createError({ statusCode: 500, statusMessage: orgError.message });
  }
  if (!org) {
    throw createError({
      statusCode: 404,
      statusMessage: "Organización no encontrada.",
    });
  }

  return { userId, organizationId: org.id, role: "superadmin" };
}

export const ACTIVITY_ACTIONS = [
  "client_created",
  "client_updated",
  "document_added",
  "document_updated",
  "document_removed",
  "annotation_added",
  "annotation_updated",
  "annotation_removed",
  "suplidor_added",
  "suplidor_updated",
  "suplidor_removed",
  "gastos_analyzed",
  "gastos_exported",
  "suplidores_analyzed",
  "suplidores_stored",
  "suplidores_exported",
  "rows_deferred",
  "export_rated",
] as const;

export type ActivityActionValue = (typeof ACTIVITY_ACTIONS)[number];

export function isActivityAction(v: unknown): v is ActivityActionValue {
  return typeof v === "string" && (ACTIVITY_ACTIONS as readonly string[]).includes(v);
}
