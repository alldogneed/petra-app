export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createSession, setSessionCookie, ensureUserHasBusiness } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// Pre-computed bcrypt hash used to prevent timing attacks when user is not found
const DUMMY_HASH = "$2a$12$K4GzBqH5T5r5X5r5X5r5XuYJ5XZJXZJXZJXZJXZJXZJXZJXZJXZJX";

export async function POST(request: NextRequest) {
  try {
    const { email, password, rememberMe = false } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "אימייל וסיסמה נדרשים" },
        { status: 400 }
      );
    }

    // Rate limiting: use both IP-only and IP+email keys to prevent
    // brute-force attacks on specific accounts while also rate-limiting
    // broad credential-stuffing attacks from a single IP.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("auth:login", ip, RATE_LIMITS.AUTH_LOGIN);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "יותר מדי ניסיונות התחברות. נסה שוב מאוחר יותר." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }
    // Per-email+IP rate limit to prevent targeted brute-force against specific accounts
    const emailNorm = (email || "").toString().toLowerCase().trim();
    if (emailNorm) {
      const rlEmail = rateLimit("auth:login:email", `${ip}:${emailNorm}`, { max: 5, windowMs: 15 * 60 * 1000 });
      if (!rlEmail.allowed) {
        return NextResponse.json(
          { error: "יותר מדי ניסיונות התחברות לחשבון זה. נסה שוב מאוחר יותר." },
          { status: 429, headers: { "Retry-After": String(Math.ceil(rlEmail.retryAfterMs / 1000)) } }
        );
      }
    }

    // Find user by email
    const user = await prisma.platformUser.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        businessMemberships: {
          where: { isActive: true },
          include: { business: true },
        },
      },
    });

    // Always run bcrypt.compare to prevent timing-based user enumeration.
    // Wrap in try/catch: a malformed passwordHash in the DB would otherwise throw → 500.
    let isValid = false;
    try {
      isValid = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
    } catch {
      isValid = false;
    }
    if (!user || !user.passwordHash || !isValid) {
      return NextResponse.json(
        { error: "אימייל או סיסמה שגויים" },
        { status: 401 }
      );
    }

    // Ensure user has a business workspace (safety net for legacy users)
    if (user.businessMemberships.length === 0) {
      await ensureUserHasBusiness(user.id, user.name);
    }

    // Invalidate all existing sessions for this user to prevent session fixation
    await prisma.adminSession.deleteMany({
      where: { userId: user.id }
    });

    // Create session (rememberMe=true → 30-day DB session + cookie)
    const { token } = await createSession(user.id, request, !!rememberMe);
    setSessionCookie(token, !!rememberMe);

    // Track last login for Customer Success dashboard
    prisma.platformUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => {}); // fire-and-forget

    logActivity(user.id, user.name, "LOGIN");

    const membership = user.businessMemberships[0] || null;

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: (user as any).role || "USER",
        isAdmin: user.platformRole === "super_admin" || user.platformRole === "admin",
        businessId: membership?.businessId || null,
        businessName: membership?.business?.name || null,
        businessRole: membership?.role || null,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "שגיאה בהתחברות" },
      { status: 500 }
    );
  }
}
