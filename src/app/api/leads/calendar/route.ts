export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/leads/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns leads with nextFollowUpAt in the given date range.
 */
export async function GET(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { businessId } = authResult;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to required" }, { status: 400 });
  }

  const leads = await prisma.lead.findMany({
    where: {
      businessId,
      nextFollowUpAt: {
        gte: new Date(from + "T00:00:00"),
        lte: new Date(to + "T23:59:59"),
      },
      followUpStatus: "pending",
    },
    select: {
      id: true,
      name: true,
      phone: true,
      nextFollowUpAt: true,
      requestedService: true,
    },
    orderBy: { nextFollowUpAt: "asc" },
  });

  return NextResponse.json({ leads });
}
