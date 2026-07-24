// Tiny runtime feature-flag helper.
//
// Flags live under `runtimeConfig.public.features` (see nuxt.config.ts) so
// they can be overridden per environment with `NUXT_PUBLIC_FEATURES_<NAME>`
// env vars at start time:
//
//   NUXT_PUBLIC_FEATURES_AUTH=false npm run dev     # boot without auth
//   NUXT_PUBLIC_FEATURES_TEAM=false npm run dev     # hide the team page
//
// Usage:
//
//   const features = useFeatureFlags();
//   if (features.isEnabled("auth")) { ... }
//   <button v-if="features.auth"> ... </button>

export type FeatureFlag = "auth" | "team" | "effectiveness";

export interface FeatureFlagMap extends Record<FeatureFlag, boolean> {}

export interface FeatureFlagsApi extends FeatureFlagMap {
  flags: FeatureFlagMap;
  isEnabled: (flag: FeatureFlag) => boolean;
}

const DEFAULTS: FeatureFlagMap = {
  auth: true,
  team: true,
  effectiveness: false,
};

// Nuxt env overrides (`NUXT_PUBLIC_FEATURES_*`) arrive as strings. Coerce so
// `isEnabled()` and truthiness checks stay consistent.
function coerceFlag(value: unknown, fallback: boolean): boolean {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  if (typeof value === "boolean") return value;
  return fallback;
}

export function useFeatureFlags(): FeatureFlagsApi {
  const config = useRuntimeConfig();
  const raw = (config.public.features ?? {}) as Record<string, unknown>;
  const flags: FeatureFlagMap = {
    auth: coerceFlag(raw.auth, DEFAULTS.auth),
    team: coerceFlag(raw.team, DEFAULTS.team),
    effectiveness: coerceFlag(raw.effectiveness, DEFAULTS.effectiveness),
  };

  return {
    ...flags,
    flags,
    isEnabled: (flag) => flags[flag] === true,
  };
}
