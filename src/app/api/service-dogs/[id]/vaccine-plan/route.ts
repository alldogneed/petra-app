export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { buildAdultYearPlan, ADULT_TREATMENTS, PUPPY_TREATMENTS, type VaccinePlan, type VaccineSchedule } from "@/lib/vaccine-plan";

// ─── helpers ───

type Entry = { planned: string | null; done: string | null; notVaccinated?: boolean };

/**
 * Computes the next due date for a treatment after entries are updated.
 * Adults: finds earliest planned-but-not-done, then projects next year.
 * Puppies: no year projection.
 */
function computeNextDueDate(entries: Entry[], planType: "adults" | "puppies"): Date | null {
  const upcomingPlanned = entries
    .filter(e => e.planned && !e.done)
    .map(e => e.planned!)
    .sort();

  if (upcomingPlanned.length > 0) {
    const p = upcomingPlanned[0];
    if (p.length === 7) {
      const [y, m] = p.split("-").map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date(p);
  }

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

function latestDoneDate(entries: Entry[]): Date | null {
  const dates = entries
    .filter(e => e.done)
    .map(e => new Date(e.done!))
    .sort((a, b) => b.getTime() - a.getTime());
  return dates[0] ?? null;
}

// ─── GET — load plan, auto-renew if year changed ───

// Phases that should use the adult vaccine plan
const ADULT_PHASES = ["ADVANCED_TRAINING", "CERTIFIED", "RETIRED", "DECERTIFIED", "SELECTION", "RAISING"];

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const [dogRow, biz] = await Promise.all([
      prisma.serviceDogProfile.findFirst({
        where: { id: params.id, businessId: authResult.businessId },
        select: { vaccinePlan: true, phase: true },
      }),
      prisma.business.findUnique({
        where: { id: authResult.businessId },
        select: { sdSettings: true },
      }),
    ]);

    if (!dogRow) return NextResponse.json({ error: "כלב לא נמצא" }, { status: 404 });

    const currentYear = new Date().getFullYear();
    let plan = (dogRow.vaccinePlan as VaccinePlan) || {};
    const sdSettings = biz?.sdSettings as { vaccinationSchedule?: VaccineSchedule; vaccinationScheduleEnabled?: boolean } | null;
    const schedule = (sdSettings?.vaccinationScheduleEnabled && sdSettings?.vaccinationSchedule)
      ? sdSettings.vaccinationSchedule
      : null;

    let dirty = false;

    // Auto-init adult plan: dog reached adult phase but has no adult plan yet
    if (ADULT_PHASES.includes(dogRow.phase) && !plan.adults) {
      plan = { ...plan, adults: buildAdultYearPlan(currentYear, schedule, null) };
      dirty = true;
    }

    // Auto-renewal: if adults plan exists but is from a previous year, archive and generate new year
    if (plan.adults && plan.adults.year !== currentYear) {
      const history = plan.adultsHistory ?? [];
      // Only keep last 3 years to avoid unbounded growth
      const updatedHistory = [...history, plan.adults].slice(-3);
      const newAdults = buildAdultYearPlan(currentYear, schedule, plan.adults);
      plan = { ...plan, adults: newAdults, adultsHistory: updatedHistory };
      dirty = true;
    }

    if (dirty) {
      await prisma.serviceDogProfile.update({
        where: { id: params.id },
        data: { vaccinePlan: plan as object },
      });
    }

    return NextResponse.json(plan);
  } catch (error) {
    console.error("GET /api/service-dogs/[id]/vaccine-plan error:", error);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}

// ─── PATCH — save full plan (e.g. after editing planned dates) ───

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { vaccinePlan, planType: bodyPlanType } = body as { vaccinePlan: VaccinePlan; planType?: "adults" | "puppies" };

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

    // planType from client if provided, else infer (adults takes priority if both exist)
    const planType: "adults" | "puppies" = bodyPlanType ?? (vaccinePlan.adults ? "adults" : "puppies");
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
          data: { dueDate: nextDue, status: nextDue < now ? "OVERDUE" : "PENDING" },
        });
      }
    }

    return NextResponse.json(updated.vaccinePlan);
  } catch (error) {
    console.error("PATCH /api/service-dogs/[id]/vaccine-plan error:", error);
    return NextResponse.json({ error: "שגיאה בשמירת תוכנית חיסונים" }, { status: 500 });
  }
}

// ─── POST — mark a specific entry as done (or undo) ───

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { planType, treatmentKey, index, doneDate, notVaccinated } = body as {
      planType: "adults" | "puppies";
      treatmentKey: string;
      index: number;
      doneDate?: string | null;
      notVaccinated?: boolean;
    };

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: { medicalProtocols: { where: { protocolKey: treatmentKey } } },
    });
    if (!dog) return NextResponse.json({ error: "כלב לא נמצא" }, { status: 404 });

    const currentPlan = (dog.vaccinePlan as VaccinePlan) || {};
    const section = planType === "adults" ? currentPlan.adults : currentPlan.puppies;
    if (!section) return NextResponse.json({ error: "תוכנית לא נמצאה" }, { status: 400 });

    let entries = (section as Record<string, Entry[]>)[treatmentKey];
    if (!entries) {
      // Auto-initialize missing treatment (e.g. SPAY_NEUTER added after plan was created)
      const allTreatments = [...ADULT_TREATMENTS, ...PUPPY_TREATMENTS] as readonly { key: string; doses: number }[];
      const treatment = allTreatments.find(t => t.key === treatmentKey);
      if (!treatment) return NextResponse.json({ error: "ערך לא נמצא" }, { status: 400 });
      entries = Array.from({ length: treatment.doses }, () => ({ planned: null, done: null }));
    }
    if (index >= entries.length) return NextResponse.json({ error: "ערך לא נמצא" }, { status: 400 });

    // Update the specific dose — preserves all other done dates (history)
    if (notVaccinated !== undefined) {
      // Toggle "not vaccinated" flag; clearing it also clears done
      entries[index] = { ...entries[index], notVaccinated, done: notVaccinated ? null : entries[index].done };
    } else {
      // Mark done (or undo): clearing done also clears notVaccinated
      entries[index] = { ...entries[index], done: doneDate ?? null, notVaccinated: doneDate ? false : entries[index].notVaccinated };
    }
    (section as Record<string, unknown>)[treatmentKey] = entries;
    const newPlan: VaccinePlan = planType === "adults"
      ? { ...currentPlan, adults: section as VaccinePlan["adults"] }
      : { ...currentPlan, puppies: section as VaccinePlan["puppies"] };

    await prisma.serviceDogProfile.update({
      where: { id: params.id },
      data: { vaccinePlan: newPlan as object },
    });

    // Sync medical protocol dueDate to next planned date from annual schedule
    if (dog.medicalProtocols.length > 0) {
      const proto = dog.medicalProtocols[0];
      const nextDue = computeNextDueDate(entries, planType);
      const lastDone = latestDoneDate(entries);

      const now = new Date();
      let status = "PENDING";
      if (!nextDue && lastDone) status = "COMPLETED";
      else if (nextDue && nextDue < now) status = "OVERDUE";
      else status = "PENDING";

      await prisma.serviceDogMedicalProtocol.update({
        where: { id: proto.id },
        data: {
          completedDate: lastDone,
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
