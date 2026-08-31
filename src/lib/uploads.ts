import path from "node:path";

/**
 * Admin uploads are stored OUTSIDE public/ and served by
 * src/app/uploads/[...path]/route.ts.
 *
 * Why: `next start` snapshots the contents of public/ once, when the server
 * boots. A file written into public/uploads at runtime is not in that snapshot,
 * so it 404s (broken image in the admin and on the site) until the process is
 * restarted — which is what broke image uploads. Serving through a route
 * handler reads the file from disk on every request, so an upload is visible
 * immediately, in dev and in production.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "var", "uploads");

/**
 * Uploads written before the move (and any Docker volume still mounted at
 * /app/public/uploads) live here. The serve route falls back to it so old
 * /uploads/… URLs already stored on products keep resolving.
 */
export const LEGACY_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

/** Public URL prefix — unchanged by the move, so stored URLs stay valid. */
export const UPLOAD_URL_PREFIX = "/uploads";

/** Accepted upload types → the extension we store the file under. */
export const UPLOAD_EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
};

/** Extension → Content-Type for the serve route. */
export const UPLOAD_CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

/**
 * Join request path segments onto `directory`, returning null if the result
 * escapes it (`..`, absolute segments, encoded separators) or has an extension
 * we do not serve.
 */
export function resolveUploadPath(directory: string, segments: string[]): string | null {
  if (segments.length === 0) return null;
  const decoded: string[] = [];
  for (const segment of segments) {
    let value: string;
    try {
      value = decodeURIComponent(segment);
    } catch {
      return null;
    }
    if (!value || value === "." || value === ".." || value.includes("/") || value.includes("\\")) {
      return null;
    }
    decoded.push(value);
  }

  const target = path.resolve(directory, ...decoded);
  const root = path.resolve(directory);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  if (!(path.extname(target).toLowerCase() in UPLOAD_CONTENT_TYPE_BY_EXTENSION)) return null;
  return target;
}
