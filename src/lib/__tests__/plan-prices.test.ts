import { PLAN_PRICES, planPrice, planPriceCurrency, hasOnlineCheckout } from "../plan-prices";

describe("plan-prices", () => {
  it("keeps the Israeli prices unchanged", () => {
    expect(planPrice("basic", "ILS")).toBe(99);
    expect(planPrice("pro", "ILS")).toBe(199);
    expect(planPrice("service_dog", "ILS")).toBe(229);
    expect(planPrice("basic", null)).toBe(99); // business without a currency = ILS, as before
  });

  it("quotes USD for every other currency (Or 01.11.2026: Basic $29, Pro $39)", () => {
    expect(planPrice("basic", "USD")).toBe(29);
    expect(planPrice("pro", "USD")).toBe(39);
    expect(planPrice("free", "USD")).toBe(0);
    expect(planPriceCurrency("EUR")).toBe("USD");
    expect(planPrice("groomer", "USD")).toBeNull();
    expect(planPrice("service_dog", "usd")).toBeNull();
  });

  it("online checkout (Cardcom) only for ILS", () => {
    expect(hasOnlineCheckout("ILS")).toBe(true);
    expect(hasOnlineCheckout(undefined)).toBe(true);
    expect(hasOnlineCheckout("USD")).toBe(false);
  });

  it("matches the legacy ILS price tables", () => {
    // TIERS (constants.ts) / TIER_DISPLAY (feature-flags.ts) still carry the ILS numbers
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getTierDisplay } = require("../feature-flags");
    for (const tier of Object.keys(PLAN_PRICES.ILS)) {
      expect(getTierDisplay(tier).price).toBe(PLAN_PRICES.ILS[tier as keyof typeof PLAN_PRICES.ILS]);
    }
  });
});
