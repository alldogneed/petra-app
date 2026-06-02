export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";

// GET /api/account – get current user account details
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.platformUser.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
        businessMemberships: {
          where: { isActive: true },
          include: {
            business: { select: { id: true, name: true, tier: true } },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("GET account error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת חשבון" }, { status: 500 });
  }
}

// PATCH /api/account – update current user's profile (name, avatarUrl)
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Input validation
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.length > 100) {
        return NextResponse.json({ error: "שם לא תקין (עד 100 תווים)" }, { status: 400 });
      }
    }
    if (body.avatarUrl !== undefined) {
      if (typeof body.avatarUrl !== "string" || body.avatarUrl.length > 500) {
        return NextResponse.json({ error: "כתובת תמונה לא תקינה" }, { status: 400 });
      }
      // Block javascript: and data: URIs to prevent stored XSS
      const lower = body.avatarUrl.toLowerCase().trim();
      if (lower.startsWith("javascript:") || lower.startsWith("data:")) {
        return NextResponse.json({ error: "כתובת תמונה לא תקינה" }, { status: 400 });
      }
    }

    const user = await prisma.platformUser.update({
      where: { id: currentUser.id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.avatarUrl !== undefined && { avatarUrl: body.avatarUrl }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("PATCH account error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון חשבון" }, { status: 500 });
  }
}

// POST /api/account/change-password — change own password
// Body: { currentPassword, newPassword }
// Note: This endpoint lives at /api/account but handles the password-change sub-action
// via a dedicated route file at /api/account/change-password/route.ts
