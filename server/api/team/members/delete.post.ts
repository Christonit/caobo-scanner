import { readBody } from "h3";

// Permanently deletes a disabled member's Auth user (+ their profile /
// membership rows), so an admin can start a fresh invite for that email
// instead of being stuck with a stale/expired invite token forever.
//
// Guardrails:
// - Caller must be an org admin (or superadmin) — same as every other
//   /api/team/members/* route (see server/utils/teamAuthorization.ts).
// - The target must already be disabled (banned). This is intentionally a
//   two-step "disable, then delete" flow so nobody is deleted by accident.
// - Admins can't delete themselves.
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

  if (userId === caller.userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "No puedes eliminar tu propia cuenta.",
    });
  }

  const { data: targetProfile, error: profileError } = await admin
    .from("user_profiles")
    .select("id, organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw createError({ statusCode: 500, statusMessage: profileError.message });
  }
  if (!targetProfile || targetProfile.organization_id !== caller.organizationId) {
    throw createError({ statusCode: 404, statusMessage: "Miembro no encontrado." });
  }

  const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(
    userId,
  );
  if (authUserError || !authUser?.user) {
    throw createError({
      statusCode: 404,
      statusMessage: "No se encontró la cuenta de ese miembro.",
    });
  }

  const isDisabled = Boolean(authUser.user.banned_until);
  if (!isDisabled) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Deshabilita al miembro antes de eliminarlo (evita borrados accidentales).",
    });
  }

  // Someone who belongs to other orgs too shouldn't have their whole Auth
  // account nuked just because this one org is done with them — only drop
  // this org's membership/profile. This mainly matters for multi-org users;
  // the common "delete to re-invite" case is a pending user with exactly
  // one membership, which falls through to the full delete below.
  const { data: otherMemberships, error: otherMembershipsError } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .neq("organization_id", caller.organizationId);
  if (
    otherMembershipsError &&
    otherMembershipsError.code !== "PGRST205" &&
    otherMembershipsError.code !== "42P01" &&
    !/does not exist|Could not find the table/i.test(
      otherMembershipsError.message || "",
    )
  ) {
    throw createError({
      statusCode: 500,
      statusMessage: otherMembershipsError.message,
    });
  }
  const belongsToOtherOrgs = (otherMemberships?.length ?? 0) > 0;

  // Clean up our own tables first — deleting the auth user cascades via FK
  // in some schemas, but we don't rely on that here.
  const { error: memberError } = await admin
    .from("organization_members")
    .delete()
    .eq("user_id", userId)
    .eq("organization_id", caller.organizationId);
  if (
    memberError &&
    memberError.code !== "PGRST205" &&
    memberError.code !== "42P01" &&
    !/does not exist|Could not find the table/i.test(memberError.message || "")
  ) {
    throw createError({ statusCode: 500, statusMessage: memberError.message });
  }

  if (belongsToOtherOrgs) {
    // Only remove this org's profile row if it isn't their active one, or
    // hand the active profile to another membership — simplest safe option
    // is to just delete the profile row scoped to this org and leave the
    // Auth account (and any other org's access) intact.
    const { error: profileDeleteError } = await admin
      .from("user_profiles")
      .delete()
      .eq("id", userId)
      .eq("organization_id", caller.organizationId);
    if (profileDeleteError) {
      throw createError({
        statusCode: 500,
        statusMessage: profileDeleteError.message,
      });
    }
    return { ok: true, userId, deletedAccount: false };
  }

  const { error: profileDeleteError } = await admin
    .from("user_profiles")
    .delete()
    .eq("id", userId)
    .eq("organization_id", caller.organizationId);
  if (profileDeleteError) {
    throw createError({
      statusCode: 500,
      statusMessage: profileDeleteError.message,
    });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    throw createError({ statusCode: 500, statusMessage: deleteError.message });
  }

  return { ok: true, userId, deletedAccount: true };
});
