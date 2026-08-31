export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { sendPaymentRequestForOrder } from "@/lib/payment-request";
import { getOrder, updateOrder, deleteOrder, ServiceError } from "@/services/orders";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    try {
      const order = await getOrder(authResult.businessId, prisma, params.id);
      return NextResponse.json(order);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") return NextResponse.json({ error: "Order not found" }, { status: 404 });
      throw e;
    }
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

    // Line editing is draft-only, and the confirm claim below changes status BEFORE
    // the service validates lines — a combined {status:"confirmed", lines} body would
    // confirm the order and then 400 on the lines, leaving partial state. Reject the
    // combination up front (the UI never sends both together).
    if (body.lines !== undefined && body.status !== undefined && body.status !== "draft") {
      return NextResponse.json(
        { error: "לא ניתן לעדכן פריטים ולשנות סטטוס באותה בקשה" },
        { status: 400 }
      );
    }

    // Atomically claim the draft→confirmed transition BEFORE the service update:
    // updateMany with status:"draft" in the where-clause flips at most one row, so
    // two concurrent confirm PATCHes (double-click) can't both observe "draft" —
    // only the request whose claim count === 1 fires the payment request below.
    // (A read-then-compare here was racy.) The service update afterwards is a
    // no-op for status but still applies notes/orderType and runs validation.
    let claimedDraftToConfirmed = false;
    if (body.status === "confirmed") {
      const claim = await prisma.order.updateMany({
        where: { id: params.id, businessId: authResult.businessId, status: "draft" },
        data: { status: "confirmed" },
      });
      claimedDraftToConfirmed = claim.count === 1;
    }

    let order;
    try {
      order = await updateOrder(authResult.businessId, prisma, params.id, {
        status: body.status,
        notes: body.notes,
        orderType: body.orderType,
        // Draft-only line editing — service rejects with VALIDATION for non-draft orders
        lines: body.lines,
        discountType: body.discountType,
        discountValue: body.discountValue,
      });
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json({ error: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 400 });
      }
      throw e;
    }

    // payment_request automation — fires ONLY when THIS request atomically claimed
    // the draft→confirmed transition above (concurrent PATCHes can't both claim;
    // confirmed→confirmed never fires). Note: reverting to draft and re-confirming
    // legitimately re-sends — but the already-fully-paid guard inside
    // sendPaymentRequestForOrder prevents requesting money already collected.
    if (claimedDraftToConfirmed && order.status === "confirmed") {
      await sendPaymentRequestForOrder(params.id, authResult.businessId, "order_confirmed").catch(
        (err) => console.error("sendPaymentRequestForOrder (confirm) failed (non-critical):", err)
      );
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

    try {
      await deleteOrder(authResult.businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json({ error: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 400 });
      }
      throw e;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting order:", error);
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 });
  }
}
