import { readBody } from "h3";

// Invites a user by email into the caller's organization (or, for a
// superadmin, whichever organization they've selected).
//
// - New email: Supabase invite + user_profiles + organization_members.
// - Existing user: add an organization_members row so they can switch into
//   this org without replacing their current active membership.
export default defineEventHandler(async (event) => {
  const body = await readBody<{
    email?: string;
    fullName?: string;
    role?: "admin" | "collaborator";
    organizationId?: string;
  }>(event);

  const email = body?.email?.trim().toLowerCase();
  const fullName = body?.fullName?.trim() || null;
  const role = body?.role === "admin" ? "admin" : "collaborator";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: "Correo inválido." });
  }

  const admin = useSupabaseAdmin(event);
  const caller = await authorizeTeamCaller(event, admin, body?.organizationId);
  const siteUrl = getSiteUrl(event);

  // Look up an existing auth user first so we can add multi-org memberships
  // without sending a duplicate invite.
  const existing = await findAuthUserByEmail(admin, email);

  if (existing) {
    await ensureMember(admin, {
      userId: existing.id,
      organizationId: caller.organizationId,
      role,
      fullName,
      // Existing users keep their current active org; we only add a membership.
      setActiveProfile: false,
    });
    return {
      ok: true,
      userId: existing.id,
      email,
      role,
      existing: true,
    };
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    {
      data: fullName ? { full_name: fullName } : undefined,
      redirectTo: `${siteUrl}/auth/callback`,
    }
  );

  if (inviteError || !invited?.user) {
    throw createError({
      statusCode: 400,
      statusMessage: inviteError?.message || "No se pudo enviar la invitación.",
    });
  }

  await ensureMember(admin, {
    userId: invited.user.id,
    organizationId: caller.organizationId,
    role,
    fullName,
    setActiveProfile: true,
  });

  return {
    ok: true,
    userId: invited.user.id,
    email,
    role,
    existing: false,
  };
});

async function findAuthUserByEmail(
  admin: ReturnType<typeof useSupabaseAdmin>,
  email: string
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
      (u) => (u.email ?? "").toLowerCase() === email
    );
    if (found) return found;
    if (data.users.length < 200) break;
  }
  return null;
}

async function ensureMember(
  admin: ReturnType<typeof useSupabaseAdmin>,
  opts: {
    userId: string;
    organizationId: string;
    role: "admin" | "collaborator";
    fullName: string | null;
    setActiveProfile: boolean;
  }
) {
  if (opts.setActiveProfile) {
    const { error: profileError } = await admin.from("user_profiles").upsert(
      {
        id: opts.userId,
        organization_id: opts.organizationId,
        role: opts.role,
        full_name: opts.fullName,
      },
      { onConflict: "id" }
    );
    if (profileError) {
      throw createError({
        statusCode: 500,
        statusMessage: profileError.message,
      });
    }
  } else {
    // Existing user: create a profile only if they somehow lack one
    // (e.g. invited as superadmin later). Otherwise leave active org alone.
    const { data: profile } = await admin
      .from("user_profiles")
      .select("id")
      .eq("id", opts.userId)
      .maybeSingle();
    if (!profile) {
      const { error: profileError } = await admin.from("user_profiles").insert({
        id: opts.userId,
        organization_id: opts.organizationId,
        role: opts.role,
        full_name: opts.fullName,
      });
      if (profileError) {
        throw createError({
          statusCode: 500,
          statusMessage: profileError.message,
        });
      }
    }
  }

  const { error: memberError } = await admin
    .from("organization_members")
    .upsert(
      {
        user_id: opts.userId,
        organization_id: opts.organizationId,
        role: opts.role,
      },
      { onConflict: "user_id,organization_id" }
    );

  if (
    memberError &&
    memberError.code !== "PGRST205" &&
    memberError.code !== "42P01" &&
    !/does not exist|Could not find the table/i.test(memberError.message || "")
  ) {
    throw createError({ statusCode: 500, statusMessage: memberError.message });
  }
}
