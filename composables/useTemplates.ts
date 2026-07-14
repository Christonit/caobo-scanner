import type { Database, TemplateField } from "~/types/database.types";

export type Template = Database["public"]["Tables"]["templates"]["Row"];

export interface TemplateInput {
  name: string;
  description: string;
  documentType: string;
  fields: TemplateField[];
  /** Free-form instructions handed to the LLM, one paragraph per entry. */
  instructions: string[];
  /** Storage object path inside the references bucket, or null. */
  referenceFileUrl: string | null;
}

// Instructions are stored in a single `ai_instructions` text column so they can
// be fed verbatim to the LLM. We round-trip the per-entry inputs using a
// blank-line separator.
const INSTRUCTION_SEPARATOR = "\n\n";

function serializeInstructions(instructions: string[]): string | null {
  const cleaned = instructions.map((i) => i.trim()).filter(Boolean);
  return cleaned.length ? cleaned.join(INSTRUCTION_SEPARATOR) : null;
}

export function parseInstructions(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/\n{2,}/)
    .map((i) => i.trim())
    .filter(Boolean);
}

export const useTemplates = () => {
  const supabase = useSupabaseClient<Database>();
  const user = useSupabaseUser();

  async function list(): Promise<Template[]> {
    const { data, error } = await supabase
      .from("templates")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Template[];
  }

  async function get(id: string): Promise<Template | null> {
    const { data, error } = await supabase
      .from("templates")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return (data as Template) ?? null;
  }

  async function create(input: TemplateInput): Promise<Template> {
    const { data, error } = await supabase
      .from("templates")
      .insert({
        name: input.name.trim(),
        description: input.description.trim() || null,
        document_type: input.documentType.trim() || "invoice",
        fields: normalizeFields(input.fields),
        ai_instructions: serializeInstructions(input.instructions),
        reference_file_url: input.referenceFileUrl,
        created_by: user.value?.sub ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as Template;
  }

  async function update(id: string, input: TemplateInput): Promise<Template> {
    const { data, error } = await supabase
      .from("templates")
      .update({
        name: input.name.trim(),
        description: input.description.trim() || null,
        document_type: input.documentType.trim() || "invoice",
        fields: normalizeFields(input.fields),
        ai_instructions: serializeInstructions(input.instructions),
        reference_file_url: input.referenceFileUrl,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as Template;
  }

  // Soft delete keeps history intact (documents reference templates).
  async function remove(id: string): Promise<void> {
    const { error } = await supabase
      .from("templates")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  return { list, get, create, update, remove };
};

function normalizeFields(fields: TemplateField[]): TemplateField[] {
  return fields
    .map((f) => ({ name: f.name.trim(), description: f.description.trim() }))
    .filter((f) => f.name.length > 0);
}
