<script setup lang="ts">
import type { Template, TemplateInput } from "~/composables/useTemplates";

const route = useRoute();
const id = computed(() => route.params.id as string);

const { get, update } = useTemplates();

const template = ref<Template | null>(null);
const pending = ref(true);
const notFound = ref(false);
const submitting = ref(false);
const error = ref<string | null>(null);

async function load() {
  pending.value = true;
  notFound.value = false;
  try {
    const tpl = await get(id.value);
    if (!tpl) {
      notFound.value = true;
    } else {
      template.value = tpl;
    }
  } catch (err: any) {
    error.value = err?.message || "No se pudo cargar la plantilla.";
  } finally {
    pending.value = false;
  }
}

async function onSubmit(input: TemplateInput) {
  submitting.value = true;
  error.value = null;
  try {
    await update(id.value, input);
    await navigateTo("/plantillas");
  } catch (err: any) {
    error.value = err?.message || "No se pudo guardar la plantilla.";
    submitting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="px-8 py-8">
    <div class="mx-auto max-w-6xl">
      <header class="mb-8">
        <NuxtLink
          to="/plantillas"
          class="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-800"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.8"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Plantillas
        </NuxtLink>
        <h1 class="text-2xl font-bold tracking-tight text-gray-900">
          Editar Plantilla
        </h1>
      </header>

      <p
        v-if="error"
        class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
      >
        {{ error }}
      </p>

      <div
        v-if="pending"
        class="flex items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-20"
      >
        <svg class="h-6 w-6 animate-spin text-gray-300" fill="none" viewBox="0 0 24 24">
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
        v-else-if="notFound"
        class="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center"
      >
        <p class="text-sm font-medium text-gray-700">Plantilla no encontrada</p>
        <NuxtLink
          to="/plantillas"
          class="mt-4 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          Volver a Plantillas
        </NuxtLink>
      </div>

      <TemplateForm
        v-else
        :template="template"
        :submitting="submitting"
        @submit="onSubmit"
      />
    </div>
  </div>
</template>
