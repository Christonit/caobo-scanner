<script setup lang="ts">
// Daily totals bar chart. The project has no charting dependency, so this is a
// flexbox chart: bars scale by percentage height, which stays responsive
// without measuring the container or shipping an SVG layout engine.
import type { SpendBarPoint } from "~/types/spend";

const props = withDefaults(
  defineProps<{
    points: SpendBarPoint[];
    formatValue: (value: number) => string;
    formatAxis?: (value: number) => string;
    emptyLabel?: string;
    /** Roughly how many x-axis labels to render before thinning them out. */
    maxLabels?: number;
  }>(),
  {
    emptyLabel: "Sin consumo en este rango.",
    maxLabels: 8,
  },
);

const axisFormatter = computed(
  () => props.formatAxis ?? props.formatValue,
);

const maxValue = computed(() =>
  props.points.reduce((max, p) => Math.max(max, p.value || 0), 0),
);

const hasData = computed(() => maxValue.value > 0);

/** Non-zero days keep a 2% floor so a tiny value is still visible. */
function barHeight(value: number): string {
  if (!hasData.value || value <= 0) return "0%";
  const pct = (value / maxValue.value) * 100;
  return `${Math.max(pct, 2)}%`;
}

const labelStep = computed(() =>
  Math.max(1, Math.ceil(props.points.length / props.maxLabels)),
);

// Labels are anchored to the last point so "hoy" is always labelled.
function showsLabel(index: number): boolean {
  const fromEnd = props.points.length - 1 - index;
  return fromEnd % labelStep.value === 0;
}

/** Keeps tooltips of edge bars from overflowing the card. */
function tooltipAlign(index: number): string {
  if (props.points.length < 6) return "left-1/2 -translate-x-1/2";
  if (index <= 1) return "left-0";
  if (index >= props.points.length - 2) return "right-0";
  return "left-1/2 -translate-x-1/2";
}
</script>

<template>
  <div>
    <div class="flex gap-3">
      <!-- Y axis -->
      <div
        class="flex h-56 w-14 flex-shrink-0 flex-col justify-between text-right text-[11px] tabular-nums text-gray-400"
      >
        <span>{{ hasData ? axisFormatter(maxValue) : "" }}</span>
        <span>{{ hasData ? axisFormatter(maxValue / 2) : "" }}</span>
        <span>{{ hasData ? axisFormatter(0) : "" }}</span>
      </div>

      <!-- Plot -->
      <div class="relative min-w-0 flex-1">
        <div class="pointer-events-none absolute inset-0 flex flex-col justify-between">
          <div class="border-t border-dashed border-gray-200" />
          <div class="border-t border-dashed border-gray-200" />
          <div class="border-t border-gray-200" />
        </div>

        <div class="relative flex h-56 items-end gap-[2px] sm:gap-1">
          <div
            v-for="(point, index) in points"
            :key="point.key"
            class="group relative flex h-full flex-1 items-end"
          >
            <!-- Bar (or a flat tick for a day with no consumption) -->
            <div
              v-if="point.value > 0"
              class="w-full rounded-t bg-emerald-500 transition group-hover:bg-emerald-600"
              :style="{ height: barHeight(point.value) }"
            />
            <div v-else class="h-[2px] w-full rounded-t bg-gray-200" />

            <!-- Hover tooltip -->
            <div
              class="pointer-events-none absolute bottom-full z-20 mb-2 hidden whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-left shadow-lg group-hover:block"
              :class="tooltipAlign(index)"
            >
              <p class="text-[11px] font-medium text-gray-300">
                {{ point.tooltipLabel ?? point.label }}
              </p>
              <p class="text-sm font-semibold text-white tabular-nums">
                {{ formatValue(point.value) }}
              </p>
              <p v-if="point.caption" class="text-[11px] text-gray-400">
                {{ point.caption }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- X axis -->
    <div class="mt-2 flex gap-3">
      <div class="w-14 flex-shrink-0" />
      <div class="flex min-w-0 flex-1 gap-[2px] sm:gap-1">
        <div
          v-for="(point, index) in points"
          :key="point.key"
          class="min-w-0 flex-1 text-center text-[10px] text-gray-400"
        >
          <span v-if="showsLabel(index)" class="truncate">{{ point.label }}</span>
        </div>
      </div>
    </div>

    <p v-if="!hasData" class="mt-3 text-center text-sm text-gray-400">
      {{ emptyLabel }}
    </p>
  </div>
</template>
