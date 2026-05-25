<template>
  <div
    class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
  >
    <div
      class="px-6 py-12 transition-[margin] duration-200"
      :style="previewFile ? { marginRight: `${previewWidth}px` } : null"
    >
      <!-- Header -->
      <header class="mb-12 max-w-7xl mx-auto">
        <h1
          class="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 tracking-tight"
        >
          Receipt Processor
        </h1>
        <p class="mt-2 text-slate-400 text-lg">
          Upload, process, and export your receipts
        </p>
      </header>

      <!-- File Upload Area -->
      <div class="max-w-4xl mx-auto mb-10">
        <div
          class="group relative border-2 border-dashed border-slate-600 rounded-2xl p-12 text-center bg-slate-800/50 backdrop-blur transition-all duration-300 hover:border-emerald-500/70 hover:bg-slate-800/80 cursor-pointer"
          @drop="handleDrop"
          @dragover.prevent
          @dragenter.prevent
          @click="$refs.fileInput.click()"
        >
          <input
            ref="fileInput"
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg"
            @change="handleFileSelect"
            class="hidden"
          />
          <div class="space-y-4">
            <div
              class="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
            >
              <svg
                class="w-8 h-8 text-emerald-400"
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
            <div>
              <p class="text-slate-300 text-lg">Drag and drop files here or</p>
              <button
                @click.stop="$refs.fileInput.click()"
                class="mt-3 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-lg shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 hover:-translate-y-0.5"
              >
                Select Files
              </button>
            </div>
            <p class="text-sm text-slate-500">
              Supports: PDF, PNG, JPG, JPEG · Max {{ MAX_FILE_SIZE_LABEL }} per
              file · PDFs are split into one row per page
            </p>
            <p
              v-if="splittingPdfs > 0"
              class="text-sm text-cyan-300 flex items-center justify-center gap-2"
            >
              <svg
                class="animate-spin w-4 h-4"
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
              Splitting {{ splittingPdfs }} PDF{{
                splittingPdfs === 1 ? "" : "s"
              }}
              into pages...
            </p>
          </div>
        </div>
      </div>

      <!-- Rate limit / cooldown banner -->
      <div
        v-if="batchLimit.isLimited.value || individualLimit.isLimited.value"
        class="max-w-4xl mx-auto mb-6 px-5 py-4 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-200 flex items-start gap-3"
      >
        <svg
          class="w-6 h-6 flex-shrink-0 text-rose-300 mt-0.5"
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
        <div class="flex-1 space-y-1.5">
          <p v-if="batchLimit.isLimited.value" class="text-sm">
            <span class="font-semibold">Process All Files</span>
            cooldown ({{ batchLimit.used.value }} / {{ BATCH_RPM }} per minute ·
            gemini-3.5-flash) — try again in
            <span class="font-mono font-bold text-rose-100">{{
              batchLimit.label.value
            }}</span
            >.
          </p>
          <p v-if="individualLimit.isLimited.value" class="text-sm">
            <span class="font-semibold">Retry / Reevaluate</span>
            cooldown ({{ individualLimit.used.value }} /
            {{ INDIVIDUAL_RPM }} per minute · gemma-4-26b) — try again in
            <span class="font-mono font-bold text-rose-100">{{
              individualLimit.label.value
            }}</span
            >.
          </p>
        </div>
      </div>

      <!-- File List - Full Width -->
      <div
        v-if="files.length > 0"
        class="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden"
      >
        <div class="px-6 py-5 border-b border-slate-700/50">
          <h2 class="text-xl font-semibold text-slate-200">
            Selected Files
            <span
              class="ml-2 px-2.5 py-1 text-sm bg-slate-700 rounded-full text-slate-300"
              >{{ files.length }}</span
            >
          </h2>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-900/50">
              <tr>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  File Name
                </th>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Type
                </th>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Score
                </th>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Processing Time
                </th>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Documento
                </th>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  NCF
                </th>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Tipo de Suplidor
                </th>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Tipo de Gasto
                </th>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Descripción
                </th>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Fecha
                </th>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Monto Bienes
                </th>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  ITBIS
                </th>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Selectivo
                </th>
                <th
                  class="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Forma de Pago
                </th>
                <th
                  class="px-4 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Preview
                </th>
                <th
                  class="px-4 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700/50">
              <tr
                v-for="file in files"
                :key="file.id"
                class="hover:bg-slate-700/30 transition-colors duration-150"
                :class="{ 'bg-amber-900/10': isEdited(file) }"
              >
                <!-- File Name -->
                <td class="px-4 py-3">
                  <input
                    type="text"
                    v-model="file.editableData.filename"
                    @focus="startEditing(file)"
                    class="w-full bg-transparent text-slate-300 font-medium border border-transparent rounded px-2 py-1 hover:border-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors"
                  />
                </td>
                <!-- Type -->
                <td class="px-4 py-3">
                  <span
                    class="inline-flex px-2.5 py-1 text-xs font-mono font-semibold rounded-md"
                    :class="getExtensionClasses(getFileExtension(file))"
                  >
                    {{ getFileExtension(file) }}
                  </span>
                </td>
                <!-- Status -->
                <td class="px-4 py-3">
                  <span
                    class="inline-flex px-3 py-1 text-xs font-semibold rounded-full"
                    :class="getStatusClasses(file.status)"
                  >
                    {{ getStatusLabel(file.status) }}
                  </span>
                </td>
                <!-- Score -->
                <td class="px-4 py-3">
                  <span
                    v-if="file.score > 0"
                    class="inline-flex px-3 py-1 text-xs font-semibold rounded-full"
                    :class="getScoreClasses(file.score)"
                  >
                    {{ file.score }}
                  </span>
                  <span v-else class="text-slate-500">-</span>
                </td>
                <!-- Processing Time -->
                <td class="px-4 py-3">
                  <span
                    v-if="file.processingTime"
                    class="text-slate-400 font-mono text-sm"
                  >
                    {{ formatTime(file.processingTime) }}
                  </span>
                  <span v-else class="text-slate-500">-</span>
                </td>
                <!-- Documento -->
                <td class="px-4 py-3">
                  <input
                    type="text"
                    v-model="file.editableData.documento"
                    @focus="startEditing(file)"
                    class="w-28 bg-transparent text-slate-400 border border-transparent rounded px-2 py-1 hover:border-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors font-mono text-sm"
                    placeholder="-"
                  />
                </td>
                <!-- NCF -->
                <td class="px-4 py-3">
                  <input
                    type="text"
                    v-model="file.editableData.ncf"
                    @focus="startEditing(file)"
                    class="w-36 bg-transparent text-slate-400 border border-transparent rounded px-2 py-1 hover:border-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors font-mono text-sm"
                    placeholder="-"
                  />
                </td>
                <!-- Tipo de Suplidor -->
                <td class="px-4 py-3">
                  <input
                    type="text"
                    v-model="file.editableData.tipo_de_suplidor"
                    @focus="startEditing(file)"
                    class="w-28 bg-transparent text-slate-400 border border-transparent rounded px-2 py-1 hover:border-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors text-sm"
                    placeholder="-"
                  />
                </td>
                <!-- Tipo de Gasto -->
                <td class="px-4 py-3">
                  <input
                    type="text"
                    v-model="file.editableData.tipo_de_gasto"
                    @focus="startEditing(file)"
                    class="w-64 bg-transparent text-slate-400 border border-transparent rounded px-2 py-1 hover:border-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors text-sm"
                    placeholder="-"
                  />
                </td>
                <!-- Descripción -->
                <td class="px-4 py-3">
                  <input
                    type="text"
                    v-model="file.editableData.descripcion"
                    @focus="startEditing(file)"
                    class="w-28 bg-transparent text-slate-400 border border-transparent rounded px-2 py-1 hover:border-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors text-sm"
                    placeholder="-"
                  />
                </td>
                <!-- Fecha -->
                <td class="px-4 py-3">
                  <input
                    type="text"
                    v-model="file.editableData.fecha"
                    @focus="startEditing(file)"
                    class="w-24 bg-transparent text-slate-400 border border-transparent rounded px-2 py-1 hover:border-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors text-sm"
                    placeholder="-"
                  />
                </td>
                <!-- Monto en Bienes -->
                <td class="px-4 py-3">
                  <div class="flex items-center">
                    <span class="text-slate-500 mr-1 text-sm">$</span>
                    <input
                      type="text"
                      v-model="file.editableData.monto_en_bienes"
                      @focus="startEditing(file)"
                      class="w-20 bg-transparent text-slate-300 font-mono text-sm border border-transparent rounded px-2 py-1 hover:border-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors"
                      placeholder="-"
                    />
                  </div>
                </td>
                <!-- ITBIS -->
                <td class="px-4 py-3">
                  <div class="flex items-center">
                    <span class="text-slate-500 mr-1 text-sm">$</span>
                    <input
                      type="text"
                      v-model="file.editableData.itbis"
                      @focus="startEditing(file)"
                      class="w-20 bg-transparent text-slate-400 font-mono text-sm border border-transparent rounded px-2 py-1 hover:border-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors"
                      placeholder="-"
                    />
                  </div>
                </td>
                <!-- Selectivo -->
                <td class="px-4 py-3">
                  <div class="flex items-center">
                    <span class="text-slate-500 mr-1 text-sm">$</span>
                    <input
                      type="text"
                      v-model="file.editableData.selectivo"
                      @focus="startEditing(file)"
                      class="w-20 bg-transparent text-slate-400 font-mono text-sm border border-transparent rounded px-2 py-1 hover:border-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors"
                      placeholder="-"
                    />
                  </div>
                </td>
                <!-- Forma de Pago -->
                <td class="px-4 py-3">
                  <input
                    type="text"
                    v-model="file.editableData.metodo_de_pago"
                    @focus="startEditing(file)"
                    class="w-40 bg-transparent text-slate-400 border border-transparent rounded px-2 py-1 hover:border-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors text-sm"
                    placeholder="-"
                  />
                </td>
                <!-- Preview Button -->
                <td class="px-4 py-3 text-center">
                  <button
                    @click="openPreview(file)"
                    class="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-colors"
                    title="Preview file"
                  >
                    <svg
                      class="w-5 h-5"
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
                <td class="px-4 py-3 text-center">
                  <div class="flex items-center justify-center gap-2">
                    <!-- Retry Button (visible for needs_retry or error status) -->
                    <button
                      v-if="
                        file.status === 'needs_retry' || file.status === 'error'
                      "
                      @click="retryFile(file)"
                      :disabled="individualLimit.isLimited.value"
                      class="p-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-cyan-500/20"
                      :title="
                        individualLimit.isLimited.value
                          ? `Rate limited - wait ${individualLimit.label.value}`
                          : 'Retry processing (gemma-4-26b)'
                      "
                    >
                      <svg
                        class="w-5 h-5"
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
                    <!-- Reevaluate Button (visible for done files with low score: 1 or 2) -->
                    <button
                      v-if="
                        file.status === 'done' &&
                        file.score > 0 &&
                        file.score < 3
                      "
                      @click="reevaluateFile(file)"
                      :disabled="individualLimit.isLimited.value"
                      class="p-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-purple-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-purple-500/20"
                      :title="
                        individualLimit.isLimited.value
                          ? `Rate limited - wait ${individualLimit.label.value}`
                          : 'Reevaluate with Gemma (low confidence score)'
                      "
                    >
                      <svg
                        class="w-5 h-5"
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
                    <!-- Revert Button (only visible if edited) -->
                    <button
                      v-if="isEdited(file)"
                      @click="revertFile(file)"
                      class="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 hover:text-amber-300 transition-colors"
                      title="Revert changes"
                    >
                      <svg
                        class="w-5 h-5"
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
                    <!-- Remove Button -->
                    <button
                      @click="removeFile(file)"
                      class="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-colors"
                      title="Remove file"
                    >
                      <svg
                        class="w-5 h-5"
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

        <!-- Actions -->
        <div
          class="px-6 py-5 border-t border-slate-700/50 flex flex-wrap gap-3 items-center"
        >
          <button
            @click="processAll"
            :disabled="
              processing ||
              batchLimit.isLimited.value ||
              files.every((f) => f.status !== 'pending')
            "
            class="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-lg shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-emerald-500/25"
            :title="
              batchLimit.isLimited.value
                ? `Rate limited - wait ${batchLimit.label.value}`
                : 'Process all pending files (gemini-3.5-flash, batches of 10)'
            "
          >
            <template v-if="processing">Processing...</template>
            <template v-else-if="batchLimit.isLimited.value">
              Cooldown · {{ batchLimit.label.value }}
            </template>
            <template v-else>Process All Files</template>
          </button>
          <button
            v-if="files.some((f) => f.status === 'done')"
            @click="downloadExcel"
            class="px-6 py-2.5 bg-slate-700 text-slate-200 font-semibold rounded-lg hover:bg-slate-600 transition-all duration-300 border border-slate-600"
          >
            Download Excel
          </button>
          <button
            @click="clearFiles"
            class="px-6 py-2.5 bg-transparent text-slate-400 font-semibold rounded-lg hover:bg-slate-700/50 hover:text-slate-200 transition-all duration-300 border border-slate-600"
          >
            Clear All
          </button>
          <!-- API usage indicators -->
          <div
            class="ml-auto flex items-center flex-wrap gap-x-5 gap-y-2 text-slate-400 text-sm"
          >
            <div
              class="flex items-center gap-2"
              :title="`Batch calls (gemini-3.5-flash) made in the last 60s (limit: ${BATCH_RPM})`"
            >
              <span class="font-medium">Batch:</span>
              <span
                class="font-mono font-semibold"
                :class="
                  batchLimit.isLimited.value
                    ? 'text-rose-300'
                    : batchLimit.used.value >= BATCH_RPM - 1
                      ? 'text-amber-300'
                      : 'text-slate-300'
                "
                >{{ batchLimit.used.value }} / {{ BATCH_RPM }} per min</span
              >
              <span
                v-if="batchLimit.isLimited.value"
                class="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-200 font-mono text-xs"
                >{{ batchLimit.label.value }}</span
              >
            </div>
            <div
              class="flex items-center gap-2"
              :title="`Single-file calls (gemma-4-26b) made in the last 60s (limit: ${INDIVIDUAL_RPM})`"
            >
              <span class="font-medium">Single:</span>
              <span
                class="font-mono font-semibold"
                :class="
                  individualLimit.isLimited.value
                    ? 'text-rose-300'
                    : individualLimit.used.value >= INDIVIDUAL_RPM - 3
                      ? 'text-amber-300'
                      : 'text-slate-300'
                "
                >{{ individualLimit.used.value }} / {{ INDIVIDUAL_RPM }} per
                min</span
              >
              <span
                v-if="individualLimit.isLimited.value"
                class="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-200 font-mono text-xs"
                >{{ individualLimit.label.value }}</span
              >
            </div>
            <div v-if="totalProcessingTime > 0" class="flex items-center gap-2">
              <span class="font-medium">Total Elapsed Time:</span>
              <span class="text-slate-300 font-mono font-semibold">{{
                formatTime(totalProcessingTime)
              }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Side Panel Preview -->
    <Transition name="slide">
      <div
        v-if="previewFile"
        class="fixed right-0 top-0 h-full bg-slate-800 border-l border-slate-700 shadow-2xl z-40 flex flex-col"
        :style="{ width: `${previewWidth}px` }"
      >
        <!-- Resize handle (drag to change preview width) -->
        <div
          class="absolute left-0 top-0 h-full w-1.5 -translate-x-1/2 cursor-col-resize group z-50"
          @mousedown="startPreviewResize"
          :title="`Drag to resize · ${previewWidth}px`"
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
        <!-- Header -->
        <div
          class="px-4 py-4 border-b border-slate-700 flex items-center justify-between"
        >
          <h3 class="text-lg font-semibold text-slate-200 truncate">
            {{ previewFile.name }}
          </h3>
          <button
            @click="closePreview"
            class="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-600 transition-colors"
          >
            <svg
              class="w-5 h-5"
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

        <!-- Preview Content -->
        <div class="flex-1 overflow-auto p-4">
          <!-- Image Preview -->
          <div
            v-if="isImageFile(previewFile)"
            class="bg-slate-900 rounded-xl overflow-hidden"
          >
            <img
              :src="previewUrl"
              :alt="previewFile.name"
              class="w-full h-auto object-contain"
            />
          </div>

          <!-- PDF Preview (iframe with blob URL) -->
          <div
            v-else-if="isPdfFile(previewFile)"
            class="bg-slate-900 rounded-xl overflow-hidden h-full flex flex-col"
          >
            <iframe
              :src="previewUrl"
              :title="previewFile.name"
              class="w-full flex-1 bg-white"
              style="min-height: 70vh"
            ></iframe>
            <p
              class="px-3 py-2 text-xs text-slate-500 border-t border-slate-700"
            >
              PDFs are normally split into one row per page on upload. This file
              kept as-is - the backend will rasterize up to 5 pages.
            </p>
          </div>

          <!-- Fallback for unknown types -->
          <div v-else class="bg-slate-900 rounded-xl p-8 text-center">
            <p class="text-slate-400 text-sm">{{ previewFile.name }}</p>
            <p class="text-slate-500 text-xs mt-2">No preview available.</p>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue";

const config = useRuntimeConfig();
const API_BASE = config.public.apiBase;

// --- Upload limits --------------------------------------------------------
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 3 MB
const MAX_FILE_SIZE_LABEL = "10MB";

// --- PDF rendering (client-side splitting) --------------------------------
// PDFs are split into one PNG image per page on upload so each page becomes
// its own row in the table and flows through the existing image pipeline.
const PDF_RENDER_SCALE = 2.0; // ~144 DPI - good for OCR, reasonable file size
let pdfjsLibPromise = null;

const loadPdfJs = async () => {
  if (typeof window === "undefined") return null;
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
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
  const pdfjs = await loadPdfJs();
  if (!pdfjs) throw new Error("pdfjs-dist unavailable in this environment");

  const arrayBuffer = await pdfFile.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const baseName = pdfFile.name.replace(/\.pdf$/i, "");
  const pageFiles = [];
  const padWidth = String(pdf.numPages).length;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context unavailable");

    await page.render({ canvasContext: context, viewport, canvas }).promise;

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/png",
      );
    });

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

  return pageFiles;
};

