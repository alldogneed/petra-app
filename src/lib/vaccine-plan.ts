// Vaccine plan types and helpers

export interface VaccinePlanEntry {
  planned: string | null; // "2026-04" for adults (YYYY-MM), ISO date for puppies
  done: string | null;    // ISO date string when completed
}

/** Business-level default schedule: which months each treatment is given */
export interface VaccineSchedule {
  RABIES_BOOSTER?: number[];   // month numbers 1-12
  DHPP_BOOSTER?: number[];
  DEWORMING?: number[];
  PARK_WORM?: number[];
  FLEA_TICK?: number[];
}

type AdultYearPlan = {
  year: number;
  RABIES_BOOSTER?: VaccinePlanEntry[];
  DHPP_BOOSTER?: VaccinePlanEntry[];
  DEWORMING?: VaccinePlanEntry[];
  PARK_WORM?: VaccinePlanEntry[];
  FLEA_TICK?: VaccinePlanEntry[];
};

export interface VaccinePlan {
  adults?: AdultYearPlan;
  puppies?: {
    RABIES_PRIMARY?: VaccinePlanEntry[];  // 2 doses
    DHPP_PRIMARY?: VaccinePlanEntry[];    // 3 doses
    DEWORMING?: VaccinePlanEntry[];       // 4 doses
    PARK_WORM?: VaccinePlanEntry[];       // 4 doses
    FLEA_TICK?: VaccinePlanEntry[];       // 4 doses
    SPAY_NEUTER?: VaccinePlanEntry[];     // 1 dose
  };
  /** Past years archived on auto-renewal */
  adultsHistory?: AdultYearPlan[];
}

export const ADULT_TREATMENTS = [
  { key: "RABIES_BOOSTER", label: "כלבת", doses: 1 },
  { key: "DHPP_BOOSTER",   label: "משושה", doses: 1 },
  { key: "DEWORMING",      label: "תילוע", doses: 2 },
  { key: "PARK_WORM",      label: "תולעת הפארק", doses: 4 },
  { key: "FLEA_TICK",      label: "קרציות ופרעושים", doses: 4 },
] as const;

export const PUPPY_TREATMENTS = [
  { key: "RABIES_PRIMARY", label: "כלבת", doses: 2 },
  { key: "DHPP_PRIMARY",   label: "משושה גורים", doses: 3 },
  { key: "DEWORMING",      label: "תילוע", doses: 4 },
  { key: "PARK_WORM",      label: "תולעת הפארק", doses: 4 },
  { key: "FLEA_TICK",      label: "קרציות ופרעושים", doses: 4 },
  { key: "SPAY_NEUTER",    label: "סירוס/עיקור", doses: 1 },
] as const;

/**
 * Build a fresh adult plan for `year`:
 * 1. If business schedule has months for a treatment → use those
 * 2. Else if prevPlan has planned months → carry same months forward
 * 3. Else → empty entries (null planned)
 *
 * All done dates start as null (fresh checkboxes for new year).
 */
export function buildAdultYearPlan(
  year: number,
  schedule?: VaccineSchedule | null,
  prevPlan?: AdultYearPlan | null
): AdultYearPlan {
  const makeFromMonths = (months: number[]): VaccinePlanEntry[] =>
    months.map(m => ({ planned: `${year}-${String(m).padStart(2, "0")}`, done: null }));

  const makeEmpty = (doses: number): VaccinePlanEntry[] =>
    Array(doses).fill(null).map(() => ({ planned: null, done: null }));

  const resolve = (key: string, defaultDoses: number): VaccinePlanEntry[] => {
    // 1. Business schedule (filter out 0 = "לא מוגדר")
    const schedMonths = (schedule as Record<string, number[]> | null | undefined)?.[key]?.filter(m => m >= 1 && m <= 12);
    if (schedMonths && schedMonths.length > 0) {
      // Pad to defaultDoses so all dose slots appear in the plan
      const entries = makeFromMonths(schedMonths);
      while (entries.length < defaultDoses) entries.push({ planned: null, done: null });
      return entries;
    }

    // 2. Carry forward from previous year
    if (prevPlan) {
      const prevEntries = (prevPlan as unknown as Record<string, VaccinePlanEntry[]>)[key];
      if (prevEntries && prevEntries.length > 0) {
        const months = prevEntries
          .map(e => e.planned ? parseInt(e.planned.split("-")[1], 10) : null)
          .filter((m): m is number => m !== null && m >= 1 && m <= 12);
        if (months.length > 0) return makeFromMonths(months);
      }
    }

    // 3. Empty
    return makeEmpty(defaultDoses);
  };

  return {
    year,
    RABIES_BOOSTER: resolve("RABIES_BOOSTER", 1),
    DHPP_BOOSTER:   resolve("DHPP_BOOSTER", 1),
    DEWORMING:      resolve("DEWORMING", 2),
    PARK_WORM:      resolve("PARK_WORM", 4),
    FLEA_TICK:      resolve("FLEA_TICK", 4),
  };
}

export function getEmptyAdultPlan(year: number): VaccinePlan["adults"] {
  return buildAdultYearPlan(year, null, null);
}

export function getEmptyPuppyPlan(): VaccinePlan["puppies"] {
  const make = (doses: number) => Array(doses).fill(null).map(() => ({ planned: null, done: null }));
  return {
    RABIES_PRIMARY: make(2),
    DHPP_PRIMARY:   make(3),
    DEWORMING:      make(4),
    PARK_WORM:      make(4),
    FLEA_TICK:      make(4),
    SPAY_NEUTER:    make(1),
  };
}

/** Returns cell status for display */
export function getCellStatus(entry: VaccinePlanEntry | null | undefined): "done" | "overdue" | "upcoming" | "soon" | "unknown" {
  if (!entry) return "unknown";
  if (entry.done) return "done";
  if (!entry.planned) return "unknown";

  const now = new Date();
  const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // adult: planned is "2026-04" format
  if (entry.planned.length === 7) {
    if (entry.planned < nowYM) return "overdue";
    const [py, pm] = entry.planned.split("-").map(Number);
    const diffMonths = (py - now.getFullYear()) * 12 + (pm - (now.getMonth() + 1));
    if (diffMonths <= 1) return "soon";
    return "upcoming";
  }

  // puppy: planned is ISO date
  const plannedDate = new Date(entry.planned);
  if (plannedDate < now) return "overdue";
  const diffDays = (plannedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 30) return "soon";
  return "upcoming";
}

export function formatPlannedDisplay(planned: string): string {
  if (planned.length === 7) {
    // "2026-04" → "אפריל 2026"
    const [year, month] = planned.split("-").map(Number);
    return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(new Date(year, month - 1));
  }
  // ISO date
  return new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" }).format(new Date(planned));
}
