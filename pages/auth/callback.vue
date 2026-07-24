<script setup lang="ts">
definePageMeta({ layout: false });

const supabase = useSupabaseClient();
const router = useRouter();

const error = ref<string | null>(null);
const loading = ref(false);
// token_hash links must NOT be verified on page load — corporate email
// scanners (Safe Links, Proofpoint, etc.) prefetch the URL and would burn
// the one-time token before the human ever clicks. Wait for an explicit
// user action instead.
const needsConfirm = ref(false);
const linkType = ref<"recovery" | "invite" | null>(null);
const tokenHash = ref<string | null>(null);
const status = ref("Finishing sign in…");

function parseLinkType(type: string | null): "recovery" | "invite" | null {
  if (type === "recovery" || type === "invite") return type;
  return null;
}

async function finishAfterSession(detectedType: "recovery" | "invite" | null) {
  if (detectedType === "recovery" || detectedType === "invite") {
    console.log("[auth-callback] redirecting to /auth/reset-password");
    router.replace("/auth/reset-password");
    return;
  }

  const { data, error: err } = await supabase.auth.getSession();
  console.log("[auth-callback] final getSession", {
    hasSession: !!data.session,
    error: err?.message ?? null,
  });

  if (err) {
    error.value = err.message;
    return;
  }

  if (data.session) {
    router.replace("/");
  } else {
    router.replace("/login");
  }
}

async function confirmTokenHash() {
  if (!tokenHash.value) return;
  loading.value = true;
  error.value = null;
  status.value = "Verificando enlace…";

  const type = linkType.value ?? "recovery";
  console.log("[auth-callback] verifying OTP token_hash…", { type });
  const { data, error: verifyErr } = await supabase.auth.verifyOtp({
    token_hash: tokenHash.value,
    type,
  });
  console.log("[auth-callback] verifyOtp result", {
    error: verifyErr?.message ?? null,
    hasSession: !!data?.session,
  });

  loading.value = false;

  if (verifyErr || !data?.session) {
    error.value =
      verifyErr?.message ||
      "El enlace no es válido o ya expiró. Solicita uno nuevo.";
    needsConfirm.value = false;
    return;
  }

  await finishAfterSession(linkType.value);
}

