<template>
  <div
    class="mx-auto flex w-full gap-8 px-8"
    :class="{
      'max-w-6xl': files.length == 0,
    }"
  >
    <!-- Main column -->
    <div class="min-w-0 flex-1">
      <!-- Header -->
      <header class="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900">
            Extraer información
          </h1>
          <p class="mt-1 text-sm text-gray-500">
            Sube documentos para extraer su información automáticamente. Soporta
            PDF, PNG y JPG.
          </p>
        </div>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener"
          class="hidden flex-shrink-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:flex"
        >
          <svg
            class="h-4 w-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Saber más
        </a>
      </header>

      <!-- Client + ERP catalog selection (mandatory before scanning) -->
      <section
        v-if="!showFullTableColumns"
        class="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Cliente</h2>
            <p class="mt-0.5 text-sm text-gray-500">
              Selecciona el cliente y los documentos de ERP que se usarán para
              clasificar Concepto Id y Tipo de Pago Id.
            </p>
          </div>
          <span
            v-if="canScan"
            class="flex-shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"
          >
            Listo para escanear
          </span>
          <span
            v-else
            class="flex-shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700"
          >
            Selección requerida
          </span>
        </div>

        <p
          v-if="clientsError"
          class="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {{ clientsError }}
        </p>

        <div class="grid gap-4 sm:grid-cols-3">
          <div>
            <label
              for="client-select"
              class="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Cliente <span class="text-rose-500">*</span>
            </label>
            <select
              id="client-select"
              v-model="selectedClientId"
              @change="onClientChange"
              :disabled="clientsLoading"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
            >
              <option value="">
                {{ clientsLoading ? "Cargando…" : "Selecciona un cliente" }}
              </option>
              <option
                v-for="client in clients"
                :key="client.id"
                :value="client.id"
              >
                {{ client.name }}
              </option>
            </select>
            <p
              v-if="!clientsLoading && clients.length === 0"
              class="mt-1.5 text-xs text-gray-400"
            >
              No hay clientes.
              <NuxtLink to="/clientes" class="text-emerald-700 hover:underline"
                >Crea uno primero</NuxtLink
              >.
            </p>
          </div>

          <div>
            <label
              for="concepto-doc-select"
              class="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Documento para Concepto Id <span class="text-rose-500">*</span>
            </label>
            <select
              id="concepto-doc-select"
              v-model="selectedConceptoDocId"
              :disabled="!selectedClientId || clientDocumentsLoading"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
            >
              <option value="">
                {{
                  clientDocumentsLoading
                    ? "Cargando…"
                    : "Selecciona un documento"
                }}
              </option>
              <option
                v-for="doc in clientDocuments"
                :key="doc.id"
                :value="doc.id"
              >
                {{ doc.document_name }} ({{ doc.document_attributes.length }}
                atributos)
              </option>
            </select>
            <p
              v-if="
                selectedClientId &&
                !clientDocumentsLoading &&
                clientDocuments.length === 0
              "
              class="mt-1.5 text-xs text-gray-400"
            >
              Este cliente no tiene documentos.
              <NuxtLink
                :to="`/clientes/${selectedClientId}`"
                class="text-emerald-700 hover:underline"
                >Crea uno primero</NuxtLink
              >.
            </p>
          </div>

          <div>
            <label
              for="tipo-de-pago-doc-select"
              class="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Documento para Tipo de Pago Id
              <span class="text-rose-500">*</span>
            </label>
            <select
              id="tipo-de-pago-doc-select"
              v-model="selectedTipoDePagoDocId"
              :disabled="!selectedClientId || clientDocumentsLoading"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
            >
              <option value="">
                {{
                  clientDocumentsLoading
                    ? "Cargando…"
                    : "Selecciona un documento"
                }}
              </option>
              <option
                v-for="doc in clientDocuments"
                :key="doc.id"
                :value="doc.id"
              >
                {{ doc.document_name }} ({{ doc.document_attributes.length }}
                atributos)
              </option>
            </select>
          </div>
        </div>

        <div class="mt-4 border-t border-gray-100 pt-4">
          <label
            for="tipo-de-gasto-context-doc-select"
            class="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Documento de contexto para Tipo de Gasto
            <span class="font-normal text-gray-400">(opcional)</span>
          </label>
          <select
            id="tipo-de-gasto-context-doc-select"
            v-model="selectedTipoDeGastoContextDocId"
            :disabled="!selectedClientId || clientDocumentsLoading"
            class="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
          >
            <option value="">
              {{
                clientDocumentsLoading ? "Cargando…" : "Sin contexto adicional"
              }}
            </option>
            <option
              v-for="doc in clientDocuments"
              :key="doc.id"
              :value="doc.id"
            >
              {{ doc.document_name }} ({{ doc.document_attributes.length }}
              atributos)
            </option>
          </select>
          <p class="mt-1.5 text-xs text-gray-400">
            El "Tipo de Gasto" siempre se elige entre las 11 opciones fijas de
            la app. Si seleccionas un documento aquí, sus atributos y comentario
            se envían a la IA solo como contexto para ayudarla a elegir mejor
            entre esas 11 opciones para este cliente.
          </p>
        </div>

        <p
          v-if="!canScan"
          class="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800"
        >
          <svg
            class="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Selecciona un cliente y sus documentos de Concepto Id / Tipo de Pago
          Id antes de subir o procesar archivos.
        </p>
      </section>

      <!-- Add files card -->
      <section
        v-if="!showFullTableColumns"
        class="rounded-xl border border-gray-200 bg-white shadow-sm"
        :class="{ 'pointer-events-none opacity-50': !canScan }"
      >
        <button
          type="button"
          @click="addFilesOpen = !addFilesOpen"
          class="flex w-full items-center justify-between px-5 py-4"
        >
          <span class="text-base font-semibold text-gray-900"
            >Agregar archivos</span
          >
          <svg
            class="h-4 w-4 text-gray-500 transition-transform"
            :class="{ '-rotate-180': !addFilesOpen }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 15l7-7 7 7"
            />
          </svg>
        </button>

        <div v-show="addFilesOpen" class="px-5 pb-5">
          <!-- Warning banner -->
          <!-- <div
            class="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800"
          >
            <svg
              class="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Si subes un PDF, asegúrate de poder seleccionar/resaltar el texto.
          </div> -->

          <!-- Drag & drop -->
          <div
            class="group cursor-pointer rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/60 px-6 py-12 text-center transition hover:border-emerald-400 hover:bg-emerald-50/40"
            @drop="handleDrop"
            @dragover.prevent
            @dragenter.prevent
            @click="canScan && fileInput?.click()"
          >
            <input
              ref="fileInput"
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg"
              :disabled="!canScan"
              @change="handleFileSelect"
              class="hidden"
            />
            <div
              class="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition group-hover:bg-emerald-100 group-hover:text-emerald-600"
            >
              <svg
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <p class="text-sm font-medium text-gray-700">
              Arrastra y suelta archivos aquí, o haz clic para seleccionar
            </p>
            <p class="mt-1 text-xs text-gray-400">
              Tipos soportados: pdf, png, jpg, jpeg · Máx
              {{ MAX_FILE_SIZE_LABEL }} por archivo · los PDF se dividen en una
              fila por página
            </p>
            <p
              v-if="splittingPdfs > 0"
              class="mt-3 flex items-center justify-center gap-2 text-sm text-emerald-600"
            >
              <svg
                class="h-4 w-4 animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke-width="3"
                  stroke-opacity="0.25"
                />
                <path
                  stroke-linecap="round"
                  stroke-width="3"
                  d="M22 12a10 10 0 00-10-10"
                />
              </svg>
              Dividiendo {{ splittingPdfs }} PDF{{
                splittingPdfs === 1 ? "" : "s"
              }}
              en páginas...
            </p>
          </div>
        </div>
      </section>

      <!-- Rate limit / cooldown banner -->
      <div
        v-if="batchLimit.isLimited.value || individualLimit.isLimited.value"
        class="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700"
      >
        <svg
          class="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div class="flex-1 space-y-1.5 text-sm">
          <p v-if="batchLimit.isLimited.value">
            <span class="font-semibold">Procesar</span> en enfriamiento ({{
              batchLimit.used.value
            }}
            / {{ BATCH_RPM }} por minuto) — reintenta en
            <span class="font-mono font-bold">{{ batchLimit.label.value }}</span
            >.
          </p>
          <p v-if="individualLimit.isLimited.value">
            <span class="font-semibold">Reintentar / Reevaluar</span> en
            enfriamiento ({{ individualLimit.used.value }} /
            {{ INDIVIDUAL_RPM }} por minuto) — reintenta en
            <span class="font-mono font-bold">{{
              individualLimit.label.value
            }}</span
            >.
          </p>
        </div>
      </div>

      <!-- Scanned information table -->
      <section v-if="files.length > 0" class="mt-10">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-3">
            <h2 class="text-base font-semibold text-gray-900">
              Información escaneada
            </h2>
            <div
              class="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
            >
              <button
                type="button"
                class="rounded-md px-3 py-1 text-xs font-semibold transition"
                :class="
                  tableView === 'active'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                "
                @click="tableView = 'active'"
              >
                Activos
                <span
                  class="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500"
                  >{{ activeFiles.length }}</span
                >
              </button>
              <button
                type="button"
                class="rounded-md px-3 py-1 text-xs font-semibold transition"
                :class="
                  tableView === 'review_later'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                "
                @click="tableView = 'review_later'"
              >
                Revisar más tarde
                <span
                  class="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  :class="
                    reviewLaterFiles.length
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-gray-100 text-gray-500'
                  "
                  >{{ reviewLaterFiles.length }}</span
                >
              </button>
            </div>
          </div>
          <div class="relative">
            <svg
              class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
              />
            </svg>
            <input
              v-model="search"
              type="text"
              placeholder="Buscar..."
              class="w-56 rounded-lg border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            />
          </div>
        </div>

        <p
          v-if="tableView === 'review_later'"
          class="mb-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-800"
        >
          Estas filas no se incluyen en el Excel de salida. Úsalas para corregir
          errores que Citrus detecta al subir y vuelve a
          <strong>Incluir</strong> cuando estén listas.
        </p>

        <!-- Bulk selection toolbar -->
        <div
          v-if="selectedCount > 0"
          class="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5"
        >
          <p class="text-sm font-medium text-emerald-900">
            {{ selectedCount }} fila{{
              selectedCount === 1 ? "" : "s"
            }}
            seleccionada{{ selectedCount === 1 ? "" : "s" }}
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <button
              v-if="tableView === 'active'"
              type="button"
              class="rounded-lg bg-violet-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-800"
              @click="deferSelectedForLater"
            >
              Excluir y revisar más tarde
            </button>
            <button
              v-else
              type="button"
              class="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
              @click="restoreSelectedFromLater"
            >
              Incluir de nuevo
            </button>
            <button
              type="button"
              class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              @click="clearSelection"
            >
              Limpiar selección
            </button>
          </div>
        </div>

        <div
          class="max-h-[70vh] rounded-xl border border-gray-200 bg-white shadow-sm overflow-auto"
        >
          <table class="w-full">
            <thead
              class="border-b border-slate-300 bg-gray-50 sticky top-0 z-50"
            >
              <tr>
                <th class="w-10 px-3 py-3 text-center sticky left-0 bg-gray-50">
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    :checked="allVisibleSelected"
                    :indeterminate.prop="
                      someVisibleSelected && !allVisibleSelected
                    "
                    :disabled="filteredFiles.length === 0"
                    :title="
                      allVisibleSelected
                        ? 'Deseleccionar todas'
                        : 'Seleccionar todas'
                    "
                    @change="toggleSelectAllVisible"
                  />
                </th>
                <th
                  v-for="col in columns"
                  :key="col"
                  class="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                  :class="`
              ${col == 'Status' ? 'w-12 mr-auto' : ''}
                   ${
                     col === 'Preview w-24' ||
                     col === 'Acciones w-24 text-center'
                       ? 'text-center'
                       : ''
                   }`"
                >
                  {{ col }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-if="filteredFiles.length === 0" class="bg-white">
                <td
                  :colspan="columns.length + 1"
                  class="px-4 py-8 text-center text-sm text-gray-400"
                >
                  {{
                    tableView === "review_later"
                      ? "No hay filas marcadas para revisar más tarde."
                      : search.trim()
                        ? "Ninguna fila coincide con la búsqueda."
                        : "No hay filas activas."
                  }}
                </td>
              </tr>
              <tr
                v-for="(file, index) in filteredFiles"
                :key="file.id"
                class="cursor-pointer transition-colors hover:bg-gray-50"
                :class="{
                  'bg-amber-50': isEdited(file),
                  'bg-slate-100': isSelected(file.id),
                }"
                @click="onRowClick($event, file.id)"
              >
                <td
                  :class="`px-3 py-2.5 text-center sticky left-0 hover:bg-gray-50 ${isSelected(file.id) ? 'bg-slate-100' : 'bg-white'}`"
                >
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    :checked="isSelected(file.id)"
                    @change="toggleSelect(file.id)"
                  />
                </td>
                <td v-if="showFullTableColumns" class="px-4 py-2.5">
                  <span class="text-sm text-gray-500">{{ index + 1 }}</span>
                </td>
                <!-- Documento -->
                <td v-if="showFullTableColumns" class="px-2 py-2.5 w-32">
                  <input
                    type="text"
                    inputmode="numeric"
                    :value="file.editableData.documento"
                    @focus="startEditing(file)"
                    @input="
                      file.editableData.documento = String(
                        $event.target.value || '',
                      ).replace(/\D/g, '')
                    "
                    class="w-28 rounded border border-transparent bg-transparent px-2 py-1 font-mono text-sm text-slate-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                    placeholder="-"
                  />
                </td>

                <!-- Status -->
                <td class="px-2 py-2.5 w-12 mr-auto">
                  <span
                    v-if="file.reviewLater"
                    class="inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700"
                    title="Excluida del Excel — revisar más tarde"
                  >
                    Revisar más tarde
                  </span>
                  <span
                    v-else
                    class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    :class="getStatusClasses(file.status)"
                    :title="
                      file.status === 'duplicate'
                        ? file.duplicateMessage
                        : undefined
                    "
                  >
                    {{ getStatusLabel(file.status) }}
                  </span>
                </td>
                <!-- Score -->
                <td v-if="showFullTableColumns" class="px-2 py-2.5 text-center">
                  <span
                    v-if="file.score > 0"
                    class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold mx-auto"
                    :class="getScoreClasses(file.score)"
                  >
                    {{ file.score }}
                  </span>
                  <span v-else class="text-gray-300">-</span>
                </td>

                <!-- Nombre -->
                <td v-if="showFullTableColumns" class="px-2 py-2.5 w-52 block">
                  <input
                    type="text"
                    v-model="file.editableData.nombre"
                    maxlength="255"
                    @focus="startEditing(file)"
                    class="w-full rounded border border-transparent bg-transparent px-2 py-1 text-sm text-slate-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 text-ellipsis"
                    placeholder="-"
                  />
                </td>

                <!-- NCF -->
                <td v-if="showFullTableColumns" class="px-2 py-2.5">
                  <input
                    type="text"
                    v-model="file.editableData.ncf"
                    @focus="startEditing(file)"
                    @blur="
                      file.editableData.ncf = normalizeNcf(
                        file.editableData.ncf,
                      )
                    "
                    class="w-36 rounded border border-transparent bg-transparent px-2 py-1 font-mono text-sm text-slate-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                    placeholder="-"
                  />
                </td>
                <!-- Tipo de Suplidor -->
                <td v-if="showFullTableColumns" class="px-2 py-2.5">
                  <select
                    v-model="file.editableData.tipo_de_suplidor"
                    @focus="startEditing(file)"
                    class="w-36 rounded border border-transparent bg-transparent px-1 py-1 text-sm text-slate-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  >
                    <option value="">-</option>
                    <option
                      v-if="
                        file.editableData.tipo_de_suplidor &&
                        !TIPO_DE_SUPLIDOR_OPTIONS.includes(
                          file.editableData.tipo_de_suplidor,
                        )
                      "
                      :value="file.editableData.tipo_de_suplidor"
                    >
                      {{ file.editableData.tipo_de_suplidor }}
                    </option>
                    <option
                      v-for="opt in TIPO_DE_SUPLIDOR_OPTIONS"
                      :key="opt"
                      :value="opt"
                    >
                      {{ opt }}
                    </option>
                  </select>
                </td>
                <!-- Tipo de Gasto -->
                <td v-if="showFullTableColumns" class="px-2 py-2.5">
                  <select
                    v-model="file.editableData.tipo_de_gasto"
                    @focus="startEditing(file)"
                    class="w-64 rounded border border-transparent bg-transparent px-1 py-1 text-sm text-slate-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 text-ellipsis"
                  >
                    <option value="">-</option>
                    <option
                      v-if="
                        file.editableData.tipo_de_gasto &&
                        !TIPO_DE_GASTO_OPTIONS.includes(
                          file.editableData.tipo_de_gasto,
                        )
                      "
                      :value="file.editableData.tipo_de_gasto"
                    >
                      {{ file.editableData.tipo_de_gasto }}
                    </option>
                    <option
                      v-for="opt in TIPO_DE_GASTO_OPTIONS"
                      :key="opt"
                      :value="opt"
                    >
                      {{ opt }}
                    </option>
                  </select>
                </td>
                <!-- Descripción -->
                <td v-if="showFullTableColumns" class="px-2 py-2.5">
                  <button
                    type="button"
                    class="group relative flex w-36 items-center rounded border border-transparent bg-transparent px-2 py-1 text-left text-sm text-slate-600 transition-colors hover:border-emerald-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                    :title="
                      file.editableData.descripcion || 'Editar descripción'
                    "
                    @click="openDescripcionEditor(file)"
                  >
                    <span
                      class="min-w-0 flex-1 truncate pr-5"
                      :class="
                        file.editableData.descripcion
                          ? 'text-slate-600'
                          : 'text-gray-400'
                      "
                      >{{ file.editableData.descripcion || "-" }}</span
                    >
                    <span
                      class="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-500 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100"
                      aria-hidden="true"
                    >
                      <svg
                        class="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
                        />
                      </svg>
                    </span>
                  </button>
                </td>
                <!-- Fecha -->
                <td v-if="showFullTableColumns" class="px-2 py-2.5">
                  <input
                    type="text"
                    v-model="file.editableData.fecha"
                    @focus="startEditing(file)"
                    @blur="
                      file.editableData.fecha = normalizeFecha(
                        file.editableData.fecha,
                      )
                    "
                    class="w-24 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-slate-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                    placeholder="DD/MM/AAAA"
                  />
                </td>
                <!-- Monto en Servicios -->
                <td v-if="showFullTableColumns" class="px-2 py-2.5">
                  <div class="flex items-center">
                    <span class="mr-1 text-sm text-gray-400">$</span>
                    <input
                      type="text"
                      inputmode="decimal"
                      v-model="file.editableData.monto_en_servicios"
                      @focus="startEditing(file)"
                      class="w-20 rounded border border-transparent bg-transparent px-2 py-1 font-mono text-sm text-gray-700 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                      placeholder="0"
                    />
                  </div>
                </td>
                <!-- Monto en Bienes -->
                <td v-if="showFullTableColumns" class="px-2 py-2.5">
                  <div class="flex items-center">
                    <span class="mr-1 text-sm text-gray-400">$</span>
                    <input
                      type="text"
                      inputmode="decimal"
                      v-model="file.editableData.monto_en_bienes"
                      @focus="startEditing(file)"
                      class="w-20 rounded border border-transparent bg-transparent px-2 py-1 font-mono text-sm text-gray-700 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                      placeholder="0"
                    />
                  </div>
                </td>
                <!-- ITBIS -->
                <td v-if="showFullTableColumns" class="px-2 py-2.5">
                  <div class="flex items-center">
                    <span class="mr-1 text-sm text-gray-400">$</span>
                    <input
                      type="text"
                      v-model="file.editableData.itbis"
                      @focus="startEditing(file)"
                      class="w-20 rounded border border-transparent bg-transparent px-2 py-1 font-mono text-sm text-slate-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                      placeholder="-"
                    />
                  </div>
                </td>
                <!-- Selectivo -->
                <td v-if="showFullTableColumns" class="px-2 py-2.5">
                  <div class="flex items-center">
                    <span class="mr-1 text-sm text-gray-400">$</span>
                    <input
                      type="text"
                      v-model="file.editableData.selectivo"
                      @focus="startEditing(file)"
                      class="w-20 rounded border border-transparent bg-transparent px-2 py-1 font-mono text-sm text-slate-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                      placeholder="-"
                    />
                  </div>
                </td>
                <!-- Moneda -->
                <td v-if="showFullTableColumns" class="px-2 py-2.5">
                  <input
                    type="text"
                    v-model="file.editableData.moneda"
                    @focus="startEditing(file)"
                    class="w-20 rounded border border-transparent bg-transparent px-2 py-1 font-mono text-sm uppercase text-slate-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                    placeholder="-"
                  />
                </td>
                <!-- Forma de Pago -->
                <td v-if="showFullTableColumns" class="px-2 py-2.5">
                  <input
                    type="text"
                    v-model="file.editableData.metodo_de_pago"
                    @focus="startEditing(file)"
                    class="w-40 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-slate-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                    placeholder="-"
                  />
                </td>
                <!-- Concepto Id -->
                <td v-if="showFullTableColumns" class="px-2 py-2.5">
                  <select
                    v-model="file.editableData.concepto_id"
                    @focus="startEditing(file)"
                    class="w-48 rounded border border-transparent bg-transparent px-1 py-1 text-sm text-slate-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  >
                    <option :value="null">-</option>
                    <option
                      v-if="
                        file.editableData.concepto_id !== null &&
                        !conceptoOptions.some(
                          (o) =>
                            o.document_id === file.editableData.concepto_id,
                        )
                      "
                      :value="file.editableData.concepto_id"
                    >
                      Id {{ file.editableData.concepto_id }} (fuera de catálogo)
                    </option>
                    <option
                      v-for="opt in conceptoOptions"
                      :key="opt.id"
                      :value="opt.document_id"
                    >
                      {{ opt.document_type }} ({{ opt.document_id }})
                    </option>
                  </select>
                </td>
                <!-- Tipo de Pago Id -->
                <td v-if="showFullTableColumns" class="px-2 py-2.5">
                  <select
                    v-model="file.editableData.tipo_de_pago_id"
                    @focus="startEditing(file)"
                    class="w-48 rounded border border-transparent bg-transparent px-1 py-1 text-sm text-slate-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  >
                    <option :value="null">-</option>
                    <option
                      v-if="
                        file.editableData.tipo_de_pago_id !== null &&
                        !tipoDePagoOptions.some(
                          (o) =>
                            o.document_id === file.editableData.tipo_de_pago_id,
                        )
                      "
                      :value="file.editableData.tipo_de_pago_id"
                    >
                      Id {{ file.editableData.tipo_de_pago_id }} (fuera de
                      catálogo)
                    </option>
                    <option
                      v-for="opt in tipoDePagoOptions"
                      :key="opt.id"
                      :value="opt.document_id"
                    >
                      {{ opt.document_type }} ({{ opt.document_id }})
                    </option>
                  </select>
                </td>
                <!-- NCF Afectado -->
                <td v-if="showFullTableColumns" class="px-2 py-2.5">
                  <input
                    type="text"
                    v-model="file.editableData.ncf_afectado"
                    maxlength="11"
                    @focus="startEditing(file)"
                    @blur="
                      file.editableData.ncf_afectado = normalizeNcf(
                        file.editableData.ncf_afectado,
                      ).slice(0, 11)
                    "
                    class="w-28 rounded border border-transparent bg-transparent px-2 py-1 font-mono text-sm text-slate-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                    :class="{
                      'ring-1 ring-amber-400':
                        requiresNcfAfectado(file.editableData.ncf) &&
                        !file.editableData.ncf_afectado,
                    }"
                    placeholder="-"
                    :title="
                      requiresNcfAfectado(file.editableData.ncf)
                        ? 'Obligatorio cuando NCF es B03 o B04'
                        : ''
                    "
                  />
                </td>
                <!-- Nombre del archivo -->
                <td class="px-2 py-2.5">
                  <input
                    type="text"
                    v-model="file.editableData.filename"
                    @focus="startEditing(file)"
                    class="w-44 rounded border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  />
                </td>
                <!-- Preview Button -->
                <td class="px-2 py-2.5 text-center w-24">
                  <button
                    @click="openPreview(file)"
                    class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                    title="Vista previa"
                  >
                    <svg
                      class="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  </button>
                </td>
                <!-- Actions -->
                <td class="px-2 py-2.5 text-center w-24">
                  <div class="flex items-center justify-center gap-1.5">
                    <button
                      v-if="
                        file.status === 'needs_retry' || file.status === 'error'
                      "
                      @click="retryFile(file)"
                      :disabled="individualLimit.isLimited.value"
                      class="rounded-lg p-2 text-emerald-600 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                      :title="
                        individualLimit.isLimited.value
                          ? `Límite alcanzado - espera ${individualLimit.label.value}`
                          : 'Reintentar procesamiento'
                      "
                    >
                      <svg
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                    <button
                      v-if="
                        file.status === 'done' &&
                        file.score > 0 &&
                        file.score < 3
                      "
                      @click="reevaluateFile(file)"
                      :disabled="individualLimit.isLimited.value"
                      class="rounded-lg p-2 text-purple-600 transition-colors hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-40"
                      :title="
                        individualLimit.isLimited.value
                          ? `Límite alcanzado - espera ${individualLimit.label.value}`
                          : 'Reevaluar (baja confianza)'
                      "
                    >
                      <svg
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                      </svg>
                    </button>
                    <button
                      v-if="isEdited(file)"
                      @click="revertFile(file)"
                      class="rounded-lg p-2 text-amber-600 transition-colors hover:bg-amber-50"
                      title="Revertir cambios"
                    >
                      <svg
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                        />
                      </svg>
                    </button>
                    <button
                      v-if="!file.reviewLater"
                      @click="deferFileForLater(file)"
                      class="rounded-lg p-2 text-violet-600 transition-colors hover:bg-violet-50"
                      title="Excluir y revisar más tarde"
                    >
                      <svg
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </button>
                    <button
                      v-else
                      @click="restoreFileFromLater(file)"
                      class="rounded-lg p-2 text-emerald-600 transition-colors hover:bg-emerald-50"
                      title="Incluir de nuevo en el export"
                    >
                      <svg
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                        />
                      </svg>
                    </button>
                    <button
                      @click="removeFile(file)"
                      class="rounded-lg p-2 text-rose-500 transition-colors hover:bg-rose-50"
                      title="Eliminar"
                    >
                      <svg
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- Data sources side panel -->
    <aside v-if="files.length > 0" class="hidden w-72 flex-shrink-0 lg:block">
      <div
        class="sticky top-8 max-h-[calc(100vh-4rem)] space-y-4 overflow-y-auto pb-4"
      >
        <h2 class="text-sm font-semibold text-gray-900">Data sources</h2>

        <div class="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div
            class="flex items-center justify-between px-4 py-3 text-sm text-gray-700"
          >
            <span class="flex items-center gap-2">
              <svg
                class="h-4 w-4 text-gray-400"
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
              {{ sourceDocuments.length }}
              {{ sourceDocuments.length === 1 ? "Archivo" : "Archivos" }}
            </span>
            <span class="font-medium text-gray-500">{{
              formatBytes(totalSourceSize)
            }}</span>
          </div>
          <div
            class="flex items-center gap-2 border-t border-gray-100 px-4 py-3 text-sm text-gray-700"
          >
            <svg
              class="h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
                d="M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c2.5-2.5 2.5-15 0-18m0 18c-2.5-2.5-2.5-15 0-18M3 12h18"
              />
            </svg>
            {{ files.length }} entradas escaneadas
          </div>
        </div>

        <!-- Multipage breakdown -->
        <div
          v-if="multipageDocuments.length"
          class="rounded-xl border border-gray-200 bg-white px-4 py-3"
        >
          <p class="mb-2 text-xs font-medium text-gray-400">
            Documentos multipágina
          </p>
          <ul class="space-y-1.5">
            <li
              v-for="doc in multipageDocuments"
              :key="doc.id"
              class="flex items-center justify-between gap-2 text-xs text-slate-600"
            >
              <span class="min-w-0 truncate" :title="doc.name">{{
                doc.name
              }}</span>
              <span class="flex flex-shrink-0 items-center gap-1">
                <span
                  class="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-500"
                  >{{ doc.pages }} entradas</span
                >
                <button
                  type="button"
                  class="rounded-md p-1 text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                  title="Quitar documento"
                  @click="removeSourceDocument(doc)"
                >
                  <svg
                    class="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            </li>
          </ul>
        </div>

        <!-- Actions -->
        <div class="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
          <button
            v-if="baseExportableFilesCount > 0"
            @click="openSuplidorSummary"
            class="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="exportableFilesCount === 0"
            :title="
              exportableFilesCount === 0
                ? 'Ninguna fila coincide con los filtros de exportación'
                : 'Descargar Excel'
            "
          >
            Descargar Excel
            <span class="ml-1 font-normal text-emerald-100"
              >({{ exportableFilesCount }})</span
            >
          </button>
          <button
            v-if="showScanActions"
            @click="processAll"
            :disabled="
              !canScan ||
              processing ||
              batchLimit.isLimited.value ||
              files.every((f) => f.status !== 'pending' || f.reviewLater)
            "
            class="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            :title="
              !canScan
                ? 'Selecciona cliente y documentos primero'
                : batchLimit.isLimited.value
                  ? `Límite alcanzado - espera ${batchLimit.label.value}`
                  : 'Procesar archivos pendientes con IA'
            "
          >
            <template v-if="processing">Procesando...</template>
            <template v-else-if="batchLimit.isLimited.value">
              Enfriamiento · {{ batchLimit.label.value }}
            </template>
            <template v-else>Procesar</template>
          </button>
          <button
            v-if="showScanActions"
            @click="canScan && fileInput?.click()"
            :disabled="!canScan"
            class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cargar más documentos
          </button>
          <button
            @click="clearFiles"
            class="w-full rounded-lg px-4 py-2.5 text-sm font-medium transition"
            :class="
              hasPerformedAnalysis
                ? 'border border-gray-200 bg-white text-gray-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            "
          >
            Descartar todos
          </button>
        </div>

        <!-- NCF strip options for Excel export -->
        <div class="rounded-xl border border-gray-200 bg-white">
          <div class="flex items-center gap-2 px-3 py-2.5">
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-0.5 text-left transition hover:bg-gray-50"
              :aria-expanded="stripNcfCardOpen"
              @click="stripNcfCardOpen = !stripNcfCardOpen"
            >
              <svg
                class="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform"
                :class="{ 'rotate-180': stripNcfCardOpen }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              <div class="min-w-0">
                <p class="text-sm font-medium text-gray-900">
                  Remover nomenclaturas NCF
                </p>
                <p v-if="stripNcfCardOpen" class="mt-0.5 text-xs text-gray-400">
                  Al exportar, quita del inicio del valor las series tipadas (ej.
                  B01 → 00222157). Los ceros que queden se conservan.
                </p>
              </div>
            </button>
            <button
              type="button"
              role="switch"
              :aria-checked="stripNcfEnabled"
              class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              :class="stripNcfEnabled ? 'bg-emerald-600' : 'bg-gray-200'"
              @click.stop="stripNcfEnabled = !stripNcfEnabled"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
                :class="stripNcfEnabled ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </div>

          <div
            v-if="stripNcfCardOpen && stripNcfEnabled"
            class="space-y-3 border-t border-gray-100 px-4 py-3"
          >
            <div class="relative">
              <label class="mb-1.5 block text-xs font-medium text-gray-500">
                Columnas del Excel
              </label>
              <button
                type="button"
                class="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-700 transition hover:border-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                @click="
                  stripNcfColumnDropdownOpen = !stripNcfColumnDropdownOpen
                "
              >
                <span
                  v-if="stripNcfColumns.length"
                  class="flex flex-wrap gap-1"
                >
                  <span
                    v-for="key in stripNcfColumns"
                    :key="key"
                    class="inline-flex rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-700"
                  >
                    {{ stripNcfColumnLabel(key) }}
                  </span>
                </span>
                <span v-else class="text-gray-400">Selecciona columnas…</span>
                <svg
                  class="h-4 w-4 flex-shrink-0 text-gray-400 transition"
                  :class="{ 'rotate-180': stripNcfColumnDropdownOpen }"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              <div
                v-if="stripNcfColumnDropdownOpen"
                class="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              >
                <label
                  v-for="col in STRIP_NCF_COLUMN_OPTIONS"
                  :key="col.key"
                  class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    :checked="stripNcfColumns.includes(col.key)"
                    @change="toggleStripNcfColumn(col.key)"
                  />
                  <span>{{ col.label }}</span>
                </label>
              </div>
            </div>

            <div>
              <label class="mb-1.5 block text-xs font-medium text-gray-500">
                Nomenclaturas
              </label>
              <div
                class="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 py-1.5 transition focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/40"
                @click="stripNcfInput?.focus()"
              >
                <span
                  v-for="prefix in stripNcfPrefixes"
                  :key="prefix"
                  class="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-gray-700"
                >
                  {{ prefix }}
                  <button
                    type="button"
                    class="rounded text-gray-400 hover:text-gray-700"
                    :title="`Quitar ${prefix}`"
                    @click.stop="removeStripNcfPrefix(prefix)"
                  >
                    ×
                  </button>
                </span>
                <input
                  ref="stripNcfInput"
                  v-model="stripNcfDraft"
                  type="text"
                  class="min-w-[5rem] flex-1 border-0 bg-transparent px-1 py-0.5 font-mono text-xs text-gray-700 outline-none placeholder:font-sans placeholder:text-gray-400"
                  placeholder="Ej: B01 y Enter"
                  @keydown="onStripNcfDraftKeydown"
                  @blur="commitStripNcfDraft"
                />
              </div>
              <p class="mt-1 text-[11px] text-gray-400">
                Escribe la serie (B01, E31…) y pulsa Enter o coma.
              </p>
            </div>
          </div>
        </div>

        <!-- Include-only filter for Excel export -->
        <div class="rounded-xl border border-gray-200 bg-white">
          <div class="flex items-center gap-2 px-3 py-2.5">
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-0.5 text-left transition hover:bg-gray-50"
              :aria-expanded="exportIncludeCardOpen"
              @click="exportIncludeCardOpen = !exportIncludeCardOpen"
            >
              <svg
                class="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform"
                :class="{ 'rotate-180': exportIncludeCardOpen }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              <div class="min-w-0">
                <p class="text-sm font-medium text-gray-900">
                  Solo valores coincidentes
                </p>
                <p
                  v-if="exportIncludeCardOpen"
                  class="mt-0.5 text-xs text-gray-400"
                >
                  Exporta únicamente las filas cuyo valor en la columna elegida
                  coincide con los tipados.
                </p>
              </div>
            </button>
            <button
              type="button"
              role="switch"
              :aria-checked="exportIncludeEnabled"
              class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              :class="exportIncludeEnabled ? 'bg-emerald-600' : 'bg-gray-200'"
              @click.stop="exportIncludeEnabled = !exportIncludeEnabled"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
                :class="
                  exportIncludeEnabled ? 'translate-x-5' : 'translate-x-0'
                "
              />
            </button>
          </div>

          <div
            v-if="exportIncludeCardOpen && exportIncludeEnabled"
            class="space-y-3 border-t border-gray-100 px-4 py-3"
          >
            <div>
              <label class="mb-1.5 block text-xs font-medium text-gray-500">
                Columna
              </label>
              <select
                v-model="exportIncludeColumn"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
              >
                <option
                  v-for="col in EXPORT_VALUE_FILTER_COLUMNS"
                  :key="col.key"
                  :value="col.key"
                >
                  {{ col.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-gray-500">
                Valores a incluir
              </label>
              <div
                class="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 py-1.5 transition focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/40"
                @click="exportIncludeInput?.focus()"
              >
                <span
                  v-for="value in exportIncludeValues"
                  :key="value"
                  class="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-gray-700"
                >
                  {{ value }}
                  <button
                    type="button"
                    class="rounded text-gray-400 hover:text-gray-700"
                    :title="`Quitar ${value}`"
                    @click.stop="removeExportIncludeValue(value)"
                  >
                    ×
                  </button>
                </span>
                <input
                  ref="exportIncludeInput"
                  v-model="exportIncludeDraft"
                  type="text"
                  class="min-w-[5rem] flex-1 border-0 bg-transparent px-1 py-0.5 font-mono text-xs text-gray-700 outline-none placeholder:font-sans placeholder:text-gray-400"
                  placeholder="Ej: 122029818"
                  @keydown="onExportIncludeDraftKeydown"
                  @blur="commitExportIncludeDraft"
                />
              </div>
              <p class="mt-1 text-[11px] text-gray-400">
                Escribe el valor y pulsa Enter o coma.
              </p>
            </div>
          </div>
        </div>

        <!-- Exclude filter for Excel export -->
        <div class="rounded-xl border border-gray-200 bg-white">
          <div class="flex items-center gap-2 px-3 py-2.5">
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-0.5 text-left transition hover:bg-gray-50"
              :aria-expanded="exportExcludeCardOpen"
              @click="exportExcludeCardOpen = !exportExcludeCardOpen"
            >
              <svg
                class="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform"
                :class="{ 'rotate-180': exportExcludeCardOpen }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              <div class="min-w-0">
                <p class="text-sm font-medium text-gray-900">
                  Excluir valores coincidentes
                </p>
                <p
                  v-if="exportExcludeCardOpen"
                  class="mt-0.5 text-xs text-gray-400"
                >
                  Omite del Excel las filas cuyo valor en la columna elegida
                  coincide con los tipados.
                </p>
              </div>
            </button>
            <button
              type="button"
              role="switch"
              :aria-checked="exportExcludeEnabled"
              class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              :class="exportExcludeEnabled ? 'bg-emerald-600' : 'bg-gray-200'"
              @click.stop="exportExcludeEnabled = !exportExcludeEnabled"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
                :class="
                  exportExcludeEnabled ? 'translate-x-5' : 'translate-x-0'
                "
              />
            </button>
          </div>

          <div
            v-if="exportExcludeCardOpen && exportExcludeEnabled"
            class="space-y-3 border-t border-gray-100 px-4 py-3"
          >
            <div>
              <label class="mb-1.5 block text-xs font-medium text-gray-500">
                Columna
              </label>
              <select
                v-model="exportExcludeColumn"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
              >
                <option
                  v-for="col in EXPORT_VALUE_FILTER_COLUMNS"
                  :key="col.key"
                  :value="col.key"
                >
                  {{ col.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-gray-500">
                Valores a excluir
              </label>
              <div
                class="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 py-1.5 transition focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/40"
                @click="exportExcludeInput?.focus()"
              >
                <span
                  v-for="value in exportExcludeValues"
                  :key="value"
                  class="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-gray-700"
                >
                  {{ value }}
                  <button
                    type="button"
                    class="rounded text-gray-400 hover:text-gray-700"
                    :title="`Quitar ${value}`"
                    @click.stop="removeExportExcludeValue(value)"
                  >
                    ×
                  </button>
                </span>
                <input
                  ref="exportExcludeInput"
                  v-model="exportExcludeDraft"
                  type="text"
                  class="min-w-[5rem] flex-1 border-0 bg-transparent px-1 py-0.5 font-mono text-xs text-gray-700 outline-none placeholder:font-sans placeholder:text-gray-400"
                  placeholder="Ej: 122029818"
                  @keydown="onExportExcludeDraftKeydown"
                  @blur="commitExportExcludeDraft"
                />
              </div>
              <p class="mt-1 text-[11px] text-gray-400">
                Escribe el valor y pulsa Enter o coma.
              </p>
            </div>
          </div>
        </div>

        <p
          v-if="totalProcessingTime > 0"
          class="text-center text-xs text-gray-400"
        >
          Tiempo total: {{ formatTime(totalProcessingTime) }}
        </p>
      </div>
    </aside>
  </div>

  <!-- Side Panel Preview -->
  <Transition name="slide">
    <aside
      v-if="previewFile"
      class="fixed right-0 top-0 flex h-full flex-col border-l border-gray-200 bg-white shadow-2xl z-90"
      :style="{ width: `${previewWidth}px` }"
    >
      <div
        class="group absolute left-0 top-0 z-50 h-full w-1.5 -translate-x-1/2 cursor-col-resize"
        @mousedown="startPreviewResize"
        :title="`Arrastra para redimensionar · ${previewWidth}px`"
      >
        <div
          class="h-full w-full transition-colors"
          :class="
            isResizingPreview
              ? 'bg-emerald-400/70'
              : 'bg-transparent group-hover:bg-emerald-400/40'
          "
        ></div>
      </div>
      <div
        class="flex items-center justify-between border-b border-gray-200 px-4 py-4"
      >
        <h3 class="truncate text-base font-semibold text-gray-900">
          {{ previewFile.name }}
        </h3>
        <button
          @click="closePreview"
          class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="flex-1 overflow-auto p-4">
        <div
          v-if="isImageFile(previewFile)"
          class="overflow-hidden rounded-xl bg-gray-100"
        >
          <img
            :src="previewUrl"
            :alt="previewFile.name"
            class="h-auto w-full object-contain"
            @load="onPreviewImageLoad"
            @error="onPreviewImageError"
          />
        </div>

        <div
          v-else-if="isPdfFile(previewFile)"
          class="flex h-full flex-col overflow-hidden rounded-xl bg-gray-100"
        >
          <iframe
            :src="previewUrl"
            :title="previewFile.name"
            class="w-full flex-1 bg-white"
            style="min-height: 70vh"
          ></iframe>
          <p class="border-t border-gray-200 px-3 py-2 text-xs text-gray-400">
            Los PDF normalmente se dividen en una fila por página al subir.
          </p>
        </div>

        <div v-else class="rounded-xl bg-gray-100 p-8 text-center">
          <p class="text-sm text-slate-600">{{ previewFile.name }}</p>
          <p class="mt-2 text-xs text-gray-400">Vista previa no disponible.</p>
        </div>
      </div>
    </aside>
  </Transition>

  <!-- Leave confirmation: scan progress is not persisted -->
  <div
    v-if="leaveConfirmOpen"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="leave-confirm-title"
  >
    <div
      class="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
    >
      <h2 id="leave-confirm-title" class="text-lg font-semibold text-gray-900">
        ¿Salir sin guardar?
      </h2>
      <p class="mt-2 text-sm text-slate-600">
        Ya procesaste documentos en esta sesión. El progreso del escaneo
        <strong class="font-semibold text-gray-800">no se ha almacenado</strong>
        y se perderá si sales o recargas la página.
      </p>
      <div class="mt-6 flex justify-end gap-3">
        <button
          type="button"
          class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          @click="cancelLeave"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          @click="confirmLeave"
        >
          Salir de todos modos
        </button>
      </div>
    </div>
  </div>

  <!-- Descripción editor -->
  <div
    v-if="descripcionEditorFile"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="descripcion-editor-title"
    @click.self="closeDescripcionEditor"
  >
    <div class="w-full max-w-lg rounded-xl bg-white shadow-xl">
      <div
        class="flex items-center justify-between border-b border-gray-100 px-6 py-4"
      >
        <div class="min-w-0">
          <h2
            id="descripcion-editor-title"
            class="text-base font-semibold text-gray-900"
          >
            Descripción
          </h2>
          <p class="mt-0.5 truncate text-sm text-gray-500">
            {{ descripcionEditorFile.name }}
          </p>
        </div>
        <button
          type="button"
          class="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-slate-600"
          title="Cerrar"
          @click="closeDescripcionEditor"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <div class="px-6 py-4">
        <textarea
          ref="descripcionTextarea"
          v-model="descripcionEditorFile.editableData.descripcion"
          maxlength="200"
          rows="6"
          class="w-full resize-y rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40"
          placeholder="Escribe la descripción…"
        />
        <p class="mt-1.5 text-right text-xs text-gray-400">
          {{
            (descripcionEditorFile.editableData.descripcion || "").length
          }}/200
        </p>
      </div>
      <div
        class="flex items-center justify-end border-t border-gray-100 px-6 py-4"
      >
        <button
          type="button"
          class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          @click="closeDescripcionEditor"
        >
          Listo
        </button>
      </div>
    </div>
  </div>

  <!-- ── Suplidores summary modal (shown before Excel download) ─────────── -->
  <div
    v-if="showSuplidorSummary"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    @click.self="showSuplidorSummary = false"
  >
    <div class="w-full max-w-lg rounded-xl bg-white shadow-xl">
      <div
        class="flex items-center justify-between border-b border-gray-100 px-6 py-4"
      >
        <div>
          <h2 class="text-base font-semibold text-gray-900">
            Resumen de Suplidores
          </h2>
          <p class="mt-0.5 text-sm text-gray-500">
            <span class="font-medium text-gray-700">{{
              suplidorSummaryRows.length
            }}</span>
            {{
              suplidorSummaryRows.length === 1
                ? "suplidor único"
                : "suplidores únicos"
            }}
            en este archivo.
            <span
              v-if="suplidorSummaryRows.some((s) => !s.registered_on_platform)"
              class="text-amber-600"
            >
              {{
                suplidorSummaryRows.filter((s) => !s.registered_on_platform)
                  .length
              }}
              no registrados en la plataforma.
            </span>
          </p>
        </div>
        <button
          type="button"
          class="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-slate-600"
          @click="showSuplidorSummary = false"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="max-h-72 overflow-y-auto">
        <table class="w-full text-left text-sm">
          <thead
            class="sticky top-0 border-b border-slate-100 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500"
          >
            <tr>
              <th class="px-5 py-2.5">Documento</th>
              <th class="px-5 py-2.5">Nombre</th>
              <th class="px-5 py-2.5">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="s in suplidorSummaryRows"
              :key="s.documento || s.nombre"
              class="hover:bg-gray-50"
            >
              <td class="px-5 py-2.5 font-mono text-xs text-slate-600">
                {{ s.documento || "—" }}
              </td>
              <td class="px-5 py-2.5 text-gray-900">{{ s.nombre }}</td>
              <td class="px-5 py-2.5">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  :class="
                    s.registered_on_platform
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  "
                >
                  <svg
                    v-if="s.registered_on_platform"
                    class="h-3 w-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  <svg
                    v-else
                    class="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2.5"
                      d="M12 9v4m0 4h.01"
                    />
                  </svg>
                  {{
                    s.registered_on_platform ? "Registrado" : "No registrado"
                  }}
                </span>
              </td>
            </tr>
            <tr v-if="suplidorSummaryRows.length === 0">
              <td
                colspan="3"
                class="px-5 py-8 text-center text-sm text-gray-400"
              >
                No se detectaron suplidores en las filas exportables.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p
        v-if="suplidorSaveError"
        class="mx-6 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        {{ suplidorSaveError }}
      </p>

      <div
        class="flex items-center justify-between border-t border-gray-100 px-6 py-4"
      >
        <p class="text-xs text-gray-400">
          Los suplidores nuevos se guardarán en la base de datos al descargar.
        </p>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-gray-100"
            @click="showSuplidorSummary = false"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            :disabled="suplidorSaving"
            @click="saveSuplidoresAndDownload"
          >
            {{ suplidorSaving ? "Guardando…" : "Descargar Excel" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  markRaw,
  nextTick,
} from "vue";
import { onBeforeRouteLeave } from "vue-router";

const API_BASE = useApiBase();

// --- Client + ERP catalog selection (mandatory before scanning) ----------
const { list: listClients } = useClients();
const { listByClient } = useClientDocuments();
const { listByClient: listBusinessRulesByClient } = useClientBusinessRules();
const { upsertFromScan, listByClient: listSuplidoresByClient } =
  useClientSuplidores();

const clients = ref([]);
const clientsLoading = ref(false);
const clientsError = ref(null);

const selectedClientId = ref("");
const selectedConceptoDocId = ref("");
const selectedTipoDePagoDocId = ref("");
// Optional - a client document picked purely to give the AI context when
// choosing among the FIXED tipo_de_gasto options (never adds new values).
const selectedTipoDeGastoContextDocId = ref("");

const clientDocuments = ref([]);
const clientDocumentsLoading = ref(false);
const clientDocumentsError = ref(null);

// Optional, client-level business rules (see "Anotaciones del Negocio" on
// the client detail page) - free-form context sent to the AI on top of the
// Concepto/Tipo de Pago catalogs, independent of which documents are
// selected above.
const clientBusinessRules = ref([]);

const canScan = computed(() =>
  Boolean(
    selectedClientId.value &&
    selectedConceptoDocId.value &&
    selectedTipoDePagoDocId.value,
  ),
);

// Only attributes with a usable ERP id can be written to the export.
const conceptoOptions = computed(() => {
  const doc = clientDocuments.value.find(
    (d) => d.id === selectedConceptoDocId.value,
  );
  return (doc?.document_attributes ?? []).filter(
    (a) => a.document_id !== null && a.document_id !== undefined,
  );
});
const tipoDePagoOptions = computed(() => {
  const doc = clientDocuments.value.find(
    (d) => d.id === selectedTipoDePagoDocId.value,
  );
  return (doc?.document_attributes ?? []).filter(
    (a) => a.document_id !== null && a.document_id !== undefined,
  );
});

const conceptoCatalogPayload = computed(() =>
  conceptoOptions.value.map((a) => ({
    document_type: a.document_type,
    document_id: a.document_id,
    description: a.description || "",
  })),
);
const tipoDePagoCatalogPayload = computed(() =>
  tipoDePagoOptions.value.map((a) => ({
    document_type: a.document_type,
    document_id: a.document_id,
    description: a.description || "",
  })),
);

// Document-level comments (set on the "Gastos"/"Tipo de Pago" containers
// themselves, on top of each attribute's own comment) give the LLM broader
// context for classification. Always sent, "" when the document has none,
// so the prompt behaves exactly as before when no comment was set.
const conceptoDocumentComment = computed(() => {
  const doc = clientDocuments.value.find(
    (d) => d.id === selectedConceptoDocId.value,
  );
  return doc?.comment || "";
});
const tipoDePagoDocumentComment = computed(() => {
  const doc = clientDocuments.value.find(
    (d) => d.id === selectedTipoDePagoDocId.value,
  );
  return doc?.comment || "";
});

// Tipo de Gasto context document: unlike conceptoOptions/tipoDePagoOptions,
// EVERY attribute is kept (no ERP-id filter) since this is just free-form
// context to help pick among the fixed TIPO_DE_GASTO_OPTIONS, not a set of
// valid output values with their own ERP id.
const tipoDeGastoContextDoc = computed(() =>
  clientDocuments.value.find(
    (d) => d.id === selectedTipoDeGastoContextDocId.value,
  ),
);
const tipoDeGastoContextPayload = computed(() =>
  (tipoDeGastoContextDoc.value?.document_attributes ?? []).map((a) => ({
    document_type: a.document_type,
    document_id: a.document_id,
    description: a.description || "",
  })),
);
const tipoDeGastoDocumentComment = computed(
  () => tipoDeGastoContextDoc.value?.comment || "",
);

// Flatten every rule group's attributes into a single list for the prompt -
// the AI doesn't need the grouping, just the combined context.
const businessRulesPayload = computed(() =>
  clientBusinessRules.value.flatMap((rule) =>
    (rule.business_rule_attributes ?? []).map((a) => ({
      rule_type: a.rule_type,
      rule_value: a.rule_value || "",
      description: a.description || "",
    })),
  ),
);

const loadClients = async () => {
  clientsLoading.value = true;
  clientsError.value = null;
  try {
    clients.value = await listClients();
  } catch (err) {
    clientsError.value = err?.message || "No se pudieron cargar los clientes.";
  } finally {
    clientsLoading.value = false;
  }
};

// Fetch documents/business rules for the currently selected client.
// `preferredSelection`, when provided (restoring from localStorage), tries
// to re-apply previously chosen document ids once the fresh document list
// is in - but only the ones that still exist for this client; anything
// stale/missing is simply left at its default ("").
const loadClientDocumentsAndRules = async (preferredSelection = null) => {
  clientDocuments.value = [];
  clientBusinessRules.value = [];
  if (!selectedClientId.value) return;

  clientDocumentsLoading.value = true;
  clientDocumentsError.value = null;
  try {
    clientDocuments.value = await listByClient(selectedClientId.value);
  } catch (err) {
    clientDocumentsError.value =
      err?.message || "No se pudieron cargar los documentos del cliente.";
  } finally {
    clientDocumentsLoading.value = false;
  }

  if (preferredSelection) {
    const availableIds = new Set(clientDocuments.value.map((d) => d.id));
    if (availableIds.has(preferredSelection.conceptoDocId)) {
      selectedConceptoDocId.value = preferredSelection.conceptoDocId;
    }
    if (availableIds.has(preferredSelection.tipoDePagoDocId)) {
      selectedTipoDePagoDocId.value = preferredSelection.tipoDePagoDocId;
    }
    if (availableIds.has(preferredSelection.tipoDeGastoContextDocId)) {
      selectedTipoDeGastoContextDocId.value =
        preferredSelection.tipoDeGastoContextDocId;
    }
  }

  // Business rules are optional context - fail silently so a missing/empty
  // rules setup never blocks scanning.
  try {
    clientBusinessRules.value = await listBusinessRulesByClient(
      selectedClientId.value,
    );
  } catch (err) {
    console.warn("[Business rules] No se pudieron cargar:", err);
  }
};

const onClientChange = () => {
  selectedConceptoDocId.value = "";
  selectedTipoDePagoDocId.value = "";
  selectedTipoDeGastoContextDocId.value = "";
  loadClientDocumentsAndRules();
};

// --- Client/document selection persistence (localStorage) -----------------
// Remembers the last selected client + Concepto/Tipo de Pago/Tipo de Gasto
// documents across reloads, purely as a convenience. If nothing was saved
// (or storage is unavailable), everything simply keeps its default ("")
// and the user picks a client as before - no client is ever assumed.
const CLIENT_SELECTION_KEY = "rcp_client_selection";

const loadStoredClientSelection = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CLIENT_SELECTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const persistClientSelection = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CLIENT_SELECTION_KEY,
      JSON.stringify({
        clientId: selectedClientId.value || "",
        conceptoDocId: selectedConceptoDocId.value || "",
        tipoDePagoDocId: selectedTipoDePagoDocId.value || "",
        tipoDeGastoContextDocId: selectedTipoDeGastoContextDocId.value || "",
      }),
    );
  } catch {
    /* localStorage unavailable (private mode, quota) - silently ignore */
  }
};

const restoreClientSelection = () => {
  const stored = loadStoredClientSelection();
  if (!stored?.clientId) return; // Nothing saved - keep the default (empty) state.
  selectedClientId.value = stored.clientId;
  loadClientDocumentsAndRules({
    conceptoDocId: stored.conceptoDocId || "",
    tipoDePagoDocId: stored.tipoDePagoDocId || "",
    tipoDeGastoContextDocId: stored.tipoDeGastoContextDocId || "",
  });
};

watch(
  [
    selectedClientId,
    selectedConceptoDocId,
    selectedTipoDePagoDocId,
    selectedTipoDeGastoContextDocId,
  ],
  persistClientSelection,
);

// --- UI state -------------------------------------------------------------
const addFilesOpen = ref(true);
const stripNcfCardOpen = ref(false);
const exportIncludeCardOpen = ref(false);
const exportExcludeCardOpen = ref(false);
const search = ref("");
// 'active' = rows that go to Excel; 'review_later' = excluded for later fix-up
const tableView = ref("active");
const selectedFileIds = ref(new Set());

const ALL_COLUMNS = [
  "#",
  "Documento",
  "Status",
  "Score",
  "Nombre",
  "NCF",
  "Tipo de Suplidor",
  "Tipo de Gasto",
  "Descripción",
  "Fecha",
  "Monto Servicios",
  "Monto Bienes",
  "ITBIS",
  "Selectivo",
  "Moneda",
  "Forma de Pago",
  "Concepto Id",
  "Tipo de Pago Id",
  "NCF Afectado",
  "Nombre del archivo",
  "Preview",
  "Acciones",
];

// Before processing, only keep the essentials so the queue is easy to scan.
const PRE_PROCESS_COLUMNS = new Set([
  "Status",
  "Nombre del archivo",
  "Preview",
  "Acciones",
]);

const TIPO_DE_SUPLIDOR_OPTIONS = [
  "Gasto Formal",
  "Gasto Informal",
  "Genérico",
  "Gasto Menor",
  "Pagos al exterior",
  "Norma 07-2007",
  "DGA",
  "Decreto 139-98",
];

const TIPO_DE_GASTO_OPTIONS = [
  "01-Gasto de personal",
  "02-Gastos por trabajos, servicios y suministros",
  "03-Arrendamientos",
  "04-Gastos de activo fijo",
  "05-Gastos de representación",
  "06-Otras deducciones administrativas",
  "07-Gastos financieros",
  "08-Gastos extraordinarios",
  "09-Compras y gastos que forman gastos de la venta",
  "10-Adquisicion de activos",
  "11-Gastos de seguros",
];

const requiresNcfAfectado = (ncf) => {
  const value = String(ncf || "")
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/^0+/, "");
  return value.startsWith("B03") || value.startsWith("B04");
};

// Excel columns this filter can target (labels match the export / template).
const STRIP_NCF_COLUMN_OPTIONS = [
  { key: "ncf", label: "NCF" },
  { key: "ncf_afectado", label: "NCF Afectado" },
  { key: "documento", label: "Documento" },
  { key: "nombre", label: "Nombre" },
  { key: "descripcion", label: "Descripcion" },
];

// Export-time strip settings: toggle + Excel columns + typed nomenclature tags.
// Removes the typed series from the START of the value (and any OCR leading
// zeros before it). Remaining characters — including zeros — are kept.
//   "0000000B0100222157" + B01 → "00222157"
//   "B0100222157"         + B01 → "00222157"
//   "E310000633480"       + E31 → "0000633480"
const STRIP_NCF_SETTINGS_KEY = "rcp_strip_ncf_settings";
const stripNcfEnabled = ref(true);
const stripNcfColumns = ref(["ncf"]);
const stripNcfPrefixes = ref(["B01", "B02"]);
const stripNcfDraft = ref("");
const stripNcfInput = ref(null);
const stripNcfColumnDropdownOpen = ref(false);

const stripNcfColumnLabel = (key) =>
  STRIP_NCF_COLUMN_OPTIONS.find((c) => c.key === key)?.label || key;

const loadStripNcfSettings = () => {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STRIP_NCF_SETTINGS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.enabled === "boolean") {
      stripNcfEnabled.value = parsed.enabled;
    }
    const validColumns = new Set(STRIP_NCF_COLUMN_OPTIONS.map((c) => c.key));
    // Migrate legacy single `column` string → `columns` array.
    const rawColumns = Array.isArray(parsed?.columns)
      ? parsed.columns
      : parsed?.column
        ? [parsed.column]
        : null;
    if (rawColumns) {
      const cleaned = rawColumns.filter((c) => validColumns.has(c));
      if (cleaned.length) stripNcfColumns.value = cleaned;
    }
    if (Array.isArray(parsed?.prefixes)) {
      const cleaned = [
        ...new Set(
          parsed.prefixes
            .map((p) =>
              String(p || "")
                .replace(/\s+/g, "")
                .toUpperCase(),
            )
            .filter(Boolean),
        ),
      ];
      if (cleaned.length) stripNcfPrefixes.value = cleaned;
    }
  } catch {
    /* ignore */
  }
};

