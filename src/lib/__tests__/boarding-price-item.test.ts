import { pickBoardingPriceItem, dogCountInName } from "@/lib/boarding-price-item";

const giva = [
  { id: "a", name: "דיי קר ", category: "פנסיון", unit: "per_day" },
  { id: "b", name: "דייקר לקוח קבוע", category: "פנסיון", unit: "per_day" },
  { id: "c", name: "יום הרגלה", category: "פנסיון", unit: "per_session" },
  { id: "d", name: "פנסיון 1 כלב", category: "פנסיון", unit: "per_session" },
  { id: "e", name: "פנסיון 2 כלבים", category: "פנסיון", unit: "per_session" },
  { id: "f", name: "פנסיון 3 כלבים", category: "פנסיון", unit: "per_session" },
  { id: "g", name: "שיעור אילוף בפנסיון", category: "אילוף", unit: "per_session" },
];

describe("pickBoardingPriceItem", () => {
  it("picks by dog count, never day care", () => {
    expect(pickBoardingPriceItem(giva, 1)?.id).toBe("d");
    expect(pickBoardingPriceItem(giva, 2)?.id).toBe("e");
    expect(pickBoardingPriceItem(giva, 3)?.id).toBe("f");
    expect(pickBoardingPriceItem(giva, 5)?.id).toBe("f");
  });
  it("falls back to per_night, then non-day-care per_day", () => {
    expect(pickBoardingPriceItem([{ id: "x", name: "לינה", category: "פנסיון", unit: "per_night" }, giva[0]], 2)?.id).toBe("x");
    expect(pickBoardingPriceItem([giva[0], { id: "y", name: "פנסיון יומי", category: "פנסיון", unit: "per_day" }], 1)?.id).toBe("y");
  });
  it("skips inactive items", () => {
    expect(pickBoardingPriceItem([{ ...giva[3], isActive: false }, giva[4]], 1)?.id).toBe("e");
  });
  it("reads Hebrew number words", () => {
    expect(dogCountInName("פנסיון כלב אחד")).toBe(1);
    expect(dogCountInName("שני כלבים")).toBe(2);
    expect(dogCountInName("פנסיון")).toBeNull();
  });
});
