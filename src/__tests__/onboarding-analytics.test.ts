import { secondsBetween } from "@/lib/onboarding-analytics";

describe("onboarding-analytics", () => {
  describe("secondsBetween", () => {
    it("returns 0 for identical timestamps", () => {
      const ts = "2026-02-19T10:00:00.000Z";
      expect(secondsBetween(ts, ts)).toBe(0);
    });

    it("returns correct seconds for a 60-second gap", () => {
      const start = "2026-02-19T10:00:00.000Z";
      const end = "2026-02-19T10:01:00.000Z";
      expect(secondsBetween(start, end)).toBe(60);
    });

    it("returns correct seconds for a 5-minute gap", () => {
      const start = "2026-02-19T10:00:00.000Z";
      const end = "2026-02-19T10:05:00.000Z";
      expect(secondsBetween(start, end)).toBe(300);
    });

    it("handles fractional seconds by rounding", () => {
      const start = "2026-02-19T10:00:00.000Z";
      const end = "2026-02-19T10:00:01.500Z";
      expect(secondsBetween(start, end)).toBe(2);
    });

    it("returns negative for reversed timestamps", () => {
      const start = "2026-02-19T10:01:00.000Z";
      const end = "2026-02-19T10:00:00.000Z";
      expect(secondsBetween(start, end)).toBe(-60);
    });
  });
});
