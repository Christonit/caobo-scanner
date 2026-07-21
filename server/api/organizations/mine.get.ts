import { serverSupabaseUser } from "#supabase/server";

// Returns the caller's organization memberships with org names.
// Uses the service role for the join so non-active orgs are visible even when
// organizations RLS only exposes current_user_org().
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  const userId = (user as { sub?: string; id?: string } | null)?.sub ?? user?.id;
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "No autenticado" });
  }

  const admin = useSupabaseAdmin(event);

  const { data: rows, error } = await admin
    .from("organization_members")
    .select(
      "organization_id, role, organization:organization_id ( id, name, slug )"
    )
    .eq("user_id", userId);

  if (error) {
    // Table missing (migration not applied) — empty list; client falls back.
    if (error.code === "PGRST205" || error.code === "42P01") {
      return { memberships: [] };
    }
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  const memberships = (rows ?? [])
    .map((row: any) => ({
      organization_id: row.organization_id as string,
      role: row.role as "admin" | "collaborator",
      organization: row.organization as {
        id: string;
        name: string;
        slug: string;
      } | null,
    }))
    .filter((m) => m.organization?.id);

  return { memberships };
});