// --- Rate limiting (localStorage-backed, shared across tabs) --------------
// We track TWO independent budgets because the two backend endpoints use
// different models with different free-tier RPM caps:
//   - /upload        -> gemma-4-26b      (15 RPM) - Retry / Reevaluate
//   - /upload-batch  -> gemini-3.5-flash ( 5 RPM) - "Process All Files"
// Each tracker keeps its own array of timestamps in localStorage, ticks down
// once per second, and is shared across browser tabs via the storage event.
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
      // The Nth-oldest call (where N = RPM) determines when the limit clears.
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
const processing = ref(false);
const previewFile = ref(null);
const previewUrl = ref(null);
const totalProcessingTime = ref(0);
let fileIdCounter = 0;
let rateLimitTimer = null;

onMounted(() => {
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
});

// Refresh immediately if another tab updates either shared counter.
const onRateLimitStorage = (event) => {
  if (event.key === INDIVIDUAL_RATE_LIMIT_KEY) individualLimit.refresh();
  if (event.key === BATCH_RATE_LIMIT_KEY) batchLimit.refresh();
};

const handleFileSelect = async (event) => {
  const selectedFiles = Array.from(event.target.files);
  await addFiles(selectedFiles);
  event.target.value = "";
};

const handleDrop = async (event) => {
  event.preventDefault();
  const droppedFiles = Array.from(event.dataTransfer.files);
  await addFiles(droppedFiles);
};

