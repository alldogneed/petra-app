export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { listTeamMembers } from "@/services/business";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { session } = authResult;
    const membership = session.memberships.find(
      (m) => m.businessId === authResult.businessId && m.isActive
    );
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const members = await listTeamMembers(authResult.businessId, prisma);
    return NextResponse.json(members);
  } catch (error) {
    console.error("business-admin/team GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
