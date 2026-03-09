export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

const RESET_RATE_LIMIT = { max: 3, windowMs: 15 * 60 * 1000 }; // 3 per 15 min per IP
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const rl = rateLimit("auth:forgot-password", ip, RESET_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "יותר מדי בקשות. נסה שוב בעוד 15 דקות." },
        { status: 429 }
      );
    }

    const { email } = await request.json();
    if (!email?.trim()) {
      return NextResponse.json({ error: "אימייל נדרש" }, { status: 400 });
    }

    const user = await prisma.platformUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Non-existent or inactive users — silent success (prevents user enumeration)
    if (!user || !user.isActive) {
      return NextResponse.json({ ok: true });
    }

    // Google-only account — tell the user to sign in with Google instead
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "החשבון שלך מחובר דרך Google. לחץ על 'התחברות עם Google' בדף הכניסה." },
        { status: 400 }
      );
    }

    // Invalidate any previous unused tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    // Generate a secure random token (32 bytes = 64 hex chars)
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

    // Fire-and-forget — we don't want email errors to expose user existence
    sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
    }).catch((err) => {
      console.error("Failed to send password reset email:", err);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("forgot-password error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
