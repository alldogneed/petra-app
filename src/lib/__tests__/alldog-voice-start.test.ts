/**
 * AllDog voice agent — call-start: sales slots (spread, spoken labels, blocks), secret check,
 * caller phone + WhatsApp summary helpers. Pure — prisma is mocked.
 */
jest.mock("@/lib/prisma", () => ({ __esModule: true, default: {}, prisma: {} }));

import {
  freeSlotsByWindow,
  isSalesBlockReason,
  meetingInterval,
  pickSalesSlots,
  salesRange,
  salesWorkdays,
  spokenSlotLabel,
  type Interval,
} from "@/lib/alldog/voice-agent/slots";
import { verifyVoiceAgentSecret } from "@/lib/alldog/voice-agent/auth";
import { callerPhoneNormOf, whatsappSummaryText } from "@/lib/alldog/voice-agent/start";
import { israelInstant } from "@/lib/alldog/time";

// November 2026 = Israel winter time (UTC+2). 15/11/2026 is a Sunday.
const at = (ymd: string, hhmm: string) => israelInstant(ymd, hhmm);
const slotTimes = (now: Date, busy: Interval[] = []) => pickSalesSlots(now, busy).map((s) => `${s.ymd} ${s.hhmm}`);
const block = (ymd: string, from: string, to: string): Interval => ({ start: at(ymd, from), end: at(ymd, to) });

describe("sales slots — spread over windows", () => {
  it("takes up to 2 slots from each of the 3 nearest windows, the second ≥ 40 min after the first", () => {
    expect(slotTimes(at("2026-11-15", "07:00"))).toEqual([
      "2026-11-15 10:00", "2026-11-15 10:40",
      "2026-11-15 16:00", "2026-11-15 16:40",
      "2026-11-16 10:00", "2026-11-16 10:40",
    ]);
  });

  it("a window with a single free slot lets the next window in, still 6 in total", () => {
    // Sunday morning is taken until 11:40 → only 11:40 left there.
    const busy = [block("2026-11-15", "10:00", "11:40")];
    expect(slotTimes(at("2026-11-15", "07:00"), busy)).toEqual([
      "2026-11-15 11:40",
      "2026-11-15 16:00", "2026-11-15 16:40",
      "2026-11-16 10:00", "2026-11-16 10:40",
      "2026-11-16 16:00",
    ]);
  });

  it("when only one window has room, the rest of its free slots fill up to 6", () => {
    const now = at("2026-11-15", "07:00");
    const busy = [
      block("2026-11-15", "16:00", "18:00"),
      ...["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"].flatMap((d) => [block(d, "10:00", "12:00"), block(d, "16:00", "18:00")]),
    ];
    expect(slotTimes(now, busy)).toEqual([
      "2026-11-15 10:00", "2026-11-15 10:20", "2026-11-15 10:40",
      "2026-11-15 11:00", "2026-11-15 11:20", "2026-11-15 11:40",
    ]);
  });

  it("back to back, no buffer: a slot right after a meeting is offered", () => {
    const busy = [meetingInterval({ date: new Date("2026-11-15T00:00:00Z"), startTime: "10:00", endTime: "10:20" })];
    const slots = slotTimes(at("2026-11-15", "07:00"), busy);
    expect(slots[0]).toBe("2026-11-15 10:20");
    expect(slots).not.toContain("2026-11-15 10:00");
  });

  it("returns fewer than 6 (never invents) when the range is almost full", () => {
    const now = at("2026-11-15", "07:00");
    const days = salesWorkdays(now);
    const busy = days.flatMap((d) => [block(d, "10:00", "12:00"), block(d, "16:00", "18:00")]);
    // Free only Wednesday 10:00–10:40.
    const wedMorning = busy.findIndex((b) => b.start.getTime() === at("2026-11-18", "10:00").getTime());
    busy[wedMorning] = block("2026-11-18", "10:40", "12:00");
    expect(slotTimes(now, busy)).toEqual(["2026-11-18 10:00", "2026-11-18 10:20"]);
  });

  it("nothing free → an empty list", () => {
    const now = at("2026-11-15", "07:00");
    const busy = salesWorkdays(now).flatMap((d) => [block(d, "10:00", "12:00"), block(d, "16:00", "18:00")]);
    expect(pickSalesSlots(now, busy)).toEqual([]);
  });
});

describe("sales slots — notice, weekend, range", () => {
  it("never earlier than 2 hours from now", () => {
    const slots = slotTimes(at("2026-11-15", "10:30")); // earliest 12:30 → the morning window is gone
    expect(slots[0]).toBe("2026-11-15 16:00");
    const late = slotTimes(at("2026-11-15", "15:00")); // earliest 17:00
    expect(late.slice(0, 2)).toEqual(["2026-11-15 17:00", "2026-11-15 17:40"]);
  });

  it("5 workdays ahead, Friday and Saturday skipped", () => {
    expect(salesWorkdays(at("2026-11-19", "17:00"))).toEqual([
      "2026-11-19", "2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25",
    ]);
    expect(salesWorkdays(at("2026-11-20", "09:00"))).toEqual([
      "2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26",
    ]);
  });

  it("Thursday evening → the first slots are on Sunday", () => {
    expect(slotTimes(at("2026-11-19", "17:00"))[0]).toBe("2026-11-22 10:00");
  });

  it("no slot outside the windows or after the 5th workday", () => {
    const now = at("2026-11-15", "07:00");
    const all = freeSlotsByWindow(now, []).flat().map((c) => c.hhmm);
    expect(new Set(all)).toEqual(new Set(["10:00", "10:20", "10:40", "11:00", "11:20", "11:40", "16:00", "16:20", "16:40", "17:00", "17:20", "17:40"]));
    const range = salesRange(salesWorkdays(now));
    expect(range.start.toISOString()).toBe(at("2026-11-15", "10:00").toISOString());
    expect(range.end.toISOString()).toBe(at("2026-11-19", "18:00").toISOString());
  });
});

