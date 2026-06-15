export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { listUserNotifications } from "@/services/notifications";

export async function GET(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const userId = authResult.session.user.id;

  try {
    const result = await listUserNotifications(userId, prisma);
    return NextResponse.json(result);
  } catch (error) {
    console.error("User notifications error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת התראות" }, { status: 500 });
  }
}
