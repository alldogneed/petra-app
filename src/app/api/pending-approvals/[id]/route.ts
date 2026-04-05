import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { hasTenantPermission, TENANT_PERMS } from "@/lib/permissions";

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

async function executeApprovedAction(
  action: string,
  payload: Record<string, unknown>,
  businessId: string
) {
  switch (action) {
    case "DELETE_CUSTOMER": {
      const id = payload.customerId as string;
      await prisma.customer.delete({ where: { id, businessId } });
      break;
    }
    case "DELETE_PET": {
      const id = payload.petId as string;
      // Verify the pet belongs to this business
      const pet = await prisma.pet.findFirst({
        where: {
          id,
          OR: [
            { customer: { businessId } },
            { businessId },
          ],
        },
      });
      if (!pet) throw new Error("Pet not found in business");
      await prisma.pet.delete({ where: { id } });
      break;
    }
    case "DELETE_TRAINING": {
      const id = payload.trainingProgramId as string;
      await prisma.trainingProgram.delete({ where: { id, businessId } });
      break;
    }
    case "DELETE_APPOINTMENT": {
      const id = payload.appointmentId as string;
      await prisma.appointment.delete({ where: { id, businessId } });
      break;
    }
    case "EDIT_PRICING": {
      const { itemId, ...raw } = payload as { itemId: string; [k: string]: unknown };
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
