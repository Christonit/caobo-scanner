// https://nuxt.com/docs/api/configuration/nuxt-config
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const PDFJS_ASSET_DIRS = ["wasm", "cmaps", "standard_fonts"] as const;

export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ["@nuxtjs/tailwindcss", "@nuxtjs/supabase", "@posthog/nuxt"],
  // PostHog project token + host. Session replay is enabled by default in
  // posthog-js; also turn on "Record user sessions" in PostHog project settings.
  // NUXT_PUBLIC_POSTHOG_KEY is read at build/dev time here; production Docker
  // also relies on plugins/00-posthog-runtime-env.ts so Railway runtime env
  // still reaches posthog.init when .env was not available during the image build.
  posthogConfig: {
    publicKey:
      process.env.NUXT_PUBLIC_POSTHOG_KEY ||
      process.env.NUXT_PUBLIC_POSTHOG_PUBLIC_KEY ||
      "",
    host: process.env.NUXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    clientConfig: {
      capture_exceptions: true,
      // Explicitly keep session replay on (default is already false).
      disable_session_recording: false,
      enable_recording_console_log: true,
      // Inputs (passwords, tax IDs, etc.) stay masked in replays.
      session_recording: {
        maskAllInputs: false,
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
    // Server-only. Supabase "secret" key (service role) — used by
    // /server/api/team/** to create/invite users and bypass RLS safely
    // after the route has verified caller authorization itself.
    supabaseSecretKey:
      process.env.NUXT_SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      "",
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
      exclude: [
        "/login",
        "/signup",
        "/auth/callback",
        "/auth/reset-password",
        "/forgot-password",
      ],
      cookieRedirect: false,
    },
  },
  routeRules: {
    // Tokens arrive in the URL fragment / query — client-only.
    "/auth/callback": { ssr: false },
    "/auth/reset-password": { ssr: false },
    // pdf.js decoder assets (copied into .output/public at build time).
    "/api/pdfjs/**": {
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
      },
    },
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
    // SheetJS is loaded via createRequire (see server/utils/templateAnalysis.ts),
    // so Nitro's static tracer misses it. Force-include it in .output/server/node_modules
    // or the production image crashes with MODULE_NOT_FOUND.
    externals: {
      traceInclude: ["node_modules/xlsx/xlsx.js"],
    },
  },
  hooks: {
    // Copy pdf.js wasm/cmaps/fonts into the public output. Docker only ships
    // .output, so reading from node_modules at runtime 404s in production.
    "nitro:build:public-assets"(nitro) {
      const publicDir = nitro.options.output.publicDir;
      for (const name of PDFJS_ASSET_DIRS) {
        const src = join(
          nitro.options.rootDir,
          "node_modules/pdfjs-dist",
          name,
        );
        if (!existsSync(src)) {
          throw new Error(
            `Missing pdfjs-dist assets at ${src}. Run npm install and rebuild.`,
          );
        }
        cpSync(src, join(publicDir, "api/pdfjs", name), { recursive: true });
      }
    },
  },
  ignore: ["**/python_backend/**"],
});
