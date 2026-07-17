<script setup lang="ts">
import type { Client } from "~/composables/useClients";
import type { ClientDocumentWithAttributes } from "~/composables/useClientDocuments";
import type { ClientBusinessRuleWithAttributes } from "~/composables/useClientBusinessRules";

const { list, create, remove } = useClients();
const { create: createBusinessRule, listByClient: listRulesByClient } =
  useClientBusinessRules();
const { listByClient: listDocumentsByClient, create: createDocument } =
  useClientDocuments();

const clients = ref<Client[]>([]);
const pending = ref(true);
const error = ref<string | null>(null);
const deletingId = ref<string | null>(null);

const showForm = ref(false);
const submitting = ref(false);
const formError = ref<string | null>(null);
const form = reactive({
  name: "",
  taxPayerId: "",
});

// --- Optional business rules at creation time ------------------------------
let ruleRowSeq = 0;
const nextRuleRowKey = () => `new-client-rule-${ruleRowSeq++}`;

type NewRuleRow = {
  key: string;
  ruleType: string;
  description: string;
};

const showBusinessRules = ref(false);
const businessRuleName = ref("");
const businessRuleRows = ref<NewRuleRow[]>([
  { key: nextRuleRowKey(), ruleType: "", description: "" },
]);

function addBusinessRuleRow() {
  businessRuleRows.value.push({
    key: nextRuleRowKey(),
    ruleType: "",
    description: "",
  });
}

function removeBusinessRuleRow(key: string) {
  if (businessRuleRows.value.length <= 1) {
    businessRuleRows.value = [
      { key: nextRuleRowKey(), ruleType: "", description: "" },
    ];
    return;
  }
  businessRuleRows.value = businessRuleRows.value.filter((r) => r.key !== key);
}

function resetBusinessRulesForm() {
  showBusinessRules.value = false;
  businessRuleName.value = "";
  businessRuleRows.value = [
    { key: nextRuleRowKey(), ruleType: "", description: "" },
  ];
}

// --- Copy documents/business rules from an existing client ----------------
const copyFromExisting = ref(false);
const copySourceClientId = ref("");
const loadingCopySource = ref(false);
const copySourceError = ref<string | null>(null);
const copySourceDocuments = ref<ClientDocumentWithAttributes[]>([]);
const copySourceRules = ref<ClientBusinessRuleWithAttributes[]>([]);
const selectedDocumentIds = ref<string[]>([]);
const selectedRuleIds = ref<string[]>([]);

function resetCopyForm() {
  copyFromExisting.value = false;
  copySourceClientId.value = "";
  loadingCopySource.value = false;
  copySourceError.value = null;
  copySourceDocuments.value = [];
  copySourceRules.value = [];
  selectedDocumentIds.value = [];
  selectedRuleIds.value = [];
}

async function onCopySourceChange() {
  copySourceError.value = null;
  copySourceDocuments.value = [];
  copySourceRules.value = [];
  selectedDocumentIds.value = [];
  selectedRuleIds.value = [];

  if (!copySourceClientId.value) return;

  loadingCopySource.value = true;
  try {
    const [docs, rules] = await Promise.all([
      listDocumentsByClient(copySourceClientId.value),
      listRulesByClient(copySourceClientId.value),
    ]);
    copySourceDocuments.value = docs;
    copySourceRules.value = rules;
    selectedDocumentIds.value = docs.map((d) => d.id);
    selectedRuleIds.value = rules.map((r) => r.id);
  } catch (err: any) {
    copySourceError.value =
      err?.message || "No se pudo cargar la información de ese cliente.";
  } finally {
    loadingCopySource.value = false;
  }
}

async function load() {
  pending.value = true;
  error.value = null;
  try {
    clients.value = await list();
  } catch (err: any) {
    error.value = err?.message || "No se pudieron cargar los clientes.";
  } finally {
    pending.value = false;
  }
}

