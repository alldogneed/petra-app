/**
 * AllDog voice agent — booking rules: the requested slot (90-minute margin at booking time),
 * forward-only stage moves, the 3 nearest alternatives, detail mapping. Pure.
 */
import {
  BOOK_MIN_NOTICE_MS,
  VOICE_LEAD_SOURCE,
  checkBookingSlot,
  nearestAlternatives,
  petFromDetails,
  salesBriefFromDetails,
  shouldMoveToStage,
} from "@/lib/alldog/voice-agent/booking-rules";
import { pickSalesSlots, SALES_MIN_NOTICE_MS, type Interval } from "@/lib/alldog/voice-agent/slots";
import { israelInstant } from "@/lib/alldog/time";

// November 2026 = Israel winter time (UTC+2). 15/11/2026 is a Sunday.
const at = (ymd: string, hhmm: string) => israelInstant(ymd, hhmm);
const iso = (ymd: string, hhmm: string) => at(ymd, hhmm).toISOString();
const block = (ymd: string, from: string, to: string): Interval => ({ start: at(ymd, from), end: at(ymd, to) });

describe("booking margin: 90 minutes at booking, 2 hours at /start", () => {
  it("the constants", () => {
    expect(BOOK_MIN_NOTICE_MS).toBe(90 * 60 * 1000);
    expect(SALES_MIN_NOTICE_MS).toBe(2 * 60 * 60 * 1000);
  });

  it("a slot offered exactly 2 hours ahead is still bookable 5 minutes later", () => {
    const startNow = at("2026-11-15", "14:00");
    const offered = pickSalesSlots(startNow, []);
    expect(offered[0].hhmm).toBe("16:00"); // exactly 2 h ahead at /start
    const bookNow = new Date(startNow.getTime() + 5 * 60 * 1000); // 1 h 55 m before the slot
    expect(checkBookingSlot(offered[0].startsAt, bookNow).ok).toBe(true);
  });

  it("95 minutes ahead → bookable; 85 minutes ahead → too_soon", () => {
    expect(checkBookingSlot(iso("2026-11-15", "16:00"), at("2026-11-15", "14:25")).ok).toBe(true);
    expect(checkBookingSlot(iso("2026-11-15", "16:00"), at("2026-11-15", "14:35"))).toEqual({ ok: false, reason: "too_soon" });
  });

  it("a slot in the past → too_soon", () => {
    expect(checkBookingSlot(iso("2026-11-15", "10:00"), at("2026-11-15", "13:00"))).toEqual({ ok: false, reason: "too_soon" });
  });
});

describe("booking slot validation", () => {
  const now = at("2026-11-15", "07:00");

  it("valid → Israel day, times and the 20-minute end", () => {
    const r = checkBookingSlot(iso("2026-11-16", "11:40"), now);
    expect(r).toMatchObject({ ok: true, ymd: "2026-11-16", hhmm: "11:40", endHhmm: "12:00" });
  });

  it("off the 20-minute grid / with seconds → off_grid", () => {
    expect(checkBookingSlot(iso("2026-11-16", "10:10"), now)).toEqual({ ok: false, reason: "off_grid" });
    expect(checkBookingSlot("2026-11-16T08:00:30.000Z", now)).toEqual({ ok: false, reason: "off_grid" });
  });

  it("outside the sales windows → outside_windows", () => {
    expect(checkBookingSlot(iso("2026-11-16", "12:00"), now)).toEqual({ ok: false, reason: "outside_windows" });
    expect(checkBookingSlot(iso("2026-11-16", "09:40"), now)).toEqual({ ok: false, reason: "outside_windows" });
    expect(checkBookingSlot(iso("2026-11-16", "18:00"), now)).toEqual({ ok: false, reason: "outside_windows" });
  });

  it("Friday / Saturday / after the 5th workday → too_far", () => {
    expect(checkBookingSlot(iso("2026-11-20", "10:00"), now)).toEqual({ ok: false, reason: "too_far" });
    expect(checkBookingSlot(iso("2026-11-22", "10:00"), now)).toEqual({ ok: false, reason: "too_far" }); // 6th workday
    expect(checkBookingSlot(iso("2026-11-19", "17:40"), now).ok).toBe(true); // 5th workday, last slot
  });

  it("garbage → unparseable", () => {
    expect(checkBookingSlot("tomorrow at ten", now)).toEqual({ ok: false, reason: "unparseable" });
    expect(checkBookingSlot("", now)).toEqual({ ok: false, reason: "unparseable" });
  });
});

