/**
 * AllDog voice agent — section 4: sales-call templates + chains, AllDog values from settings,
 * the 2-hour sales-call reminder, templateOnly (no free text), the Google Calendar event payload.
 * Prisma and the WhatsApp senders are mocked — nothing leaves the process.
 */
const biz = { findUnique: jest.fn() };
const rule = { findFirst: jest.fn() };
const sm = { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn() };
jest.mock("@/lib/prisma", () => {
  const p = { business: biz, automationRule: rule, scheduledMessage: sm };
  return { __esModule: true, prisma: p, default: p };
});
jest.mock("@/lib/whatsapp", () => ({
  sendWhatsAppTemplate: jest.fn(),
  sendWhatsAppMessage: jest.fn(),
  interpolateTemplate: jest.fn((t: string) => t),
}));
jest.mock("@/lib/verticals/server", () => ({ getBusinessVertical: jest.fn(async () => "dogs") }));

import { sendWhatsAppTemplate, sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendWithTemplateChain } from "@/lib/whatsapp-template-chain";
import { PETRA_TEMPLATE_CATALOG, validateCatalogTemplate } from "@/lib/meta-template-catalog";
import { salesCallConfirmationChain, salesCallReminderChain, scheduleLeadMeetingReminder } from "@/lib/reminder-service";
import { firstNameForMessage, salesCallConfirmationMessage, salesCallReminderMessage } from "@/lib/alldog/voice-agent/messages";
import * as gcal from "@/lib/google-calendar";
import { buildLeadMeetingEventPayload } from "@/lib/google-calendar";
import { calendarFailureText, removeSalesCallFromCalendar, resyncSalesCallCalendar, syncSalesCallToRepCalendar } from "@/lib/alldog/voice-agent/calendar";
import { isSalesCallMeeting, SALES_CALL_LOCATION } from "@/lib/lead-meetings";
import { israelInstant } from "@/lib/alldog/time";

const mockTemplate = sendWhatsAppTemplate as jest.MockedFunction<typeof sendWhatsAppTemplate>;
const mockText = sendWhatsAppMessage as jest.MockedFunction<typeof sendWhatsAppMessage>;

const ENV_KEYS = ["ALLDOG_BUSINESS_ID", "ALLDOG_DISPLAY_NAME", "ALLDOG_SALES_REP_NAME", "ALLDOG_CALLBACK_PHONE", "ALLDOG_VOICE_AGENT_ENABLED", "ALLDOG_VOICE_AGENT_SECRET"] as const;
const savedEnv: Record<string, string | undefined> = {};
beforeAll(() => ENV_KEYS.forEach((k) => (savedEnv[k] = process.env[k])));
afterAll(() => ENV_KEYS.forEach((k) => (savedEnv[k] === undefined ? delete process.env[k] : (process.env[k] = savedEnv[k]))));
beforeEach(() => {
  jest.clearAllMocks();
  process.env.ALLDOG_BUSINESS_ID = "b-alldog";
  process.env.ALLDOG_VOICE_AGENT_ENABLED = "true";
  process.env.ALLDOG_VOICE_AGENT_SECRET = "test-secret";
  delete process.env.ALLDOG_DISPLAY_NAME;
  delete process.env.ALLDOG_SALES_REP_NAME;
  delete process.env.ALLDOG_CALLBACK_PHONE;
  biz.findUnique.mockResolvedValue({ whatsappRemindersEnabled: true, phone: "03-5555555", tier: "pro", featureOverrides: null });
  rule.findFirst.mockResolvedValue(null);
  sm.findFirst.mockResolvedValue(null);
  sm.create.mockImplementation(({ data }: { data: unknown }) => Promise.resolve(data));
});

