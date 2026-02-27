export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;
    const body = await request.json();
    const { name, channel, subject, body: templateBody, variables } = body;

    const existing = await prisma.messageTemplate.findFirst({
      where: { id, businessId: DEMO_BUSINESS_ID },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Message template not found" },
        { status: 404 }
      );
    }

    const template = await prisma.messageTemplate.update({
      where: { id },
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
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;

    const existing = await prisma.messageTemplate.findFirst({
      where: { id, businessId: DEMO_BUSINESS_ID },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Message template not found" },
        { status: 404 }
      );
    }

    await prisma.messageTemplate.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting message template:", error);
    return NextResponse.json(
      { error: "Failed to delete message template" },
      { status: 500 }
    );
  }
}
