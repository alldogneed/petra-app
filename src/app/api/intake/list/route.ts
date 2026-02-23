import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

export async function GET() {
  try {
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
