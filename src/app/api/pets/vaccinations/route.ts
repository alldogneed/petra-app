export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/pets/vaccinations
//
// Two modes:
//   ?all=true  — Return ALL pets (including those with unknown/null vaccination dates).
//                Used by the /vaccinations management page.
//   ?days=N    — Return only vaccinations expiring within the next N days (or already expired).
//                Used by the dashboard widget. N defaults to 30.

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

const HEALTH_SELECT = {
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
} as const;

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const allMode = searchParams.get("all") === "true";
    const now = new Date();

    // ── ALL MODE: return every pet with every vaccine type (including unknown) ──
    if (allMode) {
      const healths = await prisma.dogHealth.findMany({
        where: { pet: { customer: { businessId: authResult.businessId } } },
        select: HEALTH_SELECT,
      });

      const results: VaccinationEntry[] = [];

      for (const h of healths) {
        const base = {
          petId: h.pet.id,
          petName: h.pet.name,
          species: h.pet.species,
          breed: h.pet.breed,
          customerId: h.pet.customer.id,
          customerName: h.pet.customer.name,
          customerPhone: h.pet.customer.phone,
        };

        // ── Rabies ───────────────────────────────────────────────────
        const rabiesUnknown = h.rabiesUnknown || !h.rabiesValidUntil;
        if (rabiesUnknown) {
          results.push({
            ...base,
            healthId: h.id,
            vaccineType: "rabies",
            vaccineLabel: "כלבת",
            lastDate: h.rabiesLastDate ? h.rabiesLastDate.toISOString() : null,
            validUntil: null,
            daysUntil: 0,
            isExpired: false,
            isUnknown: true,
          });
        } else {
          const expiry = new Date(h.rabiesValidUntil!);
          const daysUntil = Math.round(
            (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          results.push({
            ...base,
            healthId: h.id,
            vaccineType: "rabies",
            vaccineLabel: "כלבת",
            lastDate: h.rabiesLastDate ? h.rabiesLastDate.toISOString() : null,
            validUntil: expiry.toISOString(),
            daysUntil,
            isExpired: expiry < now,
            isUnknown: false,
          });
        }

        // ── DHPP ─────────────────────────────────────────────────────
        if (!h.dhppLastDate) {
          results.push({
            ...base,
            healthId: h.id + "_dhpp",
            vaccineType: "dhpp",
            vaccineLabel: "DHPP",
            lastDate: null,
            validUntil: null,
            daysUntil: 0,
            isExpired: false,
            isUnknown: true,
          });
        } else {
          const expiry = new Date(
            new Date(h.dhppLastDate).getTime() + 365 * 24 * 60 * 60 * 1000
          );
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

        // ── Deworming ────────────────────────────────────────────────
        if (!h.dewormingLastDate) {
          results.push({
            ...base,
            healthId: h.id + "_deworming",
            vaccineType: "deworming",
            vaccineLabel: "טיפול נגד תולעים",
            lastDate: null,
            validUntil: null,
            daysUntil: 0,
            isExpired: false,
            isUnknown: true,
          });
        } else {
          const expiry = new Date(
            new Date(h.dewormingLastDate).getTime() + 180 * 24 * 60 * 60 * 1000
          );
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

      // Sort: expired → unknown → expiring_soon → valid
      const statusOrder = (v: VaccinationEntry) =>
        v.isExpired ? 0 : v.isUnknown ? 1 : v.daysUntil <= 30 ? 2 : 3;
      results.sort(
        (a, b) =>
          statusOrder(a) - statusOrder(b) || a.daysUntil - b.daysUntil
      );

      return NextResponse.json({ vaccinations: results, total: results.length });
    }

    // ── DAYS MODE: only expiring/expired within N days (dashboard widget) ──────
    const days = Math.min(
      Math.max(parseInt(searchParams.get("days") ?? "30", 10), 1),
      365
    );
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const dhppCutoff = new Date(cutoff.getTime() - 365 * 24 * 60 * 60 * 1000);
    const dewormCutoff = new Date(cutoff.getTime() - 180 * 24 * 60 * 60 * 1000);

    const healths = await prisma.dogHealth.findMany({
      where: {
        pet: { customer: { businessId: authResult.businessId } },
        OR: [
          { rabiesValidUntil: { lte: cutoff }, rabiesUnknown: false },
          { dhppLastDate: { not: null, lte: dhppCutoff } },
          { dewormingLastDate: { not: null, lte: dewormCutoff } },
        ],
      },
      select: HEALTH_SELECT,
    });

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
