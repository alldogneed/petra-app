export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { toWhatsAppPhone } from "@/lib/utils";
import { env } from "@/lib/env";

export async function POST(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    const body = await request.json();
    const { customerId, templateId } = body;

    if (!customerId || !templateId) {
      return NextResponse.json({ error: "חסרים פרמטרים" }, { status: 400 });
    }

    // Verify template belongs to this business
    const template = await prisma.contractTemplate.findFirst({
      where: { id: templateId, businessId: authResult.businessId },
    });
    if (!template) return NextResponse.json({ error: "תבנית לא נמצאה" }, { status: 404 });

    // Verify customer belongs to this business
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId: authResult.businessId },
    });
    if (!customer) return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });

    const business = await prisma.business.findUnique({
      where: { id: authResult.businessId },
      select: { name: true },
    });

    // Generate token
    const plainToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(plainToken).digest("hex");

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const signUrl = `${env.APP_URL}/sign/${plainToken}`;

    const contractRequest = await prisma.contractRequest.create({
      data: {
        businessId: authResult.businessId,
        customerId,
        templateId,
        tokenHash,
        expiresAt,
        sentAt: new Date(),
        signUrl,
      },
    });

    // Send WhatsApp if customer has phone
    if (customer.phone) {
      try {
        await sendWhatsAppMessage({
          to: toWhatsAppPhone(customer.phone),
          body: `שלום ${customer.name}! 📄\n${business?.name ?? ""} שלחו לך חוזה לחתימה דיגיטלית.\n\nלחץ לצפייה ולחתימה:\n${signUrl}\n\nהקישור תקף ל-30 יום.`,
        });
      } catch {
        // WhatsApp failure shouldn't fail the request
      }
    }

    return NextResponse.json({ id: contractRequest.id, signUrl }, { status: 201 });
  } catch (error) {
    console.error("POST contract send error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
