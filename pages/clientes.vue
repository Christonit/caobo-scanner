<template>
  <div class="px-8 py-8">
    <div class="mx-auto max-w-4xl">
      <header class="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900">
            Clientes
          </h1>
          <p class="mt-1 text-sm text-gray-500">
            Administra los clientes de tu organización.
          </p>
        </div>
        <button
          class="flex-shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          Nuevo cliente
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
              d="M17 20h5v-1a4 4 0 00-4-4h-1m-7 5H2v-1a4 4 0 014-4h4a4 4 0 014 4v1zm-3-9a3 3 0 11-6 0 3 3 0 016 0zm9-3a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <p class="text-sm font-medium text-gray-700">Aún no hay clientes</p>
        <p class="mt-1 max-w-sm text-sm text-gray-400">
          Crea tu primer cliente para empezar a organizar sus documentos.
        </p>
      </div>
    </div>
  </div>
</template>
