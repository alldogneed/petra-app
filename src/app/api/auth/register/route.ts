export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createSession, setSessionCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit, AUDIT_ACTIONS, getRequestContext } from "@/lib/audit";

const REGISTER_RATE_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 }; // 5 per 15 min per IP

// Basic password strength: min 8 chars, at least 1 letter + 1 digit
function isStrongPassword(pw: string): boolean {
  return pw.length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const rl = rateLimit("auth:register", ip, REGISTER_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "יותר מדי ניסיונות הרשמה. נסה שוב מאוחר יותר." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
        }
      );
    }

    const body = await request.json();
    const { name, email, password } = body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { error: "שם, אימייל וסיסמה הם שדות חובה" },
        { status: 400 }
      );
    }

    const emailNorm = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNorm)) {
      return NextResponse.json(
        { error: "כתובת אימייל לא תקינה" },
        { status: 400 }
      );
    }

    if (!isStrongPassword(password)) {
      return NextResponse.json(
        { error: "הסיסמה חייבת להכיל לפחות 8 תווים, אות אחת וספרה אחת" },
        { status: 400 }
      );
    }

    // ── Uniqueness check ──────────────────────────────────────────────────────
    const existing = await prisma.platformUser.findUnique({
      where: { email: emailNorm },
    });
    if (existing) {
      return NextResponse.json(
        { error: "כבר קיים חשבון עם אימייל זה" },
        { status: 409 }
      );
    }

    // ── Create user ───────────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.platformUser.create({
      data: {
        name: name.trim(),
        email: emailNorm,
        passwordHash,
        platformRole: null,
        isActive: true,
      },
    });

    // ── Create onboarding progress (step 0, not started yet) ─────────────────
    await prisma.onboardingProgress.create({
      data: {
        userId: user.id,
        currentStep: 0,
      },
    });

    // ── Create session & set cookie ───────────────────────────────────────────
    const { token } = await createSession(user.id, request);
    setSessionCookie(token);

    // Audit log
    const { ip: auditIp, userAgent: auditUserAgent } = getRequestContext(request);
    logAudit({
      actorUserId: user.id,
      action: AUDIT_ACTIONS.PLATFORM_USER_CREATED,
      targetType: "PlatformUser",
      targetId: user.id,
      ip: auditIp,
      userAgent: auditUserAgent,
      metadata: { email: user.email, name: user.name, method: "self_register" },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת החשבון" }, { status: 500 });
  }
}
