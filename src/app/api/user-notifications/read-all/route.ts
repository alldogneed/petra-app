export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { markAllUserNotificationsRead } from "@/services/notifications";

export async function PATCH(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const userId = authResult.session.user.id;

  await markAllUserNotificationsRead(userId, prisma);
  return NextResponse.json({ ok: true });
}
