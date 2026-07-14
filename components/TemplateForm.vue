<script setup lang="ts">
import type { Template, TemplateInput } from "~/composables/useTemplates";
import { parseInstructions } from "~/composables/useTemplates";

const props = defineProps<{
  template?: Template | null;
  submitting?: boolean;
}>();

const emit = defineEmits<{
  (e: "submit", input: TemplateInput): void;
}>();

const DOCUMENT_TYPES = [
  { value: "invoice", label: "Factura" },
  { value: "receipt", label: "Recibo" },
  { value: "other", label: "Otro" },
];

let rowSeq = 0;
const nextId = () => `row-${rowSeq++}`;

type ColumnRow = { id: string; name: string; description: string };
type InstructionRow = { id: string; text: string };

const name = ref("");
const description = ref("");
const documentType = ref("invoice");
const columns = ref<ColumnRow[]>([{ id: nextId(), name: "", description: "" }]);
const instructions = ref<InstructionRow[]>([{ id: nextId(), text: "" }]);

// The form is a two-stage wizard for new templates: stage 1 collects the name,
// description and reference file; running the Gemini analysis reveals stage 2
// (columns + summary sidebar). Editing an existing template skips straight to
// stage 2.
const analyzed = ref(false);
const analyzing = ref(false);
const analyzeError = ref<string | null>(null);
const aiSummary = ref<string | null>(null);

// Reference file (path = storage object key inside the private bucket).
const referencePath = ref<string | null>(null);
const referenceName = ref<string | null>(null);
const uploading = ref(false);
const previewing = ref(false);
const fileError = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const isDraggingFile = ref(false);
let dragCounter = 0;

const ALLOWED_REFERENCE_EXTS = ["csv", "xls", "xlsx"] as const;
const MAX_REFERENCE_SIZE_BYTES = 10 * 1024 * 1024;

const formError = ref<string | null>(null);

const columnCount = computed(
  () => columns.value.filter((c) => c.name.trim().length > 0).length
);

const canSubmit = computed(
  () => name.value.trim().length > 0 && columnCount.value > 0 && !uploading.value
);

// All three inputs are required before the user can run the AI analysis.
const canAnalyze = computed(
  () =>
    name.value.trim().length > 0 &&
    description.value.trim().length > 0 &&
    Boolean(referencePath.value) &&
    !uploading.value &&
    !analyzing.value
);

// ---- Hydrate from an existing template (edit mode) ----
watch(
  () => props.template,
  (tpl) => {
    if (!tpl) return;
    name.value = tpl.name ?? "";
    description.value = tpl.description ?? "";
    documentType.value = tpl.document_type ?? "invoice";
    const fields = Array.isArray(tpl.fields) ? tpl.fields : [];
    columns.value = fields.length
      ? fields.map((f) => ({
          id: nextId(),
          name: f.name ?? "",
          description: f.description ?? "",
        }))
      : [{ id: nextId(), name: "", description: "" }];
    const parsed = parseInstructions(tpl.ai_instructions);
    instructions.value = parsed.length
      ? parsed.map((text) => ({ id: nextId(), text }))
      : [{ id: nextId(), text: "" }];
    referencePath.value = tpl.reference_file_url ?? null;
    referenceName.value = tpl.reference_file_url
      ? tpl.reference_file_url.split("/").pop() ?? "Archivo"
      : null;
    // An existing template already has its columns/instructions, so skip the
    // analysis step and show the full editor.
    analyzed.value = true;
  },
  { immediate: true }
);

// ---- Columns ----
function addColumn() {
  columns.value.push({ id: nextId(), name: "", description: "" });
}
function removeColumn(index: number) {
  columns.value.splice(index, 1);
  if (columns.value.length === 0) addColumn();
}

const dragIndex = ref<number | null>(null);
function onDragStart(index: number) {
  dragIndex.value = index;
}
function onDrop(index: number) {
  if (dragIndex.value === null || dragIndex.value === index) return;
  const [moved] = columns.value.splice(dragIndex.value, 1);
  columns.value.splice(index, 0, moved);
  dragIndex.value = null;
}

// ---- Instructions ----
function addInstruction() {
  instructions.value.push({ id: nextId(), text: "" });
}
function removeInstruction(index: number) {
  instructions.value.splice(index, 1);
  if (instructions.value.length === 0) addInstruction();
}

