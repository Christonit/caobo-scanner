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
    membersError.value = err?.data?.statusMessage || err?.message || "Error al cargar el equipo.";
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
    await $fetch("/api/team/invite", {
      method: "POST",
      body: {
        email: inviteEmail.value,
        fullName: inviteFullName.value,
        role: inviteRole.value,
        organizationId: activeOrg.value.id,
      },
    });
    inviteSuccess.value = `Invitación enviada a ${inviteEmail.value}.`;
    inviteEmail.value = "";
    inviteFullName.value = "";
    await loadMembers();
  } catch (err: any) {
    inviteError.value = err?.data?.statusMessage || err?.message || "No se pudo invitar.";
  } finally {
    inviteSubmitting.value = false;
  }
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
            class="flex items-center justify-between py-3"
          >
            <div>
              <p class="text-gray-900">
                {{ m.fullName ?? m.email ?? "(sin nombre)" }}
              </p>
              <p class="text-xs text-gray-400">
                {{ m.email }} · Se unió {{ new Date(m.createdAt).toLocaleDateString() }}
              </p>
            </div>
            <span
              class="rounded-full px-2.5 py-0.5 text-xs font-medium"
              :class="
                m.role === 'admin'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-600'
              "
            >
              {{ m.role === "admin" ? "Administrador" : "Colaborador" }}
            </span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
