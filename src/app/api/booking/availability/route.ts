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
    const rules = body.rules;

    // Validate rules array
    if (!Array.isArray(rules) || rules.length === 0 || rules.length > 7) {
      return NextResponse.json({ error: "rules must be an array of 1-7 items" }, { status: 400 });
    }
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    for (const rule of rules) {
      if (typeof rule.dayOfWeek !== "number" || rule.dayOfWeek < 0 || rule.dayOfWeek > 6 || !Number.isInteger(rule.dayOfWeek)) {
        return NextResponse.json({ error: "dayOfWeek must be integer 0-6" }, { status: 400 });
      }
      if (typeof rule.isOpen !== "boolean") {
        return NextResponse.json({ error: "isOpen must be boolean" }, { status: 400 });
      }
      if (typeof rule.openTime !== "string" || !timeRegex.test(rule.openTime)) {
        return NextResponse.json({ error: "openTime must be HH:MM format" }, { status: 400 });
      }
      if (typeof rule.closeTime !== "string" || !timeRegex.test(rule.closeTime)) {
        return NextResponse.json({ error: "closeTime must be HH:MM format" }, { status: 400 });
      }
    }

    // Upsert all 7 days
    const results = await Promise.all(
      (rules as Array<{ dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }>).map((rule) =>
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
