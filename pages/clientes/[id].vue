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
import type {
  ClientSuplidor,
  ClientSuplidorInput,
} from "~/composables/useClientSuplidores";
import { TIPO_DE_FACTURA_OPTIONS } from "~/composables/useClientSuplidores";
import type { TaxColumnMapping } from "~/composables/useClientTaxColumnMapping";
import { TAX_COLUMN_FIELDS } from "~/composables/useClientTaxColumnMapping";
import {
  buildSuplidoresExportFilename,
  downloadSuplidoresCargaMasiva,
} from "~/utils/suplidoresExport";

const route = useRoute();
const clientId = computed(() => route.params.id as string);
const API_BASE = useApiBase();
const { log: logActivity } = useActivityLog();

const { get: getClient, updateExtractionDocuments } = useClients();
const { listByClient, create, update, updateAttributeDescription, remove } =
  useClientDocuments();
const {
  listByClient: listRulesByClient,
  create: createRule,
  update: updateRule,
  updateAttributeDescription: updateRuleAttributeDescription,
  remove: removeRule,
} = useClientBusinessRules();
const {
  listByClient: listSuplidoresByClient,
  create: createSuplidor,
  update: updateSuplidor,
  markAsRegistered,
  remove: removeSuplidor,
} = useClientSuplidores();
const { getByClient: getTaxColumnMapping, upsert: upsertTaxColumnMapping } =
  useClientTaxColumnMapping();

type Tab = "documentos" | "reglas" | "suplidores" | "impuestos" | "ajustes";
const VALID_TABS: Tab[] = [
  "documentos",
  "reglas",
  "suplidores",
  "impuestos",
  "ajustes",
];
const activeTab = ref<Tab>(
  (() => {
    const raw = route.query.tab as string;
    // Legacy deep-link from before the tab was renamed.
    const normalized = raw === "extraccion" ? "ajustes" : raw;
    return VALID_TABS.includes(normalized as Tab)
      ? (normalized as Tab)
      : "documentos";
  })(),
);

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

// --- Suplidores state ---------------------------------------------------
const suplidores = ref<ClientSuplidor[]>([]);
const showSuplidorForm = ref(false);
const editingSuplidor = ref<ClientSuplidor | null>(null);
const suplidorSubmitting = ref(false);
const suplidorFormError = ref<string | null>(null);
const deletingSuplidorId = ref<string | null>(null);
const togglingRegisteredId = ref<string | null>(null);
const unregisterConfirmOpen = ref(false);
const unregisterTarget = ref<ClientSuplidor | null>(null);

const isEditingSuplidor = computed(() => editingSuplidor.value != null);

const suplidorDraft = ref<ClientSuplidorInput>({
  nombre: "",
  documento: null,
  tipo_de_factura: null,
  registered_on_platform: false,
});

const suplidorSearch = ref("");

const filteredSuplidores = computed(() => {
  const q = suplidorSearch.value.trim().toLowerCase();
  if (!q) return suplidores.value;
  return suplidores.value.filter((s) => {
    const nombre = (s.nombre ?? "").toLowerCase();
    const documento = (s.documento ?? "").toLowerCase();
    return nombre.includes(q) || documento.includes(q);
  });
});

const registeredCount = computed(
  () => suplidores.value.filter((s) => s.registered_on_platform).length,
);

const selectedSuplidorIds = ref<Set<string>>(new Set());

/** Any named suplidor can be selected for export (registered or not). */
const selectableClientSuplidores = computed(() =>
  filteredSuplidores.value.filter((s) => s.nombre),
);

const selectedExportableSuplidores = computed(() =>
  selectableClientSuplidores.value.filter((s) =>
    selectedSuplidorIds.value.has(s.id),
  ),
);

const allClientSuplidoresSelected = computed(
  () =>
    selectableClientSuplidores.value.length > 0 &&
    selectableClientSuplidores.value.every((s) =>
      selectedSuplidorIds.value.has(s.id),
    ),
);

function toggleAllClientSuplidores() {
  if (allClientSuplidoresSelected.value) {
    selectedSuplidorIds.value = new Set();
    return;
  }
  selectedSuplidorIds.value = new Set(
    selectableClientSuplidores.value.map((s) => s.id),
  );
}

function toggleClientSuplidorRow(id: string, checked: boolean) {
  const next = new Set(selectedSuplidorIds.value);
  if (checked) next.add(id);
  else next.delete(id);
  selectedSuplidorIds.value = next;
}

const exportingSuplidores = ref(false);

