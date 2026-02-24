/**
 * Privacy-focused activity logger for the Master Admin dashboard.
 * Records ONLY: userId, userName, action, timestamp.
 * No customer data. No metadata. No IP. No target entities.
 */

import prisma from "./prisma";
import { getSessionToken, validateSession } from "./auth";

export const ACTIVITY_ACTIONS = {
  LOGIN: "LOGIN",
  CREATE_CUSTOMER: "CREATE_CUSTOMER",
  ADD_PET: "ADD_PET",
  CREATE_APPOINTMENT: "CREATE_APPOINTMENT",
  CREATE_ORDER: "CREATE_ORDER",
  CREATE_PAYMENT: "CREATE_PAYMENT",
  CREATE_LEAD: "CREATE_LEAD",
  CREATE_TASK: "CREATE_TASK",
  CREATE_BOARDING_STAY: "CREATE_BOARDING_STAY",
  UPDATE_SETTINGS: "UPDATE_SETTINGS",
  CREATE_MESSAGE_TEMPLATE: "CREATE_MESSAGE_TEMPLATE",
} as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[keyof typeof ACTIVITY_ACTIONS];

/** Fire-and-forget activity log. Never throws. */
export async function logActivity(
  userId: string,
  userName: string,
  action: ActivityAction | string
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: { userId, userName, action },
    });
  } catch (err) {
    console.error("[activity-log] Failed:", err);
  }
}

/** Resolve current user from session cookie and log activity. Fire-and-forget. */
export async function logCurrentUserActivity(action: ActivityAction | string): Promise<void> {
  try {
    const token = getSessionToken();
    if (!token) return;
    const session = await validateSession(token);
    if (!session?.user) return;
    await logActivity(session.user.id, session.user.name, action);
  } catch {
    // never throw — logging must not break the main flow
  }
}
