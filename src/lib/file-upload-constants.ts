export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_FILE_EXTENSIONS = [
  "pdf", "jpg", "jpeg", "png", "gif", "webp", "heic", "heif",
  "doc", "docx", "xls", "xlsx", "csv", "txt", "rtf",
] as const;

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv", "text/plain", "application/rtf", "text/rtf",
]);
