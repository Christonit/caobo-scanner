import type { Database } from "~/types/database.types";

export type ClientDocument =
  Database["public"]["Tables"]["client_documents"]["Row"];
export type DocumentAttribute =
  Database["public"]["Tables"]["document_attributes"]["Row"];

export type ClientDocumentWithAttributes = ClientDocument & {
  document_attributes: DocumentAttribute[];
};

export interface DocumentAttributeInput {
  documentType: string;
  documentId: number | null;
  description: string;
}

export interface ClientDocumentInput {
  documentName: string;
  attributes: DocumentAttributeInput[];
}

export const useClientDocuments = () => {
  const supabase = useSupabaseClient<Database>();

  async function listByClient(
    clientId: string
  ): Promise<ClientDocumentWithAttributes[]> {
    const { data, error } = await supabase
      .from("client_documents")
      .select("*, document_attributes(*)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return ((data ?? []) as ClientDocumentWithAttributes[]).map((doc) => ({
      ...doc,
      document_attributes: [...(doc.document_attributes ?? [])].sort(
        (a, b) => a.id - b.id
      ),
    }));
  }

  async function get(
    id: string
  ): Promise<ClientDocumentWithAttributes | null> {
    const { data, error } = await supabase
      .from("client_documents")
      .select("*, document_attributes(*)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const doc = data as ClientDocumentWithAttributes;
    return {
      ...doc,
      document_attributes: [...(doc.document_attributes ?? [])].sort(
        (a, b) => a.id - b.id
      ),
    };
  }

  async function create(
    clientId: string,
    input: ClientDocumentInput
  ): Promise<ClientDocumentWithAttributes> {
    const documentName = input.documentName.trim();
    if (!documentName) {
      throw new Error("El nombre del documento es obligatorio.");
    }

    const attributes = normalizeAttributes(input.attributes);
    if (attributes.length === 0) {
      throw new Error("Agrega al menos un atributo (concepto / tipo de pago).");
    }

    const { data: doc, error: docErr } = await supabase
      .from("client_documents")
      .insert({
        client_id: clientId,
        document_name: documentName,
      })
      .select("*")
      .single();
    if (docErr) throw docErr;

    const { data: attrs, error: attrErr } = await supabase
      .from("document_attributes")
      .insert(
        attributes.map((a) => ({
          client_document_id: doc.id,
          document_type: a.documentType,
          document_id: a.documentId,
          description: a.description,
        }))
      )
      .select("*");

    if (attrErr) {
      // Roll back the parent container if attributes fail.
      await supabase.from("client_documents").delete().eq("id", doc.id);
      throw attrErr;
    }

    return {
      ...(doc as ClientDocument),
      document_attributes: (attrs ?? []) as DocumentAttribute[],
    };
  }

  async function remove(id: string): Promise<void> {
    const { error } = await supabase
      .from("client_documents")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }

  return { listByClient, get, create, remove };
};

function normalizeAttributes(
  attributes: DocumentAttributeInput[]
): Array<{
  documentType: string;
  documentId: number | null;
  description: string | null;
}> {
  return attributes
    .map((a) => ({
      documentType: a.documentType.trim(),
      documentId: a.documentId,
      description: a.description.trim() || null,
    }))
    .filter((a) => a.documentType.length > 0);
}
