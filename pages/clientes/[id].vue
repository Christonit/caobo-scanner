<script setup lang="ts">
import type { Client } from "~/composables/useClients";
import type {
  ClientDocumentInput,
  ClientDocumentWithAttributes,
  DocumentAttribute,
} from "~/composables/useClientDocuments";
import type {
  ClientBusinessRuleInput,
  ClientBusinessRuleWithAttributes,
  BusinessRuleAttribute,
} from "~/composables/useClientBusinessRules";

const route = useRoute();
const clientId = computed(() => route.params.id as string);

const { get: getClient } = useClients();
const { listByClient, create, update, updateAttributeDescription, remove } =
  useClientDocuments();
const {
  listByClient: listRulesByClient,
  create: createRule,
  update: updateRule,
  updateAttributeDescription: updateRuleAttributeDescription,
  remove: removeRule,
} = useClientBusinessRules();

type Tab = "documentos" | "reglas";
const activeTab = ref<Tab>("documentos");

const client = ref<Client | null>(null);
const documents = ref<ClientDocumentWithAttributes[]>([]);
const businessRules = ref<ClientBusinessRuleWithAttributes[]>([]);
const pending = ref(true);
const notFound = ref(false);
const error = ref<string | null>(null);
const deletingId = ref<string | null>(null);

const showForm = ref(false);
const editingDoc = ref<ClientDocumentWithAttributes | null>(null);
const submitting = ref(false);
const formError = ref<string | null>(null);

const commentAttr = ref<DocumentAttribute | null>(null);
const commentDocId = ref<string | null>(null);
const commentDraft = ref("");
const commentSaving = ref(false);
const commentError = ref<string | null>(null);

const expandedIds = ref<Set<string>>(new Set());

const isEditing = computed(() => editingDoc.value != null);

// --- Business rules (Anotaciones del Negocio) state -----------------------
const showRuleForm = ref(false);
const editingRule = ref<ClientBusinessRuleWithAttributes | null>(null);
const ruleSubmitting = ref(false);
const ruleFormError = ref<string | null>(null);
const deletingRuleId = ref<string | null>(null);

const ruleCommentAttr = ref<BusinessRuleAttribute | null>(null);
const ruleCommentRuleId = ref<string | null>(null);
const ruleCommentDraft = ref("");
const ruleCommentSaving = ref(false);
const ruleCommentError = ref<string | null>(null);

const ruleExpandedIds = ref<Set<string>>(new Set());

const isEditingRule = computed(() => editingRule.value != null);

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
    businessRules.value = await listRulesByClient(clientId.value);
    ruleExpandedIds.value = new Set(businessRules.value.map((r) => r.id));
  } catch (err: any) {
    error.value = err?.message || "No se pudo cargar el cliente.";
  } finally {
    pending.value = false;
  }
}

function openForm() {
  formError.value = null;
  editingDoc.value = null;
  showForm.value = true;
}

function openEdit(doc: ClientDocumentWithAttributes) {
  formError.value = null;
  editingDoc.value = doc;
  showForm.value = true;
}

function closeForm() {
  if (submitting.value) return;
  showForm.value = false;
  editingDoc.value = null;
}

async function onCreate(input: ClientDocumentInput) {
  submitting.value = true;
  formError.value = null;
  try {
    const created = await create(clientId.value, input);
    documents.value = [created, ...documents.value];
    expandedIds.value = new Set([...expandedIds.value, created.id]);
    showForm.value = false;
    editingDoc.value = null;
  } catch (err: any) {
    formError.value = err?.message || "No se pudo crear el documento.";
  } finally {
    submitting.value = false;
  }
}

async function onUpdate(input: ClientDocumentInput) {
  if (!editingDoc.value) return;
  submitting.value = true;
  formError.value = null;
  try {
    const updated = await update(editingDoc.value.id, input);
    documents.value = documents.value.map((d) =>
      d.id === updated.id ? updated : d
    );
    showForm.value = false;
    editingDoc.value = null;
  } catch (err: any) {
    formError.value = err?.message || "No se pudo actualizar el documento.";
  } finally {
    submitting.value = false;
  }
}