async function exportSuplidores() {
  const toExport = selectedExportableSuplidores.value;
  if (!toExport.length) return;
  exportingSuplidores.value = true;
  suplidorFormError.value = null;
  try {
    await downloadSuplidoresCargaMasiva(
      API_BASE,
      toExport.map((s) => ({
        documento: s.documento,
        nombre: s.nombre,
        tipo_de_factura: s.tipo_de_factura,
      })),
      buildSuplidoresExportFilename(client.value?.name),
    );
    logActivity("suplidores_exported", {
      clientId: clientId.value,
      targetLabel: client.value?.name ?? null,
      metadata: {
        count: toExport.length,
        source: "client_detail",
      },
    });
  } catch (err: any) {
    suplidorFormError.value =
      err?.message || "No se pudo exportar los suplidores.";
  } finally {
    exportingSuplidores.value = false;
  }
}

// --- Tax column mapping (Impuestos) state --------------------------------
const TAX_COLUMN_FIELD_LABELS: Record<
  (typeof TAX_COLUMN_FIELDS)[number],
  string
> = {
  itbis: "ITBIS",
  selectivo: "Selectivo",
  descuento: "Descuento",
  propina: "Propina",
  otros_impuestos: "Otros Impuestos",
};
const taxMapping = ref<TaxColumnMapping>({});
const taxMappingSaving = ref(false);
const taxMappingError = ref<string | null>(null);
const taxMappingSaved = ref(false);

// --- Extraction document preferences (Ajustes) ---------------------------
const extractionConceptoDocId = ref("");
const extractionTipoDePagoDocId = ref("");
const extractionTipoDeGastoContextDocId = ref("");
const extractionSaving = ref(false);
const extractionError = ref<string | null>(null);
const extractionSaved = ref(false);
const extractionEditing = ref(false);
const extractionConfirmOpen = ref(false);

/** Required catalogs already saved on the client. */
const extractionConfigured = computed(
  () =>
    Boolean(
      client.value?.concepto_document_id &&
        client.value?.tipo_de_pago_document_id,
    ),
);

/** Fields locked when configured and not in edit mode. */
const extractionFieldsLocked = computed(
  () => extractionConfigured.value && !extractionEditing.value,
);

function syncExtractionPrefsFromClient(c: Client | null) {
  extractionConceptoDocId.value = c?.concepto_document_id ?? "";
  extractionTipoDePagoDocId.value = c?.tipo_de_pago_document_id ?? "";
  extractionTipoDeGastoContextDocId.value =
    c?.tipo_de_gasto_context_document_id ?? "";
}

function startExtractionEdit() {
  extractionError.value = null;
  extractionEditing.value = true;
}

function cancelExtractionEdit() {
  syncExtractionPrefsFromClient(client.value);
  extractionError.value = null;
  extractionEditing.value = false;
  extractionConfirmOpen.value = false;
}

function requestSaveExtractionDocuments() {
  if (!extractionConceptoDocId.value || !extractionTipoDePagoDocId.value) {
    extractionError.value =
      "Selecciona los documentos de Concepto Id y Tipo de Pago Id.";
    return;
  }
  extractionError.value = null;
  extractionConfirmOpen.value = true;
}

function cancelExtractionConfirm() {
  if (extractionSaving.value) return;
  extractionConfirmOpen.value = false;
}

async function confirmSaveExtractionDocuments() {
  extractionSaving.value = true;
  extractionError.value = null;
  extractionSaved.value = false;
  try {
    const updated = await updateExtractionDocuments(clientId.value, {
      conceptoDocumentId: extractionConceptoDocId.value || null,
      tipoDePagoDocumentId: extractionTipoDePagoDocId.value || null,
      tipoDeGastoContextDocumentId:
        extractionTipoDeGastoContextDocId.value || null,
    });
    client.value = updated;
    syncExtractionPrefsFromClient(updated);
    extractionEditing.value = false;
    extractionConfirmOpen.value = false;
    extractionSaved.value = true;
    setTimeout(() => {
      extractionSaved.value = false;
    }, 2000);
  } catch (err: any) {
    extractionConfirmOpen.value = false;
    extractionError.value =
      err?.message || "No se pudo guardar la configuración de extracción.";
  } finally {
    extractionSaving.value = false;
  }
}

