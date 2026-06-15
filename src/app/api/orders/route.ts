export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createOrderReminder } from "@/lib/scheduled-messages";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { syncAppointmentToGcal, syncBoardingToGcal } from "@/lib/google-calendar";
import { sendWhatsAppTemplate, sendWhatsAppMessage, interpolateTemplate } from "@/lib/whatsapp";
import { toWhatsAppPhone } from "@/lib/utils";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { getMaxOrders, normalizeTier, hasFeatureWithOverrides } from "@/lib/feature-flags";
import { listOrders, createOrder, ServiceError } from "@/services/orders";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);

    // Validate date params before calling service
    const validateDate = (val: string | null, label: string) => {
      if (!val) return null;
      const d = new Date(val + "T00:00:00");
      if (isNaN(d.getTime())) return NextResponse.json({ error: `${label} לא תקין` }, { status: 400 });
      return null;
    };
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const startFrom = searchParams.get("startFrom");
    const startTo = searchParams.get("startTo");

    const err = validateDate(from, "תאריך התחלה") || validateDate(to, "תאריך סיום") ||
      validateDate(startFrom, "תאריך התחלה") || validateDate(startTo, "תאריך סיום");
    if (err) return err;

    let orders;
    try {
      orders = await listOrders(authResult.businessId, prisma, {
        status: searchParams.get("status") || undefined,
        customerId: searchParams.get("customerId") || undefined,
        from: from || undefined,
        to: to || undefined,
        startFrom: startFrom || undefined,
        startTo: startTo || undefined,
      });
    } catch (e) {
      if (e instanceof ServiceError && e.code === "VALIDATION") return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }

    const response = NextResponse.json(orders);
    response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=15");
    return response;
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:orders:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json();

    const biz = await prisma.business.findUnique({
      where: { id: authResult.businessId },
      select: { tier: true, featureOverrides: true },
    });
    const maxOrders = getMaxOrders(normalizeTier(biz?.tier));

    let result;
    try {
      result = await createOrder(authResult.businessId, prisma, body, { maxOrders });
    } catch (e) {
      if (e instanceof ServiceError) {
        if ((e.details as { code?: string } | null)?.code === "LIMIT_REACHED") {
          return NextResponse.json({ error: e.message, code: "LIMIT_REACHED" }, { status: 403 });
        }
        return NextResponse.json({ error: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 400 });
      }
      throw e;
    }

    const { order, linkedAppointmentId } = result;

    // Schedule WhatsApp reminder if requested
    if (body.sendReminder === true && body.startAt) {
      await createOrderReminder(order.id, body.customerId, new Date(body.startAt), authResult.businessId)
        .catch((err: unknown) => console.error("Failed to schedule reminder:", err));
    }

    // WhatsApp appointment confirmation (PRO+ only, fire-and-forget)
    const bizOverrides = (biz?.featureOverrides as Record<string, boolean> | null) ?? null;
    if (hasFeatureWithOverrides(biz?.tier ?? "free", "whatsapp_reminders", bizOverrides) && linkedAppointmentId && body.appointmentData) {
      const customer = await prisma.customer.findUnique({
        where: { id: body.customerId },
        select: { name: true, phone: true },
      }).catch(() => null);
      if (customer?.phone) {
        const phone = toWhatsAppPhone(customer.phone);
        if (phone) {
          const apptDate = new Date(body.appointmentData.date);
          const [h, m] = (body.appointmentData.startTime as string).split(":").map(Number);
          apptDate.setHours(h, m, 0, 0);
          const formattedDate = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" }).format(apptDate);
          const APPT_TYPE_LABELS: Record<string, string> = { training: "אילוף", grooming: "טיפוח", service_dog: "כלב שירות" };
          const TRAINING_SUBTYPE_LABELS: Record<string, string> = { individual: "פרטי", group: "קבוצתי", boarding: "פנסיון", package: "חבילה" };
          const typeLabel = APPT_TYPE_LABELS[body.orderType] ?? body.orderType;
          const subtypeLabel = body.orderType === "training" && body.trainingSubType ? TRAINING_SUBTYPE_LABELS[body.trainingSubType] ?? "" : "";
          const serviceName = subtypeLabel ? `${typeLabel} (${subtypeLabel})` : typeLabel;

          const confirmationRule = await prisma.automationRule.findFirst({
            where: { businessId: authResult.businessId, trigger: "appointment_confirmation", isActive: true },
            include: { template: true },
          }).catch(() => null);
          const linkedAppt = await prisma.appointment.findUnique({
            where: { id: linkedAppointmentId },
            select: { pet: { select: { name: true } } },
          }).catch(() => null);
          const petName = linkedAppt?.pet?.name ?? "";

          if (confirmationRule?.template?.body) {
            const msgBody = interpolateTemplate(confirmationRule.template.body, {
              customerName: customer.name, date: formattedDate,
              time: body.appointmentData.startTime as string, serviceName, petName,
            });
            await sendWhatsAppMessage({ to: phone, body: msgBody }).catch((err) =>
              console.error("Order appointment confirmation WA (custom) failed:", err)
            );
          } else {
            await sendWhatsAppTemplate({
              to: phone,
              templateName: "petra_appointment_confirmation",
              bodyParams: [customer.name, formattedDate, body.appointmentData.startTime as string, serviceName],
            }).catch((err) => console.error("Order appointment confirmation WA failed:", err));
          }
        }
      }
    }

    // GCal sync
    if (linkedAppointmentId) {
      await syncAppointmentToGcal(linkedAppointmentId, authResult.businessId).catch((err) =>
        console.error("Failed to sync order appointment to GCal:", err)
      );
    }
    if (body.orderType === "training" && body.trainingSubType === "boarding") {
      const prog = await prisma.trainingProgram.findFirst({
        where: { businessId: authResult.businessId, orderId: order.id },
        select: { boardingStayId: true },
      }).catch(() => null);
      if (prog?.boardingStayId) {
        await syncBoardingToGcal(prog.boardingStayId, authResult.businessId).catch((err) =>
          console.error("Failed to sync boarding stay to GCal:", err)
        );
      }
    }

    logCurrentUserActivity("CREATE_ORDER");
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
