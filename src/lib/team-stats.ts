/**
 * Per-employee summary for business-admin → צוות. Pure + client-safe (no prisma).
 * Server: src/services/business-admin-team.ts. UI: src/components/business-admin/TeamTab.tsx.
 */

import { DELETE_ACTIONS } from "@/lib/activity-actions";
import {
  hasTenantPermission,
  type PermissionOverrides,
  type TenantPermission,
  type TenantRole,
} from "@/lib/permissions";

// ─── Period ────────────────────────────────────────────────────────────────

export const TEAM_STATS_PERIODS = [7, 30, 90] as const;
export type TeamStatsDays = (typeof TEAM_STATS_PERIODS)[number];
export const DEFAULT_TEAM_STATS_DAYS: TeamStatsDays = 30;

/** `null`/empty → default 30; anything other than 7/30/90 → null (reject). */
export function parseTeamStatsDays(raw: string | null | undefined): TeamStatsDays | null {
  if (raw == null || raw === "") return DEFAULT_TEAM_STATS_DAYS;
  if (!/^\d{1,3}$/.test(raw)) return null;
  const n = Number(raw);
  return (TEAM_STATS_PERIODS as readonly number[]).includes(n) ? (n as TeamStatsDays) : null;
}

const TZ = "Asia/Jerusalem";

/** Israel-local calendar date (YYYY-MM-DD) of an instant. */
export function israelYmdOf(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Offset (ms) of Israel local time vs UTC at instant `d`. */
function israelOffsetMs(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** The real UTC instant of 00:00 Israel time on the given YYYY-MM-DD (DST-aware). */
export function israelMidnightUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let ts = guess - israelOffsetMs(new Date(guess));
  // Second pass corrects the rare case where the offset differs at the result instant.
  ts = guess - israelOffsetMs(new Date(ts));
  return new Date(ts);
}

/**
 * Start of a `days`-long window that includes today (Israel time):
 * days=7 → 00:00 Israel time six days ago.
 */
export function teamStatsWindowStart(days: number, now: Date = new Date()): Date {
  const todayYmd = israelYmdOf(now);
  const [y, m, d] = todayYmd.split("-").map(Number);
  const startYmd = new Date(Date.UTC(y, m - 1, d - (days - 1))).toISOString().slice(0, 10);
  return israelMidnightUtc(startYmd);
}

// ─── Counts ────────────────────────────────────────────────────────────────

export interface TeamMemberCounts {
  appointmentsCompleted: number;
  appointmentsCreated: number;
  customersCreated: number;
  leadsWon: number;
  leadsLost: number;
  tasksCompleted: number;
  paymentsRecorded: number;
  deletes: number;
}

export type TeamCounterKey = keyof TeamMemberCounts;

/** ActivityLog.action → counter. Every DELETE_* action also feeds `deletes`. */
export const ACTION_COUNTERS: Record<string, TeamCounterKey> = {
  COMPLETE_APPOINTMENT: "appointmentsCompleted",
  CREATE_APPOINTMENT: "appointmentsCreated",
  CREATE_CUSTOMER: "customersCreated",
  CLOSE_LEAD_WON: "leadsWon",
  CLOSE_LEAD_LOST: "leadsLost",
  COMPLETE_TASK: "tasksCompleted",
  CREATE_PAYMENT: "paymentsRecorded",
};

/** All actions the summary cares about (for the groupBy `action IN (...)` filter). */
export const COUNTED_ACTIONS: string[] = [...Object.keys(ACTION_COUNTERS), ...Array.from(DELETE_ACTIONS)];

export function emptyCounts(): TeamMemberCounts {
  return {
    appointmentsCompleted: 0,
    appointmentsCreated: 0,
    customersCreated: 0,
    leadsWon: 0,
    leadsLost: 0,
    tasksCompleted: 0,
    paymentsRecorded: 0,
    deletes: 0,
  };
}

export interface ActionGroup {
  userId: string;
  action: string;
  count: number;
}

/** Fold `groupBy([userId, action])` rows into a per-user counts map. Unknown actions are ignored. */
export function foldActionGroups(groups: ActionGroup[]): Map<string, TeamMemberCounts> {
  const out = new Map<string, TeamMemberCounts>();
  for (const g of groups) {
    const key: TeamCounterKey | undefined = DELETE_ACTIONS.has(g.action) ? "deletes" : ACTION_COUNTERS[g.action];
    if (!key) continue;
    const n = Number.isFinite(g.count) && g.count > 0 ? g.count : 0;
    const c = out.get(g.userId) ?? emptyCounts();
    c[key] += n;
    out.set(g.userId, c);
  }
  return out;
}

// ─── Rows ──────────────────────────────────────────────────────────────────

export interface TeamStatsMember {
  userId: string;
  name: string;
  role: string;
  isActive: boolean;
  /** ISO string or null when never seen. */
  lastActiveAt: string | null;
  counts: TeamMemberCounts;
  /** null = tasks are not assigned to team members in Petra (no reliable mapping). */
  openTasks: number | null;
  overdueTasks: number | null;
}

export interface TeamStatsResponse {
  days: TeamStatsDays;
  members: TeamStatsMember[];
}

export interface TeamStatsMemberInput {
  userId: string;
  name: string;
  role: string;
  /** Membership active AND platform user active. */
  isActive: boolean;
}

function maxDate(a: Date | null | undefined, b: Date | null | undefined): Date | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

/** Active first, then most recently active first (never-seen last), then name. */
export function sortTeamStatsMembers(rows: TeamStatsMember[]): TeamStatsMember[] {
  return [...rows].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    const ta = a.lastActiveAt ? Date.parse(a.lastActiveAt) : -Infinity;
    const tb = b.lastActiveAt ? Date.parse(b.lastActiveAt) : -Infinity;
    if (ta !== tb) return tb > ta ? 1 : -1;
    return a.name.localeCompare(b.name, "he");
  });
}

