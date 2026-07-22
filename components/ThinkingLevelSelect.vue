<script setup lang="ts">
const { thinkingLevel, options } = useThinkingLevel();
</script>

<template>
  <div class="flex flex-shrink-0 items-center gap-2">
    <label
      for="thinking-level"
      class="whitespace-nowrap text-sm font-medium text-gray-600"
    >
      Pensamiento
    </label>
    <select
      id="thinking-level"
      v-model="thinkingLevel"
      class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
    >
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
  </div>
</template>
