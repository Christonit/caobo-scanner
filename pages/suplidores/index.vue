<script setup lang="ts">
import type { Client } from "~/composables/useClients";
import type { ClientSuplidor } from "~/composables/useClientSuplidores";
import { TIPO_DE_FACTURA_OPTIONS } from "~/composables/useClientSuplidores";

const API_BASE = useApiBase();

// ── Clients ───────────────────────────────────────────────────────────────────
const { list: listClients } = useClients();
const { listByClient, upsertFromScan } = useClientSuplidores();

const clients = ref<Client[]>([]);
const selectedClientId = ref<string | null>(null);
const selectedClient = computed(
  () => clients.value.find((c) => c.id === selectedClientId.value) ?? null,
);

// ── Database suplidores ───────────────────────────────────────────────────────
const dbSuplidores = ref<ClientSuplidor[]>([]);
const loadingDb = ref(false);
const dbError = ref<string | null>(null);

async function loadDbSuplidores() {
  if (!selectedClientId.value) { dbSuplidores.value = []; return; }
  loadingDb.value = true;
  dbError.value = null;
  try {
    dbSuplidores.value = await listByClient(selectedClientId.value);
  } catch (e: any) {
    dbError.value = e?.message || "Error cargando suplidores.";
  } finally {
    loadingDb.value = false;
  }
}

watch(selectedClientId, () => {
  fileRows.value = [];
  extractedSuplidores.value = [];
  loadDbSuplidores();
});

// ── pdfjs page counter ────────────────────────────────────────────────────────
let _pdfjsPromise: Promise<any> | null = null;

async function loadPdfJs() {
  if (typeof window === "undefined") return null;
  if (!_pdfjsPromise) {
    _pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (
        await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
      ).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return _pdfjsPromise;
}

async function countPdfPages(file: File): Promise<number> {
  try {
    const pdfjs = await loadPdfJs();
    if (!pdfjs) return 1;
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    return doc.numPages;
  } catch {
    return 1;
  }
}

// ── File rows ─────────────────────────────────────────────────────────────────
interface FileRow {
  id: string;
  file: File;
  filename: string;
  pageCount: number | null;   // null while counting
  selected: boolean;
  status: "pending" | "analyzing" | "done" | "error";
  errorMsg?: string;
}

const fileRows = ref<FileRow[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const scanning = ref(false);
const scanError = ref<string | null>(null);

// extracted suplidores accumulated across all analyzed files
interface ExtractedSuplidor {
  _id: string;         // local uuid for keying
  nombre: string;
  documento: string;
  tipo_de_documento: string;
  tipo_de_factura: string;
  isNew: boolean;              // not yet in our DB
  alreadyInSystem: boolean;    // registered_on_platform / already in Citrus
  selected: boolean;           // row checkbox — false when alreadyInSystem
}
const extractedSuplidores = ref<ExtractedSuplidor[]>([]);

/** Rows that can be exported or saved (not already registered in Citrus). */
const actionableExtracted = computed(() =>
  extractedSuplidores.value.filter((s) => !s.alreadyInSystem),
);

const allExtractedSelected = computed(
  () =>
    actionableExtracted.value.length > 0 &&
    actionableExtracted.value.every((s) => s.selected),
);
function toggleAllExtracted() {
  const val = !allExtractedSelected.value;
  actionableExtracted.value.forEach((s) => {
    s.selected = val;
  });
}
function removeExtracted(id: string) {
  extractedSuplidores.value = extractedSuplidores.value.filter((s) => s._id !== id);
}
// rows to act on: selected actionable ones, or all actionable if nothing is checked
const activeExtracted = computed(() => {
  const actionable = actionableExtracted.value;
  const sel = actionable.filter((s) => s.selected);
  return sel.length ? sel : actionable;
});
const alreadyInSystemCount = computed(
  () => extractedSuplidores.value.filter((s) => s.alreadyInSystem).length,
);

const hasPending = computed(() =>
  fileRows.value.some((r) => r.selected && r.status === "pending"),
);
const selectedCount = computed(
  () => fileRows.value.filter((r) => r.selected && r.status === "pending").length,
);
const allSelected = computed(
  () => fileRows.value.length > 0 && fileRows.value.every((r) => r.selected),
);

function toggleAll() {
  const val = !allSelected.value;
  fileRows.value.forEach((r) => (r.selected = val));
}

function openFileDialog() {
  if (!selectedClientId.value) {
    scanError.value = "Selecciona un cliente antes de agregar archivos.";
    return;
  }
  fileInput.value?.click();
}

async function onFilesSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (!files.length) return;
  input.value = "";
  scanError.value = null;

  const newRows: FileRow[] = files.map((f) => ({
    id: crypto.randomUUID(),
    file: f,
    filename: f.name,
    pageCount: null,
    selected: true,
    status: "pending",
  }));
  fileRows.value.push(...newRows);

  // count pages async for each new row
  for (const row of newRows) {
    const ext = row.filename.split(".").pop()?.toLowerCase();
    if (ext === "pdf") {
      countPdfPages(row.file).then((n) => {
        row.pageCount = n;
        fileRows.value = [...fileRows.value];
      });
    } else {
      row.pageCount = 1;
    }
  }
}

function removeRow(id: string) {
  fileRows.value = fileRows.value.filter((r) => r.id !== id);
}

// ── Preview modal ─────────────────────────────────────────────────────────────
const previewUrl = ref<string | null>(null);
const previewName = ref("");

function openPreview(row: FileRow) {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = URL.createObjectURL(row.file);
  previewName.value = row.filename;
}
function closePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = null;
  previewName.value = "";
}