function onFormSubmit(input: ClientDocumentInput) {
  if (isEditing.value) {
    return onUpdate(input);
  }
  return onCreate(input);
}

async function onDelete(doc: ClientDocumentWithAttributes) {
  if (
    !window.confirm(
      `¿Eliminar el documento "${doc.document_name}" y todos sus atributos?`
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

function openComment(doc: ClientDocumentWithAttributes, attr: DocumentAttribute) {
  commentDocId.value = doc.id;
  commentAttr.value = attr;
  commentDraft.value = attr.description ?? "";
  commentError.value = null;
}

function closeComment() {
  if (commentSaving.value) return;
  commentAttr.value = null;
  commentDocId.value = null;
  commentDraft.value = "";
  commentError.value = null;
}

async function saveComment() {
  if (!commentAttr.value || !commentDocId.value) return;
  commentSaving.value = true;
  commentError.value = null;
  try {
    const updated = await updateAttributeDescription(
      commentAttr.value.id,
      commentDraft.value
    );
    documents.value = documents.value.map((doc) => {
      if (doc.id !== commentDocId.value) return doc;
      return {
        ...doc,
        document_attributes: doc.document_attributes.map((a) =>
          a.id === updated.id ? updated : a
        ),
      };
    });
    commentSaving.value = false;
    closeComment();
  } catch (err: any) {
    commentError.value = err?.message || "No se pudo guardar el comentario.";
    commentSaving.value = false;
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

function openRuleForm() {
  ruleFormError.value = null;
  editingRule.value = null;
  showRuleForm.value = true;
}

function openRuleEdit(rule: ClientBusinessRuleWithAttributes) {
  ruleFormError.value = null;
  editingRule.value = rule;
  showRuleForm.value = true;
}

function closeRuleForm() {
  if (ruleSubmitting.value) return;
  showRuleForm.value = false;
  editingRule.value = null;
}

async function onCreateRule(input: ClientBusinessRuleInput) {
  ruleSubmitting.value = true;
  ruleFormError.value = null;
  try {
    const created = await createRule(clientId.value, input);
    businessRules.value = [created, ...businessRules.value];
    ruleExpandedIds.value = new Set([...ruleExpandedIds.value, created.id]);
    showRuleForm.value = false;
    editingRule.value = null;
  } catch (err: any) {
    ruleFormError.value = err?.message || "No se pudo crear la regla.";
  } finally {
    ruleSubmitting.value = false;
  }
}

async function onUpdateRule(input: ClientBusinessRuleInput) {
  if (!editingRule.value) return;
  ruleSubmitting.value = true;
  ruleFormError.value = null;
  try {
    const updated = await updateRule(editingRule.value.id, input);
    businessRules.value = businessRules.value.map((r) =>
      r.id === updated.id ? updated : r
    );
    showRuleForm.value = false;
    editingRule.value = null;
  } catch (err: any) {
    ruleFormError.value = err?.message || "No se pudo actualizar la regla.";
  } finally {
    ruleSubmitting.value = false;
  }
}

function onRuleFormSubmit(input: ClientBusinessRuleInput) {
  if (isEditingRule.value) {
    return onUpdateRule(input);
  }
  return onCreateRule(input);
}

async function onDeleteRule(rule: ClientBusinessRuleWithAttributes) {
  if (
    !window.confirm(
      `¿Eliminar la regla "${rule.rule_name}" y todos sus atributos?`
    )
  ) {
    return;
  }
  deletingRuleId.value = rule.id;
  error.value = null;
  try {
    await removeRule(rule.id);
    businessRules.value = businessRules.value.filter((r) => r.id !== rule.id);
  } catch (err: any) {
    error.value = err?.message || "No se pudo eliminar la regla.";
  } finally {
    deletingRuleId.value = null;
  }
}

function openRuleComment(
  rule: ClientBusinessRuleWithAttributes,
  attr: BusinessRuleAttribute
) {
  ruleCommentRuleId.value = rule.id;
  ruleCommentAttr.value = attr;
  ruleCommentDraft.value = attr.description ?? "";
  ruleCommentError.value = null;
}

function closeRuleComment() {
  if (ruleCommentSaving.value) return;
  ruleCommentAttr.value = null;
  ruleCommentRuleId.value = null;
  ruleCommentDraft.value = "";
  ruleCommentError.value = null;
}

async function saveRuleComment() {
  if (!ruleCommentAttr.value || !ruleCommentRuleId.value) return;
  ruleCommentSaving.value = true;
  ruleCommentError.value = null;
  try {
    const updated = await updateRuleAttributeDescription(
      ruleCommentAttr.value.id,
      ruleCommentDraft.value
    );
    businessRules.value = businessRules.value.map((rule) => {
      if (rule.id !== ruleCommentRuleId.value) return rule;
      return {
        ...rule,
        business_rule_attributes: rule.business_rule_attributes.map((a) =>
          a.id === updated.id ? updated : a
        ),
      };
    });
    ruleCommentSaving.value = false;
    closeRuleComment();
  } catch (err: any) {
    ruleCommentError.value = err?.message || "No se pudo guardar el contexto.";
    ruleCommentSaving.value = false;
  }
}

function toggleRuleExpanded(id: string) {
  const next = new Set(ruleExpandedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  ruleExpandedIds.value = next;
}

function isRuleExpanded(id: string) {
  return ruleExpandedIds.value.has(id);
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
            v-if="activeTab === 'documentos'"
            type="button"
            class="flex-shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            @click="openForm"
          >
            Nuevo documento
          </button>
          <button
            v-else
            type="button"
            class="flex-shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            @click="openRuleForm"
          >
            Nueva regla
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
        <!-- Tabs -->
        <div class="mb-6 flex items-center gap-1 border-b border-gray-200">
          <button
            type="button"
            class="relative px-1 pb-3 text-sm font-semibold transition"
            :class="
              activeTab === 'documentos'
                ? 'text-gray-900'
                : 'text-gray-400 hover:text-gray-600'
            "
            @click="activeTab = 'documentos'"
          >
            Documentos
            <span
              v-if="activeTab === 'documentos'"
              class="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-emerald-600"
            />
          </button>
          <button
            type="button"
            class="relative ml-5 px-1 pb-3 text-sm font-semibold transition"
            :class="
              activeTab === 'reglas'
                ? 'text-gray-900'
                : 'text-gray-400 hover:text-gray-600'
            "
            @click="activeTab = 'reglas'"
          >
            Anotaciones del Negocio
            <span
              v-if="activeTab === 'reglas'"
              class="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-emerald-600"
            />
          </button>
        </div>

        <section v-if="activeTab === 'documentos'">
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
                    <p
                      v-if="doc.comment"
                      class="mt-1 truncate text-xs text-gray-500"
                      :title="doc.comment"
                    >
                      Comentario: {{ doc.comment }}
                    </p>
                  </div>
                </button>

                <div class="flex flex-shrink-0 items-center gap-1">
                  <button
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                    title="Editar"
                    @click="openEdit(doc)"
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
                        d="M15.232 5.232l3.536 3.536M4 20h4.586a1 1 0 00.707-.293l9.414-9.414a2 2 0 000-2.828l-2.172-2.172a2 2 0 00-2.828 0L4.293 14.707A1 1 0 004 15.414V20z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    :disabled="deletingId === doc.id"
                    class="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
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
                      <th class="px-5 py-2.5 font-medium">Comentario</th>
                      <th class="w-20 px-3 py-2.5 font-medium">
                        <span class="sr-only">Acciones</span>
                      </th>
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
                        <p
                          class="whitespace-pre-wrap break-words"
                          :class="
                            attr.description
                              ? 'text-gray-600'
                              : 'text-gray-300'
                          "
                        >
                          {{ attr.description || "—" }}
                        </p>
                      </td>
                      <td class="px-3 py-3 text-right">
                        <button
                          type="button"
                          class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition hover:bg-emerald-50 hover:text-emerald-700"
                          :title="
                            attr.description
                              ? 'Editar comentario'
                              : 'Agregar comentario'
                          "
                          @click="openComment(doc, attr)"
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
                              stroke-width="1.8"
                              d="M8 10h8M8 14h5m7-5.5V17a2 2 0 01-2 2H7l-4 3V6a2 2 0 012-2h14a2 2 0 012 2z"
                            />
                          </svg>
                          {{ attr.description ? "Editar" : "Comentar" }}
                        </button>
                      </td>
                    </tr>
                    <tr v-if="doc.document_attributes.length === 0">
                      <td
                        colspan="5"
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

        <section v-else>
          <div class="mb-4 flex items-baseline justify-between gap-3">
            <div>
              <h2
                class="text-sm font-semibold uppercase tracking-wide text-gray-400"
              >
                Anotaciones del Negocio
              </h2>
              <p class="mt-0.5 text-sm text-gray-500">
                Reglas de negocio opcionales que dan contexto a la IA para
                tomar mejores decisiones con este cliente.
              </p>
            </div>
            <span class="text-sm text-gray-400">
              {{ businessRules.length }}
              {{ businessRules.length === 1 ? "regla" : "reglas" }}
            </span>
          </div>

          <!-- Empty business rules -->
          <div
            v-if="businessRules.length === 0"
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
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <p class="text-sm font-medium text-gray-700">
              Sin reglas de negocio todavía
            </p>
            <p class="mt-1 max-w-sm text-sm text-gray-400">
              Son opcionales. Agrega contexto (ej. excepciones o
              convenciones) para ayudar a la IA a clasificar mejor los
              documentos de este cliente.
            </p>
            <button
              type="button"
              class="mt-5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              @click="openRuleForm"
            >
              Nueva regla
            </button>
          </div>

          <!-- Business rules list -->
          <div v-else class="space-y-3">
            <article
              v-for="rule in businessRules"
              :key="rule.id"
              class="overflow-hidden rounded-xl border border-gray-200 bg-white"
            >
              <div class="flex items-center justify-between gap-3 px-5 py-4">
                <button
                  type="button"
                  class="flex min-w-0 flex-1 items-center gap-2 text-left"
                  @click="toggleRuleExpanded(rule.id)"
                >
                  <svg
                    class="h-4 w-4 flex-shrink-0 text-gray-400 transition"
                    :class="isRuleExpanded(rule.id) ? 'rotate-90' : ''"
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
                      {{ rule.rule_name }}
                      <span class="font-normal text-gray-400">(Regla)</span>
                    </h3>
                    <p class="mt-0.5 text-xs text-gray-400">
                      {{ rule.business_rule_attributes.length }}
                      {{
                        rule.business_rule_attributes.length === 1
                          ? "regla"
                          : "reglas"
                      }}
                    </p>
                  </div>
                </button>

                <div class="flex flex-shrink-0 items-center gap-1">
                  <button
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                    title="Editar"
                    @click="openRuleEdit(rule)"
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
                        d="M15.232 5.232l3.536 3.536M4 20h4.586a1 1 0 00.707-.293l9.414-9.414a2 2 0 000-2.828l-2.172-2.172a2 2 0 00-2.828 0L4.293 14.707A1 1 0 004 15.414V20z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    :disabled="deletingRuleId === rule.id"
                    class="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    title="Eliminar"
                    @click="onDeleteRule(rule)"
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
              </div>

              <div
                v-if="isRuleExpanded(rule.id)"
                class="border-t border-gray-100 bg-gray-50/50"
              >
                <table class="w-full text-left text-sm">
                  <thead>
                    <tr
                      class="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400"
                    >
                      <th class="px-5 py-2.5 font-medium">Id</th>
                      <th class="px-5 py-2.5 font-medium">Regla</th>
                      <th class="w-32 px-5 py-2.5 font-medium">Valor</th>
                      <th class="px-5 py-2.5 font-medium">Contexto</th>
                      <th class="w-20 px-3 py-2.5 font-medium">
                        <span class="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 bg-white">
                    <tr
                      v-for="attr in rule.business_rule_attributes"
                      :key="attr.id"
                    >
                      <td class="px-5 py-3 font-mono text-xs text-gray-500">
                        {{ attr.id }}
                      </td>
                      <td class="px-5 py-3 font-medium text-gray-900">
                        {{ attr.rule_type }}
                      </td>
                      <td class="px-5 py-3 font-mono text-gray-600">
                        {{ attr.rule_value || "—" }}
                      </td>
                      <td class="px-5 py-3 text-gray-500">
                        <p
                          class="whitespace-pre-wrap break-words"
                          :class="
                            attr.description
                              ? 'text-gray-600'
                              : 'text-gray-300'
                          "
                        >
                          {{ attr.description || "—" }}
                        </p>
                      </td>
                      <td class="px-3 py-3 text-right">
                        <button
                          type="button"
                          class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition hover:bg-emerald-50 hover:text-emerald-700"
                          :title="
                            attr.description
                              ? 'Editar contexto'
                              : 'Agregar contexto'
                          "
                          @click="openRuleComment(rule, attr)"
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
                              stroke-width="1.8"
                              d="M8 10h8M8 14h5m7-5.5V17a2 2 0 01-2 2H7l-4 3V6a2 2 0 012-2h14a2 2 0 012 2z"
                            />
                          </svg>
                          {{ attr.description ? "Editar" : "Comentar" }}
                        </button>
                      </td>
                    </tr>
                    <tr v-if="rule.business_rule_attributes.length === 0">
                      <td
                        colspan="5"
                        class="px-5 py-6 text-center text-sm text-gray-400"
                      >
                        Sin reglas
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

    <!-- Create / edit document modal -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/40 p-4 sm:items-center"
      @click.self="closeForm"
    >
      <div
        class="my-4 h-full max-h-[90vh] min-h-24 w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="isEditing ? 'editar-documento-title' : 'nuevo-documento-title'"
      >
        <h2
          :id="isEditing ? 'editar-documento-title' : 'nuevo-documento-title'"
          class="text-lg font-semibold tracking-tight text-gray-900"
        >
          {{ isEditing ? "Editar documento" : "Nuevo documento" }}
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          {{
            isEditing
              ? "Actualiza el nombre, atributos y comentarios de"
              : "Define el contenedor y sus atributos de ERP para"
          }}
          <span class="font-medium text-gray-700">{{ client?.name }}</span>.
        </p>

        <p
          v-if="formError"
          class="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {{ formError }}
        </p>

        <div class="mt-5">
          <ClientDocumentForm
            :key="editingDoc?.id ?? 'new'"
            :initial="editingDoc"
            :submitting="submitting"
            :submit-label="isEditing ? 'Guardar cambios' : 'Crear documento'"
            @submit="onFormSubmit"
            @cancel="closeForm"
          />
        </div>
      </div>
    </div>

    <!-- Comment modal -->
    <div
      v-if="commentAttr"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/40 p-4 sm:items-center"
      @click.self="closeComment"
    >
      <div
        class="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comentario-title"
      >
        <h2
          id="comentario-title"
          class="text-lg font-semibold tracking-tight text-gray-900"
        >
          {{ commentAttr.description ? "Editar comentario" : "Agregar comentario" }}
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          Para
          <span class="font-medium text-gray-700">{{
            commentAttr.document_type
          }}</span>
          <span v-if="commentAttr.document_id != null" class="font-mono text-gray-400">
            (ERP {{ commentAttr.document_id }})
          </span>
        </p>

        <label
          for="attr-comment"
          class="mb-1.5 mt-5 block text-sm font-medium text-gray-700"
        >
          Comentario
        </label>
        <textarea
          id="attr-comment"
          v-model="commentDraft"
          rows="5"
          class="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          placeholder="Notas para clasificar este tipo de gasto o pago…"
        />

        <p
          v-if="commentError"
          class="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {{ commentError }}
        </p>

        <div class="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            class="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
            :disabled="commentSaving"
            @click="closeComment"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            :disabled="commentSaving"
            @click="saveComment"
          >
            {{ commentSaving ? "Guardando…" : "Guardar comentario" }}
          </button>
        </div>
      </div>
    </div>

    <!-- Create / edit business rule modal -->
    <div
      v-if="showRuleForm"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/40 p-4 sm:items-center"
      @click.self="closeRuleForm"
    >
      <div
        class="my-4 h-full max-h-[90vh] min-h-24 w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="isEditingRule ? 'editar-regla-title' : 'nueva-regla-title'"
      >
        <h2
          :id="isEditingRule ? 'editar-regla-title' : 'nueva-regla-title'"
          class="text-lg font-semibold tracking-tight text-gray-900"
        >
          {{ isEditingRule ? "Editar regla de negocio" : "Nueva regla de negocio" }}
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          {{
            isEditingRule
              ? "Actualiza el nombre, reglas y contexto de"
              : "Define reglas de negocio opcionales que ayuden a la IA con"
          }}
          <span class="font-medium text-gray-700">{{ client?.name }}</span>.
        </p>

        <p
          v-if="ruleFormError"
          class="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {{ ruleFormError }}
        </p>

        <div class="mt-5">
          <ClientBusinessRuleForm
            :key="editingRule?.id ?? 'new'"
            :initial="editingRule"
            :submitting="ruleSubmitting"
            :submit-label="isEditingRule ? 'Guardar cambios' : 'Crear regla'"
            @submit="onRuleFormSubmit"
            @cancel="closeRuleForm"
          />
        </div>
      </div>
    </div>

    <!-- Business rule comment modal -->
    <div
      v-if="ruleCommentAttr"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/40 p-4 sm:items-center"
      @click.self="closeRuleComment"
    >
      <div
        class="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="regla-comentario-title"
      >
        <h2
          id="regla-comentario-title"
          class="text-lg font-semibold tracking-tight text-gray-900"
        >
          {{
            ruleCommentAttr.description
              ? "Editar contexto"
              : "Agregar contexto"
          }}
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          Para
          <span class="font-medium text-gray-700">{{
            ruleCommentAttr.rule_type
          }}</span>
          <span v-if="ruleCommentAttr.rule_value" class="font-mono text-gray-400">
            ({{ ruleCommentAttr.rule_value }})
          </span>
        </p>

        <label
          for="rule-attr-comment"
          class="mb-1.5 mt-5 block text-sm font-medium text-gray-700"
        >
          Contexto para la IA
        </label>
        <textarea
          id="rule-attr-comment"
          v-model="ruleCommentDraft"
          rows="5"
          class="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          placeholder="Explica cómo debe aplicarse esta regla al procesar documentos…"
        />

        <p
          v-if="ruleCommentError"
          class="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {{ ruleCommentError }}
        </p>

        <div class="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            class="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
            :disabled="ruleCommentSaving"
            @click="closeRuleComment"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            :disabled="ruleCommentSaving"
            @click="saveRuleComment"
          >
            {{ ruleCommentSaving ? "Guardando…" : "Guardar contexto" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
