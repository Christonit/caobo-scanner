<script setup lang="ts">
import type { Client } from "~/composables/useClients";
import type { ClientSuplidor } from "~/composables/useClientSuplidores";
import {
  TIPO_DE_FACTURA_OPTIONS,
  TIPO_DE_DOCUMENTO_OPTIONS,
  inferTipoDeDocumento,
} from "~/composables/useClientSuplidores";
import {
  buildSuplidoresExportFilename,
  downloadSuplidoresCargaMasiva,
  getSuplidorScoreClasses,
  getSuplidorScoreLabel,
} from "~/utils/suplidoresExport";

const API_BASE = useApiBase();
const { model: thinkingModel } = useThinkingLevel();
const { appendSpendAttribution } = useSpendAttribution();

// ── Clients ───────────────────────────────────────────────────────────────────
const { list: listClients } = useClients();
const { listByClient, upsertFromScan, markAsRegistered, markManyAsRegistered } =
  useClientSuplidores();
const { listByOrganization: listOrgBusinessRules } =
  useOrganizationBusinessRules();
const { activeOrg } = useOrganization();
const { log: logActivity } = useActivityLog();

// Org-wide Anotaciones del Negocio — fed into every scan-suplidores call.
const orgBusinessRulesPayload = ref<
  Array<{ rule_type: string; rule_value: string; description: string }>
>([]);

async function loadOrgBusinessRules() {
  const orgId = activeOrg.value?.id;
  if (!orgId) {
    orgBusinessRulesPayload.value = [];
    return;
  }
  try {
    const rules = await listOrgBusinessRules(orgId);
    orgBusinessRulesPayload.value = rules.flatMap((rule) =>
      (rule.business_rule_attributes ?? []).map((a) => ({
        rule_type: a.rule_type,
        rule_value: a.rule_value || "",
        description: a.description || "",
      })),
    );
  } catch (err) {
    console.warn("[Org business rules] No se pudieron cargar:", err);
    orgBusinessRulesPayload.value = [];
  }
}

// Extraction workflow id for this page (analyze / store / export).
const extractionSessionId = ref("");
function beginExtractionSession() {
  extractionSessionId.value = createActivitySessionId();
  return extractionSessionId.value;
}
function withSession(metadata: Record<string, unknown> = {}) {
  return {
    ...metadata,
    session_id: extractionSessionId.value || beginExtractionSession(),
  };
}

const clients = ref<Client[]>([]);
const selectedClientId = ref<string | null>(null);
const selectedClient = computed(
  () => clients.value.find((c) => c.id === selectedClientId.value) ?? null,
);

// ── Database suplidores ───────────────────────────────────────────────────────
const dbSuplidores = ref<ClientSuplidor[]>([]);
const loadingDb = ref(false);
const dbError = ref<string | null>(null);
const selectedDbIds = ref<Set<string>>(new Set());

