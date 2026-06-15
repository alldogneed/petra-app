export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";
import { createPendingApproval } from "@/lib/pending-approvals";
import { getRecipient, updateRecipient, deleteRecipient, ServiceError } from "@/services/service-dogs";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    const callerMembership = session.memberships.find((m) => m.businessId === businessId && m.isActive);
    if (callerMembership && !hasTenantPermission(callerMembership.role as TenantRole, TENANT_PERMS.RECIPIENTS_SENSITIVE)) {
      return NextResponse.json({ error: "אין הרשאה לצפות בזכאים" }, { status: 403 });
    }

    const membership = session.memberships.find((m) => m.businessId === businessId);
    const callerRole = (membership?.role ?? "user") as TenantRole;
    const canSeeSensitive = hasTenantPermission(callerRole, TENANT_PERMS.RECIPIENTS_SENSITIVE);

    let data;
    try {
      data = await getRecipient(businessId, prisma, params.id, canSeeSensitive);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "זכאי לא נמצא" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/service-recipients/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת זכאי" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    const patchMembership = session.memberships.find((m) => m.businessId === businessId && m.isActive);
    if (patchMembership && !hasTenantPermission(patchMembership.role as TenantRole, TENANT_PERMS.RECIPIENTS_SENSITIVE)) {
      return NextResponse.json({ error: "אין הרשאה לנהל זכאים" }, { status: 403 });
    }

    const body = await request.json();

    let updated;
    try {
      updated = await updateRecipient(businessId, prisma, params.id, body);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "זכאי לא נמצא" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/service-recipients/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון זכאי" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    const membership = session.memberships.find((m) => m.businessId === businessId);
    const callerRole = (membership?.role ?? "user") as TenantRole;

    if (callerRole === "user" || callerRole === "volunteer") {
      return NextResponse.json({ error: "אין הרשאה למחיקה" }, { status: 403 });
    }

    if (callerRole === "manager") {
      // Need the name for the approval description — fetch it first
      const existing = await prisma.serviceDogRecipient.findFirst({
        where: { id: params.id, businessId },
        select: { id: true, name: true },
      });
      if (!existing) return NextResponse.json({ error: "זכאי לא נמצא" }, { status: 404 });

      const approval = await createPendingApproval({
        businessId,
        requestedByUserId: session.user.id,
        action: "DELETE_CUSTOMER",
        description: `מחיקת זכאי: ${existing.name}`,
        payload: { recipientId: params.id, recipientName: existing.name },
      });
      return NextResponse.json(
        { pendingApproval: true, approvalId: approval.id, message: "הבקשה נשלחה לאישור הבעלים" },
        { status: 202 }
      );
    }

    // Owner — require confirmation header
    const confirmHeader = request.headers.get("x-confirm-action");
    if (confirmHeader !== `DELETE_RECIPIENT_${params.id}`) {
      return NextResponse.json(
        { error: "נדרש אישור מפורש למחיקה", requireConfirmation: true },
        { status: 428 }
      );
    }

    try {
      await deleteRecipient(businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "זכאי לא נמצא" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/service-recipients/[id] error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת זכאי" }, { status: 500 });
  }
}
