export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { getCurrentUser } from "@/lib/auth";
import { getDataHealth } from "@/services/business-admin-health";

// GET /api/business-admin/data-health — owner only; businessId from session only.
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const user = await getCurrentUser();
    if (!user || user.businessRole !== "owner" || !user.businessId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await getDataHealth(user.businessId, prisma);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("business-admin/data-health GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
