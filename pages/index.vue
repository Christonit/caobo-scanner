<template>
  <div class="min-h-screen px-8 py-8">
    <div class="mx-auto flex max-w-6xl gap-8">
      <!-- Main column -->
      <div class="min-w-0 flex-1">
        <!-- Header -->
        <header class="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-gray-900">
              Extraer información
            </h1>
            <p class="mt-1 text-sm text-gray-500">
              Sube documentos para extraer su información automáticamente.
              Soporta PDF, PNG y JPG.
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
          class="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div class="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold text-gray-900">Cliente</h2>
              <p class="mt-0.5 text-sm text-gray-500">
                Selecciona el cliente y los documentos de ERP que se usarán
                para clasificar Concepto Id y Tipo de Pago Id.
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
                <option v-for="doc in clientDocuments" :key="doc.id" :value="doc.id">
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
                <option v-for="doc in clientDocuments" :key="doc.id" :value="doc.id">
                  {{ doc.document_name }} ({{ doc.document_attributes.length }}
                  atributos)
                </option>
              </select>
            </div>
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
            Selecciona un cliente y sus documentos de Concepto Id / Tipo de
            Pago Id antes de subir o procesar archivos.
          </p>
        </section>

        <!-- Add files card -->
        <section
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
            <div
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
            </div>

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
                {{ MAX_FILE_SIZE_LABEL }} por archivo · los PDF se dividen en
                una fila por página
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
              <span class="font-mono font-bold">{{
                batchLimit.label.value
              }}</span
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
            <h2 class="text-base font-semibold text-gray-900">
              Información escaneada
              <span
                class="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500"
                >{{ files.length }}</span
              >
            </h2>
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

          <div
            class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
          >
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th
                      v-for="col in columns"
                      :key="col"
                      class="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                      :class="
                        col === 'Preview' || col === 'Acciones'
                          ? 'text-center'
                          : ''
                      "
                    >
                      {{ col }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr
                    v-for="file in filteredFiles"
                    :key="file.id"
                    class="transition-colors hover:bg-gray-50"
                    :class="{ 'bg-amber-50': isEdited(file) }"
                  >
                    <!-- File Name -->
                    <td class="px-4 py-2.5">
                      <input
                        type="text"
                        v-model="file.editableData.filename"
                        @focus="startEditing(file)"
                        class="w-44 rounded border border-transparent bg-transparent px-2 py-1 font-medium text-gray-700 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                      />
                    </td>
                    <!-- Type -->
                    <td class="px-4 py-2.5">
                      <span
                        class="inline-flex rounded-md px-2 py-0.5 font-mono text-xs font-semibold"
                        :class="getExtensionClasses(getFileExtension(file))"
                      >
                        {{ getFileExtension(file) }}
                      </span>
                    </td>
                    <!-- Status -->
                    <td class="px-4 py-2.5">
                      <span
                        class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        :class="getStatusClasses(file.status)"
                      >
                        {{ getStatusLabel(file.status) }}
                      </span>
                    </td>
                    <!-- Score -->
                    <td class="px-4 py-2.5">
                      <span
                        v-if="file.score > 0"
                        class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        :class="getScoreClasses(file.score)"
                      >
                        {{ file.score }}
                      </span>
                      <span v-else class="text-gray-300">-</span>
                    </td>
                    <!-- Processing Time -->
                    <td class="px-4 py-2.5">
                      <span
                        v-if="file.processingTime"
                        class="font-mono text-sm text-gray-500"
                      >
                        {{ formatTime(file.processingTime) }}
                      </span>
                      <span v-else class="text-gray-300">-</span>
                    </td>
                    <!-- Nombre -->
                    <td class="px-4 py-2.5">
                      <input
                        type="text"
                        v-model="file.editableData.nombre"
                        maxlength="255"
                        @focus="startEditing(file)"
                        class="w-36 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-gray-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                        placeholder="-"
                      />
                    </td>
                    <!-- Documento -->
                    <td class="px-4 py-2.5">
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
                        class="w-28 rounded border border-transparent bg-transparent px-2 py-1 font-mono text-sm text-gray-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                        placeholder="-"
                      />
                    </td>
                    <!-- NCF -->
                    <td class="px-4 py-2.5">
                      <input
                        type="text"
                        v-model="file.editableData.ncf"
                        @focus="startEditing(file)"
                        class="w-36 rounded border border-transparent bg-transparent px-2 py-1 font-mono text-sm text-gray-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                        placeholder="-"
                      />
                    </td>
                    <!-- NCF Afectado -->
                    <td class="px-4 py-2.5">
                      <input
                        type="text"
                        v-model="file.editableData.ncf_afectado"
                        maxlength="11"
                        @focus="startEditing(file)"
                        class="w-28 rounded border border-transparent bg-transparent px-2 py-1 font-mono text-sm text-gray-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                        :class="{
                          'ring-1 ring-amber-400': requiresNcfAfectado(
                            file.editableData.ncf,
                          ) && !file.editableData.ncf_afectado,
                        }"
                        placeholder="-"
                        :title="
                          requiresNcfAfectado(file.editableData.ncf)
                            ? 'Obligatorio cuando NCF es B03 o B04'
                            : ''
                        "
                      />
                    </td>
                    <!-- Tipo de Suplidor -->
                    <td class="px-4 py-2.5">
                      <select
                        v-model="file.editableData.tipo_de_suplidor"
                        @focus="startEditing(file)"
                        class="w-36 rounded border border-transparent bg-transparent px-1 py-1 text-sm text-gray-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
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
                    <td class="px-4 py-2.5">
                      <select
                        v-model="file.editableData.tipo_de_gasto"
                        @focus="startEditing(file)"
                        class="w-64 rounded border border-transparent bg-transparent px-1 py-1 text-sm text-gray-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
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
                    <td class="px-4 py-2.5">
                      <input
                        type="text"
                        v-model="file.editableData.descripcion"
                        maxlength="200"
                        @focus="startEditing(file)"
                        class="w-36 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-gray-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                        placeholder="-"
                      />
                    </td>
                    <!-- Fecha -->
                    <td class="px-4 py-2.5">
                      <input
                        type="text"
                        v-model="file.editableData.fecha"
                        @focus="startEditing(file)"
                        @blur="
                          file.editableData.fecha = normalizeFecha(
                            file.editableData.fecha,
                          )
                        "
                        class="w-24 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-gray-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                        placeholder="DD/MM/AAAA"
                      />
                    </td>
                    <!-- Monto en Servicios -->
                    <td class="px-4 py-2.5">
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
                    <td class="px-4 py-2.5">
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
                    <td class="px-4 py-2.5">
                      <div class="flex items-center">
                        <span class="mr-1 text-sm text-gray-400">$</span>
                        <input
                          type="text"
                          v-model="file.editableData.itbis"
                          @focus="startEditing(file)"
                          class="w-20 rounded border border-transparent bg-transparent px-2 py-1 font-mono text-sm text-gray-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                          placeholder="-"
                        />
                      </div>
                    </td>
                    <!-- Selectivo -->
                    <td class="px-4 py-2.5">
                      <div class="flex items-center">
                        <span class="mr-1 text-sm text-gray-400">$</span>
                        <input
                          type="text"
                          v-model="file.editableData.selectivo"
                          @focus="startEditing(file)"
                          class="w-20 rounded border border-transparent bg-transparent px-2 py-1 font-mono text-sm text-gray-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                          placeholder="-"
                        />
                      </div>
                    </td>
                    <!-- Moneda -->
                    <td class="px-4 py-2.5">
                      <input
                        type="text"
                        v-model="file.editableData.moneda"
                        @focus="startEditing(file)"
                        class="w-20 rounded border border-transparent bg-transparent px-2 py-1 font-mono text-sm uppercase text-gray-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                        placeholder="-"
                      />
                    </td>
                    <!-- Forma de Pago -->
                    <td class="px-4 py-2.5">
                      <input
                        type="text"
                        v-model="file.editableData.metodo_de_pago"
                        @focus="startEditing(file)"
                        class="w-40 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-gray-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                        placeholder="-"
                      />
                    </td>
                    <!-- Concepto Id -->
                    <td class="px-4 py-2.5">
                      <select
                        v-model="file.editableData.concepto_id"
                        @focus="startEditing(file)"
                        class="w-48 rounded border border-transparent bg-transparent px-1 py-1 text-sm text-gray-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                      >
                        <option :value="null">-</option>
                        <option
                          v-if="
                            file.editableData.concepto_id !== null &&
                            !conceptoOptions.some(
                              (o) => o.document_id === file.editableData.concepto_id,
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
                    <td class="px-4 py-2.5">
                      <select
                        v-model="file.editableData.tipo_de_pago_id"
                        @focus="startEditing(file)"
                        class="w-48 rounded border border-transparent bg-transparent px-1 py-1 text-sm text-gray-600 transition-colors hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                      >
                        <option :value="null">-</option>
                        <option
                          v-if="
                            file.editableData.tipo_de_pago_id !== null &&
                            !tipoDePagoOptions.some(
                              (o) => o.document_id === file.editableData.tipo_de_pago_id,
                            )
                          "
                          :value="file.editableData.tipo_de_pago_id"
                        >
                          Id {{ file.editableData.tipo_de_pago_id }} (fuera de catálogo)
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
                    <!-- Preview Button -->
                    <td class="px-4 py-2.5 text-center">
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
                    <td class="px-4 py-2.5 text-center">
                      <div class="flex items-center justify-center gap-1.5">
                        <button
                          v-if="
                            file.status === 'needs_retry' ||
                            file.status === 'error'
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
          </div>
        </section>
      </div>

      <!-- Data sources side panel -->
      <aside v-if="files.length > 0" class="hidden w-72 flex-shrink-0 lg:block">
        <div class="sticky top-8 space-y-4">
          <h2 class="text-sm font-semibold text-gray-900">Data sources</h2>

          <div
            class="overflow-hidden rounded-xl border border-gray-200 bg-white"
          >
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
                class="flex items-center justify-between gap-2 text-xs text-gray-600"
              >
                <span class="truncate">{{ doc.name }}</span>
                <span
                  class="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-500"
                  >{{ doc.pages }} entradas</span
                >
              </li>
            </ul>
          </div>

          <!-- Actions -->
          <div class="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
            <button
              @click="processAll"
              :disabled="
                !canScan ||
                processing ||
                batchLimit.isLimited.value ||
                files.every((f) => f.status !== 'pending')
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
              @click="canScan && fileInput?.click()"
              :disabled="!canScan"
              class="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cargar más documentos
            </button>
            <button
              @click="clearFiles"
              class="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Descartar todos
            </button>
            <button
              v-if="files.some((f) => f.status === 'done')"
              @click="downloadExcel"
              class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Descargar Excel
            </button>
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
      <div
        v-if="previewFile"
        class="fixed right-0 top-0 z-40 flex h-full flex-col border-l border-gray-200 bg-white shadow-2xl"
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
            <p class="text-sm text-gray-600">{{ previewFile.name }}</p>
            <p class="mt-2 text-xs text-gray-400">
              Vista previa no disponible.
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, markRaw } from "vue";

const API_BASE = useApiBase();

// --- Client + ERP catalog selection (mandatory before scanning) ----------
const { list: listClients } = useClients();
const { listByClient } = useClientDocuments();

const clients = ref([]);
const clientsLoading = ref(false);
const clientsError = ref(null);

const selectedClientId = ref("");
const selectedConceptoDocId = ref("");
const selectedTipoDePagoDocId = ref("");

const clientDocuments = ref([]);
const clientDocumentsLoading = ref(false);
const clientDocumentsError = ref(null);

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

const onClientChange = async () => {
  selectedConceptoDocId.value = "";
  selectedTipoDePagoDocId.value = "";
  clientDocuments.value = [];
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
};

// --- UI state -------------------------------------------------------------
const addFilesOpen = ref(true);
const search = ref("");

const columns = [
  "File Name",
  "Type",
  "Status",
  "Score",
  "Processing Time",
  "Nombre",
  "Documento",
  "NCF",
  "NCF Afectado",
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
  "Preview",
  "Acciones",
];

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
    .trim()
    .toUpperCase();
  return value.startsWith("B03") || value.startsWith("B04");
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
let fileIdCounter = 0;
let sourceIdCounter = 0;
let rateLimitTimer = null;

const totalSourceSize = computed(() =>
  sourceDocuments.value.reduce((sum, d) => sum + d.size, 0),
);

const multipageDocuments = computed(() =>
  sourceDocuments.value.filter((d) => d.pages > 1),
);

const filteredFiles = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return files.value;
  return files.value.filter((f) => {
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
  });
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
  individualLimit.refresh();
  batchLimit.refresh();
  rateLimitTimer = setInterval(() => {
    individualLimit.refresh();
    batchLimit.refresh();
  }, 1000);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onRateLimitStorage);
    window.addEventListener("resize", onWindowResize);
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
  }
  closePreview();
  files.value.forEach(revokeFileObjectUrl);
});

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

