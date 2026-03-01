export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { encryptStripeSecret, decryptStripeSecret } from "@/lib/encryption";
import { verifyStripeKey } from "@/lib/stripe";

// GET /api/integrations/stripe — get current Stripe connection status (never exposes decrypted keys)
export async function GET(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    const settings = await prisma.stripeSettings.findUnique({
      where: { businessId: authResult.businessId },
      select: {
        id: true,
        publishableKey: true,
        accountId: true,
        currency: true,
        status: true,
        lastError: true,
        connectedAt: true,
        // Never return secretKeyEncrypted or webhookSecretEncrypted
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("GET stripe settings error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת הגדרות Stripe" }, { status: 500 });
  }
}

// POST /api/integrations/stripe — save Stripe credentials
// Body: { publishableKey, secretKey, webhookSecret?, currency? }
export async function POST(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    const body = await request.json();
    const { publishableKey, secretKey, webhookSecret, currency = "ILS" } = body;

    if (!publishableKey || !secretKey) {
      return NextResponse.json(
        { error: "נדרשים: publishableKey ו-secretKey" },
        { status: 400 }
      );
    }

    if (!publishableKey.startsWith("pk_")) {
      return NextResponse.json(
        { error: "publishableKey חייב להתחיל ב-pk_" },
        { status: 400 }
      );
    }

    if (!secretKey.startsWith("sk_")) {
      return NextResponse.json(
        { error: "secretKey חייב להתחיל ב-sk_" },
        { status: 400 }
      );
    }

    // Verify the secret key by calling Stripe
    const verification = await verifyStripeKey(secretKey);
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || "מפתח Stripe לא תקין" },
        { status: 400 }
      );
    }

    const secretKeyEncrypted = encryptStripeSecret(secretKey);
    const webhookSecretEncrypted = webhookSecret
      ? encryptStripeSecret(webhookSecret)
      : undefined;

    await prisma.stripeSettings.upsert({
      where: { businessId: authResult.businessId },
      create: {
        businessId: authResult.businessId,
        publishableKey,
        secretKeyEncrypted,
        webhookSecretEncrypted: webhookSecretEncrypted ?? null,
        accountId: verification.accountId ?? null,
        currency,
        status: "active",
        connectedAt: new Date(),
      },
      update: {
        publishableKey,
        secretKeyEncrypted,
        ...(webhookSecretEncrypted !== undefined
          ? { webhookSecretEncrypted }
          : {}),
        accountId: verification.accountId ?? null,
        currency,
        status: "active",
        lastError: null,
        connectedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, accountId: verification.accountId });
  } catch (error) {
    console.error("POST stripe settings error:", error);
    return NextResponse.json({ error: "שגיאה בשמירת הגדרות Stripe" }, { status: 500 });
  }
}

// DELETE /api/integrations/stripe — disconnect Stripe
export async function DELETE(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    await prisma.stripeSettings.deleteMany({
      where: { businessId: authResult.businessId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE stripe settings error:", error);
    return NextResponse.json({ error: "שגיאה בניתוק Stripe" }, { status: 500 });
  }
}

// Internal helper used by other routes — load and decrypt Stripe secret key
export async function loadStripeSecretKey(businessId: string): Promise<string> {
  const settings = await prisma.stripeSettings.findUnique({
    where: { businessId },
    select: { secretKeyEncrypted: true, status: true },
  });

  if (!settings) throw new Error("Stripe לא מוגדר לעסק זה");
  if (settings.status !== "active") throw new Error("Stripe מושבת");

  return decryptStripeSecret(settings.secretKeyEncrypted);
}
