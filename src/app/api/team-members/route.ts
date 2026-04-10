export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const members = await prisma.businessUser.findMany({
      where: { businessId: authResult.businessId, isActive: true },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(
      members.map((m) => ({ id: m.user.id, name: m.user.name, avatarUrl: m.user.avatarUrl }))
    );
  } catch (error) {
    console.error("GET team-members error:", error);
    return NextResponse.json({ error: "שגיאה פנימית" }, { status: 500 });
  }
}
