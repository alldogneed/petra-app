export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;
    const body = await request.json();
    const { name, channel, subject, body: templateBody, variables } = body;

    const existing = await prisma.messageTemplate.findFirst({
      where: { id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Message template not found" },
        { status: 404 }
      );
    }

    const template = await prisma.messageTemplate.update({
      where: { id, businessId: authResult.businessId },
      data: {
        ...(name !== undefined && { name }),
        ...(channel !== undefined && { channel }),
        ...(subject !== undefined && { subject }),
        ...(templateBody !== undefined && { body: templateBody }),
        ...(variables !== undefined && { variables }),
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error updating message template:", error);
    return NextResponse.json(
      { error: "Failed to update message template" },
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

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:messages:delete", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const { id } = params;

    const existing = await prisma.messageTemplate.findFirst({
      where: { id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Message template not found" },
        { status: 404 }
      );
    }

    await prisma.messageTemplate.deleteMany({ where: { id, businessId: authResult.businessId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting message template:", error);
    return NextResponse.json(
      { error: "Failed to delete message template" },
      { status: 500 }
    );
  }
}