describe("sales-call templates (catalog → submitted to Meta by the daily sync after deploy)", () => {
  const byName = (n: string) => PETRA_TEMPLATE_CATALOG.find((t) => t.name === n);

  it("both are in the catalog, UTILITY, Hebrew, and pass the catalog rules", () => {
    for (const n of ["petra_sales_call_confirmation", "petra_sales_call_reminder"]) {
      const t = byName(n);
      expect(t).toBeTruthy();
      expect(t!.category).toBe("UTILITY");
      expect(t!.language).toBe("he");
      expect(validateCatalogTemplate(t!)).toEqual([]);
    }
  });

  it("the text is business-neutral: no AllDog / רחלי in the body (variables only)", () => {
    for (const n of ["petra_sales_call_confirmation", "petra_sales_call_reminder"]) {
      expect(byName(n)!.body).not.toMatch(/AllDog|רחלי/);
    }
  });

  it("confirmation chain: the new template first, then the approved appointment templates with the sales-call service", () => {
    const steps = salesCallConfirmationChain({ businessName: "AllDog", repName: "רחלי", customerName: "דנה", date: "יום ראשון 15/11", time: "10:20", when: "x", phone: "03-3818670" });
    expect(steps.map((s) => s.name)).toEqual(["petra_sales_call_confirmation", "petra_appointment_confirmation_v2", "petra_appointment_confirmation"]);
    expect(steps[0].params).toEqual(["AllDog", "רחלי", "יום ראשון 15/11", "10:20", "03-3818670"]);
    expect(steps[1].params[3]).toBe("שיחה טלפונית עם רחלי מ-AllDog");
  });

  it("no usable first name → the older (name-first) templates are dropped, never a placeholder name", () => {
    const steps = salesCallReminderChain({ businessName: "AllDog", repName: "רחלי", customerName: "", date: "d", time: "t", when: "היום בשעה 10:20", phone: "03" });
    expect(steps.map((s) => s.name)).toEqual(["petra_sales_call_reminder"]);
  });
});

describe("AllDog values come from settings, not from the sending code", () => {
  const now = israelInstant("2026-11-15", "07:00");

  it("defaults: AllDog · רחלי · 03-3818670", () => {
    const m = salesCallConfirmationMessage("2026-11-16", "10:20", "דנה כהן", now);
    expect(m.templateChain[0].params).toEqual(["AllDog", "רחלי", "יום שני 16/11", "10:20", "03-3818670"]);
    expect(m.body).toContain("תודה שפנית ל-AllDog");
  });

  it("env overrides change every value", () => {
    process.env.ALLDOG_DISPLAY_NAME = "כל כלב";
    process.env.ALLDOG_SALES_REP_NAME = "שירה";
    process.env.ALLDOG_CALLBACK_PHONE = "03-1111111";
    const m = salesCallConfirmationMessage("2026-11-16", "10:20", "דנה", now);
    expect(m.templateChain[0].params).toEqual(["כל כלב", "שירה", "יום שני 16/11", "10:20", "03-1111111"]);
  });

  it("first name only, never a placeholder", () => {
    expect(firstNameForMessage("דנה כהן")).toBe("דנה");
    expect(firstNameForMessage("שיחה קולית 0501234567")).toBe("");
    expect(firstNameForMessage("שיחה מ-0501234567")).toBe("");
    expect(firstNameForMessage("0501234567")).toBe("");
    expect(firstNameForMessage("ליד")).toBe("");
    expect(firstNameForMessage(null)).toBe("");
  });

  it("reminder 'when' is spoken relative to the send time", () => {
    const m = salesCallReminderMessage({ date: new Date("2026-11-16T00:00:00Z"), startTime: "16:20", leadName: "דנה" }, israelInstant("2026-11-16", "14:20"));
    expect(m.templateChain[0].params).toEqual(["AllDog", "היום בשעה 16:20", "רחלי", "03-3818670"]);
  });
});

