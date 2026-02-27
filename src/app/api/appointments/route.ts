export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { scheduleAppointmentReminder } from "@/lib/reminder-service";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { businessId: DEMO_BUSINESS_ID };

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        service: true,
        customer: true,
        pet: true,
      },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(appointments);
  } catch (error) {
    console.error("Failed to fetch appointments:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { date, startTime, endTime, serviceId, customerId, petId, notes } =
      body;

    if (!date || !startTime || !endTime || !serviceId || !customerId) {
      return NextResponse.json(
        { error: "Missing required fields: date, startTime, endTime, serviceId, customerId" },
        { status: 400 }
      );
    }

    const appointment = await prisma.appointment.create({
      data: {
        date: new Date(date),
        startTime,
        endTime,
        serviceId,
        customerId,
        petId: petId || null,
        notes: notes || null,
        status: "scheduled",
        businessId: DEMO_BUSINESS_ID,
      },
      include: {
        service: true,
        customer: true,
        pet: true,
      },
    });

    logCurrentUserActivity("CREATE_APPOINTMENT");

    // Schedule a WhatsApp reminder 24h before (fire-and-forget, don't block response)
    scheduleAppointmentReminder({
      id: appointment.id,
      businessId: DEMO_BUSINESS_ID,
      customerId: appointment.customerId,
      date: appointment.date,
      startTime: appointment.startTime,
      service: { name: appointment.service.name },
      customer: { name: appointment.customer.name },
      pet: appointment.pet ? { name: appointment.pet.name } : null,
    }).catch((err) => console.error("Failed to schedule appointment reminder:", err));

    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    console.error("Failed to create appointment:", error);
    return NextResponse.json(
      { error: "Failed to create appointment" },
      { status: 500 }
    );
  }
}
