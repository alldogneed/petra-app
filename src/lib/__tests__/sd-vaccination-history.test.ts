import {
  applyVaccinationRecord,
  buildVaccinationHistory,
  planKeyToVaccinationType,
  toYmd,
  type VaccinePlan,
} from "@/lib/vaccine-plan";

describe("planKeyToVaccinationType", () => {
  it("maps plan treatment keys to DogHealth types", () => {
    expect(planKeyToVaccinationType("RABIES_BOOSTER")).toBe("rabies");
    expect(planKeyToVaccinationType("RABIES_PRIMARY")).toBe("rabies");
    expect(planKeyToVaccinationType("DHPP_BOOSTER")).toBe("dhpp");
    expect(planKeyToVaccinationType("DHPP_PRIMARY")).toBe("dhpp");
    expect(planKeyToVaccinationType("DEWORMING")).toBe("deworming");
    expect(planKeyToVaccinationType("PARK_WORM")).toBe("parkWorm");
    expect(planKeyToVaccinationType("FLEA_TICK")).toBe("fleaTick");
    expect(planKeyToVaccinationType("SPAY_NEUTER")).toBeNull();
    expect(planKeyToVaccinationType("year")).toBeNull();
  });
});

describe("toYmd", () => {
  it("keeps bare dates and reads timestamps in Israel time", () => {
    expect(toYmd("2026-04-12")).toBe("2026-04-12");
    expect(toYmd("2026-04-12T00:00:00.000Z")).toBe("2026-04-12");
    // Israel midnight (UTC+3 in summer) stored as the previous UTC day
    expect(toYmd("2026-04-11T21:00:00.000Z")).toBe("2026-04-12");
    expect(toYmd(new Date("2026-01-05T00:00:00.000Z"))).toBe("2026-01-05");
    expect(toYmd(null)).toBeNull();
    expect(toYmd("")).toBeNull();
    expect(toYmd("not a date")).toBeNull();
  });
});

describe("buildVaccinationHistory", () => {
  const health = {
    rabiesLastDate: "2026-03-01T00:00:00.000Z",
    rabiesValidUntil: "2027-03-01T00:00:00.000Z",
    rabiesHistory: [{ date: "2025-03-01T00:00:00.000Z", validUntil: "2026-03-01T00:00:00.000Z", recordedAt: "x" }],
    dhppLastDate: null,
    parkWormDate: "2026-05-10T00:00:00.000Z",
    fleaTickDate: "2026-05-10T00:00:00.000Z",
    fleaTickExpiryDate: "2026-06-10T00:00:00.000Z",
    dewormingHistory: "garbage",
  };
  const plan: VaccinePlan = {
    adults: {
      year: 2026,
      RABIES_BOOSTER: [{ planned: "2026-03", done: "2026-03-01" }], // duplicate of DogHealth current
      DEWORMING: [{ planned: "2026-02", done: "2026-02-15" }, { planned: "2026-08", done: null }],
      PARK_WORM: [{ planned: "2026-05", done: null, notVaccinated: true }],
      FLEA_TICK: [{ planned: "2026-05", done: "2026-05-10T00:00:00.000Z" }],
    },
    puppies: {
      DHPP_PRIMARY: [{ planned: "2024-01-01", done: "2024-01-03" }],
      SPAY_NEUTER: [{ planned: null, done: "2024-06-01" }],
    },
    adultsHistory: [
      { year: 2025, DEWORMING: [{ planned: "2025-02", done: "2025-02-20" }] },
    ],
  };

  it("merges DogHealth + plan (current, puppies, archived years), newest first, deduped", () => {
    const rows = buildVaccinationHistory(health, plan);
    expect(rows.map((r) => `${r.type}:${r.date}`)).toEqual([
      "fleaTick:2026-05-10",
      "parkWorm:2026-05-10",
      "rabies:2026-03-01",
      "deworming:2026-02-15",
      "rabies:2025-03-01",
      "deworming:2025-02-20",
      "dhpp:2024-01-03",
    ]);
  });

  it("keeps the valid-until of the DogHealth copy and Hebrew labels", () => {
    const rows = buildVaccinationHistory(health, plan);
    const rabies = rows.find((r) => r.type === "rabies" && r.date === "2026-03-01")!;
    expect(rabies.validUntil).toBe("2027-03-01");
    expect(rabies.label).toBe("כלבת");
    const flea = rows.find((r) => r.type === "fleaTick")!;
    expect(flea.validUntil).toBe("2026-06-10");
    expect(rows.find((r) => r.type === "deworming")!.validUntil).toBeNull();
  });

  it("handles a pet without DogHealth and without a plan", () => {
    expect(buildVaccinationHistory(null, null)).toEqual([]);
    expect(buildVaccinationHistory(null, plan).length).toBe(5);
  });
});

