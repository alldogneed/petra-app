/**
 * Item 34 (Or, 25/10): the bot's first WhatsApp to a lead who left details in a website form.
 */
const msgCreate = jest.fn();
const msgUpdateMany = jest.fn();
const msgUpdate = jest.fn();
const msgFindUnique = jest.fn();
const msgFindFirst = jest.fn();
const convFindUnique = jest.fn();
const convUpsert = jest.fn();
const leadFindFirst = jest.fn();
const stageFindUnique = jest.fn();
const sendTemplate = jest.fn();
const addLeadCallLog = jest.fn();
const findLeadsByPhone = jest.fn();
const findCustomersByPhone = jest.fn();
const getCalls = jest.fn();
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    waBotMessage: {
      create: (...a: unknown[]) => msgCreate(...a),
      updateMany: (...a: unknown[]) => msgUpdateMany(...a),
      update: (...a: unknown[]) => msgUpdate(...a),
      findUnique: (...a: unknown[]) => msgFindUnique(...a),
      findFirst: (...a: unknown[]) => msgFindFirst(...a),
    },
    waBotConversation: { findUnique: (...a: unknown[]) => convFindUnique(...a), upsert: (...a: unknown[]) => convUpsert(...a) },
    lead: { findFirst: (...a: unknown[]) => leadFindFirst(...a) },
    leadStage: { findUnique: (...a: unknown[]) => stageFindUnique(...a) },
  },
}));
// sendTemplateSteps → the first step through the `sendTemplate` spy; the real fallback is tested below.
jest.mock("@/lib/alldog-bot/wa", () => ({
  sendTemplate: (...a: unknown[]) => sendTemplate(...a),
  sendTemplateSteps: async (to: string, steps: Array<{ name: string; params: string[]; text: string }>, lang: string) => {
    const w = await sendTemplate(to, steps[0].name, lang, steps[0].params);
    return w ? { wamid: w, step: steps[0], fellBackFrom: [] } : null;
  },
}));
jest.mock("@/lib/alldog/leads", () => ({
  addLeadCallLog: (...a: unknown[]) => addLeadCallLog(...a),
  findLeadsByPhone: (...a: unknown[]) => findLeadsByPhone(...a),
}));
jest.mock("@/services/clients", () => ({ findCustomersByPhone: (...a: unknown[]) => findCustomersByPhone(...a) }));
jest.mock("@/lib/paycall", () => ({ getCalls: (...a: unknown[]) => getCalls(...a) }));
jest.mock("@/lib/alldog/failure-alerts", () => ({ alertAllDogFailure: jest.fn() }));

import { callbackPhraseFor, callbackSlot, isOfficeOpenAt, israelInstant, nextCallbackPhrase, shabbatEndsAt } from "@/lib/alldog/time";
import { missedCallSteps } from "@/lib/alldog/missed-call-rules";
import {
  conversationSkipReasonForForm,
  firstNameOf,
  FORM_LEAD_KINDS,
  formLeadContextNote,
  formLeadSteps,
  formLeadSendAt,
  isAnsweredCallLog,
  isWebsiteFormSource,
  scheduleSkipReason,
} from "@/lib/alldog/form-lead-rules";
import { autoMessageLabel, FORM_LEAD_MESSAGE_KIND } from "@/lib/alldog/missed-call-labels";
import { closingText } from "@/lib/alldog-bot/handoff";
import { scheduleFormLeadWhatsApp, sendFormLeadMessage } from "@/lib/alldog/form-lead-wa";

const il = israelInstant;

