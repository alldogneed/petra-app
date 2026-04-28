export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

async function verifyPet(petId: string, businessId: string) {
  return prisma.pet.findFirst({
    where: {
      id: petId,
      OR: [{ customer: { businessId } }, { businessId }],
    },
  });
}

// Maps: vaccine date field → { historyField, validUntilField? }
const HISTORY_MAP: Record<string, { history: string; validUntil?: string }> = {
  rabiesLastDate:    { history: "rabiesHistory",    validUntil: "rabiesValidUntil" },
  dhppLastDate:      { history: "dhppHistory" },
  bordatellaDate:    { history: "bordatellaHistory" },
  parkWormDate:      { history: "parkWormHistory" },
  dewormingLastDate: { history: "dewormingHistory" },
  fleaTickDate:      { history: "fleaTickHistory",  validUntil: "fleaTickExpiryDate" },
};

// PATCH /api/pets/[petId]/health — upsert DogHealth
export async function PATCH(
  request: NextRequest,
  { params }: { params: { petId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const pet = await verifyPet(params.petId, businessId);
    if (!pet) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

    const body = await request.json();

    const data: Record<string, unknown> = {};
    const dateFields = [
      "rabiesLastDate", "rabiesValidUntil",
      "dhppLastDate", "dhppValidUntil",
      "dhppPuppy1Date", "dhppPuppy2Date", "dhppPuppy3Date",
      "bordatellaDate", "bordatellaValidUntil", "parkWormDate", "parkWormValidUntil",
      "dewormingLastDate", "dewormingValidUntil",
      "fleaTickDate", "fleaTickExpiryDate",
      "neuteredSpayedDate",
    ];
    const stringFields = ["allergies", "medicalConditions", "surgeriesHistory", "activityLimitations", "vetName", "vetPhone", "originInfo", "timeWithOwner", "fleaTickType"];
    const boolFields = ["neuteredSpayed", "rabiesUnknown"];
    const jsonFields = ["notVaccinatedFlags"];

    for (const f of dateFields) {
      if (f in body) data[f] = body[f] ? new Date(body[f]) : null;
    }
    for (const f of stringFields) {
      if (f in body) data[f] = body[f] || null;
    }
    for (const f of boolFields) {
      if (f in body) data[f] = Boolean(body[f]);
    }
    for (const f of jsonFields) {
      if (f in body) data[f] = body[f] ?? null;
    }

    // ── Vaccination history: when updating a vaccine date, append the old date to history ──
    const updatingVaccineDates = Object.keys(HISTORY_MAP).filter(
      (f) => f in body && body[f]
    );
    if (updatingVaccineDates.length > 0) {
      const selectFields: Record<string, boolean> = {};
      for (const f of updatingVaccineDates) {
        selectFields[f] = true;
        selectFields[HISTORY_MAP[f].history] = true;
        if (HISTORY_MAP[f].validUntil) selectFields[HISTORY_MAP[f].validUntil!] = true;
      }
      const current = await prisma.dogHealth.findUnique({
        where: { petId: params.petId },
        select: selectFields as Record<string, true>,
      });
      if (current) {
        for (const f of updatingVaccineDates) {
          const cfg = HISTORY_MAP[f];
          const oldDate = (current as Record<string, unknown>)[f] as Date | null;
          if (oldDate) {
            const prev = ((current as Record<string, unknown>)[cfg.history] as { date: string; validUntil?: string }[] | null) ?? [];
            const entry: { date: string; validUntil?: string } = { date: oldDate.toISOString() };
            if (cfg.validUntil) {
              const oldVU = (current as Record<string, unknown>)[cfg.validUntil] as Date | null;
              if (oldVU) entry.validUntil = oldVU.toISOString();
            }
            data[cfg.history] = [...prev, entry];
          }
        }
      }
    }

    const health = await prisma.dogHealth.upsert({
      where: { petId: params.petId },
      create: { petId: params.petId, ...data },
      update: data,
    });

    return NextResponse.json(health);
  } catch (error) {
    console.error("PATCH health error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון נתוני בריאות" }, { status: 500 });
  }
}
