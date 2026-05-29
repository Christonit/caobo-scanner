// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ["@pinia/nuxt", "@nuxtjs/tailwindcss", "@nuxtjs/supabase"],
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || "http://localhost:8000",
      // Feature flags. Defaults can be overridden per-environment via env
      // vars (NUXT_PUBLIC_FEATURES_AUTH=false, NUXT_PUBLIC_FEATURES_TEAM=false).
      // Consume via `useFeatureFlags()` (see composables/useFeatureFlags.ts).
      features: {
        auth: false,
        team: true,
      },
    },
  },
  supabase: {
    // We intentionally disable the module's built-in redirect so our own
    // global middleware can honor the `features.auth` flag at runtime.
    // /auth/callback still needs `ssr: false` because the access_token is
    // delivered in the URL fragment (only readable client-side).
    redirect: false,
    redirectOptions: {
      login: "/login",
      callback: "/auth/callback",
      include: undefined,
      exclude: ["/login", "/signup", "/auth/callback", "/forgot-password"],
      cookieRedirect: false,
    },
  },
  routeRules: {
    "/auth/callback": { ssr: false },
  },
  vite: {
    optimizeDeps: {
      include: ["pdfjs-dist"],
      esbuildOptions: {
        target: "esnext",
      },
    },
    server: {
      watch: {
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.nuxt/**",
          "**/.output/**",
        ],
      },
    },
    build: {
      target: "esnext",
    },
  },
  nitro: {
    esbuild: {
      options: {
        target: "esnext",
      },
    },
  },
  ignore: ["**/python_backend/**"],
});
