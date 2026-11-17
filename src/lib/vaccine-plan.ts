// Vaccine plan types and helpers

export interface VaccinePlanEntry {
  planned: string | null; // "2026-04" for adults (YYYY-MM), ISO date for puppies
  done: string | null;    // ISO date string when completed
  notVaccinated?: boolean; // explicitly marked as never vaccinated
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
export function getCellStatus(entry: VaccinePlanEntry | null | undefined): "done" | "overdue" | "upcoming" | "soon" | "unknown" | "not_vaccinated" {
  if (!entry) return "unknown";
  if (entry.notVaccinated) return "not_vaccinated";
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

// ─── Vaccination / treatment history (DogHealth + vaccine plan) ───────────────
// One list of everything ever recorded for a dog: DogHealth *LastDate + *History
// per type AND every `done` date in the vaccine plan (adults, puppies,
// adultsHistory). Pure — used by the service-dog "חיסונים וטיפולים" tab, the
// vaccine-plan POST (mirrors a done slot into DogHealth) and renewVaccine.

export const VACCINATION_TYPES = [
  { key: "rabies",     label: "כלבת" },
  { key: "dhpp",       label: "משושה" },
  { key: "bordetella", label: "שעלת מכלאות" },
  { key: "parkWorm",   label: "תולעת הפארק" },
  { key: "deworming",  label: "תילוע" },
  { key: "fleaTick",   label: "קרציות ופרעושים" },
] as const;

export type VaccinationType = typeof VACCINATION_TYPES[number]["key"];

export const VACCINATION_TYPE_LABELS: Record<VaccinationType, string> = Object.fromEntries(
  VACCINATION_TYPES.map((t) => [t.key, t.label])
) as Record<VaccinationType, string>;

export function isVaccinationType(v: unknown): v is VaccinationType {
  return typeof v === "string" && v in VACCINATION_TYPE_LABELS;
}

/** DogHealth columns for each type (note the historical "bordatella" spelling). */
export const VACCINATION_HEALTH_FIELDS: Record<VaccinationType, { dateField: string; validUntilField: string; historyField: string }> = {
  rabies:     { dateField: "rabiesLastDate",    validUntilField: "rabiesValidUntil",     historyField: "rabiesHistory" },
  dhpp:       { dateField: "dhppLastDate",      validUntilField: "dhppValidUntil",       historyField: "dhppHistory" },
  bordetella: { dateField: "bordatellaDate",    validUntilField: "bordatellaValidUntil", historyField: "bordatellaHistory" },
  parkWorm:   { dateField: "parkWormDate",      validUntilField: "parkWormValidUntil",   historyField: "parkWormHistory" },
  deworming:  { dateField: "dewormingLastDate", validUntilField: "dewormingValidUntil",  historyField: "dewormingHistory" },
  fleaTick:   { dateField: "fleaTickDate",      validUntilField: "fleaTickExpiryDate",   historyField: "fleaTickHistory" },
};

/** Vaccine-plan treatment key → DogHealth type. SPAY_NEUTER (and unknown keys) → null. */
export function planKeyToVaccinationType(treatmentKey: string): VaccinationType | null {
  switch (treatmentKey) {
    case "RABIES_BOOSTER":
    case "RABIES_PRIMARY": return "rabies";
    case "DHPP_BOOSTER":
    case "DHPP_PRIMARY":   return "dhpp";
    case "DEWORMING":      return "deworming";
    case "PARK_WORM":      return "parkWorm";
    case "FLEA_TICK":      return "fleaTick";
    default:               return null;
  }
}

const ISRAEL_YMD = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit",
});

/**
 * Calendar day (YYYY-MM-DD) of a stored date. A bare "YYYY-MM-DD" is taken as is;
 * a timestamp is read in Israel time (00:00Z and Israel-midnight both land on the
 * intended day). Invalid / empty → null.
 */
export function toYmd(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return ISRAEL_YMD.format(d);
}

export interface HealthHistoryEntry {
  date: string;
  validUntil?: string | null;
  recordedAt?: string;
}

export interface VaccinationRecord {
  type: VaccinationType;
  label: string;
  /** YYYY-MM-DD */
  date: string;
  /** YYYY-MM-DD when known */
  validUntil: string | null;
}

function asHistory(raw: unknown): HealthHistoryEntry[] {
  return Array.isArray(raw)
    ? raw.filter((e): e is HealthHistoryEntry => !!e && typeof e === "object" && "date" in e)
    : [];
}

/**
 * Every recorded vaccination / treatment, newest first, de-duplicated by
 * (type, day). When the same (type, day) appears more than once the copy with a
 * valid-until wins (DogHealth over a bare plan checkbox).
 */
