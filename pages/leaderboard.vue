<script setup lang="ts">
// Admin-only spend leaderboard: who consumes Gemini tokens, what it costs, and
// how that trends per day. Aggregation lives in /api/usage/leaderboard; this
// page only reshapes the response for the cards, chart and tables.
import type {
  SpendActor,
  SpendBarPoint,
  SpendDay,
  SpendLeaderboardResponse,
  SpendRangeKey,
} from "~/types/spend";
import {
  formatDayLong,
  formatDayShort,
  formatMonthLong,
  formatPercentDelta,
  formatTokens,
  formatTokensCompact,
  formatUsd,
  formatUsdCompact,
  initialsFrom,
  percentDelta,
} from "~/utils/spendFormat";

const { activeOrg, isAdmin } = useOrganization();

const data = ref<SpendLeaderboardResponse | null>(null);
const loading = ref(false);
const errorMsg = ref<string | null>(null);
const forbidden = ref(false);

/** "" = every client, "none" = calls with no client attached, else a client id. */
const clientFilter = ref("");

const CHART_RANGES = [
  { days: 3, label: "3 días" },
  { days: 7, label: "7 días" },
  { days: 15, label: "15 días" },
  { days: 30, label: "1 mes" },
] as const;
const chartRange = ref<number>(7);

const metric = ref<"cost" | "tokens">("cost");

const DETAIL_RANGES = [
  { value: "today", label: "Hoy", take: 1, skipToday: false },
  { value: "yesterday", label: "Ayer", take: 1, skipToday: true },
  { value: "last7", label: "Últimos 7 días", take: 7, skipToday: false },
  { value: "last15", label: "Últimos 15 días", take: 15, skipToday: false },
  { value: "last30", label: "Últimos 30 días", take: 30, skipToday: false },
] as const;
type DetailRangeValue = (typeof DETAIL_RANGES)[number]["value"];
const detailRange = ref<DetailRangeValue>("last7");

const LEADERBOARD_COLUMNS: { key: SpendRangeKey; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "yesterday", label: "Ayer" },
  { key: "last5", label: "5 días" },
  { key: "last15", label: "15 días" },
  { key: "last30", label: "30 días" },
  { key: "thisMonth", label: "Este mes" },
];
const sortColumn = ref<SpendRangeKey>("last30");

const expandedDays = ref<Record<string, boolean>>({});

