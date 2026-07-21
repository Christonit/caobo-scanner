<script setup lang="ts">
definePageMeta({ layout: false });

const supabase = useSupabaseClient();
const router = useRouter();
const error = ref<string | null>(null);

function getLinkType(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  const fromHash = new URLSearchParams(hash).get("type");
  const fromQuery = new URLSearchParams(window.location.search).get("type");
  return fromHash ?? fromQuery ?? null;
}

onMounted(async () => {
  // Implicit flow: the type is already in the URL hash (e.g. #type=invite).
  // PKCE flow:     the URL only has ?code=...; the type is only known after
  //                supabase-js exchanges the code, which fires an auth event.
  let detectedType = getLinkType();

  if (!detectedType) {
    // Wait for the auth state change that follows PKCE code exchange.
    // Resolves as soon as the first event fires (typically < 500 ms), with a
    // 4-second safety cap so we never block indefinitely on a bad link.
    const authEvent = await Promise.race<string | null>([
      new Promise((resolve) => {
        const { data: sub } = supabase.auth.onAuthStateChange((event) => {
          sub.subscription.unsubscribe();
          resolve(event);
        });
      }),
      new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);

    if (authEvent === "PASSWORD_RECOVERY") detectedType = "recovery";
    else if (authEvent === "SIGNED_IN") detectedType = getLinkType() ?? "signed_in";
  }

  const { data, error: err } = await supabase.auth.getSession();

  if (err) {
    error.value = err.message;
    return;
  }

  // Recovery links (admin reset or forgot-password) and invite links both need
  // the user to set / confirm their password before landing on the app.
  if (detectedType === "recovery" || detectedType === "invite") {
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
