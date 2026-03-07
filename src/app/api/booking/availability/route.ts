export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// GET availability rules for a business
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const rules = await prisma.availabilityRule.findMany({
      where: { businessId: authResult.businessId },
      orderBy: { dayOfWeek: "asc" },
      take: 100,
    });

    // If no rules exist, return defaults
    if (rules.length === 0) {
      const defaults = Array.from({ length: 7 }, (_, i) => ({
        dayOfWeek: i,
        isOpen: i !== 6, // Saturday closed by default
        openTime: "09:00",
        closeTime: "18:00",
      }));
      return NextResponse.json(defaults);
    }

    return NextResponse.json(rules);
  } catch (error) {
    console.error("GET availability error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת זמינות" }, { status: 500 });
  }
}

// POST - save/update availability rules
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const rules = body.rules as Array<{
      dayOfWeek: number;
      isOpen: boolean;
      openTime: string;
      closeTime: string;
    }>;

    // Upsert all 7 days
    const results = await Promise.all(
      rules.map((rule) =>
        prisma.availabilityRule.upsert({
          where: {
            businessId_dayOfWeek: {
              businessId: authResult.businessId,
              dayOfWeek: rule.dayOfWeek,
            },
          },
          create: {
            businessId: authResult.businessId,
            dayOfWeek: rule.dayOfWeek,
            isOpen: rule.isOpen,
            openTime: rule.openTime,
            closeTime: rule.closeTime,
          },
          update: {
            isOpen: rule.isOpen,
            openTime: rule.openTime,
            closeTime: rule.closeTime,
          },
        })
      )
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error("POST availability error:", error);
    return NextResponse.json({ error: "שגיאה בשמירת זמינות" }, { status: 500 });
  }
}
