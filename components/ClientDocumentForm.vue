<script setup lang="ts">
import type { ClientDocumentInput } from "~/composables/useClientDocuments";

const props = defineProps<{
  submitting?: boolean;
}>();

const emit = defineEmits<{
  (e: "submit", input: ClientDocumentInput): void;
  (e: "cancel"): void;
}>();

let rowSeq = 0;
const nextId = () => `attr-${rowSeq++}`;

type AttributeRow = {
  id: string;
  documentType: string;
  documentId: string;
  description: string;
};

const documentName = ref("");
const attributes = ref<AttributeRow[]>([
  { id: nextId(), documentType: "", documentId: "", description: "" },
]);
const formError = ref<string | null>(null);

const filledAttributeCount = computed(
  () => attributes.value.filter((a) => a.documentType.trim().length > 0).length
);

const canSubmit = computed(
  () =>
    documentName.value.trim().length > 0 &&
    filledAttributeCount.value > 0 &&
    !props.submitting
);

function addAttribute() {
  attributes.value.push({
    id: nextId(),
    documentType: "",
    documentId: "",
    description: "",
  });
}

function removeAttribute(id: string) {
  if (attributes.value.length <= 1) {
    attributes.value = [
      { id: nextId(), documentType: "", documentId: "", description: "" },
    ];
    return;
  }
  attributes.value = attributes.value.filter((a) => a.id !== id);
}

function parseDocumentId(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("El ID de ERP debe ser un número entero.");
  }
  return n;
}

function onSubmit() {
  formError.value = null;
  try {
    const input: ClientDocumentInput = {
      documentName: documentName.value,
      attributes: attributes.value.map((a) => ({
        documentType: a.documentType,
        documentId: parseDocumentId(a.documentId),
        description: a.description,
      })),
    };
    emit("submit", input);
  } catch (err: any) {
    formError.value = err?.message || "Revisa los datos del formulario.";
  }
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="onSubmit">
    <div>
      <label
        for="document-name"
        class="mb-1.5 block text-sm font-medium text-gray-700"
      >
        Nombre del documento
      </label>
      <input
        id="document-name"
        v-model="documentName"
        type="text"
        required
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        placeholder='Ej. Gastos, Ingresos, Tipo de Pago'
      />
      <p class="mt-1.5 text-xs text-gray-400">
        Agrupa los conceptos / tipos de pago del ERP para este cliente.
      </p>
    </div>

    <div>
      <div class="mb-3 flex items-end justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-gray-900">Atributos</h3>
          <p class="mt-0.5 text-xs text-gray-400">
            Cada fila es un concepto o tipo de pago con su ID de ERP opcional.
          </p>
        </div>
        <button
          type="button"
          class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          @click="addAttribute"
        >
          Agregar atributo
        </button>
      </div>

      <div class="space-y-3">
        <div
          v-for="(row, index) in attributes"
          :key="row.id"
          class="rounded-xl border border-gray-200 bg-white p-4"
        >
          <div class="mb-3 flex items-center justify-between">
            <span class="text-xs font-medium uppercase tracking-wide text-gray-400">
              Atributo {{ index + 1 }}
            </span>
            <button
              type="button"
              class="rounded-md px-2 py-1 text-xs font-medium text-gray-400 transition hover:bg-red-50 hover:text-red-500"
              title="Quitar atributo"
              @click="removeAttribute(row.id)"
            >
              Quitar
            </button>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label
                :for="`attr-type-${row.id}`"
                class="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Tipo / concepto
              </label>
              <input
                :id="`attr-type-${row.id}`"
                v-model="row.documentType"
                type="text"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                placeholder='Ej. CARGOS BANCARIOS'
              />
            </div>

            <div>
              <label
                :for="`attr-erp-${row.id}`"
                class="mb-1.5 block text-sm font-medium text-gray-700"
              >
                ID ERP
                <span class="font-normal text-gray-400">(opcional)</span>
              </label>
              <input
                :id="`attr-erp-${row.id}`"
                v-model="row.documentId"
                type="text"
                inputmode="numeric"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Ej. 1"
              />
            </div>

            <div class="sm:col-span-2">
              <label
                :for="`attr-desc-${row.id}`"
                class="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Descripción
                <span class="font-normal text-gray-400">(opcional)</span>
              </label>
              <textarea
                :id="`attr-desc-${row.id}`"
                v-model="row.description"
                rows="2"
                class="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Ej. representa recibo de transferencias."
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <p
      v-if="formError"
      class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {{ formError }}
    </p>

    <div class="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
      <button
        type="button"
        class="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
        :disabled="submitting"
        @click="emit('cancel')"
      >
        Cancelar
      </button>
      <button
        type="submit"
        class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        :disabled="!canSubmit"
      >
        {{ submitting ? "Guardando…" : "Crear documento" }}
      </button>
    </div>
  </form>
</template>
