/**
 * Link PostHog session replays / events to the signed-in Supabase user.
 * Resets identity on sign-out so the next visitor isn't tied to the prior user.
 */
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  if (!config.public.posthog?.publicKey) return;

  const posthog = usePostHog();
  if (!posthog) return;

  const user = useSupabaseUser();
  let identifiedId: string | null = null;

  watch(
    user,
    (next) => {
      const id = next?.sub ?? null;
      if (id) {
        if (identifiedId === id) return;
        const meta = next?.user_metadata as
          | { full_name?: string }
          | undefined;
        posthog.identify(id, {
          email: next?.email,
          name: meta?.full_name,
        });
        identifiedId = id;
        return;
      }

      if (identifiedId) {
        posthog.reset();
        identifiedId = null;
      }
    },
    { immediate: true },
  );
});
