/**
 * Portal device identity (client-side only).
 *
 * A stable per-browser id, persisted in localStorage, sent with portal logins so
 * the server can enforce the per-student device cap (BrandingSettings.maxDevicesPerStudent).
 *
 * SSR-safe: returns "" when there is no window / no usable localStorage.
 * Private-mode browsers throw on localStorage access — everything is try/catch'd.
 */

const STORAGE_KEY = "petra_portal_device";

/** Must stay in sync with the server-side validation in /api/portal/auth/verify. */
const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

function mintDeviceId(): string {
  try {
    const c = typeof crypto !== "undefined" ? crypto : undefined;
    if (c && typeof c.randomUUID === "function") {
      const id = c.randomUUID().replace(/-/g, "");
      if (DEVICE_ID_RE.test(id)) return id;
    }
    if (c && typeof c.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      c.getRandomValues(bytes);
      const id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      if (DEVICE_ID_RE.test(id)) return id;
    }
  } catch {
    // fall through to the non-crypto fallback below
  }
  // Last-resort fallback — still matches the id shape.
  const fallback = (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  )
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 32);
  return fallback.length >= 8 ? fallback : `dev${fallback}00000000`.slice(0, 32);
}

/**
 * Returns the persisted device id for this browser, creating and storing one if
 * missing or malformed. Returns "" when storage is unavailable (SSR, private mode).
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const store = window.localStorage;
    if (!store) return "";
    const existing = store.getItem(STORAGE_KEY);
    if (existing && DEVICE_ID_RE.test(existing)) return existing;
    const fresh = mintDeviceId();
    store.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return "";
  }
}
