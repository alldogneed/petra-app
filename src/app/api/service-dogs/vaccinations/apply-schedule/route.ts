export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { buildAdultYearPlan, getEmptyPuppyPlan, type VaccinePlan, type VaccineSchedule } from "@/lib/vaccine-plan";

/**
 * POST /api/service-dogs/vaccinations/apply-schedule
 * Applies the business vaccination schedule to ALL service dogs:
 * - Adult dogs (≥12 months): rebuilds adults plan using business schedule
 * - Puppy dogs (<12 months): creates puppy plan if none exists (from puppyVaccinationSchedule weeks)
 * Dogs with no plan get a fresh one; dogs with an existing plan get planned dates updated (done dates preserved).
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const biz = await prisma.business.findUnique({
      where: { id: authResult.businessId },
      select: { sdSettings: true },
    });

    const sdSettings = biz?.sdSettings as {
      vaccinationSchedule?: VaccineSchedule;
      vaccinationScheduleEnabled?: boolean;
      puppyVaccinationSchedule?: Record<string, number[]>;
    } | null;

    if (!sdSettings?.vaccinationScheduleEnabled) {
      return NextResponse.json({ error: "לוח חיסונים ברירת מחדל אינו מופעל" }, { status: 400 });
    }

    const schedule = sdSettings.vaccinationSchedule ?? null;
    const currentYear = new Date().getFullYear();

    const dogs = await prisma.serviceDogProfile.findMany({
      where: { businessId: authResult.businessId },
      select: { id: true, vaccinePlan: true, phase: true, pet: { select: { birthDate: true } } },
    });

    let updatedCount = 0;

    for (const dog of dogs) {
      // Determine puppy vs adult by birth date
      const bd = dog.pet.birthDate;
      const ageMonths = bd
        ? (Date.now() - new Date(bd).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
        : null;
      const isDogPuppy = ageMonths !== null ? ageMonths < 12 : dog.phase === "PUPPY";

      const currentPlan = (dog.vaccinePlan as VaccinePlan) || {};

      let newPlan: VaccinePlan;

      if (isDogPuppy) {
        // For puppies: create plan if none, apply weeks schedule if set
        if (currentPlan.puppies) {
          // Already has puppy plan — apply weeks defaults to null planned entries
          const pupSched = sdSettings.puppyVaccinationSchedule;
          if (!pupSched) continue; // no puppy schedule defined, skip
          const updatedPuppies = { ...currentPlan.puppies } as Record<string, Array<{ planned: string | null; done: string | null }>>;
          for (const [key, weeks] of Object.entries(pupSched)) {
            const validWeeks = weeks.filter(w => w > 0);
            if (!validWeeks.length) continue;
            const existingEntries = updatedPuppies[key] ?? [];
            updatedPuppies[key] = validWeeks.map((w, i) => {
              const existing = existingEntries[i];
              // Compute planned date from birthDate + weeks; only set if not already done
              if (existing?.done) return existing; // preserve done entries
              const planned = bd
                ? new Date(new Date(bd).getTime() + w * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
                : null;
              return { planned, done: existing?.done ?? null };
            });
          }
          newPlan = { ...currentPlan, puppies: updatedPuppies as VaccinePlan["puppies"] };
        } else {
          // No puppy plan: create empty
          newPlan = { ...currentPlan, puppies: getEmptyPuppyPlan() };
        }
      } else {
        // Adult dog: rebuild adults plan with schedule, preserving done dates
        const prevAdults = currentPlan.adults ?? null;
        const newAdults = buildAdultYearPlan(currentYear, schedule, prevAdults);

        // Preserve done dates from existing plan
        if (prevAdults && prevAdults.year === currentYear) {
          const adultKeys = ["RABIES_BOOSTER", "DHPP_BOOSTER", "DEWORMING", "PARK_WORM", "FLEA_TICK"] as const;
          for (const key of adultKeys) {
            const existing = prevAdults[key] ?? [];
            const fresh = newAdults[key] ?? [];
            (newAdults[key] as Array<{ planned: string | null; done: string | null }>) = fresh.map((entry, i) => ({
              planned: entry.planned,
              done: existing[i]?.done ?? null,
            }));
          }
        }

        // Archive old year if different
        if (prevAdults && prevAdults.year !== currentYear) {
          const history = currentPlan.adultsHistory ?? [];
          newPlan = { ...currentPlan, adults: newAdults, adultsHistory: [...history, prevAdults].slice(-3) };
        } else {
          newPlan = { ...currentPlan, adults: newAdults };
        }
      }

      await prisma.serviceDogProfile.update({
        where: { id: dog.id },
        data: { vaccinePlan: newPlan as object },
      });
      updatedCount++;
    }

    return NextResponse.json({ ok: true, updatedCount });
  } catch (error) {
    console.error("POST /api/service-dogs/vaccinations/apply-schedule error:", error);
    return NextResponse.json({ error: "שגיאה בהחלת לוח חיסונים" }, { status: 500 });
  }
}