const createFileItem = (file) => ({
  id: fileIdCounter++,
  name: file.name,
  file: file,
  status: "pending",
  data: null,
  originalData: null,
  editableData: {
    filename: file.name,
    documento: "",
    ncf: "",
    tipo_de_suplidor: "",
    tipo_de_gasto: "",
    descripcion: "",
    fecha: "",
    monto_en_bienes: "",
    itbis: "",
    selectivo: "",
    metodo_de_pago: "",
  },
  score: 0,
  processingTime: null,
});

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
  // The panel is anchored to the right edge; its width is the distance from
  // the cursor to the right edge of the viewport.
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
      alert(`${file.name} is not a supported file type`);
      continue;
    }

    // The 3MB cap applies to the original upload. After PDF rasterization
    // the per-page PNGs may be larger, but they never leave the browser as
    // a single payload bigger than this.
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      alert(
        `${file.name} is ${sizeMb}MB which exceeds the ${MAX_FILE_SIZE_LABEL} per-file limit.`,
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
      } catch (err) {
        console.error(`Failed to split ${file.name}:`, err);
        alert(
          `Could not split "${file.name}" into pages (${err?.message || err}). ` +
            `Uploading it as-is - the backend will rasterize it instead.`,
        );
        files.value.push(createFileItem(file));
      } finally {
        splittingPdfs.value--;
      }
    } else {
      files.value.push(createFileItem(file));
    }
  }
};

