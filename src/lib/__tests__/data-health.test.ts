import {
  computeHealthScore,
  sortChecks,
  healthVerdict,
  maskPhone,
  cleanLabel,
  hasAnyVaccinationRecord,
  expiredVaccineLabels,
  vaccineExpiryCutoffs,
  type VaccineHealthFields,
} from "../data-health";

const DAY = 86_400_000;
const today = new Date("2026-10-01T00:00:00.000Z");
const daysAgo = (n: number) => new Date(today.getTime() - n * DAY);

const emptyHealth: VaccineHealthFields = {
  rabiesLastDate: null, rabiesValidUntil: null, rabiesUnknown: false,
  dhppLastDate: null, dhppPuppy1Date: null, dhppPuppy2Date: null, dhppPuppy3Date: null,
  bordatellaDate: null,
};

describe("computeHealthScore", () => {
  it("is 100 when nothing fails", () => {
    expect(computeHealthScore([{ severity: "high", count: 0 }, { severity: "low", count: 0 }])).toBe(100);
    expect(computeHealthScore([])).toBe(100);
  });
  it("applies one penalty per failing check regardless of count", () => {
    expect(computeHealthScore([{ severity: "high", count: 50 }])).toBe(85);
    expect(computeHealthScore([
      { severity: "high", count: 1 },
      { severity: "medium", count: 3 },
      { severity: "low", count: 9 },
    ])).toBe(100 - 15 - 8 - 3);
  });
  it("floors at 0", () => {
    const many = Array.from({ length: 10 }, () => ({ severity: "high" as const, count: 1 }));
    expect(computeHealthScore(many)).toBe(0);
  });
});

describe("sortChecks", () => {
  it("orders by severity, then count desc, then key", () => {
    const sorted = sortChecks([
      { key: "b", severity: "low", count: 50 },
      { key: "a", severity: "medium", count: 1 },
      { key: "c", severity: "high", count: 0 },
      { key: "d", severity: "medium", count: 5 },
      { key: "e", severity: "medium", count: 5 },
    ]);
    expect(sorted.map((c) => c.key)).toEqual(["c", "d", "e", "a", "b"]);
  });
});

describe("healthVerdict", () => {
  it("maps score bands", () => {
    expect(healthVerdict(100).tone).toBe("good");
    expect(healthVerdict(75).tone).toBe("fair");
    expect(healthVerdict(50).tone).toBe("poor");
    expect(healthVerdict(10).label).toContain("דחוף");
  });
});

describe("maskPhone / cleanLabel", () => {
  it("masks all but the last 4 digits", () => {
    expect(maskPhone("054-123-4567")).toBe("••••••4567");
    expect(maskPhone("+972541234567")).toBe("••••••••4567");
    expect(maskPhone("")).toBe("");
    expect(maskPhone(null)).toBe("");
    expect(maskPhone("123")).toBe("•••");
  });
  it("strips control chars and caps length", () => {
    expect(cleanLabel("  דנה\n\tכהן  ")).toBe("דנה כהן");
    expect(cleanLabel("")).toBe("ללא שם");
    expect(cleanLabel("א".repeat(100), 10)).toHaveLength(10);
  });
});

describe("hasAnyVaccinationRecord", () => {
  it("false for missing / empty health", () => {
    expect(hasAnyVaccinationRecord(null)).toBe(false);
    expect(hasAnyVaccinationRecord(emptyHealth)).toBe(false);
    expect(hasAnyVaccinationRecord({ ...emptyHealth, rabiesUnknown: true })).toBe(false);
  });
  it("true when any vaccine date exists", () => {
    expect(hasAnyVaccinationRecord({ ...emptyHealth, bordatellaDate: daysAgo(5) })).toBe(true);
    expect(hasAnyVaccinationRecord({ ...emptyHealth, dhppPuppy1Date: daysAgo(5) })).toBe(true);
  });
});

describe("expiredVaccineLabels", () => {
  it("rabies expired only when validUntil < today and not unknown", () => {
    expect(expiredVaccineLabels({ ...emptyHealth, rabiesValidUntil: daysAgo(1) }, today)).toEqual(["כלבת"]);
    expect(expiredVaccineLabels({ ...emptyHealth, rabiesValidUntil: today }, today)).toEqual([]);
    expect(expiredVaccineLabels({ ...emptyHealth, rabiesValidUntil: daysAgo(1), rabiesUnknown: true }, today)).toEqual([]);
  });
  it("adult DHPP expires after 365 days", () => {
    expect(expiredVaccineLabels({ ...emptyHealth, dhppLastDate: daysAgo(366) }, today)).toEqual(["משושה"]);
    expect(expiredVaccineLabels({ ...emptyHealth, dhppLastDate: daysAgo(300) }, today)).toEqual([]);
  });
  it("puppy doses superseded by later doses are ignored", () => {
    expect(expiredVaccineLabels({ ...emptyHealth, dhppPuppy1Date: daysAgo(400), dhppLastDate: daysAgo(10) }, today)).toEqual([]);
    expect(expiredVaccineLabels({ ...emptyHealth, dhppPuppy1Date: daysAgo(60), dhppPuppy2Date: daysAgo(40), dhppPuppy3Date: daysAgo(20) }, today)).toEqual([]);
  });
  it("missing next puppy dose is reported", () => {
    expect(expiredVaccineLabels({ ...emptyHealth, dhppPuppy1Date: daysAgo(20) }, today)).toEqual(["משושה גורים (מנה 2 חסרה)"]);
    expect(expiredVaccineLabels({ ...emptyHealth, dhppPuppy1Date: daysAgo(40), dhppPuppy2Date: daysAgo(20) }, today)).toEqual(["משושה גורים (מנה 3 חסרה)"]);
    expect(expiredVaccineLabels({ ...emptyHealth, dhppPuppy3Date: daysAgo(370) }, today)).toEqual(["משושה"]);
  });
  it("bordetella is never reported", () => {
    expect(expiredVaccineLabels({ ...emptyHealth, bordatellaDate: daysAgo(1000) }, today)).toEqual([]);
  });
});

describe("vaccineExpiryCutoffs", () => {
  it("returns pre-filter cutoffs relative to today", () => {
    const c = vaccineExpiryCutoffs(today);
    expect(c.rabies).toEqual(today);
    expect(c.dhppAdult).toEqual(daysAgo(365));
    expect(c.puppyShort).toEqual(daysAgo(14));
  });
});
