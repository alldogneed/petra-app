export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { getCurrentUser } from "@/lib/auth";
import { getBusinessOverview } from "@/services/business";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const user = await getCurrentUser();
    if (!user || user.businessRole !== "owner" || !user.businessId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await getBusinessOverview(user.businessId, prisma);
    return NextResponse.json(data);
  } catch (error) {
    console.error("business-admin/overview GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
