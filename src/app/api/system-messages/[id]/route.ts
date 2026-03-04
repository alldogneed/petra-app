export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    // Verify message belongs to this business
    const existing = await prisma.systemMessage.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const body = await request.json();

    // Whitelist allowed fields
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.content !== undefined) data.content = body.content;
    if (body.type !== undefined) data.type = body.type;
    if (body.icon !== undefined) data.icon = body.icon;
    if (body.actionUrl !== undefined) data.actionUrl = body.actionUrl;
    if (body.actionLabel !== undefined) data.actionLabel = body.actionLabel;
    if (body.isRead !== undefined) data.isRead = body.isRead;
    if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    const message = await prisma.systemMessage.update({
      where: { id: params.id, businessId: authResult.businessId },
      data,
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error("Update message error:", error);
    return NextResponse.json(
      { error: "Failed to update message" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const existing = await prisma.systemMessage.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    await prisma.systemMessage.delete({
      where: { id: params.id, businessId: authResult.businessId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete message error:", error);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 }
    );
  }
}
