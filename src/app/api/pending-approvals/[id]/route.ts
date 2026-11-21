export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { hasTenantPermission, TENANT_PERMS } from "@/lib/permissions";
import { deletePet } from "@/services/pets";
import { deleteLead, deleteCustomer } from "@/services/clients";
import { deleteAppointment } from "@/services/appointments";
import { cancelAppointmentsOfProgram } from "@/services/training-appointments";
import { afterLinkedAppointmentCanceled } from "@/lib/training-appointment-effects";
import { deleteServiceDog, deleteRecipient } from "@/services/service-dogs";
import { cancelLeadFollowup } from "@/lib/reminder-service";
import { logActivity } from "@/lib/activity-log";
import { ENTITY_TYPES } from "@/lib/activity-actions";

/** Approved delete actions → the activity-log entity they removed. */
const APPROVAL_DELETE_ENTITIES: Record<string, { entityType: string; idKey: string; labelKey?: string }> = {
  DELETE_CUSTOMER: { entityType: ENTITY_TYPES.CUSTOMER, idKey: "customerId", labelKey: "customerName" },
  DELETE_PET: { entityType: ENTITY_TYPES.PET, idKey: "petId", labelKey: "petName" },
  DELETE_TRAINING: { entityType: ENTITY_TYPES.TRAINING, idKey: "trainingProgramId", labelKey: "programName" },
  DELETE_APPOINTMENT: { entityType: ENTITY_TYPES.APPOINTMENT, idKey: "appointmentId" },
  DELETE_LEAD: { entityType: ENTITY_TYPES.LEAD, idKey: "leadId", labelKey: "leadName" },
  // Service dog = Pet row + profile; only the profile is deleted. Older approvals
  // have no petId in the payload → entityId null, label still recorded.
  DELETE_SERVICE_DOG: { entityType: ENTITY_TYPES.PET, idKey: "petId", labelKey: "dogName" },
  // No RECIPIENT entity type → no entityType, label only.
  DELETE_RECIPIENT: { entityType: "", idKey: "recipientId", labelKey: "recipientName" },
};

/**
 * PATCH /api/pending-approvals/[id]
 * body: { action: "approve" | "reject", rejectionReason?: string }
 *
 * Only the business owner can approve/reject.
 * On approval, executes the pending action atomically.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { session, businessId } = authResult;

  const membership = session.memberships.find((m) => m.businessId === businessId);
  const role = membership?.role ?? "user";

  if (!hasTenantPermission(role, TENANT_PERMS.APPROVE_ACTIONS)) {
    return NextResponse.json({ error: "רק בעל העסק יכול לאשר בקשות" }, { status: 403 });
  }

  const body = await request.json();
  const { action, rejectionReason } = body as { action: "approve" | "reject"; rejectionReason?: string };

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "פעולה לא חוקית" }, { status: 400 });
  }

  const approval = await prisma.pendingApproval.findFirst({
    where: { id: params.id, businessId },
  });

  if (!approval) {
    return NextResponse.json({ error: "הבקשה לא נמצאה" }, { status: 404 });
  }

  if (approval.status !== "PENDING") {
    return NextResponse.json({ error: "הבקשה כבר טופלה" }, { status: 409 });
  }

  if (approval.expiresAt < new Date()) {
    await prisma.pendingApproval.update({
      where: { id: params.id },
      data: { status: "EXPIRED" },
    });
    return NextResponse.json({ error: "הבקשה פגה תוקפה" }, { status: 410 });
  }

  if (action === "reject") {
    await prisma.pendingApproval.update({
      where: { id: params.id },
      data: {
        status: "REJECTED",
        rejectionReason: rejectionReason ?? null,
        resolvedByUserId: session.user.id,
        resolvedAt: new Date(),
      },
    });
    return NextResponse.json({ success: true, status: "REJECTED" });
  }

  // ── Execute the approved action ──────────────────────────────────────────
  const payload = approval.payload as Record<string, unknown>;

  try {
    await executeApprovedAction(approval.action, payload, businessId);
  } catch (err) {
    console.error("[PendingApproval] execution error:", err);
    return NextResponse.json({ error: "שגיאה בביצוע הפעולה" }, { status: 500 });
  }

  await prisma.pendingApproval.update({
    where: { id: params.id },
    data: {
      status: "APPROVED",
      resolvedByUserId: session.user.id,
      resolvedAt: new Date(),
    },
  });

  // The approving owner performed the delete — log it (awaited: sensitive action).
  const deleteEntity = APPROVAL_DELETE_ENTITIES[approval.action];
  if (deleteEntity) {
    const entityId = payload?.[deleteEntity.idKey];
    const label = deleteEntity.labelKey ? payload?.[deleteEntity.labelKey] : undefined;
    await logActivity(session.user.id, session.user.name, approval.action, {
      businessId,
      entityType: deleteEntity.entityType || null,
      entityId: typeof entityId === "string" ? entityId : null,
      entityLabel: typeof label === "string" ? label : approval.description,
    });
  }

  return NextResponse.json({ success: true, status: "APPROVED" });
}

/**
 * DELETE /api/pending-approvals/[id]
 * Cancel a pending approval (only the requester or owner can cancel).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { session, businessId } = authResult;

  const membership = session.memberships.find((m) => m.businessId === businessId);
  const role = membership?.role ?? "user";
  const isOwner = hasTenantPermission(role, TENANT_PERMS.APPROVE_ACTIONS);

  const approval = await prisma.pendingApproval.findFirst({
    where: { id: params.id, businessId },
  });

  if (!approval) {
    return NextResponse.json({ error: "הבקשה לא נמצאה" }, { status: 404 });
  }

  // Only requester or owner can cancel
  if (approval.requestedByUserId !== session.user.id && !isOwner) {
    return NextResponse.json({ error: "אין הרשאה לביטול בקשה זו" }, { status: 403 });
  }

  if (approval.status !== "PENDING") {
    return NextResponse.json({ error: "הבקשה כבר טופלה" }, { status: 409 });
  }

  await prisma.pendingApproval.update({
    where: { id: params.id },
    data: { status: "CANCELLED", resolvedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

// ─── Action executor ──────────────────────────────────────────────────────────
// ⚠️  SECURITY: Any new manager-approval action MUST be added as a case here.
//    The default branch throws, preventing rogue/injected actions from executing.
//    Never remove the default throw — it is the security boundary.

/** A required id from the approval payload. A missing id must never reach a
 *  `where: { x: undefined }` filter — Prisma drops it and the query hits every row. */
