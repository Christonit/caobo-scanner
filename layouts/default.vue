<script setup lang="ts">
const features = useFeatureFlags();
const route = useRoute();

const supabase = useSupabaseClient();
const user = useSupabaseUser();
const {
  activeOrg,
  isAdmin,
  isSuperAdmin,
  switchableOrgs,
  canSwitchOrgs,
  setActiveOrg,
  refresh,
} = useOrganization();

watchEffect(async () => {
  if (features.auth && user.value?.sub) await refresh();
});

const orgMenuOpen = ref(false);
const switchingOrg = ref(false);

async function selectOrg(orgId: string) {
  if (orgId === activeOrg.value?.id) {
    orgMenuOpen.value = false;
    return;
  }
  switchingOrg.value = true;
  try {
    await setActiveOrg(orgId);
    orgMenuOpen.value = false;
    // Reload tenant-scoped pages against the new active org.
    await refreshNuxtData();
    await navigateTo(route.fullPath, { replace: true, force: true });
  } catch (err) {
    console.error("[layout] failed to switch organization", err);
  } finally {
    switchingOrg.value = false;
  }
}

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
  return features.auth ? Boolean(user.value?.sub) : true;
});

async function signOut() {
  await supabase.auth.signOut();
  await navigateTo("/login");
}

const nav = [
  { to: "/", label: "Resumen", icon: "home" },
  {
    to: "/",
    label: "Extraer",
    icon: "extract",
    children: [
      { to: "/", label: "Gastos" },
      { to: "/suplidores", label: "Suplidores" },
    ],
  },
  { to: "/clientes", label: "Clientes", icon: "users" },
  { to: "/activity", label: "Actividad", icon: "activity" },
];

const navWithAdmin = computed(() =>
  isAdmin.value
    ? [
        ...nav,
        { to: "/leaderboard", label: "Consumo IA", icon: "chart" },
        { to: "/team", label: "Equipo", icon: "users" },
      ]
    : nav,
);

function isNavActive(to: string, children?: { to: string }[]) {
  if (children?.length) {
    return children.some((c) => isNavActive(c.to));
  }
  if (to === "/") return route.path === "/";
  return route.path === to || route.path.startsWith(`${to}/`);
}

const displayName = computed(() => {
  const meta = user.value?.user_metadata as { full_name?: string } | undefined;
  return meta?.full_name || user.value?.email || "Usuario";
});

const orgInitial = computed(() =>
  (activeOrg.value?.name ?? "?").charAt(0).toUpperCase(),
);

const userInitials = computed(() =>
  displayName.value
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join(""),
);

/** Pinned collapsed preference; hover still expands temporarily. */
const sidebarCollapsed = ref(false);
const sidebarHovered = ref(false);
/** Blocks hover-expand right after clicking Contraer (cursor still over sidebar). */
const hoverLocked = ref(false);
const sidebarExpanded = computed(
  () => !sidebarCollapsed.value || sidebarHovered.value,
);

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  if (sidebarCollapsed.value) {
    orgMenuOpen.value = false;
    hoverLocked.value = true;
    sidebarHovered.value = false;
  }
}

function onSidebarEnter() {
  if (hoverLocked.value) return;
  sidebarHovered.value = true;
}

