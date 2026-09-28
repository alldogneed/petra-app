import {
  feedingTitle,
  findAnyMedicationLog,
  findFeedingLogForSlot,
  findFeedingLogForTime,
  findMedicationLog,
  mealSlotForTime,
  medicationTitle,
  parseMedTimes,
} from "@/lib/care-log-match";

const log = (id: string, type: string, title: string) => ({ id, type, title });

describe("mealSlotForTime", () => {
  it("maps clock times to meal slots", () => {
    expect(mealSlotForTime("08:00")).toBe("breakfast");
    expect(mealSlotForTime("10:59")).toBe("breakfast");
    expect(mealSlotForTime("11:00")).toBe("lunch");
    expect(mealSlotForTime("13:00")).toBe("lunch");
    expect(mealSlotForTime("16:00")).toBe("dinner");
    expect(mealSlotForTime("18:00")).toBe("dinner");
  });
});

describe("feedings across the two boards", () => {
  it("daily board sees its own log", () => {
    const logs = [log("a", "FEEDING", feedingTitle("08:00"))];
    expect(findFeedingLogForTime(logs, "08:00")?.id).toBe("a");
    expect(findFeedingLogForTime(logs, "18:00")).toBeUndefined();
  });

  it("daily board sees a meal marked on /feeding", () => {
    const logs = [log("b", "FEEDING", "breakfast"), log("c", "FEEDING", "dinner")];
    expect(findFeedingLogForTime(logs, "08:00")?.id).toBe("b");
    expect(findFeedingLogForTime(logs, "18:00")?.id).toBe("c");
    expect(findFeedingLogForTime(logs, "13:00")).toBeUndefined();
  });

  it("/feeding sees a time marked on the daily board", () => {
    const logs = [log("d", "FEEDING", "האכלה 08:00"), log("e", "FEEDING", "האכלה 18:00")];
    expect(findFeedingLogForSlot(logs, "breakfast")?.id).toBe("d");
    expect(findFeedingLogForSlot(logs, "dinner")?.id).toBe("e");
    expect(findFeedingLogForSlot(logs, "lunch")).toBeUndefined();
  });

  it("ignores other log types and unrelated titles", () => {
    const logs = [log("f", "MEDICATION", "breakfast"), log("g", "FEEDING", "האכלה בוקר")];
    expect(findFeedingLogForSlot(logs, "breakfast")).toBeUndefined();
    expect(findFeedingLogForTime(logs, "08:00")).toBeUndefined();
  });
});

describe("parseMedTimes", () => {
  it("reads the free-text form value", () => {
    expect(parseMedTimes("07:00, 19:00")).toEqual(["07:00", "19:00"]);
    expect(parseMedTimes("7:00,19:00")).toEqual(["07:00", "19:00"]);
  });
  it("reads a JSON array", () => {
    expect(parseMedTimes('["08:00","20:00"]')).toEqual(["08:00", "20:00"]);
  });
  it("falls back to one untimed dose", () => {
    expect(parseMedTimes(null)).toEqual([""]);
    expect(parseMedTimes("")).toEqual([""]);
    expect(parseMedTimes("morning,evening")).toEqual([""]);
    expect(parseMedTimes("עם האוכל")).toEqual([""]);
  });
});

describe("medications across the two boards", () => {
  it("daily board marks and finds a timed dose (was never shown as given)", () => {
    const logs = [log("m1", "MEDICATION", medicationTitle("אפוקוול", "08:00"))];
    expect(findMedicationLog(logs, "אפוקוול", "08:00", 2)?.id).toBe("m1");
    expect(findMedicationLog(logs, "אפוקוול", "20:00", 2)).toBeUndefined();
  });

  it("daily board finds an untimed dose", () => {
    const logs = [log("m2", "MEDICATION", "תוסף מפרקים")];
    expect(findMedicationLog(logs, "תוסף מפרקים", undefined, 1)?.id).toBe("m2");
  });

  it("a /feeding mark ticks a single-dose med on the daily board, not every dose of a multi-dose med", () => {
    const logs = [log("m3", "MEDICATION", "אפוקוול")];
    expect(findMedicationLog(logs, "אפוקוול", "08:00", 1)?.id).toBe("m3");
    expect(findMedicationLog(logs, "אפוקוול", "08:00", 2)).toBeUndefined();
  });

  it("/feeding sees any dose marked on the daily board", () => {
    const logs = [log("m4", "MEDICATION", "אפוקוול 20:00")];
    expect(findAnyMedicationLog(logs, "אפוקוול")?.id).toBe("m4");
  });

  it("does not confuse medications whose names share a prefix", () => {
    const logs = [log("m5", "MEDICATION", "אפוקוול פורטה")];
    expect(findAnyMedicationLog(logs, "אפוקוול")).toBeUndefined();
    expect(findMedicationLog(logs, "אפוקוול", undefined, 1)).toBeUndefined();
  });
});
