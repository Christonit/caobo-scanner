<script setup lang="ts">
import type { ActivityAction } from "~/types/database.types";
import { ACTIVITY_ACTION_LABELS } from "~/composables/useActivityLog";

const { activeOrg, isAdmin, isSuperAdmin } = useOrganization();

interface ActivityActor {
  id: string;
  name: string | null;
  email: string | null;
}

interface ActivityEvent {
  id: string;
  action: ActivityAction;
  clientId: string | null;
  targetLabel: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  actor: ActivityActor | null;
}

interface ActivityResponse {
  canSeeAll: boolean;
  role: "admin" | "collaborator" | "superadmin";
  events: ActivityEvent[];
}

const events = ref<ActivityEvent[]>([]);
const canSeeAll = ref(false);
const loading = ref(false);
const errorMsg = ref<string | null>(null);

const actionFilter = ref<ActivityAction | "">("");
const search = ref("");

const ACTION_OPTIONS = Object.entries(ACTIVITY_ACTION_LABELS) as [
  ActivityAction,
  string,
][];

// Color per action family for the badge.
const ACTION_BADGE: Record<ActivityAction, string> = {
  client_created: "bg-emerald-50 text-emerald-700",
  client_updated: "bg-sky-50 text-sky-700",
  document_added: "bg-sky-50 text-sky-700",
  document_updated: "bg-sky-50 text-sky-700",
  document_removed: "bg-rose-50 text-rose-700",
  annotation_added: "bg-indigo-50 text-indigo-700",
  annotation_updated: "bg-indigo-50 text-indigo-700",
  annotation_removed: "bg-rose-50 text-rose-700",
  suplidor_added: "bg-emerald-50 text-emerald-700",
  suplidor_updated: "bg-sky-50 text-sky-700",
  suplidor_removed: "bg-rose-50 text-rose-700",
  gastos_analyzed: "bg-violet-50 text-violet-700",
  gastos_exported: "bg-amber-50 text-amber-700",
  suplidores_analyzed: "bg-violet-50 text-violet-700",
  suplidores_stored: "bg-emerald-50 text-emerald-700",
  suplidores_exported: "bg-amber-50 text-amber-700",
  rows_deferred: "bg-gray-100 text-gray-600",
  export_rated: "bg-rose-50 text-rose-700",
};

async function load() {
  if (!activeOrg.value?.id) {
    events.value = [];
    return;
  }
  loading.value = true;
  errorMsg.value = null;
  try {
    const res = await $fetch<ActivityResponse>("/api/activity", {
      query: {
        organizationId: activeOrg.value.id,
        action: actionFilter.value || undefined,
      },
    });
    events.value = res.events;
    canSeeAll.value = res.canSeeAll;
  } catch (e: any) {
    errorMsg.value =
      e?.data?.statusMessage || e?.message || "No se pudo cargar la actividad.";
  } finally {
    loading.value = false;
  }
}

watch(
  () => [activeOrg.value?.id, actionFilter.value],
  () => load(),
  { immediate: true },
);

const filteredEvents = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return events.value;
  return events.value.filter((e) => {
    const actor = e.actor?.name || e.actor?.email || "";
    return (
      actor.toLowerCase().includes(q) ||
      (e.targetLabel ?? "").toLowerCase().includes(q) ||
      ACTIVITY_ACTION_LABELS[e.action].toLowerCase().includes(q)
    );
  });
});

function actorName(e: ActivityEvent): string {
  return e.actor?.name || e.actor?.email || "Usuario eliminado";
}

