export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";

// POST /api/account/set-password
// For Google-only users to set a password for the first time.
// Body: { newPassword }
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword) {
      return NextResponse.json({ error: "נדרשת סיסמה חדשה" }, { status: 400 });
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

    const user = await prisma.platformUser.findUnique({
      where: { id: currentUser.id },
      select: { passwordHash: true, authProvider: true },
    });

    if (!user) {
      return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
    }

    // Only allow setting password if user doesn't already have one (Google-only)
    if (user.passwordHash) {
      return NextResponse.json(
        { error: "כבר הוגדרה סיסמה לחשבון — השתמש בשינוי סיסמה" },
        { status: 400 }
      );
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.platformUser.update({
      where: { id: currentUser.id },
      data: {
        passwordHash: newHash,
        authProvider: "both",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST set-password error:", error);
    return NextResponse.json({ error: "שגיאה בהגדרת סיסמה" }, { status: 500 });
  }
}