describe("LeadMeeting reminder of a sales call", () => {
  const day = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const meeting = (over: Record<string, unknown> = {}) => ({
    id: "m1",
    businessId: "b-alldog",
    date: new Date(`${day}T00:00:00Z`),
    startTime: "17:00",
    location: SALES_CALL_LOCATION,
    lead: { name: "דנה כהן", phone: "050-1234567", customerId: null },
    service: null,
    ...over,
  });

  it("recognized by its location", () => {
    expect(isSalesCallMeeting({ location: "שיחה טלפונית" })).toBe(true);
    expect(isSalesCallMeeting({ location: "הרצל 12" })).toBe(false);
    expect(isSalesCallMeeting({ location: null })).toBe(false);
  });

  it("AllDog sales call → 2 hours before, its own chain first, templates only", async () => {
    const msg = (await scheduleLeadMeetingReminder(meeting())) as Record<string, unknown>;
    expect(msg).toBeTruthy();
    const sendAt = msg.sendAt as Date;
    expect(israelInstant(day, "17:00").getTime() - sendAt.getTime()).toBe(2 * 3600 * 1000);
    const payload = JSON.parse(msg.payloadJson as string);
    expect(payload.flow).toBe("sales_call_reminder");
    expect(payload.templateOnly).toBe(true);
    expect(payload.to).toBe("972501234567");
    expect(payload.templateChain[0]).toEqual({ name: "petra_sales_call_reminder", params: ["AllDog", "היום בשעה 17:00", "רחלי", "03-3818670"] });
    expect(payload.templateChain[1].name).toBe("petra_appointment_reminder_v2");
    expect(payload.templateChain[1].params[0]).toBe("דנה");
    expect(msg.customerId).toBeNull();
    expect(msg.relatedEntityType).toBe("LEAD_MEETING");
  });

  it("booked closer than 2 hours → no reminder", async () => {
    const soon = new Date(Date.now() + 90 * 60 * 1000);
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(soon);
    const g = (t: string) => parts.find((p) => p.type === t)!.value;
    const msg = await scheduleLeadMeetingReminder(meeting({ date: new Date(`${g("year")}-${g("month")}-${g("day")}T00:00:00Z`), startTime: `${g("hour")}:${g("minute")}` }));
    expect(msg).toBeNull();
    expect(sm.create).not.toHaveBeenCalled();
  });

  /** The regular LeadMeeting reminder, exactly: 24 h before, appointment templates, free-text fallback allowed. */
  async function expectRegularReminder(m: ReturnType<typeof meeting>) {
    const msg = (await scheduleLeadMeetingReminder(m)) as Record<string, unknown>;
    const payload = JSON.parse(msg.payloadJson as string);
    expect(payload.flow).toBe("lead_meeting_reminder");
    expect(payload.templateOnly).toBeUndefined();
    expect(payload.templateChain[0].name).toBe("petra_appointment_reminder_v2");
    expect(payload.templateChain.map((s: { name: string }) => s.name)).not.toContain("petra_sales_call_reminder");
    expect(JSON.stringify(payload)).not.toMatch(/AllDog|רחלי/);
    expect(msg.templateKey).toBe("lead_meeting_reminder_24h");
    expect(israelInstant(day, "17:00").getTime() - (msg.sendAt as Date).getTime()).toBe(24 * 3600 * 1000);
  }

  it("another business with the same location 'שיחה טלפונית' → the regular reminder, exactly", async () => {
    await expectRegularReminder(meeting({ businessId: "b-other" }));
  });

  it("AllDog with the voice-agent flag OFF → the regular reminder too", async () => {
    process.env.ALLDOG_VOICE_AGENT_ENABLED = "false";
    await expectRegularReminder(meeting());
  });

  it("AllDog, flag on, but no voice secret configured (flag incomplete) → regular", async () => {
    delete process.env.ALLDOG_VOICE_AGENT_SECRET;
    await expectRegularReminder(meeting());
  });

  it("an AllDog meeting that is not a sales call → the regular reminder, unchanged", async () => {
    const msg = (await scheduleLeadMeetingReminder(meeting({ location: "הרצל 12" }))) as Record<string, unknown>;
    expect(JSON.parse(msg.payloadJson as string).flow).toBe("lead_meeting_reminder");
  });
});

describe("templateOnly — never free text", () => {
  const base = { to: "972501234567", fallbackBody: "טקסט חופשי", businessId: "b-alldog", context: "sales_call_confirmation" };
  const steps = [{ name: "petra_sales_call_confirmation", params: ["a", "b", "c", "d", "e"] }];

  it("all templates rejected + templateOnly → no free-text send, failure returned", async () => {
    mockTemplate.mockResolvedValue({ success: false, error: "132001 template does not exist" } as never);
    const r = await sendWithTemplateChain({ ...base, steps, templateOnly: true });
    expect(r.success).toBe(false);
    expect(mockText).not.toHaveBeenCalled();
  });

  it("without the flag the old behaviour stays: free text is the last resort", async () => {
    mockTemplate.mockResolvedValue({ success: false, error: "rejected" } as never);
    mockText.mockResolvedValue({ success: true, messageSid: "wamid.1" } as never);
    const r = await sendWithTemplateChain({ ...base, steps });
    expect(mockText).toHaveBeenCalledTimes(1);
    expect(r.via).toBe("text");
  });

  it("a template that goes through is used as usual", async () => {
    mockTemplate.mockResolvedValue({ success: true, messageSid: "wamid.2" } as never);
    const r = await sendWithTemplateChain({ ...base, steps, templateOnly: true });
    expect(r).toMatchObject({ success: true, via: "template", templateName: "petra_sales_call_confirmation" });
  });
});

