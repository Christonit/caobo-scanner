import { serverSupabaseUser, serverSupabaseServiceRole } from "#supabase/server";
import type { Database } from "~/types/database.types";
import { REFERENCE_BUCKET } from "~/server/utils/templateReferences";

// Returns a short-lived signed URL so the browser can preview/download a
// private reference file ("Previsualizar").
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "No autenticado" });
  }

  const { path } = getQuery(event);
  if (!path || typeof path !== "string") {
    throw createError({ statusCode: 400, statusMessage: "Falta el parámetro path" });
  }

  const supabase = serverSupabaseServiceRole<Database>(event);
  const { data, error } = await supabase.storage
    .from(REFERENCE_BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (error || !data) {
    throw createError({
      statusCode: 404,
      statusMessage: "No se pudo generar el enlace del archivo",
    });
  }

  return { url: data.signedUrl };
});
