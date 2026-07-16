import type { Database } from "~/types/database.types";

export type ClientTaxColumnMapping =
  Database["public"]["Tables"]["client_tax_column_mappings"]["Row"];

/** The 4 amounts that can be routed into one of the 5 "Impuesto" slots. */
export const TAX_COLUMN_FIELDS = [
  "itbis",
  "selectivo",
  "descuento",
  "propina",
] as const;
export type TaxColumnField = (typeof TAX_COLUMN_FIELDS)[number];

/** field -> Impuesto slot (1-5), or null/undefined to not export it. */
export type TaxColumnMapping = Partial<Record<TaxColumnField, number | null>>;

const DEFAULT_MAPPING: TaxColumnMapping = {
  itbis: 1,
  selectivo: 2,
  descuento: null,
  propina: null,
};

function rowToMapping(
  row: ClientTaxColumnMapping | null
): TaxColumnMapping {
  if (!row) return { ...DEFAULT_MAPPING };
  return {
    itbis: row.itbis_column,
    selectivo: row.selectivo_column,
    descuento: row.descuento_column,
    propina: row.propina_column,
  };
}

export const useClientTaxColumnMapping = () => {
  const supabase = useSupabaseClient<Database>();

  /** Returns the client's mapping, or sensible defaults if unconfigured. */
  async function getByClient(clientId: string): Promise<TaxColumnMapping> {
    const { data, error } = await supabase
      .from("client_tax_column_mappings")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();
    if (error) throw error;
    return rowToMapping(data as ClientTaxColumnMapping | null);
  }

  /** Creates or updates the single mapping row for this client. */
  async function upsert(
    clientId: string,
    mapping: TaxColumnMapping
  ): Promise<TaxColumnMapping> {
    const usedSlots = TAX_COLUMN_FIELDS.map((f) => mapping[f]).filter(
      (v): v is number => v != null
    );
    const hasDuplicates = new Set(usedSlots).size !== usedSlots.length;
    if (hasDuplicates) {
      throw new Error(
        "Cada columna Impuesto 1-5 solo puede usarse para un valor (ITBIS, Selectivo, Descuento o Propina)."
      );
    }

    const { data, error } = await supabase
      .from("client_tax_column_mappings")
      .upsert(
        {
          client_id: clientId,
          itbis_column: mapping.itbis ?? null,
          selectivo_column: mapping.selectivo ?? null,
          descuento_column: mapping.descuento ?? null,
          propina_column: mapping.propina ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" }
      )
      .select("*")
      .single();
    if (error) throw error;
    return rowToMapping(data as ClientTaxColumnMapping);
  }

  return { getByClient, upsert, DEFAULT_MAPPING };
};
