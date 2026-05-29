<script setup lang="ts">
import type { Database } from "~/types/database.types";

const supabase = useSupabaseClient<Database>();
const user = useSupabaseUser();
const router = useRouter();
const { membership, refresh } = useOrganization();

const orgName = ref("");
const fullName = ref(
  ((user.value?.user_metadata as { full_name?: string } | null)?.full_name) ??
    ""
);
const error = ref<string | null>(null);
const loading = ref(false);

await refresh();
if (membership.value) {
  await navigateTo("/");
}

async function createOrg() {
  if (!user.value) return;
  error.value = null;
  loading.value = true;

  const { error: rpcErr } = await supabase.rpc("create_organization", {
    p_name: orgName.value.trim(),
    p_full_name: fullName.value.trim() || null,
  });

  if (rpcErr) {
    loading.value = false;
    error.value = rpcErr.message;
    return;
  }

  await refresh();
  loading.value = false;
  router.replace("/");
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
    <div class="w-full max-w-xl">
      <h1 class="text-3xl font-bold tracking-tight text-gray-900">
        Crea tu organización
      </h1>
      <p class="mt-2 text-gray-500">
        Una organización es la empresa para la que trabajas. Es dueña de tus
        clientes y documentos.
      </p>

      <form
        @submit.prevent="createOrg"
        class="mt-8 space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label class="mb-1 block text-sm text-gray-700">Tu nombre</label>
          <input
            v-model="fullName"
            maxlength="80"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            placeholder="Ada Lovelace"
          />
        </div>

        <div>
          <label class="mb-1 block text-sm text-gray-700"
            >Nombre de la organización</label
          >
          <input
            v-model="orgName"
            required
            minlength="2"
            maxlength="80"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            placeholder="Acme Bookkeeping"
          />
        </div>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-lg bg-gray-900 py-2.5 font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {{ loading ? "Creando..." : "Crear organización" }}
        </button>
      </form>
    </div>
  </div>
</template>
