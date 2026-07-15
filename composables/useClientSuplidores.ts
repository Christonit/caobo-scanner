import type { Database } from "~/types/database.types";

export type ClientSuplidor =
  Database["public"]["Tables"]["client_suplidores"]["Row"];

export interface ClientSuplidorInput {
  nombre: string;
  documento: string | null;
  tipo_de_factura: string | null;
  registered_on_platform?: boolean;
}

export const TIPO_DE_FACTURA_OPTIONS = [
  "Formal",
  "Informal",
  "Internacional",
  "Pagos al exterior",
] as const;

export type TipoDeFactura = (typeof TIPO_DE_FACTURA_OPTIONS)[number];

export const useClientSuplidores = () => {
  const supabase = useSupabaseClient<Database>();

  async function listByClient(clientId: string): Promise<ClientSuplidor[]> {
    const { data, error } = await supabase
      .from("client_suplidores")
      .select("*")
      .eq("client_id", clientId)
      .order("nombre", { ascending: true });
    if (error) throw error;
    return (data ?? []) as ClientSuplidor[];
  }

  async function create(
    clientId: string,
    input: ClientSuplidorInput
  ): Promise<ClientSuplidor> {
    const nombre = input.nombre.trim();
    if (!nombre) throw new Error("El nombre del suplidor es obligatorio.");

    const documento = input.documento
      ? input.documento.replace(/\D/g, "").slice(0, 20) || null
      : null;

    const { data, error } = await supabase
      .from("client_suplidores")
      .insert({
        client_id: clientId,
        nombre,
        documento,
        tipo_de_factura: input.tipo_de_factura || null,
        registered_on_platform: input.registered_on_platform ?? false,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as ClientSuplidor;
  }

  async function update(
    id: string,
    input: Partial<ClientSuplidorInput>
  ): Promise<ClientSuplidor> {
    const patch: Database["public"]["Tables"]["client_suplidores"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    if (input.nombre !== undefined) {
      const nombre = input.nombre.trim();
      if (!nombre) throw new Error("El nombre del suplidor es obligatorio.");
      patch.nombre = nombre;
    }
    if (input.documento !== undefined) {
      patch.documento = input.documento
        ? input.documento.replace(/\D/g, "").slice(0, 20) || null
        : null;
    }
    if (input.tipo_de_factura !== undefined) {
      patch.tipo_de_factura = input.tipo_de_factura;
    }
    if (input.registered_on_platform !== undefined) {
      patch.registered_on_platform = input.registered_on_platform;
    }

    const { data, error } = await supabase
      .from("client_suplidores")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as ClientSuplidor;
  }

  async function markAsRegistered(
    id: string,
    value = true
  ): Promise<ClientSuplidor> {
    return update(id, { registered_on_platform: value });
  }

  async function remove(id: string): Promise<void> {
    const { error } = await supabase
      .from("client_suplidores")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }

  /**
   * Upsert a batch of AI-extracted suplidores for a client.
   *
   * - Rows are matched on documento (when present) via the DB unique constraint.
   * - New suplidores are inserted with registered_on_platform = false.
   * - Existing rows are NOT overwritten (registered_on_platform is preserved).
   * - Returns the full updated list after the upsert.
   */
  async function upsertFromScan(
    clientId: string,
    extracted: Array<{ nombre: string; documento: string | null; tipo_de_factura: string | null }>
  ): Promise<ClientSuplidor[]> {
    if (!extracted.length) return listByClient(clientId);

    const rows = extracted.map((s) => ({
      client_id: clientId,
      nombre: s.nombre.trim(),
      documento: s.documento
        ? s.documento.replace(/\D/g, "").slice(0, 20) || null
        : null,
      tipo_de_factura: s.tipo_de_factura || null,
      registered_on_platform: false,
    }));

    const { error } = await supabase
      .from("client_suplidores")
      .upsert(rows, {
        onConflict: "client_id,documento",
        ignoreDuplicates: true,
      });

    if (error) throw error;
    return listByClient(clientId);
  }

  return {
    listByClient,
    create,
    update,
    markAsRegistered,
    remove,
    upsertFromScan,
  };
};