const persistStripNcfSettings = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STRIP_NCF_SETTINGS_KEY,
      JSON.stringify({
        enabled: stripNcfEnabled.value,
        columns: stripNcfColumns.value,
        prefixes: stripNcfPrefixes.value,
      }),
    );
  } catch {
    /* ignore */
  }
};

watch(
  [stripNcfEnabled, stripNcfColumns, stripNcfPrefixes],
  persistStripNcfSettings,
  { deep: true },
);

watch(stripNcfEnabled, (enabled) => {
  if (!enabled) stripNcfColumnDropdownOpen.value = false;
});

const toggleStripNcfColumn = (key) => {
  const set = new Set(stripNcfColumns.value);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  stripNcfColumns.value = STRIP_NCF_COLUMN_OPTIONS.map((c) => c.key).filter(
    (k) => set.has(k),
  );
};

const addStripNcfPrefix = (raw) => {
  const prefix = String(raw || "")
    .replace(/\s+/g, "")
    .toUpperCase();
  if (!prefix) return;
  if (!stripNcfPrefixes.value.includes(prefix)) {
    stripNcfPrefixes.value = [...stripNcfPrefixes.value, prefix];
  }
};

const removeStripNcfPrefix = (prefix) => {
  stripNcfPrefixes.value = stripNcfPrefixes.value.filter((p) => p !== prefix);
};

