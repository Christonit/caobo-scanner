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
// When the email link lands here with token_hash, wait for a human click
// before verifyOtp — email security scanners otherwise burn the one-time
// token on prefetch and the real user sees "expired".
const needsConfirm = ref(false);
const pendingTokenHash = ref<string | null>(null);
const pendingType = ref<"recovery" | "invite">("recovery");
const verifying = ref(false);

async function redeemTokenHash() {
  if (!pendingTokenHash.value) return;
  verifying.value = true;
  error.value = null;
  console.log("[reset-password] verifying OTP token_hash…", {
    type: pendingType.value,
  });
  const { data, error: verifyErr } = await supabase.auth.verifyOtp({
    token_hash: pendingTokenHash.value,
    type: pendingType.value,
  });
  console.log("[reset-password] verifyOtp result", {
    error: verifyErr?.message ?? null,
    hasSession: !!data?.session,
  });
  verifying.value = false;
  if (verifyErr || !data?.session) {
    needsConfirm.value = false;
    error.value =
      verifyErr?.message ||
      "El enlace no es válido o ya expiró. Solicita uno nuevo.";
    return;
  }
  needsConfirm.value = false;
  ready.value = true;
}

onMounted(async () => {
  const hash = window.location.hash.replace(/^#/, "");
  const hashParams = new URLSearchParams(hash);
  const queryParams = new URLSearchParams(window.location.search);

  const tokenHash = queryParams.get("token_hash");
  const code = queryParams.get("code");
  const typeFromHash = hashParams.get("type");
  const typeFromQuery = queryParams.get("type");
  const accessTokenInHash = hashParams.get("access_token");

  console.log("[reset-password] mounted", {
    href: window.location.href,
    tokenHash: tokenHash ? "present" : null,
    code,
    typeFromHash,
    typeFromQuery,
    accessTokenInHash: accessTokenInHash ? "present" : null,
  });

  // --- Path A: redirected here from /auth/callback, session already stored ---
  const hasAnything =
    tokenHash || code || typeFromHash || typeFromQuery || accessTokenInHash;
  if (!hasAnything) {
    console.log("[reset-password] Path A: no token in URL, checking session");
    const { data } = await supabase.auth.getSession();
    console.log("[reset-password] Path A: getSession result", {
      hasSession: !!data.session,
      userId: data.session?.user?.id,
    });
    if (data.session) {
      ready.value = true;
    } else {
      error.value = "El enlace no es válido o ya expiró. Solicita uno nuevo.";
    }
    return;
  }

  // Primary path: pause for human confirmation before burning token_hash.
  if (tokenHash) {
    pendingTokenHash.value = tokenHash;
    pendingType.value =
      typeFromQuery === "invite" || typeFromHash === "invite"
        ? "invite"
        : "recovery";
    needsConfirm.value = true;
    return;
  }

  console.log("[reset-password] Path B: code/hash in URL, exchanging/waiting");

  const recoveryConfirmed = await new Promise<boolean>((resolve) => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[reset-password] onAuthStateChange", {
        event,
        hasSession: !!session,
      });
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        const isRecovery =
          event === "PASSWORD_RECOVERY" ||
          code ||
          typeFromHash === "recovery" ||
          typeFromQuery === "recovery";
        console.log("[reset-password] isRecovery?", isRecovery);
        if (isRecovery) {
          sub.subscription.unsubscribe();
          resolve(true);
        }
      }
    });

    if (code) {
      // Fallback: Auth codes expire in ~5 minutes and need a PKCE verifier.
      console.log(
        "[reset-password] exchanging code for session… (fallback, likely to fail for server-generated links)",
      );
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error: exchangeErr, data }) => {
          console.log("[reset-password] exchangeCodeForSession result", {
            error: exchangeErr?.message ?? null,
            hasSession: !!data?.session,
          });
          if (exchangeErr) {
            sub.subscription.unsubscribe();
            resolve(false);
          }
        })
        .catch((e) => {
          console.log("[reset-password] exchangeCodeForSession threw", e);
          sub.subscription.unsubscribe();
          resolve(false);
        });
    }

    setTimeout(() => {
      sub.subscription.unsubscribe();
      supabase.auth.getSession().then(({ data }) => {
        console.log("[reset-password] timeout fallback getSession", {
          hasSession: !!data.session,
        });
        resolve(!!data.session);
      });
    }, 6000);
  });

  console.log("[reset-password] recoveryConfirmed =", recoveryConfirmed);

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
        v-else-if="needsConfirm"
        class="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <p class="text-sm text-gray-600">
          {{
            pendingType === "invite"
              ? "Confirma para aceptar la invitación y crear tu contraseña."
              : "Confirma para continuar y crear tu nueva contraseña."
          }}
        </p>
        <button
          type="button"
          :disabled="verifying"
          class="w-full rounded-lg bg-gray-900 py-2.5 font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
          @click="redeemTokenHash"
        >
          {{ verifying ? "Verificando…" : "Continuar" }}
        </button>
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
