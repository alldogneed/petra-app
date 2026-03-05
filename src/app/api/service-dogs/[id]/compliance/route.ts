export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });

    if (!dog) {
      return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
    }

    const events = await prisma.serviceDogComplianceEvent.findMany({
      where: { serviceDogId: params.id },
      include: { placement: true },
      orderBy: { eventAt: "desc" },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("GET /api/service-dogs/[id]/compliance error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת אירועי משמעת" }, { status: 500 });
  }
}