function actorInitials(e: ActivityEvent): string {
  const base = e.actor?.name || e.actor?.email || "?";
  return base
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// Human-readable detail line built from the action + metadata.
function detailText(e: ActivityEvent): string {
  const m = e.metadata ?? {};
  const plural = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;
  const sessionBit =
    typeof m.session_id === "string" && m.session_id
      ? ` · sesión ${String(m.session_id).slice(0, 8)}`
      : "";

  switch (e.action) {
    case "gastos_analyzed": {
      const parts = [plural(Number(m.pages) || 0, "página", "páginas")];
      if (m.is_rescan) parts.push("re-análisis");
      return parts.join(" · ") + sessionBit;
    }
    case "gastos_exported":
      return (
        `${plural(Number(m.pages) || 0, "página", "páginas")} exportadas` +
        sessionBit
      );
    case "suplidores_analyzed": {
      const parts = [plural(Number(m.files) || 0, "archivo", "archivos")];
      if (m.extracted != null) parts.push(`${m.extracted} extraídos`);
      return parts.join(" · ") + sessionBit;
    }
    case "suplidores_stored":
      return (
        plural(Number(m.count) || 0, "suplidor", "suplidores") + sessionBit
      );
    case "suplidores_exported":
      return (
        plural(Number(m.count) || 0, "suplidor", "suplidores") + sessionBit
      );
    case "rows_deferred":
      return (
        `${plural(Number(m.count) || 0, "fila", "filas")} para revisar` +
        sessionBit
      );
    case "document_added":
    case "document_updated":
    case "document_removed":
      return typeof m.name === "string" && m.name ? m.name : "";
    case "annotation_added":
    case "annotation_updated":
    case "annotation_removed":
      return typeof m.name === "string" && m.name ? m.name : "";
    case "suplidor_added":
    case "suplidor_updated":
    case "suplidor_removed":
      return typeof m.nombre === "string" && m.nombre ? m.nombre : "";
    case "client_updated": {
      const map: Record<string, string> = {
        document_added: "Agregó un documento",
        document_updated: "Editó un documento",
        rule_added: "Agregó una regla",
      };
      return (m.change && map[m.change as string]) || "Cambios en el cliente";
    }
    case "export_rated":
      return m.rating ? `Calificación: ${m.rating}` : "Calificación";
    case "client_created":
    default:
      return "";
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<template>
  <div class="px-8">
    <div class="mx-auto max-w-6xl">
      <!-- Header -->
      <header class="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900">
            Actividad
          </h1>
          <p class="mt-1 text-sm text-gray-500">
            <template v-if="canSeeAll">
              Registro de acciones de todo el equipo en
              <span class="font-medium text-gray-700">{{
                activeOrg?.name
              }}</span
              >.
            </template>
            <template v-else>
              Tu registro de actividad reciente.
            </template>
          </p>
        </div>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          :disabled="loading"
          @click="load"
        >
          <svg
            class="h-4 w-4 text-gray-400"
            :class="loading ? 'animate-spin' : ''"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.8"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Actualizar
        </button>
      </header>

      <!-- Filters -->
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <div class="relative flex-1 min-w-[220px]">
          <svg
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.8"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            v-model="search"
            type="text"
            placeholder="Buscar por usuario, cliente o acción…"
            class="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <select
          v-model="actionFilter"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="">Todas las acciones</option>
          <option v-for="[value, label] in ACTION_OPTIONS" :key="value" :value="value">
            {{ label }}
          </option>
        </select>
      </div>

      <p
        v-if="errorMsg"
        class="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        {{ errorMsg }}
      </p>

      <!-- Table -->
      <div class="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table class="w-full text-left text-sm">
          <thead
            class="border-b border-gray-100 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500"
          >
            <tr>
              <th class="px-5 py-3">Usuario</th>
              <th class="px-5 py-3">Acción</th>
              <th class="px-5 py-3">Cliente</th>
              <th class="px-5 py-3">Detalle</th>
              <th class="px-5 py-3 text-right">Fecha</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="loading && !filteredEvents.length">
              <td colspan="5" class="px-5 py-12 text-center">
                <svg
                  class="mx-auto h-6 w-6 animate-spin text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  />
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"
                  />
                </svg>
              </td>
            </tr>
            <tr v-else-if="!filteredEvents.length">
              <td colspan="5" class="px-5 py-12 text-center text-sm text-gray-400">
                No hay actividad registrada todavía.
              </td>
            </tr>
            <tr
              v-for="e in filteredEvents"
              :key="e.id"
              class="transition hover:bg-gray-50"
            >
              <!-- Usuario -->
              <td class="px-5 py-3">
                <div class="flex items-center gap-2.5">
                  <span
                    class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold text-gray-600"
                  >
                    {{ actorInitials(e) }}
                  </span>
                  <span class="truncate font-medium text-gray-900">{{
                    actorName(e)
                  }}</span>
                </div>
              </td>
              <!-- Acción -->
              <td class="px-5 py-3">
                <span
                  class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                  :class="ACTION_BADGE[e.action]"
                >
                  {{ ACTIVITY_ACTION_LABELS[e.action] }}
                </span>
              </td>
              <!-- Cliente -->
              <td class="px-5 py-3">
                <NuxtLink
                  v-if="e.clientId && e.targetLabel"
                  :to="`/clientes/${e.clientId}`"
                  class="font-medium text-emerald-600 hover:underline"
                >
                  {{ e.targetLabel }}
                </NuxtLink>
                <span v-else-if="e.targetLabel" class="text-gray-700">{{
                  e.targetLabel
                }}</span>
                <span v-else class="text-gray-300">—</span>
              </td>
              <!-- Detalle -->
              <td class="px-5 py-3 text-gray-600">
                {{ detailText(e) || "—" }}
              </td>
              <!-- Fecha -->
              <td class="whitespace-nowrap px-5 py-3 text-right text-xs text-gray-400">
                {{ formatDate(e.createdAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="mt-3 text-xs text-gray-400">
        Mostrando las {{ filteredEvents.length }} acciones más recientes.
      </p>
    </div>
  </div>
</template>