describe("callbackSlot (Israel time, at the moment of sending)", () => {
  // 2026-10-25 = Sunday (Israel moves back from summer time that night, 02:00).
  const at = (ymd: string, hhmm: string) => callbackSlot(il(ymd, hhmm));
  it("open: Sun–Thu 09:00–17:00, Fri 09:00–14:00 (boundaries)", () => {
    expect(at("2026-10-25", "08:59")).toEqual({ kind: "after_hours", phrase: "היום בבוקר" });
    expect(at("2026-10-25", "09:00")).toEqual({ kind: "open" });
    expect(at("2026-10-27", "16:59")).toEqual({ kind: "open" });
    expect(at("2026-10-27", "17:00")).toEqual({ kind: "after_hours", phrase: "מחר בבוקר" });
    expect(at("2026-10-29", "18:00")).toEqual({ kind: "after_hours", phrase: "מחר בבוקר" }); // Thu → Friday is a work day
    expect(at("2026-10-30", "08:59")).toEqual({ kind: "after_hours", phrase: "היום בבוקר" }); // Fri morning
    expect(at("2026-10-30", "13:59")).toEqual({ kind: "open" });
    expect(at("2026-10-30", "14:00")).toEqual({ kind: "weekend" });
  });
  it("weekend until Shabbat ends (tzeit 8.5°, Tel Aviv), then 'מחר בבוקר'", () => {
    const end = shabbatEndsAt("2026-10-31"); // Saturday
    expect(callbackSlot(il("2026-10-31", "08:00"))).toEqual({ kind: "weekend" });
    expect(callbackSlot(new Date(end.getTime() - 60_000))).toEqual({ kind: "weekend" });
    expect(callbackSlot(end)).toEqual({ kind: "after_hours", phrase: "מחר בבוקר" });
    expect(callbackSlot(il("2026-10-31", "23:59"))).toEqual({ kind: "after_hours", phrase: "מחר בבוקר" });
  });
  it("Shabbat end matches Hebcal tzeit(8.5) for Tel Aviv within a minute (summer + winter)", () => {
    const hebcal: Record<string, string> = {
      "2026-10-24": "2026-10-24T15:35:35Z", // last Shabbat of summer time
      "2026-10-31": "2026-10-31T15:29:12Z",
      "2026-03-28": "2026-03-28T16:34:13Z", // first Shabbat of summer time
      "2026-06-27": "2026-06-27T17:33:32Z",
      "2026-12-26": "2026-12-26T15:23:00Z",
      "2027-03-27": "2027-03-27T16:33:20Z",
    };
    for (const [ymd, ref] of Object.entries(hebcal)) {
      expect(Math.abs(shabbatEndsAt(ymd).getTime() - Date.parse(ref))).toBeLessThan(60_000);
    }
  });
  it("daylight-saving days: Israel time, not UTC", () => {
    // Winter (UTC+2): Sunday 25/10 07:00 UTC = 09:00 Israel → open; 06:59 UTC = 08:59 → before opening.
    expect(callbackSlot(new Date("2026-10-25T07:00:00Z"))).toEqual({ kind: "open" });
    expect(callbackSlot(new Date("2026-10-25T06:59:00Z"))).toEqual({ kind: "after_hours", phrase: "היום בבוקר" });
    // Summer (UTC+3, from Fri 27/3/2026 02:00): Friday 27/3 06:00 UTC = 09:00 Israel → open.
    expect(callbackSlot(new Date("2026-03-27T06:00:00Z"))).toEqual({ kind: "open" });
    expect(callbackSlot(new Date("2026-03-27T10:59:00Z"))).toEqual({ kind: "open" }); // 13:59
    expect(callbackSlot(new Date("2026-03-27T11:00:00Z"))).toEqual({ kind: "weekend" }); // 14:00
    // Summer Sunday 29/3: 13:59 / 14:00 UTC = 16:59 / 17:00 Israel.
    expect(callbackSlot(new Date("2026-03-29T13:59:00Z"))).toEqual({ kind: "open" });
    expect(callbackSlot(new Date("2026-03-29T14:00:00Z"))).toEqual({ kind: "after_hours", phrase: "מחר בבוקר" });
    expect(isOfficeOpenAt(new Date("2026-03-29T13:59:00Z"))).toBe(true);
  });
  it("the phrase per slot", () => {
    expect(callbackPhraseFor({ kind: "open" })).toBe("בהקדם");
    expect(callbackPhraseFor({ kind: "after_hours", phrase: "מחר בבוקר" })).toBe("מחר בבוקר");
    expect(callbackPhraseFor({ kind: "weekend" })).toBe("ביום ראשון בבוקר");
    expect(nextCallbackPhrase(il("2026-10-31", "11:00"))).toBe("ביום ראשון בבוקר");
  });
});

