export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { decryptStripeSecret } from "@/lib/encryption";
import { createCheckoutSession } from "@/lib/stripe";

// POST /api/payments/stripe/payment-link
// Body: { amount, description, customerId?, appointmentId?, orderId?, currency? }
// Returns: { sessionId, url }
export async function POST(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    const body = await request.json();
    const {
      amount,
      description,
      customerId,
      appointmentId,
      orderId,
      currency,
    } = body;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "סכום לא תקין" }, { status: 400 });
    }

    if (!description || typeof description !== "string") {
      return NextResponse.json({ error: "חסר תיאור" }, { status: 400 });
    }

    // Load Stripe settings
    const stripeSettings = await prisma.stripeSettings.findUnique({
      where: { businessId: authResult.businessId },
      select: { secretKeyEncrypted: true, status: true, currency: true },
    });

    if (!stripeSettings || stripeSettings.status !== "active") {
      return NextResponse.json(
        { error: "Stripe לא מוגדר. הגדר את פרטי Stripe בהגדרות > אינטגרציות." },
        { status: 400 }
      );
    }

    const secretKey = decryptStripeSecret(stripeSettings.secretKeyEncrypted);
    const effectiveCurrency = currency || stripeSettings.currency || "ILS";

    // Load customer email if customerId provided
    let customerEmail: string | undefined;
    let customerName: string | undefined;
    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, businessId: authResult.businessId },
        select: { email: true, name: true },
      });
      customerEmail = customer?.email ?? undefined;
      customerName = customer?.name ?? undefined;
    }

    const result = await createCheckoutSession({
      secretKey,
      amount,
      currency: effectiveCurrency,
      description,
      customerEmail,
      customerName,
      metadata: {
        businessId: authResult.businessId,
        ...(customerId ? { customerId } : {}),
        ...(appointmentId ? { appointmentId } : {}),
        ...(orderId ? { orderId } : {}),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Create Stripe payment link error:", error);
    const message = error instanceof Error ? error.message : "שגיאה ביצירת קישור תשלום";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
