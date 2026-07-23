<script setup lang="ts">
import type { Database } from "~/types/database.types";
import type { ClientBusinessRuleInput } from "~/composables/useClientBusinessRules";
import type { OrganizationBusinessRuleWithAttributes } from "~/composables/useOrganizationBusinessRules";

const supabase = useSupabaseClient<Database>();
const user = useSupabaseUser();
const {
  membership,
  memberships,
  activeOrg,
  isAdmin,
  isSuperAdmin,
  switchableOrgs,
  canSwitchOrgs,
  setActiveOrg,
  refresh,
} = useOrganization();

const {
  listByOrganization: listOrgRules,
  create: createOrgRule,
  update: updateOrgRule,
  remove: removeOrgRule,
} = useOrganizationBusinessRules();
const { log: logActivity } = useActivityLog();

await refresh();

// --- Mi cuenta ---------------------------------------------------------------
const fullName = ref(membership.value?.full_name ?? "");
watch(membership, (m) => {
  fullName.value = m?.full_name ?? "";
});

const savingName = ref(false);
const nameError = ref<string | null>(null);
const nameSaved = ref(false);

async function saveFullName() {
  const userId = user.value?.sub;
  if (!userId) return;
  savingName.value = true;
  nameError.value = null;
  nameSaved.value = false;
  try {
    const { error } = await supabase
      .from("user_profiles")
      .update({ full_name: fullName.value.trim() || null })
      .eq("id", userId);
    if (error) throw error;
    if (membership.value) {
      membership.value = {
        ...membership.value,
        full_name: fullName.value.trim() || null,
      };
    }
    nameSaved.value = true;
    setTimeout(() => (nameSaved.value = false), 2500);
  } catch (err: any) {
    nameError.value = err?.message || "No se pudo guardar el nombre.";
  } finally {
    savingName.value = false;
  }
}

const resettingOwnPassword = ref(false);
const ownPasswordError = ref<string | null>(null);
const ownPasswordSent = ref(false);

async function resetOwnPassword() {
  const email = user.value?.email as string | undefined;
  if (!email) return;
  resettingOwnPassword.value = true;
  ownPasswordError.value = null;
  ownPasswordSent.value = false;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) throw error;
    ownPasswordSent.value = true;
  } catch (err: any) {
    ownPasswordError.value = err?.message || "No se pudo enviar el correo.";
  } finally {
    resettingOwnPassword.value = false;
  }
}

// --- Organizaciones ----------------------------------------------------------
const orgList = computed(() => switchableOrgs.value);

const roleLabel = (orgId: string) => {
  if (isSuperAdmin.value) return "Superadmin";
  const m = memberships.value.find((x) => x.organization_id === orgId);
  if (!m) return null;
  return m.role === "admin" ? "Administrador" : "Colaborador";
};

const switchingOrgId = ref<string | null>(null);
const switchOrgError = ref<string | null>(null);

async function switchToOrg(orgId: string) {
  if (orgId === activeOrg.value?.id) return;
  switchingOrgId.value = orgId;
  switchOrgError.value = null;
  try {
    await setActiveOrg(orgId);
    await refreshNuxtData();
  } catch (err: any) {
    switchOrgError.value =
      err?.message || "No se pudo cambiar de organización.";
  } finally {
    switchingOrgId.value = null;
  }
}

// --- Equipo (admin / superadmin) ---------------------------------------------
interface MemberRow {
  id: string;
  role: string;
  fullName: string | null;
  email: string | null;
  createdAt: string;
  activated: boolean;
  inviteSentAt: string | null;
  inviteExpired: boolean;
  disabled: boolean;
}

const members = ref<MemberRow[]>([]);
const membersPending = ref(false);
const membersError = ref<string | null>(null);

