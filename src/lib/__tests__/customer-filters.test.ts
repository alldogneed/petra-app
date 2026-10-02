/**
 * Customers list filter contract — param parsing, phone search, exact tags, status rules, sorting.
 */
import {
  parseCustomerFilters, customerFiltersToParams, countActiveFilters,
  normalizePhoneSearch, normalizeStoredPhone, samePhone, escapeLike, tagLikePattern,
  parseTagList, hasVipTag, hasExactTag, applyTagChange,
  isCustomerActive, displayStatus, matchesLastVisit, matchesBalance,
  sortCustomerRows, nameBucket, parseOffsetCursor, personalizeMessage,
} from "@/lib/customer-filters";

const DAY = 24 * 60 * 60 * 1000;
const today = new Date("2026-10-02T00:00:00.000Z"); // Appointment.date encoding (UTC midnight of IL date)
const now = new Date("2026-10-02T09:00:00.000Z");
const daysAgo = (n: number) => new Date(today.getTime() - n * DAY);

describe("parseCustomerFilters", () => {
  it("keeps valid values and drops junk", () => {
    const f = parseCustomerFilters(new URLSearchParams({
      status: "active", balance: "debt", lastVisit: "60", species: "cat", source: "google",
      createdFrom: "2026-01-01", createdTo: "2026-02-30", minDebt: "100", sortBy: "balance_desc",
      tag: "  קבוע ", search: "x".repeat(300), serviceType: "training",
    }));
    expect(f.status).toBe("active");
    expect(f.balance).toBe("debt");
    expect(f.lastVisit).toBe("60");
    expect(f.species).toBe("cat");
    expect(f.source).toBe("google");
    expect(f.createdFrom).toBe("2026-01-01");
    expect(f.createdTo).toBeNull(); // invalid date
    expect(f.minDebt).toBe(100);
    expect(f.sortBy).toBe("balance_desc");
    expect(f.tag).toBe("קבוע");
    expect(f.search).toHaveLength(100);
    expect(f.serviceType).toBe("training");
  });
  it("rejects values outside allowlists", () => {
    const f = parseCustomerFilters({ status: "vipx", sortBy: "DROP", species: "fish", source: "a b'", minDebt: "-5", lastVisit: "7" });
    expect(f.status).toBeNull();
    expect(f.sortBy).toBe("newest");
    expect(f.species).toBeNull();
    expect(f.source).toBeNull();
    expect(f.minDebt).toBeNull();
    expect(f.lastVisit).toBeNull();
  });
  it("swaps a reversed date range", () => {
    const f = parseCustomerFilters({ createdFrom: "2026-05-01", createdTo: "2026-01-01" });
    expect([f.createdFrom, f.createdTo]).toEqual(["2026-01-01", "2026-05-01"]);
  });
  it("round-trips through URL params", () => {
    const f = parseCustomerFilters({ status: "dormant", tag: "VIP", sortBy: "name_asc", minDebt: "50" });
    const back = parseCustomerFilters(customerFiltersToParams(f));
    expect(back).toEqual(f);
    expect(countActiveFilters(f)).toBe(3);
  });
});

describe("phone search", () => {
  it("normalises digits and 972 prefix", () => {
    expect(normalizePhoneSearch("050-123-4567")).toBe("0501234567");
    expect(normalizePhoneSearch("+972 50 1234567")).toBe("0501234567");
    expect(normalizePhoneSearch("(050) 12")).toBe("05012");
  });
  it("ignores non-phone searches", () => {
    expect(normalizePhoneSearch("דני 050")).toBeNull();
    expect(normalizePhoneSearch("12")).toBeNull();
    expect(normalizePhoneSearch("")).toBeNull();
  });
  it("compares stored phones", () => {
    expect(normalizeStoredPhone("+972-50-1234567")).toBe("0501234567");
    expect(samePhone("050-1234567", "972501234567")).toBe(true);
    expect(samePhone("050-1234567", "050-1234568")).toBe(false);
    expect(samePhone("", "")).toBe(false);
  });
});