const commitStripNcfDraft = () => {
  const parts = String(stripNcfDraft.value || "")
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  parts.forEach(addStripNcfPrefix);
  stripNcfDraft.value = "";
};

const onStripNcfDraftKeydown = (event) => {
  if (event.key === "Enter" || event.key === ",") {
    event.preventDefault();
    commitStripNcfDraft();
    return;
  }
  if (
    event.key === "Backspace" &&
    !stripNcfDraft.value &&
    stripNcfPrefixes.value.length
  ) {
    removeStripNcfPrefix(
      stripNcfPrefixes.value[stripNcfPrefixes.value.length - 1],
    );
  }
};

/** Uppercase / trim only — used for in-table editing. */
const normalizeNcf = (value) => {
  return String(value || "")
    .replace(/\s+/g, "")
    .toUpperCase();
};

/**
 * Remove typed nomenclature prefixes from the start of a value for Excel
 * export. Also drops OCR leading zeros that pad the prefix. Characters
 * after the prefix (including zeros) are never altered.
 */
const stripNomenclaturesFromValue = (value, prefixes) => {
  let text = normalizeNcf(value);
  if (!prefixes?.length) return text;

  // Longer prefixes first so "B01" wins over "B0", "E31" over "E3", etc.
  const sorted = [...prefixes]
    .map((p) =>
      String(p || "")
        .replace(/\s+/g, "")
        .toUpperCase(),
    )
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const prefix of sorted) {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // optional leading zeros + nomenclature at the start of the string
    const re = new RegExp(`^0*${escaped}`);
    if (re.test(text)) {
      return text.replace(re, "");
    }
  }
  return text;
};

