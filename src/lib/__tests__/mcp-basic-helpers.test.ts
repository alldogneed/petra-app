import { orderPaymentStatus, pageWindow, pageHeader, pageNextHint, shiftYmd } from "@/lib/mcp/tools-finance";
import { stayStatusCondition } from "@/services/boarding";
import { mergeClientTags, splitTagInput } from "@/services/clients";

describe("orderPaymentStatus", () => {
  it("classifies paid / partial / unpaid", () => {
    expect(orderPaymentStatus(500, 500)).toBe("paid");
    expect(orderPaymentStatus(500, 600)).toBe("paid");
    expect(orderPaymentStatus(500, 499.995)).toBe("paid");
    expect(orderPaymentStatus(500, 200)).toBe("partial");
    expect(orderPaymentStatus(500, 0)).toBe("unpaid");
    expect(orderPaymentStatus(0, 0)).toBe("paid");
  });
});

describe("paging helpers", () => {
  it("windows and headers", () => {
    const p = pageWindow(57, 20, 20);
    expect(p).toEqual({ start: 20, end: 40, limit: 20 });
    expect(pageHeader(p, 57, "הזמנות")).toBe("מציג 21–40 מתוך 57 הזמנות:");
    expect(pageNextHint(p, 57)).toContain("offset=40");
    const last = pageWindow(57, 40, 20);
    expect(last.end).toBe(57);
    expect(pageNextHint(last, 57)).toBe("");
  });
  it("one page = plain count", () => {
    const p = pageWindow(5, 0, 20);
    expect(pageHeader(p, 5, "שהיות")).toBe("נמצאו 5 שהיות:");
  });
  it("offset past the end", () => {
    const p = pageWindow(5, 10, 20);
    expect(p.end).toBeLessThanOrEqual(p.start);
    expect(pageHeader(p, 5, "x")).toBe("מציג 0 מתוך 5 x:");
  });
  it("shiftYmd crosses months/years", () => {
    expect(shiftYmd("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftYmd("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("stayStatusCondition", () => {
  it("keeps the screen default only when no status was asked", () => {
    expect(stayStatusCondition(undefined, true)).toEqual({ in: ["reserved", "checked_in"] });
    expect(stayStatusCondition(undefined, false)).toBeUndefined();
  });
  it("all / explicit statuses lift the forcing", () => {
    expect(stayStatusCondition("all", true)).toBeUndefined();
    expect(stayStatusCondition("checked_out", true)).toEqual({ in: ["checked_out"] });
    expect(stayStatusCondition(["canceled", "checked_out"], false)).toEqual({ in: ["canceled", "checked_out"] });
  });
  it("drops unknown values", () => {
    expect(stayStatusCondition(["bogus" as never], true)).toBeUndefined();
  });
});

describe("client tag merge", () => {
  it("splits and de-duplicates", () => {
    expect(splitTagInput(" VIP, כלב גדול ,VIP,, ")).toEqual(["VIP", "כלב גדול"]);
    expect(splitTagInput("")).toEqual([]);
  });
  it("returns null when no tag field is given", () => {
    expect(mergeClientTags('["a"]', {})).toBeNull();
  });
  it("replaces, adds and removes", () => {
    expect(mergeClientTags('["a","b"]', { tags: "c,d" })).toEqual(["c", "d"]);
    expect(mergeClientTags('["a","b"]', { tags: "" })).toEqual([]);
    expect(mergeClientTags('["a","b"]', { add_tags: "b,c" })).toEqual(["a", "b", "c"]);
    expect(mergeClientTags('["a","b"]', { remove_tags: "a" })).toEqual(["b"]);
    expect(mergeClientTags("not json", { add_tags: "x" })).toEqual(["x"]);
  });
});
