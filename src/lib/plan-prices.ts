/**
 * Plan prices per pricing currency — the ONE place a subscription price is shown from.
 * Client-safe (no server imports).
 *
 * - ILS (Israel, Cardcom): the existing prices, unchanged.
 * - USD (every other business currency, Or 01.11.2026): Basic $29 / Pro $39 per month.
 *   Legacy tiers (Groomer+, Service Dog) are not sold in USD → null (no price shown).
 * Online checkout (/checkout) is Cardcom in ILS only until Stripe (Phase 6) — a USD
 * business upgrades through sales (WhatsApp) meanwhile. Decision D-021.
 */
import type { TierKey } from "./feature-flags";

export type PlanPriceCurrency = "ILS" | "USD";

export const PLAN_PRICES: Record<PlanPriceCurrency, Record<TierKey, number | null>> = {
  ILS: { free: 0, basic: 99, pro: 199, groomer: 169, groomer_plus: 169, service_dog: 229 },
  USD: { free: 0, basic: 29, pro: 39, groomer: null, groomer_plus: null, service_dog: null },
};

/** Business currency → the currency its plan prices are quoted in (missing = ILS, as before). */
export function planPriceCurrency(currency?: string | null): PlanPriceCurrency {
  return !currency || currency.toUpperCase() === "ILS" ? "ILS" : "USD";
}

/** Monthly price of a tier for a business currency; null = not sold in that currency. */
export function planPrice(tier: TierKey, currency?: string | null): number | null {
  return PLAN_PRICES[planPriceCurrency(currency)][tier] ?? null;
}

/** Can this business pay online at /checkout (Cardcom, ILS)? */
export function hasOnlineCheckout(currency?: string | null): boolean {
  return planPriceCurrency(currency) === "ILS";
}
