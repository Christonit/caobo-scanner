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

onMounted(async () => {
  // Step 1 — listen for auth events BEFORE doing anything else so we don't
  // miss the PASSWORD_RECOVERY event that fires during code exchange.
  const recoveryConfirmed = await new Promise<boolean>((resolve) => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        sub.subscription.unsubscribe();
        resolve(true);
      }
    });

    // Step 2 — If this is a PKCE flow the URL has ?code=... with no type.
    // Exchange it explicitly; this fires PASSWORD_RECOVERY above if it's a
    // recovery token, or SIGNED_IN for an invite token.
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      (supabase.auth as any)
        .exchangeCodeForSession(code)
        .catch(() => null); // errors handled via missing event → timeout below
    }

    // Step 3 — Implicit flow: type=recovery is already in the hash/query.
    const hash = window.location.hash.replace(/^#/, "");
    const typeFromHash = new URLSearchParams(hash).get("type");
    const typeFromQuery = new URLSearchParams(window.location.search).get("type");
    if (typeFromHash === "recovery" || typeFromQuery === "recovery") {
      // The supabase-js client will process the hash token automatically;
      // PASSWORD_RECOVERY fires via onAuthStateChange above. Give it a moment.
    }

    // Step 4 — If the user was redirected here from /auth/callback and the
    // session is already established (no code/hash in URL), check now.
    const hasToken =
      code ||
      typeFromHash === "recovery" ||
      typeFromQuery === "recovery" ||
      new URLSearchParams(hash).get("access_token");

    if (!hasToken) {
      // No token in URL — this might be a redirect from the callback page
      // which already exchanged the code. Check the existing session.
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          sub.subscription.unsubscribe();
          // We have a session but it came from an already-established recovery
          // via the callback page. Trust it and show the form.
          resolve(true);
        } else {
          // No session and no token — link is invalid or expired.
          sub.subscription.unsubscribe();
          resolve(false);
        }
      });
    }

    // Safety timeout so we never hang indefinitely on a broken link.
    setTimeout(() => {
      sub.subscription.unsubscribe();
      resolve(false);
    }, 6000);
  });

  if (recoveryConfirmed) {
    ready.value = true;
  } else {
    error.value = "El enlace no es válido o ya expiró. Solicita uno nuevo.";
  }
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
