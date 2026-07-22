/**
 * Append spend-attribution fields to FormData sent to the Python backend
 * so token usage can be persisted to public.api_token_usage.
 */
export function useSpendAttribution() {
  const user = useSupabaseUser();
  const { activeOrg } = useOrganization();
  const { thinkingLevel } = useThinkingLevel();

  function appendSpendAttribution(
    formData: FormData,
    opts: { clientId?: string | null } = {},
  ): void {
    const userId = user.value?.sub;
    const organizationId = activeOrg.value?.id;
    const clientId = (opts.clientId || "").trim();

    formData.append("thinking_level", thinkingLevel.value);
    if (userId) formData.append("user_id", userId);
    if (organizationId) formData.append("organization_id", organizationId);
    if (clientId) formData.append("client_id", clientId);
  }

  return { appendSpendAttribution };
}
