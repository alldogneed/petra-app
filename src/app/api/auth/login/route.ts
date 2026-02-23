import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createSession, setSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "אימייל וסיסמה נדרשים" },
        { status: 400 }
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

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "אימייל או סיסמה שגויים" },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "אימייל או סיסמה שגויים" },
        { status: 401 }
      );
    }

    // Create session
    const { token } = await createSession(user.id, request);
    setSessionCookie(token);

    const membership = user.businessMemberships[0] || null;

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
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
