export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import {
  generateIntakeToken,
  hashToken,
  getIntakeExpiry,
  normalizePhoneIL,
  buildIntakeLink,
  buildIntakeMessage,
  buildWhatsAppDeepLink,
} from "@/lib/intake";

/** GET /api/intake - list intake forms for a customer */
export async function GET(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { businessId } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");

    const where: Record<string, unknown> = { businessId };
    if (customerId) where.customerId = customerId;

    const forms = await prisma.intakeForm.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
      },
    });

    return NextResponse.json(forms);
  } catch (error) {
    console.error("IntakeForm GET error:", error);
    return NextResponse.json({ error: "Failed to fetch intake forms" }, { status: 500 });
  }
}

/** POST /api/intake - create a new intake form and return token + deeplink */
export async function POST(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { businessId } = authResult;

  try {
    const body = await request.json();
    const { customerId, dogId, phone, messageOverride } = body;

    // Validate messageOverride to prevent injection of arbitrary content
    if (messageOverride && (typeof messageOverride !== "string" || messageOverride.length > 2000)) {
      return NextResponse.json({ error: "הודעה מותאמת ארוכה מדי (מקסימום 2000 תווים)" }, { status: 400 });
    }

    // Get customer and business info
    const [customer, business] = await Promise.all([
      customerId
        ? prisma.customer.findFirst({
            where: { id: customerId, businessId },
            select: { id: true, name: true, phone: true },
          })
        : null,
      prisma.business.findUnique({
        where: { id: businessId },
        select: { name: true },
      }),
    ]);

    const phoneE164 = normalizePhoneIL(phone || customer?.phone || "");
    const token = generateIntakeToken();
    const tokenHash = hashToken(token);
    const expiresAt = getIntakeExpiry();
    const intakeLink = buildIntakeLink(token);

    const customerName = customer?.name || "לקוח";
    const businessName = business?.name || "Petra";

    const messageText =
      messageOverride ||
      buildIntakeMessage({ customerName, businessName, intakeLink });

    // Create the intake form record
    const form = await prisma.intakeForm.create({
      data: {
        businessId,
        customerId: customerId || null,
        dogId: dogId || null,
        tokenHash,
        expiresAt,
        phoneE164,
        status: "DRAFT",
        messageText,
      },
    });

    // Build the WhatsApp deep link
    const whatsappUrl = buildWhatsAppDeepLink(phoneE164, messageText);

    return NextResponse.json({
      id: form.id,
      token,
      intakeLink,
      whatsappUrl,
      messageText,
      expiresAt: form.expiresAt,
    }, { status: 201 });
  } catch (error) {
    console.error("IntakeForm POST error:", error);
    return NextResponse.json({ error: "Failed to create intake form" }, { status: 500 });
  }
}
