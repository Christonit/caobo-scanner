import type { Database } from "~/types/database.types";
import type {
  BusinessRuleAttributeInput,
  ClientBusinessRuleInput,
} from "~/composables/useClientBusinessRules";

export type OrganizationBusinessRule =
  Database["public"]["Tables"]["organization_business_rules"]["Row"];
export type OrganizationBusinessRuleAttribute =
  Database["public"]["Tables"]["organization_business_rule_attributes"]["Row"];

export type OrganizationBusinessRuleWithAttributes = OrganizationBusinessRule & {
  /** Mapped to the same shape as client rules so the shared form works. */
  business_rule_attributes: Array<{
    id: number;
    rule_type: string;
    rule_value: string | null;
    description: string | null;
    created_at: string;
  }>;
};

export type OrganizationBusinessRuleInput = ClientBusinessRuleInput;

export const useOrganizationBusinessRules = () => {
  const supabase = useSupabaseClient<Database>();

  function mapRule(row: {
    id: string;
    organization_id: string;
    rule_name: string;
    created_at: string;
    updated_at: string;
    organization_business_rule_attributes?: OrganizationBusinessRuleAttribute[] | null;
  }): OrganizationBusinessRuleWithAttributes {
    const attrs = [...(row.organization_business_rule_attributes ?? [])].sort(
      (a, b) => a.id - b.id
    );
    return {
      id: row.id,
      organization_id: row.organization_id,
      rule_name: row.rule_name,
      created_at: row.created_at,
      updated_at: row.updated_at,
      business_rule_attributes: attrs.map((a) => ({
        id: a.id,
        rule_type: a.rule_type,
        rule_value: a.rule_value,
        description: a.description,
        created_at: a.created_at,
      })),
    };
  }

  async function listByOrganization(
    organizationId: string
  ): Promise<OrganizationBusinessRuleWithAttributes[]> {
    const { data, error } = await supabase
      .from("organization_business_rules")
      .select("*, organization_business_rule_attributes(*)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapRule(row as any));
  }

  async function get(
    id: string
  ): Promise<OrganizationBusinessRuleWithAttributes | null> {
    const { data, error } = await supabase
      .from("organization_business_rules")
      .select("*, organization_business_rule_attributes(*)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return mapRule(data as any);
  }

  async function create(
    organizationId: string,
    input: OrganizationBusinessRuleInput
  ): Promise<OrganizationBusinessRuleWithAttributes> {
    const ruleName = input.ruleName.trim();
    if (!ruleName) {
      throw new Error("El nombre de la regla es obligatorio.");
    }

    const attributes = normalizeAttributes(input.attributes);
    if (attributes.length === 0) {
      throw new Error("Agrega al menos una regla de negocio.");
    }

    const { data: rule, error: ruleErr } = await supabase
      .from("organization_business_rules")
      .insert({
        organization_id: organizationId,
        rule_name: ruleName,
      })
      .select("*")
      .single();
    if (ruleErr) throw ruleErr;

    const { data: attrs, error: attrErr } = await supabase
      .from("organization_business_rule_attributes")
      .insert(
        attributes.map((a) => ({
          organization_business_rule_id: rule.id,
          rule_type: a.ruleType,
          rule_value: a.ruleValue,
          description: a.description,
        }))
      )
      .select("*");

    if (attrErr) {
      await supabase
        .from("organization_business_rules")
        .delete()
        .eq("id", rule.id);
      throw attrErr;
    }

    return {
      ...(rule as OrganizationBusinessRule),
      business_rule_attributes: (attrs ?? []).map((a) => ({
        id: a.id,
        rule_type: a.rule_type,
        rule_value: a.rule_value,
        description: a.description,
        created_at: a.created_at,
      })),
    };
  }

  async function update(
    id: string,
    input: OrganizationBusinessRuleInput
  ): Promise<OrganizationBusinessRuleWithAttributes> {
    const ruleName = input.ruleName.trim();
    if (!ruleName) {
      throw new Error("El nombre de la regla es obligatorio.");
    }

    const attributes = normalizeAttributes(input.attributes);
    if (attributes.length === 0) {
      throw new Error("Agrega al menos una regla de negocio.");
    }

    const { error: ruleErr } = await supabase
      .from("organization_business_rules")
      .update({
        rule_name: ruleName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (ruleErr) throw ruleErr;

    const { data: existing, error: existingErr } = await supabase
      .from("organization_business_rule_attributes")
      .select("id")
      .eq("organization_business_rule_id", id);
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
        .from("organization_business_rule_attributes")
        .delete()
        .in("id", toDelete);
      if (delErr) throw delErr;
    }

    for (const attr of attributes) {
      if (attr.id != null && existingIds.has(attr.id)) {
        const { error: updErr } = await supabase
          .from("organization_business_rule_attributes")
          .update({
            rule_type: attr.ruleType,
            rule_value: attr.ruleValue,
            description: attr.description,
          })
          .eq("id", attr.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from("organization_business_rule_attributes")
          .insert({
            organization_business_rule_id: id,
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

  async function remove(id: string): Promise<void> {
    const { error } = await supabase
      .from("organization_business_rules")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }

  return {
    listByOrganization,
    get,
    create,
    update,
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
