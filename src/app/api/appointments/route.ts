export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { scheduleAppointmentReminder, scheduleAppointmentFollowup } from "@/lib/reminder-service";
import { syncAppointmentToGcal } from "@/lib/google-calendar";
import { sendWhatsAppTemplate, sendWhatsAppMessage, interpolateTemplate } from "@/lib/whatsapp";
import { toWhatsAppPhone } from "@/lib/utils";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getMaxAppointments, normalizeTier, hasFeatureWithOverrides } from "@/lib/feature-flags";
import { localTimeToUtc } from "@/lib/slots";
import { listAppointments, createAppointment, ServiceError } from "@/services/appointments";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    let appointments;
    try {
      appointments = await listAppointments(authResult.businessId, prisma, {
        from: searchParams.get("from") || undefined,
        to: searchParams.get("to") || undefined,
      });
    } catch (e) {
      if (e instanceof ServiceError && e.code === "VALIDATION") {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    return NextResponse.json(appointments);
  } catch (error) {
    console.error("Failed to fetch appointments:", error);
    return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 });
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

    const business = await prisma.business.findUnique({
      where: { id: authResult.businessId },
      select: { tier: true, timezone: true, featureOverrides: true },
    });
    const maxAppts = getMaxAppointments(normalizeTier(business?.tier));

    const body = await request.json();

    let appointment;
    try {
      appointment = await createAppointment(authResult.businessId, prisma, body, { maxAppointments: maxAppts });
    } catch (e) {
      if (e instanceof ServiceError) {
        if ((e.details as { code?: string } | null)?.code === "LIMIT_REACHED") {
          return NextResponse.json({ error: e.message, code: "LIMIT_REACHED" }, { status: 403 });
        }
        return NextResponse.json({ error: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 400 });
      }
      throw e;
    }

    logCurrentUserActivity("CREATE_APPOINTMENT");

    // ── Side effects ────────────────────────────────────────────────────────

    // WhatsApp confirmation (PRO+, fire-and-forget)
    const bizOverrides = (business?.featureOverrides as Record<string, boolean> | null) ?? null;
    if (hasFeatureWithOverrides(business?.tier ?? "free", "whatsapp_reminders", bizOverrides) && appointment.customer?.phone) {
      const phone = toWhatsAppPhone(appointment.customer.phone);
      if (phone) {
        const [h, m] = appointment.startTime.split(":").map(Number);
        const apptDate = new Date(appointment.date);
        apptDate.setHours(h, m, 0, 0);
        const formattedDate = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" }).format(apptDate);
        const serviceName = appointment.service?.name ?? appointment.priceListItem?.name ?? "תור";

        const confirmationRule = await prisma.automationRule.findFirst({
          where: { businessId: authResult.businessId, trigger: "appointment_confirmation", isActive: true },
          include: { template: true },
        });

        if (confirmationRule?.template?.body) {
          const msgBody = interpolateTemplate(confirmationRule.template.body, {
            customerName: appointment.customer.name,
            date: formattedDate,
            time: appointment.startTime,
            serviceName,
            petName: appointment.pet?.name ?? "",
          });
          await sendWhatsAppMessage({ to: phone, body: msgBody }).catch((err) =>
            console.error("Appointment confirmation WA (custom) failed:", err)
          );
        } else {
          await sendWhatsAppTemplate({
            to: phone,
            templateName: "petra_appointment_confirmation",
            bodyParams: [appointment.customer.name, formattedDate, appointment.startTime, serviceName],
          }).catch((err) => console.error("Appointment confirmation WA failed:", err));
        }
      }
    }

    // Schedule reminder
    await scheduleAppointmentReminder({
      id: appointment.id,
      businessId: authResult.businessId,
      customerId: appointment.customerId,
      date: appointment.date,
      startTime: appointment.startTime,
      service: { name: appointment.service?.name ?? "תור" },
      customer: { name: appointment.customer?.name ?? "לקוח" },
      pet: appointment.pet ? { name: appointment.pet.name } : null,
    }).catch((err) => console.error("Failed to schedule appointment reminder:", err));

    // Schedule post-appointment follow-up (opt-in via appointment_followup rule)
    await scheduleAppointmentFollowup({
      id: appointment.id,
      businessId: authResult.businessId,
      customerId: appointment.customerId,
      date: appointment.date,
      startTime: appointment.startTime,
      service: { name: appointment.service?.name ?? "תור" },
      customer: { name: appointment.customer?.name ?? "לקוח" },
      pet: appointment.pet ? { name: appointment.pet.name } : null,
    }).catch((err) => console.error("Failed to schedule appointment follow-up:", err));

    // GCal sync
    await syncAppointmentToGcal(appointment.id, authResult.businessId).catch((err) =>
      console.error("Failed to sync appointment to GCal:", err)
    );

    // Timeline event
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

    // Companion Booking (manual appointments appear in bookings list + block online slots)
    try {
      const tz = business?.timezone || "Asia/Jerusalem";
      const dateStr = body.date.split("T")[0];
      const bookingStartAt = localTimeToUtc(body.startTime, dateStr, tz);
      const bookingEndAt = localTimeToUtc(body.endTime, dateStr, tz);

      await prisma.booking.create({
        data: {
          businessId: authResult.businessId,
          serviceId: body.serviceId || null,
          priceListItemId: body.priceListItemId || null,
          customerId: body.customerId,
          startAt: bookingStartAt,
          endAt: bookingEndAt,
          status: "confirmed",
          source: "manual",
          notes: body.notes || null,
          customerToken: require("crypto").randomBytes(32).toString("hex"),
          ...(body.petId ? { dogs: { create: { petId: body.petId } } } : {}),
        },
      });
    } catch (err) {
      console.error("Failed to create companion Booking for manual appointment:", err);
    }

    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    console.error("Failed to create appointment:", error);
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
  }
}