describe("Google Calendar event of a sales call", () => {
  const ev = buildLeadMeetingEventPayload(
    {
      id: "m1", businessId: "b-alldog", date: new Date("2026-11-16T00:00:00Z"), startTime: "10:20", endTime: "10:40",
      lead: { id: "lead-1", name: "נועה ברק", phone: "0541230001", city: "כפר סבא", notes: "🐾 פרטי הכלב:\nשם: לולה\nגזע: פודל\nגיל: שנה\nהערות: מושכת ברצועה" },
    },
    "https://petra-app.com"
  );

  it("title: 'שיחת מכירה: <שם> · <טלפון>'", () => {
    expect(ev.summary).toBe("שיחת מכירה: נועה ברק · 0541230001");
  });

  it("description: dog, breed, age, city, problem and the lead link", () => {
    for (const s of ["כלב: לולה", "גזע: פודל", "גיל: שנה", "עיר: כפר סבא", "הבעיה: מושכת ברצועה", "https://petra-app.com/leads?lead=lead-1"]) {
      expect(ev.description).toContain(s);
    }
  });

  it("popup 10 minutes before, Israel times with the right offset (winter +02:00)", () => {
    expect(ev.reminders).toEqual({ useDefault: false, overrides: [{ method: "popup", minutes: 10 }] });
    expect(ev.start.dateTime).toBe("2026-11-16T10:20:00+02:00");
    expect(ev.end.dateTime).toBe("2026-11-16T10:40:00+02:00");
  });

  it("summer time → +03:00", () => {
    const summer = buildLeadMeetingEventPayload(
      { id: "m2", businessId: "b", date: new Date("2026-07-14T00:00:00Z"), startTime: "16:00", endTime: "16:20", lead: { id: "l", name: "דנה", phone: null, city: null, notes: null } },
      "https://x"
    );
    expect(summer.start.dateTime).toBe("2026-07-14T16:00:00+03:00");
    expect(summer.summary).toBe("שיחת מכירה: דנה");
  });

  it("daily alert text names the cause", () => {
    expect(calendarFailureText("not_connected")).toContain("לא מחוברת ליומן גוגל");
    expect(calendarFailureText("rep_not_configured")).toContain("ALLDOG_SALES_REP_USER_ID");
    expect(calendarFailureText("error", "403 insufficient permissions")).toContain("403");
  });
});

describe("calendar hooks run only for AllDog with the flag on", () => {
  let lookup: jest.SpyInstance, push: jest.SpyInstance, del: jest.SpyInstance;
  beforeEach(() => {
    lookup = jest.spyOn(gcal, "leadMeetingGcalUserIds").mockResolvedValue(["user-racheli"]);
    push = jest.spyOn(gcal, "pushLeadMeetingToGcalForUser").mockResolvedValue({ ok: true, eventId: "e1" });
    del = jest.spyOn(gcal, "deleteLeadMeetingFromGcal").mockResolvedValue();
    process.env.ALLDOG_SALES_REP_USER_ID = "user-racheli";
  });
  afterEach(() => { jest.restoreAllMocks(); delete process.env.ALLDOG_SALES_REP_USER_ID; });

  it("another business: move / cancel / booking-sync do nothing — not even a lookup", async () => {
    await resyncSalesCallCalendar("b-other", "m1");
    await removeSalesCallFromCalendar("b-other", "m1");
    await syncSalesCallToRepCalendar("b-other", "m1");
    expect(lookup).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it("AllDog, flag on: a move updates the calendar copy, a cancel removes it", async () => {
    await resyncSalesCallCalendar("b-alldog", "m1");
    expect(push).toHaveBeenCalledWith("m1", "b-alldog", "user-racheli");
    await removeSalesCallFromCalendar("b-alldog", "m1");
    expect(del).toHaveBeenCalledWith("m1", "b-alldog");
  });

  it("AllDog, flag OFF: no new writes (booking / move); a cancel still removes an event Petra already wrote", async () => {
    process.env.ALLDOG_VOICE_AGENT_ENABLED = "false";
    await syncSalesCallToRepCalendar("b-alldog", "m1");
    await resyncSalesCallCalendar("b-alldog", "m1");
    expect(push).not.toHaveBeenCalled();
    await removeSalesCallFromCalendar("b-alldog", "m1");
    expect(del).toHaveBeenCalledWith("m1", "b-alldog");
  });

  it("AllDog meeting with no calendar copy → cancel does nothing", async () => {
    lookup.mockResolvedValue([]);
    await removeSalesCallFromCalendar("b-alldog", "m1");
    expect(del).not.toHaveBeenCalled();
  });
});
