import {
  HIDDEN_MODULES,
  VERTICALS,
  VERTICAL_API_PREFIXES,
  VERTICAL_SCREENS,
  apiModule,
  isApiHiddenForVertical,
  isModuleHidden,
  isScreenHiddenForVertical,
  normalizeVertical,
  screenModule,
} from "@/lib/verticals";

describe("normalizeVertical", () => {
  it("keeps the two known values", () => {
    expect(normalizeVertical("dogs")).toBe("dogs");
    expect(normalizeVertical("generic")).toBe("generic");
  });
  it("falls back to dogs (= today's behaviour) for anything else", () => {
    for (const v of [undefined, null, "", "Generic", "horses", 1, {}]) expect(normalizeVertical(v)).toBe("dogs");
  });
  it("lists exactly two verticals", () => {
    expect([...VERTICALS]).toEqual(["dogs", "generic"]);
  });
});

describe("dogs hides nothing (zero behaviour change)", () => {
  it("has no hidden modules", () => {
    expect(HIDDEN_MODULES.dogs).toEqual([]);
  });
  it("never hides a screen or an API", () => {
    for (const s of VERTICAL_SCREENS) {
      expect(isScreenHiddenForVertical("dogs", s.prefix)).toBe(false);
      expect(isScreenHiddenForVertical(undefined, s.prefix + "/x")).toBe(false);
    }
    for (const a of VERTICAL_API_PREFIXES) {
      expect(isApiHiddenForVertical("dogs", a.prefix)).toBe(false);
      expect(isApiHiddenForVertical(null, a.prefix + "/abc")).toBe(false);
    }
    expect(isApiHiddenForVertical("dogs", "/api/customers/abc/pets")).toBe(false);
  });
});

describe("generic hides the dog modules", () => {
  it.each(["boarding", "service_dogs", "pets", "groomer_portfolio"] as const)("hides %s", (m) => {
    expect(isModuleHidden("generic", m)).toBe(true);
  });
  it.each([
    "/boarding", "/boarding/daily", "/feeding", "/medications", "/service-dogs/123", "/pets", "/pets/abc", "/vaccinations",
  ])("hides screen %s", (path) => {
    expect(isScreenHiddenForVertical("generic", path)).toBe(true);
  });
  it.each([
    "/api/boarding", "/api/boarding/rooms", "/api/feeding", "/api/medications/1", "/api/service-dogs/x",
    "/api/service-recipients", "/api/service-recipient-stages", "/api/service-placements/1", "/api/service-compliance",
    "/api/pets", "/api/pets/abc/weight", "/api/customers/abc/pets", "/api/customers/abc/pets/def",
  ])("hides API %s", (path) => {
    expect(isApiHiddenForVertical("generic", path)).toBe(true);
  });
  it.each([
    "/dashboard", "/customers", "/customers/abc", "/calendar", "/training", "/payments", "/leads", "/petsy",
    "/boardingX", "/settings",
  ])("keeps screen %s", (path) => {
    expect(isScreenHiddenForVertical("generic", path)).toBe(false);
  });
  it.each([
    "/api/customers", "/api/customers/abc", "/api/customers/abc/appointments", "/api/appointments", "/api/training-programs",
    "/api/payments", "/api/petsx", "/api/boarding-x", "/api/customers/abc/petsx",
  ])("keeps API %s", (path) => {
    expect(isApiHiddenForVertical("generic", path)).toBe(false);
  });
});

describe("path → module", () => {
  it("matches prefixes on segment boundaries only", () => {
    expect(screenModule("/pets")).toBe("pets");
    expect(screenModule("/petshop")).toBeNull();
    expect(apiModule("/api/feeding/today")).toBe("boarding");
    expect(apiModule("/api/feedingx")).toBeNull();
  });
});
