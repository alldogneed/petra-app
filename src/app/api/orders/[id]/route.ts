export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const order = await prisma.order.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        lines: {
          include: { priceListItem: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
        payments: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

    const existing = await prisma.order.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Validate allowed values
    const VALID_STATUSES = ["draft", "confirmed", "in_progress", "completed", "cancelled"];
    const VALID_ORDER_TYPES = ["one_time", "recurring", "package"];

    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }
    if (body.orderType !== undefined && !VALID_ORDER_TYPES.includes(body.orderType)) {
      return NextResponse.json({ error: "Invalid orderType value" }, { status: 400 });
    }
    if (body.notes !== undefined && typeof body.notes === "string" && body.notes.length > 2000) {
      return NextResponse.json({ error: "Notes too long (max 2000 chars)" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.orderType !== undefined) data.orderType = body.orderType;

    const order = await prisma.order.update({
      where: { id: params.id, businessId: authResult.businessId },
      data,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        lines: true,
        payments: true,
      },
    });

    // Cancel pending reminders when order is cancelled
    if (body.status === "cancelled") {
      await prisma.scheduledMessage.updateMany({
        where: {
          businessId: authResult.businessId,
          relatedEntityType: "ORDER",
          relatedEntityId: params.id,
          status: "PENDING",
        },
        data: { status: "CANCELED" },
      });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    // Only allow deleting draft orders
    const order = await prisma.order.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (!["draft", "cancelled"].includes(order.status)) {
      return NextResponse.json({ error: "Only draft or cancelled orders can be deleted" }, { status: 400 });
    }

    // Cancel any pending reminders
    await prisma.scheduledMessage.updateMany({
      where: {
        businessId: authResult.businessId,
        relatedEntityType: "ORDER",
        relatedEntityId: params.id,
        status: "PENDING",
      },
      data: { status: "CANCELED" },
    });

    await prisma.order.delete({ where: { id: params.id, businessId: authResult.businessId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting order:", error);
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 });
  }
}
