import { randomUUID } from "node:crypto";
import { serverSupabaseUser, serverSupabaseServiceRole } from "#supabase/server";
import type { Database } from "~/types/database.types";
import {
  REFERENCE_BUCKET,
  MAX_REFERENCE_FILE_BYTES,
  isAllowedReference,
  getExtension,
} from "~/server/utils/templateReferences";

// Uploads a template reference spreadsheet (.csv/.xls/.xlsx) to the private
// references bucket and returns the stored object path. The browser later
// persists this path on the template row.
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "No autenticado" });
  }

  const form = await readMultipartFormData(event);
  const file = form?.find((p) => p.name === "file" && p.filename);
  if (!file || !file.filename) {
    throw createError({
      statusCode: 400,
      statusMessage: "No se recibió ningún archivo",
    });
  }

  if (!isAllowedReference(file.filename)) {
    throw createError({
      statusCode: 415,
      statusMessage: "Solo se permiten archivos CSV, XLS o XLSX",
    });
  }

  if (file.data.byteLength > MAX_REFERENCE_FILE_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: "El archivo supera el límite de 10 MB",
    });
  }

  const ext = getExtension(file.filename);
  const path = `${randomUUID()}.${ext}`;

  const supabase = serverSupabaseServiceRole<Database>(event);
  const { error } = await supabase.storage
    .from(REFERENCE_BUCKET)
    .upload(path, file.data, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `No se pudo subir el archivo: ${error.message}`,
    });
  }

  return { path, name: file.filename };
});
