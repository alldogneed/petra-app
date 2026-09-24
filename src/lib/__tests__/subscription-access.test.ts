/**
 * Tests for the subscription access window — a business on a Cardcom recurring
 * order keeps paid access for a grace window past subscriptionEndsAt (the
 * Royal Dog lock-out, 2026-09-23), everyone else lapses exactly at endsAt.
 * Pure module, no Prisma mocks needed.
 */

import {
  RECURRING_GRACE_DAYS,
  hasActiveRecurring,
  subscriptionAccessUntil,
  isAwaitingRecurringCharge,
  isSubscriptionLapsed,
} from "@/lib/subscription-access";

const DAY = 86_400_000;
const endsAt = new Date("2026-09-23T07:54:00Z");
const recurring = { subscriptionEndsAt: endsAt, subscriptionStatus: "active", cardcomRecurringId: "20008" };
const oneOff = { subscriptionEndsAt: endsAt, subscriptionStatus: "active", cardcomRecurringId: null };
const at = (ms: number) => new Date(endsAt.getTime() + ms);

describe("recurring billing — grace past endsAt", () => {
  it("still in the period → active, not awaiting", () => {
    expect(isSubscriptionLapsed(recurring, at(-DAY))).toBe(false);
    expect(isAwaitingRecurringCharge(recurring, at(-DAY))).toBe(false);
  });
  it("one day past endsAt → keeps access, awaiting the charge", () => {
    expect(isSubscriptionLapsed(recurring, at(DAY))).toBe(false);
    expect(isAwaitingRecurringCharge(recurring, at(DAY))).toBe(true);
  });
  it("past the grace window → lapsed", () => {
    const after = at((RECURRING_GRACE_DAYS + 1) * DAY);
    expect(isSubscriptionLapsed(recurring, after)).toBe(true);
    expect(isAwaitingRecurringCharge(recurring, after)).toBe(false);
  });
  it("access-until = endsAt + grace", () => {
    expect(subscriptionAccessUntil(recurring)?.getTime()).toBe(endsAt.getTime() + RECURRING_GRACE_DAYS * DAY);
  });
});

describe("no recurring order — lapses at endsAt", () => {
  it("one day past endsAt → lapsed, no grace", () => {
    expect(isSubscriptionLapsed(oneOff, at(DAY))).toBe(true);
    expect(isAwaitingRecurringCharge(oneOff, at(DAY))).toBe(false);
  });
  it("cancel_pending with a leftover recurring id gets no grace", () => {
    const cancelled = { ...recurring, subscriptionStatus: "cancel_pending" };
    expect(hasActiveRecurring(cancelled)).toBe(false);
    expect(isSubscriptionLapsed(cancelled, at(DAY))).toBe(true);
  });
  it("no endsAt (manual grant) never lapses", () => {
    const grant = { subscriptionEndsAt: null, subscriptionStatus: "inactive", cardcomRecurringId: null };
    expect(isSubscriptionLapsed(grant, at(365 * DAY))).toBe(false);
    expect(subscriptionAccessUntil(grant)).toBeNull();
  });
});
