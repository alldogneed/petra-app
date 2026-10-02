export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { getCurrentUser } from "@/lib/auth";
import { getBusinessActivity } from "@/services/business";
import { parseActivityQuery } from "@/lib/business-admin-activity";

/**
 * GET /api/business-admin/activity — owner-only activity log.
 * Query: userId, action, from, to (YYYY-MM-DD Israel days, inclusive), q, cursor, take (≤100).
 * Response: { items: ActivityEntry[], nextCursor: string | null }
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const user = await getCurrentUser();
    if (!user || user.businessRole !== "owner" || !user.businessId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = parseActivityQuery(new URL(request.url).searchParams);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const page = await getBusinessActivity(user.businessId, prisma, parsed.value);
    return NextResponse.json(page);
  } catch (error) {
    console.error("business-admin/activity GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