/** Apply export strip settings to a single field value for selected columns. */
const applyStripNcfForColumn = (fieldKey, value) => {
  const cleaned = normalizeNcf(value);
  if (
    !stripNcfEnabled.value ||
    !stripNcfColumns.value.includes(fieldKey) ||
    !stripNcfPrefixes.value.length
  ) {
    return fieldKey === "ncf" || fieldKey === "ncf_afectado" ? cleaned : value;
  }
  const stripped = stripNomenclaturesFromValue(value, stripNcfPrefixes.value);
  // Non-NCF columns keep original casing/spacing aside from the strip itself.
  if (fieldKey !== "ncf" && fieldKey !== "ncf_afectado") {
    return stripped;
  }
  return stripped;
};

// Columns available for include/exclude value filters on Excel export.
const EXPORT_VALUE_FILTER_COLUMNS = [
  { key: "documento", label: "Documento" },
  { key: "ncf", label: "NCF" },
  { key: "ncf_afectado", label: "NCF Afectado" },
  { key: "nombre", label: "Nombre" },
  { key: "descripcion", label: "Descripcion" },
];

const EXPORT_VALUE_FILTER_SETTINGS_KEY = "rcp_export_value_filters";

const exportIncludeEnabled = ref(false);
const exportIncludeColumn = ref("documento");
const exportIncludeValues = ref([]);
const exportIncludeDraft = ref("");
const exportIncludeInput = ref(null);

