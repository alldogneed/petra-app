/**
 * limit-reached.ts
 * Utility to trigger the global "limit reached" upgrade modal from anywhere in the app.
 * The modal lives in AppShell and listens for this custom event.
 */

export const LIMIT_REACHED_EVENT = "petra:limitReached";

export interface LimitReachedDetail {
  message: string;
}

/** Dispatch the global limit-reached event. Call this when an API returns a limit error. */
export function triggerLimitModal(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<LimitReachedDetail>(LIMIT_REACHED_EVENT, { detail: { message } })
  );
}

/** Returns true if a fetch Response is a limit-reached 403. */
export function isLimitResponse(status: number, code?: string): boolean {
  return status === 403 && code === "LIMIT_REACHED";
}
