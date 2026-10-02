export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError, requireBusinessPermission } from "@/lib/auth-guards";
import { TENANT_PERMS, type TenantRole } from "@/lib/permissions";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";
import { ENTITY_TYPES } from "@/lib/activity-actions";

function paymentLabel(p: { amount?: number | null; customer?: { name?: string | null } | null }): string {
  return `תשלום ₪${Number(p.amount ?? 0).toLocaleString("he-IL")} — ${p.customer?.name ?? ""}`;
}

// GET /api/payments/[id] – get a single payment
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const payment = await prisma.payment.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        appointment: {
          include: { service: { select: { name: true } } },
        },
        boardingStay: {
          include: {
            pet: { select: { name: true } },
            room: { select: { name: true } },
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "תשלום לא נמצא" }, { status: 404 });
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error("GET payment error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת תשלום" }, { status: 500 });
  }
}

// PATCH /api/payments/[id] – update payment (status, notes)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessPermission(request, TENANT_PERMS.PAYMENTS_WRITE);
    if (isGuardError(authResult)) return authResult;

    // Verify payment belongs to this business
    const existing = await prisma.payment.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "תשלום לא נמצא" }, { status: 404 });
    }

    const body = await request.json();

    const data: Record<string, unknown> = {};
    if (body.status !== undefined) {
      const validStatuses = ["pending", "paid", "canceled", "refunded"];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: "Invalid payment status" }, { status: 400 });
      }
      data.status = body.status;
      // Auto-set paidAt when status changes to paid
      if (body.status === "paid" && !existing.paidAt) {
        data.paidAt = new Date();
      }
    }
    if (body.method !== undefined) {
      const validMethods = ["cash", "credit_card", "bank_transfer", "bit", "paybox", "check"];
      if (!validMethods.includes(body.method)) {
        return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
      }
      data.method = body.method;
    }
    if (body.amount !== undefined) {
      if (typeof body.amount !== "number" || body.amount <= 0) {
        return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
      }
      data.amount = body.amount;
    }
    if (body.notes !== undefined) {
      if (typeof body.notes === "string" && body.notes.length > 2000) {
        return NextResponse.json({ error: "הערות ארוכות מדי (מקסימום 2000 תווים)" }, { status: 400 });
      }
      data.notes = body.notes;
    }

    const payment = await prisma.payment.update({
      where: { id: params.id, businessId: authResult.businessId },
      data,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
      },
    });

    // Audit: a status change to canceled/refunded is sensitive (awaited so the
    // owner security alert completes); any other edit is a routine UPDATE_PAYMENT.
    if (Object.keys(data).length > 0) {
      const statusChanged = data.status !== undefined && data.status !== existing.status;
      const action =
        statusChanged && data.status === "canceled" ? ACTIVITY_ACTIONS.CANCEL_PAYMENT :
        statusChanged && data.status === "refunded" ? ACTIVITY_ACTIONS.REFUND_PAYMENT :
        ACTIVITY_ACTIONS.UPDATE_PAYMENT;
      await logActivity(authResult.session.user.id, authResult.session.user.name, action, {
        businessId: authResult.businessId,
        entityType: ENTITY_TYPES.PAYMENT,
        entityId: params.id,
        entityLabel: paymentLabel(payment),
      });
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error("PATCH payment error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון תשלום" }, { status: 500 });
  }
}

// DELETE /api/payments/[id] — owner only
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessPermission(request, TENANT_PERMS.PAYMENTS_WRITE);
    if (isGuardError(authResult)) return authResult;
    const { session, businessId } = authResult;

    const membership = session.memberships.find((m) => m.businessId === businessId);
    const callerRole = (membership?.role ?? "user") as TenantRole;

    // Only owner can delete payments
    if (callerRole !== "owner") {
      return NextResponse.json({ error: "רק בעלים יכול למחוק תשלום" }, { status: 403 });
    }

    const existing = await prisma.payment.findFirst({
      where: { id: params.id, businessId },
      include: { customer: { select: { name: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "תשלום לא נמצא" }, { status: 404 });
    }

    await prisma.payment.delete({ where: { id: params.id, businessId } });
    await logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.DELETE_PAYMENT, {
      businessId,
      entityType: ENTITY_TYPES.PAYMENT,
      entityId: params.id,
      entityLabel: paymentLabel(existing),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE payment error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת תשלום" }, { status: 500 });
  }
}
