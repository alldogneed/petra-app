export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { scheduleAppointmentReminder } from "@/lib/reminder-service";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { businessId: authResult.businessId };

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const appointments = await prisma.appointment.findMany({
      where,
      select: {
        id: true, date: true, startTime: true, endTime: true,
        status: true, notes: true, cancellationNote: true,
        businessId: true, createdAt: true, updatedAt: true,
        serviceId: true, customerId: true, petId: true,
        service: { select: { id: true, name: true, color: true, type: true, duration: true, price: true } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
        pet: { select: { id: true, name: true, species: true, breed: true } },
      },
      orderBy: { date: "asc" },
      take: 500,
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
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:appointments:write", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי בקשות" }, { status: 429 });
    }

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
        businessId: authResult.businessId,
      },
      select: {
        id: true, date: true, startTime: true, endTime: true,
        status: true, notes: true, cancellationNote: true,
        businessId: true, createdAt: true, updatedAt: true,
        serviceId: true, customerId: true, petId: true,
        service: { select: { id: true, name: true, color: true, type: true, duration: true, price: true } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
        pet: { select: { id: true, name: true, species: true, breed: true } },
      },
    });

    logCurrentUserActivity("CREATE_APPOINTMENT");

    // Schedule a WhatsApp reminder 24h before (fire-and-forget, don't block response)
    scheduleAppointmentReminder({
      id: appointment.id,
      businessId: authResult.businessId,
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
