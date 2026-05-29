// Single global gate for the app, controlled by the `auth` feature flag.
//
// When features.auth is OFF:
//   - Every route is reachable without signing in.
//   - The auth pages (/login, /signup, /onboarding) redirect to / so they
//     don't leak a dead UI when the feature is disabled.
//
// When features.auth is ON:
//   - Unauthenticated users hitting a non-public path get bounced to /login
//     (this replaces the supabase module's built-in redirect, which we
//     disabled in nuxt.config.ts so this middleware can honor the flag).
//   - Authenticated users without a user_profiles row get bounced to
//     /onboarding so they can create their organization.
import type { Database } from "~/types/database.types";
import type { FeatureFlag } from "~/composables/useFeatureFlags";

const AUTH_PAGES = new Set(["/login", "/signup", "/onboarding"]);
const ALWAYS_PUBLIC = new Set([
  "/login",
  "/signup",
  "/onboarding",
  "/auth/callback",
]);

// Routes that are only reachable when a specific feature flag is enabled.
// When the flag is OFF, the route silently redirects to /.
const FEATURE_GATED_ROUTES: Record<string, FeatureFlag> = {
  "/team": "team",
};

export default defineNuxtRouteMiddleware(async (to) => {
  const features = useFeatureFlags();

  const requiredFlag = FEATURE_GATED_ROUTES[to.path];
  if (requiredFlag && !features.isEnabled(requiredFlag)) {
    return navigateTo("/");
  }

  if (!features.auth) {
    if (AUTH_PAGES.has(to.path)) {
      return navigateTo("/");
    }
    return;
  }

  const user = useSupabaseUser();

  if (!user.value) {
    if (ALWAYS_PUBLIC.has(to.path)) return;
    return navigateTo({
      path: "/login",
      query: to.fullPath === "/" ? undefined : { redirect: to.fullPath },
    });
  }

  if (ALWAYS_PUBLIC.has(to.path)) return;

  const supabase = useSupabaseClient<Database>();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("organization_id")
    .eq("id", user.value.id)
    .maybeSingle();

  if (error) {
    console.error("[auth] failed to check membership", error);
    return;
  }
  if (!data) {
    return navigateTo("/onboarding");
  }
});
