// Python FastAPI base URL.
//
// Set via `NUXT_PUBLIC_API_BASE` (see nuxt.config.ts runtimeConfig.public.apiBase).
// Local default: http://localhost:8000
// Production (Railway): https://your-backend.up.railway.app

export function useApiBase(): string {
  const config = useRuntimeConfig();
  const raw = String(config.public.apiBase || "").trim();
  return raw.replace(/\/+$/, "");
}
