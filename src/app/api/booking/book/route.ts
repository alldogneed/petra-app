export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { enqueueSyncJob } from "@/lib/sync-jobs";
import { rateLimit } from "@/lib/rate-limit";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { toWhatsAppPhone } from "@/lib/utils";
import { notifyNewBooking } from "@/lib/engagement-service";
import { localTimeToUtc } from "@/lib/slots";
import { sanitizeName, validateName, validateIsraeliPhone, validateEmail, normalizeIsraeliPhone } from "@/lib/validation";

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
    const { priceListItemId, date, time, customerName, customerPhone, customerEmail, notes } = body;

    // Rate limit by phone: 5 bookings per hour (prevents fake customer creation)
    if (customerPhone) {
      const rlPhone = rateLimit("api:booking:phone:" + customerPhone, "global", { max: 5, windowMs: 60 * 60 * 1000 });
      if (!rlPhone.allowed) {
        return NextResponse.json({ error: "יותר מדי בקשות ממספר זה. נסה שוב מאוחר יותר." }, { status: 429 });
      }
    }

    if (!priceListItemId || !date || !time || !customerName || !customerPhone) {
      return NextResponse.json(
        { error: "שדות חובה חסרים" },
        { status: 400 }
      );
    }

    // Validate and sanitize inputs
    const nameError = validateName(customerName);
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 });
    }
    const sanitizedName = sanitizeName(customerName).slice(0, 100);

    const phoneError = validateIsraeliPhone(customerPhone);
    if (phoneError) {
      return NextResponse.json({ error: phoneError }, { status: 400 });
    }
    const normalizedPhone = normalizeIsraeliPhone(customerPhone);

    if (customerEmail) {
      const emailError = validateEmail(customerEmail);
      if (emailError) {
        return NextResponse.json({ error: emailError }, { status: 400 });
      }
    }

    // Limit notes length (same as authenticated endpoint)
    if (notes && typeof notes === "string" && notes.length > 2000) {
      return NextResponse.json(
        { error: "הערות ארוכות מדי — מקסימום 2000 תווים" },
        { status: 400 }
      );
    }

    // Get price list item for duration + businessId
    const item = await prisma.priceListItem.findUnique({ where: { id: priceListItemId } });
    if (!item) {
      return NextResponse.json({ error: "שירות לא נמצא" }, { status: 404 });
    }

    const businessId = item.businessId;
    const duration = item.durationMinutes ?? 60;

    // Find or create customer (retry on race condition — no unique constraint on phone)
    let customer = await prisma.customer.findFirst({
      where: {
        businessId,
        phone: normalizedPhone,
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          businessId,
          name: sanitizedName,
          phone: normalizedPhone,
          email: customerEmail?.trim().toLowerCase() || null,
        },
      }).catch(async () => {
        // Race condition: another request created the same customer between our read and write
        const existing = await prisma.customer.findFirst({
          where: { businessId, phone: normalizedPhone },
        });
        if (!existing) throw new Error("Failed to create or find customer");
        return existing;
      });
    }

    // Calculate start and end times in Israel timezone
    const [h, m] = time.split(":").map(Number);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      return NextResponse.json({ error: "שעה לא תקינה" }, { status: 400 });
    }
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date + "T00:00:00Z").getTime())) {
      return NextResponse.json({ error: "תאריך לא תקין" }, { status: 400 });
    }
    // Use existing localTimeToUtc helper for proper Israel timezone conversion
    const startAt = localTimeToUtc(time, date, "Asia/Jerusalem");
    const endAt = new Date(startAt.getTime() + duration * 60000);

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
        priceListItemId,
        customerId: customer.id,
        startAt,
        endAt,
        status: "pending",
        notes: notes ? String(notes).slice(0, 2000) : null,
        source: "online",
        customerToken: require("crypto").randomBytes(32).toString("hex"),
      },
      include: {
        priceListItem: true,
        customer: true,
      },
    });

    // Enqueue Google Calendar sync (fire-and-forget, don't block response)
    enqueueSyncJob(booking.id, businessId, "create").catch((err) =>
      console.error("Failed to enqueue sync job:", err)
    );

    // In-app notification to business owners
    notifyNewBooking(
      businessId,
      booking.customer.name,
      booking.priceListItem?.name ?? "שירות",
      booking.id
    );

    // Send WhatsApp confirmations (fire-and-forget)
    Promise.resolve().then(async () => {
      try {
        const business = await prisma.business.findUnique({
          where: { id: businessId },
          select: { name: true, phone: true },
        });

        const fmt = new Intl.DateTimeFormat("he-IL", {
          timeZone: "Asia/Jerusalem",
          day: "2-digit", month: "2-digit", year: "numeric",
        });
        const fmtTime = new Intl.DateTimeFormat("he-IL", {
          timeZone: "Asia/Jerusalem",
          hour: "2-digit", minute: "2-digit", hour12: false,
        });
        const dateStr = fmt.format(booking.startAt);
        const timeStr = fmtTime.format(booking.startAt);
        const serviceName = booking.priceListItem?.name ?? "";

        if (booking.customer.phone) {
          await sendWhatsAppMessage({
            to: toWhatsAppPhone(booking.customer.phone),
            body: `שלום ${booking.customer.name}! ✅\nההזמנה שלך אושרה.\n📋 שירות: ${serviceName}\n📅 תאריך: ${dateStr}\n⏰ שעה: ${timeStr}\nנשמח לראותך! – ${business?.name ?? ""}`,
          });
        }

        if (business?.phone) {
          await sendWhatsAppMessage({
            to: toWhatsAppPhone(business.phone),
            body: `🔔 הזמנה חדשה!\n👤 ${booking.customer.name}\n📞 ${booking.customer.phone}\n📋 ${serviceName}\n📅 ${dateStr} בשעה ${timeStr}`,
          });
        }
      } catch (err) {
        console.error("WhatsApp booking confirmation error:", err);
      }
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error("POST booking error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת הזמנה" }, { status: 500 });
  }
}
