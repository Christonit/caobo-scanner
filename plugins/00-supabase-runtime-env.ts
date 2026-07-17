export default defineNuxtPlugin({
  name: "00-supabase-runtime-env",
  enforce: "pre",
  order: -100,
  setup() {
    // Nuxt only auto-maps NUXT_PUBLIC_* into runtimeConfig at runtime.
    // Fill gaps from legacy SUPABASE_* names used in Railway/Docker.
    if (!import.meta.server) return;

    const config = useRuntimeConfig();
    const supabaseConfig = config.public.supabase as {
      url?: string;
      key?: string;
    };

    if (!supabaseConfig.url) {
      supabaseConfig.url =
        process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    }
    if (!supabaseConfig.key) {
      supabaseConfig.key =
        process.env.NUXT_PUBLIC_SUPABASE_KEY || process.env.SUPABASE_KEY;
    }
  },
});
