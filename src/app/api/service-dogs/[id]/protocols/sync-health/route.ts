export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { syncProtocolsFromHealth } from "@/lib/service-dog-engine";

/**
 * POST /api/service-dogs/[id]/protocols/sync-health
 *
 * Reads the dog's DogHealth record and:
 *   - Marks primary protocols (RABIES_PRIMARY, DHPP_PRIMARY, …) as COMPLETED
 *     where health data confirms the vaccination was given
 *   - Sets calculated dueDate on recurring protocols (RABIES_BOOSTER, DHPP_BOOSTER,
 *     DEWORMING, FLEA_TICK, BORDETELLA, …) based on health field dates
 *
 * Returns: { completed: number; dueDatesSet: number; total: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    // Verify dog belongs to this business
    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId },
      include: {
        pet: {
          include: {
            health: {
              select: {
                rabiesLastDate: true,
                rabiesValidUntil: true,
                dhppLastDate: true,
                bordatellaDate: true,
                dewormingLastDate: true,
                dewormingValidUntil: true,
                parkWormValidUntil: true,
                fleaTickExpiryDate: true,
              },
            },
          },
        },
      },
    });

    if (!dog) {
      return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
    }

    if (!dog.pet.health) {
      return NextResponse.json(
        { error: "אין נתוני בריאות לכלב — יש למלא חיסונים בפרופיל הכלב קודם" },
        { status: 400 }
      );
    }

    const result = await syncProtocolsFromHealth(params.id, dog.pet.health);

    return NextResponse.json({
      ok: true,
      completed: result.completed,
      dueDatesSet: result.dueDatesSet,
      total: result.completed + result.dueDatesSet,
    });
  } catch (error) {
    console.error("POST /api/service-dogs/[id]/protocols/sync-health error:", error);
    return NextResponse.json({ error: "שגיאה בסנכרון פרוטוקולים" }, { status: 500 });
  }
}
