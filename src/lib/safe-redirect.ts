/**
 * Post-login redirect validation (`/login?next=…`, Google `petra_login_next` cookie).
 *
 * Deliberately tight: the only in-app destination that needs `next` today is the
 * MCP OAuth consent page, so anything that does not start with `/oauth/authorize`
 * is rejected. This rules out open redirects (`//evil.com`, `/\evil.com`,
 * `https://evil.com`, `/%2F%2Fevil.com`, control-char tricks) by construction.
 *
 * Returns the path to navigate to, or null (caller falls back to /dashboard).
 */

const ALLOWED_PREFIX = "/oauth/authorize";
const MAX_LEN = 4096;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

function isUnsafe(path: string): boolean {
  if (!path.startsWith("/")) return true;
  if (path.startsWith("//")) return true;
  if (path.includes("\\")) return true;
  if (CONTROL_CHARS.test(path)) return true;
  return false;
}

export function safeNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const next = raw.trim();
  if (!next || next.length > MAX_LEN) return null;
  if (isUnsafe(next)) return null;

  // Must be exactly the allowed path, or the path followed by a query string.
  // ("/oauth/authorizeXYZ" or "/oauth/authorize/../../x" are rejected.)
  const rest = next.slice(ALLOWED_PREFIX.length);
  if (!next.startsWith(ALLOWED_PREFIX) || (rest !== "" && !rest.startsWith("?"))) return null;

  // One round of decoding must not reveal a dangerous shape either
  // (e.g. "/%2F%2Fevil.com", "/%5Cevil.com", "%0d%0a" header tricks).
  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return null; // malformed percent-encoding
  }
  if (isUnsafe(decoded)) return null;
  const decodedPath = decoded.split("?")[0];
  if (decodedPath !== ALLOWED_PREFIX) return null;

  // Final guard: resolving against a dummy origin must stay on that origin and path.
  try {
    const url = new URL(next, "https://petra.invalid");
    if (url.origin !== "https://petra.invalid" || url.pathname !== ALLOWED_PREFIX) return null;
  } catch {
    return null;
  }

  return next;
}