const exportExcludeEnabled = ref(false);
const exportExcludeColumn = ref("documento");
const exportExcludeValues = ref([]);
const exportExcludeDraft = ref("");
const exportExcludeInput = ref(null);

/** Normalize a cell value for include/exclude matching (column-aware). */
const normalizeExportFilterValue = (columnKey, value) => {
  const text = String(value ?? "").trim();
  if (columnKey === "documento") {
    return text.replace(/\D/g, "");
  }
  if (columnKey === "ncf" || columnKey === "ncf_afectado") {
    return text.replace(/\s+/g, "").toUpperCase();
  }
  return text.replace(/\s+/g, " ").toLowerCase();
};

const getFileExportFilterValue = (file, columnKey) => {
  const d = file?.editableData || {};
  if (columnKey === "documento") return d.documento;
  if (columnKey === "ncf") return d.ncf;
  if (columnKey === "ncf_afectado") return d.ncf_afectado;
  if (columnKey === "nombre") return d.nombre;
  if (columnKey === "descripcion") return d.descripcion;
  return "";
};

const fileMatchesExportValues = (file, columnKey, values) => {
  if (!values?.length) return false;
  const cell = normalizeExportFilterValue(
    columnKey,
    getFileExportFilterValue(file, columnKey),
  );
  if (!cell) return false;
  const set = new Set(
    values.map((v) => normalizeExportFilterValue(columnKey, v)).filter(Boolean),
  );
  return set.has(cell);
};

/** Rows that would be written to Excel (done, not deferred, value filters). */
const getExportableFiles = () => {
  let rows = files.value.filter((f) => f.status === "done" && !f.reviewLater);

  // Include filter active with no values → nothing to export (avoid surprise dumps).
  if (exportIncludeEnabled.value) {
    if (!exportIncludeValues.value.length) return [];
    rows = rows.filter((f) =>
      fileMatchesExportValues(
        f,
        exportIncludeColumn.value,
        exportIncludeValues.value,
      ),
    );
  }

  if (exportExcludeEnabled.value && exportExcludeValues.value.length) {
    rows = rows.filter(
      (f) =>
        !fileMatchesExportValues(
          f,
          exportExcludeColumn.value,
          exportExcludeValues.value,
        ),
    );
  }

  return rows;
};

const loadExportValueFilterSettings = () => {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(EXPORT_VALUE_FILTER_SETTINGS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const validColumns = new Set(EXPORT_VALUE_FILTER_COLUMNS.map((c) => c.key));

    if (typeof parsed?.include?.enabled === "boolean") {
      exportIncludeEnabled.value = parsed.include.enabled;
    }
    if (validColumns.has(parsed?.include?.column)) {
      exportIncludeColumn.value = parsed.include.column;
    }
    if (Array.isArray(parsed?.include?.values)) {
      exportIncludeValues.value = [
        ...new Set(
          parsed.include.values
            .map((v) => String(v || "").trim())
            .filter(Boolean),
        ),
      ];
    }

    if (typeof parsed?.exclude?.enabled === "boolean") {
      exportExcludeEnabled.value = parsed.exclude.enabled;
    }
    if (validColumns.has(parsed?.exclude?.column)) {
      exportExcludeColumn.value = parsed.exclude.column;
    }
    if (Array.isArray(parsed?.exclude?.values)) {
      exportExcludeValues.value = [
        ...new Set(
          parsed.exclude.values
            .map((v) => String(v || "").trim())
            .filter(Boolean),
        ),
      ];
    }
  } catch {
    /* ignore */
  }
};

const persistExportValueFilterSettings = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      EXPORT_VALUE_FILTER_SETTINGS_KEY,
      JSON.stringify({
        include: {
          enabled: exportIncludeEnabled.value,
          column: exportIncludeColumn.value,
          values: exportIncludeValues.value,
        },
        exclude: {
          enabled: exportExcludeEnabled.value,
          column: exportExcludeColumn.value,
          values: exportExcludeValues.value,
        },
      }),
    );
  } catch {
    /* ignore */
  }
};

watch(
  [
    exportIncludeEnabled,
    exportIncludeColumn,
    exportIncludeValues,
    exportExcludeEnabled,
    exportExcludeColumn,
    exportExcludeValues,
  ],
  persistExportValueFilterSettings,
  { deep: true },
);

const addExportFilterValue = (listRef, raw) => {
  const value = String(raw || "").trim();
  if (!value) return;
  if (!listRef.value.includes(value)) {
    listRef.value = [...listRef.value, value];
  }
};

const removeExportIncludeValue = (value) => {
  exportIncludeValues.value = exportIncludeValues.value.filter(
    (v) => v !== value,
  );
};

const removeExportExcludeValue = (value) => {
  exportExcludeValues.value = exportExcludeValues.value.filter(
    (v) => v !== value,
  );
};

const commitExportIncludeDraft = () => {
  String(exportIncludeDraft.value || "")
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .forEach((v) => addExportFilterValue(exportIncludeValues, v));
  exportIncludeDraft.value = "";
};

const commitExportExcludeDraft = () => {
  String(exportExcludeDraft.value || "")
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .forEach((v) => addExportFilterValue(exportExcludeValues, v));
  exportExcludeDraft.value = "";
};

const onExportIncludeDraftKeydown = (event) => {
  if (event.key === "Enter" || event.key === ",") {
    event.preventDefault();
    commitExportIncludeDraft();
    return;
  }
  if (
    event.key === "Backspace" &&
    !exportIncludeDraft.value &&
    exportIncludeValues.value.length
  ) {
    removeExportIncludeValue(
      exportIncludeValues.value[exportIncludeValues.value.length - 1],
    );
  }
};

const onExportExcludeDraftKeydown = (event) => {
  if (event.key === "Enter" || event.key === ",") {
    event.preventDefault();
    commitExportExcludeDraft();
    return;
  }
  if (
    event.key === "Backspace" &&
    !exportExcludeDraft.value &&
    exportExcludeValues.value.length
  ) {
    removeExportExcludeValue(
      exportExcludeValues.value[exportExcludeValues.value.length - 1],
    );
  }
};

const normalizeFecha = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return text;
  let [, day, month, year] = match;
  if (year.length === 2) year = `20${year}`;
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
};

// --- Upload limits --------------------------------------------------------
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILE_SIZE_LABEL = "10MB";

// --- PDF rendering (client-side splitting) --------------------------------
// PDFs are split into one PNG image per page on upload so each page becomes
// its own row in the table and flows through the existing image pipeline.
const PDF_RENDER_SCALE = 2.0; // ~144 DPI - good for OCR, reasonable file size
let pdfjsLibPromise = null;

