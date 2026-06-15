export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { markSystemMessageRead, ServiceError } from "@/services/notifications";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    let message;
    try {
      message = await markSystemMessageRead(authResult.businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Message not found" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error("Mark as read error:", error);
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 });
  }
}
