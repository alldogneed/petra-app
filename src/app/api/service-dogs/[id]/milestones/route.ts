export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// Ordered milestone keys — used for seeding initial records
const MILESTONE_KEYS = [
  "PUPPY_FOUNDATION",
  "PUBLIC_ACCESS_READY",
  "TASK_CERTIFIED",
  "JOINT_TRAINING_COMPLETE",
];

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: auth.businessId },
      select: { id: true },
    });
    if (!dog) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let milestones = await prisma.serviceDogMilestone.findMany({
      where: { serviceDogId: params.id, businessId: auth.businessId },
      orderBy: { createdAt: "asc" },
    });

    // Auto-seed milestones if none exist yet
    if (milestones.length === 0) {
      await prisma.serviceDogMilestone.createMany({
        data: MILESTONE_KEYS.map((key) => ({
          serviceDogId: params.id,
          businessId: auth.businessId,
          milestoneKey: key,
        })),
        skipDuplicates: true,
      });
      milestones = await prisma.serviceDogMilestone.findMany({
        where: { serviceDogId: params.id, businessId: auth.businessId },
        orderBy: { createdAt: "asc" },
      });
    }

    return NextResponse.json(milestones);
  } catch (e) {
    console.error("GET milestones error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    const body = await request.json();
    const { milestoneKey, achievedAt, notes } = body;

    if (!milestoneKey || !MILESTONE_KEYS.includes(milestoneKey)) {
      return NextResponse.json({ error: "ציון דרך לא חוקי" }, { status: 400 });
    }

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: auth.businessId },
      select: { id: true },
    });
    if (!dog) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.serviceDogMilestone.upsert({
      where: { serviceDogId_milestoneKey: { serviceDogId: params.id, milestoneKey } },
      update: { achievedAt: achievedAt ? new Date(achievedAt) : null, notes: notes ?? undefined },
      create: {
        serviceDogId: params.id,
        businessId: auth.businessId,
        milestoneKey,
        achievedAt: achievedAt ? new Date(achievedAt) : null,
        notes,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("PATCH milestone error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
