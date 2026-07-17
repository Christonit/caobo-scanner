/**
 * Bridge PostHog env → runtimeConfig.
 *
 * `@posthog/nuxt` stores the token at `public.posthog.publicKey`, so Nuxt's
 * automatic env override expects `NUXT_PUBLIC_POSTHOG_PUBLIC_KEY`. Our docs
 * and Railway vars use `NUXT_PUBLIC_POSTHOG_KEY` (PostHog's documented name),
 * which only applies when read in nuxt.config at build/dev time.
 *
 * Docker builds exclude `.env`, so production often starts with an empty
 * baked-in key. Copy from process.env here (server) so the client payload
 * — and posthog.init — receive the real token without a rebuild.
 */
export default defineNuxtPlugin({
  name: "00-posthog-runtime-env",
  enforce: "pre",
  order: -100,
  setup() {
    if (!import.meta.server) return;

    const config = useRuntimeConfig();
    const posthog = config.public.posthog as
      | { publicKey?: string; host?: string; debug?: boolean }
      | undefined;
    if (!posthog) return;

    const key =
      process.env.NUXT_PUBLIC_POSTHOG_KEY?.trim() ||
      process.env.NUXT_PUBLIC_POSTHOG_PUBLIC_KEY?.trim() ||
      "";
    if (key) {
      posthog.publicKey = key;
    }

    const host = process.env.NUXT_PUBLIC_POSTHOG_HOST?.trim();
    if (host) {
      posthog.host = host;
    }
  },
});
