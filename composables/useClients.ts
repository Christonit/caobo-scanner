import type { Database } from "~/types/database.types";

export type Client = Database["public"]["Tables"]["clients"]["Row"];

export interface ClientInput {
  name: string;
  taxPayerId: string;
}

export const useClients = () => {
  const supabase = useSupabaseClient<Database>();
  const user = useSupabaseUser();
  const { activeOrg, refresh } = useOrganization();

  async function ensureOrgId(): Promise<string> {
    if (!activeOrg.value?.id) await refresh();
    const orgId = activeOrg.value?.id;
    if (!orgId) {
      throw new Error("No hay una organización activa.");
    }
    return orgId;
  }

  async function list(): Promise<Client[]> {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Client[];
  }

  async function get(id: string): Promise<Client | null> {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return (data as Client) ?? null;
  }

  async function create(input: ClientInput): Promise<Client> {
    const organizationId = await ensureOrgId();
    const name = input.name.trim();
    const taxPayerId = input.taxPayerId.trim();
    if (!name) throw new Error("El nombre es obligatorio.");
    if (!taxPayerId) throw new Error("El RNC es obligatorio.");

    const { data, error } = await supabase
      .from("clients")
      .insert({
        organization_id: organizationId,
        name,
        tax_payer_id: taxPayerId,
        created_by: user.value?.sub ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as Client;
  }

  async function remove(id: string): Promise<void> {
    const { error } = await supabase
      .from("clients")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  return { list, get, create, remove };
};
