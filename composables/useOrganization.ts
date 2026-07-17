import type { Database } from "~/types/database.types";

export type OrgRole = "admin" | "collaborator" | "superadmin";

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
}

export interface CurrentMembership {
  organization_id: string;
  role: "admin" | "collaborator";
  full_name: string | null;
  organization: OrgSummary;
}

// Cookie name for the organization a superadmin is currently "acting on".
// Superadmins have no `user_profiles` row (they aren't scoped to a single
// org), so the active org is a client-side choice persisted here instead.
const ACTIVE_ORG_COOKIE = "caobo_active_org";

export const useOrganization = () => {
  const supabase = useSupabaseClient<Database>();
  const user = useSupabaseUser();

  const membership = useState<CurrentMembership | null>(
    "organization-membership",
    () => null
  );
  const isSuperAdmin = useState<boolean>("organization-is-superadmin", () => false);
  const allOrgs = useState<OrgSummary[]>("organization-all-orgs", () => []);
  const activeOrgId = useCookie<string | null>(ACTIVE_ORG_COOKIE, {
    default: () => null,
    sameSite: "lax",
  });

  const activeOrg = computed<OrgSummary | null>(() => {
    if (isSuperAdmin.value) {
      const fromCookie = allOrgs.value.find((o) => o.id === activeOrgId.value);
      return fromCookie ?? allOrgs.value[0] ?? null;
    }
    return membership.value?.organization ?? null;
  });

  const role = computed<OrgRole | null>(() => {
    if (isSuperAdmin.value) return "superadmin";
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

  function setActiveOrg(orgId: string) {
    activeOrgId.value = orgId;
  }

  async function refresh() {
    // @nuxtjs/supabase v2: useSupabaseUser() is JWT claims; user id is `sub`.
    const userId = user.value?.sub;
    if (!userId) {
      membership.value = null;
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
      return;
    }

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
    activeOrg,
    role,
    isAdmin,
    isSuperAdmin,
    allOrgs,
    activeOrgId,
    setActiveOrg,
    refresh,
  };
};