async function loadDbSuplidores() {
  if (!selectedClientId.value) {
    dbSuplidores.value = [];
    selectedDbIds.value = new Set();
    return;
  }
  loadingDb.value = true;
  dbError.value = null;
  selectedDbIds.value = new Set();
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
  scanYieldedEmpty.value = false;
  beginExtractionSession();
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
/** True after a completed analysis that returned no suplidores. */
const scanYieldedEmpty = ref(false);

// extracted suplidores accumulated across all analyzed files
interface ExtractedSuplidor {
  _id: string;         // local uuid for keying
  nombre: string;
  documento: string;
  tipo_de_documento: string;
  tipo_de_factura: string;
  score: number;               // 1–3 confidence from the model
  pageIndex: number;           // 1-based page in source file
  sourceFile: File | null;     // original upload for single-image preview
  sourceFilename: string;
  isNew: boolean;              // not yet in our DB
  alreadyInSystem: boolean;    // registered_on_platform / already in Citrus
  selected: boolean;           // row checkbox — false when alreadyInSystem
}
const extractedSuplidores = ref<ExtractedSuplidor[]>([]);

/** Rows that can be exported or saved (any extracted row can be selected for export). */
const selectableExtracted = computed(() => extractedSuplidores.value);

const allExtractedSelected = computed(
  () =>
    selectableExtracted.value.length > 0 &&
    selectableExtracted.value.every((s) => s.selected),
);
function toggleAllExtracted() {
  const val = !allExtractedSelected.value;
  selectableExtracted.value.forEach((s) => {
    s.selected = val;
  });
}
function removeExtracted(id: string) {
  extractedSuplidores.value = extractedSuplidores.value.filter((s) => s._id !== id);
}

/** Explicitly checked rows for export (includes already-in-system). */
const selectedExtracted = computed(() =>
  extractedSuplidores.value.filter((s) => s.selected),
);

/** Selected rows that are new and can be saved to DB. */
const selectedExtractedForSave = computed(() =>
  selectedExtracted.value.filter(
    (s) => s.nombre && !s.alreadyInSystem && s.isNew,
  ),
);

const alreadyInSystemCount = computed(
  () => extractedSuplidores.value.filter((s) => s.alreadyInSystem).length,
);

function onExtractedDocumentoInput(s: ExtractedSuplidor) {
  s.documento = s.documento.replace(/\D/g, "").slice(0, 20);
  s.tipo_de_documento = inferTipoDeDocumento(s.documento);
}

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

const isDragging = ref(false);
let dragDepth = 0;

const ACCEPTED_EXT = new Set(["pdf", "png", "jpg", "jpeg"]);

function openFileDialog() {
  if (!selectedClientId.value) {
    scanError.value = "Selecciona un cliente antes de agregar archivos.";
    return;
  }
  fileInput.value?.click();
}

function addFiles(files: File[]) {
  if (!selectedClientId.value) {
    scanError.value = "Selecciona un cliente antes de agregar archivos.";
    return;
  }

  const accepted = files.filter((f) => {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    return ACCEPTED_EXT.has(ext);
  });
  if (!accepted.length) return;

  scanError.value = null;

  const newRows: FileRow[] = accepted.map((f) => ({
    id: crypto.randomUUID(),
    file: f,
    filename: f.name,
    pageCount: null,
    selected: true,
    status: "pending",
  }));
  fileRows.value.push(...newRows);

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

function onFilesSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = "";
  if (!files.length) return;
  addFiles(files);
}

function onDragEnter(e: DragEvent) {
  e.preventDefault();
  dragDepth += 1;
  isDragging.value = true;
}

function onDragLeave(e: DragEvent) {
  e.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) isDragging.value = false;
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  dragDepth = 0;
  isDragging.value = false;
  const files = Array.from(e.dataTransfer?.files ?? []);
  if (!files.length) return;
  addFiles(files);
}

function removeRow(id: string) {
  fileRows.value = fileRows.value.filter((r) => r.id !== id);
}

function clearExtractionQueue() {
  fileRows.value = [];
  extractedSuplidores.value = [];
  scanYieldedEmpty.value = false;
  // Discard everything → new extraction session for the next run.
  beginExtractionSession();
}

// ── Preview modal (file queue = iframe; extracted suplidor = single image) ────
const previewUrl = ref<string | null>(null);
const previewName = ref("");
const previewIsImage = ref(false);
const previewLoading = ref(false);

function closePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = null;
  previewName.value = "";
  previewIsImage.value = false;
  previewLoading.value = false;
}

function openFilePreview(row: FileRow) {
  closePreview();
  previewUrl.value = URL.createObjectURL(row.file);
  previewName.value = row.filename;
  previewIsImage.value = false; // use iframe for full file (PDF/image)
}

