<script setup lang="ts">
import type { Client } from "~/composables/useClients";
import type {
  ClientDocumentInput,
  ClientDocumentWithAttributes,
} from "~/composables/useClientDocuments";

const route = useRoute();
const clientId = computed(() => route.params.id as string);

const { get: getClient } = useClients();
const { listByClient, create, remove } = useClientDocuments();

const client = ref<Client | null>(null);
const documents = ref<ClientDocumentWithAttributes[]>([]);
const pending = ref(true);
const notFound = ref(false);
const error = ref<string | null>(null);
const deletingId = ref<string | null>(null);

const showForm = ref(false);
const submitting = ref(false);
const formError = ref<string | null>(null);

const expandedIds = ref<Set<string>>(new Set());

async function load() {
  pending.value = true;
  error.value = null;
  notFound.value = false;
  try {
    const found = await getClient(clientId.value);
    if (!found) {
      notFound.value = true;
      client.value = null;
      documents.value = [];
      return;
    }
    client.value = found;
    documents.value = await listByClient(clientId.value);
    expandedIds.value = new Set(documents.value.map((d) => d.id));
  } catch (err: any) {
    error.value = err?.message || "No se pudo cargar el cliente.";
  } finally {
    pending.value = false;
  }
}

function openForm() {
  formError.value = null;
  showForm.value = true;
}

function closeForm() {
  if (submitting.value) return;
  showForm.value = false;
}

async function onCreate(input: ClientDocumentInput) {
  submitting.value = true;
  formError.value = null;
  try {
    const created = await create(clientId.value, input);
    documents.value = [created, ...documents.value];
    expandedIds.value = new Set([...expandedIds.value, created.id]);
    showForm.value = false;
  } catch (err: any) {
    formError.value = err?.message || "No se pudo crear el documento.";
  } finally {
    submitting.value = false;
  }
}

async function onDelete(doc: ClientDocumentWithAttributes) {
  if (
    !window.confirm(
      `¿Eliminar el documento "${doc.document_name}" y todos sus atributos?`,
    )
  ) {
    return;
  }
  deletingId.value = doc.id;
  error.value = null;
  try {
    await remove(doc.id);
    documents.value = documents.value.filter((d) => d.id !== doc.id);
  } catch (err: any) {
    error.value = err?.message || "No se pudo eliminar el documento.";
  } finally {
    deletingId.value = null;
  }
}

