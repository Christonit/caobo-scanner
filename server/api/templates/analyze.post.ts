import { serverSupabaseUser, serverSupabaseServiceRole } from "#supabase/server";
import type { Database } from "~/types/database.types";
import { REFERENCE_BUCKET } from "~/server/utils/templateReferences";
import {
  spreadsheetToText,
  analyzeWithGemini,
} from "~/server/utils/templateAnalysis";

// Analyzes an uploaded reference spreadsheet with Google Gemini and returns
// the suggested columns, usage instructions (in the description's language)
// and a short summary. The model defaults to TEMPLATE_ANALYSIS_MODEL.
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "No autenticado" });
  }

  const body = await readBody<{
    path?: string;
    name?: string;
    description?: string;
  }>(event);

  const path = body?.path?.trim();
  const name = body?.name?.trim();
  const description = body?.description?.trim();

  if (!path) {
    throw createError({
      statusCode: 400,
      statusMessage: "Falta el archivo de referencia.",
    });
  }
  if (!name) {
    throw createError({
      statusCode: 400,
      statusMessage: "Falta el nombre de la plantilla.",
    });
  }
  if (!description) {
    throw createError({
      statusCode: 400,
      statusMessage: "Falta la descripción de la plantilla.",
    });
  }

  const config = useRuntimeConfig(event);
  const apiKey = config.geminiApiKey as string;
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "Falta configurar GEMINI_API_KEY en el servidor para el análisis.",
    });
  }
  const model = (config.templateAnalysisModel as string) || "gemini-2.5-flash";

  // Pull the reference file out of the private bucket using the service role.
  const supabase = serverSupabaseServiceRole<Database>(event);
  const { data: file, error } = await supabase.storage
    .from(REFERENCE_BUCKET)
    .download(path);

  if (error || !file) {
    throw createError({
      statusCode: 404,
      statusMessage: "No se pudo leer el archivo de referencia.",
    });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  let sheetText: string;
  try {
    sheetText = spreadsheetToText(bytes, path);
  } catch (err: any) {
    console.error("[templates/analyze] no se pudo parsear el archivo:", err);
    throw createError({
      statusCode: 422,
      statusMessage: `No se pudo leer el contenido del archivo de referencia: ${
        err?.message ?? "error desconocido"
      }`,
    });
  }

  try {
    const result = await analyzeWithGemini({
      apiKey,
      model,
      name,
      description,
      sheetText,
    });
    return { ...result, model };
  } catch (err: any) {
    throw createError({
      statusCode: 502,
      statusMessage: err?.message || "El análisis con IA falló.",
    });
  }
});