describe("tags", () => {
  it("escapes LIKE wildcards", () => {
    expect(escapeLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });
  it("builds an exact-element pattern", () => {
    expect(tagLikePattern("VIP")).toBe('%"VIP"%');
    expect(tagLikePattern("a_b")).toBe('%"a\\_b"%');
  });
  it("VIP is an exact case-insensitive tag", () => {
    expect(hasVipTag('["vip"]')).toBe(true);
    expect(hasVipTag(["VIP"])).toBe(true);
    expect(hasVipTag(["Super VIP"])).toBe(false);
    expect(hasVipTag("not json")).toBe(false);
  });
  it("exact tag match + add/remove", () => {
    expect(hasExactTag('["קבוע","חדש"]', "קבוע")).toBe(true);
    expect(hasExactTag('["קבועים"]', "קבוע")).toBe(false);
    expect(applyTagChange(["a"], "add_tag", "a")).toEqual(["a"]);
    expect(applyTagChange(["a"], "add_tag", "b")).toEqual(["a", "b"]);
    expect(applyTagChange(["a", "b"], "remove_tag", "a")).toEqual(["b"]);
    expect(parseTagList('[1,"x"]')).toEqual(["x"]);
  });
});

describe("status rules", () => {
  const base = { createdAt: daysAgo(400), lastVisit: null, hasUpcoming: false, inBoarding: false, activeTraining: false };
  it("dormant by default", () => {
    expect(isCustomerActive(base, today, now)).toBe(false);
  });
  it.each([
    ["upcoming", { hasUpcoming: true }],
    ["boarding", { inBoarding: true }],
    ["training", { activeTraining: true }],
    ["visit 59 days ago", { lastVisit: daysAgo(59) }],
    ["visit exactly 60 days ago", { lastVisit: daysAgo(60) }],
    ["created 3 days ago", { createdAt: new Date(now.getTime() - 3 * DAY) }],
  ])("active when %s", (_l, patch) => {
    expect(isCustomerActive({ ...base, ...patch }, today, now)).toBe(true);
  });
  it("dormant when last visit is 61 days ago", () => {
    expect(isCustomerActive({ ...base, lastVisit: daysAgo(61) }, today, now)).toBe(false);
  });
  it("VIP wins in display status", () => {
    expect(displayStatus(true, false)).toBe("vip");
    expect(displayStatus(false, true)).toBe("active");
    expect(displayStatus(false, false)).toBe("dormant");
  });
});

describe("last visit filter", () => {
  it("30+ excludes never-visited and recent", () => {
    expect(matchesLastVisit("30", null, today)).toBe(false);
    expect(matchesLastVisit("30", daysAgo(10), today)).toBe(false);
    expect(matchesLastVisit("30", daysAgo(31), today)).toBe(true);
  });
  it("never = no visit", () => {
    expect(matchesLastVisit("never", null, today)).toBe(true);
    expect(matchesLastVisit("never", daysAgo(500), today)).toBe(false);
  });
});

describe("balance filter", () => {
  it("debt / balanced / minDebt", () => {
    expect(matchesBalance("debt", null, 10)).toBe(true);
    expect(matchesBalance("debt", null, 0)).toBe(false);
    expect(matchesBalance("balanced", null, 0)).toBe(true);
    expect(matchesBalance("balanced", null, 5)).toBe(false);
    expect(matchesBalance(null, 100, 99)).toBe(false);
    expect(matchesBalance(null, 100, 100)).toBe(true);
  });
});

describe("sorting", () => {
  const rows = [
    { id: "1", name: "Zed", createdAt: daysAgo(1), lastVisit: daysAgo(5), outstanding: 0 },
    { id: "2", name: "אבי", createdAt: daysAgo(3), lastVisit: null, outstanding: 300 },
    { id: "3", name: "123", createdAt: daysAgo(2), lastVisit: daysAgo(50), outstanding: 50 },
    { id: "4", name: "בני", createdAt: daysAgo(4), lastVisit: daysAgo(1), outstanding: 300 },
  ];
  const ids = (sort: Parameters<typeof sortCustomerRows>[1]) => sortCustomerRows(rows, sort).map((r) => r.id);
  it("name: Hebrew, Latin, digits", () => {
    expect(nameBucket("אבי")).toBe(0);
    expect(ids("name_asc")).toEqual(["2", "4", "1", "3"]);
  });
  it("newest / oldest", () => {
    expect(ids("newest")).toEqual(["1", "3", "2", "4"]);
    expect(ids("oldest")).toEqual(["4", "2", "3", "1"]);
  });
  it("balance desc, ties by name", () => {
    expect(ids("balance_desc")).toEqual(["2", "4", "3", "1"]);
  });
  it("last visit — never-visited last in both directions", () => {
    expect(ids("last_visit_desc")).toEqual(["4", "1", "3", "2"]);
    expect(ids("last_visit_asc")).toEqual(["3", "1", "4", "2"]);
  });
  it("does not mutate input", () => {
    sortCustomerRows(rows, "name_asc");
    expect(rows[0].id).toBe("1");
  });
});

describe("misc", () => {
  it("offset cursor", () => {
    expect(parseOffsetCursor("50")).toBe(50);
    expect(parseOffsetCursor("cust-001")).toBeNull();
    expect(parseOffsetCursor(undefined)).toBeNull();
  });
  it("personalises {שם}", () => {
    expect(personalizeMessage("שלום {שם}!", "ישראל ישראלי")).toBe("שלום ישראל!");
    expect(personalizeMessage("hi {name} {שם}", "Dana")).toBe("hi Dana Dana");
  });
});
