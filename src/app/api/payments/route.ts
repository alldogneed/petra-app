import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: any = { businessId: DEMO_BUSINESS_ID };
    if (status) {
      where.status = status;
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        customer: {
          select: { name: true, phone: true },
        },
        appointment: {
          include: {
            service: { select: { name: true } },
          },
        },
        boardingStay: {
          include: {
            pet: { select: { name: true } },
            room: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error("Failed to fetch payments:", error);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { amount, method, status, customerId, appointmentId, boardingStayId } =
      body;

    if (!amount || !method || !status || !customerId) {
      return NextResponse.json(
        { error: "Missing required fields: amount, method, status, customerId" },
        { status: 400 }
      );
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    const validMethods = ["cash", "credit_card", "bank_transfer", "bit", "paybox", "check"];
    if (!validMethods.includes(method)) {
      return NextResponse.json(
        { error: "Invalid payment method" },
        { status: 400 }
      );
    }

    const validStatuses = ["pending", "paid", "canceled"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid payment status" },
        { status: 400 }
      );
    }

    const payment = await prisma.payment.create({
      data: {
        amount,
        method,
        status,
        customerId,
        appointmentId: appointmentId || null,
        boardingStayId: boardingStayId || null,
        businessId: DEMO_BUSINESS_ID,
      },
      include: {
        customer: {
          select: { name: true, phone: true },
        },
        appointment: {
          include: {
            service: { select: { name: true } },
          },
        },
        boardingStay: {
          include: {
            pet: { select: { name: true } },
            room: { select: { name: true } },
          },
        },
      },
    });

    logCurrentUserActivity("CREATE_PAYMENT");
    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error("Failed to create payment:", error);
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}
