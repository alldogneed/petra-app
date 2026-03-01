export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { toWhatsAppPhone } from "@/lib/utils";

// POST /api/customers/[id]/whatsapp
// Sends a one-off WhatsApp message to a customer.
// Body: { message: string }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    const customer = await prisma.customer.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      select: { id: true, name: true, phone: true },
    });

    if (!customer) return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    if (!customer.phone) return NextResponse.json({ error: "אין מספר טלפון ללקוח" }, { status: 400 });

    const body = await request.json();
    const { message } = body;

    if (!message?.trim()) return NextResponse.json({ error: "נדרש תוכן ההודעה" }, { status: 400 });
    if (message.length > 1500) return NextResponse.json({ error: "ההודעה ארוכה מדי (מקסימום 1500 תווים)" }, { status: 400 });

    const phone = toWhatsAppPhone(customer.phone);
    const result = await sendWhatsAppMessage({ to: phone, body: message.trim() });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "שליחה נכשלה" }, { status: 500 });
    }

    // Log to timeline
    await prisma.timelineEvent.create({
      data: {
        customerId: customer.id,
        businessId: authResult.businessId,
        type: "whatsapp_sent",
        description: `הודעת WhatsApp נשלחה: "${message.trim().slice(0, 80)}${message.length > 80 ? "..." : ""}"`,
      },
    }).catch(() => {}); // fire-and-forget

    return NextResponse.json({
      success: true,
      stub: result.messageSid?.startsWith("STUB_"),
      messageSid: result.messageSid,
    });
  } catch (error) {
    console.error("Customer WhatsApp send error:", error);
    return NextResponse.json({ error: "שגיאה בשליחת הודעה" }, { status: 500 });
  }
}
