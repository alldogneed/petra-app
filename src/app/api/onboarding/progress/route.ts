export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getOnboardingProgress, updateOnboardingProgress } from "@/services/business";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await getOnboardingProgress(currentUser.id, currentUser.businessId ?? null, prisma);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET onboarding/progress error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת התקדמות" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const result = await updateOnboardingProgress(currentUser.id, prisma, body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("PATCH onboarding/progress error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון התקדמות" }, { status: 500 });
  }
}
