<script setup lang="ts">
import type { Template } from "~/composables/useTemplates";

const { list, remove } = useTemplates();

const templates = ref<Template[]>([]);
const pending = ref(true);
const error = ref<string | null>(null);
const deletingId = ref<string | null>(null);

async function load() {
  pending.value = true;
  error.value = null;
  try {
    templates.value = await list();
  } catch (err: any) {
    error.value = err?.message || "No se pudieron cargar las plantillas.";
  } finally {
    pending.value = false;
  }
}

function fieldCount(tpl: Template): number {
  return Array.isArray(tpl.fields) ? tpl.fields.length : 0;
}

async function onDelete(tpl: Template) {
  if (!window.confirm(`¿Eliminar la plantilla "${tpl.name}"?`)) return;
  deletingId.value = tpl.id;
  try {
    await remove(tpl.id);
    templates.value = templates.value.filter((t) => t.id !== tpl.id);
  } catch (err: any) {
    error.value = err?.message || "No se pudo eliminar la plantilla.";
  } finally {
    deletingId.value = null;
  }
}

onMounted(load);
</script>

<template>
  <div class="px-8 py-8">
    <div class="mx-auto max-w-4xl">
      <header class="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900">
            Plantillas
          </h1>
          <p class="mt-1 text-sm text-gray-500">
            Define cómo se exportan tus datos extraídos.
          </p>
        </div>
        <NuxtLink
          to="/plantillas/crear"
          class="flex-shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Crear plantilla
        </NuxtLink>
      </header>

      <p
        v-if="error"
        class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
      >
        {{ error }}
      </p>

      <!-- Loading -->
      <div
        v-if="pending"
        class="flex items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-20"
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

      <!-- Empty -->
      <div
        v-else-if="templates.length === 0"
        class="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-20 text-center"
      >
        <div
          class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400"
        >
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.8"
              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v3H4V5zm0 5h7v9H5a1 1 0 01-1-1v-8zm9 0h7v8a1 1 0 01-1 1h-6v-9z"
            />
          </svg>
        </div>
        <p class="text-sm font-medium text-gray-700">Sin plantillas todavía</p>
        <p class="mt-1 max-w-sm text-sm text-gray-400">
          Crea una plantilla para personalizar el formato de exportación.
        </p>
        <NuxtLink
          to="/plantillas/crear"
          class="mt-5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Crear plantilla
        </NuxtLink>
      </div>

      <!-- Table -->
      <div
        v-else
        class="overflow-hidden rounded-xl border border-gray-200 bg-white"
      >
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
              <th class="px-5 py-3 font-medium">Plantilla</th>
              <th class="w-28 px-5 py-3 font-medium">Campos</th>
              <th class="w-32 px-5 py-3 text-right font-medium">Acción</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="tpl in templates"
              :key="tpl.id"
              class="transition hover:bg-gray-50/60"
            >
              <td class="px-5 py-4">
                <NuxtLink
                  :to="`/plantillas/${tpl.id}`"
                  class="font-semibold text-emerald-700 hover:underline"
                >
                  {{ tpl.name }}
                </NuxtLink>
                <p
                  v-if="tpl.description"
                  class="mt-0.5 max-w-md truncate text-sm text-gray-500"
                >
                  {{ tpl.description }}
                </p>
              </td>
              <td class="px-5 py-4 text-gray-500">
                {{ fieldCount(tpl) }}
                {{ fieldCount(tpl) === 1 ? "campo" : "campos" }}
              </td>
              <td class="px-5 py-4">
                <div class="flex items-center justify-end gap-1">
                  <NuxtLink
                    :to="`/plantillas/${tpl.id}`"
                    class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                  >
                    <svg
                      class="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.8"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Editar
                  </NuxtLink>
                  <button
                    :disabled="deletingId === tpl.id"
                    @click="onDelete(tpl)"
                    class="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    title="Eliminar"
                  >
                    <svg
                      class="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.8"
                        d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v12a1 1 0 01-1 1H8a1 1 0 01-1-1V7"
                      />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
