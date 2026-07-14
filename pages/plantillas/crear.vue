<script setup lang="ts">
import type { TemplateInput } from "~/composables/useTemplates";

const { create } = useTemplates();
const submitting = ref(false);
const error = ref<string | null>(null);

async function onSubmit(input: TemplateInput) {
  submitting.value = true;
  error.value = null;
  try {
    await create(input);
    await navigateTo("/plantillas");
  } catch (err: any) {
    error.value = err?.message || "No se pudo guardar la plantilla.";
    submitting.value = false;
  }
}
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
          Crear Plantilla
        </h1>
      </header>

      <p
        v-if="error"
        class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
      >
        {{ error }}
      </p>

      <TemplateForm :submitting="submitting" @submit="onSubmit" />
    </div>
  </div>
</template>
