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

    // Rate limiting
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("auth:login", ip, RATE_LIMITS.AUTH_LOGIN);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "יותר מדי ניסיונות התחברות. נסה שוב מאוחר יותר." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
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

    // Always run bcrypt.compare to prevent timing-based user enumeration
    const isValid = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
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
        platformRole: user.platformRole,
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
