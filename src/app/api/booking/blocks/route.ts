export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, requireBusinessPermission, isGuardError } from "@/lib/auth-guards";
import { TENANT_PERMS } from "@/lib/permissions";
import { BLOCK_USER_INCLUDE, parseBlockRange } from "@/lib/availability-block-range";
import { resolveMemberId } from "@/services/team-members";
import { ServiceError } from "@/services/types";

// GET - list blocks for the business.
// Without params: future blocks. With ?from=YYYY-MM-DD&to=YYYY-MM-DD (Israel days, ≤ 62 days):
// blocks overlapping that range. Each block carries `userId` + `user: {id,name} | null`
// (null user = whole-business block; set = that member's absence).
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let rangeWhere: { endAt: { gte: Date }; startAt?: { lte: Date } } = { endAt: { gte: new Date() } };
    if (from !== null || to !== null) {
      const range = parseBlockRange(from, to);
      if (!range.ok) return NextResponse.json({ error: range.error }, { status: 400 });
      rangeWhere = { endAt: { gte: range.start }, startAt: { lte: range.end } };
    }

    const blocks = await prisma.availabilityBlock.findMany({
      where: { businessId: authResult.businessId, ...rangeWhere },
      include: BLOCK_USER_INCLUDE,
      orderBy: { startAt: "asc" },
      take: 200,
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
    const authResult = await requireBusinessPermission(request, TENANT_PERMS.AVAILABILITY_MANAGE);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { startAt, endAt, reason } = body ?? {};

    if (!startAt || !endAt) {
      return NextResponse.json(
        { error: "תאריך התחלה וסיום הם שדות חובה" },
        { status: 400 }
      );
    }

    const start = new Date(startAt);
    const end = new Date(endAt);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json({ error: "תאריך לא תקין" }, { status: 400 });
    }

    if (end <= start) {
      return NextResponse.json(
        { error: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה" },
        { status: 400 }
      );
    }

    // Optional member absence — must be an active member of THIS business (businessId from session).
    const rawUserId = body?.userId;
    if (rawUserId !== undefined && rawUserId !== null && typeof rawUserId !== "string") {
      return NextResponse.json({ error: "איש צוות לא תקין" }, { status: 400 });
    }
    const userId = await resolveMemberId(authResult.businessId, rawUserId);

    const block = await prisma.availabilityBlock.create({
      data: {
        businessId: authResult.businessId,
        startAt: start,
        endAt: end,
        reason: reason || null,
        userId,
      },
      include: BLOCK_USER_INCLUDE,
    });

    return NextResponse.json(block);
  } catch (error) {
    if (error instanceof ServiceError && error.code === "VALIDATION") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST block error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת חסימה" }, { status: 500 });
  }
}
