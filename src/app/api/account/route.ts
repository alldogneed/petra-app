import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
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
        platformRole: true,
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

// PATCH /api/account – update current user's profile
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const user = await prisma.platformUser.update({
      where: { id: currentUser.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
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
