<script setup lang="ts">
definePageMeta({ layout: false });

const supabase = useSupabaseClient();
const user = useSupabaseUser();
const router = useRouter();
const route = useRoute();

const email = ref("");
const password = ref("");
const error = ref<string | null>(null);
const loading = ref(false);

watchEffect(() => {
  // JWT claims from useSupabaseUser() — signed-in when `sub` is present.
  if (user.value?.sub) {
    const redirect =
      typeof route.query.redirect === "string" ? route.query.redirect : "/";
    router.replace(redirect);
  }
});

async function login() {
  error.value = null;
  loading.value = true;
  const { error: err } = await supabase.auth.signInWithPassword({
    email: email.value.trim(),
    password: password.value,
  });
  loading.value = false;
  if (err) {
    error.value = err.message;
    return;
  }
}
</script>

<template>
  <div
    class="flex min-h-screen items-center justify-center bg-gray-50 px-6"
  >
    <div class="w-full max-w-md">
      <div class="mb-8 text-center">
        <div
          class="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-lg font-bold text-white"
        >
          C
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-gray-900">
          Caobo Recibos
        </h1>
        <p class="mt-1 text-sm text-gray-500">Inicia sesión en tu cuenta</p>
      </div>

      <form
        @submit.prevent="login"
        class="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label class="mb-1 block text-sm text-gray-700">Correo</label>
          <input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            placeholder="tu@ejemplo.com"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm text-gray-700">Contraseña</label>
          <input
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
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
          {{ loading ? "Iniciando..." : "Iniciar sesión" }}
        </button>

        <p class="text-center text-sm text-gray-500">
          ¿No tienes cuenta?
          <NuxtLink to="/signup" class="font-medium text-emerald-600 hover:underline">
            Crear una
          </NuxtLink>
        </p>
      </form>
    </div>
  </div>
</template>
