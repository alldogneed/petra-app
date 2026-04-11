export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { scheduleAppointmentReminder } from "@/lib/reminder-service";
import { syncAppointmentToGcal } from "@/lib/google-calendar";
import { sendWhatsAppTemplate, sendWhatsAppMessage, interpolateTemplate } from "@/lib/whatsapp";
import { toWhatsAppPhone } from "@/lib/utils";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getMaxAppointments, normalizeTier, hasFeatureWithOverrides } from "@/lib/feature-flags";
import { localTimeToUtc } from "@/lib/slots";

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
      if (from) {
        const d = new Date(from);
        if (isNaN(d.getTime())) return NextResponse.json({ error: "Invalid from date" }, { status: 400 });
        where.date.gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (isNaN(d.getTime())) return NextResponse.json({ error: "Invalid to date" }, { status: 400 });
        where.date.lte = d;
      }
    }

    const appointments = await prisma.appointment.findMany({
      where,
      select: {
        id: true, date: true, startTime: true, endTime: true,
        status: true, notes: true, cancellationNote: true,
        businessId: true, createdAt: true, updatedAt: true,
        serviceId: true, customerId: true, petId: true,
        service: { select: { id: true, name: true, color: true, type: true, duration: true, price: true } },
        priceListItem: { select: { id: true, name: true, category: true, durationMinutes: true, basePrice: true } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
        pet: { select: { id: true, name: true, species: true, breed: true } },
        staff: { select: { id: true, name: true } },
      },
      orderBy: { date: "asc" },
      take: 200,
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

    // Enforce appointment limit for free tier
    const business = await prisma.business.findUnique({ where: { id: authResult.businessId }, select: { tier: true, timezone: true, featureOverrides: true } });
    const maxAppts = getMaxAppointments(normalizeTier(business?.tier));
    if (maxAppts !== null) {
      const totalCount = await prisma.appointment.count({
        where: { businessId: authResult.businessId, status: { notIn: ["CANCELED"] } },
      });
      if (totalCount >= maxAppts) {
        return NextResponse.json(
          { error: `הגעת לתקרת ${maxAppts} התורים במסלול החינמי. שדרג לבייסיק כדי להוסיף ללא הגבלה.`, code: "LIMIT_REACHED" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const { date, startTime, endTime, serviceId, priceListItemId, customerId, petId, notes } =
      body;

    if (!date || !startTime || !endTime || !customerId) {
      return NextResponse.json(
        { error: "Missing required fields: date, startTime, endTime, customerId" },
        { status: 400 }
      );
    }
    if (notes && typeof notes === "string" && notes.length > 2000) {
      return NextResponse.json({ error: "הערות ארוכות מדי (מקסימום 2000 תווים)" }, { status: 400 });
    }
    if (!serviceId && !priceListItemId) {
      return NextResponse.json(
        { error: "Either serviceId or priceListItemId is required" },
        { status: 400 }
      );
    }

    // ── IDOR Prevention: validate all referenced entity IDs belong to this business ──
    const customerCheck = await prisma.customer.findFirst({
      where: { id: customerId, businessId: authResult.businessId },
      select: { id: true },
    });
    if (!customerCheck) {
      return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    }

    if (petId) {
      const petCheck = await prisma.pet.findFirst({
        where: { id: petId, OR: [{ customer: { businessId: authResult.businessId } }, { businessId: authResult.businessId }] },
        select: { id: true },
      });
      if (!petCheck) {
        return NextResponse.json({ error: "חיית מחמד לא נמצאה" }, { status: 404 });
      }
    }

    if (serviceId) {
      const serviceCheck = await prisma.service.findFirst({
        where: { id: serviceId, businessId: authResult.businessId },
        select: { id: true },
      });
      if (!serviceCheck) {
        return NextResponse.json({ error: "שירות לא נמצא" }, { status: 404 });
      }
    }

    if (priceListItemId) {
      const pliCheck = await prisma.priceListItem.findFirst({
        where: { id: priceListItemId, priceList: { businessId: authResult.businessId } },
        select: { id: true },
      });
      if (!pliCheck) {
        return NextResponse.json({ error: "פריט מחירון לא נמצא" }, { status: 404 });
      }
    }

    // Validate time format (HH:mm)
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json(
        { error: "startTime and endTime must be in HH:mm format" },
        { status: 400 }
      );
    }
    if (startTime >= endTime) {
      return NextResponse.json(
        { error: "startTime must be before endTime" },
        { status: 400 }
      );
    }

    const appointment = await prisma.appointment.create({
      data: {
        date: new Date(date),
        startTime,
        endTime,
        serviceId: serviceId || null,
        priceListItemId: priceListItemId || null,
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
        serviceId: true, priceListItemId: true, customerId: true, petId: true,
        service: { select: { id: true, name: true, color: true, type: true, duration: true, price: true } },
        priceListItem: { select: { id: true, name: true, category: true, durationMinutes: true, basePrice: true } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
        pet: { select: { id: true, name: true, species: true, breed: true } },
        staff: { select: { id: true, name: true } },
      },
    });

    logCurrentUserActivity("CREATE_APPOINTMENT");

    // Send immediate WhatsApp confirmation (PRO+ only, fire-and-forget)
    const bizOverrides = (business?.featureOverrides as Record<string, boolean> | null) ?? null;
    const canSendConfirmation = hasFeatureWithOverrides(business?.tier ?? "free", "whatsapp_reminders", bizOverrides);
    if (canSendConfirmation && appointment.customer?.phone) {
      const phone = toWhatsAppPhone(appointment.customer.phone);
      if (phone) {
        const [h, m] = appointment.startTime.split(":").map(Number);
        const apptDate = new Date(appointment.date);
        apptDate.setHours(h, m, 0, 0);
        const formattedDate = new Intl.DateTimeFormat("he-IL", {
          weekday: "long", day: "numeric", month: "long",
        }).format(apptDate);
        const serviceName = appointment.service?.name ?? appointment.priceListItem?.name ?? "תור";

        // Check for active appointment_confirmation automation rule with custom template
        const confirmationRule = await prisma.automationRule.findFirst({
          where: { businessId: authResult.businessId, trigger: "appointment_confirmation", isActive: true },
          include: { template: true },
        });

        if (confirmationRule?.template?.body) {
          const body = interpolateTemplate(confirmationRule.template.body, {
            customerName: appointment.customer.name,
            date: formattedDate,
            time: appointment.startTime,
            serviceName,
            petName: appointment.pet?.name ?? "",
          });
          sendWhatsAppMessage({ to: phone, body }).catch((err) =>
            console.error("Appointment confirmation WA (custom) failed:", err)
          );
        } else {
          sendWhatsAppTemplate({
            to: phone,
            templateName: "petra_appointment_confirmation",
            bodyParams: [appointment.customer.name, formattedDate, appointment.startTime, serviceName],
          }).catch((err) => console.error("Appointment confirmation WA failed:", err));
        }
      }
    }

    // Schedule WhatsApp reminder (fire-and-forget)
    scheduleAppointmentReminder({
      id: appointment.id,
      businessId: authResult.businessId,
      customerId: appointment.customerId,
      date: appointment.date,
      startTime: appointment.startTime,
      service: { name: appointment.service?.name ?? "תור" },
      customer: { name: appointment.customer.name },
      pet: appointment.pet ? { name: appointment.pet.name } : null,
    }).catch((err) => console.error("Failed to schedule appointment reminder:", err));

    // Sync to Google Calendar (awaited — fire-and-forget kills on Vercel)
    await syncAppointmentToGcal(appointment.id, authResult.businessId).catch((err) =>
      console.error("Failed to sync appointment to GCal:", err)
    );

    // Timeline event for the customer
    try {
      const serviceName = appointment.service?.name ?? appointment.priceListItem?.name ?? "תור";
      const petName = appointment.pet?.name ? ` (${appointment.pet.name})` : "";
      await prisma.timelineEvent.create({
        data: {
          type: "APPOINTMENT_CREATED",
          description: `תור נקבע: ${serviceName}${petName} — ${appointment.date} ${appointment.startTime}`,
          businessId: authResult.businessId,
          customerId: appointment.customerId,
        },
      });
    } catch (err) {
      console.error("Failed to create timeline event for appointment:", err);
    }

    // Create a corresponding Booking so manual appointments show in bookings list & block online slots
    try {
      const tz = business?.timezone || "Asia/Jerusalem";
      const dateStr = date.split("T")[0]; // normalize to YYYY-MM-DD
      const bookingStartAt = localTimeToUtc(startTime, dateStr, tz);
      const bookingEndAt = localTimeToUtc(endTime, dateStr, tz);

      await prisma.booking.create({
        data: {
          businessId: authResult.businessId,
          serviceId: serviceId || null,
          priceListItemId: priceListItemId || null,
          customerId,
          startAt: bookingStartAt,
          endAt: bookingEndAt,
          status: "confirmed",
          source: "manual",
          notes: notes || null,
          customerToken: require("crypto").randomBytes(32).toString("hex"),
          ...(petId ? { dogs: { create: { petId } } } : {}),
        },
      });
    } catch (err) {
      // Non-critical — appointment was already created successfully
      console.error("Failed to create companion Booking for manual appointment:", err);
    }

    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    console.error("Failed to create appointment:", error);
    return NextResponse.json(
      { error: "Failed to create appointment" },
      { status: 500 }
    );
  }
}
