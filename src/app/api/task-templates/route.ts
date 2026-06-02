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

    // Input length validation
    if (typeof name !== "string" || name.length > 200) {
      return NextResponse.json({ error: "name too long (max 200)" }, { status: 400 });
    }
    if (typeof defaultTitleTemplate !== "string" || defaultTitleTemplate.length > 500) {
      return NextResponse.json({ error: "title template too long (max 500)" }, { status: 400 });
    }
    if (defaultDescriptionTemplate && (typeof defaultDescriptionTemplate !== "string" || defaultDescriptionTemplate.length > 2000)) {
      return NextResponse.json({ error: "description template too long (max 2000)" }, { status: 400 });
    }

    const VALID_CATEGORIES = ["GENERAL", "CUSTOMER", "PET", "APPOINTMENT", "BOARDING", "TRAINING", "SERVICE_DOG"];
    if (!VALID_CATEGORIES.includes(defaultCategory)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
    if (!VALID_PRIORITIES.includes(defaultPriority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
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
