import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;
    const forms = await prisma.intakeForm.findMany({
      where: { businessId: DEMO_BUSINESS_ID },
      include: {
        customer: {
          select: { name: true, phone: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(forms);
  } catch (error) {
    console.error("GET intake list error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת טפסים" }, { status: 500 });
  }
}