async function loadMembers() {
  if (!isAdmin.value || !activeOrg.value) {
    members.value = [];
    return;
  }
  membersPending.value = true;
  membersError.value = null;
  try {
    const { members: rows } = await $fetch<{ members: MemberRow[] }>(
      "/api/team/members",
      { query: { organizationId: activeOrg.value.id } }
    );
    members.value = rows;
  } catch (err: any) {
    membersError.value =
      err?.data?.statusMessage || err?.message || "Error al cargar el equipo.";
  } finally {
    membersPending.value = false;
  }
}

watch(activeOrg, loadMembers, { immediate: true });

// --- Invitar miembro ----------------------------------------------------------
const showInvite = ref(false);
const inviteEmail = ref("");
const inviteFullName = ref("");
const inviteRole = ref<"admin" | "collaborator">("collaborator");
const inviteSubmitting = ref(false);
const inviteError = ref<string | null>(null);
const inviteSuccess = ref<string | null>(null);

function openInvite() {
  inviteEmail.value = "";
  inviteFullName.value = "";
  inviteRole.value = "collaborator";
  inviteError.value = null;
  inviteSuccess.value = null;
  showInvite.value = true;
}

async function submitInvite() {
  if (!activeOrg.value) return;
  inviteError.value = null;
  inviteSuccess.value = null;
  inviteSubmitting.value = true;
  try {
    const sentEmail = inviteEmail.value.trim();
    const result = await $fetch<{ existing?: boolean }>("/api/team/invite", {
      method: "POST",
      body: {
        email: sentEmail,
        fullName: inviteFullName.value,
        role: inviteRole.value,
        organizationId: activeOrg.value?.id,
      },
    });
    inviteSuccess.value = result.existing
      ? `${sentEmail} ya tenía cuenta; se agregó a esta organización.`
      : `Invitación enviada a ${sentEmail}.`;
    inviteEmail.value = "";
    inviteFullName.value = "";
    inviteRole.value = "collaborator";
    await loadMembers();
    setTimeout(() => {
      showInvite.value = false;
      inviteSuccess.value = null;
    }, 2500);
  } catch (err: any) {
    inviteError.value =
      err?.data?.statusMessage || err?.message || "No se pudo invitar.";
  } finally {
    inviteSubmitting.value = false;
  }
}

// --- Deshabilitar / habilitar miembro ------------------------------------------
const togglingId = ref<string | null>(null);
const toggleError = ref<string | null>(null);

async function toggleMemberDisabled(member: MemberRow) {
  const nextDisabled = !member.disabled;
  const verb = nextDisabled ? "deshabilitar" : "habilitar";
  if (
    !window.confirm(
      `¿Seguro que deseas ${verb} a "${member.fullName ?? member.email}"?`
    )
  )
    return;

  togglingId.value = member.id;
  toggleError.value = null;
  try {
    await $fetch("/api/team/members/disable", {
      method: "POST",
      body: {
        userId: member.id,
        disabled: nextDisabled,
        organizationId: activeOrg.value?.id,
      },
    });
    member.disabled = nextDisabled;
  } catch (err: any) {
    toggleError.value =
      err?.data?.statusMessage || err?.message || "No se pudo actualizar el miembro.";
  } finally {
    togglingId.value = null;
  }
}

// --- Restablecer contraseña de un miembro --------------------------------------
const resettingId = ref<string | null>(null);
const resetError = ref<string | null>(null);
const resetSuccessId = ref<string | null>(null);

async function resetMemberPassword(member: MemberRow) {
  if (
    !window.confirm(
      `¿Enviar un correo para restablecer la contraseña de "${
        member.fullName ?? member.email
      }"?`
    )
  )
    return;

  resettingId.value = member.id;
  resetError.value = null;
  resetSuccessId.value = null;
  try {
    await $fetch("/api/team/members/reset-password", {
      method: "POST",
      body: {
        userId: member.id,
        organizationId: activeOrg.value?.id,
      },
    });
    resetSuccessId.value = member.id;
    setTimeout(() => {
      if (resetSuccessId.value === member.id) resetSuccessId.value = null;
    }, 3000);
  } catch (err: any) {
    resetError.value =
      err?.data?.statusMessage || err?.message || "No se pudo enviar el correo.";
  } finally {
    resettingId.value = null;
  }
}

