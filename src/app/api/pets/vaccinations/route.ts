export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/pets/vaccinations
//
// Two modes:
//   ?all=true  — Return ALL pets with ALL vaccine types (including unknown/null).
//                Used by the /vaccinations management page.
//   ?days=N    — Return only vaccinations expiring within the next N days (or already expired).
//                Used by the dashboard widget. N defaults to 30.

export type VaccineType =
  | "rabies"
  | "dhpp"
  | "dhppPuppy1"
  | "dhppPuppy2"
  | "dhppPuppy3"
  | "bordetella"
  | "parkWorm"
  | "deworming"
  | "fleaTick";

export type VaccinationEntry = {
  healthId: string;
  petId: string;
  petName: string;
  species: string;
  breed: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vaccineType: VaccineType;
  vaccineLabel: string;
  lastDate: string | null;
  validUntil: string | null; // null = unknown or no expiry (bordetella)
  daysUntil: number;
  isExpired: boolean;
  isUnknown: boolean;
  extra?: string; // e.g. fleaTickType
};

const DAY_MS = 24 * 60 * 60 * 1000;

const HEALTH_SELECT = {
  id: true,
  rabiesLastDate: true,
  rabiesValidUntil: true,
  rabiesUnknown: true,
  dhppLastDate: true,
  dhppPuppy1Date: true,
  dhppPuppy2Date: true,
  dhppPuppy3Date: true,
  bordatellaDate: true,
  parkWormDate: true,
  dewormingLastDate: true,
  fleaTickType: true,
  fleaTickDate: true,
  fleaTickExpiryDate: true,
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

function daysFromNow(expiry: Date, now: Date) {
  return Math.round((expiry.getTime() - now.getTime()) / DAY_MS);
}

function buildEntry(
  h: { id: string; pet: { id: string; name: string; species: string; breed: string | null; customer: { id: string; name: string; phone: string } | null } },
  type: VaccineType,
  label: string,
  lastDate: Date | null,
  validUntil: Date | null,
  now: Date,
  extra?: string
): VaccinationEntry {
  const base = {
    petId: h.pet.id,
    petName: h.pet.name,
    species: h.pet.species,
    breed: h.pet.breed,
    customerId: h.pet.customer?.id ?? "",
    customerName: h.pet.customer?.name ?? "",
    customerPhone: h.pet.customer?.phone ?? "",
  };

  const idSuffix = type === "rabies" ? "" : `_${type}`;

  if (!validUntil) {
    return {
      ...base,
      healthId: h.id + idSuffix,
      vaccineType: type,
      vaccineLabel: label,
      lastDate: lastDate?.toISOString() ?? null,
      validUntil: null,
      daysUntil: 0,
      isExpired: false,
      isUnknown: true,
      ...(extra ? { extra } : {}),
    };
  }

  const days = daysFromNow(validUntil, now);
  return {
    ...base,
    healthId: h.id + idSuffix,
    vaccineType: type,
    vaccineLabel: label,
    lastDate: lastDate?.toISOString() ?? null,
    validUntil: validUntil.toISOString(),
    daysUntil: days,
    isExpired: validUntil < now,
    isUnknown: false,
    ...(extra ? { extra } : {}),
  };
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

// Build all vaccine entries for a single health record
function buildAllEntries(h: Awaited<ReturnType<typeof fetchHealths>>[number], now: Date): VaccinationEntry[] {
  const entries: VaccinationEntry[] = [];
  const base = h;

  // ── Rabies ─────────────────────────────────────────────────────────────────
  const rabiesUnknown = h.rabiesUnknown || !h.rabiesValidUntil;
  entries.push(buildEntry(base, "rabies", "כלבת", h.rabiesLastDate, rabiesUnknown ? null : h.rabiesValidUntil, now));

  // ── DHPP בוגר ──────────────────────────────────────────────────────────────
  entries.push(buildEntry(base, "dhpp", "משושה בוגר (DHPP)", h.dhppLastDate,
    h.dhppLastDate ? addDays(h.dhppLastDate, 365) : null, now));

  // ── DHPP גורים מנה 1 ────────────────────────────────────────────────────────
  entries.push(buildEntry(base, "dhppPuppy1", "משושה גורים מנה 1", h.dhppPuppy1Date,
    h.dhppPuppy1Date ? addDays(h.dhppPuppy1Date, 14) : null, now));

  // ── DHPP גורים מנה 2 ────────────────────────────────────────────────────────
  entries.push(buildEntry(base, "dhppPuppy2", "משושה גורים מנה 2", h.dhppPuppy2Date,
    h.dhppPuppy2Date ? addDays(h.dhppPuppy2Date, 14) : null, now));

  // ── DHPP גורים מנה 3 ────────────────────────────────────────────────────────
  entries.push(buildEntry(base, "dhppPuppy3", "משושה גורים מנה 3", h.dhppPuppy3Date,
    h.dhppPuppy3Date ? addDays(h.dhppPuppy3Date, 365) : null, now));

  // ── שעלת מכלאות (bordetella) ─ תיעוד בלבד, ללא תוקף אוטומטי ────────────────
  entries.push(buildEntry(base, "bordetella", "שעלת מכלאות", h.bordatellaDate, null, now));

  // ── תולעת הפארק ──────────────────────────────────────────────────────────────
  entries.push(buildEntry(base, "parkWorm", "תולעת הפארק", h.parkWormDate,
    h.parkWormDate ? addDays(h.parkWormDate, 90) : null, now));

  // ── תילוע ─────────────────────────────────────────────────────────────────────
  entries.push(buildEntry(base, "deworming", "תילוע", h.dewormingLastDate,
    h.dewormingLastDate ? addDays(h.dewormingLastDate, 180) : null, now));

  // ── קרציות ופרעושים ──────────────────────────────────────────────────────────
  entries.push(buildEntry(base, "fleaTick", "קרציות ופרעושים", h.fleaTickDate,
    h.fleaTickExpiryDate ?? null, now, h.fleaTickType ?? undefined));

  return entries;
}

async function fetchHealths(businessId: string) {
  return prisma.dogHealth.findMany({
    where: {
      pet: {
        OR: [
          { customer: { businessId } },
          { businessId },
        ],
      },
    },
    select: HEALTH_SELECT,
  });
}

const STATUS_ORDER = (v: VaccinationEntry) =>
  v.isExpired ? 0 : v.isUnknown ? 1 : v.daysUntil <= 30 ? 2 : 3;

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const allMode = searchParams.get("all") === "true";
    const now = new Date();

    // ── ALL MODE ────────────────────────────────────────────────────────────
    if (allMode) {
      const healths = await fetchHealths(authResult.businessId);
      const results: VaccinationEntry[] = healths.flatMap((h) => buildAllEntries(h, now));

      results.sort((a, b) => STATUS_ORDER(a) - STATUS_ORDER(b) || a.daysUntil - b.daysUntil);
      return NextResponse.json({ vaccinations: results, total: results.length });
    }

    // ── DAYS MODE ─────────────────────────────────────────────────────────────
    const days = Math.min(Math.max(parseInt(searchParams.get("days") ?? "30", 10), 1), 365);
    const cutoff = new Date(now.getTime() + days * DAY_MS);

    // Build cutoffs for computed-expiry types
    const dhppCutoff       = new Date(cutoff.getTime() - 365 * DAY_MS);
    const dhppPuppy1Cutoff = new Date(cutoff.getTime() - 14 * DAY_MS);
    const dhppPuppy2Cutoff = new Date(cutoff.getTime() - 14 * DAY_MS);
    const dhppPuppy3Cutoff = new Date(cutoff.getTime() - 365 * DAY_MS);
    const parkWormCutoff   = new Date(cutoff.getTime() - 90 * DAY_MS);
    const dewormCutoff     = new Date(cutoff.getTime() - 180 * DAY_MS);

    const healths = await prisma.dogHealth.findMany({
      where: {
        pet: {
          OR: [
            { customer: { businessId: authResult.businessId } },
            { businessId: authResult.businessId },
          ],
        },
        OR: [
          { rabiesValidUntil: { lte: cutoff }, rabiesUnknown: false },
          { dhppLastDate: { not: null, lte: dhppCutoff } },
          { dhppPuppy1Date: { not: null, lte: dhppPuppy1Cutoff } },
          { dhppPuppy2Date: { not: null, lte: dhppPuppy2Cutoff } },
          { dhppPuppy3Date: { not: null, lte: dhppPuppy3Cutoff } },
          { parkWormDate: { not: null, lte: parkWormCutoff } },
          { dewormingLastDate: { not: null, lte: dewormCutoff } },
          { fleaTickExpiryDate: { not: null, lte: cutoff } },
        ],
      },
      select: HEALTH_SELECT,
    });

    const results: VaccinationEntry[] = [];

    for (const h of healths) {
      const all = buildAllEntries(h, now);
      for (const entry of all) {
        if (entry.vaccineType === "bordetella") continue; // no expiry
        if (entry.isUnknown) continue;
        if (entry.validUntil && new Date(entry.validUntil) <= cutoff) {
          results.push(entry);
        }
      }
    }

    results.sort((a, b) => a.daysUntil - b.daysUntil);
    return NextResponse.json({ vaccinations: results, total: results.length });
  } catch (error) {
    console.error("GET pets/vaccinations error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת נתוני חיסונים" }, { status: 500 });
  }
}
