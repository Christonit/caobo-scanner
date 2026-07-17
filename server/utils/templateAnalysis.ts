import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { getExtension } from "~/server/utils/templateReferences";

// SheetJS is loaded at runtime via createRequire instead of a static import.
// Its CJS entry (`xlsx.js`) performs a lazy `require("stream")`, which throws
// "Dynamic require ... is not supported" when the package gets inlined into
// the server's ESM bundle. createRequire keeps it external so Node loads it
// natively, where the dynamic require works fine.
//
// Do NOT base createRequire on import.meta.url: Nitro rewrites it to
// file:///_entry.js, which makes Node look for modules next to `/` and crash
// with MODULE_NOT_FOUND in production. Resolve from a real package.json path
// instead (Nitro output in prod, project root in dev).
function requireSheetJs(): typeof import("xlsx") {
  const candidates = [
    join(process.cwd(), ".output/server/package.json"),
    join(process.cwd(), "package.json"),
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      return createRequire(candidate)("xlsx") as typeof import("xlsx");
    } catch {
      // Try the next candidate (e.g. stale .output after uninstall).
    }
  }
  throw new Error(
    'Cannot find module "xlsx". Run npm install, then rebuild if deploying.',
  );
}
const XLSX = requireSheetJs();

// Result of analyzing a reference spreadsheet with Gemini. Mirrors what the
// "Crear plantilla" form needs to populate its columns + summary sidebar.
export interface TemplateAnalysisResult {
  /** Suggested extraction columns derived from the reference file. */
  columns: { name: string; description: string }[];
  /** Usage instructions, written in the same language as the description. */
  instructions: string[];
  /** A short description of what the template is for (AI-generated). */
  summary: string;
}

// How many sample data rows we feed the model alongside the headers. Headers
// drive the column extraction; a handful of rows give the model context about
// the kind of data each column holds without blowing up the prompt.
const MAX_SAMPLE_ROWS = 15;
// Cap the number of sheets we describe so a huge workbook can't blow the
// prompt budget.
const MAX_SHEETS = 5;

/**
 * Turn a reference spreadsheet (csv/xls/xlsx) into a compact text snapshot the
 * model can reason about: one block per sheet with its name plus a CSV preview
 * of the header row and a few data rows.
 */
export function spreadsheetToText(data: Uint8Array, filename: string): string {
  const ext = getExtension(filename);
  const wb = XLSX.read(data, {
    type: "array",
    // CSV is read as a single sheet; xls/xlsx keep their sheet structure.
    raw: false,
  });

  const sheetNames = wb.SheetNames.slice(0, MAX_SHEETS);
  const blocks: string[] = [];

  for (const sheetName of sheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
    });
    if (rows.length === 0) continue;

    const preview = rows.slice(0, MAX_SAMPLE_ROWS + 1);
    const csv = preview
      .map((row) =>
        (row as unknown[])
          .map((cell) => String(cell ?? "").replace(/\s+/g, " ").trim())
          .join(" | ")
      )
      .join("\n");

    const label = ext === "csv" ? "Datos" : `Hoja: ${sheetName}`;
    blocks.push(`### ${label}\n${csv}`);
  }

  return blocks.join("\n\n").trim();
}

function buildPrompt(
  name: string,
  description: string,
  sheetText: string
): string {
  return [
    "Eres un asistente que analiza una plantilla de hoja de cálculo (Excel/CSV)",
    "que un contador usará para exportar datos extraídos de facturas y recibos.",
    "",
    "A partir del archivo de referencia y la descripción del usuario debes:",
    "1. Identificar las COLUMNAS que la plantilla espera (normalmente la fila de",
    "   encabezados). Para cada columna devuelve un nombre corto y una",
    "   descripción de qué dato debe extraer el modelo para esa columna.",
    "2. Redactar un conjunto de INSTRUCCIONES de uso claras y accionables para",
    "   ayudar a llenar correctamente la plantilla.",
    "3. Escribir un RESUMEN breve de para qué sirve esta plantilla.",
    "",
    "MUY IMPORTANTE: detecta el idioma de la DESCRIPCIÓN del usuario y redacta",
    "tanto las instrucciones como el resumen EN ESE MISMO IDIOMA. Los nombres de",
    "las columnas deben respetar los encabezados reales del archivo.",
    "",
    `Nombre de la plantilla: ${name}`,
    `Descripción del usuario: ${description}`,
    "",
    "Contenido del archivo de referencia:",
    sheetText || "(el archivo no contenía datos legibles)",
  ].join("\n");
}

// JSON schema we ask Gemini to conform to, so the response is reliably
// parseable without markdown fences or prose.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    columns: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["name", "description"],
      },
    },
    instructions: {
      type: "array",
      items: { type: "string" },
    },
    summary: { type: "string" },
  },
  required: ["columns", "instructions", "summary"],
};

/**
 * Calls the Gemini generateContent REST API and returns the structured
 * analysis. Throws a descriptive Error on failure (caller maps it to an HTTP
 * error).
 */
export async function analyzeWithGemini(opts: {
  apiKey: string;
  model: string;
  name: string;
  description: string;
  sheetText: string;
}): Promise<TemplateAnalysisResult> {
  const { apiKey, model, name, description, sheetText } = opts;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: buildPrompt(name, description, sheetText) }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  };

  let response: any;
  try {
    response = await $fetch<any>(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: payload,
    });
  } catch (err: any) {
    const detail =
      err?.data?.error?.message || err?.message || "Error desconocido";
    throw new Error(`Gemini API error: ${detail}`);
  }

  const text: string | undefined =
    response?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text ?? "")
      .join("") || undefined;

  if (!text) {
    throw new Error("Gemini devolvió una respuesta vacía.");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(stripFences(text));
  } catch {
    throw new Error("No se pudo interpretar la respuesta del modelo.");
  }

  return normalizeResult(parsed);
}

function stripFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```json")) t = t.slice(7);
  else if (t.startsWith("```")) t = t.slice(3);
  if (t.endsWith("```")) t = t.slice(0, -3);
  return t.trim();
}

function normalizeResult(parsed: any): TemplateAnalysisResult {
  const columns = Array.isArray(parsed?.columns)
    ? parsed.columns
        .map((c: any) => ({
          name: String(c?.name ?? "").trim(),
          description: String(c?.description ?? "").trim(),
        }))
        .filter((c: { name: string }) => c.name.length > 0)
    : [];

  const instructions = Array.isArray(parsed?.instructions)
    ? parsed.instructions
        .map((i: any) => String(i ?? "").trim())
        .filter((i: string) => i.length > 0)
    : [];

  const summary = String(parsed?.summary ?? "").trim();

  return { columns, instructions, summary };
}
