export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

/**
 * GET /api/boarding/care-log?date=YYYY-MM-DD
 * Returns all checked-in stays for the business on the given date,
 * including pet info and care logs for that day.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date") || new Date().toISOString().slice(0, 10);

    const dayStart = new Date(dateStr + "T00:00:00.000Z");
    const dayEnd   = new Date(dateStr + "T23:59:59.999Z");

    // Stays that are checked_in or reserved, overlapping the requested date
    const stays = await prisma.boardingStay.findMany({
      where: {
        businessId,
        status: { in: ["checked_in", "reserved"] },
        checkIn: { lte: dayEnd },
        OR: [
          { checkOut: { gte: dayStart } },
          { checkOut: null },
        ],
      },
      include: {
        room: { select: { id: true, name: true, pricePerNight: true } },
        pet: {
          select: {
            id: true,
            name: true,
            breed: true,
            species: true,
            foodNotes: true,
            foodBrand: true,
            foodGramsPerDay: true,
            foodFrequency: true,
            medicalNotes: true,
            medications: {
              where: {
                OR: [
                  { endDate: null },
                  { endDate: { gte: new Date(dateStr) } },
                ],
              },
              select: {
                id: true,
                medName: true,
                dosage: true,
                frequency: true,
                times: true,
                instructions: true,
              },
            },
          },
        },
        customer: { select: { id: true, name: true, phone: true } },
        careLogs: {
          where: {
            doneAt: { gte: dayStart, lte: dayEnd },
          },
          orderBy: { doneAt: "asc" },
        },
      },
      orderBy: { checkIn: "asc" },
    });

    return NextResponse.json(stays);
  } catch (error) {
    console.error("GET care-log error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת לוח הטיפולים" }, { status: 500 });
  }
}

/**
 * POST /api/boarding/care-log
 * Body: { boardingStayId, petId, type, title, notes? }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    const body = await request.json();
    const { boardingStayId, petId, type, title, notes } = body;

    if (!boardingStayId || !petId || !type || !title) {
      return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 });
    }

    // Verify the stay belongs to this business
    const stay = await prisma.boardingStay.findFirst({
      where: { id: boardingStayId, businessId },
    });
    if (!stay) {
      return NextResponse.json({ error: "שהייה לא נמצאה" }, { status: 404 });
    }

    const log = await prisma.boardingCareLog.create({
      data: {
        boardingStayId,
        petId,
        businessId,
        type,
        title,
        notes: notes || null,
        doneByUserId: session.user.id || null,
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("POST care-log error:", error);
    return NextResponse.json({ error: "שגיאה בשמירת הפעולה" }, { status: 500 });
  }
}