const startEditing = (file) => {
  // Save original state if not already saved
  if (!file.originalData) {
    file.originalData = { ...file.editableData };
  }
};

const isEdited = (file) => {
  if (!file.originalData) return false;
  return (
    file.editableData.filename !== file.originalData.filename ||
    file.editableData.documento !== file.originalData.documento ||
    file.editableData.tipo_de_suplidor !== file.originalData.tipo_de_suplidor ||
    file.editableData.tipo_de_gasto !== file.originalData.tipo_de_gasto ||
    file.editableData.fecha !== file.originalData.fecha ||
    file.editableData.monto_en_bienes !== file.originalData.monto_en_bienes ||
    file.editableData.itbis !== file.originalData.itbis ||
    file.editableData.selectivo !== file.originalData.selectivo ||
    file.editableData.metodo_de_pago !== file.originalData.metodo_de_pago ||
    file.editableData.date !== file.originalData.date ||
    file.editableData.vendor !== file.originalData.vendor ||
    file.editableData.total !== file.originalData.total ||
    file.editableData.tax !== file.originalData.tax
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
    files.value.splice(index, 1);
  }
};

// Apply an extracted-data payload from the backend to a file item, updating
// its editableData, score, originalData snapshot and status.
const applyExtractedData = (fileItem, data) => {
  fileItem.data = data;
  fileItem.score = data.score || 0;

  fileItem.editableData = {
    filename: fileItem.name,
    documento: data.documento || "",
    ncf: data.ncf || "",
    tipo_de_suplidor: data.tipo_de_suplidor || "",
    tipo_de_gasto: data.tipo_de_gasto || "",
    descripcion: data.descripcion || "",
    fecha: data.fecha || "",
    monto_en_bienes: data.monto_en_bienes
      ? data.monto_en_bienes.toString()
      : "",
    itbis: data.itbis ? data.itbis.toString() : "",
    selectivo: data.selectivo ? data.selectivo.toString() : "",
    metodo_de_pago: data.metodo_de_pago || "",
  };

  const hasData =
    data.documento ||
    data.ncf ||
    data.tipo_de_suplidor ||
    data.tipo_de_gasto ||
    data.fecha ||
    data.monto_en_bienes > 0 ||
    data.score > 0;

  if (hasData) {
    fileItem.status = "done";
    fileItem.originalData = { ...fileItem.editableData };
  } else {
    fileItem.status = "needs_retry";
  }
};

