/**
 * Onboarding analytics event tracker.
 * Emits events to the AnalyticsEvent table and can be extended
 * to push to external providers (Mixpanel, Amplitude, etc.).
 */

export type OnboardingEventType =
  | "onboarding_started"
  | "onboarding_skipped"
  | "onboarding_step_completed"
  | "onboarding_completed"
  | "time_to_first_customer"
  | "time_to_first_booking"
  | "reminders_enabled";

export interface OnboardingEvent {
  type: OnboardingEventType;
  userId: string;
  businessId: string;
  timestamp: string; // ISO string
  metadata?: Record<string, unknown>;
}

/**
 * Client-side: fire-and-forget event tracking.
 * Posts to /api/onboarding/events.
 */
export function trackOnboardingEvent(
  type: OnboardingEventType,
  metadata?: Record<string, unknown>
): void {
  const payload = {
    type,
    timestamp: new Date().toISOString(),
    metadata: metadata ?? {},
  };

  // Fire and forget — don't block UI
  fetch("/api/onboarding/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Silently fail — analytics should never break UX
  });
}

/**
 * Compute seconds elapsed between two ISO timestamps.
 */
export function secondsBetween(startISO: string, endISO: string): number {
  return Math.round(
    (new Date(endISO).getTime() - new Date(startISO).getTime()) / 1000
  );
}
