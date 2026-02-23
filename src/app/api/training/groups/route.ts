import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

export async function GET() {
  try {
    const groups = await prisma.trainingGroup.findMany({
      where: { businessId: DEMO_BUSINESS_ID },
      include: {
        participants: {
          include: {
            dog: true,
            customer: true,
          },
        },
        sessions: {
          orderBy: { sessionDatetime: "desc" },
          take: 5,
          include: {
            attendance: true,
          },
        },
        _count: {
          select: {
            participants: true,
            sessions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(groups);
  } catch (error) {
    console.error("GET training groups error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת קבוצות" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const group = await prisma.trainingGroup.create({
      data: {
        businessId: DEMO_BUSINESS_ID,
        name: body.name,
        groupType: body.groupType || "CUSTOM",
        location: body.location || null,
        defaultDayOfWeek: body.defaultDayOfWeek ?? null,
        defaultTime: body.defaultTime || null,
        maxParticipants: body.maxParticipants ?? null,
        notes: body.notes || null,
      },
      include: {
        participants: true,
        sessions: true,
        _count: {
          select: { participants: true, sessions: true },
        },
      },
    });

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error("POST training group error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת קבוצה" }, { status: 500 });
  }
}
