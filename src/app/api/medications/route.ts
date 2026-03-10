export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/medications
// Query params:
//   petId  – filter by specific pet
//   active – "true" | "false"  (omit = all)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const petId = searchParams.get("petId");
    const activeParam = searchParams.get("active");

    const now = new Date();

    // Build the where clause for DogMedication
    // Include both regular pets (via customer) and standalone service dogs (direct businessId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const medWhere: any = {
      pet: {
        OR: [
          { customer: { businessId: authResult.businessId } },
          { businessId: authResult.businessId },
        ],
      },
    };

    if (petId) {
      medWhere.petId = petId;
    }

    if (activeParam === "true") {
      // Active = no endDate OR endDate >= today
      medWhere.OR = [{ endDate: null }, { endDate: { gte: now } }];
    } else if (activeParam === "false") {
      // Inactive = endDate < today
      medWhere.endDate = { lt: now };
    }

    const medications = await prisma.dogMedication.findMany({
      where: medWhere,
      include: {
        pet: {
          select: {
            id: true,
            name: true,
            species: true,
            breed: true,
            customer: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ medications, total: medications.length });
  } catch (error) {
    console.error("GET /api/medications error:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת תרופות" },
      { status: 500 }
    );
  }
}
