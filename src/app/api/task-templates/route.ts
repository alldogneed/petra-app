export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const templates = await prisma.taskTemplate.findMany({
      where: { businessId: authResult.businessId },
      orderBy: [{ defaultCategory: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("GET task-templates error:", error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const {
      name,
      defaultCategory = "GENERAL",
      defaultPriority = "MEDIUM",
      defaultTitleTemplate,
      defaultDescriptionTemplate,
      relatedEntityType,
      reminderDefaultEnabled = false,
      reminderDefaultLeadMinutes = 0,
    } = body;

    if (!name || !defaultTitleTemplate) {
      return NextResponse.json({ error: "name and defaultTitleTemplate are required" }, { status: 400 });
    }

    const template = await prisma.taskTemplate.create({
      data: {
        name,
        defaultCategory,
        defaultPriority,
        defaultTitleTemplate,
        defaultDescriptionTemplate: defaultDescriptionTemplate || null,
        relatedEntityType: relatedEntityType || null,
        reminderDefaultEnabled,
        reminderDefaultLeadMinutes,
        businessId: authResult.businessId,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("POST task-templates error:", error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
