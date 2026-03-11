export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

/** Default sales pipeline for pet-service businesses */
const DEFAULT_LEAD_STAGES = [
  { name: "ליד חדש",         color: "#94A3B8", sortOrder: 0, isWon: false, isLost: false },
  { name: "יצירת קשר",       color: "#6366F1", sortOrder: 1, isWon: false, isLost: false },
  { name: "ייעוץ ראשוני",    color: "#F59E0B", sortOrder: 2, isWon: false, isLost: false },
  { name: "הצעת מחיר",       color: "#3B82F6", sortOrder: 3, isWon: false, isLost: false },
  { name: "ממתין להחלטה",   color: "#8B5CF6", sortOrder: 4, isWon: false, isLost: false },
  { name: "לקוח",            color: "#10B981", sortOrder: 5, isWon: true,  isLost: false },
  { name: "לא רלוונטי",     color: "#EF4444", sortOrder: 6, isWon: false, isLost: true  },
];

async function ensureDefaultStages(businessId: string) {
  const count = await prisma.leadStage.count({ where: { businessId } });
  if (count === 0) {
    await prisma.leadStage.createMany({
      data: DEFAULT_LEAD_STAGES.map((s) => ({ ...s, businessId })),
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    await ensureDefaultStages(authResult.businessId);

    const stages = await prisma.leadStage.findMany({
      where: { businessId: authResult.businessId },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(stages);
  } catch (error) {
    console.error("Error fetching lead stages:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead stages" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { name, color } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    // Find max sortOrder among non-won/non-lost stages
    const allStages = await prisma.leadStage.findMany({
      where: { businessId: authResult.businessId },
      orderBy: { sortOrder: "asc" },
    });

    const regularStages = allStages.filter((s) => !s.isWon && !s.isLost);
    const specialStages = allStages.filter((s) => s.isWon || s.isLost);

    const newSortOrder =
      regularStages.length > 0
        ? Math.max(...regularStages.map((s) => s.sortOrder)) + 1
        : 0;

    // Bump won/lost stages up by 1
    for (const special of specialStages) {
      if (special.sortOrder >= newSortOrder) {
        await prisma.leadStage.update({
          where: { id: special.id },
          data: { sortOrder: special.sortOrder + 1 },
        });
      }
    }

    const stage = await prisma.leadStage.create({
      data: {
        businessId: authResult.businessId,
        name: name.trim(),
        color: color || "#6366F1",
        sortOrder: newSortOrder,
      },
    });

    return NextResponse.json(stage, { status: 201 });
  } catch (error) {
    console.error("Error creating lead stage:", error);
    return NextResponse.json(
      { error: "Failed to create lead stage" },
      { status: 500 }
    );
  }
}