onMounted(async () => {
  const hash = window.location.hash.replace(/^#/, "");
  const hashParams = new URLSearchParams(hash);
  const queryParams = new URLSearchParams(window.location.search);

  const hashToken = queryParams.get("token_hash");
  const code = queryParams.get("code");
  const typeFromHash = hashParams.get("type");
  const typeFromQuery = queryParams.get("type");
  const accessTokenInHash = hashParams.get("access_token");

  linkType.value = parseLinkType(typeFromQuery) ?? parseLinkType(typeFromHash);

  console.log("[auth-callback] mounted", {
    href: window.location.href,
    tokenHash: hashToken ? "present" : null,
    code,
    typeFromHash,
    typeFromQuery,
    accessTokenInHash: accessTokenInHash ? "present" : null,
  });

  if (hashToken) {
    // Pause here — do not call verifyOtp until the user confirms.
    tokenHash.value = hashToken;
    needsConfirm.value = true;
    status.value =
      linkType.value === "invite"
        ? "Confirma para aceptar la invitación."
        : "Confirma para restablecer tu contraseña.";
    return;
  }

  if (code) {
    // Fallback only: a `?code=...` link from Supabase's hosted /verify
    // redirect. Auth codes expire in ~5 minutes and need a PKCE verifier
    // that server-generated links never create — usually fails.
    console.log(
      "[auth-callback] exchanging code for session… (fallback, likely to fail for server-generated links)",
    );
    status.value = "Verificando enlace…";
    const { data, error: exchangeErr } =
      await supabase.auth.exchangeCodeForSession(code).catch((e) => {
        console.log("[auth-callback] exchangeCodeForSession threw", e);
        return { data: null, error: e };
      });
    console.log("[auth-callback] exchangeCodeForSession result", {
      error: exchangeErr?.message ?? null,
      hasSession: !!data?.session,
    });
    if (exchangeErr) {
      error.value =
        typeof exchangeErr === "object" &&
        exchangeErr &&
        "message" in exchangeErr
          ? String((exchangeErr as { message: string }).message)
          : "El enlace no es válido o ya expiró. Solicita uno nuevo.";
      return;
    }
  } else if (accessTokenInHash) {
    // Old-style implicit link (`#access_token=...&refresh_token=...`).
    // Our own links no longer generate these (see server/utils/authEmail.ts —
    // everything now uses `?token_hash=`), so this branch only exists for
    // stale emails sent before that fix shipped, or any other legacy link.
    //
    // Don't rely on supabase-js's automatic hash detection here: the client
    // this app creates (@nuxtjs/supabase + useSsrCookies) hard-codes
    // `flowType: "pkce"` in @supabase/ssr's createBrowserClient, and that
    // silently breaks the implicit-flow auto-detection that would normally
    // fire a PASSWORD_RECOVERY/SIGNED_IN event — it just never fires,
    // which is why this used to hang for 5s and then say "expired" even
    // though the link itself might have been fine. Redeem the tokens
    // directly instead; setSession() doesn't care about flowType.
    const refreshTokenInHash = hashParams.get("refresh_token");
    console.log("[auth-callback] legacy implicit link: setSession from hash", {
      hasRefreshToken: !!refreshTokenInHash,
    });
    if (refreshTokenInHash) {
      const { data, error: setSessionErr } = await supabase.auth.setSession({
        access_token: accessTokenInHash,
        refresh_token: refreshTokenInHash,
      });
      console.log("[auth-callback] setSession result", {
        error: setSessionErr?.message ?? null,
        hasSession: !!data?.session,
      });
      if (setSessionErr || !data?.session) {
        error.value =
          "Este enlace es de un correo anterior y ya no es válido. Solicita uno nuevo.";
        return;
      }
    } else {
      error.value =
        "Este enlace es de un correo anterior y ya no es válido. Solicita uno nuevo.";
      return;
    }
  } else if (typeFromHash || typeFromQuery) {
    console.log(
      "[auth-callback] implicit flow: waiting for auto-detected auth event…",
    );
    await new Promise<void>((resolve) => {
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        console.log("[auth-callback] onAuthStateChange", {
          event,
          hasSession: !!session,
        });
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          sub.subscription.unsubscribe();
          resolve();
        }
      });
      setTimeout(() => {
        console.log("[auth-callback] auth event wait timed out");
        sub.subscription.unsubscribe();
        resolve();
      }, 5000);
    });
  } else {
    console.log("[auth-callback] no code/hash/type in URL");
  }

  await finishAfterSession(linkType.value);
});
</script>

<template>
  <div
    class="flex min-h-screen items-center justify-center bg-gray-50 px-6 text-gray-900"
  >
    <div class="w-full max-w-md text-center">
      <div
        class="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-lg font-bold text-white"
      >
        C
      </div>

      <div
        v-if="error"
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

      <div
        v-else-if="needsConfirm"
        class="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h1 class="text-xl font-bold tracking-tight">
          {{
            linkType === "invite"
              ? "Aceptar invitación"
              : "Restablecer contraseña"
          }}
        </h1>
        <p class="text-sm text-gray-500">{{ status }}</p>
        <button
          type="button"
          :disabled="loading"
          class="w-full rounded-lg bg-gray-900 py-2.5 font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
          @click="confirmTokenHash"
        >
          {{
            loading
              ? "Verificando…"
              : linkType === "invite"
                ? "Continuar"
                : "Continuar"
          }}
        </button>
      </div>

      <p v-else class="text-sm text-gray-500">{{ status }}</p>
    </div>
  </div>
</template>
