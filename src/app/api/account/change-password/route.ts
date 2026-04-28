export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getCurrentUser, setSessionCookie, createSession } from "@/lib/auth";
import { deleteAllUserSessions } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";

// POST /api/account/change-password
// Body: { currentPassword, newPassword }
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 5 attempts per 15 minutes per user (prevents brute-forcing current password)
    const rl = rateLimit("account:change-password", currentUser.id, { max: 5, windowMs: 15 * 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "יותר מדי ניסיונות. נסה שוב מאוחר יותר." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "נדרשים: סיסמה נוכחית וסיסמה חדשה" },
        { status: 400 }
      );
    }

    // Must match registration requirements: 12+ chars, uppercase + lowercase + digit
    if (
      newPassword.length < 12 ||
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      return NextResponse.json(
        { error: "הסיסמה חייבת להכיל לפחות 12 תווים, אות גדולה, אות קטנה וספרה" },
        { status: 400 }
      );
    }

    // Load the stored hash
    const user = await prisma.platformUser.findUnique({
      where: { id: currentUser.id },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: "חשבון זה מחובר דרך Google — לא ניתן לשנות סיסמה כאן" },
        { status: 400 }
      );
    }

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "הסיסמה הנוכחית שגויה" },
        { status: 400 }
      );
    }

    // Hash and save new password + invalidate all sessions (force re-login everywhere)
    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.platformUser.update({
      where: { id: currentUser.id },
      data: { passwordHash: newHash },
    });

    await deleteAllUserSessions(currentUser.id);

    // Create a fresh session for the current user so they stay logged in
    const { token } = await createSession(currentUser.id, request);
    setSessionCookie(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST change-password error:", error);
    return NextResponse.json({ error: "שגיאה בשינוי סיסמה" }, { status: 500 });
  }
}
