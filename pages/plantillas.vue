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
        <button
          class="flex-shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          Nueva plantilla
        </button>
      </header>

      <div
        class="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-20 text-center"
      >
        <div
          class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400"
        >
          <svg
            class="h-6 w-6"
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
        </div>
        <p class="text-sm font-medium text-gray-700">Sin plantillas todavía</p>
        <p class="mt-1 max-w-sm text-sm text-gray-400">
          Crea una plantilla para personalizar el formato de exportación.
        </p>
      </div>
    </div>
  </div>
</template>