async function renderPdfPageAsObjectUrl(
  file: File,
  pageIndex: number,
): Promise<string | null> {
  const pdfjs = await loadPdfJs();
  if (!pdfjs) return null;
  const buf = await file.arrayBuffer();
  // Match gastos PDF split: wasm/cmaps needed for scanned PDFs.
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    wasmUrl: "/api/pdfjs/wasm/",
    cMapUrl: "/api/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/api/pdfjs/standard_fonts/",
  }).promise;
  const pageNum = Math.min(Math.max(1, pageIndex), doc.numPages);
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  // pdf.js v5: pass `canvas` (do not getContext first).
  await page.render({
    canvas,
    viewport,
    background: "#ffffff",
  }).promise;
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        resolve(URL.createObjectURL(blob));
      },
      "image/jpeg",
      0.92,
    );
  });
}

async function openSuplidorPreview(s: ExtractedSuplidor) {
  if (!s.sourceFile) return;
  closePreview();
  previewLoading.value = true;
  previewName.value = `${s.nombre || "Suplidor"} · ${s.sourceFilename}${
    s.pageIndex > 1 ? ` (pág. ${s.pageIndex})` : ""
  }`;
  previewIsImage.value = true;

  try {
    const ext = s.sourceFilename.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "pdf") {
      const url = await renderPdfPageAsObjectUrl(s.sourceFile, s.pageIndex || 1);
      if (!url) throw new Error("No se pudo renderizar la página.");
      previewUrl.value = url;
    } else {
      previewUrl.value = URL.createObjectURL(s.sourceFile);
    }
  } catch (err: any) {
    scanError.value = err?.message || "No se pudo abrir la vista previa.";
    closePreview();
  } finally {
    previewLoading.value = false;
  }
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
  scanYieldedEmpty.value = false;
  scanning.value = true;

  const extractedBefore = extractedSuplidores.value.length;
  // Fresh extraction (no prior done files) starts a new session; re-runs keep it.
  const hasPriorResults = fileRows.value.some((r) => r.status === "done");
  if (!extractionSessionId.value || !hasPriorResults) {
    beginExtractionSession();
  }

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
      fd.append("model", thinkingModel.value);
      if (orgBusinessRulesPayload.value.length) {
        fd.append(
          "business_rules",
          JSON.stringify(orgBusinessRulesPayload.value),
        );
      }
      appendSpendAttribution(fd, { clientId: selectedClientId.value });
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
          score: Number(s.score) >= 1 && Number(s.score) <= 3 ? Number(s.score) : 2,
          pageIndex: Math.max(1, Number(s.pagina) || 1),
          sourceFile: row.file,
          sourceFilename: row.filename,
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

  // Log the successful analysis run: pages actually analyzed + suplidores found.
  const analyzedRows = pending.filter((r) => r.status === "done");
  const analyzedPages = analyzedRows.reduce(
    (sum, r) => sum + (r.pageCount ?? 1),
    0,
  );
  const extractedDelta = extractedSuplidores.value.length - extractedBefore;
  if (analyzedRows.length > 0 && extractedDelta === 0) {
    scanYieldedEmpty.value = true;
  }
  if (analyzedRows.length > 0) {
    logActivity("suplidores_analyzed", {
      clientId: selectedClientId.value,
      targetLabel: selectedClient.value?.name ?? null,
      metadata: withSession({
        files: analyzedRows.length,
        pages: analyzedPages,
        extracted: extractedDelta,
      }),
    });
  }
}

// ── Save ──────────────────────────────────────────────────────────────────────
const saving = ref(false);
const saveSuccess = ref(false);

async function saveToDatabase() {
  if (!selectedClientId.value) return;
  const toSave = selectedExtractedForSave.value;
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
    logActivity("suplidores_stored", {
      clientId: selectedClientId.value,
      targetLabel: selectedClient.value?.name ?? null,
      metadata: withSession({
        count: toSave.length,
        source: "suplidores_page",
      }),
    });
    saveSuccess.value = true;
    setTimeout(() => (saveSuccess.value = false), 3000);
  } catch (e: any) {
    dbError.value = e?.message || "Error guardando.";
  } finally {
    saving.value = false;
  }
}

