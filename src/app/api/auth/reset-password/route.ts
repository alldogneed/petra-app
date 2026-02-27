import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { createSession, setSessionCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit, AUDIT_ACTIONS, getRequestContext } from "@/lib/audit";

const RESET_RATE_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 };

function isStrongPassword(pw: string): boolean {
  return pw.length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const rl = rateLimit("auth:reset-password", ip, RESET_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי ניסיונות" }, { status: 429 });
    }

    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "טוקן וסיסמה נדרשים" },
        { status: 400 }
      );
    }

    if (!isStrongPassword(password)) {
      return NextResponse.json(
        { error: "הסיסמה חייבת להכיל לפחות 8 תווים, אות אחת וספרה אחת" },
        { status: 400 }
      );
    }

    // Hash the incoming token to compare with DB
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    // Validate: exists, not used, not expired
    if (!resetToken) {
      return NextResponse.json(
        { error: "הלינק לא תקין או כבר שומש" },
        { status: 400 }
      );
    }
    if (resetToken.usedAt) {
      return NextResponse.json(
        { error: "הלינק כבר שומש — בקש לינק חדש" },
        { status: 400 }
      );
    }
    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "הלינק פג תוקף — בקש לינק חדש" },
        { status: 400 }
      );
    }

    const user = resetToken.user;
    if (!user.isActive) {
      return NextResponse.json({ error: "החשבון מושבת" }, { status: 403 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Update password + mark token as used in one transaction
    await prisma.$transaction([
      prisma.platformUser.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Invalidate all existing sessions (security: force re-login everywhere)
      prisma.adminSession.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    // Create a new session so user is logged in immediately after reset
    const { token: sessionToken } = await createSession(user.id, request);
    setSessionCookie(sessionToken);

    // Audit log
    const { ip: auditIp, userAgent: auditUserAgent } = getRequestContext(request);
    logAudit({
      actorUserId: user.id,
      action: AUDIT_ACTIONS.PASSWORD_CHANGED,
      targetType: "PlatformUser",
      targetId: user.id,
      ip: auditIp,
      userAgent: auditUserAgent,
      metadata: { method: "reset_link" },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("reset-password error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
