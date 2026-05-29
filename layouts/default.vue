<script setup lang="ts">
const features = useFeatureFlags();
const route = useRoute();

const supabase = useSupabaseClient();
const user = useSupabaseUser();
const { activeOrg, refresh } = useOrganization();

watchEffect(async () => {
  if (features.auth && user.value) await refresh();
});

// Routes that render the bare slot (no sidebar). Login/signup already opt out
// via `definePageMeta({ layout: false })`; onboarding has no org yet so it
// shows its own centered card instead of the app shell.
const BARE_ROUTES = new Set(["/onboarding"]);

// The app shell (sidebar) renders on every app page for a signed-in user.
// It intentionally does NOT depend on `activeOrg` loading successfully — the
// org switcher falls back gracefully — so a slow or failing membership lookup
// can't make the whole sidebar disappear.
const showShell = computed(() => {
  if (BARE_ROUTES.has(route.path)) return false;
  return features.auth ? Boolean(user.value) : true;
});

async function signOut() {
  await supabase.auth.signOut();
  await navigateTo("/login");
}

const nav = [
  { to: "/resumen", label: "Resumen", icon: "home" },
  { to: "/", label: "Extraer", icon: "extract" },
  { to: "/documentos", label: "Documentos", icon: "doc" },
  { to: "/clientes", label: "Clientes", icon: "users" },
  { to: "/plantillas", label: "Plantillas", icon: "template" },
];

const displayName = computed(() => {
  const meta = user.value?.user_metadata as { full_name?: string } | undefined;
  return meta?.full_name || user.value?.email || "Usuario";
});

const orgInitial = computed(() =>
  (activeOrg.value?.name ?? "?").charAt(0).toUpperCase()
);

const userInitials = computed(() =>
  displayName.value
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
);
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <template v-if="showShell">
      <div class="flex min-h-screen">
        <!-- Sidebar -->
        <aside
          class="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-gray-200 bg-white"
        >
          <!-- Logo / org switcher -->
          <div class="px-4 py-4">
            <button
              class="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-gray-100"
            >
              <span
                class="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white"
              >
                {{ orgInitial }}
              </span>
              <span class="flex-1 truncate text-sm font-semibold text-gray-900">
                {{ activeOrg?.name ?? "Caobo Recibos" }}
              </span>
              <svg
                class="h-4 w-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>

          <!-- Nav -->
          <nav class="flex-1 space-y-0.5 px-3">
            <NuxtLink
              v-for="item in nav"
              :key="item.to"
              :to="item.to"
              class="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition"
              :class="
                route.path === item.to
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              "
            >
              <span
                class="flex h-5 w-5 items-center justify-center"
                :class="
                  route.path === item.to
                    ? 'text-emerald-600'
                    : 'text-gray-400 group-hover:text-gray-600'
                "
              >
                <!-- home -->
                <svg
                  v-if="item.icon === 'home'"
                  class="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                    d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10"
                  />
                </svg>
                <!-- extract -->
                <svg
                  v-else-if="item.icon === 'extract'"
                  class="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"
                  />
                </svg>
                <!-- doc -->
                <svg
                  v-else-if="item.icon === 'doc'"
                  class="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                    d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm7 0v5h5"
                  />
                </svg>
                <!-- users -->
                <svg
                  v-else-if="item.icon === 'users'"
                  class="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                    d="M17 20h5v-1a4 4 0 00-4-4h-1m-7 5H2v-1a4 4 0 014-4h4a4 4 0 014 4v1zm-3-9a3 3 0 11-6 0 3 3 0 016 0zm9-3a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <!-- template -->
                <svg
                  v-else
                  class="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v3H4V5zm0 5h7v9H5a1 1 0 01-1-1v-8zm9 0h7v8a1 1 0 01-1 1h-6v-9z"
                  />
                </svg>
              </span>
              {{ item.label }}
            </NuxtLink>
          </nav>

          <!-- Logged-in user + sign out -->
          <div class="border-t border-gray-200 p-3">
            <div class="flex items-center gap-3 px-1 py-1.5">
              <span
                class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600"
              >
                {{ userInitials }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-gray-900">
                  {{ displayName }}
                </p>
                <p class="truncate text-xs text-gray-400">{{ user?.email }}</p>
              </div>
            </div>
            <button
              @click="signOut"
              class="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              <svg
                class="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"
                />
              </svg>
              Cerrar sesión
            </button>
          </div>
        </aside>

        <!-- Main content -->
        <div class="min-w-0 flex-1 pl-60">
          <main class="min-h-screen">
            <slot />
          </main>
        </div>
      </div>
    </template>

    <template v-else>
      <slot />
    </template>
  </div>
</template>
