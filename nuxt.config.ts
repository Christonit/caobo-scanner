// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ["@nuxtjs/tailwindcss", "@nuxtjs/supabase", "@posthog/nuxt"],
  // PostHog project token + host. Session replay is enabled by default in
  // posthog-js; also turn on "Record user sessions" in PostHog project settings.
  posthogConfig: {
    publicKey: process.env.NUXT_PUBLIC_POSTHOG_KEY || "",
    host: process.env.NUXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    clientConfig: {
      capture_pageview: true,
      capture_pageleave: true,
      // Explicitly keep session replay on (default is already false).
      disable_session_recording: false,
      enable_recording_console_log: true,
      // Inputs (passwords, tax IDs, etc.) stay masked in replays.
      session_recording: {
        maskAllInputs: true,
      },
    },
  },
  runtimeConfig: {
    // Server-only. The Gemini API key powers template/invoice analysis and
    // must never reach the browser.
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    // Default model used by the template-analysis endpoint.
    templateAnalysisModel:
      process.env.TEMPLATE_ANALYSIS_MODEL || "gemini-2.5-flash",
    // Default model used when extracting data from invoices/receipts.
    invoiceAnalysisModel: process.env.INVOICE_ANALYSIS_MODEL || "",
    public: {
      // Overridable at runtime with NUXT_PUBLIC_API_BASE (see useApiBase()).
      apiBase: process.env.NUXT_PUBLIC_API_BASE || "http://localhost:8000",
      // Feature flags. Defaults can be overridden per-environment via env
      // vars (NUXT_PUBLIC_FEATURES_AUTH=false, NUXT_PUBLIC_FEATURES_TEAM=false).
      // Consume via `useFeatureFlags()` (see composables/useFeatureFlags.ts).
      features: {
        auth: true,
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
