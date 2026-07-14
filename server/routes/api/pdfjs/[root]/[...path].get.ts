import { createReadStream, existsSync, statSync } from "node:fs";
import { join, normalize } from "node:path";
import { sendStream, setHeader, createError, getRouterParam } from "h3";

const ALLOWED_ROOTS = new Set(["wasm", "cmaps", "standard_fonts"]);

const CONTENT_TYPES: Record<string, string> = {
  ".wasm": "application/wasm",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".bcmap": "application/octet-stream",
  ".pfb": "application/octet-stream",
  ".ttf": "font/ttf",
  ".unicode": "application/octet-stream",
};

/**
 * Serve pdf.js decoder assets from node_modules so client-side PDF rasterization
 * can decode scanned JBIG2/JPEG2000 pages without shipping copies in /public.
 *
 * GET /api/pdfjs/wasm/openjpeg.wasm
 * GET /api/pdfjs/cmaps/Identity-H.bcmap
 * GET /api/pdfjs/standard_fonts/...
 */
export default defineEventHandler((event) => {
  const root = getRouterParam(event, "root") || "";
  const pathParam = getRouterParam(event, "path");
  const assetPath = Array.isArray(pathParam)
    ? pathParam.join("/")
    : pathParam || "";

  if (!ALLOWED_ROOTS.has(root)) {
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }

  // Prevent path traversal.
  const safePath = normalize(assetPath).replace(/^(\.\.(\/|\\|$))+/, "");
  if (!safePath || safePath.includes("..")) {
    throw createError({ statusCode: 400, statusMessage: "Invalid path" });
  }

  const filePath = join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    root,
    safePath,
  );

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    throw createError({ statusCode: 404, statusMessage: "Asset not found" });
  }

  const ext = filePath.slice(filePath.lastIndexOf("."));
  setHeader(
    event,
    "Content-Type",
    CONTENT_TYPES[ext] || "application/octet-stream",
  );
  setHeader(event, "Cache-Control", "public, max-age=31536000, immutable");
  return sendStream(event, createReadStream(filePath));
});