describe("templates per slot (+ the open template as fallback)", () => {
  it("form, open = the approved body with the first name", () => {
    expect(formLeadSteps("דנה", { kind: "open" })).toEqual([
      {
        name: "lead_followup_open",
        params: ["דנה"],
        text: "היי דנה, כאן צוות AllDog 🙂 קיבלנו את הפרטים שהשארתם באתר, ונציגה תחזור אליכם בהקדם. בינתיים, תוכלו לכתוב לי פה בקצרה מה קורה עם הכלב/ה שלכם, כדי שהיא תגיע לשיחה מוכנה?",
      },
    ]);
  });
  it("form, after hours = lead_followup_closed with the phrase, then open", () => {
    const [first, fallback] = formLeadSteps("יוסי", { kind: "after_hours", phrase: "מחר בבוקר" });
    expect(first.name).toBe("lead_followup_closed");
    expect(first.params).toEqual(["יוסי", "מחר בבוקר"]);
    expect(first.text).toContain("נציגה תחזור אליכם מחר בבוקר.");
    expect(fallback.name).toBe("lead_followup_open");
  });
  it("form, weekend = lead_followup_weekend, then open", () => {
    const [first, fallback] = formLeadSteps("רון", { kind: "weekend" });
    expect(first).toEqual({
      name: "lead_followup_weekend",
      params: ["רון"],
      text: "היי רון, כאן צוות AllDog 🙂 קיבלנו את הפרטים שהשארתם באתר. אנחנו בחופשת סוף השבוע, ונציגה תחזור אליכם ביום ראשון בבוקר. בינתיים, תוכלו לכתוב לי פה בקצרה מה קורה עם הכלב/ה שלכם, כדי שהיא תגיע לשיחה מוכנה? שבת שלום 🙂",
    });
    expect(fallback.name).toBe("lead_followup_open");
  });
  it("missed call: open / after hours / weekend", () => {
    expect(missedCallSteps({ kind: "open" }).map((s) => s.name)).toEqual(["missed_call_followup"]);
    const [ah, ahFallback] = missedCallSteps({ kind: "after_hours", phrase: "היום בבוקר" });
    expect(ah).toEqual({
      name: "missed_call_after_hours",
      params: ["היום בבוקר"],
      text: "היי, כאן צוות AllDog 🙂 ראינו שניסית להשיג אותנו אחרי שעות הפעילות. נציגה תחזור אליך היום בבוקר. בינתיים, אפשר לכתוב לי פה בקצרה מה קורה עם הכלב, כדי שהיא תגיע לשיחה מוכנה?",
    });
    expect(ahFallback.name).toBe("missed_call_followup");
    const [we] = missedCallSteps({ kind: "weekend" });
    expect(we.name).toBe("missed_call_weekend");
    expect(we.params).toEqual([]);
    expect(we.text).toContain("ביום ראשון בבוקר");
    expect(we.text).toContain("שבת שלום 🙂");
  });
  it("a 16:58 lead sent at 17:02 gets the after-hours template", () => {
    expect(formLeadSteps("רון", callbackSlot(il("2026-10-27", "17:02")))[0].name).toBe("lead_followup_closed");
  });
  it("first name for {{1}}", () => {
    expect(firstNameOf("דנה כהן")).toBe("דנה");
    expect(firstNameOf("  משה  ")).toBe("משה");
    expect(firstNameOf("0541234567")).toBeNull();
    expect(firstNameOf("ליד מהאתר")).toBeNull();
    expect(firstNameOf("")).toBeNull();
  });
  it("only the website lead forms", () => {
    expect(isWebsiteFormSource("אתר · חיפוש אורגני")).toBe(true);
    expect(isWebsiteFormSource("אתר")).toBe(true);
    expect(isWebsiteFormSource("וואטסאפ · פרסום ממומן")).toBe(false); // floating WhatsApp button
    expect(isWebsiteFormSource("website")).toBe(false);
    expect(isWebsiteFormSource("אתרים")).toBe(false);
  });
  it("3–5 minutes after the lead", () => {
    const t = il("2026-10-27", "10:00");
    expect(formLeadSendAt(t, 0).getTime() - t.getTime()).toBe(3 * 60_000);
    expect(formLeadSendAt(t, 0.999999).getTime() - t.getTime()).toBeLessThan(5 * 60_000);
    for (let i = 0; i < 50; i++) {
      const d = formLeadSendAt(t).getTime() - t.getTime();
      expect(d).toBeGreaterThanOrEqual(3 * 60_000);
      expect(d).toBeLessThan(5 * 60_000);
    }
  });
  it("closing promise = the same phrase", () => {
    expect(closingText("מחר בבוקר", "f")).toContain("תחזור אלייך טלפונית מחר בבוקר.");
    expect(closingText("ביום ראשון בבוקר", "unknown")).toContain("תחזור בטלפון ביום ראשון בבוקר.");
    expect(closingText("בהקדם", "m")).toContain("תחזור אליך טלפונית בהקדם.");
    expect(closingText("soon", "m")).toContain("בהקדם.");
  });
  it("rep chat label + bot context", () => {
    expect(autoMessageLabel(FORM_LEAD_MESSAGE_KIND)).toBe("הודעה אוטומטית · השאיר פרטים באתר");
    expect(autoMessageLabel("text")).toBeNull();
    const note = formLeadContextNote({ name: "דנה כהן", city: "כפר סבא", service: "אילוף בבית" });
    expect(note).toContain("שם: דנה כהן");
    expect(note).toContain("עיר: כפר סבא");
    expect(note).toContain("אל תשאל על אלה שוב");
    expect(note).toContain("בלי הודעת פתיחה");
  });
});