async function load() {
  if (!isAdmin.value || !activeOrg.value?.id) return;

  loading.value = true;
  errorMsg.value = null;
  forbidden.value = false;
  try {
    data.value = await $fetch<SpendLeaderboardResponse>("/api/usage/leaderboard", {
      query: {
        organizationId: activeOrg.value.id,
        clientId: clientFilter.value || undefined,
        // Bucket days by the viewer's calendar, falling back server-side.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });
  } catch (e: any) {
    if (e?.statusCode === 403 || e?.response?.status === 403) {
      forbidden.value = true;
      data.value = null;
    } else {
      errorMsg.value =
        e?.data?.statusMessage || e?.message || "No se pudo cargar el consumo.";
    }
  } finally {
    loading.value = false;
  }
}

// Client-only: the request carries the browser timezone, and there is nothing
// worth rendering server-side before the aggregation returns.
onMounted(() => {
  watch(
    () => [activeOrg.value?.id, isAdmin.value, clientFilter.value],
    () => load(),
    { immediate: true },
  );
});

const days = computed<SpendDay[]>(() => data.value?.days ?? []);

const totals = computed(() => data.value?.totals ?? null);

const thisMonthLabel = computed(() =>
  data.value ? formatMonthLong(data.value.window.endDate.slice(0, 7)) : "Este mes",
);

const lastMonthLabel = computed(() => {
  if (!data.value) return "Mes pasado";
  const [y, m] = data.value.window.endDate.slice(0, 7).split("-").map(Number);
  const previous = new Date(Date.UTC(y, (m ?? 1) - 2, 1));
  return formatMonthLong(
    `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`,
  );
});

const todayVsYesterday = computed(() =>
  totals.value
    ? percentDelta(totals.value.today.cost, totals.value.yesterday.cost)
    : null,
);

const monthVsLastMonth = computed(() =>
  totals.value
    ? percentDelta(totals.value.thisMonth.cost, totals.value.lastMonth.cost)
    : null,
);

const last7DailyAverage = computed(() =>
  totals.value ? totals.value.last7.cost / 7 : 0,
);

// --- Chart ---------------------------------------------------------------

const chartDays = computed(() => days.value.slice(-chartRange.value));

const chartPoints = computed<SpendBarPoint[]>(() =>
  chartDays.value.map((day) => ({
    key: day.date,
    label: formatDayShort(day.date),
    tooltipLabel: formatDayLong(day.date),
    value: metric.value === "cost" ? day.cost : day.tokens,
    caption:
      metric.value === "cost"
        ? `${formatTokens(day.tokens)} tokens · ${day.calls} llamadas`
        : `${formatUsd(day.cost)} · ${day.calls} llamadas`,
  })),
);

const chartTotal = computed(() =>
  chartDays.value.reduce(
    (acc, day) => {
      acc.cost += day.cost;
      acc.tokens += day.tokens;
      acc.calls += day.calls;
      return acc;
    },
    { cost: 0, tokens: 0, calls: 0 },
  ),
);

const chartValueFormatter = computed(() =>
  metric.value === "cost" ? formatUsd : formatTokens,
);
const chartAxisFormatter = computed(() =>
  metric.value === "cost" ? formatUsdCompact : formatTokensCompact,
);

// --- Leaderboard table ---------------------------------------------------

const sortedLeaderboard = computed(() => {
  const rows = [...(data.value?.leaderboard ?? [])];
  const key = sortColumn.value;
  return rows.sort(
    (a, b) => b[key].cost - a[key].cost || b[key].tokens - a[key].tokens,
  );
});

function actorName(actor: SpendActor): string {
  return actor.name || actor.email || "Usuario eliminado";
}

// --- Day detail ----------------------------------------------------------

const detailDays = computed<SpendDay[]>(() => {
  const config = DETAIL_RANGES.find((r) => r.value === detailRange.value);
  if (!config) return [];
  const all = days.value;
  const window = config.skipToday
    ? all.slice(-(config.take + 1), -1)
    : all.slice(-config.take);
  return [...window].reverse().filter((day) => day.calls > 0);
});

const detailTotals = computed(() =>
  detailDays.value.reduce(
    (acc, day) => {
      acc.cost += day.cost;
      acc.tokens += day.tokens;
      acc.calls += day.calls;
      return acc;
    },
    { cost: 0, tokens: 0, calls: 0 },
  ),
);

function toggleDay(date: string) {
  expandedDays.value = {
    ...expandedDays.value,
    [date]: !expandedDays.value[date],
  };
}

const lastUpdated = computed(() => {
  if (!data.value) return "";
  return new Date(data.value.generatedAt).toLocaleTimeString("es-DO", {
    hour: "2-digit",
    minute: "2-digit",
  });
});

const hasAnyUsage = computed(() =>
  Boolean(data.value?.leaderboard.length) ||
  days.value.some((day) => day.calls > 0),
);
</script>

<template>
  <div class="px-8">
    <div class="mx-auto max-w-6xl">
      <!-- Header -->
      <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900">
            Consumo de IA
          </h1>
          <p class="mt-1 text-sm text-gray-500">
            Tokens y costo por usuario en
            <span class="font-medium text-gray-700">{{ activeOrg?.name }}</span
            >.
            <span v-if="data" class="text-gray-400">
              Días calendario de {{ data.timezone }}.
            </span>
          </p>
        </div>

        <div v-if="isAdmin" class="flex flex-wrap items-center gap-3">
          <select
            v-model="clientFilter"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">Todos los clientes</option>
            <option
              v-for="client in data?.clients ?? []"
              :key="client.id"
              :value="client.id"
            >
              {{ client.name }}
            </option>
            <option v-if="data?.hasUnassignedClient" value="none">
              Sin cliente
            </option>
          </select>
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
        </div>
      </header>

      <!-- Not an admin -->
      <div
        v-if="!isAdmin || forbidden"
        class="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center"
      >
        <p class="text-sm font-medium text-gray-900">
          Esta sección es solo para administradores.
        </p>
        <p class="mt-1 text-sm text-gray-500">
          Pide acceso a un administrador de tu organización.
        </p>
      </div>

      <template v-else>
        <p
          v-if="errorMsg"
          class="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {{ errorMsg }}
        </p>

        <p
          v-if="data?.truncated"
          class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          El volumen de llamadas excede el máximo que esta vista agrega; los
          totales pueden estar incompletos.
        </p>

        <!-- Totals -->
        <section class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article
            class="rounded-xl border border-gray-200 bg-white p-5"
          >
            <p class="text-xs font-medium uppercase tracking-wide text-gray-500">
              Hoy
            </p>
            <p class="mt-2 text-2xl font-bold tabular-nums text-gray-900">
              {{ formatUsd(totals?.today.cost ?? 0) }}
            </p>
            <p class="mt-1 text-sm tabular-nums text-gray-500">
              {{ formatTokens(totals?.today.tokens ?? 0) }} tokens
            </p>
            <p
              v-if="todayVsYesterday !== null"
              class="mt-2 text-xs font-medium"
              :class="todayVsYesterday > 0 ? 'text-rose-600' : 'text-emerald-600'"
            >
              {{ formatPercentDelta(todayVsYesterday) }} vs ayer
            </p>
            <p v-else class="mt-2 text-xs text-gray-400">Sin consumo ayer</p>
          </article>

          <article class="rounded-xl border border-gray-200 bg-white p-5">
            <p class="text-xs font-medium uppercase tracking-wide text-gray-500">
              Últimos 7 días
            </p>
            <p class="mt-2 text-2xl font-bold tabular-nums text-gray-900">
              {{ formatUsd(totals?.last7.cost ?? 0) }}
            </p>
            <p class="mt-1 text-sm tabular-nums text-gray-500">
              {{ formatTokens(totals?.last7.tokens ?? 0) }} tokens
            </p>
            <p class="mt-2 text-xs text-gray-400">
              {{ formatUsd(last7DailyAverage) }} por día en promedio
            </p>
          </article>

          <article class="rounded-xl border border-gray-200 bg-white p-5">
            <p class="text-xs font-medium uppercase tracking-wide text-gray-500">
              Este mes
            </p>
            <p class="mt-2 text-2xl font-bold tabular-nums text-gray-900">
              {{ formatUsd(totals?.thisMonth.cost ?? 0) }}
            </p>
            <p class="mt-1 text-sm tabular-nums text-gray-500">
              {{ formatTokens(totals?.thisMonth.tokens ?? 0) }} tokens
            </p>
            <p
              v-if="monthVsLastMonth !== null"
              class="mt-2 text-xs font-medium"
              :class="monthVsLastMonth > 0 ? 'text-rose-600' : 'text-emerald-600'"
            >
              {{ formatPercentDelta(monthVsLastMonth) }} vs mes pasado
            </p>
            <p v-else class="mt-2 text-xs capitalize text-gray-400">
              {{ thisMonthLabel }}
            </p>
          </article>

          <article class="rounded-xl border border-gray-200 bg-white p-5">
            <p class="text-xs font-medium uppercase tracking-wide text-gray-500">
              Mes pasado
            </p>
            <p class="mt-2 text-2xl font-bold tabular-nums text-gray-900">
              {{ formatUsd(totals?.lastMonth.cost ?? 0) }}
            </p>
            <p class="mt-1 text-sm tabular-nums text-gray-500">
              {{ formatTokens(totals?.lastMonth.tokens ?? 0) }} tokens
            </p>
            <p class="mt-2 text-xs capitalize text-gray-400">
              {{ lastMonthLabel }}
            </p>
          </article>
        </section>

        <!-- Chart -->
        <section class="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 class="text-sm font-semibold text-gray-900">
                Gasto total por día
              </h2>
              <p class="mt-1 text-sm text-gray-500">
                <span class="font-medium tabular-nums text-gray-700">
                  {{
                    metric === "cost"
                      ? formatUsd(chartTotal.cost)
                      : formatTokens(chartTotal.tokens)
                  }}
                </span>
                en el rango ·
                {{ chartTotal.calls }} llamadas
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <div class="flex rounded-lg border border-gray-300 bg-white p-0.5">
                <button
                  v-for="option in CHART_RANGES"
                  :key="option.days"
                  type="button"
                  class="rounded-md px-2.5 py-1 text-xs font-medium transition"
                  :class="
                    chartRange === option.days
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-500 hover:text-gray-900'
                  "
                  @click="chartRange = option.days"
                >
                  {{ option.label }}
                </button>
              </div>
              <div class="flex rounded-lg border border-gray-300 bg-white p-0.5">
                <button
                  type="button"
                  class="rounded-md px-2.5 py-1 text-xs font-medium transition"
                  :class="
                    metric === 'cost'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-500 hover:text-gray-900'
                  "
                  @click="metric = 'cost'"
                >
                  US$
                </button>
                <button
                  type="button"
                  class="rounded-md px-2.5 py-1 text-xs font-medium transition"
                  :class="
                    metric === 'tokens'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-500 hover:text-gray-900'
                  "
                  @click="metric = 'tokens'"
                >
                  Tokens
                </button>
              </div>
            </div>
          </div>

          <SpendBarChart
            :points="chartPoints"
            :format-value="chartValueFormatter"
            :format-axis="chartAxisFormatter"
          />
        </section>

        <!-- Per-user ranking -->
        <section class="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div>
              <h2 class="text-sm font-semibold text-gray-900">
                Consumo por usuario
              </h2>
              <p class="mt-1 text-xs text-gray-500">
                Costo en US$ y tokens. Toca un encabezado para ordenar.
              </p>
            </div>
            <p v-if="lastUpdated" class="text-xs text-gray-400">
              Actualizado {{ lastUpdated }}
            </p>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead
                class="border-b border-gray-100 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                <tr>
                  <th class="px-5 py-3">Usuario</th>
                  <th
                    v-for="column in LEADERBOARD_COLUMNS"
                    :key="column.key"
                    class="px-4 py-3 text-right"
                  >
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 uppercase transition hover:text-gray-900"
                      :class="sortColumn === column.key ? 'text-emerald-700' : ''"
                      @click="sortColumn = column.key"
                    >
                      {{ column.label }}
                      <svg
                        v-if="sortColumn === column.key"
                        class="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2.5"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-if="loading && !sortedLeaderboard.length">
                  <td :colspan="LEADERBOARD_COLUMNS.length + 1" class="px-5 py-12 text-center">
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
                <tr v-else-if="!sortedLeaderboard.length">
                  <td
                    :colspan="LEADERBOARD_COLUMNS.length + 1"
                    class="px-5 py-12 text-center text-sm text-gray-400"
                  >
                    Todavía no hay consumo registrado en este rango.
                  </td>
                </tr>
                <tr
                  v-for="(row, index) in sortedLeaderboard"
                  :key="row.userId ?? `unknown-${index}`"
                  class="transition hover:bg-gray-50"
                >
                  <td class="px-5 py-3">
                    <div class="flex items-center gap-2.5">
                      <span
                        class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                        :class="
                          index === 0
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-200 text-gray-600'
                        "
                      >
                        {{ initialsFrom(actorName(row)) }}
                      </span>
                      <div class="min-w-0">
                        <p class="truncate font-medium text-gray-900">
                          {{ actorName(row) }}
                        </p>
                        <p
                          v-if="row.email && row.name"
                          class="truncate text-xs text-gray-400"
                        >
                          {{ row.email }}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td
                    v-for="column in LEADERBOARD_COLUMNS"
                    :key="column.key"
                    class="whitespace-nowrap px-4 py-3 text-right"
                  >
                    <p
                      class="font-medium tabular-nums"
                      :class="
                        row[column.key].cost > 0 ? 'text-gray-900' : 'text-gray-300'
                      "
                    >
                      {{
                        row[column.key].calls
                          ? formatUsd(row[column.key].cost)
                          : "—"
                      }}
                    </p>
                    <p
                      v-if="row[column.key].calls"
                      class="text-xs tabular-nums text-gray-400"
                    >
                      {{ formatTokens(row[column.key].tokens) }} tk
                    </p>
                  </td>
                </tr>
              </tbody>
              <tfoot
                v-if="sortedLeaderboard.length && totals"
                class="border-t border-gray-200 bg-gray-50 text-sm"
              >
                <tr>
                  <td class="px-5 py-3 font-semibold text-gray-900">Total equipo</td>
                  <td
                    v-for="column in LEADERBOARD_COLUMNS"
                    :key="column.key"
                    class="whitespace-nowrap px-4 py-3 text-right"
                  >
                    <p class="font-semibold tabular-nums text-gray-900">
                      {{
                        totals[column.key].calls
                          ? formatUsd(totals[column.key].cost)
                          : "—"
                      }}
                    </p>
                    <p
                      v-if="totals[column.key].calls"
                      class="text-xs tabular-nums text-gray-500"
                    >
                      {{ formatTokens(totals[column.key].tokens) }} tk
                    </p>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <!-- Per-day detail -->
        <section class="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div>
              <h2 class="text-sm font-semibold text-gray-900">Detalle por día</h2>
              <p class="mt-1 text-xs text-gray-500">
                Abre un día para ver el consumo de cada usuario.
              </p>
            </div>
            <select
              v-model="detailRange"
              class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            >
              <option
                v-for="option in DETAIL_RANGES"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead
                class="border-b border-gray-100 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                <tr>
                  <th class="px-5 py-3">Día</th>
                  <th class="px-4 py-3 text-right">Llamadas</th>
                  <th class="px-4 py-3 text-right">Tokens</th>
                  <th class="px-4 py-3 text-right">Costo</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-if="!detailDays.length">
                  <td colspan="4" class="px-5 py-12 text-center text-sm text-gray-400">
                    {{
                      hasAnyUsage
                        ? "Sin consumo en este rango."
                        : "Todavía no hay consumo registrado."
                    }}
                  </td>
                </tr>
                <template v-for="day in detailDays" :key="day.date">
                  <tr
                    class="cursor-pointer transition hover:bg-gray-50"
                    @click="toggleDay(day.date)"
                  >
                    <td class="px-5 py-3">
                      <div class="flex items-center gap-2">
                        <svg
                          class="h-3.5 w-3.5 flex-shrink-0 text-gray-400 transition"
                          :class="expandedDays[day.date] ? 'rotate-90' : ''"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                        <span class="font-medium capitalize text-gray-900">
                          {{ formatDayLong(day.date) }}
                        </span>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-right tabular-nums text-gray-600">
                      {{ day.calls }}
                    </td>
                    <td class="px-4 py-3 text-right tabular-nums text-gray-600">
                      {{ formatTokens(day.tokens) }}
                    </td>
                    <td class="px-4 py-3 text-right font-medium tabular-nums text-gray-900">
                      {{ formatUsd(day.cost) }}
                    </td>
                  </tr>
                  <tr
                    v-for="actor in expandedDays[day.date] ? day.byUser : []"
                    :key="`${day.date}-${actor.userId ?? 'unknown'}`"
                    class="bg-gray-50/60"
                  >
                    <td class="py-2 pl-12 pr-5 text-gray-600">
                      {{ actorName(actor) }}
                    </td>
                    <td class="px-4 py-2 text-right text-xs tabular-nums text-gray-500">
                      {{ actor.calls }}
                    </td>
                    <td class="px-4 py-2 text-right text-xs tabular-nums text-gray-500">
                      {{ formatTokens(actor.tokens) }}
                    </td>
                    <td class="px-4 py-2 text-right text-xs tabular-nums text-gray-600">
                      {{ formatUsd(actor.cost) }}
                    </td>
                  </tr>
                </template>
              </tbody>
              <tfoot
                v-if="detailDays.length"
                class="border-t border-gray-200 bg-gray-50 text-sm"
              >
                <tr>
                  <td class="px-5 py-3 font-semibold text-gray-900">Total</td>
                  <td class="px-4 py-3 text-right font-semibold tabular-nums text-gray-900">
                    {{ detailTotals.calls }}
                  </td>
                  <td class="px-4 py-3 text-right font-semibold tabular-nums text-gray-900">
                    {{ formatTokens(detailTotals.tokens) }}
                  </td>
                  <td class="px-4 py-3 text-right font-semibold tabular-nums text-gray-900">
                    {{ formatUsd(detailTotals.cost) }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>
