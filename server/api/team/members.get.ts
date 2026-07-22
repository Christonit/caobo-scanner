import { getQuery } from "h3";

// Lists the members of an organization together with their email (which
// only lives on auth.users, not user_profiles) so the Equipo page can show
// who's who without a separate client-side admin API call.
export default defineEventHandler(async (event) => {
  const query = getQuery(event) as { organizationId?: string };

  const admin = useSupabaseAdmin(event);
  const caller = await authorizeTeamCaller(event, admin, query.organizationId);

  const { data: profiles, error } = await admin
    .from("user_profiles")
    .select("id, role, full_name, created_at")
    .eq("organization_id", caller.organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  const nowMs = Date.now();
  const members = await Promise.all(
    (profiles ?? []).map(async (profile) => {
      const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
      const user = authUser?.user;
      // Supabase sets email_confirmed_at when the user clicks the invite
      // link (or confirms their email). Null means the invite is still pending.
      const activated = Boolean(user?.email_confirmed_at);
      const inviteSentAt =
        user?.confirmation_sent_at ?? user?.invited_at ?? null;
      return {
        id: profile.id,
        role: profile.role,
        fullName: profile.full_name,
        createdAt: profile.created_at,
        email: user?.email ?? null,
        activated,
        inviteSentAt,
        // Only meaningful while the invite is still pending.
        inviteExpired: !activated && isInviteExpired(inviteSentAt, nowMs),
        // Supabase clears `banned_until` back to null when a user is
        // unbanned (ban_duration: "none"), so its mere presence means
        // the member is currently disabled.
        disabled: Boolean(user?.banned_until),
      };
    })
  );

  return { members };
});
