export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { markUserNotificationRead, deleteUserNotification, ServiceError } from "@/services/notifications";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const userId = authResult.session.user.id;

  await deleteUserNotification(userId, prisma, params.id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const userId = authResult.session.user.id;

  try {
    await markUserNotificationRead(userId, prisma, params.id);
  } catch (e) {
    if (e instanceof ServiceError && e.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}
