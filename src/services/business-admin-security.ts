/**
 * Business-admin security service — active sessions (list / revoke) and owner
 * security-alert prefs + recent sensitive actions (ניהול ובקרה).
 *
 * All functions are business-scoped (businessId first param, from session only).
 * Activity logging stays in routes.
 */
import type { DbClient } from "./supabase";
import { ServiceError } from "./types";
import { describeDevice } from "@/lib/activity-actions";
import {
  isNewDeviceSession,
  parseSecurityAlertPrefs,
  pickNewDeviceLogins,
  RECENT_STATIC_ACTIONS,
  NEW_DEVICE_LOOKBACK_MS,
  NEW_DEVICE_SESSION_WINDOW_MS,
  type SecurityAlertPrefs,
} from "@/lib/security-alert-rules";

export { ServiceError };

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Sessions ───────────────────────────────────────────────────────────────

export interface BusinessSessionRow {
  id: string;
  userId: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastSeenAt: Date;
  createdAt: Date;
  expiresAt: Date;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  businessRole: string;
  device: string;
  isCurrent: boolean;
  isNewDevice: boolean;
  /** Whether this owner may revoke it (server re-checks on DELETE). */
  canRevoke: boolean;
}

/**
 * Active (non-expired, non-impersonation) sessions of all members of the business.
 * Never selects AdminSession.token.
 */
export async function listBusinessSessions(
  businessId: string,
  db: DbClient,
  opts: { currentSessionId?: string | null; actorId?: string | null; now?: Date } = {}
): Promise<BusinessSessionRow[]> {
  const now = opts.now ?? new Date();
  // Active members only — a former employee's sessions (IP, device, lastSeen in
  // other businesses) are none of this owner's business.
  const members = await db.businessUser.findMany({
    where: { businessId, isActive: true },
    select: { userId: true, role: true },
  });
  const memberIds = members.map((m) => m.userId);
  if (memberIds.length === 0) return [];
  const roleMap = new Map(members.map((m) => [m.userId, m.role]));

  const sessions = await db.adminSession.findMany({
    where: {
      userId: { in: memberIds },
      expiresAt: { gt: now },
      impersonatedByAdminId: null,
    },
    select: {
      id: true,
      userId: true,
      userAgent: true,
      ipAddress: true,
      lastSeenAt: true,
      createdAt: true,
      expiresAt: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { lastSeenAt: "desc" },
    take: 500,
  });

  const withDevice = sessions.map((s) => ({ ...s, device: describeDevice(s.userAgent) }));

  // LOGIN history only for sessions young enough to be "new device" candidates.
  const recent = withDevice.filter((s) => now.getTime() - s.createdAt.getTime() <= NEW_DEVICE_SESSION_WINDOW_MS);
  let logins: { userId: string; entityLabel: string | null; createdAt: Date }[] = [];
  if (recent.length > 0) {
    const minCreated = Math.min(...recent.map((s) => s.createdAt.getTime()));
    const maxCreated = Math.max(...recent.map((s) => s.createdAt.getTime()));
    logins = await db.activityLog.findMany({
      where: {
        action: "LOGIN",
        userId: { in: [...new Set(recent.map((s) => s.userId))] },
        // Legacy-fallback rule (spec #3). Legacy rows have no label, so they never match a device.
        OR: [{ businessId }, { businessId: null, userId: { in: memberIds } }],
        entityLabel: { not: null },
        createdAt: { gte: new Date(minCreated - NEW_DEVICE_LOOKBACK_MS), lt: new Date(maxCreated - DAY_MS) },
      },
      select: { userId: true, entityLabel: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });
  }

  // Users whose sessions this owner may not touch: owners, platform staff, and
  // anyone who owns another business (sessions are platform-wide).
  const otherUserIds = [...new Set(sessions.map((x) => x.userId))].filter((id) => id !== opts.actorId);
  const [platformStaff, ownersElsewhere] = otherUserIds.length
    ? await Promise.all([
        db.platformUser.findMany({
          where: { id: { in: otherUserIds }, platformRole: { not: null } },
          select: { id: true },
        }),
        db.businessUser.findMany({
          where: { userId: { in: otherUserIds }, role: "owner", isActive: true, businessId: { not: businessId } },
          select: { userId: true },
        }),
      ])
    : [[], []];
  const protectedIds = new Set<string>([
    ...platformStaff.map((u) => u.id),
    ...ownersElsewhere.map((m) => m.userId),
    ...members.filter((m) => m.role === "owner").map((m) => m.userId),
  ]);

  return withDevice.map((s) => ({
    ...s,
    canRevoke:
      !(!!opts.currentSessionId && s.id === opts.currentSessionId) &&
      (s.userId === opts.actorId || !protectedIds.has(s.userId)),
    businessRole: roleMap.get(s.userId) ?? "user",
    isCurrent: !!opts.currentSessionId && s.id === opts.currentSessionId,
    isNewDevice: isNewDeviceSession({ userId: s.userId, createdAt: s.createdAt, device: s.device }, logins, now),
  }));
}

/** Member of the business that the actor may manage sessions for (404 otherwise — no existence leak). */
async function assertRevocableMember(
  businessId: string,
  db: DbClient,
  targetUserId: string,
  actorId: string
) {
  const member = await db.businessUser.findFirst({
    where: { businessId, userId: targetUserId, isActive: true },
    select: { role: true, user: { select: { name: true, platformRole: true } } },
  });
  if (!member) throw new ServiceError("Session not found", "NOT_FOUND");
  if (targetUserId === actorId) return member;
  if (member.role === "owner" || member.user.platformRole) {
    throw new ServiceError("Session not found", "NOT_FOUND");
  }
  // Sessions are platform-wide: never let this owner log someone out of a business
  // they own elsewhere.
  const ownsElsewhere = await db.businessUser.count({
    where: { userId: targetUserId, role: "owner", isActive: true, businessId: { not: businessId } },
  });
  if (ownsElsewhere > 0) throw new ServiceError("Session not found", "NOT_FOUND");
  return member;
}

export async function revokeBusinessSession(
  businessId: string,
  db: DbClient,
  args: { sessionId: string; actorId: string; currentSessionId: string | null }
): Promise<{ sessionId: string; userId: string; userName: string; device: string }> {
  const { sessionId, actorId, currentSessionId } = args;
  if (!sessionId || sessionId.length > 64) throw new ServiceError("Session not found", "NOT_FOUND");

  const session = await db.adminSession.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true, userAgent: true, impersonatedByAdminId: true },
  });
  if (!session || session.impersonatedByAdminId) throw new ServiceError("Session not found", "NOT_FOUND");

  const member = await assertRevocableMember(businessId, db, session.userId, actorId);
  if (currentSessionId && session.id === currentSessionId) {
    throw new ServiceError("לא ניתן לנתק את הסשן הנוכחי שלך — השתמש/י ביציאה", "VALIDATION");
  }

  await db.adminSession.deleteMany({ where: { id: session.id, userId: session.userId } });
  return {
    sessionId: session.id,
    userId: session.userId,
    userName: member.user.name,
    device: describeDevice(session.userAgent),
  };
}