// ── AI analysis ───────────────────────────────────────────────────────────────
async function analyzeWithAI() {
  if (!selectedClientId.value) {
    scanError.value = "Selecciona un cliente.";
    return;
  }
  const pending = fileRows.value.filter(
    (r) => r.selected && r.status === "pending",
  );
  if (!pending.length) return;

  scanError.value = null;
  scanning.value = true;

  // Match against saved suplidores: in DB vs already registered in Citrus
  const knownDocs = new Set(
    dbSuplidores.value.map((s) => (s.documento ?? "").toLowerCase()).filter(Boolean),
  );
  const knownNames = new Set(
    dbSuplidores.value
      .filter((s) => !s.documento)
      .map((s) => s.nombre.toLowerCase()),
  );
  const registeredDocs = new Set(
    dbSuplidores.value
      .filter((s) => s.registered_on_platform && s.documento)
      .map((s) => (s.documento ?? "").toLowerCase()),
  );
  const registeredNames = new Set(
    dbSuplidores.value
      .filter((s) => s.registered_on_platform && !s.documento)
      .map((s) => s.nombre.toLowerCase()),
  );

  for (const row of pending) {
    row.status = "analyzing";
    fileRows.value = [...fileRows.value];

    try {
      const fd = new FormData();
      fd.append("file", row.file);
      const res = await fetch(`${API_BASE}/scan-suplidores`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);

      const json = await res.json();

      // update page count if backend resolved it more accurately
      if (json.page_count && !row.pageCount) row.pageCount = json.page_count;

      // merge suplidores into extractedSuplidores (deduplicate globally)
      const incoming: any[] = json.suplidores ?? [];
      for (const s of incoming) {
        const docKey = (s.documento ?? "").toLowerCase();
        const nameKey = (s.nombre ?? "").toLowerCase();
        const alreadyExtracted = extractedSuplidores.value.some(
          (x) =>
            (docKey && x.documento.toLowerCase() === docKey) ||
            (!docKey && x.nombre.toLowerCase() === nameKey),
        );
        if (alreadyExtracted) continue;

        const isNew =
          docKey ? !knownDocs.has(docKey) : !knownNames.has(nameKey);
        const alreadyInSystem =
          docKey ? registeredDocs.has(docKey) : registeredNames.has(nameKey);

        extractedSuplidores.value.push({
          _id: crypto.randomUUID(),
          nombre: s.nombre ?? "",
          documento: s.documento ?? "",
          tipo_de_documento: s.tipo_de_documento ?? "",
          tipo_de_factura: s.tipo_de_factura ?? "",
          isNew,
          alreadyInSystem,
          // Already in Citrus: not selectable for export/save
          selected: !alreadyInSystem,
        });
      }
      extractedSuplidores.value = [...extractedSuplidores.value];
      row.status = "done";
    } catch (err: any) {
      row.status = "error";
      row.errorMsg = err?.message || "Error al analizar";
    }
    fileRows.value = [...fileRows.value];
  }

  scanning.value = false;
}