function openForm() {
  form.name = "";
  form.taxPayerId = "";
  formError.value = null;
  resetBusinessRulesForm();
  resetCopyForm();
  showForm.value = true;
}

function closeForm() {
  if (submitting.value) return;
  showForm.value = false;
}

async function onSubmit() {
  submitting.value = true;
  formError.value = null;
  try {
    const created = await create({
      name: form.name,
      taxPayerId: form.taxPayerId,
    });
    clients.value = [created, ...clients.value];

    const filledRows = businessRuleRows.value.filter(
      (r) => r.ruleType.trim().length > 0
    );
    if (showBusinessRules.value && filledRows.length > 0) {
      try {
        await createBusinessRule(created.id, {
          ruleName: businessRuleName.value.trim() || "Reglas generales",
          attributes: filledRows.map((r) => ({
            ruleType: r.ruleType,
            ruleValue: "",
            description: r.description,
          })),
        });
      } catch (ruleErr: any) {
        // The client was created successfully; surface the rules failure
        // without blocking, since business rules are optional and can be
        // added later from the client detail page.
        error.value =
          ruleErr?.message ||
          "El cliente se creó, pero no se pudieron guardar las reglas de negocio.";
      }
    }

    if (copyFromExisting.value && copySourceClientId.value) {
      const copyErrors: string[] = [];

      const docsToCopy = copySourceDocuments.value.filter((d) =>
        selectedDocumentIds.value.includes(d.id)
      );
      for (const doc of docsToCopy) {
        try {
          await createDocument(created.id, {
            documentName: doc.document_name,
            documentComment: doc.comment ?? "",
            attributes: doc.document_attributes.map((a) => ({
              documentType: a.document_type,
              documentId: a.document_id,
              description: a.description ?? "",
            })),
          });
        } catch (docErr: any) {
          copyErrors.push(
            docErr?.message || `No se pudo copiar el documento "${doc.document_name}".`
          );
        }
      }

      const rulesToCopy = copySourceRules.value.filter((r) =>
        selectedRuleIds.value.includes(r.id)
      );
      for (const rule of rulesToCopy) {
        try {
          await createBusinessRule(created.id, {
            ruleName: rule.rule_name,
            attributes: rule.business_rule_attributes.map((a) => ({
              ruleType: a.rule_type,
              ruleValue: a.rule_value ?? "",
              description: a.description ?? "",
            })),
          });
        } catch (ruleErr: any) {
          copyErrors.push(
            ruleErr?.message || `No se pudo copiar la regla "${rule.rule_name}".`
          );
        }
      }

      if (copyErrors.length > 0) {
        // The client was created successfully; surface copy failures without
        // blocking, since the copied items can be re-added later.
        error.value = `El cliente se creó, pero hubo problemas al copiar: ${copyErrors.join(" ")}`;
      }
    }

    showForm.value = false;
  } catch (err: any) {
    formError.value = err?.message || "No se pudo crear el cliente.";
  } finally {
    submitting.value = false;
  }
}

async function onDelete(client: Client) {
  if (!window.confirm(`¿Eliminar el cliente "${client.name}"?`)) return;
  deletingId.value = client.id;
  error.value = null;
  try {
    await remove(client.id);
    clients.value = clients.value.filter((c) => c.id !== client.id);
  } catch (err: any) {
    error.value = err?.message || "No se pudo eliminar el cliente.";
  } finally {
    deletingId.value = null;
  }
}

