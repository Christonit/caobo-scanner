// Shared constants for the template reference-file storage bucket. The bucket
// is private and has no RLS policies, so every object operation must go
// through the service-role key on the server (never the browser).
export const REFERENCE_BUCKET = "caobo-template-references";

// Reference files are limited to spreadsheets the extractor understands.
export const ALLOWED_REFERENCE_EXTENSIONS = ["csv", "xls", "xlsx"] as const;

export const ALLOWED_REFERENCE_MIME_TYPES = [
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream", // some browsers send this for .xls/.xlsx
] as const;

export const MAX_REFERENCE_FILE_BYTES = 10 * 1024 * 1024; // 10 MB (bucket limit)

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx + 1).toLowerCase();
}

export function isAllowedReference(filename: string): boolean {
  return (ALLOWED_REFERENCE_EXTENSIONS as readonly string[]).includes(
    getExtension(filename)
  );
}
