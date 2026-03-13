export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { toWhatsAppPhone } from "@/lib/utils";
import { env } from "@/lib/env";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { businessId } = authResult;

  try {
    const contractReq = await prisma.contractRequest.findFirst({
      where: { id: params.id, businessId },
      include: {
        customer: { select: { name: true, phone: true } },
        template: { select: { id: true, name: true } },
      },
    });

    if (!contractReq) {
      return NextResponse.json({ error: "חוזה לא נמצא" }, { status: 404 });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true },
    });

    const isExpired =
      contractReq.status === "EXPIRED" ||
      new Date(contractReq.expiresAt) < new Date();

    if (contractReq.status === "SIGNED") {
      return NextResponse.json({ error: "החוזה כבר נחתם" }, { status: 400 });
    }

    if (!contractReq.customer.phone) {
      return NextResponse.json(
        { error: "ללקוח אין מספר טלפון" },
        { status: 400 }
      );
    }

    // Expired → create a new contract request with fresh token
    if (isExpired) {
      const plainToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(plainToken)
        .digest("hex");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const signUrl = `${env.APP_URL}/sign/${plainToken}`;

      const newReq = await prisma.contractRequest.create({
        data: {
          businessId,
          customerId: contractReq.customerId,
          templateId: contractReq.templateId,
          tokenHash,
          expiresAt,
          sentAt: new Date(),
          signUrl,
        },
      });

      // Mark the old one as EXPIRED
      await prisma.contractRequest.update({
        where: { id: contractReq.id },
        data: { status: "EXPIRED" },
      });

      try {
        await sendWhatsAppMessage({
          to: toWhatsAppPhone(contractReq.customer.phone),
          body: `שלום ${contractReq.customer.name}! 📄\n${business?.name ?? ""} שלחו לך חוזה חדש לחתימה דיגיטלית.\n\nלחץ לצפייה ולחתימה:\n${signUrl}\n\nהקישור תקף ל-30 יום.`,
        });
      } catch {
        // WhatsApp failure shouldn't fail the request
      }

      return NextResponse.json(
        { id: newReq.id, signUrl, renewed: true },
        { status: 201 }
      );
    }

    // PENDING / VIEWED → send reminder with existing signUrl
    try {
      await sendWhatsAppMessage({
        to: toWhatsAppPhone(contractReq.customer.phone),
        body: `שלום ${contractReq.customer.name}! 📄\nתזכורת: ${business?.name ?? ""} שלחו לך חוזה לחתימה.\n\nלחץ לצפייה ולחתימה:\n${contractReq.signUrl}\n\nאנא חתום בהקדם.`,
      });
    } catch {
      return NextResponse.json(
        { error: "שגיאה בשליחת WhatsApp" },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: contractReq.id, reminded: true });
  } catch (error) {
    console.error("POST contract resend error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
