/**
 * Server-side tier gate — must match the client's usePlan().can():
 * lapsed subscription → free, featureOverrides win over the tier default.
 */
import { planHasFeature, type BusinessPlanRow } from "@/lib/feature-gate";

const NOW = new Date("2026-10-02T10:00:00Z");
const row = (p: Partial<BusinessPlanRow>): BusinessPlanRow => ({
  tier: "basic", featureOverrides: null, subscriptionEndsAt: null, subscriptionStatus: null, cardcomRecurringId: null, ...p,
});

describe("planHasFeature(analytics)", () => {
  it("free tier is locked, paid tiers are open", () => {
    expect(planHasFeature(row({ tier: "free" }), "analytics", NOW)).toBe(false);
    expect(planHasFeature(row({ tier: "basic" }), "analytics", NOW)).toBe(true);
    expect(planHasFeature(row({ tier: "pro" }), "analytics", NOW)).toBe(true);
  });
  it("missing business / null tier is locked", () => {
    expect(planHasFeature(null, "analytics", NOW)).toBe(false);
    expect(planHasFeature(row({ tier: null }), "analytics", NOW)).toBe(false);
  });
  it("lapsed subscription drops to free", () => {
    expect(planHasFeature(row({ tier: "pro", subscriptionEndsAt: new Date("2026-09-01T00:00:00Z") }), "analytics", NOW)).toBe(false);
    expect(planHasFeature(row({ tier: "pro", subscriptionEndsAt: new Date("2026-11-01T00:00:00Z") }), "analytics", NOW)).toBe(true);
  });
  it("overrides win (object or JSON string)", () => {
    expect(planHasFeature(row({ tier: "free", featureOverrides: { analytics: true } }), "analytics", NOW)).toBe(true);
    expect(planHasFeature(row({ tier: "pro", featureOverrides: '{"analytics":false}' }), "analytics", NOW)).toBe(false);
    expect(planHasFeature(row({ tier: "free", featureOverrides: "not json" }), "analytics", NOW)).toBe(false);
  });
});
