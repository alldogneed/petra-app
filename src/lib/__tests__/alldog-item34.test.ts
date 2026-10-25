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
jest.mock("@/lib/alldog-bot/wa", () => ({ sendTemplate: (...a: unknown[]) => sendTemplate(...a) }));
jest.mock("@/lib/alldog/leads", () => ({
  addLeadCallLog: (...a: unknown[]) => addLeadCallLog(...a),
  findLeadsByPhone: (...a: unknown[]) => findLeadsByPhone(...a),
}));
jest.mock("@/services/clients", () => ({ findCustomersByPhone: (...a: unknown[]) => findCustomersByPhone(...a) }));
jest.mock("@/lib/paycall", () => ({ getCalls: (...a: unknown[]) => getCalls(...a) }));
jest.mock("@/lib/alldog/failure-alerts", () => ({ alertAllDogFailure: jest.fn() }));

import { isOfficeOpenAt, israelInstant, nextCallbackPhrase } from "@/lib/alldog/time";
import {
  conversationSkipReasonForForm,
  firstNameOf,
  FORM_LEAD_KINDS,
  formLeadContextNote,
  formLeadMessage,
  formLeadSendAt,
  isAnsweredCallLog,
  isWebsiteFormSource,
  scheduleSkipReason,
} from "@/lib/alldog/form-lead-rules";
import { autoMessageLabel, FORM_LEAD_MESSAGE_KIND } from "@/lib/alldog/missed-call-labels";
import { closingText } from "@/lib/alldog-bot/handoff";
import { scheduleFormLeadWhatsApp, sendFormLeadMessage } from "@/lib/alldog/form-lead-wa";

const il = israelInstant;

describe("nextCallbackPhrase (Israel time, at the moment of sending)", () => {
  // 2026-10-25 = Sunday (also the day Israel moves back from summer time, 02:00).
  it("office open → בהקדם", () => {
    expect(nextCallbackPhrase(il("2026-10-25", "09:00"))).toBe("בהקדם");
    expect(nextCallbackPhrase(il("2026-10-27", "16:59"))).toBe("בהקדם"); // Tue
    expect(nextCallbackPhrase(il("2026-10-30", "13:59"))).toBe("בהקדם"); // Fri
  });
  it("work day before 09:00 → היום בבוקר (Friday too)", () => {
    expect(nextCallbackPhrase(il("2026-10-25", "08:59"))).toBe("היום בבוקר");
    expect(nextCallbackPhrase(il("2026-10-29", "06:30"))).toBe("היום בבוקר"); // Thu
    expect(nextCallbackPhrase(il("2026-10-30", "07:00"))).toBe("היום בבוקר"); // Fri
  });
  it("Sun–Thu after 17:00 → מחר בבוקר (Thursday too: Friday is a work day)", () => {
    expect(nextCallbackPhrase(il("2026-10-25", "17:00"))).toBe("מחר בבוקר");
    expect(nextCallbackPhrase(il("2026-10-28", "23:59"))).toBe("מחר בבוקר"); // Wed
    expect(nextCallbackPhrase(il("2026-10-29", "18:00"))).toBe("מחר בבוקר"); // Thu
  });
  it("Friday from 14:00 and all of Saturday → ביום ראשון בבוקר", () => {
    expect(nextCallbackPhrase(il("2026-10-30", "14:00"))).toBe("ביום ראשון בבוקר");
    expect(nextCallbackPhrase(il("2026-10-31", "08:00"))).toBe("ביום ראשון בבוקר");
    expect(nextCallbackPhrase(il("2026-10-31", "23:59"))).toBe("ביום ראשון בבוקר");
  });
  it("daylight-saving changes: Israel time, not UTC", () => {
    // Winter (UTC+2): Sunday 25/10 07:30 UTC = 09:30 Israel → open; 06:30 UTC = 08:30 → before opening.
    expect(nextCallbackPhrase(new Date("2026-10-25T07:30:00Z"))).toBe("בהקדם");
    expect(nextCallbackPhrase(new Date("2026-10-25T06:30:00Z"))).toBe("היום בבוקר");
    // Summer (UTC+3, from Fri 27/3/2026): Sunday 29/3 06:30 UTC = 09:30 Israel → open.
    expect(nextCallbackPhrase(new Date("2026-03-29T06:30:00Z"))).toBe("בהקדם");
    expect(nextCallbackPhrase(new Date("2026-03-29T05:30:00Z"))).toBe("היום בבוקר");
    // Summer evening: 14:00 UTC = 17:00 Israel → closed.
    expect(nextCallbackPhrase(new Date("2026-03-29T14:00:00Z"))).toBe("מחר בבוקר");
    expect(isOfficeOpenAt(new Date("2026-03-29T13:59:00Z"))).toBe(true);
  });
});

describe("the message", () => {
  it("open template = the approved body with the first name", () => {
    expect(formLeadMessage("דנה", "בהקדם")).toEqual({
      template: "lead_followup_open",
      params: ["דנה"],
      text: "היי דנה, כאן צוות AllDog 🙂 קיבלנו את הפרטים שהשארתם באתר, ונציגה תחזור אליכם בהקדם. בינתיים, תוכלו לכתוב לי פה בקצרה מה קורה עם הכלב/ה שלכם, כדי שהיא תגיע לשיחה מוכנה?",
    });
  });
  it("closed template carries the callback phrase", () => {
    const m = formLeadMessage("יוסי", "מחר בבוקר");
    expect(m.template).toBe("lead_followup_closed");
    expect(m.params).toEqual(["יוסי", "מחר בבוקר"]);
    expect(m.text).toContain("נציגה תחזור אליכם מחר בבוקר.");
    expect(m.text).not.toContain("{{");
  });
  it("a 16:58 lead sent at 17:02 gets the closed template", () => {
    const sendAt = il("2026-10-27", "17:02");
    expect(formLeadMessage("רון", nextCallbackPhrase(sendAt)).template).toBe("lead_followup_closed");
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
  it("send failure → failed, not retried", async () => {
    msgFindUnique.mockResolvedValue(pendingRow());
    sendTemplate.mockResolvedValue(null);
    expect((await sendFormLeadMessage("row1", il("2026-10-27", "10:04"))).status).toBe("failed");
    expect(msgUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: FORM_LEAD_KINDS.failed }) }));
    expect(sendTemplate).toHaveBeenCalledTimes(1);
  });
});
