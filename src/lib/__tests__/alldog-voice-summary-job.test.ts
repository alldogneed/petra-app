/**
 * AllDog voice agent — the end-of-call summary job (Or, 21/11/2026): the summary is always written
 * (with or without save_details), fills the lead, finds an urgent case nobody flagged, alerts the
 * rep with the summary line once, and a hidden caller with no number still reaches the rep and Or.
 * The job is real; the DB, the lead helpers and Claude are fakes.
 */
type Row = Record<string, unknown>;
const calls: Row[] = [];
const leads: Row[] = [];
const journal: Row[] = [];
const events: string[] = [];
const repAlerts: Row[] = [];
const ownerAlerts: Row[] = [];
const summarize = jest.fn();

jest.mock("@/lib/prisma", () => {
  const find = (where: Row) => calls.find((c) => c.id === where.id);
  const p = {
    voiceAgentCall: {
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const c = find(where);
        if (!c || c.summary !== null) return { count: 0 };
        if (data.summaryAttempts) c.summaryAttempts = (c.summaryAttempts as number) + 1;
        if (data.status) c.status = data.status;
        return { count: 1 };
      },
      findUnique: async ({ where }: { where: Row }) => find(where) ?? null,
      update: async ({ where, data }: { where: Row; data: Row }) => Object.assign(find(where)!, data),
      findMany: async () => [],
    },
    lead: { findFirst: async ({ where }: { where: Row }) => leads.find((l) => l.id === where.id) ?? null },
    leadMeeting: { findFirst: async () => null },
  };
  return { __esModule: true, default: p, prisma: p };
});
jest.mock("@/lib/rate-limit", () => ({ claimOnce: async () => true }));
jest.mock("@/lib/notify-owner", () => ({ notifyOwnerAllDog: async (p: Row) => { ownerAlerts.push(p); } }));
jest.mock("@/lib/alldog/failure-alerts", () => ({ alertAllDogFailure: async () => { events.push("failure-alert"); } }));
jest.mock("@/lib/alldog/voice-agent/rep-alert", () => ({ alertSalesRep: async (a: Row) => { repAlerts.push(a); return true; } }));
jest.mock("@/lib/alldog/leads", () => ({
  appUrl: () => "https://petra-app.com",
  isPlaceholderLeadName: (n: string) => /^שיחה מ-/.test(n),
  addLeadCallLog: async (leadId: string, summary: string) => { const row = { id: `log-${journal.length + 1}`, leadId, summary }; journal.push(row); return row; },
  updateLeadCallLog: async (id: string, _leadId: string, summary: string) => { journal.find((j) => j.id === id)!.summary = summary; },
}));
jest.mock("@/lib/alldog/voice-agent/booking", () => ({
  // Same contract as the real one: one lead per phone, fill EMPTY fields only.
  saveVoiceLead: async (_b: string, input: Row, phone: string) => {
    let lead = leads.find((l) => l.phone === phone);
    if (!lead) { lead = { id: `lead-${leads.length + 1}`, phone, name: `שיחה מ-${phone}`, city: null, dog: null }; leads.push(lead); events.push("lead-created"); }
    if (input.fullName && /^שיחה מ-/.test(String(lead.name))) lead.name = input.fullName;
    if (input.city && !lead.city) lead.city = input.city;
    if (input.dogName && !lead.dog) lead.dog = input.dogName;
    return { lead, displayName: /^שיחה מ-/.test(String(lead.name)) ? phone : lead.name };
  },
  ensureCallbackTask: async (_b: string, _l: string, _n: string, _p: string, input: Row) => { events.push(input.urgent ? "task-urgent" : "task"); },
  handleUrgent: async (_b: string, _c: string, _l: string, _n: string, _p: string, input: Row) => { if (input.urgent) events.push("urgent-alerts"); },
}));
jest.mock("@/lib/alldog/summary-core", () => ({
  ...jest.requireActual("@/lib/alldog/summary-core"),
  summarizeConversation: (...a: unknown[]) => summarize(...a),
}));