const createFileItem = (file) => {
  const rawFile = markRaw(file);
  const isPreviewable =
    rawFile.type?.startsWith("image/") ||
    rawFile.type === "application/pdf" ||
    /\.pdf$/i.test(rawFile.name || "");

  return {
    id: fileIdCounter++,
    name: rawFile.name,
    file: rawFile,
    // Eager client-side preview URL so the side panel works before any
    // server round-trip (including right after PDF page-splitting).
    objectUrl: isPreviewable ? URL.createObjectURL(rawFile) : null,
    status: "pending",
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
        pages.forEach((pageFile) => files.value.push(createFileItem(pageFile)));
        sourceDocuments.value.push({
          id: sourceIdCounter++,
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
        files.value.push(createFileItem(file));
        sourceDocuments.value.push({
          id: sourceIdCounter++,
          name: file.name,
          size: file.size,
          pages: 1,
        });
      } finally {
        splittingPdfs.value--;
      }
    } else {
      files.value.push(createFileItem(file));
      sourceDocuments.value.push({
        id: sourceIdCounter++,
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

const removeFile = (file) => {
  const index = files.value.findIndex((f) => f.id === file.id);
  if (index > -1) {
    if (previewFile.value?.id === file.id) {
      closePreview();
    }
    revokeFileObjectUrl(files.value[index]);
    files.value.splice(index, 1);
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
    ncf: data.ncf || "",
    ncf_afectado: data.ncf_afectado || "",
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
      return "bg-gray-100 text-gray-600";
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
  return classes[status] || "bg-gray-100 text-gray-600";
};

const getScoreClasses = (score) => {
  if (score === 3) return "bg-emerald-100 text-emerald-700";
  if (score === 2) return "bg-amber-100 text-amber-700";
  if (score === 1) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
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

  const pendingFiles = files.value.filter((f) => f.status === "pending");
  const BATCH_SIZE = 15;
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
  const stamp = [
    pad(now.getDate()),
    pad(now.getMonth() + 1),
    now.getFullYear(),
  ].join("_") + `_${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `${clientName || "cliente"}-carga_masiva_gastos-${stamp}.xls`;
};

const downloadExcel = async () => {
  try {
    const filesData = files.value
      .filter((f) => f.status === "done")
      .map((f) => ({
        filename: f.editableData.filename,
        nombre: (f.editableData.nombre || "").slice(0, 255),
        documento: String(f.editableData.documento || "").replace(/\D/g, ""),
        ncf: f.editableData.ncf || "",
        ncf_afectado: String(f.editableData.ncf_afectado || "").slice(0, 11),
        tipo_de_suplidor: f.editableData.tipo_de_suplidor || "",
        tipo_de_gasto: f.editableData.tipo_de_gasto || "",
        descripcion: (f.editableData.descripcion || "").slice(0, 200),
        fecha: normalizeFecha(f.editableData.fecha || ""),
        monto_en_servicios: f.editableData.monto_en_servicios || "0",
        monto_en_bienes: f.editableData.monto_en_bienes || "0",
        itbis: f.editableData.itbis || "0",
        selectivo: f.editableData.selectivo || "0",
        moneda: f.editableData.moneda || "",
        metodo_de_pago: f.editableData.metodo_de_pago || "",
        concepto_id: f.editableData.concepto_id,
        tipo_de_pago_id: f.editableData.tipo_de_pago_id,
      }));

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
