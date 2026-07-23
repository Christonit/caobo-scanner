/**
 * Shared helpers for exporting suplidores to the Carga Masiva .xls template.
 */

export type SuplidorExportRow = {
  documento?: string | null;
  nombre: string;
  tipo_de_factura?: string | null;
};

export function buildSuplidoresExportFilename(clientName?: string | null): string {
  const rawName = (clientName || "cliente").trim() || "cliente";
  const safe = rawName
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    [pad(now.getDate()), pad(now.getMonth() + 1), now.getFullYear()].join("_") +
    `_${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `${safe || "cliente"}-carga_masiva_suplidores-${stamp}.xls`;
}

export async function downloadSuplidoresCargaMasiva(
  apiBase: string,
  rows: SuplidorExportRow[],
  filename: string,
): Promise<void> {
  if (!rows.length) {
    throw new Error("No hay suplidores para exportar.");
  }

  const res = await fetch(`${apiBase}/download-suplidores-carga-masiva`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      rows.map((s) => ({
        documento: s.documento ?? "",
        nombre: s.nombre,
        tipo_de_factura: s.tipo_de_factura ?? "",
      })),
    ),
  });

  if (!res.ok) {
    throw new Error("No se pudo generar la plantilla de suplidores.");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/** Confidence score badge classes (1–3), matching gastos. */
export function getSuplidorScoreClasses(score: number): string {
  if (score === 3) return "bg-emerald-100 text-emerald-700";
  if (score === 2) return "bg-amber-100 text-amber-700";
  if (score === 1) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-slate-600";
}

export function getSuplidorScoreLabel(score: number): string {
  if (score === 3) return "Muy seguro";
  if (score === 2) return "Algo seguro";
  if (score === 1) return "Poco seguro";
  return "Sin score";
}
