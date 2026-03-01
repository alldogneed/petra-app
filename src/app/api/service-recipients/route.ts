export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const recipients = await prisma.serviceDogRecipient.findMany({
      where: {
        businessId: authResult.businessId,
        ...(status && { status }),
      },
      include: {
        customer: true,
        placements: {
          where: { status: { in: ["ACTIVE", "TRIAL"] } },
          include: { serviceDog: { include: { pet: true } } },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(recipients);
  } catch (error) {
    console.error("GET /api/service-recipients error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת זכאים" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { name, phone, email, idNumber, address, disabilityType, disabilityNotes, customerId, notes } = body;

    if (!name) {
      return NextResponse.json({ error: "נדרש שם" }, { status: 400 });
    }

    const recipient = await prisma.serviceDogRecipient.create({
      data: {
        businessId: authResult.businessId,
        name,
        phone: phone || null,
        email: email || null,
        idNumber: idNumber || null,
        address: address || null,
        disabilityType: disabilityType || null,
        disabilityNotes: disabilityNotes || null,
        customerId: customerId || null,
        notes: notes || null,
        waitlistDate: new Date(),
        status: "WAITLIST",
      },
    });

    return NextResponse.json(recipient, { status: 201 });
  } catch (error) {
    console.error("POST /api/service-recipients error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת מקבל" }, { status: 500 });
  }
}
