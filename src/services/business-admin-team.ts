/**
 * Business-admin → צוות: per-employee activity summary.
 *
 * Business-scoped (businessId first param, from the session only). Reads ActivityLog with the
 * legacy-fallback rule: rows with businessId = X, OR legacy rows (businessId IS NULL) written by
 * a member of X. Pure folding/sorting lives in src/lib/team-stats.ts.
 *
 * Tasks: Task.assigneeUserId references the legacy `User` model and nothing in Petra
 * (UI, API, MCP) ever sets it — tasks are not assigned to team members. There is no reliable
 * PlatformUser → User mapping, so openTasks / overdueTasks are returned as null.
 */

import type { DbClient } from "./supabase";
import { ServiceError } from "./types";
import {
  COUNTED_ACTIONS,
  buildTeamStatsMembers,
  teamStatsWindowStart,
  TEAM_STATS_PERIODS,
  type TeamStatsDays,
  type TeamStatsResponse,
} from "@/lib/team-stats";

export { ServiceError };

export async function getTeamStats(
  businessId: string,
  db: DbClient,
  days: TeamStatsDays,
  now: Date = new Date()
): Promise<TeamStatsResponse> {
  if (!(TEAM_STATS_PERIODS as readonly number[]).includes(days)) {
    throw new ServiceError("Invalid period", "VALIDATION");
  }

  const memberships = await db.businessUser.findMany({
    where: { businessId },
    select: {
      userId: true,
      role: true,
      isActive: true,
      user: { select: { name: true, isActive: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const memberIds = memberships.map((m) => m.userId);
  if (memberIds.length === 0) return { days, members: [] };

  const since = teamStatsWindowStart(days, now);

  // Rows that belong to this business (spec rule 3), restricted to members.
  const businessScope = {
    userId: { in: memberIds },
    OR: [{ businessId }, { businessId: null }],
  };

  const [actionGroups, lastActivity, lastSessions] = await Promise.all([
    db.activityLog.groupBy({
      by: ["userId", "action"],
      where: { ...businessScope, action: { in: COUNTED_ACTIONS }, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    db.activityLog.groupBy({
      by: ["userId"],
      where: businessScope,
      _max: { createdAt: true },
    }),
    db.adminSession.groupBy({
      by: ["userId"],
      where: { userId: { in: memberIds }, impersonatedByAdminId: null },
      _max: { lastSeenAt: true },
    }),
  ]);

  const lastActivityByUser = new Map<string, Date>();
  for (const g of lastActivity) if (g._max.createdAt) lastActivityByUser.set(g.userId, g._max.createdAt);
  const lastSessionByUser = new Map<string, Date>();
  for (const g of lastSessions) if (g._max.lastSeenAt) lastSessionByUser.set(g.userId, g._max.lastSeenAt);

  const members = buildTeamStatsMembers({
    members: memberships.map((m) => ({
      userId: m.userId,
      name: m.user?.name ?? "",
      role: m.role,
      isActive: m.isActive && (m.user?.isActive ?? true),
    })),
    actionGroups: actionGroups.map((g) => ({ userId: g.userId, action: g.action, count: g._count._all })),
    lastActivityByUser,
    lastSessionByUser,
    taskCounts: null,
  });

  return { days, members };
}
