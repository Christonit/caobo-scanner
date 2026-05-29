import type { Database } from "~/types/database.types";

export type OrgRole = "admin" | "member";

export interface CurrentMembership {
  organization_id: string;
  role: OrgRole;
  full_name: string | null;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
}

export const useOrganization = () => {
  const supabase = useSupabaseClient<Database>();
  const user = useSupabaseUser();

  const membership = useState<CurrentMembership | null>(
    "organization-membership",
    () => null
  );

  const activeOrg = computed(() => membership.value?.organization ?? null);
  const role = computed<OrgRole | null>(() => membership.value?.role ?? null);
  const isAdmin = computed(() => role.value === "admin");

  async function refresh() {
    if (!user.value) {
      membership.value = null;
      return;
    }
    const { data, error } = await supabase
      .from("user_profiles")
      .select(
        "organization_id, role, full_name, organization:organization_id ( id, name, slug )"
      )
      .eq("id", user.value.id)
      .maybeSingle();

    if (error) {
      console.error("[useOrganization] failed to load membership", error);
      membership.value = null;
      return;
    }
    membership.value = (data as unknown as CurrentMembership) ?? null;
  }

  return { membership, activeOrg, role, isAdmin, refresh };
};
