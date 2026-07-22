/**
 * Thinking level for receipt/suplidor AI inference.
 * Switches the Gemini/Gemma model under the hood; the UI only shows
 * human-friendly levels. Model ids come from GET /thinking-levels.
 */

export type ThinkingLevel = "rapido" | "moderado" | "profundo";

export const THINKING_LEVEL_OPTIONS: Array<{
  value: ThinkingLevel;
  label: string;
}> = [
  { value: "rapido", label: "Rapido 🏃‍♂️" },
  { value: "moderado", label: "Moderado 🧑‍💼" },
  { value: "profundo", label: "Profundo 🚬🤓☕️" },
];

/** Fallback until GET /thinking-levels succeeds (matches backend defaults). */
const FALLBACK_MODELS: Record<ThinkingLevel, string> = {
  rapido: "gemini-3.1-flash-lite",
  moderado: "gemini-3.5-flash-lite",
  profundo: "gemini-3.6-flash",
};

const STORAGE_KEY = "caobo-thinking-level";

function isThinkingLevel(value: string): value is ThinkingLevel {
  return value === "rapido" || value === "moderado" || value === "profundo";
}

function parseModelsPayload(
  raw: unknown,
): Record<ThinkingLevel, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const models = (raw as { models?: unknown }).models;
  if (!models || typeof models !== "object") return null;

  const out: Partial<Record<ThinkingLevel, string>> = {};
  for (const level of ["rapido", "moderado", "profundo"] as const) {
    const id = (models as Record<string, unknown>)[level];
    if (typeof id !== "string" || !id.trim()) return null;
    out[level] = id.trim();
  }
  return out as Record<ThinkingLevel, string>;
}

export function useThinkingLevel() {
  const thinkingLevel = useState<ThinkingLevel>(
    "thinking-level",
    () => "moderado",
  );
  const levelModels = useState<Record<ThinkingLevel, string>>(
    "thinking-level-models",
    () => ({ ...FALLBACK_MODELS }),
  );
  const modelsLoaded = useState<boolean>(
    "thinking-level-models-loaded",
    () => false,
  );
  const modelsLoading = useState<boolean>(
    "thinking-level-models-loading",
    () => false,
  );
  const selectionRestored = useState<boolean>(
    "thinking-level-restored",
    () => false,
  );

  function restoreSelectionFromStorage() {
    if (!import.meta.client || selectionRestored.value) return;
    selectionRestored.value = true;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isThinkingLevel(stored)) {
      thinkingLevel.value = stored;
    }
  }

  // Only register when called from a component setup (not a plugin).
  if (getCurrentInstance()) {
    onMounted(() => {
      restoreSelectionFromStorage();
    });
  }

  watch(thinkingLevel, (value) => {
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, value);
    }
  });

  const model = computed(() => levelModels.value[thinkingLevel.value]);

  async function loadModels(force = false): Promise<void> {
    if (!import.meta.client) return;
    restoreSelectionFromStorage();
    if (modelsLoaded.value && !force) return;
    if (modelsLoading.value) return;

    modelsLoading.value = true;
    try {
      const apiBase = useApiBase();
      const res = await fetch(`${apiBase}/thinking-levels`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      const parsed = parseModelsPayload(json);
      if (!parsed) {
        throw new Error("Invalid thinking-levels payload");
      }
      levelModels.value = parsed;

      const defaultLevel = (json as { default?: string }).default;
      if (
        defaultLevel &&
        isThinkingLevel(defaultLevel) &&
        !localStorage.getItem(STORAGE_KEY)
      ) {
        thinkingLevel.value = defaultLevel;
      }
      modelsLoaded.value = true;
    } catch (err) {
      console.warn("[thinking-levels] failed to load from backend", err);
    } finally {
      modelsLoading.value = false;
    }
  }

  return {
    thinkingLevel,
    model,
    models: levelModels,
    modelsLoaded,
    modelsLoading,
    options: THINKING_LEVEL_OPTIONS,
    loadModels,
  };
}
