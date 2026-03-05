export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/slots";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr   = searchParams.get("date");
    const serviceId = searchParams.get("serviceId");

    if (!dateStr || !serviceId) {
      return NextResponse.json(
        { error: "date and serviceId are required" },
        { status: 400 }
      );
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        businessId: true,
        duration: true,
        bufferBefore: true,
        bufferAfter: true,
      },
    });
    if (!service) {
      return NextResponse.json({ error: "שירות לא נמצא" }, { status: 404 });
    }

    const slots = await getAvailableSlots(
      service.businessId,
      service.duration ?? 60,
      dateStr,
      service.bufferBefore ?? 0,
      service.bufferAfter  ?? 0,
    );

    return NextResponse.json(
      slots.map((s) => ({ time: s.time, available: true }))
    );
  } catch (error) {
    console.error("GET slots error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת משבצות" }, { status: 500 });
  }
}