// --- Reenviar invitación -------------------------------------------------------
const resendingId = ref<string | null>(null);
const resendError = ref<string | null>(null);
const resendSuccessId = ref<string | null>(null);

async function resendMemberInvite(member: MemberRow) {
  if (member.activated) return;
  if (
    !window.confirm(
      `¿Reenviar la invitación a "${member.fullName ?? member.email}"?`
    )
  )
    return;

  resendingId.value = member.id;
  resendError.value = null;
  resendSuccessId.value = null;
  try {
    await $fetch("/api/team/members/resend-invite", {
      method: "POST",
      body: {
        userId: member.id,
        organizationId: activeOrg.value?.id,
      },
    });
    resendSuccessId.value = member.id;
    await loadMembers();
    setTimeout(() => {
      if (resendSuccessId.value === member.id) resendSuccessId.value = null;
    }, 3000);
  } catch (err: any) {
    resendError.value =
      err?.data?.statusMessage ||
      err?.message ||
      "No se pudo reenviar la invitación.";
  } finally {
    resendingId.value = null;
  }
}

function inviteStatusLabel(member: MemberRow) {
  if (member.activated) return "Activo";
  if (member.inviteExpired) return "Invitación expirada";
  return "Invitación pendiente";
}

function inviteStatusClass(member: MemberRow) {
  if (member.activated) return "bg-blue-50 text-blue-600";
  if (member.inviteExpired) return "bg-red-50 text-red-600";
  return "bg-amber-50 text-amber-600";
}

// --- Anotaciones del Negocio (org-wide) ---------------------------------------
const orgBusinessRules = ref<OrganizationBusinessRuleWithAttributes[]>([]);
const orgRulesLoading = ref(false);
const orgRulesError = ref<string | null>(null);
const orgRuleExpandedIds = ref<Set<string>>(new Set());
const showOrgRuleForm = ref(false);
const editingOrgRule = ref<OrganizationBusinessRuleWithAttributes | null>(null);
const orgRuleSubmitting = ref(false);
const orgRuleFormError = ref<string | null>(null);
const deletingOrgRuleId = ref<string | null>(null);

const isEditingOrgRule = computed(() => editingOrgRule.value != null);

