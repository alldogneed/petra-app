export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { getBusinessNotifications } from "@/services/notifications";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const result = await getBusinessNotifications(authResult.businessId, prisma);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת התראות" }, { status: 500 });
  }
}
