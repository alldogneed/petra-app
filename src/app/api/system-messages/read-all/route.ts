export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

/** PATCH /api/system-messages/read-all — mark all system messages as read */
export async function PATCH(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  await prisma.systemMessage.updateMany({
    where: { businessId: authResult.businessId, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true });
}
