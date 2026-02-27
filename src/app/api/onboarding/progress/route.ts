import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/onboarding/progress
 *
 * Returns the OnboardingProgress for the current user, enriched with
 * "smart" step detection — each step is also checked live against the DB
 * so that actions taken outside the wizard (e.g. adding a service in /settings)
 * automatically mark the relevant step as complete.
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const progress = await prisma.onboardingProgress.findUnique({
      where: { userId: currentUser.id },
    });

    if (!progress) {
      return NextResponse.json({ progress: null });
    }

    // Smart detection: check DB state for each step
    const businessId = currentUser.businessId;

    const [servicesCount, customersCount, appointmentsCount] = await Promise.all([
      businessId
        ? prisma.service.count({ where: { businessId, isActive: true } })
        : Promise.resolve(0),
      businessId
        ? prisma.customer.count({ where: { businessId } })
        : Promise.resolve(0),
      businessId
        ? prisma.appointment.count({ where: { service: { businessId } } })
        : Promise.resolve(0),
    ]);

    const businessComplete = !!(
      businessId &&
      (await prisma.business.findUnique({ where: { id: businessId } }))?.phone
    );

    // Merge DB flags with live detection (either source can mark complete)
    const enriched = {
      ...progress,
      stepCompleted1: progress.stepCompleted1 || businessComplete,
      stepCompleted2: progress.stepCompleted2 || servicesCount > 0,
      stepCompleted3: progress.stepCompleted3 || customersCount > 0,
      stepCompleted4: progress.stepCompleted4 || appointmentsCount > 0,
    };

    // If all steps are now complete but completedAt isn't set yet, set it
    const allDone =
      enriched.stepCompleted1 &&
      enriched.stepCompleted2 &&
      enriched.stepCompleted3 &&
      enriched.stepCompleted4;

    if (allDone && !progress.completedAt) {
      const updated = await prisma.onboardingProgress.update({
        where: { userId: currentUser.id },
        data: {
          stepCompleted1: enriched.stepCompleted1,
          stepCompleted2: enriched.stepCompleted2,
          stepCompleted3: enriched.stepCompleted3,
          stepCompleted4: enriched.stepCompleted4,
          completedAt: new Date(),
        },
      });
      return NextResponse.json({ progress: updated });
    }

    // Persist any newly detected completions back to DB
    if (
      enriched.stepCompleted1 !== progress.stepCompleted1 ||
      enriched.stepCompleted2 !== progress.stepCompleted2 ||
      enriched.stepCompleted3 !== progress.stepCompleted3 ||
      enriched.stepCompleted4 !== progress.stepCompleted4
    ) {
      await prisma.onboardingProgress.update({
        where: { userId: currentUser.id },
        data: {
          stepCompleted1: enriched.stepCompleted1,
          stepCompleted2: enriched.stepCompleted2,
          stepCompleted3: enriched.stepCompleted3,
          stepCompleted4: enriched.stepCompleted4,
        },
      });
    }

    return NextResponse.json({ progress: enriched });
  } catch (error) {
    console.error("GET onboarding/progress error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת התקדמות" }, { status: 500 });
  }
}

/**
 * PATCH /api/onboarding/progress
 *
 * Allows partial updates to the progress record:
 *   { skipped, completedAt, startedAt, stepCompleted1..4 }
 */
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      skipped,
      completedAt,
      startedAt,
      stepCompleted1,
      stepCompleted2,
      stepCompleted3,
      stepCompleted4,
    } = body;

    // Ensure a progress record exists (upsert)
    const progress = await prisma.onboardingProgress.upsert({
      where: { userId: currentUser.id },
      create: {
        userId: currentUser.id,
        currentStep: 0,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        ...(skipped !== undefined && { skipped }),
        ...(completedAt !== undefined && { completedAt: new Date(completedAt) }),
        ...(stepCompleted1 !== undefined && { stepCompleted1 }),
        ...(stepCompleted2 !== undefined && { stepCompleted2 }),
        ...(stepCompleted3 !== undefined && { stepCompleted3 }),
        ...(stepCompleted4 !== undefined && { stepCompleted4 }),
      },
      update: {
        ...(skipped !== undefined && { skipped }),
        ...(completedAt !== undefined && { completedAt: new Date(completedAt) }),
        ...(startedAt !== undefined && { startedAt: new Date(startedAt) }),
        ...(stepCompleted1 !== undefined && { stepCompleted1 }),
        ...(stepCompleted2 !== undefined && { stepCompleted2 }),
        ...(stepCompleted3 !== undefined && { stepCompleted3 }),
        ...(stepCompleted4 !== undefined && { stepCompleted4 }),
      },
    });

    return NextResponse.json({ progress });
  } catch (error) {
    console.error("PATCH onboarding/progress error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון התקדמות" }, { status: 500 });
  }
}
