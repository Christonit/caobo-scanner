<script setup lang="ts">
definePageMeta({ layout: false });

const supabase = useSupabaseClient();
const router = useRouter();
const error = ref<string | null>(null);

onMounted(async () => {
  const { data, error: err } = await supabase.auth.getSession();
  if (err) {
    error.value = err.message;
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
    class="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100"
  >
    <div class="text-center">
      <p v-if="error" class="text-red-400">{{ error }}</p>
      <p v-else class="text-slate-400">Finishing sign in…</p>
    </div>
  </div>
</template>
