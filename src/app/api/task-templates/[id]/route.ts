export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const existing = await prisma.taskTemplate.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const template = await prisma.taskTemplate.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.defaultCategory !== undefined && { defaultCategory: body.defaultCategory }),
        ...(body.defaultPriority !== undefined && { defaultPriority: body.defaultPriority }),
        ...(body.defaultTitleTemplate !== undefined && { defaultTitleTemplate: body.defaultTitleTemplate }),
        ...(body.defaultDescriptionTemplate !== undefined && { defaultDescriptionTemplate: body.defaultDescriptionTemplate || null }),
        ...(body.relatedEntityType !== undefined && { relatedEntityType: body.relatedEntityType || null }),
        ...(body.reminderDefaultEnabled !== undefined && { reminderDefaultEnabled: body.reminderDefaultEnabled }),
        ...(body.reminderDefaultLeadMinutes !== undefined && { reminderDefaultLeadMinutes: body.reminderDefaultLeadMinutes }),
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("PATCH task-template error:", error);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const existing = await prisma.taskTemplate.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.taskTemplate.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE task-template error:", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
