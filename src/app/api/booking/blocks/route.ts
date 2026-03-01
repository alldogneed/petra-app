export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// GET - list future blocks for the business
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const blocks = await prisma.availabilityBlock.findMany({
      where: {
        businessId: authResult.businessId,
        endAt: { gte: new Date() },
      },
      orderBy: { startAt: "asc" },
    });

    return NextResponse.json(blocks);
  } catch (error) {
    console.error("GET blocks error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת חסימות" }, { status: 500 });
  }
}

// POST - create a new block
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { startAt, endAt, reason } = body;

    if (!startAt || !endAt) {
      return NextResponse.json(
        { error: "תאריך התחלה וסיום הם שדות חובה" },
        { status: 400 }
      );
    }

    const start = new Date(startAt);
    const end = new Date(endAt);

    if (end <= start) {
      return NextResponse.json(
        { error: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה" },
        { status: 400 }
      );
    }

    const block = await prisma.availabilityBlock.create({
      data: {
        businessId: authResult.businessId,
        startAt: start,
        endAt: end,
        reason: reason || null,
      },
    });

    return NextResponse.json(block);
  } catch (error) {
    console.error("POST block error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת חסימה" }, { status: 500 });
  }
}
