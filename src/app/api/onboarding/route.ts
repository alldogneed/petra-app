import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// GET /api/onboarding – get current user's onboarding progress
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [profile, progress] = await Promise.all([
      prisma.onboardingProfile.findUnique({
        where: { userId: currentUser.id },
      }),
      prisma.onboardingProgress.findUnique({
        where: { userId: currentUser.id },
      }),
    ]);

    return NextResponse.json({ profile, progress });
  } catch (error) {
    console.error("GET onboarding error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת אונבורדינג" }, { status: 500 });
  }
}

// POST /api/onboarding – create/update onboarding profile + progress
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { businessType, activeClientsRange, primaryGoal, currentStep, skipped, lastCustomerId } = body;

    // Upsert profile if provided
    let profile = null;
    if (businessType) {
      profile = await prisma.onboardingProfile.upsert({
        where: { userId: currentUser.id },
        create: {
          userId: currentUser.id,
          businessType,
          activeClientsRange: activeClientsRange || "עד 20",
          primaryGoal: primaryGoal || "סדר ביומן",
        },
        update: {
          ...(businessType && { businessType }),
          ...(activeClientsRange && { activeClientsRange }),
          ...(primaryGoal && { primaryGoal }),
        },
      });
    }

    // Upsert progress
    const progress = await prisma.onboardingProgress.upsert({
      where: { userId: currentUser.id },
      create: {
        userId: currentUser.id,
        currentStep: currentStep ?? 0,
        startedAt: new Date(),
        lastCustomerId: lastCustomerId || null,
      },
      update: {
        ...(currentStep !== undefined && { currentStep }),
        ...(skipped !== undefined && { skipped }),
        ...(lastCustomerId !== undefined && { lastCustomerId }),
        ...(currentStep !== undefined && currentStep >= 1 && { [`stepCompleted${currentStep}`]: true }),
        ...(currentStep !== undefined && currentStep >= 4 && { completedAt: new Date() }),
      },
    });

    return NextResponse.json({ profile, progress });
  } catch (error) {
    console.error("POST onboarding error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון אונבורדינג" }, { status: 500 });
  }
}
