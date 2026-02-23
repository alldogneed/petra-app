import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/payments/[id] – get a single payment
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: params.id },
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
    const body = await request.json();

    const payment = await prisma.payment.update({
      where: { id: params.id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.method !== undefined && { method: body.method }),
        ...(body.amount !== undefined && { amount: body.amount }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
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
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.payment.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE payment error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת תשלום" }, { status: 500 });
  }
}
