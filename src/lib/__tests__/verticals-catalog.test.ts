import {
  isPriceCategoryOffered,
  isValueOffered,
  offeredPriceCategories,
  priceCategoryLabel,
  valueLabel,
} from "@/lib/verticals/catalog";

const CATS = ["פנסיון", "אילוף", "טיפוח", "מוצרים"];

describe("dogs: everything offered, labels unchanged", () => {
  it("price categories", () => {
    expect(offeredPriceCategories("dogs", CATS)).toEqual(CATS);
    for (const c of CATS) expect(priceCategoryLabel("dogs", c)).toBe(c);
  });
  it("stored values", () => {
    for (const v of ["BOARDING", "HEALTH", "TRAINING", "training", "boarding", "grooming"]) {
      expect(isValueOffered("dogs", v)).toBe(true);
      expect(valueLabel("dogs", v, "x")).toBe("x");
    }
    expect(isValueOffered(undefined, "BOARDING")).toBe(true);
  });
});

describe("generic", () => {
  it("drops boarding + grooming, relabels the program category", () => {
    expect(offeredPriceCategories("generic", CATS)).toEqual(["אילוף", "מוצרים"]);
    expect(isPriceCategoryOffered("generic", "פנסיון")).toBe(false);
    expect(priceCategoryLabel("generic", "אילוף")).toBe("מפגשים וחבילות");
    expect(priceCategoryLabel("generic", "מוצרים")).toBe("מוצרים");
  });
  it("drops dog-only task categories / order types, relabels training", () => {
    for (const v of ["BOARDING", "HEALTH", "MEDICATION", "FEEDING", "boarding", "grooming", "service_dog"]) {
      expect(isValueOffered("generic", v)).toBe(false);
    }
    for (const v of ["GENERAL", "LEADS", "TRAINING", "training", "products"]) expect(isValueOffered("generic", v)).toBe(true);
    expect(valueLabel("generic", "TRAINING", "אילוף")).toBe("מפגשים וחבילות");
    expect(valueLabel("generic", "GENERAL", "כללי")).toBe("כללי");
  });
});

describe("getPriceCategories (QA 1/11)", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getPriceCategories, formatCategoryLabel } = require("@/lib/verticals/catalog");
  it("dogs: the four categories, label = value", () => {
    expect(getPriceCategories("dogs")).toEqual([
      { value: "פנסיון", label: "פנסיון" },
      { value: "אילוף", label: "אילוף" },
      { value: "טיפוח", label: "טיפוח" },
      { value: "מוצרים", label: "מוצרים" },
    ]);
    expect(formatCategoryLabel("אילוף", "dogs")).toBe("אילוף");
  });
  it("generic: stored key אילוף reads מפגשים וחבילות, no boarding/grooming", () => {
    expect(getPriceCategories("generic")).toEqual([
      { value: "אילוף", label: "מפגשים וחבילות" },
      { value: "מוצרים", label: "מוצרים" },
    ]);
    expect(formatCategoryLabel("אילוף", "generic")).toBe("מפגשים וחבילות");
  });
});
