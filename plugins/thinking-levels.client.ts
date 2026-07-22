/**
 * Load thinking-level → model map from the Python backend into global state
 * when the user is signed in (or immediately when auth is disabled).
 */
export default defineNuxtPlugin(() => {
  const user = useSupabaseUser();
  const features = useFeatureFlags();
  const { loadModels } = useThinkingLevel();

  let loadedForUser: string | null = null;

  watch(
    () => user.value?.sub ?? null,
    (userId) => {
      if (!features.auth) {
        void loadModels();
        return;
      }

      if (!userId) {
        loadedForUser = null;
        return;
      }

      if (loadedForUser === userId) return;
      loadedForUser = userId;
      void loadModels();
    },
    { immediate: true },
  );
});
