/**
 * Activity logger for the business "ניהול ובקרה" screen and the Master Admin dashboard.
 * Records: userId, userName, action, timestamp + (since 2026-10) businessId and
 * the acted-on entity (type, id, short label). No IP, no free-form metadata.
 * Action catalog (client-safe): src/lib/activity-actions.ts.
 */

import prisma from "./prisma";
import { getSessionToken, validateSession } from "./auth";
import { ACTIVITY_ACTIONS, sanitizeEntityLabel, type ActivityAction } from "./activity-actions";

export { ACTIVITY_ACTIONS, type ActivityAction };

export interface ActivityContext {
  /** Business the action happened in. Always pass it from routes that have one. */
  businessId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  /** Short display label (customer/pet name …) — sanitized + capped here. */
  entityLabel?: string | null;
}

/**
 * Activity log write. Never throws.
 * Fire-and-forget for routine actions; `await` it for sensitive actions
 * (deletes, exports, payment cancel/refund, session revoke) so the owner
 * security alert (src/lib/security-alerts.ts) finishes before the lambda ends.
 */
export async function logActivity(
  userId: string,
  userName: string,
  action: ActivityAction | string,
  ctx: ActivityContext = {}
): Promise<void> {
  try {
    const entry = await prisma.activityLog.create({
      data: {
        userId,
        userName,
        action,
        businessId: ctx.businessId ?? null,
        entityType: ctx.entityType ?? null,
        entityId: ctx.entityId ? String(ctx.entityId).slice(0, 64) : null,
        entityLabel: sanitizeEntityLabel(ctx.entityLabel),
      },
    });
    if (entry.businessId) {
      const { onActivityLogged } = await import("./security-alerts");
      await onActivityLogged(entry);
    }
  } catch (err) {
    console.error("[activity-log] Failed:", err);
  }
}

/** Resolve current user from session cookie and log activity. Fire-and-forget. */
export async function logCurrentUserActivity(
  action: ActivityAction | string,
  ctx: ActivityContext = {}
): Promise<void> {
  try {
    const token = getSessionToken();
    if (!token) return;
    const session = await validateSession(token);
    if (!session?.user) return;
    await logActivity(session.user.id, session.user.name, action, ctx);
  } catch {
    // never throw — logging must not break the main flow
  }
}
