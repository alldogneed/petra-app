"use client";

/**
 * Auto-recover from stale-deployment chunk errors.
 *
 * After every deploy, browsers still holding the previous HTML request
 * hashed JS/CSS chunks that no longer exist on the CDN and crash with
 * ChunkLoadError ("קובץ שגיאה" that a hard refresh fixes). Instead of
 * showing the user a broken page, reload once automatically. A
 * sessionStorage timestamp guards against reload loops when the error
 * is anything other than a stale chunk.
 */

import { useEffect } from "react";

const RELOAD_GUARD_KEY = "petra-chunk-reload-at";
const RELOAD_LOOP_WINDOW_MS = 60_000;

function isChunkError(message: unknown): boolean {
  if (typeof message !== "string") return false;
  return (
    message.includes("ChunkLoadError") ||
    message.includes("Loading chunk") ||
    message.includes("Loading CSS chunk") ||
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed")
  );
}

function reloadOnce(): void {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_LOOP_WINDOW_MS) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable — still better to reload than stay broken
  }
  window.location.reload();
}

export default function ChunkErrorReload() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (isChunkError(e.message) || isChunkError((e.error as Error | undefined)?.message)) {
        reloadOnce();
      }
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const message = (e.reason as Error | undefined)?.message ?? String(e.reason ?? "");
      if (isChunkError(message)) reloadOnce();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