describe("stage moves only forward", () => {
  const target = { sortOrder: 2 }; // "תואמה שיחת מכירה" right after "נוצר קשר ראשוני"
  it("earlier open stage → move", () => {
    expect(shouldMoveToStage({ sortOrder: 0, isWon: false, isLost: false }, target)).toBe(true);
    expect(shouldMoveToStage({ sortOrder: 1, isWon: false, isLost: false }, target)).toBe(true);
  });
  it("same or later stage (e.g. 'תואם בבית הלקוח') → no move", () => {
    expect(shouldMoveToStage({ sortOrder: 2, isWon: false, isLost: false }, target)).toBe(false);
    expect(shouldMoveToStage({ sortOrder: 5, isWon: false, isLost: false }, target)).toBe(false);
  });
  it("won / lost → no move, even with a lower sortOrder", () => {
    expect(shouldMoveToStage({ sortOrder: 0, isWon: true, isLost: false }, target)).toBe(false);
    expect(shouldMoveToStage({ sortOrder: 1, isWon: false, isLost: true }, target)).toBe(false);
  });
  it("a stage of another business (not found) counts as earlier", () => {
    expect(shouldMoveToStage(null, target)).toBe(true);
  });
});

describe("alternatives when the slot was taken", () => {
  const now = at("2026-11-15", "07:00");
  it("the 3 free slots closest to the requested time, in time order", () => {
    const busy = [block("2026-11-16", "10:20", "10:40")]; // the requested one, now taken
    const alt = nearestAlternatives(at("2026-11-16", "10:20"), now, busy);
    expect(alt.map((s) => `${s.ymd} ${s.hhmm}`)).toEqual(["2026-11-16 10:00", "2026-11-16 10:40", "2026-11-16 11:00"]);
    expect(alt[0].label).toBe("מחר בשעה 10:00");
  });
  it("never an earlier-than-90-minutes slot, never a blocked one", () => {
    const n = at("2026-11-15", "09:00");
    // 09:00 → earliest 10:30; 10:40–12:00 blocked → the morning is gone, nearest are the afternoon slots.
    const alt = nearestAlternatives(at("2026-11-15", "10:00"), n, [block("2026-11-15", "10:40", "12:00")]);
    expect(alt.map((s) => `${s.ymd} ${s.hhmm}`)).toEqual(["2026-11-15 16:00", "2026-11-15 16:20", "2026-11-15 16:40"]);
    for (const s of alt) {
      expect(new Date(s.startsAt).getTime()).toBeGreaterThanOrEqual(n.getTime() + BOOK_MIN_NOTICE_MS);
      expect(s.hhmm >= "10:40" && s.hhmm < "12:00" && s.ymd === "2026-11-15").toBe(false);
    }
  });
  it("everything busy → none", () => {
    const busy = ["2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"].flatMap((d) => [block(d, "10:00", "12:00"), block(d, "16:00", "18:00")]);
    expect(nearestAlternatives(at("2026-11-16", "10:00"), now, busy)).toEqual([]);
  });
});

describe("collected details", () => {
  it("dog details + the problem go into the pet block (same mapping as the bot)", () => {
    expect(petFromDetails({ dogName: " רקס ", breed: "לברדור", age: "שנתיים", problem: "נובח על אורחים" }))
      .toEqual({ name: "רקס", breed: "לברדור", age: "שנתיים", notes: "נובח על אורחים" });
    expect(petFromDetails({ fullName: "דנה" })).toBeNull();
  });
  it("salesBrief keeps everything Eliran heard, urgency only when urgent", () => {
    expect(salesBriefFromDetails({ dogName: "רקס", city: "כפר סבא", urgent: true, urgentReason: "נשך את הילד" }))
      .toEqual({ dog: "רקס", breed: null, age: null, city: "כפר סבא", problem: null, urgency: "high", notes: "נשך את הילד" });
    expect(salesBriefFromDetails({}).urgency).toBeNull();
  });
  it("lead source in the bot's pattern", () => {
    expect(VOICE_LEAD_SOURCE).toBe("טלפון · סוכן קולי");
  });
});
