<script setup lang="ts">
definePageMeta({ layout: false });

const user = useSupabaseUser();
const router = useRouter();

const email = ref("");
const error = ref<string | null>(null);
const loading = ref(false);
const sent = ref(false);

watchEffect(() => {
  if (user.value?.sub) router.replace("/");
});

async function requestReset() {
  error.value = null;
  loading.value = true;
  try {
    // Routed through the server (see server/api/auth/forgot-password.post.ts)
    // rather than calling supabase.auth.resetPasswordForEmail() directly from
    // the browser. That client-side call stores a PKCE code_verifier in
    // *this* browser's storage and mails a `?code=...` link that only works
    // if opened back in this exact browser — it fails everywhere else with
    // "PKCE code verifier not found in storage". The server route instead
    // mails a token_hash link that works from any device/browser.
    await $fetch("/api/auth/forgot-password", {
      method: "POST",
      body: { email: email.value.trim() },
    });
    sent.value = true;
  } catch (e: unknown) {
    const message =
      (e as { data?: { statusMessage?: string } })?.data?.statusMessage ||
      "No se pudo enviar el correo. Intenta de nuevo.";
    error.value = message;
  } finally {
    loading.value = false;
  }
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
          Restablecer contraseña
        </h1>
        <p class="mt-1 text-sm text-gray-500">
          Te enviaremos un enlace a tu correo para crear una nueva.
        </p>
      </div>

      <div
        v-if="sent"
        class="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <p class="text-sm text-gray-700">
          Si existe una cuenta con
          <span class="font-medium text-gray-900">{{ email }}</span>, recibirás
          un correo con instrucciones.
        </p>
        <NuxtLink
          to="/login"
          class="block w-full rounded-lg bg-gray-900 py-2.5 text-center font-semibold text-white transition hover:bg-gray-800"
        >
          Volver a iniciar sesión
        </NuxtLink>
      </div>

      <form
        v-else
        class="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        @submit.prevent="requestReset"
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

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-lg bg-gray-900 py-2.5 font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {{ loading ? "Enviando..." : "Enviar enlace" }}
        </button>

        <p class="text-center text-sm text-gray-500">
          <NuxtLink to="/login" class="font-medium text-emerald-600 hover:underline">
            Volver a iniciar sesión
          </NuxtLink>
        </p>
      </form>
    </div>
  </div>
</template>
