export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

/** DELETE /api/system-messages/delete-all — dismiss all system messages */
export async function DELETE(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  await prisma.systemMessage.deleteMany({
    where: { businessId: authResult.businessId },
  });

  return NextResponse.json({ ok: true });
}
