export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { markAllSystemMessagesRead } from "@/services/notifications";

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    await markAllSystemMessagesRead(authResult.businessId, prisma);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to mark system messages as read:", error);
    return NextResponse.json({ error: "Failed to update messages" }, { status: 500 });
  }
}
