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

function resolveAsset(root: string, safePath: string): string | null {
  const candidates = [
    // Production build output (Docker only ships .output).
    join(process.cwd(), ".output/public/api/pdfjs", root, safePath),
    // Local public/ copy if present.
    join(process.cwd(), "public/api/pdfjs", root, safePath),
    // Dev / full installs: read straight from the package.
    join(process.cwd(), "node_modules/pdfjs-dist", root, safePath),
  ];
  for (const filePath of candidates) {
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      return filePath;
    }
  }
  return null;
}

/**
 * Serve pdf.js decoder assets so client-side PDF rasterization can decode
 * scanned JBIG2/JPEG2000 pages.
 *
 * GET /api/pdfjs/wasm/jbig2.wasm
 * GET /api/pdfjs/cmaps/...
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

  const filePath = resolveAsset(root, safePath);
  if (!filePath) {
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
