/**
 * Subscription access window — single source of truth for "is this paid
 * subscription still usable right now?".
 *
 * A business billed by a Cardcom recurring order (הוראת קבע) is charged by
 * Cardcom on its own schedule, and renew-subscriptions only extends
 * `subscriptionEndsAt` once it sees that charge in the transaction feed. Until
 * then the period has technically "ended" — but the customer is paying and
 * must keep full access, and must NOT be told to renew (a manual renewal on
 * top of the recurring order charges them twice).
 *
 * expire-subscriptions downgrades such a business only after the same grace
 * window, so UI access, banners and the downgrade cron all agree.
 */

export const RECURRING_GRACE_DAYS = 7;

export interface SubscriptionAccessInput {
  subscriptionEndsAt: Date | null;
  subscriptionStatus: string | null;
  cardcomRecurringId: string | null;
}

/** Billed automatically by an active Cardcom recurring order. */
export function hasActiveRecurring(b: SubscriptionAccessInput): boolean {
  return b.subscriptionStatus === "active" && !!b.cardcomRecurringId;
}

/** Last moment paid access is honoured (endsAt + grace for recurring billing). */
export function subscriptionAccessUntil(b: SubscriptionAccessInput): Date | null {
  if (!b.subscriptionEndsAt) return null;
  if (!hasActiveRecurring(b)) return b.subscriptionEndsAt;
  return new Date(b.subscriptionEndsAt.getTime() + RECURRING_GRACE_DAYS * 86_400_000);
}

/** Period ended, but a recurring charge is still expected — keep access, no renew prompt. */
export function isAwaitingRecurringCharge(b: SubscriptionAccessInput, now: Date = new Date()): boolean {
  const until = subscriptionAccessUntil(b);
  return (
    hasActiveRecurring(b) &&
    !!b.subscriptionEndsAt &&
    b.subscriptionEndsAt <= now &&
    !!until &&
    until > now
  );
}

/** Paid access is over (grace included) — effective tier drops to free. */
export function isSubscriptionLapsed(b: SubscriptionAccessInput, now: Date = new Date()): boolean {
  const until = subscriptionAccessUntil(b);
  return !!until && until < now;
}
