export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/pets/vaccinations?days=30
// Returns pets whose rabies vaccination expires within N days (or is already expired).
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") ?? "30", 10);

    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const healths = await prisma.dogHealth.findMany({
      where: {
        pet: { customer: { businessId: DEMO_BUSINESS_ID } },
        rabiesValidUntil: { lte: cutoff },
        rabiesUnknown: false,
      },
      select: {
        id: true,
        rabiesValidUntil: true,
        pet: {
          select: {
            id: true,
            name: true,
            species: true,
            breed: true,
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
      },
      orderBy: { rabiesValidUntil: "asc" },
    });

    const results = healths.map((h) => {
      const expiry = h.rabiesValidUntil!;
      const daysUntil = Math.round(
        (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const isExpired = expiry < now;

      return {
        healthId: h.id,
        petId: h.pet.id,
        petName: h.pet.name,
        species: h.pet.species,
        breed: h.pet.breed,
        customerId: h.pet.customer.id,
        customerName: h.pet.customer.name,
        customerPhone: h.pet.customer.phone,
        rabiesValidUntil: expiry.toISOString(),
        daysUntil,
        isExpired,
      };
    });

    return NextResponse.json({ vaccinations: results, total: results.length });
  } catch (error) {
    console.error("GET pets/vaccinations error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת נתוני חיסונים" }, { status: 500 });
  }
}
