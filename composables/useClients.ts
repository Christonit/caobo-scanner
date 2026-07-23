import type { Database } from "~/types/database.types";

export type Client = Database["public"]["Tables"]["clients"]["Row"];

export interface ClientInput {
  name: string;
  taxPayerId: string;
}

/** ERP catalogs used when extracting receipts for this client. */
export interface ClientExtractionDocuments {
  conceptoDocumentId: string | null;
  tipoDePagoDocumentId: string | null;
  tipoDeGastoContextDocumentId: string | null;
}

export const useClients = () => {
  const supabase = useSupabaseClient<Database>();
  const user = useSupabaseUser();
  const { activeOrg, refresh } = useOrganization();
  const { log } = useActivityLog();

  async function ensureOrgId(): Promise<string> {
    if (!activeOrg.value?.id) await refresh();
    const orgId = activeOrg.value?.id;
    if (!orgId) {
      throw new Error("No hay una organización activa.");
    }
    return orgId;
  }

  async function list(): Promise<Client[]> {
    // Explicit org filter (not just RLS) so a superadmin acting on one
    // organization doesn't see every organization's clients at once.
    const organizationId = await ensureOrgId();
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("organization_id", organizationId)
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

    log("client_created", {
      clientId: data.id,
      targetLabel: data.name,
      metadata: { tax_payer_id: data.tax_payer_id },
    });

    return data as Client;
  }

  /**
   * Persist which client_documents feed Concepto / Tipo de Pago / Tipo de
   * Gasto context during extraction. Empty string → null (clear).
   * Each id must belong to this client when set.
   */
  async function updateExtractionDocuments(
    clientId: string,
    prefs: ClientExtractionDocuments,
  ): Promise<Client> {
    const ids = [
      prefs.conceptoDocumentId,
      prefs.tipoDePagoDocumentId,
      prefs.tipoDeGastoContextDocumentId,
    ].filter((id): id is string => Boolean(id));

    if (ids.length) {
      const { data: docs, error: docsError } = await supabase
        .from("client_documents")
        .select("id, client_id")
        .in("id", ids);
      if (docsError) throw docsError;
      const owned = new Set(
        (docs ?? [])
          .filter((d) => d.client_id === clientId)
          .map((d) => d.id),
      );
      for (const id of ids) {
        if (!owned.has(id)) {
          throw new Error(
            "Uno de los documentos seleccionados no pertenece a este cliente.",
          );
        }
      }
    }

    const { data, error } = await supabase
      .from("clients")
      .update({
        concepto_document_id: prefs.conceptoDocumentId || null,
        tipo_de_pago_document_id: prefs.tipoDePagoDocumentId || null,
        tipo_de_gasto_context_document_id:
          prefs.tipoDeGastoContextDocumentId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId)
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

  return { list, get, create, updateExtractionDocuments, remove };
};