// pdf.js >= 5.4 calls Uint8Array.prototype.toHex() for document fingerprints.
// That API only exists in Chromium 140+ / Safari 18.2+ / Firefox 133+.
// pdf.js >= 5.6 also needs Map.prototype.getOrInsertComputed (Chromium 135+).
const ensurePdfJsRuntimePolyfills = () => {
  if (
    typeof Uint8Array !== "undefined" &&
    typeof Uint8Array.prototype.toHex !== "function"
  ) {
    Object.defineProperty(Uint8Array.prototype, "toHex", {
      value() {
        const hex = new Array(this.length);
        for (let i = 0; i < this.length; i++) {
          hex[i] = this[i].toString(16).padStart(2, "0");
        }
        return hex.join("");
      },
      writable: true,
      configurable: true,
    });
  }

  if (
    typeof Map !== "undefined" &&
    typeof Map.prototype.getOrInsertComputed !== "function"
  ) {
    Object.defineProperty(Map.prototype, "getOrInsertComputed", {
      value(key, callbackFn) {
        if (this.has(key)) return this.get(key);
        const value = callbackFn(key);
        this.set(key, value);
        return value;
      },
      writable: true,
      configurable: true,
    });
  }
};

const loadPdfJs = async () => {
  if (typeof window === "undefined") return null;
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      ensurePdfJsRuntimePolyfills();
      const pdfjs = await import("pdfjs-dist");
      // pdfjs-dist v4+ ships an .mjs worker. Use the bundled URL so it works
      // with Vite/Nuxt without manual asset copying.
      const workerUrl = (
        await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
      ).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })().catch((err) => {
      console.error("Failed to load pdfjs-dist:", err);
      pdfjsLibPromise = null;
      throw err;
    });
  }
  return pdfjsLibPromise;
};

// Convert a single PDF File into an array of per-page PNG Files. Throws on
// failure so the caller can decide to fall back to uploading the PDF as-is.
const splitPdfIntoPageFiles = async (pdfFile) => {
  console.log(
    `[PDF Split] Starting split for "${pdfFile.name}" (${pdfFile.size} bytes)`,
  );

  const pdfjs = await loadPdfJs();
  if (!pdfjs) throw new Error("pdfjs-dist unavailable in this environment");

  const arrayBuffer = await pdfFile.arrayBuffer();
  // Decoder assets (wasm/cmaps/fonts) are required for scanned PDFs that use
  // JBIG2/JPEG2000. Without them, pages render as blank white images.
  const loadingTask = pdfjs.getDocument({
    data: arrayBuffer,
    wasmUrl: "/api/pdfjs/wasm/",
    cMapUrl: "/api/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/api/pdfjs/standard_fonts/",
  });
  const pdf = await loadingTask.promise;

  console.log(
    `[PDF Split] "${pdfFile.name}": ${pdf.numPages} page(s) detected`,
  );

  const baseName = pdfFile.name.replace(/\.pdf$/i, "");
  const pageFiles = [];
  const padWidth = String(pdf.numPages).length;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    console.log(
      `[PDF Split] "${pdfFile.name}" page ${pageNum}/${pdf.numPages}: ` +
        `rendering at ${canvas.width}x${canvas.height}px (scale=${PDF_RENDER_SCALE})`,
    );

    // pdf.js v5: pass `canvas` and let it create the 2D context. Do NOT call
    // getContext() first — a second getContext with different options (alpha /
    // willReadFrequently) returns null in Chromium and yields blank pages.
    await page.render({
      canvas,
      viewport,
      background: "#ffffff",
    }).promise;

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/png",
      );
    });

    console.log(
      `[PDF Split] "${pdfFile.name}" page ${pageNum}/${pdf.numPages}: ` +
        `rendered blob = ${blob.size} bytes`,
    );
    if (blob.size < 3000) {
      console.warn(
        `[PDF Split] "${pdfFile.name}" page ${pageNum}/${pdf.numPages}: ` +
          `blob is suspiciously small (${blob.size} bytes) - the page may ` +
          `have rendered blank. Check canvas size limits / pdf.js worker setup.`,
      );
    }

    const paddedPage = String(pageNum).padStart(padWidth, "0");
    const totalPages = String(pdf.numPages).padStart(padWidth, "0");
    const pageName = `${baseName} - Page ${paddedPage} of ${totalPages}.png`;
    pageFiles.push(
      new File([blob], pageName, {
        type: "image/png",
        lastModified: pdfFile.lastModified,
      }),
    );

    // Free per-page resources promptly.
    canvas.width = 0;
    canvas.height = 0;
    if (typeof page.cleanup === "function") page.cleanup();
  }

  try {
    pdf.cleanup();
    pdf.destroy();
  } catch {
    /* ignore - cleanup is best-effort */
  }

  console.log(
    `[PDF Split] "${pdfFile.name}": finished, produced ${pageFiles.length} page file(s)`,
  );

  return pageFiles;
};

// --- Rate limiting (localStorage-backed, shared across tabs) --------------
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const INDIVIDUAL_RPM = 15;
const INDIVIDUAL_RATE_LIMIT_KEY = "rcp_individual_api_calls";

const BATCH_RPM = 5;
const BATCH_RATE_LIMIT_KEY = "rcp_batch_api_calls";

const formatCooldown = (seconds) => {
  if (seconds <= 0) return "";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${m}m ${rem.toString().padStart(2, "0")}s`;
};

const createRateLimitTracker = (storageKey, rpm) => {
  const used = ref(0);
  const cooldownSec = ref(0);

  const read = () => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
      return arr
        .filter((t) => typeof t === "number" && t > cutoff)
        .sort((a, b) => a - b);
    } catch {
      return [];
    }
  };

  const write = (timestamps) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(timestamps));
    } catch {
      /* localStorage unavailable (private mode, quota) - silently ignore */
    }
  };

  const refresh = () => {
    const recent = read();
    used.value = recent.length;
    if (recent.length >= rpm) {
      const targetTimestamp = recent[recent.length - rpm];
      const expiresAt = targetTimestamp + RATE_LIMIT_WINDOW_MS;
      cooldownSec.value = Math.max(
        0,
        Math.ceil((expiresAt - Date.now()) / 1000),
      );
    } else {
      cooldownSec.value = 0;
    }
  };

  const record = (count = 1) => {
    const recent = read();
    const now = Date.now();
    for (let i = 0; i < count; i++) recent.push(now);
    write(recent);
    refresh();
  };

  const isLimited = computed(() => cooldownSec.value > 0);
  const label = computed(() => formatCooldown(cooldownSec.value));

  return {
    storageKey,
    rpm,
    used,
    cooldownSec,
    isLimited,
    label,
    refresh,
    record,
  };
};

const individualLimit = createRateLimitTracker(
  INDIVIDUAL_RATE_LIMIT_KEY,
  INDIVIDUAL_RPM,
);
const batchLimit = createRateLimitTracker(BATCH_RATE_LIMIT_KEY, BATCH_RPM);

const fileInput = ref(null);
const files = ref([]);
// Ledger of original uploads (before PDF page-splitting), used by the
// "Data sources" panel to report file counts, sizes and entry breakdown.
const sourceDocuments = ref([]);
const processing = ref(false);
const previewFile = ref(null);
const previewUrl = ref(null);
const totalProcessingTime = ref(0);

const showFullTableColumns = computed(
  () => processing.value || files.value.some((f) => f.status !== "pending"),
);

/** True once at least one row has finished analysis (done or error). */
const hasPerformedAnalysis = computed(() =>
  files.value.some((f) => f.status === "done" || f.status === "error"),
);

/** Procesar / Cargar más: visible before analysis, and while a run is in flight. */
const showScanActions = computed(
  () => !hasPerformedAnalysis.value || processing.value,
);

const columns = computed(() =>
  showFullTableColumns.value
    ? ALL_COLUMNS
    : ALL_COLUMNS.filter((col) => PRE_PROCESS_COLUMNS.has(col)),
);
let fileIdCounter = 0;
let sourceIdCounter = 0;
let rateLimitTimer = null;

const totalSourceSize = computed(() =>
  sourceDocuments.value.reduce((sum, d) => sum + d.size, 0),
);

const multipageDocuments = computed(() =>
  sourceDocuments.value.filter((d) => d.pages > 1),
);

const activeFiles = computed(() => files.value.filter((f) => !f.reviewLater));
const reviewLaterFiles = computed(() =>
  files.value.filter((f) => f.reviewLater),
);
const baseExportableFilesCount = computed(
  () => files.value.filter((f) => f.status === "done" && !f.reviewLater).length,
);
const exportableFilesCount = computed(() => getExportableFiles().length);

const matchesSearch = (f, q) => {
  if (!q) return true;
  const d = f.editableData;
  return [
    d.filename,
    d.nombre,
    d.documento,
    d.ncf,
    d.ncf_afectado,
    d.tipo_de_suplidor,
    d.tipo_de_gasto,
    d.descripcion,
    d.moneda,
    d.metodo_de_pago,
  ]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q));
};

const filteredFiles = computed(() => {
  const q = search.value.trim().toLowerCase();
  const pool =
    tableView.value === "review_later"
      ? reviewLaterFiles.value
      : activeFiles.value;
  return pool.filter((f) => matchesSearch(f, q));
});

const selectedCount = computed(() => selectedFileIds.value.size);

const allVisibleSelected = computed(() => {
  const visible = filteredFiles.value;
  return (
    visible.length > 0 && visible.every((f) => selectedFileIds.value.has(f.id))
  );
});

const someVisibleSelected = computed(() =>
  filteredFiles.value.some((f) => selectedFileIds.value.has(f.id)),
);

const isSelected = (id) => selectedFileIds.value.has(id);

const clearSelection = () => {
  selectedFileIds.value = new Set();
};

const toggleSelect = (id) => {
  const next = new Set(selectedFileIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedFileIds.value = next;
};

/** Select/deselect a row on click; ignore edits and action controls. */
const onRowClick = (event, id) => {
  const target = event.target;
  if (
    !(target instanceof Element) ||
    target.closest("input, select, textarea, button, a, label")
  ) {
    return;
  }
  toggleSelect(id);
};

const toggleSelectAllVisible = () => {
  const visible = filteredFiles.value;
  const next = new Set(selectedFileIds.value);
  if (allVisibleSelected.value) {
    visible.forEach((f) => next.delete(f.id));
  } else {
    visible.forEach((f) => next.add(f.id));
  }
  selectedFileIds.value = next;
};

const deferFileForLater = (file) => {
  file.reviewLater = true;
  const next = new Set(selectedFileIds.value);
  next.delete(file.id);
  selectedFileIds.value = next;
};

const restoreFileFromLater = (file) => {
  file.reviewLater = false;
  const next = new Set(selectedFileIds.value);
  next.delete(file.id);
  selectedFileIds.value = next;
};

const deferSelectedForLater = () => {
  const ids = selectedFileIds.value;
  files.value.forEach((f) => {
    if (ids.has(f.id)) f.reviewLater = true;
  });
  clearSelection();
  if (reviewLaterFiles.value.length) {
    tableView.value = "review_later";
  }
};

const restoreSelectedFromLater = () => {
  const ids = selectedFileIds.value;
  files.value.forEach((f) => {
    if (ids.has(f.id)) f.reviewLater = false;
  });
  clearSelection();
  tableView.value = "active";
};

// Clear selection when switching tabs so bulk actions stay scoped.
watch(tableView, () => {
  clearSelection();
});

const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, i);
  return `${i === 0 ? value : value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

onMounted(() => {
  loadClients();
  restoreClientSelection();
  loadStripNcfSettings();
  loadExportValueFilterSettings();
  individualLimit.refresh();
  batchLimit.refresh();
  rateLimitTimer = setInterval(() => {
    individualLimit.refresh();
    batchLimit.refresh();
  }, 1000);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onRateLimitStorage);
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("beforeunload", onBeforeUnload);
    try {
      const stored = window.localStorage.getItem(PREVIEW_WIDTH_KEY);
      const parsed = stored ? parseInt(stored, 10) : NaN;
      if (Number.isFinite(parsed)) {
        previewWidth.value = clampPreviewWidth(parsed);
      } else {
        previewWidth.value = clampPreviewWidth(PREVIEW_DEFAULT_WIDTH);
      }
    } catch {
      previewWidth.value = PREVIEW_DEFAULT_WIDTH;
    }
  }
});

onBeforeUnmount(() => {
  if (rateLimitTimer) clearInterval(rateLimitTimer);
  if (typeof window !== "undefined") {
    window.removeEventListener("storage", onRateLimitStorage);
    window.removeEventListener("resize", onWindowResize);
    window.removeEventListener("mousemove", onPreviewResizeMove);
    window.removeEventListener("beforeunload", onBeforeUnload);
  }
  closePreview();
  files.value.forEach(revokeFileObjectUrl);
});

// Warn when leaving after a scan (in-app navigation → modal; reload/close →
// browser native dialog). Progress is session-only and is not persisted.
const leaveConfirmOpen = ref(false);
let resolveLeaveNavigation = null;

const hasUnsavedScanProgress = computed(() =>
  files.value.some((f) => f.status !== "pending"),
);

const onBeforeUnload = (event) => {
  if (!hasUnsavedScanProgress.value) return;
  event.preventDefault();
  event.returnValue = "";
};

onBeforeRouteLeave(() => {
  if (!hasUnsavedScanProgress.value) return true;
  leaveConfirmOpen.value = true;
  return new Promise((resolve) => {
    resolveLeaveNavigation = resolve;
  });
});

const confirmLeave = () => {
  leaveConfirmOpen.value = false;
  const resolve = resolveLeaveNavigation;
  resolveLeaveNavigation = null;
  resolve?.(true);
};

const cancelLeave = () => {
  leaveConfirmOpen.value = false;
  const resolve = resolveLeaveNavigation;
  resolveLeaveNavigation = null;
  resolve?.(false);
};

// Refresh immediately if another tab updates either shared counter.
const onRateLimitStorage = (event) => {
  if (event.key === INDIVIDUAL_RATE_LIMIT_KEY) individualLimit.refresh();
  if (event.key === BATCH_RATE_LIMIT_KEY) batchLimit.refresh();
};

const handleFileSelect = async (event) => {
  if (!canScan.value) {
    event.target.value = "";
    return;
  }
  const selectedFiles = Array.from(event.target.files);
  await addFiles(selectedFiles);
  event.target.value = "";
};

