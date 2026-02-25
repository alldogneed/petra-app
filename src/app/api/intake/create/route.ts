import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import crypto from "crypto";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { customerId, dogId, phone } = body;

    // Generate token
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Expires in 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const form = await prisma.intakeForm.create({
      data: {
        businessId: DEMO_BUSINESS_ID,
        customerId: customerId || null,
        dogId: dogId || null,
        tokenHash,
        expiresAt,
        phoneE164: phone || null,
        status: "SENT",
      },
    });

    // Build the intake form URL
    const baseUrl = process.env.APP_URL || "http://localhost:3000";
    const intakeUrl = `${baseUrl}/intake/${token}`;

    return NextResponse.json({
      id: form.id,
      token,
      url: intakeUrl,
      expiresAt: form.expiresAt,
    }, { status: 201 });
  } catch (error) {
    console.error("POST intake create error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת טופס" }, { status: 500 });
  }
}
