export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { enqueueSyncJob } from "@/lib/sync-jobs";
import { rateLimit } from "@/lib/rate-limit";

// Public endpoint - no auth required
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // Rate limit by IP: 10 bookings per minute
    const rlIp = rateLimit("api:booking:create", ip, { max: 10, windowMs: 60 * 1000 });
    if (!rlIp.allowed) {
      return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });
    }

    const body = await request.json();
    const { serviceId, date, time, customerName, customerPhone, customerEmail, notes } = body;

    // Rate limit by phone: 5 bookings per hour (prevents fake customer creation)
    if (customerPhone) {
      const rlPhone = rateLimit("api:booking:phone:" + customerPhone, "global", { max: 5, windowMs: 60 * 60 * 1000 });
      if (!rlPhone.allowed) {
        return NextResponse.json({ error: "יותר מדי בקשות ממספר זה. נסה שוב מאוחר יותר." }, { status: 429 });
      }
    }

    if (!serviceId || !date || !time || !customerName || !customerPhone) {
      return NextResponse.json(
        { error: "שדות חובה חסרים" },
        { status: 400 }
      );
    }

    // Get service for duration + businessId
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      return NextResponse.json({ error: "שירות לא נמצא" }, { status: 404 });
    }

    const businessId = service.businessId;

    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: {
        businessId,
        phone: customerPhone,
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          businessId,
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
        businessId,
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
        businessId,
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
    enqueueSyncJob(booking.id, businessId, "create").catch((err) =>
      console.error("Failed to enqueue sync job:", err)
    );

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error("POST booking error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת הזמנה" }, { status: 500 });
  }
}
