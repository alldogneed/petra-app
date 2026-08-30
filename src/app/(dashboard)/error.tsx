"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * A failed JS/CSS chunk load means this tab is running HTML from a previous
 * deployment. React catches it here, so the window-level listener in
 * ChunkErrorReload never sees it — this boundary must self-heal.
 */
const CHUNK_ERROR_PATTERNS = [
  "ChunkLoadError",
  "Loading chunk",
  "Loading CSS chunk",
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "error loading dynamically imported module",
];

function isChunkError(error: Error): boolean {
  const haystack = `${error.name} ${error.message}`.toLowerCase();
  return CHUNK_ERROR_PATTERNS.some((p) => haystack.includes(p.toLowerCase()));
}

const RELOAD_GUARD_KEY = "petra-boundary-reload-at";
const RELOAD_LOOP_WINDOW_MS = 60_000;

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [recovering, setRecovering] = useState(false);

  // Stale-deployment chunk errors: reload once to pull fresh HTML instead of
  // showing the user an error they can only fix with a hard refresh.
  useEffect(() => {
    if (!isChunkError(error)) return;
    try {
      const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
      if (Date.now() - last < RELOAD_LOOP_WINDOW_MS) return;
      sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    } catch {
      // sessionStorage unavailable — reloading is still better than a dead page
    }
    setRecovering(true);
    window.location.reload();
  }, [error]);

  // Report to Sentry so recurrences are diagnosable instead of guesswork
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "dashboard", chunkError: String(isChunkError(error)) },
      extra: { digest: error.digest, path: typeof window !== "undefined" ? window.location.pathname : null },
    });
  }, [error]);

  useEffect(() => {
    console.error("[DashboardError] name:", error.name);
    console.error("[DashboardError] message:", error.message);
    console.error("[DashboardError] stack:", error.stack);
    console.error("[DashboardError] digest:", error.digest);
    console.error("[DashboardError] full error:", error);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  if (recovering) {
    return (
      <div dir="rtl" className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 mx-auto rounded-full border-2 border-slate-200 border-t-brand-500 animate-spin" />
          <p className="text-sm text-slate-500">מעדכן לגרסה החדשה...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="flex items-center justify-center min-h-[60vh] p-6"
    >
      <div className="text-center space-y-4 max-w-lg">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-xl font-bold text-slate-800">אירעה שגיאה</h2>
        <p className="text-slate-500 text-sm">משהו השתבש בטעינת הדף. אנא נסה שוב.</p>
        {error.digest && (
          <p className="text-xs text-slate-400">קוד שגיאה: {error.digest}</p>
        )}
        {isDev && (
          <div className="text-right bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-1 break-all">
            {error.name && <p><strong>Type:</strong> {error.name}</p>}
            {error.message && <p><strong>Message:</strong> {error.message}</p>}
            {error.stack && <p className="whitespace-pre-wrap font-mono text-[10px]">{error.stack.slice(0, 600)}</p>}
          </div>
        )}
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-primary">
            נסה שוב
          </button>
          <a
            href="/dashboard"
            className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
          >
            לדף הבית
          </a>
        </div>
      </div>
    </div>
  );
}
