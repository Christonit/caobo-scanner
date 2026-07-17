import type { H3Event } from "h3";
import { serverSupabaseUser } from "#supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/types/database.types";

export interface TeamCaller {
  userId: string;
  organizationId: string;
  actingAsSuperAdmin: boolean;
}

// Resolves which organization the caller is allowed to manage team members
// for, and confirms they hold admin-level access:
//   - Regular admins: their own org (from user_profiles), body-supplied
//     organizationId is ignored so an admin can never target another org.
//   - Superadmins: must supply organizationId (the org they've selected in
//     the switcher) since they have no user_profiles row of their own.
export async function authorizeTeamCaller(
  event: H3Event,
  admin: SupabaseClient<Database>,
  requestedOrganizationId?: string | null
): Promise<TeamCaller> {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "No autenticado." });
  }

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    throw createError({ statusCode: 500, statusMessage: profileError.message });
  }

  if (profile) {
    if (profile.role !== "admin") {
      throw createError({
        statusCode: 403,
        statusMessage: "Solo un administrador puede gestionar el equipo.",
      });
    }
    return {
      userId: user.id,
      organizationId: profile.organization_id,
      actingAsSuperAdmin: false,
    };
  }

  const { data: superadminRow, error: superadminError } = await admin
    .from("superadmins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (superadminError) {
    throw createError({ statusCode: 500, statusMessage: superadminError.message });
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
    throw createError({ statusCode: 404, statusMessage: "Organización no encontrada." });
  }

  return {
    userId: user.id,
    organizationId: org.id,
    actingAsSuperAdmin: true,
  };
}