const handleDrop = async (event) => {
  event.preventDefault();
  if (!canScan.value) return;
  const droppedFiles = Array.from(event.dataTransfer.files);
  await addFiles(droppedFiles);
};

const createFileItem = (file, sourceId = null) => {
  const rawFile = markRaw(file);
  const isPreviewable =
    rawFile.type?.startsWith("image/") ||
    rawFile.type === "application/pdf" ||
    /\.pdf$/i.test(rawFile.name || "");

  return {
    id: fileIdCounter++,
    sourceId,
    name: rawFile.name,
    file: rawFile,
    // Eager client-side preview URL so the side panel works before any
    // server round-trip (including right after PDF page-splitting).
    objectUrl: isPreviewable ? URL.createObjectURL(rawFile) : null,
    status: "pending",
    // When true, the row lives under "Revisar más tarde" and is omitted
    // from the Excel export (Citrus upload errors can be fixed later).
    reviewLater: false,
    data: null,
    originalData: null,
    editableData: {
      filename: rawFile.name,
      nombre: "",
      documento: "",
      ncf: "",
      ncf_afectado: "",
      tipo_de_suplidor: "",
      tipo_de_gasto: "",
      descripcion: "",
      fecha: "",
      monto_en_servicios: "",
      monto_en_bienes: "",
      itbis: "",
      selectivo: "",
      moneda: "",
      metodo_de_pago: "",
      concepto_id: null,
      tipo_de_pago_id: null,
    },
    score: 0,
    processingTime: null,
  };
};

const revokeFileObjectUrl = (fileItem) => {
  if (fileItem?.objectUrl) {
    URL.revokeObjectURL(fileItem.objectUrl);
    fileItem.objectUrl = null;
  }
};

// Tracks PDFs currently being rasterized so the user sees feedback.
const splittingPdfs = ref(0);

// --- Resizable preview side panel ----------------------------------------
const PREVIEW_WIDTH_KEY = "rcp_preview_panel_width";
const PREVIEW_MIN_WIDTH = 320;
const PREVIEW_MAX_WIDTH_FRACTION = 0.75; // never wider than 75% of viewport
const PREVIEW_DEFAULT_WIDTH = 480;

const previewWidth = ref(PREVIEW_DEFAULT_WIDTH);
const isResizingPreview = ref(false);

const clampPreviewWidth = (w) => {
  const maxAllowed =
    typeof window === "undefined"
      ? 1200
      : Math.max(
          PREVIEW_MIN_WIDTH,
          Math.floor(window.innerWidth * PREVIEW_MAX_WIDTH_FRACTION),
        );
  return Math.min(Math.max(w, PREVIEW_MIN_WIDTH), maxAllowed);
};

const startPreviewResize = (event) => {
  if (typeof window === "undefined") return;
  event.preventDefault();
  isResizingPreview.value = true;
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  window.addEventListener("mousemove", onPreviewResizeMove);
  window.addEventListener("mouseup", stopPreviewResize, { once: true });
};

const onPreviewResizeMove = (event) => {
  if (!isResizingPreview.value || typeof window === "undefined") return;
  const newWidth = clampPreviewWidth(window.innerWidth - event.clientX);
  previewWidth.value = newWidth;
};

const stopPreviewResize = () => {
  if (!isResizingPreview.value) return;
  isResizingPreview.value = false;
  if (typeof window !== "undefined") {
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", onPreviewResizeMove);
    try {
      window.localStorage.setItem(
        PREVIEW_WIDTH_KEY,
        String(previewWidth.value),
      );
    } catch {
      /* localStorage unavailable - silently ignore */
    }
  }
};

const onWindowResize = () => {
  previewWidth.value = clampPreviewWidth(previewWidth.value);
};

const addFiles = async (fileList) => {
  const validTypes = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
  ];

  for (const file of fileList) {
    if (!validTypes.includes(file.type)) {
      alert(`${file.name} no es un tipo de archivo soportado`);
      continue;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      alert(
        `${file.name} pesa ${sizeMb}MB y supera el límite de ${MAX_FILE_SIZE_LABEL} por archivo.`,
      );
      continue;
    }

    if (file.type === "application/pdf") {
      splittingPdfs.value++;
      try {
        const pages = await splitPdfIntoPageFiles(file);
        if (!pages.length) {
          throw new Error("PDF produced 0 pages");
        }
        const sourceId = sourceIdCounter++;
        pages.forEach((pageFile) =>
          files.value.push(createFileItem(pageFile, sourceId)),
        );
        sourceDocuments.value.push({
          id: sourceId,
          name: file.name,
          size: file.size,
          pages: pages.length,
        });
      } catch (err) {
        console.error(`Failed to split ${file.name}:`, err);
        alert(
          `No se pudo dividir "${file.name}" en páginas (${err?.message || err}). ` +
            `Se subirá tal cual.`,
        );
        const sourceId = sourceIdCounter++;
        files.value.push(createFileItem(file, sourceId));
        sourceDocuments.value.push({
          id: sourceId,
          name: file.name,
          size: file.size,
          pages: 1,
        });
      } finally {
        splittingPdfs.value--;
      }
    } else {
      const sourceId = sourceIdCounter++;
      files.value.push(createFileItem(file, sourceId));
      sourceDocuments.value.push({
        id: sourceId,
        name: file.name,
        size: file.size,
        pages: 1,
      });
    }
  }
};

const startEditing = (file) => {
  if (!file.originalData) {
    file.originalData = { ...file.editableData };
  }
};

const descripcionEditorFile = ref(null);
const descripcionTextarea = ref(null);

const openDescripcionEditor = async (file) => {
  startEditing(file);
  descripcionEditorFile.value = file;
  await nextTick();
  descripcionTextarea.value?.focus();
};

const closeDescripcionEditor = () => {
  descripcionEditorFile.value = null;
};

const isEdited = (file) => {
  if (!file.originalData) return false;
  return (
    file.editableData.filename !== file.originalData.filename ||
    file.editableData.nombre !== file.originalData.nombre ||
    file.editableData.documento !== file.originalData.documento ||
    file.editableData.tipo_de_suplidor !== file.originalData.tipo_de_suplidor ||
    file.editableData.tipo_de_gasto !== file.originalData.tipo_de_gasto ||
    file.editableData.fecha !== file.originalData.fecha ||
    file.editableData.monto_en_servicios !==
      file.originalData.monto_en_servicios ||
    file.editableData.monto_en_bienes !== file.originalData.monto_en_bienes ||
    file.editableData.itbis !== file.originalData.itbis ||
    file.editableData.selectivo !== file.originalData.selectivo ||
    file.editableData.moneda !== file.originalData.moneda ||
    file.editableData.metodo_de_pago !== file.originalData.metodo_de_pago ||
    file.editableData.descripcion !== file.originalData.descripcion ||
    file.editableData.ncf !== file.originalData.ncf ||
    file.editableData.ncf_afectado !== file.originalData.ncf_afectado ||
    file.editableData.concepto_id !== file.originalData.concepto_id ||
    file.editableData.tipo_de_pago_id !== file.originalData.tipo_de_pago_id
  );
};

const revertFile = (file) => {
  if (file.originalData) {
    file.editableData = { ...file.originalData };
  }
};

const syncSourceDocumentAfterFileRemoval = (sourceId) => {
  if (sourceId == null) return;
  const srcIdx = sourceDocuments.value.findIndex((d) => d.id === sourceId);
  if (srcIdx < 0) return;
  const remaining = files.value.filter((f) => f.sourceId === sourceId).length;
  if (remaining === 0) {
    sourceDocuments.value.splice(srcIdx, 1);
  } else {
    sourceDocuments.value[srcIdx].pages = remaining;
  }
};

const removeFile = (file) => {
  const index = files.value.findIndex((f) => f.id === file.id);
  if (index > -1) {
    if (previewFile.value?.id === file.id) {
      closePreview();
    }
    if (descripcionEditorFile.value?.id === file.id) {
      closeDescripcionEditor();
    }
    revokeFileObjectUrl(files.value[index]);
    const sourceId = files.value[index].sourceId;
    files.value.splice(index, 1);
    if (selectedFileIds.value.has(file.id)) {
      const next = new Set(selectedFileIds.value);
      next.delete(file.id);
      selectedFileIds.value = next;
    }
    syncSourceDocumentAfterFileRemoval(sourceId);
  }
};

/** Remove an original upload and every table row that came from it. */
const removeSourceDocument = (doc) => {
  const related = files.value.filter((f) => f.sourceId === doc.id);
  if (related.some((f) => previewFile.value?.id === f.id)) {
    closePreview();
  }
  if (related.some((f) => descripcionEditorFile.value?.id === f.id)) {
    closeDescripcionEditor();
  }
  related.forEach(revokeFileObjectUrl);
  files.value = files.value.filter((f) => f.sourceId !== doc.id);
  sourceDocuments.value = sourceDocuments.value.filter((d) => d.id !== doc.id);

  if (related.some((f) => selectedFileIds.value.has(f.id))) {
    const next = new Set(selectedFileIds.value);
    related.forEach((f) => next.delete(f.id));
    selectedFileIds.value = next;
  }

  if (files.value.length === 0) {
    totalProcessingTime.value = 0;
    tableView.value = "active";
    if (fileInput.value) {
      fileInput.value.value = "";
    }
  }
};

// Apply an extracted-data payload from the backend to a file item.
const applyExtractedData = (fileItem, data) => {
  fileItem.data = data;
  fileItem.score = data.score || 0;

  fileItem.editableData = {
    filename: fileItem.name,
    nombre: data.nombre || "",
    documento: String(data.documento || "").replace(/\D/g, ""),
    ncf: normalizeNcf(data.ncf || ""),
    ncf_afectado: normalizeNcf(data.ncf_afectado || "").slice(0, 11),
    tipo_de_suplidor: data.tipo_de_suplidor || "",
    tipo_de_gasto: data.tipo_de_gasto || "",
    descripcion: data.descripcion || "",
    fecha: normalizeFecha(data.fecha || ""),
    monto_en_servicios:
      data.monto_en_servicios || data.monto_en_servicios === 0
        ? String(data.monto_en_servicios)
        : "0",
    monto_en_bienes:
      data.monto_en_bienes || data.monto_en_bienes === 0
        ? String(data.monto_en_bienes)
        : "0",
    itbis: data.itbis || data.itbis === 0 ? String(data.itbis) : "0",
    selectivo:
      data.selectivo || data.selectivo === 0 ? String(data.selectivo) : "0",
    moneda: data.moneda || "",
    metodo_de_pago: data.metodo_de_pago || "",
    concepto_id: data.concepto_id ?? null,
    tipo_de_pago_id: data.tipo_de_pago_id ?? null,
  };

  const hasData =
    data.nombre ||
    data.documento ||
    data.ncf ||
    data.tipo_de_suplidor ||
    data.tipo_de_gasto ||
    data.fecha ||
    data.monto_en_bienes > 0 ||
    data.monto_en_servicios > 0 ||
    data.score > 0;

  if (hasData) {
    fileItem.status = "done";
    fileItem.originalData = { ...fileItem.editableData };
  } else {
    fileItem.status = "needs_retry";
  }
};

const runSingleFileEvaluation = async (fileItem) => {
  if (individualLimit.isLimited.value) {
    alert(
      `Límite de evaluación individual alcanzado ` +
        `(${INDIVIDUAL_RPM} solicitudes / minuto). ` +
        `Reintenta en ${individualLimit.label.value}.`,
    );
    return;
  }

  const previousStatus = fileItem.status;
  fileItem.status = "retrying";
  const startTime = performance.now();
  individualLimit.record(1);

  console.log(
    `[Upload] Sending "${fileItem.name}" to ${API_BASE}/upload ` +
      `(file=${fileItem.file?.name}, type=${fileItem.file?.type}, ` +
      `size=${fileItem.file?.size ?? "?"} bytes)`,
  );
  if (!fileItem.file || fileItem.file.size === 0) {
    console.warn(
      `[Upload] "${fileItem.name}": underlying file is missing or 0 bytes - ` +
        `the request will send an empty/invalid file to the API.`,
    );
  }

  try {
    const formData = new FormData();
    formData.append("file", fileItem.file);
    if (conceptoCatalogPayload.value.length) {
      formData.append(
        "concepto_catalog",
        JSON.stringify(conceptoCatalogPayload.value),
      );
    }
    if (tipoDePagoCatalogPayload.value.length) {
      formData.append(
        "tipo_de_pago_catalog",
        JSON.stringify(tipoDePagoCatalogPayload.value),
      );
    }
    formData.append("concepto_document_comment", conceptoDocumentComment.value);
    formData.append(
      "tipo_de_pago_document_comment",
      tipoDePagoDocumentComment.value,
    );
    if (businessRulesPayload.value.length) {
      formData.append(
        "business_rules",
        JSON.stringify(businessRulesPayload.value),
      );
    }
    if (tipoDeGastoContextPayload.value.length) {
      formData.append(
        "tipo_de_gasto_context",
        JSON.stringify(tipoDeGastoContextPayload.value),
      );
    }
    formData.append(
      "tipo_de_gasto_document_comment",
      tipoDeGastoDocumentComment.value,
    );

    const response = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
    });

    console.log(
      `[Upload] "${fileItem.name}": response status ${response.status} ${response.statusText}`,
    );

    const result = await response.json();
    console.log(`[Upload] "${fileItem.name}": response body`, result);
    const endTime = performance.now();
    fileItem.processingTime = endTime - startTime;

    if (result.status === "success") {
      applyExtractedData(fileItem, result.data);
    } else if (result.status === "duplicate") {
      fileItem.status = "duplicate";
      fileItem.duplicateMessage = result.message || "Posible recibo duplicado.";
      if (result.data) {
        fileItem.data = result.data;
      }
    } else {
      console.error(
        `[Upload] "${fileItem.name}": API returned non-success status`,
        result,
      );
      fileItem.status = "error";
    }
  } catch (error) {
    console.error(`[Upload] "${fileItem.name}": request failed`, error);
    fileItem.status = previousStatus === "done" ? "done" : "error";
    const endTime = performance.now();
    fileItem.processingTime = endTime - startTime;
  }
};