async function saveTaxMapping() {
  taxMappingSaving.value = true;
  taxMappingError.value = null;
  taxMappingSaved.value = false;
  try {
    taxMapping.value = await upsertTaxColumnMapping(
      clientId.value,
      taxMapping.value,
    );
    taxMappingSaved.value = true;
    setTimeout(() => {
      taxMappingSaved.value = false;
    }, 2000);
  } catch (err: any) {
    taxMappingError.value =
      err?.message || "No se pudo guardar la configuración.";
  } finally {
    taxMappingSaving.value = false;
  }
}

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
    syncExtractionPrefsFromClient(found);
    extractionEditing.value = !(
      found.concepto_document_id && found.tipo_de_pago_document_id
    );
    documents.value = await listByClient(clientId.value);
    expandedIds.value = new Set(documents.value.map((d) => d.id));
    businessRules.value = await listRulesByClient(clientId.value);
    ruleExpandedIds.value = new Set(businessRules.value.map((r) => r.id));
    suplidores.value = await listSuplidoresByClient(clientId.value);
    selectedSuplidorIds.value = new Set();
    taxMapping.value = await getTaxColumnMapping(clientId.value);
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
    logActivity("document_added", {
      clientId: clientId.value,
      targetLabel: client.value?.name ?? null,
      metadata: { name: created.document_name },
    });
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
      d.id === updated.id ? updated : d,
    );
    showForm.value = false;
    editingDoc.value = null;
    logActivity("document_updated", {
      clientId: clientId.value,
      targetLabel: client.value?.name ?? null,
      metadata: { name: updated.document_name },
    });
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
    if (extractionConceptoDocId.value === doc.id) {
      extractionConceptoDocId.value = "";
    }
    if (extractionTipoDePagoDocId.value === doc.id) {
      extractionTipoDePagoDocId.value = "";
    }
    if (extractionTipoDeGastoContextDocId.value === doc.id) {
      extractionTipoDeGastoContextDocId.value = "";
    }
    if (client.value) {
      if (client.value.concepto_document_id === doc.id) {
        client.value = { ...client.value, concepto_document_id: null };
      }
      if (client.value.tipo_de_pago_document_id === doc.id) {
        client.value = { ...client.value, tipo_de_pago_document_id: null };
      }
      if (client.value.tipo_de_gasto_context_document_id === doc.id) {
        client.value = {
          ...client.value,
          tipo_de_gasto_context_document_id: null,
        };
      }
    }
    logActivity("document_removed", {
      clientId: clientId.value,
      targetLabel: client.value?.name ?? null,
      metadata: { name: doc.document_name },
    });
  } catch (err: any) {
    error.value = err?.message || "No se pudo eliminar el documento.";
  } finally {
    deletingId.value = null;
  }
}

function openComment(
  doc: ClientDocumentWithAttributes,
  attr: DocumentAttribute,
) {
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
      commentDraft.value,
    );
    documents.value = documents.value.map((doc) => {
      if (doc.id !== commentDocId.value) return doc;
      return {
        ...doc,
        document_attributes: doc.document_attributes.map((a) =>
          a.id === updated.id ? updated : a,
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
    logActivity("annotation_added", {
      clientId: clientId.value,
      targetLabel: client.value?.name ?? null,
      metadata: { name: created.rule_name },
    });
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
      r.id === updated.id ? updated : r,
    );
    showRuleForm.value = false;
    editingRule.value = null;
    logActivity("annotation_updated", {
      clientId: clientId.value,
      targetLabel: client.value?.name ?? null,
      metadata: { name: updated.rule_name },
    });
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
      `¿Eliminar la regla "${rule.rule_name}" y todos sus atributos?`,
    )
  ) {
    return;
  }
  deletingRuleId.value = rule.id;
  error.value = null;
  try {
    await removeRule(rule.id);
    businessRules.value = businessRules.value.filter((r) => r.id !== rule.id);
    logActivity("annotation_removed", {
      clientId: clientId.value,
      targetLabel: client.value?.name ?? null,
      metadata: { name: rule.rule_name },
    });
  } catch (err: any) {
    error.value = err?.message || "No se pudo eliminar la regla.";
  } finally {
    deletingRuleId.value = null;
  }
}