function payloadId(payload: Record<string, unknown>, key: string): string {
  const v = payload?.[key];
  if (typeof v !== "string" || v.length === 0) throw new Error(`Missing ${key} in approval payload`);
  return v;
}

async function executeApprovedAction(
  action: string,
  payload: Record<string, unknown>,
  businessId: string
) {
  switch (action) {
    case "DELETE_CUSTOMER": {
      const cid = payloadId(payload, "customerId");
      // Same service as DELETE /api/customers/[id]: verifies ownership, keeps pets with
      // boarding/training history (FK Restrict) instead of failing half-way after the
      // invoices/payments/orders were already wiped.
      await deleteCustomer(businessId, prisma, cid);
      break;
    }
    case "DELETE_PET": {
      const id = payloadId(payload, "petId");
      // deletePet verifies ownership and runs the full sequential FK cleanup
      // (appointments, boarding, bookings, training, service-dog records)
      // before deleting — a bare prisma.pet.delete fails with a P2003
      // foreign-key error whenever the pet has any linked records.
      await deletePet(businessId, prisma, id);
      break;
    }
    case "DELETE_TRAINING": {
      const id = payloadId(payload, "trainingProgramId");
      // Booked meetings: cancel their appointments + reminders + gcal events first (rule #45).
      for (const apptId of await cancelAppointmentsOfProgram(businessId, prisma, id)) {
        await afterLinkedAppointmentCanceled(businessId, apptId);
      }
      await prisma.trainingProgram.delete({ where: { id, businessId } });
      break;
    }
    case "DELETE_APPOINTMENT": {
      const id = payloadId(payload, "appointmentId");
      // Same as the owner path: reminders + gcal event go first (needs gcalEventId), then the
      // service delete, which also removes a still-scheduled training meeting (rule #45).
      await afterLinkedAppointmentCanceled(businessId, id);
      await deleteAppointment(businessId, prisma, id);
      break;
    }
    case "DELETE_LEAD": {
      const id = payloadId(payload, "leadId");
      // Same service as the owner path in /api/leads/[id] DELETE (scoped by businessId,
      // also clears the lead's tasks).
      await deleteLead(businessId, prisma, id);
      await cancelLeadFollowup(id).catch((err) =>
        console.error("cancelLeadFollowup (approved delete) failed (non-critical):", err)
      );
      break;
    }
    case "DELETE_SERVICE_DOG": {
      const id = payloadId(payload, "serviceDogId");
      await deleteServiceDog(businessId, prisma, id);
      break;
    }
    case "DELETE_RECIPIENT": {
      const id = payloadId(payload, "recipientId");
      await deleteRecipient(businessId, prisma, id);
      break;
    }
    case "EDIT_PRICING": {
      const itemId = payloadId(payload, "itemId");
      const { itemId: _itemId, ...raw } = payload as { itemId: string; [k: string]: unknown };
      // Allowlist fields to prevent mass assignment
      const ALLOWED_PRICING_FIELDS = ["name", "basePrice", "description", "duration", "isActive", "maxParticipants", "serviceId"] as const;
      const pricingData: Record<string, unknown> = {};
      for (const key of ALLOWED_PRICING_FIELDS) {
        if (key in raw) pricingData[key] = raw[key];
      }
      await prisma.priceListItem.update({
        where: { id: itemId, businessId },
        data: pricingData as Parameters<typeof prisma.priceListItem.update>[0]["data"],
      });
      break;
    }
    case "EDIT_SETTINGS": {
      // Allowlist fields to prevent mass assignment of sensitive business fields
      const ALLOWED_SETTINGS_FIELDS = [
        "name", "phone", "email", "address", "city", "description",
        "logoUrl", "timezone", "currency", "businessType",
        "bookingEnabled", "bookingNotes", "cancellationPolicy",
      ] as const;
      const settingsData: Record<string, unknown> = {};
      for (const key of ALLOWED_SETTINGS_FIELDS) {
        if (key in payload) settingsData[key] = payload[key];
      }
      await prisma.business.update({
        where: { id: businessId },
        data: settingsData as Parameters<typeof prisma.business.update>[0]["data"],
      });
      break;
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