const retryFile = (fileItem) => runSingleFileEvaluation(fileItem);
const reevaluateFile = (fileItem) => runSingleFileEvaluation(fileItem);

const isImageFile = (file) => {
  return file.file.type.startsWith("image/");
};

const isPdfFile = (file) => {
  return (
    file?.file?.type === "application/pdf" || /\.pdf$/i.test(file?.name || "")
  );
};

const getFileExtension = (fileItem) => {
  const name = fileItem?.name || "";
  const idx = name.lastIndexOf(".");
  if (idx === -1 || idx === name.length - 1) return "FILE";
  return name.slice(idx + 1).toUpperCase();
};

const getExtensionClasses = (ext) => {
  switch (ext) {
    case "PDF":
      return "bg-red-100 text-red-700";
    case "PNG":
      return "bg-blue-100 text-blue-700";
    case "JPG":
    case "JPEG":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-gray-100 text-slate-600";
  }
};

const openPreview = (file) => {
  console.log(
    `[Preview] Opening preview for "${file.name}" ` +
      `(type=${file.file?.type || "unknown"}, size=${file.file?.size ?? "?"} bytes)`,
  );

  previewFile.value = file;

  if (file.objectUrl) {
    previewUrl.value = file.objectUrl;
    console.log(`[Preview] "${file.name}": using stored object URL`);
    return;
  }

  if (isImageFile(file) || isPdfFile(file)) {
    if (!file.file || file.file.size === 0) {
      console.warn(
        `[Preview] "${file.name}": underlying file is missing or 0 bytes - ` +
          `preview will likely appear blank.`,
      );
    }
    // Fallback for older items that somehow lack an eager URL.
    file.objectUrl = URL.createObjectURL(file.file);
    previewUrl.value = file.objectUrl;
    console.log(
      `[Preview] "${file.name}": created object URL ${previewUrl.value}`,
    );
  } else {
    console.log(
      `[Preview] "${file.name}": no preview available for this file type`,
    );
    previewUrl.value = null;
  }
};

const onPreviewImageLoad = (event) => {
  const img = event.target;
  console.log(
    `[Preview] Image loaded successfully: ${img.naturalWidth}x${img.naturalHeight}px`,
  );
  if (img.naturalWidth === 0 || img.naturalHeight === 0) {
    console.warn(
      "[Preview] Loaded image has 0 dimensions - it is likely corrupt or empty.",
    );
  }
};

const onPreviewImageError = (event) => {
  console.error(
    `[Preview] Failed to load preview image for "${previewFile.value?.name}". ` +
      `The object URL may be invalid or the underlying blob is corrupt.`,
    event,
  );
};

const closePreview = () => {
  // Do not revoke here — objectUrl is owned by the file item until remove/clear.
  previewFile.value = null;
  previewUrl.value = null;
};

const getStatusLabel = (status) => {
  const labels = {
    pending: "Pendiente",
    processing: "Procesando",
    done: "Listo",
    duplicate: "Duplicado",
    error: "Error",
    needs_retry: "Reintentar",
    retrying: "Reintentando",
  };
  return labels[status] || status;
};

const getStatusClasses = (status) => {
  const classes = {
    pending: "bg-amber-100 text-amber-700",
    processing: "bg-blue-100 text-blue-700 animate-pulse",
    done: "bg-emerald-100 text-emerald-700",
    duplicate: "bg-orange-100 text-orange-700",
    error: "bg-red-100 text-red-700",
    needs_retry: "bg-rose-100 text-rose-700",
    retrying: "bg-blue-100 text-blue-700 animate-pulse",
  };
  return classes[status] || "bg-gray-100 text-slate-600";
};

const getScoreClasses = (score) => {
  if (score === 3) return "bg-emerald-100 text-emerald-700";
  if (score === 2) return "bg-amber-100 text-amber-700";
  if (score === 1) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-slate-600";
};

const formatTime = (milliseconds) => {
  if (milliseconds < 1000) {
    return `${milliseconds.toFixed(0)}ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = ((milliseconds % 60000) / 1000).toFixed(2);
    return `${minutes}m ${seconds}s`;
  }
};

const processAll = async () => {
  if (!canScan.value) {
    alert("Selecciona un cliente y sus documentos de ERP antes de procesar.");
    return;
  }
  processing.value = true;
  totalProcessingTime.value = 0;
  const overallStartTime = performance.now();

  const pendingFiles = files.value.filter(
    (f) => f.status === "pending" && !f.reviewLater,
  );
  const BATCH_SIZE = 25;
  let stoppedForCooldown = false;

  for (let i = 0; i < pendingFiles.length; i += BATCH_SIZE) {
    if (batchLimit.isLimited.value) {
      stoppedForCooldown = true;
      break;
    }

    const batch = pendingFiles.slice(i, i + BATCH_SIZE);

    batch.forEach((f) => {
      f.status = "processing";
    });

    const batchStart = performance.now();
    batchLimit.record(1);

    console.log(
      `[Batch Upload] Sending batch ${Math.floor(i / BATCH_SIZE) + 1} ` +
        `(${batch.length} file(s)) to ${API_BASE}/upload-batch:`,
      batch.map((f) => ({
        name: f.name,
        type: f.file?.type,
        size: f.file?.size,
      })),
    );

    const emptyFiles = batch.filter((f) => !f.file || f.file.size === 0);
    if (emptyFiles.length > 0) {
      console.warn(
        `[Batch Upload] ${emptyFiles.length} file(s) in this batch are missing ` +
          `or 0 bytes:`,
        emptyFiles.map((f) => f.name),
      );
    }

    try {
      const formData = new FormData();
      batch.forEach((fileItem) => {
        formData.append("files", fileItem.file, fileItem.name);
      });
      if (conceptoCatalogPayload.value.length) {
        formData.append(
          "concepto_catalog",
          JSON.stringify(conceptoCatalogPayload.value),
        );
      }
      if (tipoDePagoCatalogPayload.value.length) {
        formData.append(
          "tipo_de_pago_catalog",
          JSON.stringify(tipoDePagoCatalogPayload.value),
        );
      }
      formData.append(
        "concepto_document_comment",
        conceptoDocumentComment.value,
      );
      formData.append(
        "tipo_de_pago_document_comment",
        tipoDePagoDocumentComment.value,
      );
      if (businessRulesPayload.value.length) {
        formData.append(
          "business_rules",
          JSON.stringify(businessRulesPayload.value),
        );
      }
      if (tipoDeGastoContextPayload.value.length) {
        formData.append(
          "tipo_de_gasto_context",
          JSON.stringify(tipoDeGastoContextPayload.value),
        );
      }
      formData.append(
        "tipo_de_gasto_document_comment",
        tipoDeGastoDocumentComment.value,
      );

      const response = await fetch(`${API_BASE}/upload-batch`, {
        method: "POST",
        body: formData,
      });

      console.log(
        `[Batch Upload] Response status ${response.status} ${response.statusText}`,
      );

      if (!response.ok) {
        throw new Error(
          `Batch upload failed: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      console.log("[Batch Upload] Response body:", result);
      const batchEnd = performance.now();
      const perFileTime = (batchEnd - batchStart) / batch.length;

      const results = Array.isArray(result?.results) ? result.results : [];

      batch.forEach((fileItem, idx) => {
        fileItem.processingTime = perFileTime;
        const fileResult = results[idx];

        if (!fileResult) {
          console.error(
            `[Batch Upload] "${fileItem.name}": no matching result at index ${idx} in response`,
          );
          fileItem.status = "error";
          return;
        }

        if (fileResult.status === "duplicate") {
          fileItem.status = "duplicate";
          fileItem.duplicateMessage =
            fileResult.message || "Posible recibo duplicado.";
          if (fileResult.data) {
            fileItem.data = fileResult.data;
          }
          console.info(
            `[Batch Upload] "${fileItem.name}": marked as duplicate - ${fileItem.duplicateMessage}`,
          );
        } else if (fileResult.status === "success" && fileResult.data) {
          const data = fileResult.data;
          const hasAnyData =
            data.nombre || data.documento || data.ncf || data.fecha;
          if (!hasAnyData) {
            console.warn(
              `[Batch Upload] "${fileItem.name}": API returned success but all ` +
                `key fields are empty (score=${data.score}). The image sent for ` +
                `this file may be blank/unreadable - check the server logs and ` +
                `the preview for this file.`,
            );
          }
          applyExtractedData(fileItem, data);
        } else {
          console.error(
            `[Batch Upload] "${fileItem.name}": unexpected result`,
            fileResult,
          );
          fileItem.status = "error";
        }
      });
    } catch (error) {
      console.error("[Batch Upload] Error processing batch:", error);
      const batchEnd = performance.now();
      const perFileTime = (batchEnd - batchStart) / batch.length;
      batch.forEach((fileItem) => {
        fileItem.processingTime = perFileTime;
        if (fileItem.status === "processing") {
          fileItem.status = "error";
        }
      });
    }
  }

  const overallEndTime = performance.now();
  totalProcessingTime.value = overallEndTime - overallStartTime;
  processing.value = false;

  if (stoppedForCooldown) {
    console.info(
      `Process All stopped early: batch rate limit reached. ` +
        `Resume in ${batchLimit.label.value}.`,
    );
  }
};

// --- Suplidores summary before download ----------------------------------
// SuplidorSummaryRow shape: { nombre, documento, tipo_de_factura, registered_on_platform }

const showSuplidorSummary = ref(false);
const suplidorSummaryRows = ref([]);
const suplidorSummaryTogglingId = ref(null);
const suplidorSaveError = ref(null);
const suplidorSaving = ref(false);

async function buildSuplidorSummary() {
  if (!selectedClientId.value) return [];
  const exportable = getExportableFiles();
  const uniqueMap = new Map();
  for (const f of exportable) {
    const d = f.editableData;
    const doc = String(d.documento || "")
      .replace(/\D/g, "")
      .slice(0, 20);
    const nombre = (d.nombre || "").trim();
    if (!nombre) continue;
    const key = doc || nombre;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, {
        nombre,
        documento: doc,
        tipo_de_factura: d.tipo_de_suplidor || "",
      });
    }
  }
  if (!uniqueMap.size) return [];

  // Load existing suplidores to check registered status
  let existing = [];
  try {
    existing = await listSuplidoresByClient(selectedClientId.value);
  } catch (_) {
    // non-blocking — summary still shown without registered status
  }
  const registeredDocs = new Set(
    existing
      .filter((s) => s.registered_on_platform)
      .map((s) => s.documento ?? ""),
  );
  const registeredNames = new Set(
    existing
      .filter((s) => s.registered_on_platform && !s.documento)
      .map((s) => s.nombre),
  );

  return [...uniqueMap.values()].map((s) => ({
    ...s,
    registered_on_platform:
      (s.documento && registeredDocs.has(s.documento)) ||
      (!s.documento && registeredNames.has(s.nombre)),
  }));
}

async function openSuplidorSummary() {
  suplidorSummaryRows.value = await buildSuplidorSummary();
  showSuplidorSummary.value = true;
}

async function saveSuplidoresAndDownload() {
  if (selectedClientId.value && suplidorSummaryRows.value.length > 0) {
    suplidorSaving.value = true;
    suplidorSaveError.value = null;
    try {
      await upsertFromScan(
        selectedClientId.value,
        suplidorSummaryRows.value.map((s) => ({
          nombre: s.nombre,
          documento: s.documento || null,
          tipo_de_factura: s.tipo_de_factura || null,
        })),
      );
    } catch (e) {
      suplidorSaveError.value = e?.message || "Error guardando suplidores.";
    } finally {
      suplidorSaving.value = false;
    }
  }
  showSuplidorSummary.value = false;
  await downloadExcel();
}

const buildCargaMasivaFilename = () => {
  const client = clients.value.find((c) => c.id === selectedClientId.value);
  const rawName = (client?.name || "cliente").trim() || "cliente";
  const clientName = rawName
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp =
    [pad(now.getDate()), pad(now.getMonth() + 1), now.getFullYear()].join("_") +
    `_${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `${clientName || "cliente"}-carga_masiva_gastos-${stamp}.xls`;
};

const downloadExcel = async () => {
  try {
    const filesData = getExportableFiles().map((f) => {
      const d = f.editableData;
      return {
        filename: d.filename,
        nombre: applyStripNcfForColumn(
          "nombre",
          (d.nombre || "").slice(0, 255),
        ),
        documento: applyStripNcfForColumn(
          "documento",
          String(d.documento || "").replace(/\D/g, ""),
        ),
        ncf: applyStripNcfForColumn("ncf", d.ncf || ""),
        ncf_afectado: applyStripNcfForColumn(
          "ncf_afectado",
          d.ncf_afectado || "",
        ).slice(0, 11),
        tipo_de_suplidor: d.tipo_de_suplidor || "",
        tipo_de_gasto: d.tipo_de_gasto || "",
        descripcion: applyStripNcfForColumn(
          "descripcion",
          (d.descripcion || "").slice(0, 200),
        ),
        fecha: normalizeFecha(d.fecha || ""),
        monto_en_servicios: d.monto_en_servicios || "0",
        monto_en_bienes: d.monto_en_bienes || "0",
        itbis: d.itbis || "0",
        selectivo: d.selectivo || "0",
        moneda: d.moneda || "",
        metodo_de_pago: d.metodo_de_pago || "",
        concepto_id: d.concepto_id,
        tipo_de_pago_id: d.tipo_de_pago_id,
      };
    });

    if (!filesData.length) {
      alert(
        "No hay filas para exportar con los filtros actuales. Revisa los valores incluidos/excluidos o incluye filas de «Revisar más tarde».",
      );
      return;
    }

    const response = await fetch(`${API_BASE}/download`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(filesData),
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildCargaMasivaFilename();
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error("Error downloading file:", error);
    alert("Error al descargar el archivo Excel");
  }
};

const clearFiles = () => {
  closePreview();
  files.value.forEach(revokeFileObjectUrl);
  files.value = [];
  sourceDocuments.value = [];
  totalProcessingTime.value = 0;
  clearSelection();
  tableView.value = "active";
  if (fileInput.value) {
    fileInput.value.value = "";
  }
};
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from {
  transform: translateX(100%);
}

.slide-leave-to {
  transform: translateX(100%);
}
</style>