// ── Download Carga Masiva template ────────────────────────────────────────────
function buildSuplidoresFilename() {
  return buildSuplidoresExportFilename(selectedClient.value?.name);
}

async function downloadTemplate() {
  // Export any explicitly selected rows (including already registered in Citrus).
  const toDownload = selectedExtracted.value.filter((s) => s.nombre);
  if (!toDownload.length) return;

  try {
    await downloadSuplidoresCargaMasiva(
      API_BASE,
      toDownload,
      buildSuplidoresFilename(),
    );
    logActivity("suplidores_exported", {
      clientId: selectedClientId.value,
      targetLabel: selectedClient.value?.name ?? null,
      metadata: withSession({
        count: toDownload.length,
        source: "extracted_suplidores",
      }),
    });
  } catch (e: any) {
    scanError.value = e?.message || "No se pudo generar la plantilla de suplidores.";
  }
}

// ── DB table: selection, export, toggle / bulk register ───────────────────────
const togglingId = ref<string | null>(null);
const bulkRegistering = ref(false);
const exportingDb = ref(false);
const unregisterConfirmOpen = ref(false);
const unregisterTarget = ref<ClientSuplidor | null>(null);

/** All saved suplidores can be selected for export. */
const selectableDb = computed(() => dbSuplidores.value);

const selectedDbSuplidores = computed(() =>
  dbSuplidores.value.filter((s) => selectedDbIds.value.has(s.id)),
);

/** Explicitly selected rows for export (registered or not). */
const selectedDbForExport = computed(() =>
  selectedDbSuplidores.value.filter((s) => s.nombre),
);

/** Selected unregistered rows for bulk "Registrar en el sistema". */
const selectedDbForRegister = computed(() =>
  selectedDbSuplidores.value.filter((s) => !s.registered_on_platform),
);

const allDbSelected = computed(
  () =>
    selectableDb.value.length > 0 &&
    selectableDb.value.every((s) => selectedDbIds.value.has(s.id)),
);

function toggleAllDb() {
  if (allDbSelected.value) {
    selectedDbIds.value = new Set();
    return;
  }
  selectedDbIds.value = new Set(selectableDb.value.map((s) => s.id));
}

function toggleDbRow(id: string, checked: boolean) {
  const next = new Set(selectedDbIds.value);
  if (checked) next.add(id);
  else next.delete(id);
  selectedDbIds.value = next;
}

async function exportDbSuplidores() {
  const toDownload = selectedDbForExport.value;
  if (!toDownload.length) return;

  exportingDb.value = true;
  scanError.value = null;
  try {
    await downloadSuplidoresCargaMasiva(
      API_BASE,
      toDownload.map((s) => ({
        documento: s.documento,
        nombre: s.nombre,
        tipo_de_factura: s.tipo_de_factura,
      })),
      buildSuplidoresFilename(),
    );
    logActivity("suplidores_exported", {
      clientId: selectedClientId.value,
      targetLabel: selectedClient.value?.name ?? null,
      metadata: withSession({
        count: toDownload.length,
        source: "saved_suplidores",
      }),
    });
  } catch (e: any) {
    scanError.value = e?.message || "No se pudo generar la plantilla de suplidores.";
  } finally {
    exportingDb.value = false;
  }
}

async function bulkRegisterSelected() {
  const toRegister = selectedDbForRegister.value;
  if (!toRegister.length) return;

  bulkRegistering.value = true;
  dbError.value = null;
  try {
    const ids = toRegister.map((s) => s.id);
    await markManyAsRegistered(ids, true);
    const idSet = new Set(ids);
    dbSuplidores.value = dbSuplidores.value.map((s) =>
      idSet.has(s.id) ? { ...s, registered_on_platform: true } : s,
    );
    selectedDbIds.value = new Set();
  } catch (e: any) {
    dbError.value = e?.message || "No se pudo marcar como registrados.";
  } finally {
    bulkRegistering.value = false;
  }
}

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