function isOrgRuleExpanded(id: string) {
  return orgRuleExpandedIds.value.has(id);
}
function toggleOrgRuleExpanded(id: string) {
  const next = new Set(orgRuleExpandedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  orgRuleExpandedIds.value = next;
}

async function loadOrgBusinessRules() {
  const orgId = activeOrg.value?.id;
  if (!orgId) {
    orgBusinessRules.value = [];
    return;
  }
  orgRulesLoading.value = true;
  orgRulesError.value = null;
  try {
    orgBusinessRules.value = await listOrgRules(orgId);
    orgRuleExpandedIds.value = new Set(orgBusinessRules.value.map((r) => r.id));
  } catch (err: any) {
    orgRulesError.value =
      err?.message || "No se pudieron cargar las anotaciones.";
  } finally {
    orgRulesLoading.value = false;
  }
}

watch(
  () => activeOrg.value?.id,
  () => {
    loadOrgBusinessRules();
  },
  { immediate: true },
);

function openOrgRuleForm() {
  orgRuleFormError.value = null;
  editingOrgRule.value = null;
  showOrgRuleForm.value = true;
}
function openOrgRuleEdit(rule: OrganizationBusinessRuleWithAttributes) {
  orgRuleFormError.value = null;
  editingOrgRule.value = rule;
  showOrgRuleForm.value = true;
}
function closeOrgRuleForm() {
  if (orgRuleSubmitting.value) return;
  showOrgRuleForm.value = false;
  editingOrgRule.value = null;
  orgRuleFormError.value = null;
}

async function onCreateOrgRule(input: ClientBusinessRuleInput) {
  const orgId = activeOrg.value?.id;
  if (!orgId) return;
  orgRuleSubmitting.value = true;
  orgRuleFormError.value = null;
  try {
    const created = await createOrgRule(orgId, input);
    orgBusinessRules.value = [created, ...orgBusinessRules.value];
    orgRuleExpandedIds.value = new Set([
      ...orgRuleExpandedIds.value,
      created.id,
    ]);
    showOrgRuleForm.value = false;
    editingOrgRule.value = null;
    logActivity("annotation_added", {
      targetLabel: activeOrg.value?.name ?? null,
      metadata: { name: created.rule_name, scope: "organization" },
    });
  } catch (err: any) {
    orgRuleFormError.value = err?.message || "No se pudo crear la regla.";
  } finally {
    orgRuleSubmitting.value = false;
  }
}

async function onUpdateOrgRule(input: ClientBusinessRuleInput) {
  if (!editingOrgRule.value) return;
  orgRuleSubmitting.value = true;
  orgRuleFormError.value = null;
  try {
    const updated = await updateOrgRule(editingOrgRule.value.id, input);
    orgBusinessRules.value = orgBusinessRules.value.map((r) =>
      r.id === updated.id ? updated : r,
    );
    showOrgRuleForm.value = false;
    editingOrgRule.value = null;
    logActivity("annotation_updated", {
      targetLabel: activeOrg.value?.name ?? null,
      metadata: { name: updated.rule_name, scope: "organization" },
    });
  } catch (err: any) {
    orgRuleFormError.value = err?.message || "No se pudo actualizar la regla.";
  } finally {
    orgRuleSubmitting.value = false;
  }
}

function onOrgRuleFormSubmit(input: ClientBusinessRuleInput) {
  if (isEditingOrgRule.value) return onUpdateOrgRule(input);
  return onCreateOrgRule(input);
}

async function onDeleteOrgRule(rule: OrganizationBusinessRuleWithAttributes) {
  if (
    !window.confirm(
      `¿Eliminar la regla "${rule.rule_name}" y todos sus atributos?`,
    )
  ) {
    return;
  }
  deletingOrgRuleId.value = rule.id;
  orgRulesError.value = null;
  try {
    await removeOrgRule(rule.id);
    orgBusinessRules.value = orgBusinessRules.value.filter((r) => r.id !== rule.id);
    logActivity("annotation_removed", {
      targetLabel: activeOrg.value?.name ?? null,
      metadata: { name: rule.rule_name, scope: "organization" },
    });
  } catch (err: any) {
    orgRulesError.value = err?.message || "No se pudo eliminar la regla.";
  } finally {
    deletingOrgRuleId.value = null;
  }
}

// --- Modelos de IA (solo lectura) ----------------------------------------------
interface ModelInfo {
  id: string;
  label: string;
  description: string;
  provider: string;
  model: string | null;
  envVar: string;
}

const {
  data: modelsData,
  pending: modelsPending,
  error: modelsError,
} = await useFetch<{
  models: ModelInfo[];
  apiKeyConfigured: boolean;
}>("/api/settings/models");
</script>

<template>
  <div class="px-8 py-8">
    <div class="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 class="text-2xl font-bold tracking-tight text-gray-900">
          Configuración
        </h1>
        <p class="mt-1 text-sm text-gray-500">
          Tu cuenta, tu organización y tu equipo.
        </p>
      </header>

      <!-- Mi cuenta -->
      <section class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 class="text-base font-semibold text-gray-900">Mi cuenta</h2>
        <p class="mt-1 text-sm text-gray-500">{{ user?.email }}</p>

        <form
          v-if="membership"
          class="mt-4 max-w-sm space-y-1.5"
          @submit.prevent="saveFullName"
        >
          <label for="my-full-name" class="block text-sm font-medium text-gray-700">
            Nombre
          </label>
          <div class="flex gap-2">
            <input
              id="my-full-name"
              v-model="fullName"
              type="text"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Tu nombre"
            />
            <button
              type="submit"
              :disabled="savingName"
              class="whitespace-nowrap rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
            >
              {{ savingName ? "Guardando…" : "Guardar" }}
            </button>
          </div>
          <p v-if="nameError" class="text-sm text-red-600">{{ nameError }}</p>
          <p v-else-if="nameSaved" class="text-sm text-emerald-600">Nombre guardado.</p>
        </form>

        <div class="mt-5 border-t border-gray-100 pt-4">
          <p class="text-sm font-medium text-gray-700">Contraseña</p>
          <p class="mt-0.5 text-sm text-gray-500">
            Te enviaremos un enlace a tu correo para crear una nueva contraseña.
          </p>
          <button
            type="button"
            :disabled="resettingOwnPassword"
            class="mt-3 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            @click="resetOwnPassword"
          >
            {{ resettingOwnPassword ? "Enviando…" : "Restablecer mi contraseña" }}
          </button>
          <p v-if="ownPasswordError" class="mt-2 text-sm text-red-600">
            {{ ownPasswordError }}
          </p>
          <p v-else-if="ownPasswordSent" class="mt-2 text-sm text-emerald-600">
            Correo enviado a {{ user?.email }}.
          </p>
        </div>
      </section>

      <!-- Organizaciones — visible for every member (and superadmins) -->
      <section
        v-if="membership || isSuperAdmin"
        class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 class="text-base font-semibold text-gray-900">
          {{ canSwitchOrgs || isSuperAdmin ? "Organizaciones" : "Organización" }}
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          {{
            isSuperAdmin
              ? "Organizaciones que puedes administrar como superadmin."
              : canSwitchOrgs
                ? "Organizaciones a las que perteneces. Cambia la activa desde aquí o desde la barra lateral."
                : "La organización a la que perteneces."
          }}
        </p>

        <ul class="mt-4 divide-y divide-gray-100">
          <li
            v-for="org in orgList"
            :key="org.id"
            class="flex items-center justify-between gap-3 py-3"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span
                class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white"
              >
                {{ org.name.charAt(0).toUpperCase() }}
              </span>
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-gray-900">{{ org.name }}</p>
                <p class="text-xs text-gray-400">
                  <span v-if="roleLabel(org.id)">{{ roleLabel(org.id) }} · </span>
                  {{ org.slug }}
                </p>
              </div>
            </div>
            <span
              v-if="org.id === activeOrg?.id"
              class="flex-shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
            >
              Viendo ahora
            </span>
            <button
              v-else-if="canSwitchOrgs"
              type="button"
              :disabled="switchingOrgId === org.id"
              class="flex-shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
              @click="switchToOrg(org.id)"
            >
              {{ switchingOrgId === org.id ? "Cambiando…" : "Usar esta" }}
            </button>
          </li>
          <li v-if="!orgList.length" class="py-3 text-sm text-gray-400">
            No hay organizaciones.
          </li>
        </ul>
        <p v-if="switchOrgError" class="mt-2 text-sm text-red-600">
          {{ switchOrgError }}
        </p>
      </section>

      <!-- Anotaciones del Negocio (org-wide) -->
      <section
        v-if="activeOrg"
        class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-base font-semibold text-gray-900">
              Anotaciones del Negocio
            </h2>
            <p class="mt-1 text-sm text-gray-500">
              Reglas generales de
              <span class="font-medium text-gray-700">{{ activeOrg.name }}</span>.
              Se envían a la IA en cada análisis (gastos y suplidores), junto con
              las anotaciones específicas de cada cliente.
            </p>
          </div>
          <div class="flex flex-shrink-0 items-center gap-3">
            <span class="text-sm text-gray-400">
              {{ orgBusinessRules.length }}
              {{ orgBusinessRules.length === 1 ? "regla" : "reglas" }}
            </span>
            <button
              type="button"
              class="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              @click="openOrgRuleForm"
            >
              Nueva regla
            </button>
          </div>
        </div>

        <p v-if="orgRulesError" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ orgRulesError }}
        </p>
        <p v-else-if="orgRulesLoading" class="mt-4 text-sm text-gray-400">
          Cargando anotaciones…
        </p>

        <div
          v-else-if="orgBusinessRules.length === 0"
          class="mt-5 flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-6 py-12 text-center"
        >
          <p class="text-sm font-medium text-gray-700">
            Sin anotaciones generales todavía
          </p>
          <p class="mt-1 max-w-md text-sm text-gray-400">
            Agrega convenciones o excepciones que apliquen a todo el negocio
            (no solo a un cliente).
          </p>
        </div>

        <div v-else class="mt-5 space-y-3">
          <article
            v-for="rule in orgBusinessRules"
            :key="rule.id"
            class="overflow-hidden rounded-xl border border-gray-200"
          >
            <div class="flex items-center justify-between gap-3 px-5 py-4">
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-2 text-left"
                @click="toggleOrgRuleExpanded(rule.id)"
              >
                <svg
                  class="h-4 w-4 flex-shrink-0 text-gray-400 transition"
                  :class="isOrgRuleExpanded(rule.id) ? 'rotate-90' : ''"
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
                  @click="openOrgRuleEdit(rule)"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  :disabled="deletingOrgRuleId === rule.id"
                  class="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                  title="Eliminar"
                  @click="onDeleteOrgRule(rule)"
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
              </div>
            </div>

            <div
              v-if="isOrgRuleExpanded(rule.id)"
              class="border-t border-gray-100 bg-gray-50/50"
            >
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <th class="px-5 py-2.5 font-medium">Regla</th>
                    <th class="w-32 px-5 py-2.5 font-medium">Valor</th>
                    <th class="px-5 py-2.5 font-medium">Contexto</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 bg-white">
                  <tr
                    v-for="attr in rule.business_rule_attributes"
                    :key="attr.id"
                  >
                    <td class="px-5 py-3 font-medium text-gray-900">
                      {{ attr.rule_type }}
                    </td>
                    <td class="px-5 py-3 font-mono text-gray-600">
                      {{ attr.rule_value || "—" }}
                    </td>
                    <td class="px-5 py-3 text-gray-500">
                      <p
                        class="whitespace-pre-wrap break-words"
                        :class="attr.description ? 'text-gray-600' : 'text-gray-300'"
                      >
                        {{ attr.description || "—" }}
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </section>

      <!-- Equipo -->
      <section
        v-if="isAdmin"
        class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Equipo</h2>
            <p class="mt-1 text-sm text-gray-500">
              Miembros de
              <span class="font-medium text-gray-700">{{ activeOrg?.name }}</span
              >.
            </p>
          </div>
          <button
            type="button"
            @click="openInvite"
            class="whitespace-nowrap rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Invitar miembro
          </button>
        </div>

        <!-- Invite form -->
        <div
          v-if="showInvite"
          class="mt-4 rounded-lg border border-gray-200 bg-gray-50/60 p-4"
        >
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-900">Invitar por correo</h3>
            <button
              type="button"
              @click="showInvite = false"
              class="text-sm text-gray-400 hover:text-gray-600"
            >
              Cerrar
            </button>
          </div>

          <form @submit.prevent="submitInvite" class="space-y-3">
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label class="mb-1 block text-sm text-gray-700">Correo</label>
                <input
                  v-model="inviteEmail"
                  type="email"
                  required
                  class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  placeholder="persona@empresa.com"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm text-gray-700">
                  Nombre (opcional)
                </label>
                <input
                  v-model="inviteFullName"
                  class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  placeholder="Ada Lovelace"
                />
              </div>
            </div>

            <div>
              <label class="mb-1 block text-sm text-gray-700">Rol</label>
              <select
                v-model="inviteRole"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
              >
                <option value="collaborator">Colaborador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <p v-if="inviteError" class="text-sm text-red-600">{{ inviteError }}</p>
            <p v-if="inviteSuccess" class="text-sm text-emerald-600">
              {{ inviteSuccess }}
            </p>

            <button
              type="submit"
              :disabled="inviteSubmitting"
              class="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50 sm:w-auto sm:px-6"
            >
              {{ inviteSubmitting ? "Enviando..." : "Enviar invitación" }}
            </button>
          </form>
        </div>

        <p v-if="membersError" class="mt-4 text-sm text-red-600">
          {{ membersError }}
        </p>
        <p v-else-if="membersPending" class="mt-4 text-sm text-gray-400">
          Cargando...
        </p>
        <p v-else-if="!members.length" class="mt-4 text-sm text-gray-400">
          Aún no hay miembros.
        </p>

        <ul v-else class="mt-4 divide-y divide-gray-100">
          <li
            v-for="m in members"
            :key="m.id"
            class="flex flex-wrap items-center justify-between gap-3 py-3.5"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="truncate text-sm font-medium text-gray-900">
                  {{ m.fullName ?? m.email ?? "(sin nombre)" }}
                </p>
                <span
                  class="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="
                    m.role === 'admin'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-600'
                  "
                >
                  {{ m.role === "admin" ? "Administrador" : "Colaborador" }}
                </span>
                <span
                  class="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="inviteStatusClass(m)"
                >
                  {{ inviteStatusLabel(m) }}
                </span>
                <span
                  v-if="m.disabled"
                  class="flex-shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600"
                >
                  Deshabilitado
                </span>
              </div>
              <p class="mt-0.5 truncate text-xs text-gray-400">
                {{ m.email }} · Se unió {{ new Date(m.createdAt).toLocaleDateString() }}
                <span v-if="!m.activated && m.inviteSentAt">
                  · Enviada {{ new Date(m.inviteSentAt).toLocaleString() }}
                </span>
              </p>
              <p
                v-if="resetError && resettingId !== m.id"
                class="mt-1 text-xs text-red-600"
              >
                {{ resetError }}
              </p>
              <p v-if="resetSuccessId === m.id" class="mt-1 text-xs text-emerald-600">
                Correo de restablecimiento enviado.
              </p>
              <p
                v-if="resendError && resendingId !== m.id"
                class="mt-1 text-xs text-red-600"
              >
                {{ resendError }}
              </p>
              <p v-if="resendSuccessId === m.id" class="mt-1 text-xs text-emerald-600">
                Invitación reenviada.
              </p>
              <p
                v-if="toggleError && togglingId !== m.id"
                class="mt-1 text-xs text-red-600"
              >
                {{ toggleError }}
              </p>
            </div>

            <div class="flex flex-shrink-0 items-center gap-2">
              <button
                v-if="!m.activated"
                type="button"
                :disabled="resendingId === m.id"
                class="rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50"
                :class="
                  m.inviteExpired
                    ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                "
                @click="resendMemberInvite(m)"
              >
                {{ resendingId === m.id ? "Reenviando…" : "Reenviar invitación" }}
              </button>
              <button
                v-if="m.activated"
                type="button"
                :disabled="resettingId === m.id"
                class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                @click="resetMemberPassword(m)"
              >
                {{ resettingId === m.id ? "Enviando…" : "Restablecer contraseña" }}
              </button>
              <button
                type="button"
                :disabled="togglingId === m.id"
                class="rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50"
                :class="
                  m.disabled
                    ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    : 'border-red-200 text-red-600 hover:bg-red-50'
                "
                @click="toggleMemberDisabled(m)"
              >
                {{
                  togglingId === m.id
                    ? "Actualizando…"
                    : m.disabled
                      ? "Habilitar"
                      : "Deshabilitar"
                }}
              </button>
            </div>
          </li>
        </ul>
      </section>

      <!-- Modelos de IA -->
      <section class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-base font-semibold text-gray-900">Modelos de IA</h2>
          <span
            v-if="modelsData"
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            :class="
              modelsData.apiKeyConfigured
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            "
          >
            <span
              class="h-1.5 w-1.5 rounded-full"
              :class="modelsData.apiKeyConfigured ? 'bg-emerald-500' : 'bg-amber-500'"
            />
            {{
              modelsData.apiKeyConfigured ? "API key configurada" : "Falta API key"
            }}
          </span>
        </div>

        <p v-if="modelsError" class="mb-4 text-sm text-red-600">
          No se pudo cargar la configuración de modelos.
        </p>
        <p v-else-if="modelsPending" class="text-sm text-gray-400">Cargando…</p>

        <ul v-else-if="modelsData" class="divide-y divide-gray-100">
          <li
            v-for="m in modelsData.models"
            :key="m.id"
            class="flex items-start justify-between gap-4 py-3.5"
          >
            <div class="min-w-0">
              <p class="text-sm font-semibold text-gray-900">{{ m.label }}</p>
              <p class="mt-0.5 text-sm text-gray-500">{{ m.description }}</p>
              <p class="mt-1.5 text-xs text-gray-400">
                {{ m.provider }} ·
                <code class="rounded bg-gray-100 px-1 py-0.5 text-gray-500">{{
                  m.envVar
                }}</code>
              </p>
            </div>
            <div class="flex-shrink-0 text-right">
              <span
                v-if="m.model"
                class="inline-flex items-center rounded-lg bg-gray-900 px-3 py-1.5 font-mono text-xs font-medium text-white"
              >
                {{ m.model }}
              </span>
              <span
                v-else
                class="inline-flex items-center rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-400"
              >
                Sin configurar
              </span>
            </div>
          </li>
        </ul>

        <p class="mt-3 text-xs text-gray-400">
          Estos valores se configuran mediante variables de entorno en el
          servidor.
        </p>
      </section>
    </div>
  </div>

  <!-- Org business rule form modal -->
  <div
    v-if="showOrgRuleForm"
    class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/40 p-4 sm:items-center"
    @click.self="closeOrgRuleForm"
  >
    <div
      class="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="isEditingOrgRule ? 'editar-org-regla-title' : 'nueva-org-regla-title'"
    >
      <h2
        :id="isEditingOrgRule ? 'editar-org-regla-title' : 'nueva-org-regla-title'"
        class="text-lg font-semibold tracking-tight text-gray-900"
      >
        {{
          isEditingOrgRule
            ? "Editar anotación del negocio"
            : "Nueva anotación del negocio"
        }}
      </h2>
      <p class="mt-1 text-sm text-gray-500">
        {{
          isEditingOrgRule
            ? "Actualiza el nombre, reglas y contexto de"
            : "Define reglas generales que ayuden a la IA en"
        }}
        <span class="font-medium text-gray-700">{{ activeOrg?.name }}</span>.
      </p>

      <p
        v-if="orgRuleFormError"
        class="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        {{ orgRuleFormError }}
      </p>

      <div class="mt-5">
        <ClientBusinessRuleForm
          :key="editingOrgRule?.id ?? 'new-org'"
          :initial="editingOrgRule"
          :submitting="orgRuleSubmitting"
          :submit-label="isEditingOrgRule ? 'Guardar cambios' : 'Crear regla'"
          scope-hint="Agrupa reglas de negocio que aplican a toda la organización y se envían en cada análisis."
          @submit="onOrgRuleFormSubmit"
          @cancel="closeOrgRuleForm"
        />
      </div>
    </div>
  </div>
</template>
