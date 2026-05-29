<script setup lang="ts">
import type { Database } from "~/types/database.types";

const supabase = useSupabaseClient<Database>();
const { activeOrg, refresh } = useOrganization();

await refresh();
if (!activeOrg.value) {
  await navigateTo("/onboarding");
}

interface MemberRow {
  id: string;
  role: string;
  created_at: string;
  full_name: string | null;
}

const members = ref<MemberRow[]>([]);

async function loadMembers() {
  if (!activeOrg.value) return;
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, role, created_at, full_name")
    .eq("organization_id", activeOrg.value.id)
    .order("created_at", { ascending: true });
  if (!error) members.value = (data as MemberRow[] | null) ?? [];
}

watch(activeOrg, loadMembers, { immediate: true });
</script>

<template>
  <div class="px-8 py-8">
    <div class="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 class="text-2xl font-bold tracking-tight text-gray-900">Equipo</h1>
        <p class="mt-1 text-sm text-gray-500">
          Miembros de
          <span class="font-medium text-gray-700">{{ activeOrg?.name }}</span
          >.
        </p>
      </header>

      <section class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 class="text-base font-semibold text-gray-900">Miembros</h2>
        <p v-if="!members.length" class="mt-3 text-sm text-gray-400">
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
                {{ m.full_name ?? "(sin nombre)" }}
              </p>
              <p class="text-xs text-gray-400">
                Se unió {{ new Date(m.created_at).toLocaleDateString() }}
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
              {{ m.role }}
            </span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
