<template>
  <div class="px-8 py-8">
    <div class="mx-auto max-w-4xl">
      <header class="mb-8">
        <h1 class="text-2xl font-bold tracking-tight text-gray-900">
          Documentos
        </h1>
        <p class="mt-1 text-sm text-gray-500">
          Historial de documentos procesados y exportados.
        </p>
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
              d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm7 0v5h5"
            />
          </svg>
        </div>
        <p class="text-sm font-medium text-gray-700">No hay documentos</p>
        <p class="mt-1 max-w-sm text-sm text-gray-400">
          Los documentos que proceses aparecerán aquí.
        </p>
        <NuxtLink
          to="/"
          class="mt-5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          Extraer documentos
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
