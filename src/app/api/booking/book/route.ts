export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { enqueueSyncJob } from "@/lib/sync-jobs";

// Public endpoint - no auth required
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serviceId, date, time, customerName, customerPhone, customerEmail, notes } = body;

    if (!serviceId || !date || !time || !customerName || !customerPhone) {
      return NextResponse.json(
        { error: "שדות חובה חסרים" },
        { status: 400 }
      );
    }

    // Get service for duration
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      return NextResponse.json({ error: "שירות לא נמצא" }, { status: 404 });
    }

    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: {
        businessId: DEMO_BUSINESS_ID,
        phone: customerPhone,
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          businessId: DEMO_BUSINESS_ID,
          name: customerName,
          phone: customerPhone,
          email: customerEmail || null,
        },
      });
    }

    // Calculate start and end times
    const [h, m] = time.split(":").map(Number);
    const startAt = new Date(date);
    startAt.setHours(h, m, 0, 0);
    const endAt = new Date(startAt.getTime() + (service.duration || 60) * 60000);

    // Check for conflicts
    const conflict = await prisma.booking.findFirst({
      where: {
        businessId: DEMO_BUSINESS_ID,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        status: { in: ["pending", "confirmed"] },
      },
    });

    if (conflict) {
      return NextResponse.json(
        { error: "המשבצת כבר תפוסה. נסה שעה אחרת." },
        { status: 409 }
      );
    }

    const booking = await prisma.booking.create({
      data: {
        businessId: DEMO_BUSINESS_ID,
        serviceId,
        customerId: customer.id,
        startAt,
        endAt,
        status: "pending",
        notes: notes || null,
        source: "online",
      },
      include: {
        service: true,
        customer: true,
      },
    });

    // Enqueue Google Calendar sync (fire-and-forget, don't block response)
    enqueueSyncJob(booking.id, DEMO_BUSINESS_ID, "create").catch((err) =>
      console.error("Failed to enqueue sync job:", err)
    );

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error("POST booking error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת הזמנה" }, { status: 500 });
  }
}