export function buildVaccinationHistory(
  health: Record<string, unknown> | null | undefined,
  plan: VaccinePlan | null | undefined,
): VaccinationRecord[] {
  const byKey = new Map<string, VaccinationRecord>();
  const add = (type: VaccinationType, dateRaw: unknown, validRaw?: unknown) => {
    const date = toYmd(dateRaw);
    if (!date) return;
    const validUntil = toYmd(validRaw);
    const key = `${type}|${date}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { type, label: VACCINATION_TYPE_LABELS[type], date, validUntil });
      return;
    }
    if (!prev.validUntil && validUntil) prev.validUntil = validUntil;
  };

  if (health) {
    for (const t of VACCINATION_TYPES) {
      const f = VACCINATION_HEALTH_FIELDS[t.key];
      add(t.key, health[f.dateField], health[f.validUntilField]);
      for (const h of asHistory(health[f.historyField])) add(t.key, h.date, h.validUntil);
    }
  }

  if (plan) {
    const sections: Record<string, unknown>[] = [];
    if (plan.adults) sections.push(plan.adults as unknown as Record<string, unknown>);
    if (plan.puppies) sections.push(plan.puppies as unknown as Record<string, unknown>);
    for (const y of plan.adultsHistory ?? []) sections.push(y as unknown as Record<string, unknown>);
    for (const section of sections) {
      for (const [treatmentKey, entries] of Object.entries(section)) {
        const type = planKeyToVaccinationType(treatmentKey);
        if (!type || !Array.isArray(entries)) continue;
        for (const e of entries as VaccinePlanEntry[]) {
          if (e && e.done && !e.notVaccinated) add(type, e.done);
        }
      }
    }
  }

  return [...byKey.values()].sort((a, b) =>
    a.date === b.date ? a.label.localeCompare(b.label, "he") : a.date < b.date ? 1 : -1
  );
}

export interface HealthRecordState {
  lastDate: unknown;
  validUntil: unknown;
  history: unknown;
}

export interface HealthRecordUpdate {
  /** false = DogHealth needs no write */
  changed: boolean;
  lastDate: string | null;     // ISO
  validUntil: string | null;   // ISO
  history: HealthHistoryEntry[];
}

const ymdToIso = (ymd: string) => `${ymd}T00:00:00.000Z`;

/**
 * Record one vaccination/treatment on a DogHealth type without losing anything:
 * - newer than the current *LastDate (or none) → current moves into history,
 *   the new date becomes current (with its valid-until);
 * - same day as current → only fills / replaces valid-until;
 * - older → appended to history (sorted), current untouched;
 * - already in history for that day → no change (idempotent).
 */
export function applyVaccinationRecord(
  current: HealthRecordState,
  input: { date: string; validUntil?: string | null; recordedAt?: string },
): HealthRecordUpdate {
  const newYmd = toYmd(input.date);
  if (!newYmd) throw new Error("invalid date");
  const newValid = toYmd(input.validUntil);
  const recordedAt = input.recordedAt ?? new Date().toISOString();

  const curYmd = toYmd(current.lastDate);
  const curValid = toYmd(current.validUntil);
  const history = asHistory(current.history).map((h) => ({ ...h }));
  const out = (changed: boolean, last: string | null, valid: string | null, hist: HealthHistoryEntry[]): HealthRecordUpdate => ({
    changed,
    lastDate: last ? ymdToIso(last) : null,
    validUntil: valid ? ymdToIso(valid) : null,
    history: hist,
  });

  if (curYmd === newYmd) {
    const nextValid = newValid ?? curValid;
    return out(nextValid !== curValid, curYmd, nextValid, history);
  }

  if (history.some((h) => toYmd(h.date) === newYmd)) {
    return out(false, curYmd, curValid, history);
  }

  if (!curYmd || newYmd > curYmd) {
    const nextHistory = curYmd
      ? [...history, { date: ymdToIso(curYmd), validUntil: curValid ? ymdToIso(curValid) : null, recordedAt }]
      : history;
    // No valid-until given (e.g. a dose ticked in the vaccine plan): never drop the dog out
    // of expiry tracking — keep the current valid-until when it is still after the new date.
    const keptValid = newValid ?? (curValid && curValid > newYmd ? curValid : null);
    return out(true, newYmd, keptValid, nextHistory);
  }

  const entry: HealthHistoryEntry = { date: ymdToIso(newYmd), validUntil: newValid ? ymdToIso(newValid) : null, recordedAt };
  const nextHistory = [...history, entry].sort((a, b) => {
    const ay = toYmd(a.date) ?? "", by = toYmd(b.date) ?? "";
    return ay < by ? -1 : ay > by ? 1 : 0;
  });
  return out(true, curYmd, curValid, nextHistory);
}
