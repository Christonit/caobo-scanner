import { getRequestURL, readBody } from "h3";

// Invites a new user by email into the caller's organization (or, for a
// superadmin, whichever organization they've selected). The invited user
// gets a Supabase invite email with a link to set their own password;
// their user_profiles row (org + role) is created immediately so they land
// on the right organization the moment they accept.
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

  const siteUrl = getRequestURL(event).origin;

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    {
      data: fullName ? { full_name: fullName } : undefined,
      redirectTo: `${siteUrl}/auth/callback`,
    }
  );

  if (inviteError || !invited?.user) {
    const message = inviteError?.message?.includes("already been registered")
      ? "Ese correo ya tiene una cuenta."
      : inviteError?.message || "No se pudo enviar la invitación.";
    throw createError({ statusCode: 400, statusMessage: message });
  }

  const { error: profileError } = await admin.from("user_profiles").upsert(
    {
      id: invited.user.id,
      organization_id: caller.organizationId,
      role,
      full_name: fullName,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    throw createError({ statusCode: 500, statusMessage: profileError.message });
  }

  return {
    ok: true,
    userId: invited.user.id,
    email,
    role,
  };
});
