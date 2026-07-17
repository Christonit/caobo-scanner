<script setup lang="ts">
definePageMeta({ layout: false });

const supabase = useSupabaseClient();
const router = useRouter();

const password = ref("");
const confirm = ref("");
const error = ref<string | null>(null);
const loading = ref(false);
const ready = ref(false);
const done = ref(false);

function isRecoveryHash(): boolean {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash.replace(/^#/, "");
  const fromHash = new URLSearchParams(hash).get("type");
  const fromQuery = new URLSearchParams(window.location.search).get("type");
  return fromHash === "recovery" || fromQuery === "recovery";
}

onMounted(async () => {
  const { data: sub } = supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      ready.value = true;
    }
  });

  // Give the Supabase client a moment to consume tokens from the URL
  // (hash fragment or PKCE code) before deciding the link is invalid.
  await new Promise((r) => setTimeout(r, 0));
  const { data, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    error.value = sessionError.message;
    sub.subscription.unsubscribe();
    return;
  }

  if (data.session || isRecoveryHash()) {
    ready.value = true;
  } else {
    error.value =
      "El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo.";
  }

  sub.subscription.unsubscribe();
});

async function savePassword() {
  error.value = null;
  if (password.value.length < 8) {
    error.value = "La contraseña debe tener al menos 8 caracteres.";
    return;
  }
  if (password.value !== confirm.value) {
    error.value = "Las contraseñas no coinciden.";
    return;
  }

  loading.value = true;
  const { error: err } = await supabase.auth.updateUser({
    password: password.value,
  });
  loading.value = false;

  if (err) {
    error.value = err.message;
    return;
  }

  done.value = true;
  setTimeout(() => router.replace("/"), 1500);
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-6">
    <div class="w-full max-w-md">
      <div class="mb-8 text-center">
        <div
          class="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-lg font-bold text-white"
        >
          C
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-gray-900">
          Nueva contraseña
        </h1>
        <p class="mt-1 text-sm text-gray-500">
          Elige una contraseña nueva para tu cuenta.
        </p>
      </div>

      <div
        v-if="done"
        class="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm"
      >
        <p class="text-sm font-medium text-emerald-700">
          Contraseña actualizada. Redirigiendo…
        </p>
      </div>

      <div
        v-else-if="error && !ready"
        class="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <p class="text-sm text-red-600">{{ error }}</p>
        <NuxtLink
          to="/forgot-password"
          class="block w-full rounded-lg bg-gray-900 py-2.5 text-center font-semibold text-white transition hover:bg-gray-800"
        >
          Solicitar un nuevo enlace
        </NuxtLink>
      </div>

      <form
        v-else-if="ready"
        class="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        @submit.prevent="savePassword"
      >
        <div>
          <label class="mb-1 block text-sm text-gray-700">Nueva contraseña</label>
          <input
            v-model="password"
            type="password"
            required
            minlength="8"
            autocomplete="new-password"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            placeholder="••••••••"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm text-gray-700">
            Confirmar contraseña
          </label>
          <input
            v-model="confirm"
            type="password"
            required
            minlength="8"
            autocomplete="new-password"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            placeholder="••••••••"
          />
        </div>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-lg bg-gray-900 py-2.5 font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {{ loading ? "Guardando..." : "Guardar contraseña" }}
        </button>
      </form>

      <div
        v-else
        class="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm"
      >
        <p class="text-sm text-gray-500">Verificando enlace…</p>
      </div>
    </div>
  </div>
</template>