describe("rules", () => {
  const act = il("2026-10-27", "09:00");
  it("schedule: switch, activation, source, no backfill", () => {
    const base = { enabled: true, activatedAt: act, source: "אתר · ישיר", leadCreatedAt: il("2026-10-27", "10:00"), now: il("2026-10-27", "10:00") };
    expect(scheduleSkipReason(base)).toBeNull();
    expect(scheduleSkipReason({ ...base, enabled: false })).toBe("disabled");
    expect(scheduleSkipReason({ ...base, activatedAt: null })).toBe("not_activated");
    expect(scheduleSkipReason({ ...base, source: "manual" })).toBe("not_form");
    expect(scheduleSkipReason({ ...base, leadCreatedAt: il("2026-10-27", "08:59") })).toBe("before_activation");
    expect(scheduleSkipReason({ ...base, now: il("2026-10-27", "11:00") })).toBe("lead_too_old");
  });
  it("conversation: wrote / active / stopped / missed-call / once per 24h", () => {
    const now = il("2026-10-27", "10:04");
    const leadCreatedAt = il("2026-10-27", "10:00");
    const base = { conv: null, leadCreatedAt, lastMissedCallAt: null, lastFormLeadAt: null, now };
    expect(conversationSkipReasonForForm(base)).toBeNull();
    expect(conversationSkipReasonForForm({ ...base, conv: { status: "active", lastInboundAt: il("2026-10-27", "10:02") } })).toBe("customer_wrote");
    expect(conversationSkipReasonForForm({ ...base, conv: { status: "active", lastInboundAt: il("2026-10-27", "08:00") } })).toBe("active_conversation");
    expect(conversationSkipReasonForForm({ ...base, conv: { status: "active", lastInboundAt: il("2026-10-20", "08:00") } })).toBeNull();
    expect(conversationSkipReasonForForm({ ...base, conv: { status: "stopped", lastInboundAt: null } })).toBe("stopped");
    expect(conversationSkipReasonForForm({ ...base, conv: { status: "handoff", lastInboundAt: null } })).toBe("active_conversation");
    expect(conversationSkipReasonForForm({ ...base, lastMissedCallAt: il("2026-10-26", "18:00") })).toBe("missed_call_sent");
    expect(conversationSkipReasonForForm({ ...base, lastFormLeadAt: il("2026-10-26", "18:00") })).toBe("sent_recently");
    expect(conversationSkipReasonForForm({ ...base, lastFormLeadAt: il("2026-10-25", "18:00") })).toBeNull();
  });
  it("an answered call = PayCall answered (even pending) or a rep's own log; automatic lines don't count", () => {
    expect(isAnsweredCallLog({ type: "call", summary: "[paycall-answered] שיחה שנענתה ב-27/10 • call_id:1" })).toBe(true);
    expect(isAnsweredCallLog({ type: "call", summary: "דיברתי איתה, מחכה לאבחון" })).toBe(true);
    expect(isAnsweredCallLog({ type: "call", summary: "[paycall] שיחה שלא נענתה" })).toBe(false);
    expect(isAnsweredCallLog({ type: "call", summary: "[וואטסאפ · אוטומטי] נשלחה הודעה" })).toBe(false);
    expect(isAnsweredCallLog({ type: "stage_change", summary: "עבר שלב" })).toBe(false);
  });
});