function toggleExpanded(id: string) {
  const next = new Set(expandedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedIds.value = next;
}

function isExpanded(id: string) {
  return expandedIds.value.has(id);
}

onMounted(load);
</script>

<template>
  <div class="px-8 py-8">
    <div class="mx-auto max-w-4xl">
      <header class="mb-8">
        <NuxtLink
          to="/clientes"
          class="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-800"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.8"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Clientes
        </NuxtLink>

        <div
          v-if="!pending && !notFound && client"
          class="flex items-start justify-between gap-4"
        >
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-gray-900">
              {{ client.name }}
            </h1>
            <p class="mt-1 text-sm text-gray-500">
              RNC
              <span class="font-mono text-gray-700">{{
                client.tax_payer_id || "—"
              }}</span>
            </p>
          </div>
          <button
            type="button"
            class="flex-shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            @click="openForm"
          >
            Nuevo documento
          </button>
        </div>
      </header>

      <p
        v-if="error"
        class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
      >
        {{ error }}
      </p>

      <!-- Loading -->
      <div
        v-if="pending"
        class="flex items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-20"
      >
        <svg
          class="h-6 w-6 animate-spin text-gray-300"
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
      </div>

      <!-- Not found -->
      <div
        v-else-if="notFound"
        class="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center"
      >
        <p class="text-sm font-medium text-gray-700">Cliente no encontrado</p>
        <NuxtLink
          to="/clientes"
          class="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline"
        >
          Volver a clientes
        </NuxtLink>
      </div>

      <template v-else>
        <section>
          <div class="mb-4 flex items-baseline justify-between gap-3">
            <div>
              <h2
                class="text-sm font-semibold uppercase tracking-wide text-gray-400"
              >
                Documentos
              </h2>
              <p class="mt-0.5 text-sm text-gray-500">
                Conceptos y tipos de pago del ERP para este cliente.
              </p>
            </div>
            <span class="text-sm text-gray-400">
              {{ documents.length }}
              {{ documents.length === 1 ? "documento" : "documentos" }}
            </span>
          </div>

          <!-- Empty documents -->
          <div
            v-if="documents.length === 0"
            class="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center"
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p class="text-sm font-medium text-gray-700">
              Sin documentos todavía
            </p>
            <p class="mt-1 max-w-sm text-sm text-gray-400">
              Crea un documento (ej. Gastos) y define sus atributos de ERP.
            </p>
            <button
              type="button"
              class="mt-5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              @click="openForm"
            >
              Nuevo documento
            </button>
          </div>

          <!-- Documents list -->
          <div v-else class="space-y-3">
            <article
              v-for="doc in documents"
              :key="doc.id"
              class="overflow-hidden rounded-xl border border-gray-200 bg-white"
            >
              <div class="flex items-center justify-between gap-3 px-5 py-4">
                <button
                  type="button"
                  class="flex min-w-0 flex-1 items-center gap-2 text-left"
                  @click="toggleExpanded(doc.id)"
                >
                  <svg
                    class="h-4 w-4 flex-shrink-0 text-gray-400 transition"
                    :class="isExpanded(doc.id) ? 'rotate-90' : ''"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  <div class="min-w-0">
                    <h3 class="truncate font-semibold text-gray-900">
                      {{ doc.document_name }}
                      <span class="font-normal text-gray-400">(Document)</span>
                    </h3>
                    <p class="mt-0.5 text-xs text-gray-400">
                      {{ doc.document_attributes.length }}
                      {{
                        doc.document_attributes.length === 1
                          ? "atributo"
                          : "atributos"
                      }}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  :disabled="deletingId === doc.id"
                  class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                  title="Eliminar"
                  @click="onDelete(doc)"
                >
                  <svg
                    class="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.8"
                      d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v12a1 1 0 01-1 1H8a1 1 0 01-1-1V7"
                    />
                  </svg>
                </button>
              </div>

              <div
                v-if="isExpanded(doc.id)"
                class="border-t border-gray-100 bg-gray-50/50"
              >
                <table class="w-full text-left text-sm">
                  <thead>
                    <tr
                      class="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400"
                    >
                      <th class="px-5 py-2.5 font-medium">Id</th>
                      <th class="px-5 py-2.5 font-medium">Tipo</th>
                      <th class="w-24 px-5 py-2.5 font-medium">ID ERP</th>
                      <th class="px-5 py-2.5 font-medium">Descripción</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 bg-white">
                    <tr v-for="attr in doc.document_attributes" :key="attr.id">
                      <td class="px-5 py-3 font-mono text-xs text-gray-500">
                        {{ attr.id }}
                      </td>
                      <td class="px-5 py-3 font-medium text-gray-900">
                        {{ attr.document_type }}
                      </td>
                      <td class="px-5 py-3 font-mono text-gray-600">
                        {{ attr.document_id ?? "—" }}
                      </td>
                      <td class="px-5 py-3 text-gray-500">
                        {{ attr.description || "—" }}
                      </td>
                    </tr>
                    <tr v-if="doc.document_attributes.length === 0">
                      <td
                        colspan="4"
                        class="px-5 py-6 text-center text-sm text-gray-400"
                      >
                        Sin atributos
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </section>
      </template>
    </div>

    <!-- Create document modal -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/40 p-4 sm:items-center"
      @click.self="closeForm"
    >
      <div
        class="my-4 w-full max-w-2xl rounded-xl max-h-40 overflow-y-auto border border-gray-200 bg-white p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nuevo-documento-title"
      >
        <h2
          id="nuevo-documento-title"
          class="text-lg font-semibold tracking-tight text-gray-900"
        >
          Nuevo documento
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          Define el contenedor y sus atributos de ERP para
          <span class="font-medium text-gray-700">{{ client?.name }}</span
          >.
        </p>

        <p
          v-if="formError"
          class="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {{ formError }}
        </p>

        <div class="mt-5">
          <ClientDocumentForm
            :submitting="submitting"
            @submit="onCreate"
            @cancel="closeForm"
          />
        </div>
      </div>
    </div>
  </div>
</template>
