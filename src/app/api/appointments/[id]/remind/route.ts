import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

function toWhatsAppNum(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  if (digits.startsWith("972")) return digits;
  return digits;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  const appt = await prisma.appointment.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { name: true, phone: true } },
      service: { select: { name: true } },
      pet: { select: { name: true } },
    },
  });

  if (!appt || appt.businessId !== authResult.businessId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!appt.customer.phone) {
    return NextResponse.json({ error: "אין מספר טלפון ללקוח" }, { status: 400 });
  }

  const apptDate = new Date(appt.date);
  const formattedDate = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(apptDate);

  // Look up active appointment_reminder template for this business
  const template = await prisma.messageTemplate.findFirst({
    where: {
      businessId: authResult.businessId,
      name: "appointment_reminder",
      channel: "whatsapp",
      isActive: true,
    },
    select: { body: true },
  });

  const serviceName = appt.service?.name ?? "התור";
  let body: string;
  if (template?.body) {
    body = template.body
      .replace(/\{name\}/g, appt.customer.name)
      .replace(/\{date\}/g, formattedDate)
      .replace(/\{time\}/g, appt.startTime)
      .replace(/\{service\}/g, serviceName)
      .replace(/\{pet\}/g, appt.pet?.name ?? "");
  } else {
    const petPart = appt.pet ? ` עם ${appt.pet.name}` : "";
    body = `שלום ${appt.customer.name}! תזכורת לתור שלך ב-${formattedDate} בשעה ${appt.startTime} — ${serviceName}${petPart}. נתראה! 🐾`;
  }

  const to = toWhatsAppNum(appt.customer.phone);
  const result = await sendWhatsAppMessage({ to, body });

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "שגיאה בשליחה" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