import { parseVoiceSummary, type VoiceSummary } from "@/lib/alldog/summary-core";
import { processVoiceSummary } from "@/lib/alldog/voice-agent/summary-job";

const NOW = new Date("2026-11-22T08:00:00Z"); // Sunday 10:00 in Israel
const sum = (o: Row = {}): VoiceSummary => parseVoiceSummary(JSON.stringify({
  dog_name: "רקס", dog_breed: "לברדור", dog_age: "שנתיים", problem: "נובח על אורחים", city: "כפר סבא", neighborhood: "", urgency: "",
  promised: "נציגה תחזור בתוך כחצי שעה", next_step: "לחזור ולתאם אבחון", caller_seems_minor: false, dog_since: "", previous_training: "",
  trigger: "", urgency_level: "low", preferred_track: "", decision_maker: "", decision_maker_absent: false, objections: [], heard_from: "",
  needs_boarding_referral: false, travel_dates: "", recommended_step: "", caller_name: "דנה כהן", event_when: "", relevant: true, ...o,
}))!;
function call(o: Row = {}): Row {
  const row = {
    id: `call-${calls.length + 1}`, businessId: "b-alldog", providerConversationId: `conv-${calls.length + 1}`, leadId: null,
    callerPhoneNorm: "0541110001", outcome: null, startedAt: new Date("2026-11-22T07:57:00Z"), createdAt: new Date("2026-11-22T07:57:00Z"),
    durationSeconds: 139, salesBrief: null, leadMeetingId: null, summaryAttempts: 0, summaryCallLogId: null, summary: null,
    summaryNextAt: NOW, summaryLockedUntil: null, status: "ended",
    transcript: { turns: [{ role: "agent", message: "שלום, הגעתם ל-AllDog.", t: 0 }, { role: "user", message: "היי, רקס נובח על אורחים", t: 4 }], omittedTurns: 0, providerSummary: "ElevenLabs: the dog barks", terminationReason: null },
    ...o,
  };
  calls.push(row);
  return row;
}