function openRuleComment(
  rule: ClientBusinessRuleWithAttributes,
  attr: BusinessRuleAttribute,
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
      ruleCommentDraft.value,
    );
    businessRules.value = businessRules.value.map((rule) => {
      if (rule.id !== ruleCommentRuleId.value) return rule;
      return {
        ...rule,
        business_rule_attributes: rule.business_rule_attributes.map((a) =>
          a.id === updated.id ? updated : a,
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

// --- Suplidores functions -----------------------------------------------
function openSuplidorForm() {
  suplidorFormError.value = null;
  editingSuplidor.value = null;
  suplidorDraft.value = {
    nombre: "",
    documento: null,
    tipo_de_factura: null,
    registered_on_platform: false,
  };
  showSuplidorForm.value = true;
}

function openSuplidorEdit(s: ClientSuplidor) {
  suplidorFormError.value = null;
  editingSuplidor.value = s;
  suplidorDraft.value = {
    nombre: s.nombre,
    documento: s.documento,
    tipo_de_factura: s.tipo_de_factura,
    registered_on_platform: s.registered_on_platform,
  };
  showSuplidorForm.value = true;
}

function closeSuplidorForm() {
  if (suplidorSubmitting.value) return;
  showSuplidorForm.value = false;
  editingSuplidor.value = null;
}

async function onSubmitSuplidor() {
  suplidorSubmitting.value = true;
  suplidorFormError.value = null;
  try {
    if (isEditingSuplidor.value && editingSuplidor.value) {
      const updated = await updateSuplidor(
        editingSuplidor.value.id,
        suplidorDraft.value,
      );
      suplidores.value = suplidores.value.map((s) =>
        s.id === updated.id ? updated : s,
      );
      logActivity("suplidor_updated", {
        clientId: clientId.value,
        targetLabel: client.value?.name ?? null,
        metadata: { nombre: updated.nombre },
      });
    } else {
      const created = await createSuplidor(clientId.value, suplidorDraft.value);
      suplidores.value = [created, ...suplidores.value];
      logActivity("suplidor_added", {
        clientId: clientId.value,
        targetLabel: client.value?.name ?? null,
        metadata: { nombre: created.nombre },
      });
    }
    showSuplidorForm.value = false;
    editingSuplidor.value = null;
  } catch (err: any) {
    suplidorFormError.value = err?.message || "No se pudo guardar el suplidor.";
  } finally {
    suplidorSubmitting.value = false;
  }
}

async function onDeleteSuplidor(s: ClientSuplidor) {
  if (!window.confirm(`¿Eliminar al suplidor "${s.nombre}"?`)) return;
  deletingSuplidorId.value = s.id;
  try {
    await removeSuplidor(s.id);
    suplidores.value = suplidores.value.filter((x) => x.id !== s.id);
    const next = new Set(selectedSuplidorIds.value);
    next.delete(s.id);
    selectedSuplidorIds.value = next;
    logActivity("suplidor_removed", {
      clientId: clientId.value,
      targetLabel: client.value?.name ?? null,
      metadata: { nombre: s.nombre },
    });
  } catch (err: any) {
    suplidorFormError.value =
      err?.message || "No se pudo eliminar el suplidor.";
  } finally {
    deletingSuplidorId.value = null;
  }
}

async function onToggleRegistered(s: ClientSuplidor) {
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
  togglingRegisteredId.value = s.id;
  try {
    const updated = await markAsRegistered(s.id, value);
    suplidores.value = suplidores.value.map((x) =>
      x.id === updated.id ? updated : x,
    );
  } catch (err: any) {
    suplidorFormError.value =
      err?.message || "No se pudo actualizar el estado.";
  } finally {
    togglingRegisteredId.value = null;
  }
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
            v-else-if="activeTab === 'reglas'"
            type="button"
            class="flex-shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            @click="openRuleForm"
          >
            Nueva regla
          </button>
          <button
            v-else-if="activeTab === 'suplidores'"
            type="button"
            class="flex-shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            @click="openSuplidorForm"
          >
            Nuevo suplidor
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
          <button
            type="button"
            class="relative ml-5 px-1 pb-3 text-sm font-semibold transition"
            :class="
              activeTab === 'suplidores'
                ? 'text-gray-900'
                : 'text-gray-400 hover:text-gray-600'
            "
            @click="activeTab = 'suplidores'"
          >
            Suplidores
            <span
              v-if="activeTab === 'suplidores'"
              class="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-emerald-600"
            />
            <span
              v-if="suplidores.length > 0"
              class="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600"
              >{{ suplidores.length }}</span
            >
          </button>
          <button
            type="button"
            class="relative ml-5 px-1 pb-3 text-sm font-semibold transition"
            :class="
              activeTab === 'impuestos'
                ? 'text-gray-900'
                : 'text-gray-400 hover:text-gray-600'
            "
            @click="activeTab = 'impuestos'"
          >
            Impuestos
            <span
              v-if="activeTab === 'impuestos'"
              class="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-emerald-600"
            />
          </button>
          <button
            type="button"
            class="relative ml-5 px-1 pb-3 text-sm font-semibold transition"
            :class="
              activeTab === 'ajustes'
                ? 'text-gray-900'
                : 'text-gray-400 hover:text-gray-600'
            "
            @click="activeTab = 'ajustes'"
          >
            Ajustes
            <span
              v-if="activeTab === 'ajustes'"
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
                            attr.description ? 'text-gray-600' : 'text-gray-300'
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

        <!-- ===== Ajustes tab ===== -->
        <section v-else-if="activeTab === 'ajustes'">
          <div class="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2
                class="text-sm font-semibold uppercase tracking-wide text-gray-400"
              >
                Documentos para extracción
              </h2>
              <p class="mt-1 text-sm text-gray-500">
                Elige qué documentos de ERP alimentan Concepto Id, Tipo de Pago
                Id y el contexto de Tipo de Gasto. Esta configuración se
                reutiliza en cada extracción; no hace falta elegirla cada vez.
              </p>
            </div>
            <button
              v-if="extractionFieldsLocked"
              type="button"
              class="flex-shrink-0 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              @click="startExtractionEdit"
            >
              Editar
            </button>
          </div>

          <div
            v-if="documents.length === 0"
            class="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center"
          >
            <p class="text-sm font-medium text-gray-700">
              Sin documentos todavía
            </p>
            <p class="mt-1 text-sm text-gray-500">
              Crea al menos un documento en la pestaña Documentos antes de
              configurar la extracción.
            </p>
            <button
              type="button"
              class="mt-4 text-sm font-medium text-emerald-700 hover:underline"
              @click="activeTab = 'documentos'"
            >
              Ir a Documentos
            </button>
          </div>

          <div
            v-else
            class="max-w-lg space-y-4 rounded-xl border border-gray-200 bg-white p-5"
          >
            <div>
              <label
                for="extraction-concepto-doc"
                class="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Documento para Concepto Id
                <span class="text-rose-500">*</span>
              </label>
              <select
                id="extraction-concepto-doc"
                v-model="extractionConceptoDocId"
                :disabled="extractionFieldsLocked"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">Selecciona un documento</option>
                <option
                  v-for="doc in documents"
                  :key="doc.id"
                  :value="doc.id"
                >
                  {{ doc.document_name }} ({{ doc.document_attributes.length }}
                  atributos)
                </option>
              </select>
            </div>

            <div>
              <label
                for="extraction-tipo-pago-doc"
                class="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Documento para Tipo de Pago Id
                <span class="text-rose-500">*</span>
              </label>
              <select
                id="extraction-tipo-pago-doc"
                v-model="extractionTipoDePagoDocId"
                :disabled="extractionFieldsLocked"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">Selecciona un documento</option>
                <option
                  v-for="doc in documents"
                  :key="doc.id"
                  :value="doc.id"
                >
                  {{ doc.document_name }} ({{ doc.document_attributes.length }}
                  atributos)
                </option>
              </select>
            </div>

            <div class="border-t border-gray-100 pt-4">
              <label
                for="extraction-tipo-gasto-doc"
                class="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Documento de contexto para Tipo de Gasto
                <span class="font-normal text-gray-400">(opcional)</span>
              </label>
              <select
                id="extraction-tipo-gasto-doc"
                v-model="extractionTipoDeGastoContextDocId"
                :disabled="extractionFieldsLocked"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">Sin contexto adicional</option>
                <option
                  v-for="doc in documents"
                  :key="doc.id"
                  :value="doc.id"
                >
                  {{ doc.document_name }} ({{ doc.document_attributes.length }}
                  atributos)
                </option>
              </select>
              <p class="mt-1.5 text-xs text-gray-400">
                El "Tipo de Gasto" siempre se elige entre las 11 opciones fijas
                de la app. Si seleccionas un documento aquí, sus atributos y
                comentario se envían a la IA solo como contexto.
              </p>
            </div>

            <p
              v-if="extractionError"
              class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {{ extractionError }}
            </p>

            <div
              v-if="!extractionFieldsLocked"
              class="flex items-center gap-3 border-t border-gray-100 pt-4"
            >
              <button
                type="button"
                :disabled="extractionSaving"
                class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                @click="requestSaveExtractionDocuments"
              >
                Guardar
              </button>
              <button
                v-if="extractionConfigured"
                type="button"
                :disabled="extractionSaving"
                class="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-60"
                @click="cancelExtractionEdit"
              >
                Cancelar
              </button>
              <span
                v-if="extractionSaved"
                class="text-sm font-medium text-emerald-600"
              >
                Guardado
              </span>
            </div>
            <div
              v-else-if="extractionSaved"
              class="border-t border-gray-100 pt-4"
            >
              <span class="text-sm font-medium text-emerald-600">Guardado</span>
            </div>
          </div>
        </section>

        <section v-else-if="activeTab === 'reglas'">
          <div class="mb-4 flex items-baseline justify-between gap-3">
            <div>
              <h2
                class="text-sm font-semibold uppercase tracking-wide text-gray-400"
              >
                Anotaciones del Negocio
              </h2>
              <p class="mt-0.5 text-sm text-gray-500">
                Reglas de negocio opcionales que dan contexto a la IA para tomar
                mejores decisiones con este cliente.
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
              Son opcionales. Agrega contexto (ej. excepciones o convenciones)
              para ayudar a la IA a clasificar mejor los documentos de este
              cliente.
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
                            attr.description ? 'text-gray-600' : 'text-gray-300'
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

        <!-- ===== Suplidores tab ===== -->
        <section v-else-if="activeTab === 'suplidores'">
          <div class="mb-4 flex items-baseline justify-between gap-3">
            <div>
              <h2
                class="text-sm font-semibold uppercase tracking-wide text-gray-400"
              >
                Suplidores
              </h2>
              <p class="mt-0.5 text-sm text-gray-500">
                Proveedores registrados para este cliente.
                Marca los que quieras exportar.
                <span v-if="suplidores.length > 0" class="ml-1">
                  {{ registeredCount }} de {{ suplidores.length }} agregados en
                  el sistema.
                </span>
                <template v-if="selectedExportableSuplidores.length > 0">
                  ·
                  <span class="font-medium text-gray-700"
                    >{{ selectedExportableSuplidores.length }} seleccionados</span
                  >
                </template>
              </p>
            </div>
            <span class="text-sm text-gray-400">
              {{
                suplidorSearch.trim()
                  ? `${filteredSuplidores.length} de ${suplidores.length}`
                  : suplidores.length
              }}
              {{
                (suplidorSearch.trim()
                  ? filteredSuplidores.length
                  : suplidores.length) === 1
                  ? "suplidor"
                  : "suplidores"
              }}
            </span>
          </div>

          <!-- Empty suplidores -->
          <div
            v-if="suplidores.length === 0"
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
                  d="M17 20h5v-1a4 4 0 00-4-4h-1m-7 5H2v-1a4 4 0 014-4h4a4 4 0 014 4v1zm-3-9a3 3 0 11-6 0 3 3 0 016 0zm9-3a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <p class="text-sm font-medium text-gray-700">
              Sin suplidores todavía
            </p>
            <p class="mt-1 max-w-sm text-sm text-gray-400">
              Agrega suplidores manualmente o extráelos escaneando recibos en la
              <NuxtLink
                to="/suplidores"
                class="text-emerald-600 hover:underline"
                >página de Suplidores</NuxtLink
              >.
            </p>
            <button
              type="button"
              class="mt-5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              @click="openSuplidorForm"
            >
              Nuevo suplidor
            </button>
          </div>

          <template v-else>
            <div class="mb-3 flex flex-wrap items-center gap-3">
              <div class="relative min-w-0 flex-1">
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
                  v-model="suplidorSearch"
                  type="search"
                  placeholder="Buscar por documento o nombre…"
                  class="w-full max-w-sm rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40"
                />
              </div>
              <button
                type="button"
                class="flex-shrink-0 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                :disabled="exportingSuplidores || selectedExportableSuplidores.length === 0"
                :title="selectedExportableSuplidores.length === 0 ? 'Selecciona suplidores para exportar' : undefined"
                @click="exportSuplidores"
              >
                {{
                  exportingSuplidores
                    ? "Exportando…"
                    : selectedExportableSuplidores.length
                      ? `Exportar (${selectedExportableSuplidores.length})`
                      : "Exportar"
                }}
              </button>
            </div>

            <div
              v-if="filteredSuplidores.length === 0"
              class="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-400"
            >
              Ningún suplidor coincide con “{{ suplidorSearch.trim() }}”.
            </div>

            <!-- Suplidores table -->
            <div
              v-else
              class="overflow-y-auto rounded-xl border border-gray-200 bg-white max-h-[70vh]"
            >
              <table class="w-full text-left text-sm">
                <thead
                  class="sticky top-0 border-b border-gray-100 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  <tr>
                    <th class="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        :checked="allClientSuplidoresSelected"
                        :disabled="selectableClientSuplidores.length === 0"
                        class="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600 disabled:opacity-40"
                        @change="toggleAllClientSuplidores"
                      />
                    </th>
                    <th class="px-5 py-3">Documento</th>
                    <th class="px-5 py-3">Nombre</th>
                    <th class="px-5 py-3">Tipo de Factura</th>
                    <th class="w-36 px-4 py-3 text-center">En sistema</th>
                    <th class="w-24 px-4 py-3">
                      <span class="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr
                    v-for="s in filteredSuplidores"
                    :key="s.id"
                    class="group transition"
                    :class="
                      selectedSuplidorIds.has(s.id)
                        ? 'bg-sky-50/50'
                        : s.registered_on_platform
                          ? 'bg-emerald-50/20'
                          : 'hover:bg-gray-50'
                    "
                  >
                    <td class="px-4 py-3">
                      <input
                        type="checkbox"
                        :checked="selectedSuplidorIds.has(s.id)"
                        class="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600"
                        :title="
                          selectedSuplidorIds.has(s.id)
                            ? 'Incluido en exportar'
                            : 'Marca para incluir'
                        "
                        @change="
                          toggleClientSuplidorRow(
                            s.id,
                            ($event.target as HTMLInputElement).checked,
                          )
                        "
                      />
                    </td>
                    <td class="px-5 py-3 font-mono text-xs text-gray-600">
                      {{ s.documento || "—" }}
                    </td>
                    <td class="px-5 py-3 font-medium text-gray-900">
                      {{ s.nombre }}
                    </td>
                    <td class="px-5 py-3 text-gray-600">
                      {{ s.tipo_de_factura || "—" }}
                    </td>
                    <td class="px-4 py-3 text-center">
                      <button
                        type="button"
                        class="inline-flex h-5 w-5 items-center justify-center rounded-full transition disabled:opacity-50"
                        :class="
                          s.registered_on_platform
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                            : 'border border-gray-300 text-gray-300 hover:border-emerald-400 hover:text-emerald-500'
                        "
                        :disabled="togglingRegisteredId === s.id"
                        :title="
                          s.registered_on_platform
                            ? 'Quitar de agregado en el sistema'
                            : 'Marcar como agregado en el sistema'
                        "
                        :aria-label="
                          s.registered_on_platform
                            ? 'Agregado en el sistema'
                            : 'Marcar como agregado en el sistema'
                        "
                        :aria-pressed="s.registered_on_platform"
                        @click="onToggleRegistered(s)"
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
                            stroke-width="2.5"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </button>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <div
                        class="flex items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100"
                      >
                        <button
                          type="button"
                          class="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                          title="Editar"
                          @click="openSuplidorEdit(s)"
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
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          class="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                          title="Eliminar"
                          :disabled="deletingSuplidorId === s.id"
                          @click="onDeleteSuplidor(s)"
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <p
            v-if="suplidorFormError && activeTab === 'suplidores'"
            class="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {{ suplidorFormError }}
          </p>
        </section>

        <!-- ===== Impuestos tab ===== -->
        <section v-else-if="activeTab === 'impuestos'">
          <div class="mb-4">
            <h2
              class="text-sm font-semibold uppercase tracking-wide text-gray-400"
            >
              Columnas de Impuesto
            </h2>
            <p class="mt-1 text-sm text-gray-500">
              La plantilla de Carga Masiva tiene 5 columnas genéricas (Impuesto
              1 a 5). Define en cuál de ellas se debe escribir cada monto para
              este cliente. Deja "No exportar" si un monto no aplica.
            </p>
          </div>

          <div class="max-w-lg rounded-xl border border-gray-200 bg-white p-5">
            <div
              v-for="field in TAX_COLUMN_FIELDS"
              :key="field"
              class="mb-4 flex items-center justify-between gap-4 last:mb-0"
            >
              <label class="text-sm font-medium text-gray-700">
                {{ TAX_COLUMN_FIELD_LABELS[field] }}
              </label>
              <select
                v-model="taxMapping[field]"
                class="w-44 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option :value="null">No exportar</option>
                <option v-for="n in [1, 2, 3, 4, 5]" :key="n" :value="n">
                  Impuesto {{ n }}
                </option>
              </select>
            </div>

            <p
              v-if="taxMappingError"
              class="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {{ taxMappingError }}
            </p>

            <div
              class="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4"
            >
              <button
                type="button"
                :disabled="taxMappingSaving"
                class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                @click="saveTaxMapping"
              >
                {{ taxMappingSaving ? "Guardando…" : "Guardar" }}
              </button>
              <span
                v-if="taxMappingSaved"
                class="text-sm font-medium text-emerald-600"
              >
                Guardado
              </span>
            </div>
          </div>
        </section>
      </template>
    </div>

    <!-- Suplidor create / edit modal -->
    <div
      v-if="showSuplidorForm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      @click.self="closeSuplidorForm"
    >
      <div class="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div
          class="flex items-center justify-between border-b border-gray-100 px-6 py-4"
        >
          <h2 class="text-base font-semibold text-gray-900">
            {{ isEditingSuplidor ? "Editar suplidor" : "Nuevo suplidor" }}
          </h2>
          <button
            type="button"
            class="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            @click="closeSuplidorForm"
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
        <form class="px-6 py-5 space-y-4" @submit.prevent="onSubmitSuplidor">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700"
              >Nombre <span class="text-red-500">*</span></label
            >
            <input
              v-model="suplidorDraft.nombre"
              type="text"
              maxlength="255"
              required
              placeholder="Razón social del suplidor"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700"
              >Documento (RNC / Cédula / Pasaporte)</label
            >
            <input
              v-model="suplidorDraft.documento"
              type="text"
              maxlength="20"
              inputmode="numeric"
              placeholder="Solo dígitos, máx. 20 caracteres"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              @input="
                suplidorDraft.documento =
                  (suplidorDraft.documento || '')
                    .replace(/\D/g, '')
                    .slice(0, 20) || null
              "
            />
            <p class="mt-1 text-xs text-gray-400">
              Solo números, sin guiones ni espacios.
            </p>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700"
              >Tipo de Factura</label
            >
            <select
              v-model="suplidorDraft.tipo_de_factura"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            >
              <option :value="null">— Seleccionar —</option>
              <option
                v-for="opt in TIPO_DE_FACTURA_OPTIONS"
                :key="opt"
                :value="opt"
              >
                {{ opt }}
              </option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <input
              id="registered"
              v-model="suplidorDraft.registered_on_platform"
              type="checkbox"
              class="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label for="registered" class="text-sm text-gray-700"
              >Registrado en la plataforma</label
            >
          </div>

          <p
            v-if="suplidorFormError"
            class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {{ suplidorFormError }}
          </p>

          <div
            class="flex items-center justify-end gap-2 border-t border-gray-100 pt-4"
          >
            <button
              type="button"
              class="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
              :disabled="suplidorSubmitting"
              @click="closeSuplidorForm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              :disabled="suplidorSubmitting"
            >
              {{
                suplidorSubmitting
                  ? "Guardando…"
                  : isEditingSuplidor
                    ? "Guardar cambios"
                    : "Crear suplidor"
              }}
            </button>
          </div>
        </form>
      </div>
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
        :aria-labelledby="
          isEditing ? 'editar-documento-title' : 'nuevo-documento-title'
        "
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
          {{
            commentAttr.description ? "Editar comentario" : "Agregar comentario"
          }}
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          Para
          <span class="font-medium text-gray-700">{{
            commentAttr.document_type
          }}</span>
          <span
            v-if="commentAttr.document_id != null"
            class="font-mono text-gray-400"
          >
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

        <div
          class="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 pt-4"
        >
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
        :aria-labelledby="
          isEditingRule ? 'editar-regla-title' : 'nueva-regla-title'
        "
      >
        <h2
          :id="isEditingRule ? 'editar-regla-title' : 'nueva-regla-title'"
          class="text-lg font-semibold tracking-tight text-gray-900"
        >
          {{
            isEditingRule ? "Editar regla de negocio" : "Nueva regla de negocio"
          }}
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          {{
            isEditingRule
              ? "Actualiza el nombre, reglas y contexto de"
              : "Define reglas de negocio opcionales que ayuden a la IA con"
          }}
          <span class="font-medium text-gray-700">{{ client?.name }}</span
          >.
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
            ruleCommentAttr.description ? "Editar contexto" : "Agregar contexto"
          }}
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          Para
          <span class="font-medium text-gray-700">{{
            ruleCommentAttr.rule_type
          }}</span>
          <span
            v-if="ruleCommentAttr.rule_value"
            class="font-mono text-gray-400"
          >
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

        <div
          class="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 pt-4"
        >
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

  <!-- Confirm save extraction settings -->
  <div
    v-if="extractionConfirmOpen"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="extraction-confirm-title"
  >
    <div
      class="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
    >
      <h2
        id="extraction-confirm-title"
        class="text-lg font-semibold text-gray-900"
      >
        ¿Guardar ajustes de extracción?
      </h2>
      <p class="mt-2 text-sm text-slate-600">
        Estos documentos se usarán en todas las extracciones de
        <strong class="font-semibold text-gray-800">{{
          client?.name || "este cliente"
        }}</strong
        >. Confirma que la selección es correcta.
      </p>
      <div class="mt-6 flex justify-end gap-3">
        <button
          type="button"
          class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
          :disabled="extractionSaving"
          @click="cancelExtractionConfirm"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          :disabled="extractionSaving"
          @click="confirmSaveExtractionDocuments"
        >
          {{ extractionSaving ? "Guardando…" : "Confirmar y guardar" }}
        </button>
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
    <div
      class="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
    >
      <h2
        id="unregister-confirm-title"
        class="text-lg font-semibold text-gray-900"
      >
        ¿Quitar a "{{ unregisterTarget.nombre }}" de agregados en el sistema?
      </h2>
      <p class="mt-2 text-sm text-slate-600">
        Solo hazlo si aún no está (o ya no está) en Citrus / Carga Masiva.
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
