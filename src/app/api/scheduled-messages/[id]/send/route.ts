export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { sendWhatsAppMessage, interpolateTemplate } from "@/lib/whatsapp";
import { toWhatsAppPhone } from "@/lib/utils";

// POST /api/scheduled-messages/[id]/send
// Immediately sends a PENDING or FAILED scheduled message, bypassing sendAt.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    const msg = await prisma.scheduledMessage.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: { customer: { select: { name: true, phone: true } } },
    });

    if (!msg) return NextResponse.json({ error: "הודעה לא נמצאה" }, { status: 404 });
    if (msg.status === "SENT") return NextResponse.json({ error: "ההודעה כבר נשלחה" }, { status: 400 });
    if (msg.status === "CANCELED") return NextResponse.json({ error: "ההודעה בוטלה" }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payload: Record<string, any> = {};
    try { payload = JSON.parse(msg.payloadJson || "{}"); } catch { /* corrupted JSON — use empty */ }

    // Build body — direct body takes priority
    let body: string;
    if (payload.body) {
      body = String(payload.body);
    } else {
      // Try a matching template
      const template = await prisma.messageTemplate.findFirst({
        where: {
          businessId: msg.businessId,
          channel: "whatsapp",
          isActive: true,
          name: msg.templateKey,
        },
      });
      body = template
        ? interpolateTemplate(template.body, { customerName: msg.customer?.name ?? "" })
        : `שלום ${msg.customer?.name ?? "לקוח"}, תזכורת מ-Petra. אם יש שאלות, אנחנו כאן!`;
    }

    const phone = String(payload.to ?? (msg.customer ? toWhatsAppPhone(msg.customer.phone) : ""));
    const result = await sendWhatsAppMessage({ to: phone || "", body });

    await prisma.scheduledMessage.update({
      where: { id: params.id },
      data: { status: result.success ? "SENT" : "FAILED" },
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "שליחה נכשלה" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      stub: result.messageSid?.startsWith("STUB_"),
      messageSid: result.messageSid,
    });
  } catch (error) {
    console.error("Send scheduled message error:", error);
    return NextResponse.json({ error: "שגיאה בשליחת הודעה" }, { status: 500 });
  }
}
