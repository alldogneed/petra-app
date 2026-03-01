export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

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
    const authResult = await requireBusinessAuth(request);
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
      data.status = body.status;
      // Auto-set paidAt when status changes to paid
      if (body.status === "paid" && !existing.paidAt) {
        data.paidAt = new Date();
      }
    }
    if (body.method !== undefined) data.method = body.method;
    if (body.amount !== undefined) data.amount = body.amount;
    if (body.notes !== undefined) data.notes = body.notes;

    const payment = await prisma.payment.update({
      where: { id: params.id, businessId: authResult.businessId },
      data,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
      },
    });

    return NextResponse.json(payment);
  } catch (error) {
    console.error("PATCH payment error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון תשלום" }, { status: 500 });
  }
}

// DELETE /api/payments/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const existing = await prisma.payment.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "תשלום לא נמצא" }, { status: 404 });
    }

    await prisma.payment.delete({ where: { id: params.id, businessId: authResult.businessId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE payment error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת תשלום" }, { status: 500 });
  }
}