describe("sales slots — spoken labels", () => {
  const now = at("2026-11-15", "07:00"); // Sunday
  it("today / tomorrow / weekday with date", () => {
    expect(spokenSlotLabel("2026-11-15", "16:20", now)).toBe("היום בשעה 16:20");
    expect(spokenSlotLabel("2026-11-16", "10:00", now)).toBe("מחר בשעה 10:00");
    expect(spokenSlotLabel("2026-11-17", "10:20", now)).toBe("יום שלישי 17/11 בשעה 10:20");
  });

  it("the slots carry these labels", () => {
    const labels = pickSalesSlots(now, []).map((s) => s.label);
    expect(labels[0]).toBe("היום בשעה 10:00");
    expect(labels[4]).toBe("מחר בשעה 10:00");
  });

  it("from Saturday night, Sunday is 'מחר'; from Friday it is a weekday label", () => {
    expect(pickSalesSlots(at("2026-11-21", "20:00"), [])[0].label).toBe("מחר בשעה 10:00");
    expect(pickSalesSlots(at("2026-11-20", "09:00"), [])[0].label).toBe("יום ראשון 22/11 בשעה 10:00");
  });

  it("startsAt is the real UTC instant", () => {
    expect(pickSalesSlots(now, [])[0].startsAt).toBe("2026-11-15T08:00:00.000Z");
  });
});

describe("sales blocks — holiday and 'מכירות'", () => {
  it("block reasons that close sales windows", () => {
    expect(isSalesBlockReason("מכירות – רחלי לא זמינה")).toBe(true);
    expect(isSalesBlockReason("אין מכירות היום")).toBe(true);
    expect(isSalesBlockReason("חג סוכות")).toBe(true);
    expect(isSalesBlockReason("חופשה של ליעד")).toBe(false);
    expect(isSalesBlockReason("הזמנה אונליין")).toBe(false);
    expect(isSalesBlockReason(null)).toBe(false);
    expect(isSalesBlockReason("")).toBe(false);
  });

  it("a 'מכירות' block over Sunday afternoon removes that window", () => {
    const slots = slotTimes(at("2026-11-15", "07:00"), [block("2026-11-15", "16:00", "18:00")]);
    expect(slots.filter((s) => s.startsWith("2026-11-15 1") && s >= "2026-11-15 16")).toEqual([]);
    expect(slots).toContain("2026-11-16 10:00");
  });

  it("a whole-day holiday block removes both windows of that day", () => {
    const holiday = { start: new Date("2026-11-15T22:00:00Z"), end: new Date("2026-11-16T22:00:00Z") }; // Monday, Israel
    expect(slotTimes(at("2026-11-15", "07:00"), [holiday]).some((s) => s.startsWith("2026-11-16"))).toBe(false);
  });
});

describe("voice agent secret", () => {
  const req = (auth?: string) => new Request("https://x/api", { method: "POST", headers: auth ? { authorization: auth } : {} });
  const prev = process.env.ALLDOG_VOICE_AGENT_SECRET;
  afterEach(() => {
    if (prev === undefined) delete process.env.ALLDOG_VOICE_AGENT_SECRET;
    else process.env.ALLDOG_VOICE_AGENT_SECRET = prev;
  });

  it("fails closed without a configured secret", () => {
    delete process.env.ALLDOG_VOICE_AGENT_SECRET;
    expect(verifyVoiceAgentSecret(req("Bearer anything"))).toBe(false);
  });

  it("accepts only the exact Bearer secret", () => {
    process.env.ALLDOG_VOICE_AGENT_SECRET = "test-secret-123";
    expect(verifyVoiceAgentSecret(req("Bearer test-secret-123"))).toBe(true);
    expect(verifyVoiceAgentSecret(req("Bearer test-secret-12"))).toBe(false);
    expect(verifyVoiceAgentSecret(req("test-secret-123"))).toBe(false);
    expect(verifyVoiceAgentSecret(req())).toBe(false);
  });
});

describe("caller phone + WhatsApp summary helpers", () => {
  it("normalizes like resolveLeadForContact, null for hidden / empty", () => {
    expect(callerPhoneNormOf("+972501234567")).toBe("0501234567");
    expect(callerPhoneNormOf("050-123-4567")).toBe("0501234567");
    expect(callerPhoneNormOf("037386160")).toBe("037386160");
    expect(callerPhoneNormOf("")).toBeNull();
    expect(callerPhoneNormOf("   ")).toBeNull();
    expect(callerPhoneNormOf(null)).toBeNull();
    expect(callerPhoneNormOf("anonymous")).toBeNull();
    expect(callerPhoneNormOf("123")).toBeNull();
  });

  it("turns the bot's journal line into one short line", () => {
    const raw = "[וואטסאפ · בוט] סיכום שיחה (12/11 10:30)\nכלב: רקס, לברדור בן שנתיים · עיר: כפר סבא\n• לחזור טלפונית\n• מדריך: https://all-dog.co.il/guides/x";
    expect(whatsappSummaryText(raw)).toBe("כלב: רקס, לברדור בן שנתיים · עיר: כפר סבא · לחזור טלפונית");
    expect(whatsappSummaryText("[וואטסאפ · בוט] שיחה בוואטסאפ")).toBeNull();
    expect(whatsappSummaryText(null)).toBeNull();
    expect(whatsappSummaryText("א".repeat(400))!.length).toBe(300);
  });
});