describe("flow", () => {
  const OLD = process.env;
  const leadCreatedAt = il("2026-10-27", "10:00");
  const input = { businessId: "biz", leadId: "L1", name: "דנה כהן", phone: "054-1234567", source: "אתר · חיפוש אורגני", createdAt: leadCreatedAt };
  const conv = { id: "conv1", businessId: "biz", phone: "972541234567", status: "active", lastInboundAt: null };
  const pendingRow = (over: Record<string, unknown> = {}) => ({
    id: "row1",
    text: JSON.stringify({ leadId: "L1", sendAt: il("2026-10-27", "10:04").toISOString(), leadCreatedAt: leadCreatedAt.toISOString(), mobile: "0541234567", firstName: "דנה" }),
    conversation: { ...conv, ...over },
  });
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(il("2026-10-27", "10:00"));
    for (const f of [msgCreate, msgUpdateMany, msgUpdate, msgFindUnique, msgFindFirst, convFindUnique, convUpsert, leadFindFirst, stageFindUnique, sendTemplate, addLeadCallLog, findLeadsByPhone, findCustomersByPhone, getCalls]) f.mockReset();
    process.env = {
      ...OLD,
      ALLDOG_BUSINESS_ID: "biz",
      ALLDOG_FORM_WA_ENABLED: "true",
      ALLDOG_FORM_WA_SINCE: "2026-10-27T08:00:00+02:00",
      ALLDOG_WA_TOKEN: "t",
      ALLDOG_WA_PHONE_NUMBER_ID: "p",
    };
    findCustomersByPhone.mockResolvedValue([]);
    findLeadsByPhone.mockResolvedValue([{ id: "L1" }]);
    convFindUnique.mockResolvedValue(null);
    convUpsert.mockResolvedValue({ id: "conv1" });
    msgCreate.mockResolvedValue({ id: "x" });
    msgUpdateMany.mockResolvedValue({ count: 1 });
    msgUpdate.mockResolvedValue({});
    msgFindFirst.mockResolvedValue(null);
    leadFindFirst.mockResolvedValue({ id: "L1", stage: "s1", callLogs: [] });
    stageFindUnique.mockResolvedValue({ isWon: false, isLost: false });
    getCalls.mockResolvedValue([]);
    addLeadCallLog.mockResolvedValue({ id: "log" });
  });
  afterEach(() => {
    jest.useRealTimers();
    process.env = OLD;
  });

  it("schedule: queued 3–5 min later, nothing sent inside the request", async () => {
    const r = await scheduleFormLeadWhatsApp(input);
    expect(r.status).toBe("scheduled");
    const delay = Date.parse(r.sendAt!) - leadCreatedAt.getTime();
    expect(delay).toBeGreaterThanOrEqual(3 * 60_000);
    expect(delay).toBeLessThan(5 * 60_000);
    expect(msgCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ role: "system", kind: FORM_LEAD_KINDS.pending, waMessageId: "form-lead:L1" }) });
    expect(convUpsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ leadId: "L1", phone: "972541234567" }) }));
    expect(sendTemplate).not.toHaveBeenCalled();
  });
  it("schedule: existing customer / returning contact / landline / other business → nothing", async () => {
    findCustomersByPhone.mockResolvedValueOnce([{ id: "c1", name: "x" }]);
    expect((await scheduleFormLeadWhatsApp(input)).reason).toBe("existing_customer");
    findLeadsByPhone.mockResolvedValueOnce([{ id: "L1" }, { id: "OLD" }]);
    expect((await scheduleFormLeadWhatsApp(input)).reason).toBe("returning_contact");
    expect((await scheduleFormLeadWhatsApp({ ...input, phone: "03-3818670" })).reason).toBe("not_mobile");
    expect((await scheduleFormLeadWhatsApp({ ...input, businessId: "other" })).reason).toBe("not_alldog");
    expect((await scheduleFormLeadWhatsApp({ ...input, source: "וואטסאפ · ישיר" })).reason).toBe("not_form");
    expect(msgCreate).not.toHaveBeenCalled();
  });
  it("schedule: missing activation time → nothing (fail closed)", async () => {
    process.env.ALLDOG_FORM_WA_SINCE = "";
    expect((await scheduleFormLeadWhatsApp(input)).reason).toBe("not_activated");
    expect(msgCreate).not.toHaveBeenCalled();
  });

  it("send: inside hours → open template + the bot's copy + lead note", async () => {
    msgFindUnique.mockResolvedValue(pendingRow());
    sendTemplate.mockResolvedValue("wamid.1");
    const r = await sendFormLeadMessage("row1", il("2026-10-27", "10:04"));
    expect(r.status).toBe("sent");
    expect(sendTemplate).toHaveBeenCalledWith("972541234567", "lead_followup_open", "he", ["דנה"]);
    expect(msgCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ role: "assistant", kind: "form_lead_template", text: expect.stringContaining("היי דנה, כאן צוות AllDog"), waMessageId: "wamid.1" }),
    });
    expect(addLeadCallLog).toHaveBeenCalledWith("L1", expect.stringContaining("מקור: השאיר פרטים באתר"));
  });
  it("send: 17:02 (lead from 16:58) → closed template with 'מחר בבוקר'", async () => {
    msgFindUnique.mockResolvedValue(pendingRow());
    sendTemplate.mockResolvedValue("wamid.2");
    await sendFormLeadMessage("row1", il("2026-10-27", "17:02"));
    expect(sendTemplate).toHaveBeenCalledWith("972541234567", "lead_followup_closed", "he", ["דנה", "מחר בבוקר"]);
  });
  it("send: cancelled when the customer already wrote to the bot", async () => {
    msgFindUnique.mockResolvedValue(pendingRow({ lastInboundAt: il("2026-10-27", "10:02") }));
    const r = await sendFormLeadMessage("row1", il("2026-10-27", "10:04"));
    expect(r).toEqual({ status: "skipped", reason: "customer_wrote" });
    expect(sendTemplate).not.toHaveBeenCalled();
    expect(msgUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: FORM_LEAD_KINDS.skipped, text: expect.stringContaining("customer_wrote") }) }));
  });
  it("send: cancelled after an answered call (CallLog or PayCall)", async () => {
    msgFindUnique.mockResolvedValue(pendingRow());
    leadFindFirst.mockResolvedValueOnce({ id: "L1", stage: "s1", callLogs: [{ type: "call", summary: "[paycall-answered] שיחה שנענתה • call_id:9" }] });
    expect((await sendFormLeadMessage("row1", il("2026-10-27", "10:04"))).reason).toBe("answered_call");
    msgFindUnique.mockResolvedValue(pendingRow());
    getCalls.mockResolvedValueOnce([{ CALLERID: "0541234567", DISPOSITION: "ANSWER", START: "2026-10-27 10:02:00" }]);
    expect((await sendFormLeadMessage("row1", il("2026-10-27", "10:04"))).reason).toBe("answered_call");
    expect(sendTemplate).not.toHaveBeenCalled();
  });
  it("send: cancelled after a missed-call message, a closed lead or a deleted lead", async () => {
    msgFindUnique.mockResolvedValue(pendingRow());
    msgFindFirst.mockResolvedValueOnce({ createdAt: il("2026-10-27", "10:01") }); // missed_call_sent
    expect((await sendFormLeadMessage("row1", il("2026-10-27", "10:04"))).reason).toBe("missed_call_sent");
    stageFindUnique.mockResolvedValueOnce({ isWon: true, isLost: false });
    expect((await sendFormLeadMessage("row1", il("2026-10-27", "10:04"))).reason).toBe("lead_closed");
    leadFindFirst.mockResolvedValueOnce(null);
    expect((await sendFormLeadMessage("row1", il("2026-10-27", "10:04"))).reason).toBe("lead_gone");
    expect(sendTemplate).not.toHaveBeenCalled();
  });
  it("send: switch turned off meanwhile → cancelled; already handled → nothing", async () => {
    msgFindUnique.mockResolvedValue(pendingRow());
    process.env.ALLDOG_FORM_WA_ENABLED = "false";
    expect((await sendFormLeadMessage("row1", il("2026-10-27", "10:04"))).reason).toBe("disabled");
    msgUpdateMany.mockResolvedValueOnce({ count: 0 });
    expect((await sendFormLeadMessage("row1")).reason).toBe("already_handled");
    expect(sendTemplate).not.toHaveBeenCalled();
  });
  it("send (item 40.3): a 23:00 lead is not sent at 23:04 — back to the queue for 08:00, then 'היום בבוקר'", async () => {
    const late = il("2026-10-27", "23:00");
    msgFindUnique.mockResolvedValue({
      id: "row1",
      text: JSON.stringify({ leadId: "L1", sendAt: il("2026-10-27", "23:04").toISOString(), leadCreatedAt: late.toISOString(), mobile: "0541234567", firstName: "דנה" }),
      conversation: conv,
    });
    leadFindFirst.mockResolvedValue({ id: "L1", stage: "s1", callLogs: [] });
    sendTemplate.mockResolvedValue("wamid.3");
    expect((await sendFormLeadMessage("row1", il("2026-10-27", "23:04"))).status).toBe("deferred");
    expect(sendTemplate).not.toHaveBeenCalled();
    expect((await sendFormLeadMessage("row1", il("2026-10-28", "08:00"))).status).toBe("sent");
    expect(sendTemplate).toHaveBeenCalledWith("972541234567", "lead_followup_closed", "he", ["דנה", "היום בבוקר"]);
  });
  it("send: a 21:28 lead whose 3–5 min delay lands after 21:30 → deferred to 08:00", async () => {
    msgFindUnique.mockResolvedValue({
      id: "row1",
      text: JSON.stringify({ leadId: "L1", sendAt: il("2026-10-27", "21:32").toISOString(), leadCreatedAt: il("2026-10-27", "21:28").toISOString(), mobile: "0541234567", firstName: "דנה" }),
      conversation: conv,
    });
    leadFindFirst.mockResolvedValue({ id: "L1", stage: "s1", callLogs: [] });
    expect((await sendFormLeadMessage("row1", il("2026-10-27", "21:32"))).status).toBe("deferred");
    expect(JSON.parse(msgUpdate.mock.calls.at(-1)![0].data.text).sendAt).toBe(il("2026-10-28", "08:00").toISOString());
  });
  it("send: a late run (> 15 min after the lead) at night → back to the queue for 08:00", async () => {
    const late = il("2026-10-27", "23:00");
    msgFindUnique.mockResolvedValue({
      id: "row1",
      text: JSON.stringify({ leadId: "L1", sendAt: il("2026-10-27", "23:04").toISOString(), leadCreatedAt: late.toISOString(), mobile: "0541234567", firstName: "דנה" }),
      conversation: conv,
    });
    const r = await sendFormLeadMessage("row1", il("2026-10-27", "23:30"));
    expect(r.status).toBe("deferred");
    expect(sendTemplate).not.toHaveBeenCalled();
    const data = msgUpdate.mock.calls.at(-1)![0].data;
    expect(data.kind).toBe(FORM_LEAD_KINDS.pending);
    expect(JSON.parse(data.text).sendAt).toBe(il("2026-10-28", "08:00").toISOString());
  });
  it("send: Saturday lead → waits for Shabbat to end, then lead_followup_weekend", async () => {
    const sat = il("2026-10-31", "11:00");
    msgFindUnique.mockResolvedValue({
      id: "row1",
      text: JSON.stringify({ leadId: "L1", sendAt: il("2026-10-31", "11:04").toISOString(), leadCreatedAt: sat.toISOString(), mobile: "0541234567", firstName: "דנה" }),
      conversation: conv,
    });
    leadFindFirst.mockResolvedValue({ id: "L1", stage: "s1", callLogs: [] });
    sendTemplate.mockResolvedValue("wamid.4");
    expect((await sendFormLeadMessage("row1", il("2026-10-31", "11:04"))).status).toBe("deferred");
    expect(sendTemplate).not.toHaveBeenCalled();
    await sendFormLeadMessage("row1", new Date(shabbatEndsAt("2026-10-31").getTime() + 60_000));
    expect(sendTemplate).toHaveBeenCalledWith("972541234567", "lead_followup_weekend", "he", ["דנה"]);
  });
  it("send failure → failed, not retried", async () => {
    msgFindUnique.mockResolvedValue(pendingRow());
    sendTemplate.mockResolvedValue(null);
    expect((await sendFormLeadMessage("row1", il("2026-10-27", "10:04"))).status).toBe("failed");
    expect(msgUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: FORM_LEAD_KINDS.failed }) }));
    expect(sendTemplate).toHaveBeenCalledTimes(1);
  });
});
