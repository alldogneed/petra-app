/**
 * pending-approvals.ts
 * Helper utilities for the PendingApproval queue.
 *
 * When a manager attempts a critical action, call createPendingApproval()
 * instead of executing the action directly.
 * The owner reviews via /settings?tab=team → "בקשות ממתינות".
 */

import { prisma } from "@/lib/prisma";

export type PendingApprovalAction =
  | "DELETE_CUSTOMER"
  | "DELETE_PET"
  | "DELETE_TRAINING"
  | "DELETE_APPOINTMENT"
  | "EDIT_PRICING"
  | "EDIT_SETTINGS";

/** TTL for pending approvals before auto-expiry */
const APPROVAL_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

export interface CreatePendingApprovalInput {
  businessId: string;
  requestedByUserId: string;
  action: PendingApprovalAction;
  /** Hebrew description shown to the owner */
  description: string;
  /** Data needed to re-execute the action when approved */
  payload: Record<string, string | number | boolean | null>;
}

export async function createPendingApproval(input: CreatePendingApprovalInput) {
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS);
  return prisma.pendingApproval.create({
    data: {
      businessId:        input.businessId,
      requestedByUserId: input.requestedByUserId,
      action:            input.action,
      description:       input.description,
      payload:           input.payload,
      status:            "PENDING",
      expiresAt,
    },
    select: {
      id: true,
      action: true,
      description: true,
      status: true,
      expiresAt: true,
      createdAt: true,
    },
  });
}

/** Expire all overdue PENDING approvals (call from cron or on-demand) */
export async function expireOldApprovals(businessId?: string) {
  return prisma.pendingApproval.updateMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: new Date() },
      ...(businessId ? { businessId } : {}),
    },
    data: { status: "EXPIRED" },
  });
}

/** Action labels for Hebrew UI */
export const PENDING_APPROVAL_LABELS: Record<PendingApprovalAction, string> = {
  DELETE_CUSTOMER:    "מחיקת לקוח",
  DELETE_PET:         "מחיקת חיית מחמד",
  DELETE_TRAINING:    "מחיקת תוכנית אימון",
  DELETE_APPOINTMENT: "מחיקת פגישה",
  EDIT_PRICING:       "שינוי מחירון",
  EDIT_SETTINGS:      "שינוי הגדרות עסק",
};
