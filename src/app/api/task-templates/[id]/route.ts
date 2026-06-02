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

    // Input validation
    if (body.name !== undefined && (typeof body.name !== "string" || body.name.length > 200)) {
      return NextResponse.json({ error: "name too long (max 200)" }, { status: 400 });
    }
    if (body.defaultTitleTemplate !== undefined && (typeof body.defaultTitleTemplate !== "string" || body.defaultTitleTemplate.length > 500)) {
      return NextResponse.json({ error: "title template too long (max 500)" }, { status: 400 });
    }
    if (body.defaultDescriptionTemplate !== undefined && body.defaultDescriptionTemplate && (typeof body.defaultDescriptionTemplate !== "string" || body.defaultDescriptionTemplate.length > 2000)) {
      return NextResponse.json({ error: "description template too long (max 2000)" }, { status: 400 });
    }
    if (body.defaultCategory !== undefined) {
      const VALID_CATEGORIES = ["GENERAL", "CUSTOMER", "PET", "APPOINTMENT", "BOARDING", "TRAINING", "SERVICE_DOG"];
      if (!VALID_CATEGORIES.includes(body.defaultCategory)) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
      }
    }
    if (body.defaultPriority !== undefined) {
      const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
      if (!VALID_PRIORITIES.includes(body.defaultPriority)) {
        return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
      }
    }

    const existing = await prisma.taskTemplate.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const template = await prisma.taskTemplate.update({
      where: { id: params.id, businessId: authResult.businessId },
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

    await prisma.taskTemplate.delete({ where: { id: params.id, businessId: authResult.businessId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE task-template error:", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