// ---- AI analysis ----
// Sends the reference file + name + description to the server route, which
// runs Gemini (TEMPLATE_ANALYSIS_MODEL) and returns the extracted columns and
// usage instructions (written in the description's language).
async function analyze() {
  if (!canAnalyze.value) return;
  analyzing.value = true;
  analyzeError.value = null;
  try {
    const res = await $fetch<{
      columns: { name: string; description: string }[];
      instructions: string[];
      summary: string;
    }>("/api/templates/analyze", {
      method: "POST",
      body: {
        path: referencePath.value,
        name: name.value.trim(),
        description: description.value.trim(),
      },
    });

    columns.value = res.columns.length
      ? res.columns.map((c) => ({
          id: nextId(),
          name: c.name,
          description: c.description,
        }))
      : [{ id: nextId(), name: "", description: "" }];

    instructions.value = res.instructions.length
      ? res.instructions.map((text) => ({ id: nextId(), text }))
      : [{ id: nextId(), text: "" }];

    aiSummary.value = res.summary || null;
    analyzed.value = true;
  } catch (err: any) {
    analyzeError.value =
      err?.statusMessage ||
      err?.data?.statusMessage ||
      "No se pudo analizar el archivo.";
  } finally {
    analyzing.value = false;
  }
}

// ---- Reference file ----
function openFilePicker() {
  fileError.value = null;
  fileInput.value?.click();
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ""; // allow re-selecting the same file
  if (file) await processReferenceFile(file);
}

async function processReferenceFile(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_REFERENCE_EXTS.includes(ext as (typeof ALLOWED_REFERENCE_EXTS)[number])) {
    fileError.value = "Solo se permiten archivos CSV, XLS o XLSX.";
    return;
  }
  if (file.size > MAX_REFERENCE_SIZE_BYTES) {
    fileError.value = "El archivo supera el límite de 10 MB.";
    return;
  }

  // Replace any previously uploaded file.
  if (referencePath.value) await deleteUploaded(referencePath.value);

  uploading.value = true;
  fileError.value = null;
  try {
    const body = new FormData();
    body.append("file", file);
    const res = await $fetch<{ path: string; name: string }>(
      "/api/templates/reference",
      { method: "POST", body }
    );
    referencePath.value = res.path;
    referenceName.value = res.name;
  } catch (err: any) {
    fileError.value =
      err?.statusMessage || err?.data?.statusMessage || "No se pudo subir el archivo.";
  } finally {
    uploading.value = false;
  }
}

// Drag-and-drop for the reference dropzone. We track a counter (instead of a
// boolean toggled by dragenter/dragleave) because dragleave fires when the
// pointer crosses child elements, which would otherwise make the highlight
// flicker.
function onFileDragEnter(event: DragEvent) {
  if (uploading.value) return;
  if (!hasFiles(event)) return;
  dragCounter++;
  isDraggingFile.value = true;
}

function onFileDragLeave() {
  if (dragCounter > 0) dragCounter--;
  if (dragCounter === 0) isDraggingFile.value = false;
}

function onFileDragOver(event: DragEvent) {
  if (!hasFiles(event)) return;
  // Required so the subsequent `drop` event actually fires.
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
}

async function onFileDrop(event: DragEvent) {
  event.preventDefault();
  dragCounter = 0;
  isDraggingFile.value = false;
  if (uploading.value) return;
  const file = event.dataTransfer?.files?.[0];
  if (file) await processReferenceFile(file);
}

function hasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes("Files");
}

async function deleteUploaded(path: string) {
  try {
    await $fetch("/api/templates/reference", {
      method: "DELETE",
      query: { path },
    });
  } catch {
    // Best-effort cleanup; ignore failures.
  }
}

async function removeReference() {
  const path = referencePath.value;
  referencePath.value = null;
  referenceName.value = null;
  fileError.value = null;
  if (path) await deleteUploaded(path);
}

async function previewReference() {
  if (!referencePath.value) return;
  previewing.value = true;
  try {
    const res = await $fetch<{ url: string }>("/api/templates/reference-url", {
      query: { path: referencePath.value },
    });
    window.open(res.url, "_blank", "noopener");
  } catch {
    fileError.value = "No se pudo abrir la vista previa.";
  } finally {
    previewing.value = false;
  }
}