export async function revokeMemberSessions(
  businessId: string,
  db: DbClient,
  args: { userId: string; actorId: string; currentSessionId: string | null }
): Promise<{ revoked: number; userId: string; userName: string }> {
  const { userId, actorId, currentSessionId } = args;
  if (!userId || userId.length > 64) throw new ServiceError("Member not found", "NOT_FOUND");
  const member = await assertRevocableMember(businessId, db, userId, actorId);

  const res = await db.adminSession.deleteMany({
    where: {
      userId,
      impersonatedByAdminId: null,
      ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
    },
  });
  return { revoked: res.count, userId, userName: member.user.name };
}

// ─── Security alerts ────────────────────────────────────────────────────────

export interface SensitiveActivityEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  createdAt: Date;
  businessId: string | null;
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
}

const ENTRY_SELECT = {
  id: true, userId: true, userName: true, action: true, createdAt: true,
  businessId: true, entityType: true, entityId: true, entityLabel: true,
} as const;

/** Alertable actions (rule set, any actor) in the last 14 days, newest first, max 50. */
export async function listRecentSensitiveActivity(
  businessId: string,
  db: DbClient,
  opts: { now?: Date; days?: number; take?: number } = {}
): Promise<SensitiveActivityEntry[]> {
  const now = opts.now ?? new Date();
  const take = Math.min(Math.max(opts.take ?? 50, 1), 100);
  const since = new Date(now.getTime() - (opts.days ?? 14) * DAY_MS);

  const members = await db.businessUser.findMany({ where: { businessId }, select: { userId: true } });
  const memberIds = members.map((m) => m.userId);
  const scope = { OR: [{ businessId }, { businessId: null, userId: { in: memberIds } }] };

  const [staticRows, loginRows] = await Promise.all([
    db.activityLog.findMany({
      where: {
        AND: [
          scope,
          { createdAt: { gte: since } },
          { OR: [{ action: { in: RECENT_STATIC_ACTIONS } }, { action: { startsWith: "DELETE_" } }] },
        ],
      },
      select: ENTRY_SELECT,
      orderBy: { createdAt: "desc" },
      take,
    }),
    // New-device logins: need 90 days of history before the 14-day window.
    db.activityLog.findMany({
      where: {
        businessId,
        action: "LOGIN",
        entityLabel: { not: null },
        createdAt: { gte: new Date(since.getTime() - NEW_DEVICE_LOOKBACK_MS) },
      },
      select: ENTRY_SELECT,
      orderBy: { createdAt: "desc" },
      take: 3000,
    }),
  ]);

  const newDevice = pickNewDeviceLogins(loginRows, since);
  return [...staticRows, ...newDevice]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, take);
}

export async function getSecurityAlertPrefs(businessId: string, db: DbClient): Promise<SecurityAlertPrefs> {
  const b = await db.business.findUnique({ where: { id: businessId }, select: { securityAlertPrefs: true } });
  if (!b) throw new ServiceError("Business not found", "NOT_FOUND");
  return parseSecurityAlertPrefs(b.securityAlertPrefs);
}

export async function updateSecurityAlertPrefs(
  businessId: string,
  db: DbClient,
  raw: unknown
): Promise<SecurityAlertPrefs> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ServiceError("Invalid preferences", "VALIDATION");
  }
  const prefs = parseSecurityAlertPrefs(raw);
  await db.business.update({
    where: { id: businessId },
    data: { securityAlertPrefs: prefs as unknown as object },
  });
  return prefs;
}
