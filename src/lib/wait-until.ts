/**
 * Run a promise after the HTTP response has been sent, without letting the
 * serverless function freeze before it settles.
 *
 * On Vercel the request context exposes `waitUntil` (this is what
 * `@vercel/functions` reads). Outside Vercel — local dev, tests — there is no
 * such context, so we await the promise instead: slower, but never dropped.
 */
type VercelRequestContext = { waitUntil?: (promise: Promise<unknown>) => void };

export async function runAfterResponse(promise: Promise<unknown>): Promise<void> {
  const safe = promise.catch((err) => console.error("[runAfterResponse]", err));
  const store = (globalThis as Record<symbol, unknown>)[Symbol.for("@vercel/request-context")] as
    | { get?: () => VercelRequestContext | undefined }
    | undefined;
  const waitUntil = store?.get?.()?.waitUntil;
  if (typeof waitUntil === "function") {
    waitUntil(safe);
    return;
  }
  await safe;
}
