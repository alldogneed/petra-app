export const dynamic = "force-dynamic";
/**
 * POST /api/pets/[petId]/health/renew-vaccine
 * Renews a vaccination:
 *   - Appends the old date+validUntil to the history array
 *   - Updates the current date+validUntil fields
 * Body: { vaccineType: "rabies" | "dhpp" | "bordetella", newDate: string, newValidUntil?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

type VaccineType = "rabies" | "dhpp" | "bordetella";

const VACCINE_MAP: Record<VaccineType, { dateField: string; validUntilField: string; historyField: string }> = {
  rabies:     { dateField: "rabiesLastDate",  validUntilField: "rabiesValidUntil",     historyField: "rabiesHistory" },
  dhpp:       { dateField: "dhppLastDate",    validUntilField: "dhppValidUntil",       historyField: "dhppHistory" },
  bordetella: { dateField: "bordatellaDate",  validUntilField: "bordatellaValidUntil", historyField: "bordatellaHistory" },
};

export async function POST(
  request: NextRequest,
  { params }: { params: { petId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const pet = await prisma.pet.findFirst({
      where: { id: params.petId, OR: [{ customer: { businessId: authResult.businessId } }, { businessId: authResult.businessId }] },
      include: { health: true },
    });
    if (!pet) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

    const body = await request.json();
    const { vaccineType, newDate, newValidUntil } = body as {
      vaccineType: VaccineType;
      newDate: string;
      newValidUntil?: string;
    };

    if (!VACCINE_MAP[vaccineType]) {
      return NextResponse.json({ error: "סוג חיסון לא תקין" }, { status: 400 });
    }
    if (!newDate) {
      return NextResponse.json({ error: "תאריך חיסון חסר" }, { status: 400 });
    }

    const { dateField, validUntilField, historyField } = VACCINE_MAP[vaccineType];
    const currentHealth = pet.health;

    // Build history entry from current values (if they exist)
    const currentDate = currentHealth ? (currentHealth as Record<string, unknown>)[dateField] : null;
    const currentValidUntil = currentHealth ? (currentHealth as Record<string, unknown>)[validUntilField] : null;

    let existingHistory: unknown[] = [];
    if (currentHealth) {
      const raw = (currentHealth as Record<string, unknown>)[historyField];
      if (Array.isArray(raw)) existingHistory = raw;
    }

    const updatedHistory = currentDate
      ? [
          ...existingHistory,
          {
            date: currentDate instanceof Date ? currentDate.toISOString() : currentDate,
            validUntil: currentValidUntil instanceof Date ? (currentValidUntil as Date).toISOString() : currentValidUntil ?? null,
            recordedAt: new Date().toISOString(),
          },
        ]
      : existingHistory;

    const updateData: Record<string, unknown> = {
      [dateField]: new Date(newDate),
      [validUntilField]: newValidUntil ? new Date(newValidUntil) : null,
      [historyField]: updatedHistory,
    };

    const health = await prisma.dogHealth.upsert({
      where: { petId: params.petId },
      create: { petId: params.petId, ...updateData },
      update: updateData,
    });

    return NextResponse.json(health);
  } catch (error) {
    console.error("POST /renew-vaccine error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון חיסון" }, { status: 500 });
  }
}
