<script setup lang="ts">
definePageMeta({ layout: false });

const supabase = useSupabaseClient();
const user = useSupabaseUser();
const router = useRouter();

const fullName = ref("");
const email = ref("");
const password = ref("");
const error = ref<string | null>(null);
const loading = ref(false);
const success = ref(false);

watchEffect(() => {
  if (user.value && !success.value) router.replace("/");
});

async function signup() {
  error.value = null;
  loading.value = true;

  const { error: err } = await supabase.auth.signUp({
    email: email.value.trim(),
    password: password.value,
    options: {
      data: { full_name: fullName.value.trim() || null },
      emailRedirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined,
    },
  });

  loading.value = false;
  if (err) {
    error.value = err.message;
    return;
  }
  success.value = true;
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
          Crea tu cuenta
        </h1>
        <p class="mt-1 text-sm text-gray-500">
          Empieza a escanear recibos en menos de un minuto
        </p>
      </div>

      <div
        v-if="success"
        class="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center"
      >
        <h2 class="text-lg font-semibold text-emerald-700">
          Revisa tu correo
        </h2>
        <p class="mt-2 text-sm text-emerald-700/80">
          Enviamos un enlace de confirmación a
          <span class="font-medium">{{ email }}</span
          >. Haz clic para terminar de configurar tu cuenta.
        </p>
        <NuxtLink
          to="/login"
          class="mt-4 inline-block text-sm font-medium text-emerald-600 hover:underline"
        >
          Volver a iniciar sesión
        </NuxtLink>
      </div>

      <form
        v-else
        @submit.prevent="signup"
        class="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label class="mb-1 block text-sm text-gray-700">Nombre completo</label>
          <input
            v-model="fullName"
            type="text"
            autocomplete="name"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            placeholder="Ada Lovelace"
          />
        </div>
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
            minlength="8"
            autocomplete="new-password"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            placeholder="Al menos 8 caracteres"
          />
        </div>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-lg bg-gray-900 py-2.5 font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {{ loading ? "Creando..." : "Crear cuenta" }}
        </button>

        <p class="text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?
          <NuxtLink to="/login" class="font-medium text-emerald-600 hover:underline">
            Iniciar sesión
          </NuxtLink>
        </p>
      </form>
    </div>
  </div>
</template>
