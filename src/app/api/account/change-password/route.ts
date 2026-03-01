export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";

// POST /api/account/change-password
// Body: { currentPassword, newPassword }
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "נדרשים: סיסמה נוכחית וסיסמה חדשה" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "הסיסמה החדשה חייבת להכיל לפחות 8 תווים" },
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

    // Hash and save new password
    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.platformUser.update({
      where: { id: currentUser.id },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST change-password error:", error);
    return NextResponse.json({ error: "שגיאה בשינוי סיסמה" }, { status: 500 });
  }
}
