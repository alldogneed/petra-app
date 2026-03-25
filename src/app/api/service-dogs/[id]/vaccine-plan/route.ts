export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import type { VaccinePlan } from "@/lib/vaccine-plan";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      select: { vaccinePlan: true },
    });

    if (!dog) return NextResponse.json({ error: "כלב לא נמצא" }, { status: 404 });
    return NextResponse.json(dog.vaccinePlan || {});
  } catch (error) {
    console.error("GET /api/service-dogs/[id]/vaccine-plan error:", error);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { vaccinePlan } = body as { vaccinePlan: VaccinePlan };

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: { medicalProtocols: true },
    });
    if (!dog) return NextResponse.json({ error: "כלב לא נמצא" }, { status: 404 });

    const updated = await prisma.serviceDogProfile.update({
      where: { id: params.id },
      data: { vaccinePlan: vaccinePlan as object },
      select: { vaccinePlan: true },
    });

    // When a new annual plan is saved, seed dueDate into each matching medical protocol
    const planType = vaccinePlan.puppies ? "puppies" : "adults";
    const section = planType === "adults" ? vaccinePlan.adults : vaccinePlan.puppies;
    if (section && dog.medicalProtocols.length > 0) {
      const entries = section as Record<string, Entry[]>;
      for (const proto of dog.medicalProtocols) {
        const treatmentEntries = entries[proto.protocolKey];
        if (!treatmentEntries) continue;
        const nextDue = computeNextDueDate(treatmentEntries, planType);
        if (!nextDue) continue;
        const now = new Date();
        await prisma.serviceDogMedicalProtocol.update({
          where: { id: proto.id },
          data: {
            dueDate: nextDue,
            status: nextDue < now ? "OVERDUE" : "PENDING",
          },
        });
      }
    }

    return NextResponse.json(updated.vaccinePlan);
  } catch (error) {
    console.error("PATCH /api/service-dogs/[id]/vaccine-plan error:", error);
    return NextResponse.json({ error: "שגיאה בשמירת תוכנית חיסונים" }, { status: 500 });
  }
}

// ─── helpers ───

type Entry = { planned: string | null; done: string | null };

/**
 * After updating entries, computes the next due date for a treatment:
 * 1. Find the earliest planned-but-not-done entry in the current plan.
 * 2. If all are done (adults), project to next year using the earliest planned month.
 * Puppies are a one-time series — no projection.
 */
function computeNextDueDate(entries: Entry[], planType: "adults" | "puppies"): Date | null {
  const upcomingPlanned = entries
    .filter(e => e.planned && !e.done)
    .map(e => e.planned!)
    .sort();

  if (upcomingPlanned.length > 0) {
    const p = upcomingPlanned[0];
    // "YYYY-MM" — use 1st of that month
    if (p.length === 7) {
      const [y, m] = p.split("-").map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date(p);
  }

  // All done — adults only: project next cycle using earliest planned month
  if (planType === "adults") {
    const allPlanned = entries.map(e => e.planned).filter(Boolean).sort() as string[];
    if (allPlanned.length > 0) {
      const p = allPlanned[0];
      if (p.length === 7) {
        const [y, m] = p.split("-").map(Number);
        return new Date(y + 1, m - 1, 1);
      }
    }
  }

  return null;
}

/** Returns the most recent completed date across all doses of a treatment. */
function latestDoneDate(entries: Entry[]): Date | null {
  const dates = entries
    .filter(e => e.done)
    .map(e => new Date(e.done!))
    .sort((a, b) => b.getTime() - a.getTime());
  return dates[0] ?? null;
}

// POST — mark a specific entry as done (or undo)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { planType, treatmentKey, index, doneDate } = body as {
      planType: "adults" | "puppies";
      treatmentKey: string;
      index: number;
      doneDate: string | null; // ISO date string or null to undo
    };

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: { medicalProtocols: { where: { protocolKey: treatmentKey } } },
    });
    if (!dog) return NextResponse.json({ error: "כלב לא נמצא" }, { status: 404 });

    const currentPlan = (dog.vaccinePlan as VaccinePlan) || {};
    const section = planType === "adults" ? currentPlan.adults : currentPlan.puppies;
    if (!section) return NextResponse.json({ error: "תוכנית לא נמצאה" }, { status: 400 });

    const entries = (section as Record<string, Entry[]>)[treatmentKey];
    if (!entries || index >= entries.length) return NextResponse.json({ error: "ערך לא נמצא" }, { status: 400 });

    // Update the specific dose — preserves all other done dates (history)
    entries[index] = { ...entries[index], done: doneDate };
    (section as Record<string, unknown>)[treatmentKey] = entries;
    const newPlan: VaccinePlan = planType === "adults"
      ? { ...currentPlan, adults: section as VaccinePlan["adults"] }
      : { ...currentPlan, puppies: section as VaccinePlan["puppies"] };

    await prisma.serviceDogProfile.update({
      where: { id: params.id },
      data: { vaccinePlan: newPlan as object },
    });

    // Sync medical protocol: set dueDate to next planned date from the annual schedule
    if (dog.medicalProtocols.length > 0) {
      const proto = dog.medicalProtocols[0];
      const nextDue = computeNextDueDate(entries, planType);
      const lastDone = latestDoneDate(entries);

      // Determine status based on next due date
      const now = new Date();
      let status = "PENDING";
      if (!nextDue && !lastDone) status = "PENDING";
      else if (!nextDue && lastDone) status = "COMPLETED"; // puppies: all done
      else if (nextDue && nextDue < now) status = "OVERDUE";
      else status = "PENDING";

      await prisma.serviceDogMedicalProtocol.update({
        where: { id: proto.id },
        data: {
          // completedDate = most recent done across all doses (for display in protocols tab)
          completedDate: lastDone,
          // dueDate = next planned date from annual schedule
          dueDate: nextDue ?? proto.dueDate,
          status,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/service-dogs/[id]/vaccine-plan error:", error);
    return NextResponse.json({ error: "שגיאה בביצוע חיסון" }, { status: 500 });
  }
}
