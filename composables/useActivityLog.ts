import type { ActivityAction } from "~/types/database.types";

// Human-readable labels for each tracked action (used by the /activity view).
export const ACTIVITY_ACTION_LABELS: Record<ActivityAction, string> = {
  client_created: "Creó un cliente",
  client_updated: "Actualizó un cliente",
  document_added: "Agregó un documento",
  document_updated: "Editó un documento",
  document_removed: "Eliminó un documento",
  annotation_added: "Agregó una anotación",
  annotation_updated: "Editó una anotación",
  annotation_removed: "Eliminó una anotación",
  suplidor_added: "Agregó un suplidor",
  suplidor_updated: "Editó un suplidor",
  suplidor_removed: "Eliminó un suplidor",
  gastos_analyzed: "Procesó gastos con IA",
  gastos_exported: "Exportó gastos",
  suplidores_analyzed: "Analizó suplidores con IA",
  suplidores_stored: "Guardó suplidores",
  suplidores_exported: "Exportó plantilla de suplidores",
  rows_deferred: "Movió filas para revisar más tarde",
  export_rated: "Calificó una exportación",
};

export interface ActivityLogOptions {
  /** Client the action relates to (validated server-side against the org). */
  clientId?: string | null;
  /** Short human label captured at write time (e.g. client name). */
  targetLabel?: string | null;
  /**
   * Action-specific details: { pages, count, is_rescan, rating, session_id, ... }.
   * Extraction events should include session_id so analyze/export/defer/rescans
   * can be grouped as one workflow.
   */
  metadata?: Record<string, unknown>;
}

/** Mint a new extraction workflow id (gastos / suplidores). */
export function createActivitySessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Fire-and-forget activity logger. Uses navigator.sendBeacon so telemetry
// never shows up in the fetch/XHR network tab and survives page unload. Only
// call this on *successful* actions.
export const useActivityLog = () => {
  const { activeOrg } = useOrganization();

  function log(action: ActivityAction, opts: ActivityLogOptions = {}): void {
    // Client-only: sendBeacon and the auth cookie live in the browser.
    if (!import.meta.client) return;

    const organizationId = activeOrg.value?.id;
    if (!organizationId) return;

    const payload = {
      organizationId,
      action,
      clientId: opts.clientId ?? null,
      targetLabel: opts.targetLabel ?? null,
      metadata: opts.metadata ?? {},
    };

    const url = "/api/activity/log";

    try {
      const body = JSON.stringify(payload);

      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        // sendBeacon returns false if the payload was rejected (too large /
        // queue full); fall back to keepalive fetch in that case.
        if (navigator.sendBeacon(url, blob)) return;
      }

      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        /* telemetry is best-effort — never surface errors to the user */
      });
    } catch {
      /* never let logging break a user flow */
    }
  }

  return { log };
};
