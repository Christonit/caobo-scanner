import type { Database } from "~/types/database.types";

export type ClientBusinessRule =
  Database["public"]["Tables"]["client_business_rules"]["Row"];
export type BusinessRuleAttribute =
  Database["public"]["Tables"]["business_rule_attributes"]["Row"];

export type ClientBusinessRuleWithAttributes = ClientBusinessRule & {
  business_rule_attributes: BusinessRuleAttribute[];
};

export interface BusinessRuleAttributeInput {
  /** Existing DB id when updating; omit for new attributes. */
  id?: number;
  ruleType: string;
  ruleValue: string;
  description: string;
}

export interface ClientBusinessRuleInput {
  ruleName: string;
  attributes: BusinessRuleAttributeInput[];
}

export const useClientBusinessRules = () => {
  const supabase = useSupabaseClient<Database>();

  async function listByClient(
    clientId: string
  ): Promise<ClientBusinessRuleWithAttributes[]> {
    const { data, error } = await supabase
      .from("client_business_rules")
      .select("*, business_rule_attributes(*)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return ((data ?? []) as ClientBusinessRuleWithAttributes[]).map((rule) => ({
      ...rule,
      business_rule_attributes: [...(rule.business_rule_attributes ?? [])].sort(
        (a, b) => a.id - b.id
      ),
    }));
  }

  async function get(
    id: string
  ): Promise<ClientBusinessRuleWithAttributes | null> {
    const { data, error } = await supabase
      .from("client_business_rules")
      .select("*, business_rule_attributes(*)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const rule = data as ClientBusinessRuleWithAttributes;
    return {
      ...rule,
      business_rule_attributes: [...(rule.business_rule_attributes ?? [])].sort(
        (a, b) => a.id - b.id
      ),
    };
  }

  async function create(
    clientId: string,
    input: ClientBusinessRuleInput
  ): Promise<ClientBusinessRuleWithAttributes> {
    const ruleName = input.ruleName.trim();
    if (!ruleName) {
      throw new Error("El nombre de la regla es obligatorio.");
    }

    const attributes = normalizeAttributes(input.attributes);
    if (attributes.length === 0) {
      throw new Error("Agrega al menos una regla de negocio.");
    }

    const { data: rule, error: ruleErr } = await supabase
      .from("client_business_rules")
      .insert({
        client_id: clientId,
        rule_name: ruleName,
      })
      .select("*")
      .single();
    if (ruleErr) throw ruleErr;

    const { data: attrs, error: attrErr } = await supabase
      .from("business_rule_attributes")
      .insert(
        attributes.map((a) => ({
          client_business_rule_id: rule.id,
          rule_type: a.ruleType,
          rule_value: a.ruleValue,
          description: a.description,
        }))
      )
      .select("*");

    if (attrErr) {
      // Roll back the parent container if attributes fail.
      await supabase.from("client_business_rules").delete().eq("id", rule.id);
      throw attrErr;
    }

    return {
      ...(rule as ClientBusinessRule),
      business_rule_attributes: (attrs ?? []) as BusinessRuleAttribute[],
    };
  }

  async function update(
    id: string,
    input: ClientBusinessRuleInput
  ): Promise<ClientBusinessRuleWithAttributes> {
    const ruleName = input.ruleName.trim();
    if (!ruleName) {
      throw new Error("El nombre de la regla es obligatorio.");
    }

    const attributes = normalizeAttributes(input.attributes);
    if (attributes.length === 0) {
      throw new Error("Agrega al menos una regla de negocio.");
    }

    const { error: ruleErr } = await supabase
      .from("client_business_rules")
      .update({
        rule_name: ruleName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (ruleErr) throw ruleErr;

    const { data: existing, error: existingErr } = await supabase
      .from("business_rule_attributes")
      .select("id")
      .eq("client_business_rule_id", id);
    if (existingErr) throw existingErr;

    const existingIds = new Set((existing ?? []).map((a) => a.id));
    const keptIds = new Set(
      attributes
        .map((a) => a.id)
        .filter((attrId): attrId is number => attrId != null)
    );

    const toDelete = [...existingIds].filter((attrId) => !keptIds.has(attrId));
    if (toDelete.length > 0) {
      const { error: delErr } = await supabase
        .from("business_rule_attributes")
        .delete()
        .in("id", toDelete);
      if (delErr) throw delErr;
    }

    for (const attr of attributes) {
      if (attr.id != null && existingIds.has(attr.id)) {
        const { error: updErr } = await supabase
          .from("business_rule_attributes")
          .update({
            rule_type: attr.ruleType,
            rule_value: attr.ruleValue,
            description: attr.description,
          })
          .eq("id", attr.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from("business_rule_attributes")
          .insert({
            client_business_rule_id: id,
            rule_type: attr.ruleType,
            rule_value: attr.ruleValue,
            description: attr.description,
          });
        if (insErr) throw insErr;
      }
    }

    const refreshed = await get(id);
    if (!refreshed) {
      throw new Error("No se pudo recargar la regla actualizada.");
    }
    return refreshed;
  }

  async function updateAttributeDescription(
    attributeId: number,
    description: string
  ): Promise<BusinessRuleAttribute> {
    const { data, error } = await supabase
      .from("business_rule_attributes")
      .update({ description: description.trim() || null })
      .eq("id", attributeId)
      .select("*")
      .single();
    if (error) throw error;
    return data as BusinessRuleAttribute;
  }

  async function remove(id: string): Promise<void> {
    const { error } = await supabase
      .from("client_business_rules")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }

  return {
    listByClient,
    get,
    create,
    update,
    updateAttributeDescription,
    remove,
  };
};

function normalizeAttributes(
  attributes: BusinessRuleAttributeInput[]
): Array<{
  id?: number;
  ruleType: string;
  ruleValue: string | null;
  description: string | null;
}> {
  return attributes
    .map((a) => ({
      id: a.id,
      ruleType: a.ruleType.trim(),
      ruleValue: a.ruleValue.trim() || null,
      description: a.description.trim() || null,
    }))
    .filter((a) => a.ruleType.length > 0);
}
