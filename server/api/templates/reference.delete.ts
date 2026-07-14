import { serverSupabaseUser, serverSupabaseServiceRole } from "#supabase/server";
import type { Database } from "~/types/database.types";
import { REFERENCE_BUCKET } from "~/server/utils/templateReferences";

// Removes a reference file from the private bucket (used when the user clears
// or replaces the reference before saving).
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
  const { error } = await supabase.storage
    .from(REFERENCE_BUCKET)
    .remove([path]);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `No se pudo eliminar el archivo: ${error.message}`,
    });
  }

  return { ok: true };
});
