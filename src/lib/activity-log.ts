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
  UPDATE_CUSTOMER: "UPDATE_CUSTOMER",
  DELETE_CUSTOMER: "DELETE_CUSTOMER",
  ADD_PET: "ADD_PET",
  CREATE_APPOINTMENT: "CREATE_APPOINTMENT",
  UPDATE_APPOINTMENT: "UPDATE_APPOINTMENT",
  COMPLETE_APPOINTMENT: "COMPLETE_APPOINTMENT",
  CANCEL_APPOINTMENT: "CANCEL_APPOINTMENT",
  DELETE_APPOINTMENT: "DELETE_APPOINTMENT",
  CREATE_ORDER: "CREATE_ORDER",
  CREATE_PAYMENT: "CREATE_PAYMENT",
  CREATE_LEAD: "CREATE_LEAD",
  UPDATE_LEAD: "UPDATE_LEAD",
  CLOSE_LEAD_WON: "CLOSE_LEAD_WON",
  CLOSE_LEAD_LOST: "CLOSE_LEAD_LOST",
  DELETE_LEAD: "DELETE_LEAD",
  CREATE_TASK: "CREATE_TASK",
  COMPLETE_TASK: "COMPLETE_TASK",
  CANCEL_TASK: "CANCEL_TASK",
  CREATE_BOARDING_STAY: "CREATE_BOARDING_STAY",
  CHECKIN_BOARDING: "CHECKIN_BOARDING",
  CHECKOUT_BOARDING: "CHECKOUT_BOARDING",
  DELETE_BOARDING: "DELETE_BOARDING",
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