// ---- Submit ----
function onSubmit() {
  formError.value = null;
  if (!name.value.trim()) {
    formError.value = "Ingresa un nombre para la plantilla.";
    return;
  }
  if (columnCount.value === 0) {
    formError.value = "Agrega al menos una columna.";
    return;
  }
  emit("submit", {
    name: name.value,
    description: description.value,
    documentType: documentType.value,
    fields: columns.value.map((c) => ({
      name: c.name,
      description: c.description,
    })),
    instructions: instructions.value.map((i) => i.text),
    referenceFileUrl: referencePath.value,
  });
}
</script>

<template>
  <form @submit.prevent="onSubmit" class="flex flex-col gap-8 lg:flex-row">
    <!-- Main column -->
    <div class="min-w-0 flex-1 space-y-8">
      <!-- Name -->
      <div>
        <label class="mb-1.5 block text-sm font-medium text-gray-700">
          Nombre de la plantilla
        </label>
        <input
          v-model="name"
          type="text"
          placeholder="Ej. Facturas de proveedores"
          class="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      <!-- Reference + description -->
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <p class="mb-1.5 text-sm font-medium text-gray-700">Cargar referencia</p>
          <input
            ref="fileInput"
            type="file"
            accept=".csv,.xls,.xlsx"
            class="hidden"
            @change="onFileSelected"
          />

          <!-- Empty / dropzone -->
          <button
            v-if="!referenceName && !uploading"
            type="button"
            @click="openFilePicker"
            @dragenter.prevent="onFileDragEnter"
            @dragleave.prevent="onFileDragLeave"
            @dragover="onFileDragOver"
            @drop="onFileDrop"
            class="flex h-[180px] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center transition"
            :class="
              isDraggingFile
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-gray-300 bg-gray-50 hover:border-emerald-400 hover:bg-emerald-50/40'
            "
          >
            <svg
              class="h-7 w-7 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.6"
                d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6 4.5 4.5 0 0117 15h-1m-5-4v9m0-9l-3 3m3-3l3 3"
              />
            </svg>
            <span class="text-sm font-medium text-gray-600">Cargar archivo</span>
            <span class="text-xs text-gray-400">CSV, XLS o XLSX · máx. 10 MB</span>
          </button>

          <!-- Uploading -->
          <div
            v-else-if="uploading"
            class="flex h-[180px] w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50"
          >
            <svg
              class="h-6 w-6 animate-spin text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
            >
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
            <span class="text-sm text-gray-500">Subiendo…</span>
          </div>

          <!-- Filled -->
          <div
            v-else
            class="flex h-[180px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 text-center"
          >
            <span
              class="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.6"
                  d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm7 0v5h5M9 13h6m-6 4h6"
                />
              </svg>
            </span>
            <p class="max-w-[200px] truncate text-sm font-medium text-gray-700">
              {{ referenceName }}
            </p>
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="removeReference"
                class="rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
              >
                Eliminar
              </button>
              <button
                type="button"
                :disabled="previewing"
                @click="previewReference"
                class="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                {{ previewing ? "Abriendo…" : "Previsualizar" }}
              </button>
            </div>
          </div>
          <p v-if="fileError" class="mt-1.5 text-xs text-red-600">{{ fileError }}</p>
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-gray-700">
            Descripción
          </label>
          <textarea
            v-model="description"
            rows="6"
            placeholder="Detalla qué debe hacer la plantilla. Esta descripción se incluye al LLM."
            class="h-[180px] w-full resize-none rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      </div>

      <!-- Stage 1: run the AI analysis -->
      <div v-if="!analyzed">
        <button
          type="button"
          :disabled="!canAnalyze"
          @click="analyze"
          class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            v-if="analyzing"
            class="h-4 w-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
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
          {{ analyzing ? "Analizando…" : "Analizar archivo" }}
        </button>
        <p class="mt-2 text-xs text-gray-400">
          Sube el archivo de referencia y completa el nombre y la descripción
          para analizar la plantilla con IA.
        </p>
        <p v-if="analyzeError" class="mt-2 text-sm text-red-600">
          {{ analyzeError }}
        </p>
      </div>

      <!-- Document type -->
      <div v-if="analyzed" class="max-w-xs">
        <label class="mb-1.5 block text-sm font-medium text-gray-700">
          Tipo de documento
        </label>
        <select
          v-model="documentType"
          class="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option v-for="t in DOCUMENT_TYPES" :key="t.value" :value="t.value">
            {{ t.label }}
          </option>
        </select>
      </div>

      <!-- Columns -->
      <div v-if="analyzed">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-900">Columnas</h2>
          <button
            v-if="referencePath"
            type="button"
            :disabled="analyzing"
            @click="analyze"
            class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
          >
            <svg
              class="h-3.5 w-3.5"
              :class="{ 'animate-spin': analyzing }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
                d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0114-3m2 9a8 8 0 01-14 3"
              />
            </svg>
            {{ analyzing ? "Analizando…" : "Volver a analizar" }}
          </button>
        </div>

        <div
          class="grid grid-cols-[1fr_1.4fr] gap-3 border-b border-gray-100 px-9 pb-2 text-xs font-medium uppercase tracking-wide text-gray-400"
        >
          <span>Nombre</span>
          <span>Descripción</span>
        </div>

        <ul class="divide-y divide-gray-100">
          <li
            v-for="(col, index) in columns"
            :key="col.id"
            draggable="true"
            @dragstart="onDragStart(index)"
            @dragover.prevent
            @drop="onDrop(index)"
            class="group flex items-start gap-2 py-2.5"
          >
            <span
              class="mt-2.5 cursor-grab text-gray-300 transition group-hover:text-gray-400 active:cursor-grabbing"
              title="Arrastra para reordenar"
            >
              <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <circle cx="7" cy="5" r="1.5" />
                <circle cx="13" cy="5" r="1.5" />
                <circle cx="7" cy="10" r="1.5" />
                <circle cx="13" cy="10" r="1.5" />
                <circle cx="7" cy="15" r="1.5" />
                <circle cx="13" cy="15" r="1.5" />
              </svg>
            </span>
            <div class="grid flex-1 grid-cols-[1fr_1.4fr] gap-3">
              <input
                v-model="col.name"
                type="text"
                placeholder="Ej. Monto total"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <input
                v-model="col.description"
                type="text"
                placeholder="Qué debe extraer el modelo para esta columna."
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <button
              type="button"
              @click="removeColumn(index)"
              class="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              title="Eliminar columna"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                  d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v12a1 1 0 01-1 1H8a1 1 0 01-1-1V7"
                />
              </svg>
            </button>
          </li>
        </ul>

        <button
          type="button"
          @click="addColumn"
          class="mt-3 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          + Agregar columna
        </button>
      </div>
    </div>

    <!-- Summary sidebar -->
    <aside v-if="analyzed" class="w-full flex-shrink-0 lg:w-80">
      <div class="sticky top-8 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 class="mb-4 text-sm font-semibold text-gray-900">Resumen</h2>

        <div
          class="mb-5 rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm font-medium text-gray-700"
        >
          {{ columnCount }} {{ columnCount === 1 ? "Columna" : "Columnas" }}
        </div>

        <div
          v-if="aiSummary"
          class="mb-5 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3.5 py-2.5 text-xs leading-relaxed text-emerald-800"
        >
          {{ aiSummary }}
        </div>

        <p class="mb-2 text-sm font-medium text-gray-700">Instrucciones</p>
        <div class="space-y-2">
          <div
            v-for="(inst, index) in instructions"
            :key="inst.id"
            class="relative"
          >
            <textarea
              v-model="inst.text"
              rows="2"
              :placeholder="`Instrucción de uso ${index + 1}`"
              class="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 pr-7 text-sm text-gray-900 placeholder-gray-400 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <button
              v-if="instructions.length > 1"
              type="button"
              @click="removeInstruction(index)"
              class="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded text-gray-300 transition hover:bg-gray-100 hover:text-gray-500"
              title="Eliminar instrucción"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
        <button
          type="button"
          @click="addInstruction"
          class="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          + Instrucciones
        </button>

        <div class="my-5 border-t border-gray-200" />

        <p v-if="formError" class="mb-2 text-xs text-red-600">{{ formError }}</p>
        <button
          type="submit"
          :disabled="!canSubmit || submitting"
          class="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {{ submitting ? "Guardando…" : "Guardar plantilla" }}
        </button>
      </div>
    </aside>
  </form>
</template>