onMounted(load);
</script>

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
          type="button"
          class="flex-shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          @click="openForm"
        >
          Nuevo cliente
        </button>
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

      <!-- Empty -->
      <div
        v-else-if="clients.length === 0"
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
        <button
          type="button"
          class="mt-5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          @click="openForm"
        >
          Nuevo cliente
        </button>
      </div>

      <!-- Table -->
      <div
        v-else
        class="overflow-hidden rounded-xl border border-gray-200 bg-white"
      >
        <table class="w-full text-left text-sm">
          <thead>
            <tr
              class="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400"
            >
              <th class="px-5 py-3 font-medium">Cliente</th>
              <th class="w-40 px-5 py-3 font-medium">RNC</th>
              <th class="w-24 px-5 py-3 text-right font-medium">Acción</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="client in clients"
              :key="client.id"
              class="transition hover:bg-gray-50/60"
            >
              <td class="px-5 py-4">
                <NuxtLink
                  :to="`/clientes/${client.id}`"
                  class="font-semibold text-emerald-700 hover:underline"
                >
                  {{ client.name }}
                </NuxtLink>
              </td>
              <td class="px-5 py-4 font-mono text-sm text-gray-600">
                {{ client.tax_payer_id || "—" }}
              </td>
              <td class="px-5 py-4">
                <div class="flex items-center justify-end">
                  <button
                    type="button"
                    :disabled="deletingId === client.id"
                    class="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    title="Eliminar"
                    @click="onDelete(client)"
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
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create modal -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4"
      @click.self="closeForm"
    >
      <div
        class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nuevo-cliente-title"
      >
        <h2
          id="nuevo-cliente-title"
          class="text-lg font-semibold tracking-tight text-gray-900"
        >
          Nuevo cliente
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          El cliente queda disponible para toda la organización.
        </p>

        <form class="mt-5 space-y-4" @submit.prevent="onSubmit">
          <div>
            <label
              for="client-name"
              class="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Nombre
            </label>
            <input
              id="client-name"
              v-model="form.name"
              type="text"
              required
              autocomplete="organization"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Ej. Distribuidora Norte"
            />
          </div>

          <div>
            <label
              for="client-rnc"
              class="mb-1.5 block text-sm font-medium text-gray-700"
            >
              RNC
            </label>
            <input
              id="client-rnc"
              v-model="form.taxPayerId"
              type="text"
              required
              inputmode="numeric"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Ej. 101234567"
            />
          </div>

          <div class="rounded-lg border border-gray-200 bg-gray-50/60 p-3.5">
            <label class="flex w-full cursor-pointer items-center justify-between gap-2 text-left">
              <span>
                <span class="block text-sm font-medium text-gray-700">
                  Copiar de un cliente existente
                  <span class="font-normal text-gray-400">(opcional)</span>
                </span>
                <span class="mt-0.5 block text-xs text-gray-400">
                  Copia documentos y reglas de negocio desde otro cliente ya
                  creado.
                </span>
              </span>
              <input
                v-model="copyFromExisting"
                type="checkbox"
                class="h-4 w-4 flex-shrink-0 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500/40"
                @change="copyFromExisting || resetCopyForm()"
              />
            </label>

            <div v-if="copyFromExisting" class="mt-3.5 space-y-3">
              <div>
                <label
                  for="copy-source-client"
                  class="mb-1.5 block text-xs font-medium text-gray-600"
                >
                  Cliente de origen
                </label>
                <select
                  id="copy-source-client"
                  v-model="copySourceClientId"
                  class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  @change="onCopySourceChange"
                >
                  <option value="">Selecciona un cliente…</option>
                  <option
                    v-for="c in clients"
                    :key="c.id"
                    :value="c.id"
                  >
                    {{ c.name }}
                  </option>
                </select>
              </div>

              <p
                v-if="copySourceError"
                class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                {{ copySourceError }}
              </p>

              <div
                v-else-if="loadingCopySource"
                class="text-sm text-gray-400"
              >
                Cargando…
              </div>

              <template v-else-if="copySourceClientId">
                <div>
                  <p class="mb-1.5 text-xs font-medium text-gray-600">
                    Documentos
                  </p>
                  <div
                    v-if="copySourceDocuments.length === 0"
                    class="text-xs text-gray-400"
                  >
                    Este cliente no tiene documentos.
                  </div>
                  <div v-else class="space-y-1.5">
                    <label
                      v-for="doc in copySourceDocuments"
                      :key="doc.id"
                      class="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                    >
                      <input
                        v-model="selectedDocumentIds"
                        type="checkbox"
                        :value="doc.id"
                        class="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500/40"
                      />
                      <span>
                        <span class="block font-medium text-gray-700">{{
                          doc.document_name
                        }}</span>
                        <span class="block text-xs text-gray-400">
                          {{ doc.document_attributes.length }} atributo(s)
                        </span>
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <p class="mb-1.5 text-xs font-medium text-gray-600">
                    Reglas de negocio
                  </p>
                  <div
                    v-if="copySourceRules.length === 0"
                    class="text-xs text-gray-400"
                  >
                    Este cliente no tiene reglas de negocio.
                  </div>
                  <div v-else class="space-y-1.5">
                    <label
                      v-for="rule in copySourceRules"
                      :key="rule.id"
                      class="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                    >
                      <input
                        v-model="selectedRuleIds"
                        type="checkbox"
                        :value="rule.id"
                        class="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500/40"
                      />
                      <span>
                        <span class="block font-medium text-gray-700">{{
                          rule.rule_name
                        }}</span>
                        <span class="block text-xs text-gray-400">
                          {{ rule.business_rule_attributes.length }} atributo(s)
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <div class="rounded-lg border border-gray-200 bg-gray-50/60 p-3.5">
            <button
              type="button"
              class="flex w-full items-center justify-between gap-2 text-left"
              @click="showBusinessRules = !showBusinessRules"
            >
              <span>
                <span class="block text-sm font-medium text-gray-700">
                  Reglas de negocio
                  <span class="font-normal text-gray-400">(opcional)</span>
                </span>
                <span class="mt-0.5 block text-xs text-gray-400">
                  Contexto para ayudar a la IA a clasificar documentos de
                  este cliente. También puedes agregarlas después.
                </span>
              </span>
              <svg
                class="h-4 w-4 flex-shrink-0 text-gray-400 transition"
                :class="showBusinessRules ? 'rotate-90' : ''"
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
            </button>

            <div v-if="showBusinessRules" class="mt-3.5 space-y-3">
              <div>
                <label
                  for="business-rule-name"
                  class="mb-1.5 block text-xs font-medium text-gray-600"
                >
                  Nombre del grupo de reglas
                </label>
                <input
                  id="business-rule-name"
                  v-model="businessRuleName"
                  type="text"
                  class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Ej. Reglas generales"
                />
              </div>

              <div
                v-for="(row, index) in businessRuleRows"
                :key="row.key"
                class="rounded-lg border border-gray-200 bg-white p-3"
              >
                <div class="mb-2 flex items-center justify-between">
                  <span
                    class="text-xs font-medium uppercase tracking-wide text-gray-400"
                  >
                    Regla {{ index + 1 }}
                  </span>
                  <button
                    type="button"
                    class="rounded-md px-2 py-0.5 text-xs font-medium text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                    title="Quitar regla"
                    @click="removeBusinessRuleRow(row.key)"
                  >
                    Quitar
                  </button>
                </div>
                <div class="space-y-2">
                  <input
                    v-model="row.ruleType"
                    type="text"
                    class="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Ej. Facturas sin NCF"
                  />
                  <textarea
                    v-model="row.description"
                    rows="2"
                    class="w-full resize-y rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Contexto para la IA (opcional)…"
                  />
                </div>
              </div>

              <button
                type="button"
                class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                @click="addBusinessRuleRow"
              >
                Agregar otra regla
              </button>
            </div>
          </div>

          <p
            v-if="formError"
            class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {{ formError }}
          </p>

          <div class="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              class="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
              :disabled="submitting"
              @click="closeForm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              :disabled="submitting"
            >
              {{ submitting ? "Guardando…" : "Crear cliente" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