// Single-file API call shared by Retry (failed/needs_retry) and Reevaluate
// (done but low-confidence score). Both honor and record against the
// localStorage rate limit and hit the individual /upload endpoint which is
// configured to use the gemma-4-26b model on the backend.
const runSingleFileEvaluation = async (fileItem) => {
  if (individualLimit.isLimited.value) {
    alert(
      `Individual evaluation rate limit reached ` +
        `(${INDIVIDUAL_RPM} requests / minute). ` +
        `Try again in ${individualLimit.label.value}.`,
    );
    return;
  }

  const previousStatus = fileItem.status;
  fileItem.status = "retrying";
  const startTime = performance.now();
  individualLimit.record(1);

  try {
    const formData = new FormData();
    formData.append("file", fileItem.file);

    const response = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    const endTime = performance.now();
    fileItem.processingTime = endTime - startTime;

    if (result.status === "success") {
      applyExtractedData(fileItem, result.data);
    } else {
      fileItem.status = "error";
    }
  } catch (error) {
    console.error("Error running single-file evaluation:", error);
    // Revert to previous status on hard network failure so the user can retry
    // without losing the existing extracted data (e.g. for low-score rerun).
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

// Returns the upper-case file extension (without the dot) for a fileItem, e.g.
// "image.PNG" -> "PNG", "doc.pdf" -> "PDF". Falls back to "FILE" if missing.
const getFileExtension = (fileItem) => {
  const name = fileItem?.name || "";
  const idx = name.lastIndexOf(".");
  if (idx === -1 || idx === name.length - 1) return "FILE";
  return name.slice(idx + 1).toUpperCase();
};

const getExtensionClasses = (ext) => {
  switch (ext) {
    case "PDF":
      return "bg-red-500/20 text-red-300";
    case "PNG":
      return "bg-blue-500/20 text-blue-300";
    case "JPG":
    case "JPEG":
      return "bg-emerald-500/20 text-emerald-300";
    default:
      return "bg-slate-600/40 text-slate-300";
  }
};

const openPreview = (file) => {
  previewFile.value = file;
  // Both images and PDFs need a blob URL: <img src> for images, <iframe src>
  // for PDFs (browsers natively render PDFs in iframes).
  if (isImageFile(file) || isPdfFile(file)) {
    previewUrl.value = URL.createObjectURL(file.file);
  } else {
    previewUrl.value = null;
  }
};

const closePreview = () => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
  previewFile.value = null;
  previewUrl.value = null;
};

const getStatusLabel = (status) => {
  const labels = {
    pending: "Pending",
    processing: "Processing",
    done: "Done",
    duplicate: "Duplicate",
    error: "Error",
    needs_retry: "Needs Retry",
    retrying: "Retrying",
  };
  return labels[status] || status;
};

const getStatusClasses = (status) => {
  const classes = {
    pending: "bg-amber-500/20 text-amber-400",
    processing: "bg-blue-500/20 text-blue-400 animate-pulse",
    done: "bg-emerald-500/20 text-emerald-400",
    duplicate: "bg-orange-500/20 text-orange-400",
    error: "bg-red-500/20 text-red-400",
    needs_retry: "bg-rose-500/20 text-rose-400",
    retrying: "bg-blue-500/20 text-blue-400 animate-pulse",
  };
  return classes[status] || "bg-slate-500/20 text-slate-400";
};

const getScoreClasses = (score) => {
  if (score === 3) return "bg-emerald-500/20 text-emerald-400";
  if (score === 2) return "bg-amber-500/20 text-amber-400";
  if (score === 1) return "bg-red-500/20 text-red-400";
  return "bg-slate-500/20 text-slate-400";
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
  processing.value = true;
  totalProcessingTime.value = 0;
  const overallStartTime = performance.now();

  const pendingFiles = files.value.filter((f) => f.status === "pending");
  // Each batch is sent as ONE multipart request to /upload-batch, which forwards
  // all 10 images to gemini-3.5-flash in a SINGLE generate_content call.
  // gemini-3.5-flash is capped at 5 RPM on the free tier, so we track each
  // batch as 1 against the batchLimit bucket and stop early if the budget
  // would be exceeded; the user can resume after the cooldown timer hits zero.
  const BATCH_SIZE = 10;
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

    try {
      const formData = new FormData();
      batch.forEach((fileItem) => {
        formData.append("files", fileItem.file, fileItem.name);
      });

      const response = await fetch(`${API_BASE}/upload-batch`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          `Batch upload failed: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      const batchEnd = performance.now();
      const perFileTime = (batchEnd - batchStart) / batch.length;

      const results = Array.isArray(result?.results) ? result.results : [];

      batch.forEach((fileItem, idx) => {
        fileItem.processingTime = perFileTime;
        const fileResult = results[idx];

        if (!fileResult) {
          fileItem.status = "error";
          return;
        }

        if (fileResult.status === "duplicate") {
          fileItem.status = "duplicate";
        } else if (fileResult.status === "success" && fileResult.data) {
          applyExtractedData(fileItem, fileResult.data);
        } else {
          fileItem.status = "error";
        }
      });
    } catch (error) {
      console.error("Error processing batch:", error);
      const batchEnd = performance.now();
      const perFileTime = (batchEnd - batchStart) / batch.length;
      // Roll back files that never got a status update so they can be
      // retried later (instead of being stuck "processing").
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
    // Files we never reached are still "pending" - the user can click
    // "Process All Files" again once the batch cooldown timer hits zero.
    console.info(
      `Process All stopped early: batch rate limit reached. ` +
        `Resume in ${batchLimit.label.value}.`,
    );
  }
};

const downloadExcel = async () => {
  try {
    // Collect all processed files' editable data (excluding score)
    const filesData = files.value
      .filter((f) => f.status === "done")
      .map((f) => ({
        filename: f.editableData.filename,
        documento: f.editableData.documento || "",
        tipo_de_suplidor: f.editableData.tipo_de_suplidor || "",
        tipo_de_gasto: f.editableData.tipo_de_gasto || "",
        fecha: f.editableData.fecha || "",
        monto_en_bienes: f.editableData.monto_en_bienes || "0",
        itbis: f.editableData.itbis || "0",
        selectivo: f.editableData.selectivo || "0",
        metodo_de_pago: f.editableData.metodo_de_pago || "",
        // Score is intentionally excluded
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
    a.download = "processed_receipts.xlsx";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error("Error downloading file:", error);
    alert("Error downloading Excel file");
  }
};

const clearFiles = () => {
  files.value = [];
  totalProcessingTime.value = 0;
  if (fileInput.value) {
    fileInput.value.value = "";
  }
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

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
