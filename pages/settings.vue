<script setup lang="ts">
interface ModelInfo {
  id: string;
  label: string;
  description: string;
  provider: string;
  model: string | null;
  envVar: string;
}

const { data, pending, error } = await useFetch<{
  models: ModelInfo[];
  apiKeyConfigured: boolean;
}>("/api/settings/models");
</script>

<template>
  <div class="px-8 py-8">
    <div class="mx-auto max-w-4xl">
      <header class="mb-8">
        <h1 class="text-2xl font-bold tracking-tight text-gray-900">
          Configuración
        </h1>
        <p class="mt-1 text-sm text-gray-500">
          Modelos de inteligencia artificial que utiliza la aplicación.
        </p>
      </header>

      <section>
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-900">Modelos de IA</h2>
          <span
            v-if="data"
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            :class="
              data.apiKeyConfigured
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            "
          >
            <span
              class="h-1.5 w-1.5 rounded-full"
              :class="data.apiKeyConfigured ? 'bg-emerald-500' : 'bg-amber-500'"
            />
            {{ data.apiKeyConfigured ? "API key configurada" : "Falta API key" }}
          </span>
        </div>

        <p
          v-if="error"
          class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
        >
          No se pudo cargar la configuración de modelos.
        </p>

        <div
          v-if="pending"
          class="flex items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-16"
        >
          <svg
            class="h-6 w-6 animate-spin text-gray-300"
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
        </div>

        <div
          v-else-if="data"
          class="overflow-hidden rounded-xl border border-gray-200 bg-white"
        >
          <ul class="divide-y divide-gray-100">
            <li
              v-for="m in data.models"
              :key="m.id"
              class="flex items-start justify-between gap-4 px-5 py-4"
            >
              <div class="min-w-0">
                <p class="text-sm font-semibold text-gray-900">{{ m.label }}</p>
                <p class="mt-0.5 text-sm text-gray-500">{{ m.description }}</p>
                <p class="mt-1.5 text-xs text-gray-400">
                  {{ m.provider }} ·
                  <code class="rounded bg-gray-100 px-1 py-0.5 text-gray-500">{{
                    m.envVar
                  }}</code>
                </p>
              </div>
              <div class="flex-shrink-0 text-right">
                <span
                  v-if="m.model"
                  class="inline-flex items-center rounded-lg bg-gray-900 px-3 py-1.5 font-mono text-xs font-medium text-white"
                >
                  {{ m.model }}
                </span>
                <span
                  v-else
                  class="inline-flex items-center rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-400"
                >
                  Sin configurar
                </span>
              </div>
            </li>
          </ul>
        </div>

        <p class="mt-3 text-xs text-gray-400">
          Estos valores se configuran mediante variables de entorno en el
          servidor.
        </p>
      </section>
    </div>
  </div>
</template>
