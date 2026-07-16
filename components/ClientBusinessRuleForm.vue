<script setup lang="ts">
import type {
  ClientBusinessRuleInput,
  ClientBusinessRuleWithAttributes,
} from "~/composables/useClientBusinessRules";

const props = withDefaults(
  defineProps<{
    submitting?: boolean;
    initial?: ClientBusinessRuleWithAttributes | null;
    submitLabel?: string;
  }>(),
  {
    submitting: false,
    initial: null,
    submitLabel: "Crear regla",
  }
);

const emit = defineEmits<{
  (e: "submit", input: ClientBusinessRuleInput): void;
  (e: "cancel"): void;
}>();

let rowSeq = 0;
const nextId = () => `rule-attr-${rowSeq++}`;

type AttributeRow = {
  key: string;
  dbId?: number;
  ruleType: string;
  ruleValue: string;
  description: string;
};

function rowsFromInitial(
  rule: ClientBusinessRuleWithAttributes | null | undefined
): AttributeRow[] {
  if (!rule?.business_rule_attributes?.length) {
    return [{ key: nextId(), ruleType: "", ruleValue: "", description: "" }];
  }
  return rule.business_rule_attributes.map((a) => ({
    key: nextId(),
    dbId: a.id,
    ruleType: a.rule_type,
    ruleValue: a.rule_value ?? "",
    description: a.description ?? "",
  }));
}

const ruleName = ref(props.initial?.rule_name ?? "");
const attributes = ref<AttributeRow[]>(rowsFromInitial(props.initial));
const formError = ref<string | null>(null);

const filledAttributeCount = computed(
  () =>
    attributes.value.filter(
      (a) =>
        a.ruleValue.trim().length > 0 || a.description.trim().length > 0
    ).length
);

const canSubmit = computed(
  () =>
    ruleName.value.trim().length > 0 &&
    filledAttributeCount.value > 0 &&
    !props.submitting
);

function addAttribute() {
  attributes.value.push({
    key: nextId(),
    ruleType: "",
    ruleValue: "",
    description: "",
  });
}

function removeAttribute(key: string) {
  if (attributes.value.length <= 1) {
    attributes.value = [
      { key: nextId(), ruleType: "", ruleValue: "", description: "" },
    ];
    return;
  }
  attributes.value = attributes.value.filter((a) => a.key !== key);
}

function onSubmit() {
  formError.value = null;
  try {
    const input: ClientBusinessRuleInput = {
      ruleName: ruleName.value,
      attributes: attributes.value.map((a) => ({
        id: a.dbId,
        ruleType: a.ruleValue,
        ruleValue: a.ruleValue,
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
        for="rule-name"
        class="mb-1.5 block text-sm font-medium text-gray-700"
      >
        Nombre de la regla
      </label>
      <input
        id="rule-name"
        v-model="ruleName"
        type="text"
        required
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        placeholder="Ej. Clasificación de gastos, Excepciones de facturación"
      />
      <p class="mt-1.5 text-xs text-gray-400">
        Agrupa reglas de negocio que ayudan a la IA a tomar mejores decisiones
        para este cliente.
      </p>
    </div>

    <div>
      <div class="mb-3 flex items-end justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-gray-900">Reglas</h3>
          <p class="mt-0.5 text-xs text-gray-400">
            Cada fila es una regla de negocio con un contexto opcional para la
            IA.
          </p>
        </div>
        <button
          type="button"
          class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          @click="addAttribute"
        >
          Agregar regla
        </button>
      </div>

      <div class="space-y-3">
        <div
          v-for="(row, index) in attributes"
          :key="row.key"
          class="rounded-xl border border-gray-200 bg-white p-4"
        >
          <div class="mb-3 flex items-center justify-between">
            <span
              class="text-xs font-medium uppercase tracking-wide text-gray-400"
            >
              <template v-if="row.ruleValue.trim()">{{
                row.ruleValue
              }}</template>
              <template v-else>Regla {{ index + 1 }}</template>
            </span>
            <button
              type="button"
              class="rounded-md px-2 py-1 text-xs font-medium text-gray-400 transition hover:bg-red-50 hover:text-red-500"
              title="Quitar regla"
              @click="removeAttribute(row.key)"
            >
              Quitar
            </button>
          </div>

          <div class="flex flex-col gap-3">
            <div>
              <label
                :for="`rule-value-${row.key}`"
                class="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Valor / referencia
                <span class="font-normal text-gray-400">(opcional)</span>
              </label>
              <input
                :id="`rule-value-${row.key}`"
                v-model="row.ruleValue"
                type="text"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Ej. código o referencia interna"
              />
            </div>

            <div>
              <label
                :for="`rule-desc-${row.key}`"
                class="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Contexto para la IA
                <span class="font-normal text-gray-400">(opcional)</span>
              </label>
              <textarea
                :id="`rule-desc-${row.key}`"
                v-model="row.description"
                rows="2"
                class="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Explica cómo debe aplicarse esta regla al procesar documentos…"
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
        {{ submitting ? "Guardando…" : submitLabel }}
      </button>
    </div>
  </form>
</template>
