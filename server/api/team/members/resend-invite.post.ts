import { readBody } from "h3";

// Re-sends the Supabase invite email for a pending (unconfirmed) member.
// GoTrue's admin invite endpoint regenerates the token and emails again when
// the user already exists but has not confirmed yet.
export default defineEventHandler(async (event) => {
  const body = await readBody<{
    userId?: string;
    organizationId?: string;
  }>(event);

  const userId = body?.userId?.trim();
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "Falta el miembro." });
  }

  const admin = useSupabaseAdmin(event);
  const caller = await authorizeTeamCaller(event, admin, body?.organizationId);

  const { data: targetProfile, error: profileError } = await admin
    .from("user_profiles")
    .select("id, organization_id, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw createError({ statusCode: 500, statusMessage: profileError.message });
  }
  if (!targetProfile || targetProfile.organization_id !== caller.organizationId) {
    throw createError({ statusCode: 404, statusMessage: "Miembro no encontrado." });
  }

  const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(
    userId
  );
  if (authUserError || !authUser?.user?.email) {
    throw createError({
      statusCode: 404,
      statusMessage: "No se encontró el correo de ese miembro.",
    });
  }

  if (authUser.user.email_confirmed_at) {
    throw createError({
      statusCode: 400,
      statusMessage: "Este miembro ya activó su cuenta.",
    });
  }

  const siteUrl = getSiteUrl(event);
  const fullName =
    targetProfile.full_name ||
    (authUser.user.user_metadata?.full_name as string | undefined) ||
    null;

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    authUser.user.email,
    {
      data: fullName ? { full_name: fullName } : undefined,
      redirectTo: `${siteUrl}/auth/callback`,
    }
  );

  if (inviteError) {
    throw createError({
      statusCode: 400,
      statusMessage: inviteError.message || "No se pudo reenviar la invitación.",
    });
  }

  return { ok: true, email: authUser.user.email };
});
