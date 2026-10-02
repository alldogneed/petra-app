export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { getCurrentUser } from "@/lib/auth";
import { getBusinessAiActivity } from "@/services/business";
import { parseAiActivityQuery } from "@/lib/business-admin-activity";

/**
 * GET /api/business-admin/ai-activity — owner-only feed of AI (MCP) tool calls
 * for this business's connections (last 90 days).
 * Query: cursor, take (≤100), status (success|error|denied), connectionId.
 * Response: { items, nextCursor, connections? } — `connections` only on the first page.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const user = await getCurrentUser();
    if (!user || user.businessRole !== "owner" || !user.businessId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = parseAiActivityQuery(new URL(request.url).searchParams);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const data = await getBusinessAiActivity(user.businessId, prisma, {
      ...parsed.value,
      includeConnections: !parsed.value.cursor,
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("business-admin/ai-activity GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