// ── Save ──────────────────────────────────────────────────────────────────────
const saving = ref(false);
const saveSuccess = ref(false);

async function saveToDatabase() {
  if (!selectedClientId.value) return;
  // Never save rows already registered in Citrus; also skip ones already in DB
  const toSave = activeExtracted.value.filter(
    (s) => s.nombre && !s.alreadyInSystem && s.isNew,
  );
  if (!toSave.length) return;

  saving.value = true;
  saveSuccess.value = false;
  try {
    dbSuplidores.value = await upsertFromScan(
      selectedClientId.value,
      toSave.map((s) => ({
        nombre: s.nombre,
        documento: s.documento || null,
        tipo_de_factura: s.tipo_de_factura || null,
      })),
    );
    // mark saved rows as no longer new
    const savedIds = new Set(toSave.map((s) => s._id));
    extractedSuplidores.value.forEach((s) => {
      if (savedIds.has(s._id)) s.isNew = false;
    });
    saveSuccess.value = true;
    setTimeout(() => (saveSuccess.value = false), 3000);
  } catch (e: any) {
    dbError.value = e?.message || "Error guardando.";
  } finally {
    saving.value = false;
  }
}

// ── Download template ─────────────────────────────────────────────────────────
async function downloadTemplate() {
  // Exclude suppliers already registered in Citrus from the export template
  const toDownload = activeExtracted.value.filter(
    (s) => s.nombre && !s.alreadyInSystem,
  );
  if (!toDownload.length) return;

  const res = await fetch(`${API_BASE}/download-suplidores-template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      toDownload.map((s) => ({
        documento: s.documento,
        nombre: s.nombre,
        tipo_de_factura: s.tipo_de_factura,
      })),
    ),
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `suplidores-${selectedClient.value?.name ?? "export"}.xlsx`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// ── DB table: toggle registered ───────────────────────────────────────────────
const { markAsRegistered } = useClientSuplidores();
const togglingId = ref<string | null>(null);
const unregisterConfirmOpen = ref(false);
const unregisterTarget = ref<ClientSuplidor | null>(null);

async function toggleRegistered(s: ClientSuplidor) {
  if (s.registered_on_platform) {
    unregisterTarget.value = s;
    unregisterConfirmOpen.value = true;
    return;
  }
  await applyRegisteredToggle(s, true);
}

function cancelUnregister() {
  unregisterConfirmOpen.value = false;
  unregisterTarget.value = null;
}

async function confirmUnregister() {
  const s = unregisterTarget.value;
  unregisterConfirmOpen.value = false;
  unregisterTarget.value = null;
  if (!s) return;
  await applyRegisteredToggle(s, false);
}

async function applyRegisteredToggle(s: ClientSuplidor, value: boolean) {
  togglingId.value = s.id;
  try {
    const updated = await markAsRegistered(s.id, value);
    dbSuplidores.value = dbSuplidores.value.map((x) =>
      x.id === updated.id ? updated : x,
    );
  } finally {
    togglingId.value = null;
  }
}

const registeredDbCount = computed(
  () => dbSuplidores.value.filter((s) => s.registered_on_platform).length,
);

onMounted(async () => {
  clients.value = await listClients();
});
</script>

<template>
  <div class="px-8 py-8">
    <div class="mx-auto max-w-5xl">

      <!-- Header -->
      <header class="mb-8">
        <h1 class="text-2xl font-bold tracking-tight text-gray-900">Suplidores</h1>
        <p class="mt-1 text-sm text-gray-500">
          Extrae suplidores de recibos con IA y gestiona cuáles están
          registrados en la plataforma de Carga Masiva.
        </p>
      </header>

      <!-- Client selector -->
      <div class="mb-6">
        <label class="mb-1.5 block text-sm font-medium text-gray-700" for="suplidor-client">Cliente</label>
        <select
          id="suplidor-client"
          v-model="selectedClientId"
          class="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        >
          <option :value="null">— Seleccionar cliente —</option>
          <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>

      <!-- No client placeholder -->
      <div
        v-if="!selectedClientId"
        class="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center"
      >
        <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
              d="M17 20h5v-1a4 4 0 00-4-4h-1m-7 5H2v-1a4 4 0 014-4h4a4 4 0 014 4v1zm-3-9a3 3 0 11-6 0 3 3 0 016 0zm9-3a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p class="text-sm font-medium text-gray-700">Selecciona un cliente para continuar</p>
      </div>

      <template v-else>

        <!-- ═══════════════════════════════════════════════════
             SECTION 1 — File upload & scan queue
        ════════════════════════════════════════════════════ -->
        <section class="mb-10">
          <div class="mb-3 flex items-start justify-between gap-4">
            <div>
              <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400">
                Extraer desde recibos
              </h2>
              <p class="mt-0.5 text-sm text-gray-500">
                Agrega archivos, selecciona los que quieres analizar y presiona
                <span class="font-medium text-gray-700">Analizar con IA</span>.
              </p>
            </div>

            <div class="flex flex-shrink-0 items-center gap-2">
              <button
                v-if="fileRows.length > 0"
                type="button"
                class="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"
                :disabled="scanning"
                @click="fileRows = []; extractedSuplidores = []"
              >Limpiar</button>

              <button
                type="button"
                class="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                :disabled="scanning"
                @click="openFileDialog"
              >
                <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 4v16m8-8H4" />
                </svg>
                Agregar archivos
              </button>

              <button
                v-if="hasPending"
                type="button"
                class="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                :disabled="scanning"
                @click="analyzeWithAI"
              >
                <svg v-if="scanning" class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                </svg>
                <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                {{ scanning ? "Analizando…" : `Analizar con IA (${selectedCount})` }}
              </button>
            </div>
          </div>

          <input ref="fileInput" type="file" accept=".pdf,.png,.jpg,.jpeg" multiple class="hidden" @change="onFilesSelected" />

          <p v-if="scanError" class="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {{ scanError }}
          </p>

          <!-- File queue table -->
          <div v-if="fileRows.length > 0" class="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-gray-100 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th class="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      :checked="allSelected"
                      class="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600"
                      @change="toggleAll"
                    />
                  </th>
                  <th class="px-4 py-3">Archivo</th>
                  <th class="w-28 px-4 py-3 text-center">Páginas</th>
                  <th class="w-28 px-4 py-3 text-right">Estado</th>
                  <th class="w-20 px-4 py-3"><span class="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr
                  v-for="row in fileRows"
                  :key="row.id"
                  class="group"
                  :class="[
                    row.status === 'error' ? 'bg-red-50' : '',
                    row.selected && row.status === 'pending' ? 'bg-emerald-50/30' : '',
                  ]"
                >
                  <!-- Checkbox -->
                  <td class="px-4 py-3">
                    <input
                      v-if="row.status === 'pending'"
                      v-model="row.selected"
                      type="checkbox"
                      class="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600"
                    />
                    <span v-else class="block h-3.5 w-3.5" />
                  </td>

                  <!-- Filename -->
                  <td class="px-4 py-3">
                    <span class="max-w-xs truncate text-xs text-gray-700" :title="row.filename">
                      {{ row.filename }}
                    </span>
                    <span v-if="row.status === 'error'" class="ml-2 text-xs text-red-500">
                      — {{ row.errorMsg }}
                    </span>
                  </td>

                  <!-- Pages -->
                  <td class="px-4 py-3 text-center">
                    <span v-if="row.pageCount === null" class="text-xs text-gray-300">—</span>
                    <span v-else class="text-sm font-medium text-gray-700">{{ row.pageCount }}</span>
                  </td>

                  <!-- Status -->
                  <td class="px-4 py-3 text-right">
                    <span
                      class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                      :class="{
                        'bg-gray-100 text-gray-500': row.status === 'pending',
                        'bg-blue-50 text-blue-600': row.status === 'analyzing',
                        'bg-emerald-50 text-emerald-700': row.status === 'done',
                        'bg-red-50 text-red-600': row.status === 'error',
                      }"
                    >
                      <svg v-if="row.status === 'analyzing'" class="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                      </svg>
                      {{ { pending: 'Pendiente', analyzing: 'Analizando', done: 'Listo', error: 'Error' }[row.status] }}
                    </span>
                  </td>

                  <!-- Actions: preview + remove -->
                  <td class="px-4 py-3">
                    <div class="flex items-center justify-end gap-1">
                      <!-- Preview -->
                      <button
                        type="button"
                        class="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                        title="Vista previa"
                        @click="openPreview(row)"
                      >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <!-- Remove -->
                      <button
                        type="button"
                        class="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                        title="Quitar"
                        :disabled="row.status === 'analyzing'"
                        @click="removeRow(row.id)"
                      >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Drop zone (no files yet) -->
          <div
            v-else
            class="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white px-6 py-12 text-center transition hover:border-emerald-400 hover:bg-emerald-50/30"
            @click="openFileDialog"
          >
            <svg class="mb-3 h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <p class="text-sm font-medium text-gray-500">Haz clic o arrastra recibos aquí</p>
            <p class="mt-1 text-xs text-gray-400">PDF, PNG, JPG · múltiples archivos</p>
          </div>
        </section>

        <!-- ═══════════════════════════════════════════════════
             SECTION 2 — Extracted suplidores results
        ════════════════════════════════════════════════════ -->
        <section v-if="extractedSuplidores.length > 0" class="mb-10">
          <div class="mb-3 flex items-center justify-between">
            <div>
              <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400">Nuevos suplidores</h2>
              <p class="mt-0.5 text-sm text-gray-500">
                Total de <span class="font-semibold text-gray-700">{{ extractedSuplidores.length }}</span>
                {{ extractedSuplidores.length === 1 ? "suplidor" : "suplidores" }} extraídos
                <template v-if="actionableExtracted.some(s => s.selected) && activeExtracted.length < actionableExtracted.length">
                  · <span class="font-medium text-gray-700">{{ activeExtracted.length }} seleccionados</span>
                </template>.
                <span v-if="extractedSuplidores.some(s => s.isNew && !s.alreadyInSystem)" class="text-amber-600">
                  {{ extractedSuplidores.filter(s => s.isNew && !s.alreadyInSystem).length }} nuevos.
                </span>
                <span v-if="alreadyInSystemCount > 0" class="text-emerald-600">
                  {{ alreadyInSystemCount }} ya en Citrus (excluidos de exportar/guardar).
                </span>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="saveSuccess" class="text-sm font-medium text-emerald-600">✓ Guardado</span>
              <button
                type="button"
                class="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                :disabled="saving || activeExtracted.length === 0"
                @click="downloadTemplate"
              >Descargar plantilla</button>
              <button
                type="button"
                class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                :disabled="saving || !activeExtracted.some(s => s.isNew)"
                @click="saveToDatabase"
              >{{ saving ? "Guardando…" : "Guardar" }}</button>
            </div>
          </div>

          <div class="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-gray-100 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <!-- master checkbox -->
                  <th class="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      :checked="allExtractedSelected"
                      :disabled="actionableExtracted.length === 0"
                      class="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600 disabled:opacity-40"
                      @change="toggleAllExtracted"
                    />
                  </th>
                  <th class="px-5 py-3">Nombre</th>
                  <th class="px-5 py-3">Documento</th>
                  <th class="px-5 py-3">Tipo de Documento</th>
                  <th class="px-5 py-3">Tipo de Factura</th>
                  <th class="w-8 px-3 py-3"><span class="sr-only">Quitar</span></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr
                  v-for="s in extractedSuplidores"
                  :key="s._id"
                  class="group transition"
                  :class="[
                    s.alreadyInSystem
                      ? 'bg-emerald-50/40 opacity-75'
                      : s.isNew
                        ? (s.selected ? 'bg-amber-50/60' : 'bg-white opacity-50')
                        : (s.selected ? 'bg-sky-50/50' : 'bg-white opacity-50'),
                  ]"
                >
                  <!-- row checkbox -->
                  <td class="px-4 py-3">
                    <input
                      v-model="s.selected"
                      type="checkbox"
                      :disabled="s.alreadyInSystem"
                      class="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                      :title="s.alreadyInSystem ? 'Ya está en Citrus — no se puede exportar ni guardar' : undefined"
                    />
                  </td>

                  <!-- Nombre + already-in-system badge -->
                  <td class="px-5 py-3">
                    <div class="flex items-center gap-2">
                      <span
                        v-if="s.alreadyInSystem"
                        class="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
                        title="Ya registrado en Citrus"
                      >
                        <svg class="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
                        </svg>
                      </span>
                      <span
                        v-else-if="!s.isNew"
                        class="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700"
                        title="Ya guardado en la base de datos"
                      >Guardado</span>
                      <input
                        v-model="s.nombre"
                        type="text"
                        maxlength="255"
                        :disabled="s.alreadyInSystem"
                        class="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-gray-900 outline-none hover:border-gray-200 focus:border-emerald-400 focus:bg-white focus:ring-1 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:hover:border-transparent"
                        :class="s.alreadyInSystem || !s.isNew ? 'text-gray-500' : ''"
                      />
                    </div>
                  </td>

                  <!-- Documento -->
                  <td class="px-5 py-3 font-mono text-xs text-gray-600">
                    <input
                      v-model="s.documento"
                      type="text"
                      maxlength="20"
                      inputmode="numeric"
                      :disabled="s.alreadyInSystem"
                      class="w-32 rounded border border-transparent bg-transparent px-1 py-0.5 font-mono text-xs text-gray-600 outline-none hover:border-gray-200 focus:border-emerald-400 focus:bg-white focus:ring-1 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:hover:border-transparent"
                      @input="s.documento = s.documento.replace(/\D/g, '').slice(0, 20)"
                    />
                  </td>

                  <!-- Tipo documento -->
                  <td class="px-5 py-3 text-xs font-medium uppercase text-gray-400">
                    {{ s.tipo_de_documento || "—" }}
                  </td>

                  <!-- Tipo factura -->
                  <td class="px-5 py-3">
                    <select
                      v-model="s.tipo_de_factura"
                      :disabled="s.alreadyInSystem"
                      class="rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-gray-700 outline-none hover:border-gray-200 focus:border-emerald-400 focus:bg-white focus:ring-1 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">—</option>
                      <option v-for="opt in TIPO_DE_FACTURA_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
                    </select>
                  </td>

                  <!-- Remove -->
                  <td class="px-3 py-3">
                    <button
                      type="button"
                      class="invisible rounded-md p-1 text-gray-300 transition hover:bg-red-50 hover:text-red-500 group-hover:visible"
                      title="Quitar"
                      @click="removeExtracted(s._id)"
                    >
                      <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- ═══════════════════════════════════════════════════
             SECTION 3 — Saved suplidores in DB
        ════════════════════════════════════════════════════ -->
        <section>
          <div class="mb-3 flex items-center justify-between">
            <div>
              <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400">
                Suplidores guardados — {{ selectedClient?.name }}
              </h2>
              <p class="mt-0.5 text-sm text-gray-500">
                <template v-if="dbSuplidores.length > 0">
                  {{ registeredDbCount }} de {{ dbSuplidores.length }}
                  {{ dbSuplidores.length === 1 ? "suplidor registrado" : "suplidores registrados" }}
                  en la plataforma.
                </template>
                <template v-else>Sin suplidores guardados aún.</template>
              </p>
            </div>
            <NuxtLink :to="`/clientes/${selectedClientId}`" class="text-sm font-medium text-emerald-600 hover:underline">
              Ver cliente →
            </NuxtLink>
          </div>

          <p v-if="dbError" class="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{{ dbError }}</p>

          <div v-if="loadingDb" class="flex items-center justify-center py-12">
            <svg class="h-6 w-6 animate-spin text-gray-300" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
            </svg>
          </div>

          <div v-else-if="dbSuplidores.length === 0" class="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-400">
            No hay suplidores guardados. Analiza recibos arriba para comenzar.
          </div>

          <div v-else class="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-gray-100 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th class="px-5 py-3">Documento</th>
                  <th class="px-5 py-3">Nombre</th>
                  <th class="px-5 py-3">Tipo de Factura</th>
                  <th class="px-5 py-3">Plataforma</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="s in dbSuplidores" :key="s.id" class="hover:bg-gray-50">
                  <td class="px-5 py-3 font-mono text-xs text-gray-600">{{ s.documento || "—" }}</td>
                  <td class="px-5 py-3 font-medium text-gray-900">{{ s.nombre }}</td>
                  <td class="px-5 py-3 text-gray-600">{{ s.tipo_de_factura || "—" }}</td>
                  <td class="px-5 py-3">
                    <button
                      type="button"
                      class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition"
                      :class="s.registered_on_platform ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'"
                      :disabled="togglingId === s.id"
                      :title="s.registered_on_platform ? 'Marcar como no registrado' : 'Marcar como registrado'"
                      @click="toggleRegistered(s)"
                    >
                      <svg v-if="s.registered_on_platform" class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                      </svg>
                      <svg v-else class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v4m0 4h.01"/>
                      </svg>
                      {{ s.registered_on_platform ? "Registrado" : "No registrado" }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </template>
    </div>
  </div>

  <!-- ── Preview modal ──────────────────────────────────────────────────────── -->
  <div
    v-if="previewUrl"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    @click.self="closePreview"
  >
    <div class="flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
      <div class="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <p class="truncate text-sm font-medium text-gray-700">{{ previewName }}</p>
        <button type="button" class="rounded-md p-1 text-gray-400 hover:bg-gray-100" @click="closePreview">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="flex-1 overflow-auto bg-gray-100 p-2">
        <iframe
          :src="previewUrl"
          class="h-full w-full rounded border-0 bg-white"
          :title="previewName"
        />
      </div>
    </div>
  </div>

  <!-- Confirm unmark registered-on-platform -->
  <div
    v-if="unregisterConfirmOpen && unregisterTarget"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="unregister-confirm-title"
  >
    <div class="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
      <h2 id="unregister-confirm-title" class="text-lg font-semibold text-gray-900">
        ¿Quitar a "{{ unregisterTarget.nombre }}" de registrados en Citrus?
      </h2>
      <p class="mt-2 text-sm text-slate-600">
        Solo hazlo si aún no está (o ya no está) en la plataforma de Carga Masiva.
      </p>
      <div class="mt-6 flex justify-end gap-3">
        <button
          type="button"
          class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          @click="cancelUnregister"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          @click="confirmUnregister"
        >
          Quitar
        </button>
      </div>
    </div>
  </div>
</template>