function onSidebarLeave() {
  hoverLocked.value = false;
  sidebarHovered.value = false;
  if (sidebarCollapsed.value) orgMenuOpen.value = false;
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <template v-if="showShell">
      <div class="flex min-h-screen">
        <!-- Sidebar -->
        <aside
          class="fixed inset-y-0 left-0 z-[100] flex flex-col border-r border-gray-200 bg-white transition-[width,box-shadow] duration-200 ease-out"
          :class="[
            sidebarExpanded ? 'w-60' : 'w-16',
            sidebarCollapsed && sidebarHovered ? 'shadow-lg' : '',
          ]"
          @mouseenter="onSidebarEnter"
          @mouseleave="onSidebarLeave"
        >
          <!-- Logo / org switcher (multi-org members + superadmins) -->
          <div class="relative py-4" :class="sidebarExpanded ? 'px-4' : 'px-3'">
            <button
              type="button"
              :disabled="!canSwitchOrgs || switchingOrg"
              :title="activeOrg?.name ?? 'Caobo Recibos'"
              @click="orgMenuOpen = canSwitchOrgs ? !orgMenuOpen : false"
              class="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition"
              :class="[
                canSwitchOrgs ? 'hover:bg-gray-100' : 'cursor-default',
                sidebarExpanded ? '' : 'justify-center px-0',
              ]"
            >
              <span
                class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white"
              >
                {{ orgInitial }}
              </span>
              <span
                v-show="sidebarExpanded"
                class="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900"
              >
                {{ activeOrg?.name ?? "Caobo Recibos" }}
              </span>
              <svg
                v-if="canSwitchOrgs && sidebarExpanded"
                class="h-4 w-4 flex-shrink-0 text-gray-400 transition"
                :class="orgMenuOpen ? 'rotate-180' : ''"
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

            <div
              v-if="canSwitchOrgs && orgMenuOpen && sidebarExpanded"
              class="absolute left-4 right-4 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
            >
              <p
                class="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400"
              >
                {{
                  isSuperAdmin
                    ? "Ver como organización"
                    : "Cambiar organización"
                }}
              </p>
              <button
                v-for="org in switchableOrgs"
                :key="org.id"
                type="button"
                :disabled="switchingOrg"
                @click="selectOrg(org.id)"
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition disabled:opacity-50"
                :class="
                  org.id === activeOrg?.id
                    ? 'bg-emerald-50 text-emerald-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                "
              >
                <span class="truncate">{{ org.name }}</span>
              </button>
              <p
                v-if="!switchableOrgs.length"
                class="px-3 py-2 text-sm text-gray-400"
              >
                No hay organizaciones.
              </p>
            </div>
          </div>

          <!-- Nav -->
          <nav class="flex-1 space-y-0.5 overflow-y-auto px-3">
            <div
              v-for="item in navWithAdmin"
              :key="item.label"
              :class="item.children && sidebarExpanded ? 'group/submenu' : ''"
            >
              <NuxtLink
                :to="item.to"
                :title="item.label"
                class="group flex items-center rounded-lg py-2 text-sm font-medium transition"
                :class="[
                  sidebarExpanded ? 'gap-3 px-3' : 'justify-center px-0',
                  isNavActive(item.to, item.children)
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                ]"
              >
                <span
                  class="flex h-5 w-5 flex-shrink-0 items-center justify-center"
                  :class="
                    isNavActive(item.to, item.children)
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
                  <!-- activity -->
                  <svg
                    v-else-if="item.icon === 'activity'"
                    class="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.8"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <!-- chart -->
                  <svg
                    v-else-if="item.icon === 'chart'"
                    class="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.8"
                      d="M4 20h16M7 20v-6m5 6V8m5 12v-9"
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
                <span v-show="sidebarExpanded" class="truncate">{{
                  item.label
                }}</span>
                <!-- Chevron indicator for items with children -->
                <svg
                  v-if="item.children && sidebarExpanded"
                  class="ml-auto h-3.5 w-3.5 flex-shrink-0 text-gray-400 transition group-hover/submenu:rotate-180"
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
              </NuxtLink>

              <!-- Inline submenu — expands in flow and pushes items below -->
              <div
                v-if="item.children && sidebarExpanded"
                class="hidden flex-col group-hover/submenu:flex"
              >
                <NuxtLink
                  v-for="child in item.children"
                  :key="child.to"
                  :to="child.to"
                  class="flex items-center gap-2 rounded-lg py-2 pl-11 pr-3 text-sm font-medium transition"
                  :class="
                    isNavActive(child.to)
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  "
                >
                  <span
                    class="h-1.5 w-1.5 rounded-full"
                    :class="
                      isNavActive(child.to) ? 'bg-emerald-500' : 'bg-gray-300'
                    "
                  />
                  {{ child.label }}
                </NuxtLink>
              </div>
            </div>
          </nav>

          <!-- Collapse toggle + settings + logged-in user + sign out -->
          <div class="border-t border-gray-200 p-3">
            <button
              type="button"
              :title="sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'"
              @click="toggleSidebar"
              class="group mb-1 flex w-full items-center rounded-lg py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
              :class="sidebarExpanded ? 'gap-3 px-3' : 'justify-center px-0'"
            >
              <span
                class="flex h-5 w-5 flex-shrink-0 items-center justify-center text-gray-400 group-hover:text-gray-600"
              >
                <svg
                  class="h-5 w-5 transition"
                  :class="sidebarCollapsed ? 'rotate-180' : ''"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                    d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                  />
                </svg>
              </span>
              <span v-show="sidebarExpanded">{{
                sidebarCollapsed ? "Expandir" : "Contraer"
              }}</span>
            </button>
            <NuxtLink
              to="/settings"
              title="Configuración"
              class="group mb-1 flex items-center rounded-lg py-2 text-sm font-medium transition"
              :class="[
                sidebarExpanded ? 'gap-3 px-3' : 'justify-center px-0',
                route.path === '/settings'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              ]"
            >
              <span
                class="flex h-5 w-5 flex-shrink-0 items-center justify-center"
                :class="
                  route.path === '/settings'
                    ? 'text-emerald-600'
                    : 'text-gray-400 group-hover:text-gray-600'
                "
              >
                <svg
                  class="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </span>
              <span v-show="sidebarExpanded">Configuración</span>
            </NuxtLink>
            <div
              class="flex items-center py-1.5"
              :class="sidebarExpanded ? 'gap-3 px-1' : 'justify-center px-0'"
              :title="displayName"
            >
              <span
                class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600"
              >
                {{ userInitials }}
              </span>
              <div v-show="sidebarExpanded" class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-gray-900">
                  {{ displayName }}
                </p>
                <p class="truncate text-xs text-gray-400">{{ user?.email }}</p>
              </div>
            </div>
            <button
              type="button"
              title="Cerrar sesión"
              @click="signOut"
              class="mt-1 flex w-full items-center rounded-lg py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
              :class="sidebarExpanded ? 'gap-2 px-3' : 'justify-center px-0'"
            >
              <svg
                class="h-5 w-5 flex-shrink-0 text-gray-400"
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
              <span v-show="sidebarExpanded">Cerrar sesión</span>
            </button>
          </div>
        </aside>

        <!-- Main content — reserved width follows pinned state (hover overlays) -->
        <main
          class="min-h-screen min-w-0 flex-1 py-8 transition-[padding] duration-200 ease-out"
          :class="sidebarCollapsed ? 'pl-16' : 'pl-60'"
        >
          <slot />
        </main>
      </div>
    </template>

    <template v-else>
      <slot />
    </template>
  </div>
</template>
