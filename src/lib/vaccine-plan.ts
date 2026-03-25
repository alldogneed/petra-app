// Vaccine plan types and helpers

export interface VaccinePlanEntry {
  planned: string | null; // "2026-04" for adults (mm/yyyy), "2026-04-15" for puppies (dd/mm/yyyy ISO)
  done: string | null;    // ISO date string when completed
}

export interface VaccinePlan {
  adults?: {
    year: number;
    RABIES_BOOSTER?: VaccinePlanEntry[];
    DHPP_BOOSTER?: VaccinePlanEntry[];
    DEWORMING?: VaccinePlanEntry[];
    PARK_WORM?: VaccinePlanEntry[];
    FLEA_TICK?: VaccinePlanEntry[];
  };
  puppies?: {
    RABIES_PRIMARY?: VaccinePlanEntry[];  // 2 doses
    DHPP_PRIMARY?: VaccinePlanEntry[];    // 3 doses
    DEWORMING?: VaccinePlanEntry[];       // 4 doses
    PARK_WORM?: VaccinePlanEntry[];       // 4 doses
    FLEA_TICK?: VaccinePlanEntry[];       // 4 doses
  };
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
] as const;

export function getEmptyAdultPlan(year: number): VaccinePlan["adults"] {
  const make = (doses: number) => Array(doses).fill(null).map(() => ({ planned: null, done: null }));
  return {
    year,
    RABIES_BOOSTER: make(1),
    DHPP_BOOSTER:   make(1),
    DEWORMING:      make(2),
    PARK_WORM:      make(4),
    FLEA_TICK:      make(4),
  };
}

export function getEmptyPuppyPlan(): VaccinePlan["puppies"] {
  const make = (doses: number) => Array(doses).fill(null).map(() => ({ planned: null, done: null }));
  return {
    RABIES_PRIMARY: make(2),
    DHPP_PRIMARY:   make(3),
    DEWORMING:      make(4),
    PARK_WORM:      make(4),
    FLEA_TICK:      make(4),
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