watch(
  () => activeOrg.value?.id,
  () => {
    loadOrgBusinessRules();
  },
);

onMounted(async () => {
  beginExtractionSession();
  await loadOrgBusinessRules();
  clients.value = await listClients();
});
</script>

<template>
  <div class="px-8 py-8">
    <div class="mx-auto max-w-5xl">

      <!-- Header -->
      <header class="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900">Suplidores</h1>
          <p class="mt-1 text-sm text-gray-500">
            Extrae suplidores de recibos con IA y gestiona cuáles están
            registrados en la plataforma de Carga Masiva.
          </p>
        </div>
        <ThinkingLevelSelect />
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
                @click="clearExtractionQueue"
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
          <div
            v-if="fileRows.length > 0"
            class="overflow-hidden rounded-xl border border-gray-200 bg-white transition"
            :class="isDragging ? 'border-emerald-400 ring-2 ring-emerald-200' : ''"
            @drop="onDrop"
            @dragover="onDragOver"
            @dragenter="onDragEnter"
            @dragleave="onDragLeave"
          >
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
                        @click="openFilePreview(row)"
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
            class="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white px-6 py-12 text-center transition"
            :class="isDragging
              ? 'border-emerald-500 bg-emerald-50/50'
              : 'border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/30'"
            @click="openFileDialog"
            @drop="onDrop"
            @dragover="onDragOver"
            @dragenter="onDragEnter"
            @dragleave="onDragLeave"
          >
            <svg class="mb-3 h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <p class="text-sm font-medium text-gray-500">Haz clic o arrastra recibos aquí</p>
            <p class="mt-1 text-xs text-gray-400">PDF, PNG, JPG · múltiples archivos</p>
          </div>
        </section>

        <!-- Empty analysis result -->
        <div
          v-if="scanYieldedEmpty && extractedSuplidores.length === 0"
          class="mb-10 rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-center"
        >
          <p class="text-sm font-medium text-amber-900">
            El análisis no arrojó resultados.
          </p>
          <p class="mt-1 text-sm text-amber-700">
            No se encontraron suplidores en los recibos analizados. Prueba con otro archivo o un nivel de pensamiento más profundo.
          </p>
        </div>

        <!-- ═══════════════════════════════════════════════════
             SECTION 2 — Extracted suplidores results
        ════════════════════════════════════════════════════ -->
        <section v-if="extractedSuplidores.length > 0" class="mb-10">
          <div class="mb-3 flex items-center justify-between">
            <div>
              <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400">Nuevos suplidores</h2>
              <p class="mt-0.5 text-sm text-gray-500">
                Total de <span class="font-semibold text-gray-700">{{ extractedSuplidores.length }}</span>
                {{ extractedSuplidores.length === 1 ? "suplidor" : "suplidores" }} extraídos.
                Edita los campos y marca los que quieras exportar o guardar.
                <template v-if="selectedExtracted.length > 0">
                  · <span class="font-medium text-gray-700">{{ selectedExtracted.length }} seleccionados</span>
                </template>
                <span v-if="extractedSuplidores.some(s => s.isNew && !s.alreadyInSystem)" class="text-amber-600">
                  {{ extractedSuplidores.filter(s => s.isNew && !s.alreadyInSystem).length }} nuevos.
                </span>
                <span v-if="alreadyInSystemCount > 0" class="text-emerald-600">
                  {{ alreadyInSystemCount }} ya en Citrus.
                </span>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="saveSuccess" class="text-sm font-medium text-emerald-600">✓ Guardado</span>
              <button
                type="button"
                class="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                :disabled="saving || selectedExtracted.filter(s => s.nombre).length === 0"
                :title="selectedExtracted.filter(s => s.nombre).length === 0 ? 'Selecciona al menos un suplidor' : undefined"
                @click="downloadTemplate"
              >Exportar{{ selectedExtracted.filter(s => s.nombre).length ? ` (${selectedExtracted.filter(s => s.nombre).length})` : "" }}</button>
              <button
                type="button"
                class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                :disabled="saving || selectedExtractedForSave.length === 0"
                :title="selectedExtractedForSave.length === 0 ? 'Selecciona suplidores nuevos para guardar' : undefined"
                @click="saveToDatabase"
              >{{ saving ? "Guardando…" : (selectedExtractedForSave.length ? `Guardar (${selectedExtractedForSave.length})` : "Guardar") }}</button>
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
                      :disabled="selectableExtracted.length === 0"
                      class="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600 disabled:opacity-40"
                      @change="toggleAllExtracted"
                    />
                  </th>
                  <th class="w-16 px-3 py-3 text-center">Score</th>
                  <th class="px-5 py-3">Nombre</th>
                  <th class="px-5 py-3">Documento</th>
                  <th class="px-5 py-3">Tipo de Documento</th>
                  <th class="px-5 py-3">Tipo de Factura</th>
                  <th class="w-12 px-3 py-3 text-center">Vista</th>
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
                      ? 'bg-emerald-50/40'
                      : s.selected
                        ? (s.isNew ? 'bg-amber-50/70' : 'bg-sky-50/60')
                        : 'bg-white',
                  ]"
                >
                  <!-- row checkbox -->
                  <td class="px-4 py-3">
                    <input
                      v-model="s.selected"
                      type="checkbox"
                      class="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600"
                      :title="s.selected ? 'Incluido en exportar' : 'Excluido — marca para incluir'"
                    />
                  </td>

                  <!-- Score -->
                  <td class="px-3 py-3 text-center">
                    <span
                      v-if="s.score > 0"
                      class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      :class="getSuplidorScoreClasses(s.score)"
                      :title="getSuplidorScoreLabel(s.score)"
                    >
                      {{ s.score }}
                    </span>
                    <span v-else class="text-gray-300">—</span>
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
                        class="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-sm font-medium text-gray-900 outline-none transition hover:border-gray-300 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-gray-500"
                      />
                    </div>
                  </td>

                  <!-- Documento -->
                  <td class="px-5 py-3">
                    <input
                      v-model="s.documento"
                      type="text"
                      maxlength="20"
                      inputmode="numeric"
                      :disabled="s.alreadyInSystem"
                      class="w-32 rounded-md border border-gray-200 bg-white px-2 py-1 font-mono text-xs text-gray-700 outline-none transition hover:border-gray-300 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-gray-500"
                      @input="onExtractedDocumentoInput(s)"
                    />
                  </td>

                  <!-- Tipo documento (editable) -->
                  <td class="px-5 py-3">
                    <select
                      v-model="s.tipo_de_documento"
                      :disabled="s.alreadyInSystem"
                      class="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium uppercase text-gray-700 outline-none transition hover:border-gray-300 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:opacity-60"
                    >
                      <option value="">—</option>
                      <option
                        v-for="opt in TIPO_DE_DOCUMENTO_OPTIONS"
                        :key="opt"
                        :value="opt"
                      >{{ opt }}</option>
                    </select>
                  </td>

                  <!-- Tipo factura -->
                  <td class="px-5 py-3">
                    <select
                      v-model="s.tipo_de_factura"
                      :disabled="s.alreadyInSystem"
                      class="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 outline-none transition hover:border-gray-300 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:opacity-60"
                    >
                      <option value="">—</option>
                      <option v-for="opt in TIPO_DE_FACTURA_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
                    </select>
                  </td>

                  <!-- Single-image preview -->
                  <td class="px-3 py-3 text-center">
                    <button
                      type="button"
                      class="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                      title="Vista previa (1 imagen)"
                      :disabled="!s.sourceFile || previewLoading"
                      @click="openSuplidorPreview(s)"
                    >
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
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
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400">
                Suplidores guardados — {{ selectedClient?.name }}
              </h2>
              <p class="mt-0.5 text-sm text-gray-500">
                <template v-if="dbSuplidores.length > 0">
                  {{ registeredDbCount }} de {{ dbSuplidores.length }}
                  {{ dbSuplidores.length === 1 ? "suplidor registrado" : "suplidores registrados" }}
                  en la plataforma.
                  <template v-if="selectedDbIds.size > 0">
                    · <span class="font-medium text-gray-700">{{ selectedDbForExport.length }} seleccionados</span>
                  </template>
                </template>
                <template v-else>Sin suplidores guardados aún.</template>
              </p>
            </div>
            <div class="flex flex-shrink-0 items-center gap-2">
              <button
                type="button"
                class="rounded-lg border border-emerald-600 px-3.5 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                :disabled="exportingDb || selectedDbForExport.length === 0"
                :title="selectedDbForExport.length === 0 ? 'Selecciona suplidores para exportar' : undefined"
                @click="exportDbSuplidores"
              >
                {{ exportingDb ? "Exportando…" : (selectedDbForExport.length ? `Exportar (${selectedDbForExport.length})` : "Exportar") }}
              </button>
              <button
                type="button"
                class="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                :disabled="bulkRegistering || selectedDbForRegister.length === 0"
                :title="selectedDbForRegister.length === 0 ? 'Selecciona suplidores no registrados' : undefined"
                @click="bulkRegisterSelected"
              >
                {{ bulkRegistering ? "Registrando…" : "Registrar en el sistema" }}
              </button>
              <NuxtLink
                :to="`/clientes/${selectedClientId}`"
                class="text-sm font-medium text-emerald-600 hover:underline"
              >
                Ver cliente →
              </NuxtLink>
            </div>
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
                  <th class="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      :checked="allDbSelected"
                      :disabled="selectableDb.length === 0"
                      class="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600 disabled:opacity-40"
                      @change="toggleAllDb"
                    />
                  </th>
                  <th class="px-5 py-3">Documento</th>
                  <th class="px-5 py-3">Nombre</th>
                  <th class="px-5 py-3">Tipo de Factura</th>
                  <th class="px-5 py-3">Plataforma</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr
                  v-for="s in dbSuplidores"
                  :key="s.id"
                  class="transition"
                  :class="selectedDbIds.has(s.id) ? 'bg-sky-50/50' : (s.registered_on_platform ? 'bg-emerald-50/20' : 'hover:bg-gray-50')"
                >
                  <td class="px-4 py-3">
                    <input
                      type="checkbox"
                      :checked="selectedDbIds.has(s.id)"
                      class="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600"
                      :title="selectedDbIds.has(s.id) ? 'Incluido en exportar' : 'Marca para incluir'"
                      @change="toggleDbRow(s.id, ($event.target as HTMLInputElement).checked)"
                    />
                  </td>
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
    v-if="previewUrl || previewLoading"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    @click.self="closePreview"
  >
    <div class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
      <div class="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <p class="truncate text-sm font-medium text-gray-700">{{ previewName }}</p>
        <button type="button" class="rounded-md p-1 text-gray-400 hover:bg-gray-100" @click="closePreview">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="flex flex-1 items-center justify-center overflow-auto bg-gray-100 p-3">
        <div v-if="previewLoading" class="flex items-center gap-2 py-16 text-sm text-gray-400">
          <svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
          </svg>
          Cargando imagen…
        </div>
        <img
          v-else-if="previewIsImage && previewUrl"
          :src="previewUrl"
          :alt="previewName"
          class="max-h-[80vh] w-auto max-w-full rounded object-contain shadow-sm"
        />
        <iframe
          v-else-if="previewUrl"
          :src="previewUrl"
          class="h-[80vh] w-full rounded border-0 bg-white"
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