export function buildTeamStatsMembers(input: {
  members: TeamStatsMemberInput[];
  actionGroups: ActionGroup[];
  lastActivityByUser: Map<string, Date>;
  lastSessionByUser: Map<string, Date>;
  taskCounts?: Map<string, { open: number; overdue: number }> | null;
}): TeamStatsMember[] {
  const counts = foldActionGroups(input.actionGroups);
  const rows = input.members.map<TeamStatsMember>((m) => {
    const last = maxDate(input.lastActivityByUser.get(m.userId), input.lastSessionByUser.get(m.userId));
    const tasks = input.taskCounts ? input.taskCounts.get(m.userId) ?? { open: 0, overdue: 0 } : null;
    return {
      userId: m.userId,
      name: m.name,
      role: m.role,
      isActive: m.isActive,
      lastActiveAt: last ? last.toISOString() : null,
      counts: counts.get(m.userId) ?? emptyCounts(),
      openTasks: tasks ? tasks.open : null,
      overdueTasks: tasks ? tasks.overdue : null,
    };
  });
  return sortTeamStatsMembers(rows);
}

// ─── Permissions matrix cell ───────────────────────────────────────────────

export type CapabilitySource = "owner" | "override" | "role";

/**
 * Effective value of one CRITICAL_CAPABILITIES key for a member, and where it comes from.
 * Mirrors settings → צוות → הרשאות: the stored override for `key` wins, else the role default.
 */
export function capabilityCell(
  role: string,
  key: TenantPermission,
  overrides: Record<string, unknown> | null | undefined
): { value: boolean; source: CapabilitySource; roleDefault: boolean } {
  const r = role as TenantRole;
  if (r === "owner") return { value: true, source: "owner", roleDefault: true };
  const roleDefault = hasTenantPermission(r, key);
  const ov = overrides?.[key];
  if (typeof ov === "boolean") {
    return { value: hasTenantPermission(r, key, { [key]: ov } as PermissionOverrides), source: "override", roleDefault };
  }
  return { value: roleDefault, source: "role", roleDefault };
}
