import type {
  EffectivenessCsat,
  EffectivenessFailureReason,
  EffectivenessSessionStatus,
} from "~/types/database.types";

// =====================================================================
// Tool effectiveness telemetry (feature-flagged).
// =====================================================================
// Tracks, per session (first PDF drop → export / discard / unload):
//   - timing: session start/end + AI duration per run
//   - volume: pages processed (per user / email server-side)
//   - first-pass quality: critical fields empty / incomplete / invalid
//   - reanalysis load: runs after the first Procesar
//   - binary CSAT: good | bad, shown ~3s after Excel export
//
// All writes are fire-and-forget navigator.sendBeacon calls to the
// feature-flagged /api/effectiveness/** endpoints. Telemetry must never
// break or block a user flow, so every path fails silently.
// =====================================================================

// --- Critical-field scoring ------------------------------------------
// "Bad field" = a CRITICAL field that is empty, incomplete (missing
// characters), or fails hard validation — measured on the raw AI output
// before the user edits anything. Kept deliberately conservative so we do
// not flag legitimately-empty fields (e.g. NCF on informal gastos) as bad.

export interface FieldFailure {
  field: string;
  reason: EffectivenessFailureReason;
}

export interface RunScore {
  pagesInRun: number;
  pagesOk: number;
  pagesWithFailures: number;
  correctnessPct: number | null;
  fieldFailures: Record<string, number>;
  failureReasons: Record<string, Record<string, number>>;
}

// Minimal shape scored — matches file.editableData in pages/index.vue.
export interface ScorableRow {
  nombre?: string | null;
  documento?: string | null;
  ncf?: string | null;
  ncf_afectado?: string | null;
  fecha?: string | null;
  monto_en_servicios?: string | number | null;
  monto_en_bienes?: string | number | null;
}

const normalizeNcf = (v: unknown): string =>
  String(v ?? "")
    .replace(/\s+/g, "")
    .toUpperCase();

const expectedNcfLength = (ncf: string): number | null => {
  const v = normalizeNcf(ncf);
  if (!v) return null;
  if (v.startsWith("E")) return 13;
  if (v.startsWith("B")) return 11;
  return null;
};

const requiresNcfAfectado = (ncf: unknown): boolean => {
  const v = normalizeNcf(ncf).replace(/^0+/, "");
  return v.startsWith("B03") || v.startsWith("B04");
};

const isBlank = (v: unknown): boolean => !String(v ?? "").trim();

const toAmount = (v: unknown): number => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** Critical-field failures for a single row (empty AI output). */
export function scoreRow(d: ScorableRow): FieldFailure[] {
  const fails: FieldFailure[] = [];

  if (isBlank(d.nombre)) fails.push({ field: "nombre", reason: "empty" });

  const doc = String(d.documento ?? "").replace(/\D/g, "");
  if (!doc) fails.push({ field: "documento", reason: "empty" });
  else if (doc.length !== 9 && doc.length !== 11)
    // DR RNC = 9 digits, cédula = 11 digits; anything else is truncated/wrong.
    fails.push({ field: "documento", reason: "incomplete" });

  // NCF may be legitimately empty (gasto informal) — only flag a present NCF
  // whose length is wrong for its series.
  const ncf = normalizeNcf(d.ncf);
  if (ncf) {
    const expected = expectedNcfLength(ncf);
    if (expected != null && ncf.length !== expected)
      fails.push({ field: "ncf", reason: "invalid_length" });
  }

  // Credit/debit notes (B03/B04) must carry the affected NCF.
  if (requiresNcfAfectado(d.ncf) && isBlank(d.ncf_afectado))
    fails.push({ field: "ncf_afectado", reason: "required_missing" });

  if (isBlank(d.fecha)) fails.push({ field: "fecha", reason: "empty" });

  // A receipt should carry some amount in services or goods.
  if (toAmount(d.monto_en_servicios) <= 0 && toAmount(d.monto_en_bienes) <= 0)
    fails.push({ field: "monto", reason: "empty" });

  return fails;
}

/** Aggregate critical-field failures across every scored row in a run. */
export function scoreCriticalFields(rows: ScorableRow[]): RunScore {
  const fieldFailures: Record<string, number> = {};
  const failureReasons: Record<string, Record<string, number>> = {};
  let pagesWithFailures = 0;

  for (const row of rows) {
    const fails = scoreRow(row);
    if (fails.length) pagesWithFailures++;
    for (const { field, reason } of fails) {
      fieldFailures[field] = (fieldFailures[field] ?? 0) + 1;
      failureReasons[field] = failureReasons[field] ?? {};
      failureReasons[field][reason] = (failureReasons[field][reason] ?? 0) + 1;
    }
  }

  const pagesInRun = rows.length;
  const pagesOk = pagesInRun - pagesWithFailures;
  const correctnessPct = pagesInRun
    ? Math.round((pagesOk / pagesInRun) * 10000) / 100
    : null;

  return {
    pagesInRun,
    pagesOk,
    pagesWithFailures,
    correctnessPct,
    fieldFailures,
    failureReasons,
  };
}

// --- Session telemetry ------------------------------------------------

