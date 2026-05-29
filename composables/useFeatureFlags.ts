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

export type FeatureFlag = "auth" | "team";

export interface FeatureFlagMap extends Record<FeatureFlag, boolean> {}

export interface FeatureFlagsApi extends FeatureFlagMap {
  flags: FeatureFlagMap;
  isEnabled: (flag: FeatureFlag) => boolean;
}

const DEFAULTS: FeatureFlagMap = {
  auth: true,
  team: true,
};

export function useFeatureFlags(): FeatureFlagsApi {
  const config = useRuntimeConfig();
  const raw = (config.public.features ?? {}) as Partial<FeatureFlagMap>;
  const flags: FeatureFlagMap = {
    auth: raw.auth ?? DEFAULTS.auth,
    team: raw.team ?? DEFAULTS.team,
  };

  return {
    ...flags,
    flags,
    isEnabled: (flag) => flags[flag] === true,
  };
}