beforeEach(() => {
  calls.length = leads.length = journal.length = events.length = repAlerts.length = ownerAlerts.length = 0;
  summarize.mockReset();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("the summary is always written", () => {
  it("save_details was NOT called: lead created with the name, city and dog the summary heard, task opened, journal line, rep alerted once", async () => {
    summarize.mockResolvedValue(sum());
    const c = call();
    expect(await processVoiceSummary(String(c.id), NOW)).toBe("done");
    expect(summarize).toHaveBeenCalledWith("voice", expect.stringContaining("מתקשר: היי, רקס נובח על אורחים"));
    expect(leads).toEqual([{ id: "lead-1", phone: "0541110001", name: "דנה כהן", city: "כפר סבא", dog: "רקס" }]);
    expect(events).toEqual(["lead-created", "task"]);
    expect(c.outcome).toBe("hung_up_early");
    expect(journal).toHaveLength(1);
    expect(String(journal[0].summary).split("\n")).toEqual([
      "[שיחת טלפון · אלירן, סוכן קולי] סיכום שיחה (22/11 09:57 · 2:19 דק׳)",
      "כלב: רקס · לברדור · שנתיים · עיר: כפר סבא",
      "בעיה: נובח על אורחים · דחיפות: (נמוכה)",
      "הובטח: נציגה תחזור בתוך כחצי שעה · הצעד הבא: לחזור ולתאם אבחון",
      "תוצאה: השיחה הסתיימה בלי שנאספו פרטים · לחזור טלפונית: היום עד 10:27",
    ]);
    expect(c.summary).toBe(journal[0].summary);
    expect(c.summaryNextAt).toBeNull();
    expect(repAlerts).toHaveLength(1);
    expect(repAlerts[0]).toMatchObject({ kind: "summary", leadId: "lead-1", displayName: "דנה כהן", phone: "0541110001", urgent: false, line: "נובח על אורחים · כלב: רקס · לברדור · שנתיים", dueLabel: "היום עד 10:27" });
  });

  it("save_details WAS called: the same journal line is replaced by the summary, empty lead fields are filled, no second task", async () => {
    summarize.mockResolvedValue(sum());
    leads.push({ id: "lead-1", phone: "0541110001", name: "שיחה מ-0541110001", city: null, dog: null });
    journal.push({ id: "log-1", leadId: "lead-1", summary: "[שיחת טלפון · אלירן, סוכן קולי] נאספו פרטים" });
    const c = call({ leadId: "lead-1", outcome: "details_only", summaryCallLogId: "log-1", salesBrief: { problem: "נביחות (מהכלי)" } });
    expect(await processVoiceSummary(String(c.id), NOW)).toBe("done");
    expect(journal).toHaveLength(1);
    expect(String(journal[0].summary)).toContain("סיכום שיחה (22/11 09:57 · 2:19 דק׳)");
    expect(String(journal[0].summary)).toContain("תוצאה: נאספו פרטים · לחזור טלפונית: היום עד 10:27");
    expect(leads[0]).toMatchObject({ name: "דנה כהן", city: "כפר סבא", dog: "רקס" });
    expect(events).toEqual([]); // no new lead, no new task
    expect((c.salesBrief as Row).problem).toBe("נביחות (מהכלי)"); // what the tool sent wins
    expect((c.salesBrief as Row).city).toBe("כפר סבא");
    expect(repAlerts).toHaveLength(1);
  });

  it("a second run on a finished call does nothing (no second line, no second alert)", async () => {
    summarize.mockResolvedValue(sum());
    const c = call();
    await processVoiceSummary(String(c.id), NOW);
    expect(await processVoiceSummary(String(c.id), NOW, { force: true })).toBe("skipped");
    expect(journal).toHaveLength(1);
    expect(repAlerts).toHaveLength(1);
  });

  it("a lead that also has a WhatsApp summary keeps it: the voice summary is a line of its own", async () => {
    summarize.mockResolvedValue(sum());
    leads.push({ id: "lead-1", phone: "0541110001", name: "דנה כהן", city: "כפר סבא", dog: "רקס" });
    journal.push({ id: "log-wa", leadId: "lead-1", summary: "[וואטסאפ · בוט] סיכום שיחה (20/11 18:02)\nכלב: רקס" });
    const c = call({ leadId: "lead-1", outcome: "details_only" });
    await processVoiceSummary(String(c.id), NOW);
    expect(journal).toHaveLength(2);
    expect(journal[0].summary).toBe("[וואטסאפ · בוט] סיכום שיחה (20/11 18:02)\nכלב: רקס");
    expect(String(journal[1].summary).startsWith("[שיחת טלפון · אלירן, סוכן קולי] סיכום שיחה")).toBe(true);
  });
});

describe("urgent", () => {
  it("the call ended without save_details and the summary finds a bite → URGENT task + the urgent alerts at once, then the summary alert", async () => {
    summarize.mockResolvedValue(sum({ urgency: "הכלב נשך את הבן ביד", urgency_level: "high", event_when: "אתמול בערב" }));
    const c = call();
    await processVoiceSummary(String(c.id), NOW);
    expect(events).toEqual(["lead-created", "task-urgent", "urgent-alerts"]);
    expect(c.outcome).toBe("urgent");
    expect(String(journal[0].summary)).toContain("מתי קרה: אתמול בערב");
    expect(String(journal[0].summary)).toContain("תוצאה: דחוף · לחזור טלפונית: היום עד 10:27");
    expect(repAlerts[0]).toMatchObject({ kind: "summary", urgent: true });
  });
  it("save_details ran without the urgent flag, the summary finds it → the task becomes urgent and the alerts go out", async () => {
    summarize.mockResolvedValue(sum({ urgency: "נשך ילד", urgency_level: "high" }));
    leads.push({ id: "lead-1", phone: "0541110001", name: "דנה כהן", city: null, dog: null });
    const c = call({ leadId: "lead-1", outcome: "details_only" });
    await processVoiceSummary(String(c.id), NOW);
    expect(events).toEqual(["task-urgent", "urgent-alerts"]);
    expect(c.outcome).toBe("urgent");
  });
  it("save_details already flagged it → not alerted as urgent a second time by the job", async () => {
    summarize.mockResolvedValue(sum({ urgency: "נשך ילד", urgency_level: "high" }));
    leads.push({ id: "lead-1", phone: "0541110001", name: "דנה כהן", city: null, dog: null });
    const c = call({ leadId: "lead-1", outcome: "urgent" });
    await processVoiceSummary(String(c.id), NOW);
    expect(events).toEqual([]);
  });
});

describe("calls nobody can or should return", () => {
  it("hidden number, no number left: no lead, no task — the rep AND Or still hear about it, with the summary line", async () => {
    summarize.mockResolvedValue(sum());
    const c = call({ callerPhoneNorm: null });
    expect(await processVoiceSummary(String(c.id), NOW)).toBe("done");
    expect(leads).toHaveLength(0);
    expect(events).toEqual([]);
    expect(journal).toHaveLength(0);
    expect(String(c.summary)).toContain("תוצאה: מספר חסוי · אין למי לחזור");
    expect(repAlerts[0]).toMatchObject({ leadId: null, phone: null, displayName: "מתקשר לא מזוהה", line: "נובח על אורחים · כלב: רקס · לברדור · שנתיים", dueLabel: null });
    expect(ownerAlerts).toHaveLength(1);
  });
  it("not about the caller's dog (supplier / wrong number): no lead, no task, no alert", async () => {
    summarize.mockResolvedValue(sum({ relevant: false, problem: "", dog_name: "" }));
    const c = call();
    await processVoiceSummary(String(c.id), NOW);
    expect(leads).toHaveLength(0);
    expect(events).toEqual([]);
    expect(c.outcome).toBe("not_relevant");
    expect(repAlerts).toHaveLength(0);
  });
  it("the caller said nothing in a short call: no Claude call, no lead, no alert", async () => {
    const c = call({ durationSeconds: 6, transcript: { turns: [{ role: "agent", message: "שלום", t: 0 }], omittedTurns: 0, providerSummary: null, terminationReason: null } });
    expect(await processVoiceSummary(String(c.id), NOW)).toBe("done");
    expect(summarize).not.toHaveBeenCalled();
    expect(leads).toHaveLength(0);
    expect(repAlerts).toHaveLength(0);
  });
});

describe("the summary failed", () => {
  it("first failure: the lead + task are NOT held back, the rep is alerted now (ElevenLabs' line), and a retry is scheduled", async () => {
    summarize.mockRejectedValue(new Error("overloaded"));
    const c = call();
    expect(await processVoiceSummary(String(c.id), NOW)).toBe("retry");
    expect(events).toEqual(["lead-created", "task"]);
    expect(repAlerts).toHaveLength(1);
    expect(repAlerts[0].line).toBe("ElevenLabs: the dog barks");
    expect(c.summary).toBeNull();
    expect((c.summaryNextAt as Date).getTime() - NOW.getTime()).toBe(3 * 60 * 1000);
    expect(journal).toHaveLength(0);
  });
  it("final failure: ElevenLabs' own summary is written to the journal, marked as such, and Or is alerted", async () => {
    summarize.mockResolvedValue(null);
    const c = call({ summaryAttempts: 4 });
    expect(await processVoiceSummary(String(c.id), NOW)).toBe("final");
    expect(String(journal[0].summary)).toContain("ElevenLabs: the dog barks");
    expect(String(journal[0].summary)).toContain("הסיכום הרגיל נכשל");
    expect(events).toContain("failure-alert");
    expect(c.summaryNextAt).toBeNull();
  });
});
