export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");

    const where: Record<string, unknown> = { businessId: authResult.businessId };
    if (customerId) {
      where.customerId = customerId;
    }

    const requests = await prisma.contractRequest.findMany({
      where,
      include: {
        template: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("GET contract requests error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