export interface RecordRunOptions {
  rows: ScorableRow[];
  isReanalysis?: boolean;
  aiDurationMs?: number | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export const useEffectivenessMetrics = () => {
  const features = useFeatureFlags();
  const { activeOrg } = useOrganization();

  const enabled = computed(() => features.effectiveness);

  const sessionId = ref<string | null>(null);
  const clientId = ref<string | null>(null);
  const startedAt = ref<string | null>(null);
  const createSent = ref(false);
  const ended = ref(false);
  const runCount = ref(0);
  const csatAsked = ref(false);
  // Drives the CSAT modal in the UI (true ~3s after a successful export).
  const csatPending = ref(false);
  // Session the pending CSAT belongs to (kept across beginExtractionSession /
  // startSession so the beacon still hits the exported session).
  const csatForSessionId = ref<string | null>(null);
  let csatTimer: ReturnType<typeof setTimeout> | null = null;

  function clearCsatTimer(): void {
    if (csatTimer != null) {
      clearTimeout(csatTimer);
      csatTimer = null;
    }
  }

  function resetLocalState(id: string): void {
    sessionId.value = id;
    startedAt.value = new Date().toISOString();
    createSent.value = false;
    ended.value = false;
    runCount.value = 0;
    // Keep an in-flight post-export CSAT prompt for the previous session.
    if (!csatForSessionId.value && !csatPending.value) {
      csatAsked.value = false;
      csatPending.value = false;
    }
  }

  function beacon(path: string, payload: Record<string, unknown>): void {
    if (!import.meta.client) return;
    const organizationId = activeOrg.value?.id;
    if (!organizationId) return;

    const url = `/api/effectiveness/${path}`;
    try {
      const body = JSON.stringify({ ...payload, organizationId });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(url, blob)) return;
      }
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* telemetry is best-effort */
    }
  }

  /** Begin tracking a session; call when the first PDF of a batch is added. */
  function startSession(
    id: string,
    opts: { clientId?: string | null; clientName?: string | null } = {},
  ): void {
    if (!enabled.value || !id) return;
    // New batch id, or restart after export/discard/abandon → reset counters.
    if (sessionId.value !== id || ended.value) {
      resetLocalState(id);
    }
    clientId.value = opts.clientId ?? clientId.value ?? null;
    if (createSent.value) return;
    createSent.value = true;
    beacon("session", {
      sessionId: id,
      clientId: clientId.value,
      clientName: opts.clientName ?? null,
      startedAt: startedAt.value,
    });
  }

  /** Record one Procesar / reanalysis run and its first-pass quality. */
  function recordRun(opts: RecordRunOptions): RunScore | null {
    if (!enabled.value || !sessionId.value || ended.value) return null;
    const rows = opts.rows ?? [];
    if (!rows.length) return null;

    const score = scoreCriticalFields(rows);
    runCount.value += 1;
    const runIndex = runCount.value;
    const isReanalysis = opts.isReanalysis === true || runIndex > 1;

    beacon("run", {
      sessionId: sessionId.value,
      clientId: clientId.value,
      runIndex,
      isReanalysis,
      pagesInRun: score.pagesInRun,
      aiDurationMs:
        opts.aiDurationMs != null ? Math.round(opts.aiDurationMs) : null,
      pagesOk: score.pagesOk,
      pagesWithFailures: score.pagesWithFailures,
      correctnessPct: score.correctnessPct,
      fieldFailures: score.fieldFailures,
      failureReasons: score.failureReasons,
      startedAt: opts.startedAt ?? null,
      finishedAt: opts.finishedAt ?? new Date().toISOString(),
    });

    return score;
  }

  /**
   * Schedule the CSAT modal ~3s after a successful Excel export.
   * Call after `endSession("exported")` so the beacon still targets that
   * session id even if a new extraction session starts immediately.
   */
  function requestCsatAfterExport(): void {
    if (!enabled.value || csatAsked.value) return;
    const id = sessionId.value;
    if (!id) return;
    csatForSessionId.value = id;
    clearCsatTimer();
    csatTimer = setTimeout(() => {
      csatTimer = null;
      if (!csatAsked.value && csatForSessionId.value) {
        csatPending.value = true;
      }
    }, 3000);
  }

  /** Submit the binary CSAT answer for the exported session. */
  function submitCsat(csat: EffectivenessCsat, comment?: string | null): void {
    clearCsatTimer();
    csatPending.value = false;
    csatAsked.value = true;
    const id = csatForSessionId.value ?? sessionId.value;
    csatForSessionId.value = null;
    if (!enabled.value || !id) return;
    beacon("csat", {
      sessionId: id,
      csat,
      comment: comment ?? null,
    });
  }

  /** Dismiss the CSAT prompt without answering (won't nag again this session). */
  function dismissCsat(): void {
    clearCsatTimer();
    csatPending.value = false;
    csatAsked.value = true;
    csatForSessionId.value = null;
  }

  /** Close the session with a terminal outcome. Safe to call more than once. */
  function endSession(status: EffectivenessSessionStatus): void {
    if (!enabled.value || !sessionId.value || ended.value) return;
    if (status === "in_progress") return;
    ended.value = true;
    // Export keeps CSAT open for requestCsatAfterExport(); other endings cancel it.
    if (status !== "exported") {
      clearCsatTimer();
      csatPending.value = false;
      csatForSessionId.value = null;
    }
    beacon("session-end", {
      sessionId: sessionId.value,
      status,
      endedAt: new Date().toISOString(),
    });
  }

  return {
    enabled,
    csatPending,
    startSession,
    recordRun,
    requestCsatAfterExport,
    submitCsat,
    dismissCsat,
    endSession,
  };
};
