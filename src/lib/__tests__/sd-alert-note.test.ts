import { normalizeAlertNote, ALERT_NOTE_MAX_LENGTH } from "@/services/service-dogs";

describe("normalizeAlertNote", () => {
  it("trims and clears", () => {
    expect(normalizeAlertNote("  שים לב: מגיב לאופניים  ")).toBe("שים לב: מגיב לאופניים");
    expect(normalizeAlertNote("")).toBeNull();
    expect(normalizeAlertNote("   ")).toBeNull();
    expect(normalizeAlertNote(null)).toBeNull();
  });

  it("caps the length and rejects non-strings", () => {
    expect(normalizeAlertNote("א".repeat(ALERT_NOTE_MAX_LENGTH))).toHaveLength(ALERT_NOTE_MAX_LENGTH);
    expect(() => normalizeAlertNote("א".repeat(ALERT_NOTE_MAX_LENGTH + 1))).toThrow(/ארוכה מדי/);
    expect(() => normalizeAlertNote(42)).toThrow();
  });
});
