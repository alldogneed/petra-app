export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/pets/vaccinations?days=30
// Returns pets whose rabies OR DHPP vaccination expires within N days (or is already expired).
// DHPP expiry is estimated as dhppLastDate + 365 days.
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") ?? "30", 10);

    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    // For DHPP: find dogs whose dhppLastDate was > (cutoff - 365) days ago
    // i.e. dhppLastDate < cutoff - 365days  →  dhppLastDate < now - (365-days)days
    const dhppCutoff = new Date(cutoff.getTime() - 365 * 24 * 60 * 60 * 1000);

    const healths = await prisma.dogHealth.findMany({
      where: {
        pet: { customer: { businessId: DEMO_BUSINESS_ID } },
        OR: [
          { rabiesValidUntil: { lte: cutoff }, rabiesUnknown: false },
          // DHPP: was given >=(365-days) days ago, so calculated expiry is within window
          { dhppLastDate: { not: null, lte: dhppCutoff } },
        ],
      },
      select: {
        id: true,
        rabiesValidUntil: true,
        rabiesUnknown: true,
        dhppLastDate: true,
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
    });

    type VaccinationEntry = {
      healthId: string;
      petId: string;
      petName: string;
      species: string;
      breed: string | null;
      customerId: string;
      customerName: string;
      customerPhone: string;
      vaccineType: "rabies" | "dhpp";
      vaccineLabel: string;
      validUntil: string;
      daysUntil: number;
      isExpired: boolean;
    };

    const results: VaccinationEntry[] = [];

    for (const h of healths) {
      const base = {
        healthId: h.id,
        petId: h.pet.id,
        petName: h.pet.name,
        species: h.pet.species,
        breed: h.pet.breed,
        customerId: h.pet.customer.id,
        customerName: h.pet.customer.name,
        customerPhone: h.pet.customer.phone,
      };

      // Rabies
      if (!h.rabiesUnknown && h.rabiesValidUntil && new Date(h.rabiesValidUntil) <= cutoff) {
        const expiry = new Date(h.rabiesValidUntil);
        const daysUntil = Math.round((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        results.push({
          ...base,
          vaccineType: "rabies",
          vaccineLabel: "כלבת",
          validUntil: expiry.toISOString(),
          daysUntil,
          isExpired: expiry < now,
        });
      }

      // DHPP (estimated 1-year validity from last date)
      if (h.dhppLastDate) {
        const expiry = new Date(new Date(h.dhppLastDate).getTime() + 365 * 24 * 60 * 60 * 1000);
        if (expiry <= cutoff) {
          const daysUntil = Math.round((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          results.push({
            ...base,
            healthId: h.id + "_dhpp",
            vaccineType: "dhpp",
            vaccineLabel: "DHPP",
            validUntil: expiry.toISOString(),
            daysUntil,
            isExpired: expiry < now,
          });
        }
      }
    }

    // Sort: expired first, then by daysUntil
    results.sort((a, b) => a.daysUntil - b.daysUntil);

    return NextResponse.json({ vaccinations: results, total: results.length });
  } catch (error) {
    console.error("GET pets/vaccinations error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת נתוני חיסונים" }, { status: 500 });
  }
}