describe("applyVaccinationRecord", () => {
  const empty = { lastDate: null, validUntil: null, history: null };

  it("first record becomes current", () => {
    const r = applyVaccinationRecord(empty, { date: "2026-04-01", validUntil: "2027-04-01" });
    expect(r.changed).toBe(true);
    expect(r.lastDate).toBe("2026-04-01T00:00:00.000Z");
    expect(r.validUntil).toBe("2027-04-01T00:00:00.000Z");
    expect(r.history).toEqual([]);
  });

  it("newer record moves current into history", () => {
    const r = applyVaccinationRecord(
      { lastDate: new Date("2025-04-01T00:00:00.000Z"), validUntil: new Date("2026-04-01T00:00:00.000Z"), history: [] },
      { date: "2026-04-01", recordedAt: "now" },
    );
    expect(r.lastDate).toBe("2026-04-01T00:00:00.000Z");
    expect(r.validUntil).toBeNull();
    expect(r.history).toEqual([
      { date: "2025-04-01T00:00:00.000Z", validUntil: "2026-04-01T00:00:00.000Z", recordedAt: "now" },
    ]);
  });

  it("older record is appended to history (sorted), current untouched", () => {
    const r = applyVaccinationRecord(
      {
        lastDate: "2026-04-01T00:00:00.000Z",
        validUntil: "2027-04-01T00:00:00.000Z",
        history: [{ date: "2024-04-01T00:00:00.000Z" }],
      },
      { date: "2025-04-01", recordedAt: "now" },
    );
    expect(r.changed).toBe(true);
    expect(r.lastDate).toBe("2026-04-01T00:00:00.000Z");
    expect(r.validUntil).toBe("2027-04-01T00:00:00.000Z");
    expect(r.history.map((h) => toYmd(h.date))).toEqual(["2024-04-01", "2025-04-01"]);
  });

  it("same day as current only updates valid-until; idempotent otherwise", () => {
    const cur = { lastDate: "2026-04-01T00:00:00.000Z", validUntil: null, history: [{ date: "2025-04-01T00:00:00.000Z" }] };
    const same = applyVaccinationRecord(cur, { date: "2026-04-01" });
    expect(same.changed).toBe(false);
    const withValid = applyVaccinationRecord(cur, { date: "2026-04-01", validUntil: "2027-04-01" });
    expect(withValid.changed).toBe(true);
    expect(withValid.validUntil).toBe("2027-04-01T00:00:00.000Z");
    expect(withValid.history).toHaveLength(1);
    const inHistory = applyVaccinationRecord(cur, { date: "2025-04-01" });
    expect(inHistory.changed).toBe(false);
  });

  it("rejects an invalid date", () => {
    expect(() => applyVaccinationRecord(empty, { date: "nope" })).toThrow();
  });
});

describe("applyVaccinationRecord keeps expiry tracking (security review H1)", () => {
  it("a newer date without valid-until keeps a later current valid-until", () => {
    const { applyVaccinationRecord } = require("@/lib/vaccine-plan");
    const r = applyVaccinationRecord(
      { lastDate: "2025-12-01T00:00:00.000Z", validUntil: "2026-12-01T00:00:00.000Z", history: [] },
      { date: "2026-11-17" },
    );
    expect(r.lastDate?.slice(0, 10)).toBe("2026-11-17");
    expect(r.validUntil?.slice(0, 10)).toBe("2026-12-01");
  });
});

describe("defaultValidUntil (automatic expiry, manual override in the UI)", () => {
  const { defaultValidUntil } = require("@/lib/vaccine-plan");
  it("rabies / dhpp / bordetella = 1 year", () => {
    expect(defaultValidUntil("rabies", "2026-11-17")).toBe("2027-11-17");
    expect(defaultValidUntil("dhpp", "2026-11-17")).toBe("2027-11-17");
    expect(defaultValidUntil("bordetella", "2026-11-17")).toBe("2027-11-17");
  });
  it("deworming = 180 days, park worm / flea = 90 days", () => {
    expect(defaultValidUntil("deworming", "2026-01-01")).toBe("2026-06-30");
    expect(defaultValidUntil("parkWorm", "2026-01-01")).toBe("2026-04-01");
    expect(defaultValidUntil("fleaTick", "2026-01-01")).toBe("2026-04-01");
  });
  it("bad date → null", () => {
    expect(defaultValidUntil("rabies", "")).toBeNull();
  });
});
