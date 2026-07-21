import type { Database } from "~/types/database.types";

export type OrgRole = "admin" | "collaborator" | "superadmin";

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
}

export interface OrgMembership {
  organization_id: string;
  role: "admin" | "collaborator";
  organization: OrgSummary;
}

export interface CurrentMembership extends OrgMembership {
  full_name: string | null;
}

// Cookie for the organization the user is currently viewing.
// - Superadmins: required (they have no user_profiles row).
// - Multi-org members: mirrors the active org; switching also updates
//   user_profiles via switch_organization() so RLS stays correct.
const ACTIVE_ORG_COOKIE = "caobo_active_org";

export const useOrganization = () => {
  const supabase = useSupabaseClient<Database>();
  const user = useSupabaseUser();

  const membership = useState<CurrentMembership | null>(
    "organization-membership",
    () => null
  );
  const memberships = useState<OrgMembership[]>(
    "organization-memberships",
    () => []
  );
  const isSuperAdmin = useState<boolean>("organization-is-superadmin", () => false);
  const allOrgs = useState<OrgSummary[]>("organization-all-orgs", () => []);
  const activeOrgId = useCookie<string | null>(ACTIVE_ORG_COOKIE, {
    default: () => null,
    sameSite: "lax",
  });

  // Orgs the current user can switch between (memberships, or every org for
  // superadmins).
  const switchableOrgs = computed<OrgSummary[]>(() => {
    if (isSuperAdmin.value) return allOrgs.value;
    return memberships.value.map((m) => m.organization);
  });

  const canSwitchOrgs = computed(
    () => isSuperAdmin.value || memberships.value.length > 1
  );

  const activeOrg = computed<OrgSummary | null>(() => {
    if (isSuperAdmin.value) {
      const fromCookie = allOrgs.value.find((o) => o.id === activeOrgId.value);
      return fromCookie ?? allOrgs.value[0] ?? null;
    }
    if (memberships.value.length > 1 && activeOrgId.value) {
      const fromList = memberships.value.find(
        (m) => m.organization_id === activeOrgId.value
      );
      if (fromList) return fromList.organization;
    }
    return membership.value?.organization ?? null;
  });

  const role = computed<OrgRole | null>(() => {
    if (isSuperAdmin.value) return "superadmin";
    if (memberships.value.length && activeOrg.value) {
      const m = memberships.value.find(
        (x) => x.organization_id === activeOrg.value!.id
      );
      if (m) return m.role;
    }
    return membership.value?.role ?? null;
  });

  const isAdmin = computed(() => role.value === "admin" || isSuperAdmin.value);

  async function loadAllOrgs() {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .is("deleted_at", null)
      .order("name", { ascending: true });
    if (error) {
      console.error("[useOrganization] failed to load organizations", error);
      allOrgs.value = [];
      return;
    }
    allOrgs.value = (data ?? []) as OrgSummary[];
    if (!activeOrgId.value && allOrgs.value[0]) {
      activeOrgId.value = allOrgs.value[0].id;
    }
  }

  async function loadMemberships(_userId: string): Promise<OrgMembership[]> {
    // Load via a server route that joins with the service role. Direct
    // client queries only see the *active* org name under current RLS, which
    // made non-active memberships show up as a generic "Organización" label.
    try {
      const res = await $fetch<{ memberships: OrgMembership[] }>(
        "/api/organizations/mine"
      );
      return res.memberships ?? [];
    } catch (err) {
      console.error("[useOrganization] failed to load memberships", err);
      return [];
    }
  }

  async function setActiveOrg(orgId: string) {
    if (isSuperAdmin.value) {
      activeOrgId.value = orgId;
      return;
    }

    const target = memberships.value.find((m) => m.organization_id === orgId);
    if (!target) return;
    if (membership.value?.organization_id === orgId) {
      activeOrgId.value = orgId;
      return;
    }

    // Point user_profiles at the chosen membership so RLS follows.
    const { error } = await supabase.rpc("switch_organization", {
      p_organization_id: orgId,
    });
    if (error) {
      console.error("[useOrganization] switch_organization failed", error);
      throw error;
    }

    activeOrgId.value = orgId;
    if (membership.value) {
      membership.value = {
        ...membership.value,
        organization_id: orgId,
        role: target.role,
        organization: target.organization,
      };
    }
  }

  async function refresh() {
    // @nuxtjs/supabase v2: useSupabaseUser() is JWT claims; user id is `sub`.
    const userId = user.value?.sub;
    if (!userId) {
      membership.value = null;
      memberships.value = [];
      isSuperAdmin.value = false;
      allOrgs.value = [];
      return;
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select(
        "organization_id, role, full_name, organization:organization_id ( id, name, slug )"
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("[useOrganization] failed to load membership", error);
      membership.value = null;
    } else {
      membership.value = (data as unknown as CurrentMembership) ?? null;
    }

    if (membership.value) {
      isSuperAdmin.value = false;
      allOrgs.value = [];

      const loaded = await loadMemberships(userId);
      if (loaded.length) {
        memberships.value = loaded;
      } else if (membership.value.organization) {
        // Pre-migration fallback: single membership from the profile.
        memberships.value = [
          {
            organization_id: membership.value.organization_id,
            role: membership.value.role,
            organization: membership.value.organization,
          },
        ];
      } else {
        memberships.value = [];
      }

      // Prefer cookie if it still points at a membership; otherwise the profile.
      const cookieOk =
        activeOrgId.value &&
        memberships.value.some((m) => m.organization_id === activeOrgId.value);
      if (!cookieOk) {
        activeOrgId.value = membership.value.organization_id;
      }
      return;
    }

    memberships.value = [];

    // No org membership — check whether this user is a superadmin.
    const { data: superadminRow, error: superadminError } = await supabase
      .from("superadmins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (superadminError) {
      console.error("[useOrganization] failed to check superadmin", superadminError);
      isSuperAdmin.value = false;
      return;
    }

    isSuperAdmin.value = Boolean(superadminRow);
    if (isSuperAdmin.value) {
      await loadAllOrgs();
    }
  }

  return {
    membership,
    memberships,
    activeOrg,
    role,
    isAdmin,
    isSuperAdmin,
    allOrgs,
    switchableOrgs,
    canSwitchOrgs,
    activeOrgId,
    setActiveOrg,
    refresh,
  };
};
