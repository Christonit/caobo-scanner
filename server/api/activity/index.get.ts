import { getQuery } from "h3";

// Feed for the /activity view. Scope depends on the caller's role:
//   - admins / superadmins → all events in the active organization
//   - collaborators        → only their own events
//
// Actor identity (name + email) is resolved here via the service role since
// emails only live on auth.users. Client labels are read from the stored
// target_label so deleted clients still render.
export default defineEventHandler(async (event) => {
  const query = getQuery(event) as {
    organizationId?: string;
    action?: string;
    actorId?: string;
    limit?: string;
  };

  const admin = useSupabaseAdmin(event);
  const ctx = await resolveActivityContext(event, admin, query.organizationId);

  const canSeeAll = ctx.role === "admin" || ctx.role === "superadmin";

  const limit = Math.min(Math.max(Number(query.limit) || 200, 1), 500);

  let builder = admin
    .from("activity_events")
    .select(
      "id, action, client_id, target_label, metadata, created_at, actor_id",
    )
    .eq("organization_id", ctx.organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!canSeeAll) {
    builder = builder.eq("actor_id", ctx.userId);
  } else if (query.actorId) {
    builder = builder.eq("actor_id", query.actorId);
  }

  if (query.action && isActivityAction(query.action)) {
    builder = builder.eq("action", query.action);
  }

  const { data: rows, error } = await builder;
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  const events = rows ?? [];

  // Resolve actor identities for the distinct set of actors in this page.
  const actorIds = [
    ...new Set(events.map((e) => e.actor_id).filter(Boolean) as string[]),
  ];

  const actorMap = new Map<
    string,
    { id: string; name: string | null; email: string | null }
  >();

  if (actorIds.length) {
    const { data: profiles } = await admin
      .from("user_profiles")
      .select("id, full_name")
      .in("id", actorIds);
    for (const p of profiles ?? []) {
      actorMap.set(p.id, { id: p.id, name: p.full_name, email: null });
    }
    await Promise.all(
      actorIds.map(async (id) => {
        const { data: authUser } = await admin.auth.admin.getUserById(id);
        const existing = actorMap.get(id) ?? { id, name: null, email: null };
        existing.email = authUser?.user?.email ?? null;
        if (!existing.name) {
          const meta = authUser?.user?.user_metadata as
            | { full_name?: string }
            | undefined;
          existing.name = meta?.full_name ?? null;
        }
        actorMap.set(id, existing);
      }),
    );
  }

  return {
    canSeeAll,
    role: ctx.role,
    events: events.map((e) => ({
      id: e.id,
      action: e.action,
      clientId: e.client_id,
      targetLabel: e.target_label,
      metadata: e.metadata ?? {},
      createdAt: e.created_at,
      actor: e.actor_id
        ? (actorMap.get(e.actor_id) ?? {
            id: e.actor_id,
            name: null,
            email: null,
          })
        : null,
    })),
  };
});
