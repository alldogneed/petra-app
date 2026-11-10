/**
 * Direct browser → Vercel Blob uploads (client-safe, pure).
 *
 * Vercel functions reject request bodies over 4.5MB (413 FUNCTION_PAYLOAD_TOO_LARGE)
 * before our code runs, so a file sent through an API route could never reach the
 * advertised 10MB limit (support ticket, סימבה כלבי שירות, 10/11/2026). Large files go
 * straight to Blob with a short-lived token from `handleUpload`; the route then only
 * records the URL — after checking it points into OUR store under the expected folder.
 */
import { ALLOWED_FILE_EXTENSIONS, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "@/lib/file-upload-constants";

/** Above this, the old form-data route would hit Vercel's body limit. */
export const SERVERLESS_BODY_LIMIT = 4.5 * 1024 * 1024;

export function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function isAllowedUploadExtension(ext: string): boolean {
  return (ALLOWED_FILE_EXTENSIONS as readonly string[]).includes(ext);
}

/** Problem with a file before uploading, in Hebrew; null = OK. */
export function uploadFileProblem(file: { name: string; size: number }): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `קובץ גדול מדי – מקסימום 10MB (קובץ זה: ${(file.size / 1024 / 1024).toFixed(1)}MB)`;
  }
  if (!isAllowedUploadExtension(fileExtension(file.name))) return "סוג קובץ לא מורשה";
  return null;
}

/**
 * The URL a client says it uploaded must be in a Vercel Blob public store and under
 * `folder/` (e.g. "service-dogs/<dogId>/"). Returns the pathname or null.
 */
export function ownBlobPath(url: unknown, folder: string): string | null {
  if (typeof url !== "string" || url.length > 600) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== "https:") return null;
  if (!u.hostname.endsWith(".public.blob.vercel-storage.com")) return null;
  const path = decodeURIComponent(u.pathname.replace(/^\/+/, ""));
  if (!path.startsWith(folder) || path.includes("..")) return null;
  if (!isAllowedUploadExtension(fileExtension(path))) return null;
  return path;
}

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", heic: "image/heic", heif: "image/heif", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv", txt: "text/plain", rtf: "application/rtf",
};

/** The browser's type when it is one we accept, else derived from the extension (some
 *  systems give PDFs an empty / odd type, which Blob's allowedContentTypes would reject). */
export function uploadContentType(file: { name: string; type: string }): string | undefined {
  if (file.type && ALLOWED_MIME_TYPES.has(file.type)) return file.type;
  return EXT_MIME[fileExtension(file.name)];
}

/** Hebrew text for a failed direct upload (the Blob client throws English messages). */
export function directUploadErrorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (!msg || msg.startsWith("Vercel Blob") || /fetch|network/i.test(msg)) {
    return "ההעלאה נכשלה. בדקו שהקובץ עד 10MB ומסוג PDF, תמונה, Word או Excel, ונסו שוב.";
  }
  return msg;
}

export const DIRECT_UPLOAD_CONTENT_TYPES = Array.from(ALLOWED_MIME_TYPES);
export { MAX_FILE_SIZE };
