import {
  parseTeamStatsDays,
  israelMidnightUtc,
  teamStatsWindowStart,
  foldActionGroups,
  buildTeamStatsMembers,
  sortTeamStatsMembers,
  capabilityCell,
  emptyCounts,
  COUNTED_ACTIONS,
  type TeamStatsMember,
} from "@/lib/team-stats";
import { TENANT_PERMS } from "@/lib/permissions";

describe("parseTeamStatsDays", () => {
  it("defaults to 30", () => {
    expect(parseTeamStatsDays(null)).toBe(30);
    expect(parseTeamStatsDays("")).toBe(30);
  });
  it("accepts only 7/30/90", () => {
    expect(parseTeamStatsDays("7")).toBe(7);
    expect(parseTeamStatsDays("90")).toBe(90);
    expect(parseTeamStatsDays("14")).toBeNull();
    expect(parseTeamStatsDays("30.0")).toBeNull();
    expect(parseTeamStatsDays("-7")).toBeNull();
    expect(parseTeamStatsDays("abc")).toBeNull();
  });
});

describe("Israel window start", () => {
  it("midnight in winter is 22:00Z the day before", () => {
    expect(israelMidnightUtc("2026-01-15").toISOString()).toBe("2026-01-14T22:00:00.000Z");
  });
  it("midnight in summer is 21:00Z the day before", () => {
    expect(israelMidnightUtc("2026-07-15").toISOString()).toBe("2026-07-14T21:00:00.000Z");
  });
  it("window of 7 days includes today (Israel date, not UTC date)", () => {
    // 2026-07-15 22:30Z = 2026-07-16 01:30 in Israel
    const now = new Date("2026-07-15T22:30:00.000Z");
    expect(teamStatsWindowStart(7, now).toISOString()).toBe("2026-07-09T21:00:00.000Z");
    expect(teamStatsWindowStart(1, now).toISOString()).toBe("2026-07-15T21:00:00.000Z");
  });
  it("crosses month and DST boundaries", () => {
    const now = new Date("2026-11-02T10:00:00.000Z"); // Israel winter time
    // 30-day window starts 2026-10-04 (Israel summer time still in effect → 21:00Z)
    expect(teamStatsWindowStart(30, now).toISOString()).toBe("2026-10-03T21:00:00.000Z");
  });
});

describe("foldActionGroups", () => {
  it("maps actions to counters and sums all deletes", () => {
    const m = foldActionGroups([
      { userId: "u1", action: "COMPLETE_APPOINTMENT", count: 3 },
      { userId: "u1", action: "CREATE_PAYMENT", count: 2 },
      { userId: "u1", action: "DELETE_CUSTOMER", count: 1 },
      { userId: "u1", action: "DELETE_PET", count: 2 },
      { userId: "u1", action: "LOGIN", count: 50 },
      { userId: "u2", action: "CLOSE_LEAD_WON", count: 4 },
    ]);
    expect(m.get("u1")).toEqual({ ...emptyCounts(), appointmentsCompleted: 3, paymentsRecorded: 2, deletes: 3 });
    expect(m.get("u2")?.leadsWon).toBe(4);
  });
  it("COUNTED_ACTIONS covers counters and deletes, not LOGIN", () => {
    expect(COUNTED_ACTIONS).toContain("CREATE_CUSTOMER");
    expect(COUNTED_ACTIONS).toContain("DELETE_LEAD");
    expect(COUNTED_ACTIONS).not.toContain("LOGIN");
  });
});

describe("buildTeamStatsMembers", () => {
  it("merges counts + last activity, includes members with no rows", () => {
    const rows = buildTeamStatsMembers({
      members: [
        { userId: "a", name: "אבי", role: "user", isActive: true },
        { userId: "b", name: "בתיה", role: "manager", isActive: true },
        { userId: "c", name: "גיל", role: "user", isActive: false },
      ],
      actionGroups: [{ userId: "b", action: "CREATE_CUSTOMER", count: 5 }],
      lastActivityByUser: new Map([["b", new Date("2026-09-01T10:00:00Z")]]),
      lastSessionByUser: new Map([
        ["b", new Date("2026-09-03T10:00:00Z")],
        ["c", new Date("2026-09-30T10:00:00Z")],
      ]),
      taskCounts: null,
    });
    expect(rows.map((r) => r.userId)).toEqual(["b", "a", "c"]);
    expect(rows[0].lastActiveAt).toBe("2026-09-03T10:00:00.000Z");
    expect(rows[0].counts.customersCreated).toBe(5);
    expect(rows[1].lastActiveAt).toBeNull();
    expect(rows[1].counts).toEqual(emptyCounts());
    expect(rows[2].openTasks).toBeNull();
  });
  it("fills task counts when provided", () => {
    const rows = buildTeamStatsMembers({
      members: [{ userId: "a", name: "א", role: "user", isActive: true }],
      actionGroups: [],
      lastActivityByUser: new Map(),
      lastSessionByUser: new Map(),
      taskCounts: new Map(),
    });
    expect(rows[0].openTasks).toBe(0);
    expect(rows[0].overdueTasks).toBe(0);
  });
});

describe("sortTeamStatsMembers", () => {
  const mk = (userId: string, isActive: boolean, lastActiveAt: string | null): TeamStatsMember => ({
    userId, name: userId, role: "user", isActive, lastActiveAt, counts: emptyCounts(), openTasks: null, overdueTasks: null,
  });
  it("active first, then lastActiveAt desc, never-seen last", () => {
    const out = sortTeamStatsMembers([
      mk("old", true, "2026-01-01T00:00:00Z"),
      mk("inactive-recent", false, "2026-09-30T00:00:00Z"),
      mk("never", true, null),
      mk("new", true, "2026-09-01T00:00:00Z"),
    ]);
    expect(out.map((r) => r.userId)).toEqual(["new", "old", "never", "inactive-recent"]);
  });
});

describe("capabilityCell", () => {
  it("owner is always full", () => {
    expect(capabilityCell("owner", TENANT_PERMS.USERS_WRITE, { [TENANT_PERMS.USERS_WRITE]: false })).toEqual({
      value: true, source: "owner", roleDefault: true,
    });
  });
  it("role default when no override", () => {
    expect(capabilityCell("manager", TENANT_PERMS.PRICING_WRITE, null)).toEqual({
      value: true, source: "role", roleDefault: true,
    });
    expect(capabilityCell("user", TENANT_PERMS.AI_ASSISTANT, {})).toEqual({
      value: false, source: "role", roleDefault: false,
    });
  });
  it("override wins in both directions", () => {
    expect(capabilityCell("user", TENANT_PERMS.AI_ASSISTANT, { [TENANT_PERMS.AI_ASSISTANT]: true })).toEqual({
      value: true, source: "override", roleDefault: false,
    });
    expect(capabilityCell("manager", TENANT_PERMS.MESSAGES_SEND, { [TENANT_PERMS.MESSAGES_SEND]: false })).toEqual({
      value: false, source: "override", roleDefault: true,
    });
  });
  it("ignores non-boolean override values", () => {
    expect(capabilityCell("user", TENANT_PERMS.DATA_EXPORT, { [TENANT_PERMS.DATA_EXPORT]: "no" }).source).toBe("role");
  });
});
