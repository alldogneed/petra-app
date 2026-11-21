export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError, canAuthorSystemMessages } from "@/lib/auth-guards";
import { updateSystemMessage, deleteSystemMessage, ServiceError } from "@/services/notifications";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    // Messages show in everyone's "הודעות מפטרה" inbox with an action link — only the
    // business's owner/manager (or a platform admin) may author them (phishing vector).
    if (!canAuthorSystemMessages(authResult.session, authResult.businessId)) {
      return NextResponse.json({ error: "אין לך הרשאה לפעולה זו" }, { status: 403 });
    }

    const body = await request.json();

    let message;
    try {
      message = await updateSystemMessage(authResult.businessId, prisma, params.id, body);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Message not found" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error("Update message error:", error);
    return NextResponse.json({ error: "Failed to update message" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    try {
      await deleteSystemMessage(authResult.businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Message not found" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete message error:", error);
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }
}
