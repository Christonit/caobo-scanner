<script setup lang="ts">
const { activeOrg, isAdmin, isSuperAdmin, refresh } = useOrganization();

await refresh();
if (!activeOrg.value) {
  await navigateTo(isSuperAdmin.value ? "/" : "/onboarding");
}

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
  if (!activeOrg.value) return;
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

// --- Invite form -----------------------------------------------------------
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
    await $fetch("/api/team/invite", {
      method: "POST",
      body: {
        email: sentEmail,
        fullName: inviteFullName.value,
        role: inviteRole.value,
        organizationId: activeOrg.value.id,
      },
    });
    inviteSuccess.value = `Invitación enviada a ${sentEmail}.`;
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

// --- Deshabilitar / habilitar miembro --------------------------------------
const togglingId = ref<string | null>(null);
const toggleError = ref<string | null>(null);

async function toggleMemberDisabled(member: MemberRow) {
  if (!isAdmin.value) return;
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

// --- Restablecer contraseña de un miembro ----------------------------------
const resettingId = ref<string | null>(null);
const resetError = ref<string | null>(null);
const resetSuccessId = ref<string | null>(null);

async function resetMemberPassword(member: MemberRow) {
  if (!isAdmin.value) return;
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

// --- Reenviar invitación ---------------------------------------------------
const resendingId = ref<string | null>(null);
const resendError = ref<string | null>(null);
const resendSuccessId = ref<string | null>(null);

async function resendMemberInvite(member: MemberRow) {
  if (!isAdmin.value || member.activated) return;
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
</script>

<template>
  <div class="px-8 py-8">
    <div class="mx-auto max-w-4xl space-y-8">
      <header class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900">Equipo</h1>
          <p class="mt-1 text-sm text-gray-500">
            Miembros de
            <span class="font-medium text-gray-700">{{ activeOrg?.name }}</span>
            <span v-if="isSuperAdmin" class="ml-1 text-xs text-emerald-600">
              (viendo como superadmin)
            </span>
            .
          </p>
        </div>
        <button
          v-if="isAdmin"
          type="button"
          @click="openInvite"
          class="whitespace-nowrap rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Invitar usuario
        </button>
      </header>

      <!-- Invite form -->
      <section
        v-if="isAdmin && showInvite"
        class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-base font-semibold text-gray-900">Invitar por correo</h2>
          <button
            type="button"
            @click="showInvite = false"
            class="text-sm text-gray-400 hover:text-gray-600"
          >
            Cerrar
          </button>
        </div>

        <form @submit.prevent="submitInvite" class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm text-gray-700">Correo</label>
              <input
                v-model="inviteEmail"
                type="email"
                required
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                placeholder="persona@empresa.com"
              />
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-700">Nombre (opcional)</label>
              <input
                v-model="inviteFullName"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                placeholder="Ada Lovelace"
              />
            </div>
          </div>

          <div>
            <label class="mb-1 block text-sm text-gray-700">Rol</label>
            <select
              v-model="inviteRole"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            >
              <option value="collaborator">Colaborador</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <p v-if="inviteError" class="text-sm text-red-600">{{ inviteError }}</p>
          <p v-if="inviteSuccess" class="text-sm text-emerald-600">{{ inviteSuccess }}</p>

          <button
            type="submit"
            :disabled="inviteSubmitting"
            class="w-full rounded-lg bg-gray-900 py-2.5 font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50 sm:w-auto sm:px-6"
          >
            {{ inviteSubmitting ? "Enviando..." : "Enviar invitación" }}
          </button>
        </form>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 class="text-base font-semibold text-gray-900">Miembros</h2>
        <p v-if="membersError" class="mt-3 text-sm text-red-600">{{ membersError }}</p>
        <p v-else-if="membersPending" class="mt-3 text-sm text-gray-400">Cargando...</p>
        <p v-else-if="!members.length" class="mt-3 text-sm text-gray-400">
          Aún no hay miembros.
        </p>
        <ul v-else class="mt-4 divide-y divide-gray-100">
          <li
            v-for="m in members"
            :key="m.id"
            class="flex flex-wrap items-center justify-between gap-3 py-3.5"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
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

            <div v-if="isAdmin" class="flex flex-shrink-0 items-center gap-2">
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
    </div>
  </div>
</template>
