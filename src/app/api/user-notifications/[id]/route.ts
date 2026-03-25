export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

/** DELETE /api/user-notifications/:id — dismiss (delete) notification */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const userId = authResult.session.user.id;

  await prisma.notification.deleteMany({
    where: { id: params.id, userId },
  });

  return NextResponse.json({ ok: true });
}

/** PATCH /api/user-notifications/:id — mark notification as read */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const userId = authResult.session.user.id;

  const updated = await prisma.notification.updateMany({
    where: { id: params.id, userId },
    data: { isRead: true },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
