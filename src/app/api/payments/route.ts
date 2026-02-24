import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { logCurrentUserActivity } from "@/lib/activity-log";

export async function GET(request: NextRequest) {
  try {
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
    const body = await request.json();
    const { amount, method, status, customerId, appointmentId, boardingStayId } =
      body;

    if (!amount || !method || !status || !customerId) {
      return NextResponse.json(
        { error: "Missing required fields: amount, method, status, customerId" },
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
