export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/slots";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr         = searchParams.get("date");
    const serviceId       = searchParams.get("serviceId");
    const priceListItemId = searchParams.get("priceListItemId");

    if (!dateStr || (!serviceId && !priceListItemId)) {
      return NextResponse.json(
        { error: "date and serviceId (or priceListItemId) are required" },
        { status: 400 }
      );
    }

    let businessId: string;
    let duration: number;
    let bufferBefore = 0;
    let bufferAfter  = 0;

    if (serviceId) {
      const service = await prisma.service.findUnique({
        where: { id: serviceId },
        select: { businessId: true, duration: true, bufferBefore: true, bufferAfter: true },
      });
      if (!service) return NextResponse.json({ error: "שירות לא נמצא" }, { status: 404 });
      businessId   = service.businessId;
      duration     = service.duration ?? 60;
      bufferBefore = service.bufferBefore ?? 0;
      bufferAfter  = service.bufferAfter  ?? 0;
    } else {
      const item = await prisma.priceListItem.findUnique({
        where: { id: priceListItemId! },
        select: { businessId: true, durationMinutes: true },
      });
      if (!item) return NextResponse.json({ error: "פריט מחירון לא נמצא" }, { status: 404 });
      businessId = item.businessId;
      duration   = item.durationMinutes ?? 60;
    }

    const slots = await getAvailableSlots(
      businessId,
      duration,
      dateStr,
      bufferBefore,
      bufferAfter,
    );

    return NextResponse.json(
      slots.map((s) => ({ time: s.time, available: true }))
    );
  } catch (error) {
    console.error("GET slots error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת משבצות" }, { status: 500 });
  }
}
