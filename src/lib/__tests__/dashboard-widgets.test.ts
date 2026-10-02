import {
  DASHBOARD_BLOCK_IDS,
  defaultDashboardPrefs,
  layoutBlocks,
  normalizeDashboardPrefs,
  resolveBlockOrder,
  visibleBlocks,
  visibleStats,
  type RequirementFlags,
} from "../dashboard-widgets";

const ALL: RequirementFlags = { finance: true, revenue: true, leads: true, activity: true };
const STAFF: RequirementFlags = { finance: false, revenue: false, leads: false, activity: false };

describe("normalizeDashboardPrefs", () => {
  it("rejects non-objects and missing arrays", () => {
    expect(normalizeDashboardPrefs(null)).toBeNull();
    expect(normalizeDashboardPrefs("x")).toBeNull();
    expect(normalizeDashboardPrefs([])).toBeNull();
    expect(normalizeDashboardPrefs({ hidden: [] })).toBeNull();
    expect(normalizeDashboardPrefs({ hidden: "a", order: [] })).toBeNull();
  });

  it("drops unknown ids, duplicates and non-strings", () => {
    const p = normalizeDashboardPrefs({
      hidden: ["birthdays", "birthdays", "nope", 5, "stat_revenue", "__proto__"],
      order: ["open_tasks", "stat_revenue", "open_tasks", "daily_focus", {}],
    });
    expect(p).toEqual({ v: 1, hidden: ["birthdays", "stat_revenue"], order: ["open_tasks", "daily_focus"] });
  });

  it("caps huge inputs", () => {
    const p = normalizeDashboardPrefs({ hidden: Array(100000).fill("birthdays"), order: [] });
    expect(p?.hidden).toEqual(["birthdays"]);
  });
});

describe("resolveBlockOrder", () => {
  it("returns the default order for an empty save", () => {
    expect(resolveBlockOrder([])).toEqual([...DASHBOARD_BLOCK_IDS]);
  });

  it("keeps the saved order and slots missing blocks after their default predecessor", () => {
    const saved = DASHBOARD_BLOCK_IDS.filter((id) => id !== "top_debtors").reverse();
    const order = resolveBlockOrder(saved);
    expect(order).toHaveLength(DASHBOARD_BLOCK_IDS.length);
    // top_debtors' default predecessor is overdue_leads
    expect(order.indexOf("top_debtors")).toBe(order.indexOf("overdue_leads") + 1);
  });

  it("puts a missing first block at the top", () => {
    const saved = DASHBOARD_BLOCK_IDS.filter((id) => id !== "daily_focus");
    expect(resolveBlockOrder(saved)[0]).toBe("daily_focus");
  });
});

describe("visibility", () => {
  it("permissions win over preferences", () => {
    const prefs = defaultDashboardPrefs(null);
    const ids = visibleBlocks(prefs, STAFF).map((b) => b.id);
    expect(ids).not.toContain("top_debtors");
    expect(ids).not.toContain("revenue_chart");
    expect(ids).not.toContain("followups_today");
    expect(ids).not.toContain("activity_feed");
    expect(ids).toContain("upcoming_appointments");
    const stats = visibleStats(prefs, STAFF);
    expect(stats.has("stat_revenue")).toBe(false);
    expect(stats.has("stat_today_appointments")).toBe(true);
  });

  it("hidden ids are removed", () => {
    const prefs = { ...defaultDashboardPrefs(null), hidden: ["birthdays" as const, "stat_open_leads" as const] };
    expect(visibleBlocks(prefs, ALL).map((b) => b.id)).not.toContain("birthdays");
    expect(visibleStats(prefs, ALL).has("stat_open_leads")).toBe(false);
  });

  it("business-type defaults", () => {
    expect(defaultDashboardPrefs("מספרה").hidden).toContain("boarding_today");
    expect(defaultDashboardPrefs("פנסיון").hidden).toEqual([]);
    expect(defaultDashboardPrefs(undefined).hidden).toEqual([]);
  });
});

describe("layoutBlocks", () => {
  it("pairs consecutive half blocks and widens a lone half", () => {
    const prefs = defaultDashboardPrefs(null);
    const all = layoutBlocks(visibleBlocks(prefs, ALL));
    const byId = Object.fromEntries(all.map((b) => [b.id, b.wide]));
    expect(byId.revenue_chart).toBe(false);
    expect(byId.upcoming_appointments).toBe(false);
    expect(byId.recent_orders).toBe(false);
    expect(byId.activity_feed).toBe(false);
    // staff: no revenue chart / activity → the remaining halves pair with each other
    const staff = Object.fromEntries(layoutBlocks(visibleBlocks(prefs, STAFF)).map((b) => [b.id, b.wide]));
    expect(staff.upcoming_appointments).toBe(false);
    expect(staff.recent_orders).toBe(false);
    const lone = layoutBlocks(visibleBlocks({ ...prefs, hidden: ["revenue_chart", "activity_feed", "recent_orders"] }, ALL));
    expect(lone.find((b) => b.id === "upcoming_appointments")?.wide).toBe(true);
  });
});
