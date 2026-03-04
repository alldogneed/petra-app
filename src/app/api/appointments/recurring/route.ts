export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// POST /api/appointments/recurring
// Body: { date, startTime, endTime, serviceId, customerId, petId?, notes?,
//         repeatEvery: "week"|"2weeks"|"month", occurrences: number }
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const {
      date,
      startTime,
      endTime,
      serviceId,
      priceListItemId,
      customerId,
      petId,
      notes,
      repeatEvery,
      occurrences,
    } = body;

    if (!date || !startTime || !endTime || !customerId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const count = Math.min(Math.max(Number(occurrences) || 1, 1), 52);
    const intervalDays =
      repeatEvery === "2weeks" ? 14 : repeatEvery === "month" ? 28 : 7;

    const baseDate = new Date(date);
    const data = Array.from({ length: count }, (_, i) => {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i * intervalDays);
      return {
        date: d,
        startTime,
        endTime,
        serviceId: serviceId || null,
        priceListItemId: priceListItemId || null,
        customerId,
        petId: petId || null,
        notes: notes || null,
        status: "scheduled",
        businessId: authResult.businessId,
      };
    });

    const result = await prisma.appointment.createMany({ data });

    return NextResponse.json({ created: result.count }, { status: 201 });
  } catch (error) {
    console.error("POST /api/appointments/recurring error:", error);
    return NextResponse.json(
      { error: "Failed to create recurring appointments" },
      { status: 500 }
    );
  }
}
