export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { hasFeatureWithOverrides } from "@/lib/feature-flags";

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
  try {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  const [appt, biz] = await Promise.all([
    prisma.appointment.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: {
        customer: { select: { name: true, phone: true } },
        service: { select: { name: true } },
        pet: { select: { name: true } },
      },
    }),
    prisma.business.findUnique({
      where: { id: authResult.businessId },
      select: { phone: true, tier: true, featureOverrides: true },
    }),
  ]);

  // Enforce tier gate
  const overrides = (biz?.featureOverrides as Record<string, boolean> | null) ?? null;
  if (!hasFeatureWithOverrides(biz?.tier, "whatsapp_reminders", overrides)) {
    return NextResponse.json(
      { error: "שליחת תזכורות WhatsApp זמינה במנוי פרו ומעלה" },
      { status: 403 }
    );
  }

  if (!appt) {
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
  const bizPhone = biz?.phone ?? "";
  const footer = `\n\n_הודעה אוטומטית – אין להשיב להודעה זו.\nלפניות ויצירת קשר ישיר עם בית העסק: ${bizPhone}_`;

  let body: string;
  if (template?.body) {
    // Support both {customerName}/{petName}/{serviceName} and legacy {name}/{pet}/{service}
    body = template.body
      .replace(/\{customerName\}/g, appt.customer.name)
      .replace(/\{name\}/g, appt.customer.name)
      .replace(/\{date\}/g, formattedDate)
      .replace(/\{time\}/g, appt.startTime)
      .replace(/\{serviceName\}/g, serviceName)
      .replace(/\{service\}/g, serviceName)
      .replace(/\{petName\}/g, appt.pet?.name ?? "")
      .replace(/\{pet\}/g, appt.pet?.name ?? "")
      .replace(/\{businessPhone\}/g, bizPhone);
  } else {
    const petPart = appt.pet ? ` עם ${appt.pet.name}` : "";
    body = `שלום ${appt.customer.name}! 🐾\n\nתזכורת לתור שלך ב-${formattedDate} בשעה ${appt.startTime}.\nשירות: ${serviceName}${petPart}.\n\nנתראה! 😊${footer}`;
  }

  const to = toWhatsAppNum(appt.customer.phone);
  const result = await sendWhatsAppMessage({ to, body });

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "שגיאה בשליחה" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/appointments/[id]/remind error:", error);
    return NextResponse.json({ error: "שגיאה בשליחת תזכורת" }, { status: 500 });
  }
}
