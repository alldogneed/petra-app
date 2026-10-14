/**
 * Ending a member's access. A deactivated or removed member must be thrown out at
 * once, not when their 30-day session expires:
 *   - no other active business and no platform role → every session is deleted
 *     (the open tab's next /api/auth/me returns 401 → AuthProvider sends them to /login);
 *   - still active elsewhere → only the session cache is dropped, so the next
 *     request already sees the business is gone (other businesses keep working).
 */
import { prisma } from "@/lib/prisma";
import { deleteAllUserSessions, invalidateUserSessionCache } from "@/lib/session";

export async function endBusinessAccess(userId: string): Promise<{ loggedOut: boolean }> {
  const [user, otherActive] = await Promise.all([
    prisma.platformUser.findUnique({ where: { id: userId }, select: { platformRole: true } }),
    prisma.businessUser.count({ where: { userId, isActive: true } }),
  ]);
  if (!user?.platformRole && otherActive === 0) {
    await deleteAllUserSessions(userId);
    return { loggedOut: true };
  }
  invalidateUserSessionCache(userId);
  return { loggedOut: false };
}
