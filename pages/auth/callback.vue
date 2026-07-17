<script setup lang="ts">
definePageMeta({ layout: false });

const supabase = useSupabaseClient();
const router = useRouter();
const error = ref<string | null>(null);

function isRecoveryRedirect(): boolean {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash.replace(/^#/, "");
  const fromHash = new URLSearchParams(hash).get("type");
  const fromQuery = new URLSearchParams(window.location.search).get("type");
  return fromHash === "recovery" || fromQuery === "recovery";
}

onMounted(async () => {
  let recoveryDetected = isRecoveryRedirect();

  const { data: sub } = supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      recoveryDetected = true;
    }
  });

  // Let @nuxtjs/supabase / supabase-js consume tokens from the URL.
  await new Promise((r) => setTimeout(r, 50));
  const { data, error: err } = await supabase.auth.getSession();
  sub.subscription.unsubscribe();

  if (err) {
    error.value = err.message;
    return;
  }

  if (recoveryDetected || isRecoveryRedirect()) {
    router.replace("/auth/reset-password");
    return;
  }

  if (data.session) {
    router.replace("/");
  } else {
    router.replace("/login");
  }
});
</script>

<template>
  <div
    class="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100"
  >
    <div class="text-center">
      <p v-if="error" class="text-red-400">{{ error }}</p>
      <p v-else class="text-slate-400">Finishing sign in…</p>
    </div>
  </div>
</template>
