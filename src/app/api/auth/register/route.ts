export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createSession, setSessionCookie, ensureUserHasBusiness } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit, AUDIT_ACTIONS, getRequestContext } from "@/lib/audit";
import { CURRENT_TOS_VERSION } from "@/lib/tos";
import { notifyOwnerNewUser } from "@/lib/notify-owner";

const REGISTER_RATE_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 }; // 5 per 15 min per IP

// Password strength: min 12 chars, uppercase + lowercase + digit
function isStrongPassword(pw: string): boolean {
  return (
    pw.length >= 12 &&
    /[A-Z]/.test(pw) &&
    /[a-z]/.test(pw) &&
    /[0-9]/.test(pw)
  );
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
    const { name, email, password, tosAccepted, tosVersion, plan } = body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!tosAccepted || tosVersion !== CURRENT_TOS_VERSION) {
      return NextResponse.json(
        { error: "יש לאשר את תנאי השימוש כדי להמשיך" },
        { status: 400 }
      );
    }

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
        { error: "הסיסמה חייבת להכיל לפחות 12 תווים, אות גדולה, אות קטנה וספרה" },
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

    // ── Record ToS consent ────────────────────────────────────────────────────
    const { ip: consentIp, userAgent: consentUa } = getRequestContext(request);
    await prisma.userConsent.create({
      data: {
        id: `${user.id}:${CURRENT_TOS_VERSION}`,
        userId: user.id,
        termsVersion: CURRENT_TOS_VERSION,
        ipAddress: consentIp,
        userAgent: consentUa,
      },
    });
    await prisma.platformUser.update({
      where: { id: user.id },
      data: { tosAcceptedVersion: CURRENT_TOS_VERSION, tosAcceptedAt: new Date() },
    });

    // ── Create Business + BusinessUser membership ─────────────────────────────
    // Every new user gets their own isolated business workspace
    const businessId = await ensureUserHasBusiness(user.id, name.trim());

    // Note: tier/trial are NOT set here. When a paid plan is selected,
    // the user is redirected to /checkout?trial=1 where they enter a card.
    // The trial-indicator webhook sets tier + trialEndsAt after tokenization.

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

    // Notify owner (awaited so Vercel doesn't kill it before completion)
    await notifyOwnerNewUser({ name: user.name, email: user.email, plan });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        businessId,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת החשבון" }, { status: 500 });
  }
}
