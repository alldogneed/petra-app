export const dynamic = 'force-dynamic';
/**
 * GET /api/import
 * Returns the list of import batches for the business (most recent first).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (isGuardError(authResult)) return authResult;

  try {
    const batches = await prisma.importBatch.findMany({
      where: { businessId: DEMO_BUSINESS_ID },
      include: { _count: { select: { issues: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const now = new Date();
    return NextResponse.json(
      batches.map((b) => {
        const stats = JSON.parse(b.statsJson);
        return {
          id: b.id,
          sourceFilename: b.sourceFilename,
          status: b.status,
          createdAt: b.createdAt,
          rollbackDeadline: b.rollbackDeadline,
          canRollback: b.status === "imported" && now < new Date(b.rollbackDeadline),
          totalCustomers: stats.totalCustomers ?? 0,
          totalPets: stats.totalPets ?? 0,
          createdCustomers: stats.createdCustomerIds?.length ?? null,
          createdPets: stats.createdPetIds?.length ?? null,
          issueCount: b._count.issues,
        };
      })
    );
  } catch (error) {
    console.error("Import list error:", error);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
