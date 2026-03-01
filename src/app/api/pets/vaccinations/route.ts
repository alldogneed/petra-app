export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/pets/vaccinations?days=30
// Returns vaccination records whose expiry is within the next N days (or already expired).
// Covers: rabies (uses rabiesValidUntil), DHPP (estimated +1yr from dhppLastDate),
//         deworming (estimated +6mo from dewormingLastDate).
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const days = Math.min(Math.max(parseInt(searchParams.get("days") ?? "30", 10), 1), 365);

    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    // Cutoffs for estimated expiry calculations
    const dhppCutoff = new Date(cutoff.getTime() - 365 * 24 * 60 * 60 * 1000);
    const dewormCutoff = new Date(cutoff.getTime() - 180 * 24 * 60 * 60 * 1000);

    const healths = await prisma.dogHealth.findMany({
      where: {
        pet: { customer: { businessId: authResult.businessId } },
        OR: [
          // Rabies: expiry date is within window
          { rabiesValidUntil: { lte: cutoff }, rabiesUnknown: false },
          // DHPP: last date was >= (365 - days) days ago
          { dhppLastDate: { not: null, lte: dhppCutoff } },
          // Deworming: last date was >= (180 - days) days ago
          { dewormingLastDate: { not: null, lte: dewormCutoff } },
        ],
      },
      select: {
        id: true,
        rabiesLastDate: true,
        rabiesValidUntil: true,
        rabiesUnknown: true,
        dhppLastDate: true,
        dewormingLastDate: true,
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
      vaccineType: "rabies" | "dhpp" | "deworming";
      vaccineLabel: string;
      lastDate: string | null;
      validUntil: string | null;
      daysUntil: number;
      isExpired: boolean;
      isUnknown: boolean;
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

      // ── Rabies ──────────────────────────────────────────────────
      if (!h.rabiesUnknown && h.rabiesValidUntil) {
        const expiry = new Date(h.rabiesValidUntil);
        if (expiry <= cutoff) {
          const daysUntil = Math.round(
            (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          results.push({
            ...base,
            vaccineType: "rabies",
            vaccineLabel: "כלבת",
            lastDate: h.rabiesLastDate ? h.rabiesLastDate.toISOString() : null,
            validUntil: expiry.toISOString(),
            daysUntil,
            isExpired: expiry < now,
            isUnknown: false,
          });
        }
      }

      // ── DHPP (estimated 1-year validity from last date) ──────────
      if (h.dhppLastDate) {
        const expiry = new Date(
          new Date(h.dhppLastDate).getTime() + 365 * 24 * 60 * 60 * 1000
        );
        if (expiry <= cutoff) {
          const daysUntil = Math.round(
            (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          results.push({
            ...base,
            healthId: h.id + "_dhpp",
            vaccineType: "dhpp",
            vaccineLabel: "DHPP",
            lastDate: h.dhppLastDate.toISOString(),
            validUntil: expiry.toISOString(),
            daysUntil,
            isExpired: expiry < now,
            isUnknown: false,
          });
        }
      }

      // ── Deworming (estimated 6-month validity from last date) ────
      if (h.dewormingLastDate) {
        const expiry = new Date(
          new Date(h.dewormingLastDate).getTime() + 180 * 24 * 60 * 60 * 1000
        );
        if (expiry <= cutoff) {
          const daysUntil = Math.round(
            (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          results.push({
            ...base,
            healthId: h.id + "_deworming",
            vaccineType: "deworming",
            vaccineLabel: "טיפול נגד תולעים",
            lastDate: h.dewormingLastDate.toISOString(),
            validUntil: expiry.toISOString(),
            daysUntil,
            isExpired: expiry < now,
            isUnknown: false,
          });
        }
      }
    }

    // Sort: expired first (most negative daysUntil), then ascending
    results.sort((a, b) => a.daysUntil - b.daysUntil);

    return NextResponse.json({ vaccinations: results, total: results.length });
  } catch (error) {
    console.error("GET pets/vaccinations error:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת נתוני חיסונים" },
      { status: 500 }
    );
  }
}
