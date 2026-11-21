/**
 * AllDog voice agent — the four endpoints, called as ElevenLabs calls them (Or, 21/11/2026):
 *   no auth / wrong secret / flag off · a hidden caller id · a second call from the same number ·
 *   an end-of-call webhook with a wrong signature · the callback target · the rep's alert.
 * The routes and the voice-agent code are real; the DB and the lead service are small in-memory fakes
 * (the real upsertLeadFromContact is exercised against Postgres in the local end-to-end run).
 */
import { createHmac } from "crypto";

// ── in-memory state ──────────────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;
const db = { calls: [] as Row[], leads: [] as Row[], tasks: [] as Row[], logs: [] as Row[], notifications: [] as Row[] };
const sent = { rep: [] as Row[], owner: [] as Row[], newLead: [] as Row[], failures: [] as Row[] };
const pending: Promise<unknown>[] = [];
let seq = 0;
const id = (p: string) => `${p}-${++seq}`;

jest.mock("@/lib/wait-until", () => ({
  runAfterResponse: (p: Promise<unknown>) => { pending.push(p.catch((e) => { throw e; })); return Promise.resolve(); },
}));
jest.mock("@/lib/rate-limit", () => {
  const claimed = new Set<string>();
  return { claimOnce: async (k: string) => (claimed.has(k) ? false : (claimed.add(k), true)), releaseClaim: async () => undefined, __claimed: claimed };
});
jest.mock("@/lib/notify-owner", () => ({ notifyOwnerAllDog: async (p: Row) => { sent.owner.push(p); } }));
jest.mock("@/lib/lead-alert", () => ({ alertNewLeadIfEnabled: async (_b: string, lead: Row, opts: Row) => { sent.newLead.push({ ...lead, opts }); } }));
jest.mock("@/lib/alldog/failure-alerts", () => ({ alertAllDogFailure: async (p: Row) => { sent.failures.push(p); }, FAILURE_KIND_TITLES: {} }));
jest.mock("@/lib/whatsapp-template-chain", () => ({ sendWithTemplateChain: async (p: Row) => { sent.rep.push(p); return { success: true, via: "template" }; } }));
jest.mock("@/lib/alldog/voice-agent/after-booking", () => ({ afterSalesCallBooked: async () => undefined }));
jest.mock("@/lib/alldog/voice-agent/summary-job", () => ({ processVoiceSummary: jest.fn(async () => "done") }));
jest.mock("@/lib/alldog/voice-agent/end-rules", () => ({ ...jest.requireActual("@/lib/alldog/voice-agent/end-rules"), SUMMARY_FIRST_DELAY_MS: 0 }));
jest.mock("@/services/clients", () => ({ findCustomersByPhone: async () => [], updateLead: async () => undefined }));
jest.mock("@/lib/alldog/leads", () => {
  const norm = (raw: string) => {
    let d = raw.replace(/\D/g, "");
    if (d.startsWith("972")) d = `0${d.slice(3)}`;
    return d;
  };
  return {
    localPhone: norm,
    appUrl: () => "https://petra-app.com",
    isPlaceholderLeadName: (n: string | null) => !n || /^שיחה מ-/.test(n) || /^[\d\s+\-()]+$/.test(n),
    resolveLeadForContact: async (_b: string, phone: string) => ({ active: db.leads.find((l) => l.phone === norm(phone)) ?? null, previous: null }),
    // Same contract as the real one: one lead per phone, fill EMPTY fields only.
    upsertLeadFromContact: async (i: { phone: string; name?: string | null; placeholderName: string; city?: string | null; source: string }) => {
      const phone = norm(i.phone);
      const existing = db.leads.find((l) => l.phone === phone);
      if (existing) {
        if (i.name && /^שיחה מ-/.test(String(existing.name))) existing.name = i.name;
        if (i.city && !existing.city) existing.city = i.city;
        return { leadId: existing.id, created: false };
      }
      const lead = { id: id("lead"), phone, name: i.name || i.placeholderName, city: i.city ?? null, source: i.source, stage: "new", customerId: null, notes: null };
      db.leads.push(lead);
      return { leadId: lead.id, created: true };
    },
    createLeadTask: async (businessId: string, leadId: string, t: Row) => {
      const task = { id: id("task"), businessId, relatedEntityType: "LEAD", relatedEntityId: leadId, status: "OPEN", ...t };
      db.tasks.push(task);
      return task;
    },
    addLeadCallLog: async (leadId: string, summary: string) => { const log = { id: id("log"), leadId, summary }; db.logs.push(log); return log; },
    updateLeadCallLog: async () => undefined,
  };
});
jest.mock("@/lib/prisma", () => {
  const match = (row: Row, where: Row) => Object.entries(where).every(([k, v]) => (v && typeof v === "object" ? true : row[k] === v));
  const voiceAgentCall = {
    upsert: async ({ where, create }: { where: Row; create: Row }) => {
      const found = db.calls.find((c) => c.providerConversationId === where.providerConversationId);
      if (found) return found;
      const row = { id: id("call"), leadId: null, leadMeetingId: null, outcome: null, summaryCallLogId: null, summary: null, summaryNextAt: null, summaryAttempts: 0, ...create };
      db.calls.push(row);
      return row;
    },
    findUnique: async ({ where }: { where: Row }) => db.calls.find((c) => match(c, where)) ?? null,
    findUniqueOrThrow: async ({ where }: { where: Row }) => db.calls.find((c) => match(c, where))!,
    update: async ({ where, data }: { where: Row; data: Row }) => Object.assign(db.calls.find((c) => match(c, where))!, data),
    updateMany: async ({ where, data }: { where: Row; data: Row }) => { const r = db.calls.filter((c) => match(c, where)); r.forEach((c) => Object.assign(c, data)); return { count: r.length }; },
    create: async ({ data }: { data: Row }) => { const row = { id: id("call"), ...data }; db.calls.push(row); return row; },
  };
  const p = {
    voiceAgentCall,
    lead: { findFirst: async ({ where }: { where: Row }) => db.leads.find((l) => l.id === where.id) ?? null },
    leadMeeting: { findMany: async () => [], findFirst: async () => null },
    task: {
      findFirst: async ({ where }: { where: Row }) => db.tasks.find((t) => t.relatedEntityId === where.relatedEntityId && t.status === "OPEN") ?? null,
      updateMany: async ({ where, data }: { where: Row; data: Row }) => { const r = db.tasks.filter((t) => t.id === where.id); r.forEach((t) => Object.assign(t, data)); return { count: r.length }; },
    },
    businessUser: { findFirst: async () => ({ id: "bu-1" }) },
    notification: { create: async ({ data }: { data: Row }) => { db.notifications.push(data); return data; } },
  };
  return { __esModule: true, default: p, prisma: p };
});

import { NextRequest } from "next/server";
import { POST as startPOST } from "@/app/api/webhooks/alldog-voice/start/route";
import { POST as detailsPOST } from "@/app/api/webhooks/alldog-voice/details/route";
import { POST as bookPOST } from "@/app/api/webhooks/alldog-voice/book/route";
import { POST as endPOST } from "@/app/api/webhooks/alldog-voice/end/route";
import { POST as initPOST } from "@/app/api/webhooks/alldog-voice/init/route";
import { EMPTY_INIT_VARIABLES, withBudget } from "@/lib/alldog/voice-agent/init";
import { processVoiceSummary } from "@/lib/alldog/voice-agent/summary-job";
import { callbackDueAt, callbackDueLabel } from "@/lib/alldog/voice-agent/booking-rules";
import { repAlertText } from "@/lib/alldog/voice-agent/rep-alert";
import { israelInstant } from "@/lib/alldog/time";

const SECRET = "tool-secret-for-tests";
const WEBHOOK_SECRET = "wsec-for-tests";
const ENV = [
  "ALLDOG_BUSINESS_ID", "ALLDOG_VOICE_AGENT_ENABLED", "ALLDOG_VOICE_AGENT_SECRET", "ALLDOG_VOICE_WEBHOOK_SECRET",
  "ALLDOG_VOICE_AGENT_ID", "ALLDOG_SALES_REP_USER_ID", "ALLDOG_SALES_REP_PHONE",
] as const;
const saved: Record<string, string | undefined> = {};
beforeAll(() => ENV.forEach((k) => (saved[k] = process.env[k])));
afterAll(() => ENV.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]))));

beforeEach(() => {
  Object.values(db).forEach((a) => (a.length = 0));
  Object.values(sent).forEach((a) => (a.length = 0));
  pending.length = 0;
  (jest.requireMock("@/lib/rate-limit") as { __claimed: Set<string> }).__claimed.clear();
  (processVoiceSummary as jest.Mock).mockClear();
  process.env.ALLDOG_BUSINESS_ID = "b-alldog";
  process.env.ALLDOG_VOICE_AGENT_ENABLED = "true";
  process.env.ALLDOG_VOICE_AGENT_SECRET = SECRET;
  process.env.ALLDOG_VOICE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.ALLDOG_SALES_REP_USER_ID = "user-racheli";
  process.env.ALLDOG_SALES_REP_PHONE = "0501112233";
  delete process.env.ALLDOG_VOICE_AGENT_ID;
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const tool = (path: string, body: unknown, auth: string | null = `Bearer ${SECRET}`) =>
  new NextRequest(`https://petra-app.com/api/webhooks/alldog-voice/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(body),
  });
const settle = async () => { await Promise.all(pending.splice(0)); };

describe("a call without authentication", () => {
  const body = { conversationId: "conv-1", callerPhone: "+972541110001", fullName: "דנה" };
  it.each([
    ["start", startPOST], ["details", detailsPOST], ["book", bookPOST],
  ] as const)("/%s: no header, a wrong secret or another auth scheme → 401, nothing stored", async (path, handler) => {
    for (const auth of [null, "Bearer wrong-secret", "wrong-secret", `${SECRET}x`, `Basic ${SECRET}`]) {
      const res = await handler(tool(path, { ...body, startsAt: "2026-11-22T08:00:00.000Z" }, auth));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    }
    expect(db.calls).toHaveLength(0);
    expect(db.leads).toHaveLength(0);
  });
  it("the flag off → 404 on all four, even with the right secret", async () => {
    delete process.env.ALLDOG_VOICE_AGENT_ENABLED;
    for (const [path, handler] of [["start", startPOST], ["details", detailsPOST], ["book", bookPOST], ["end", endPOST]] as const) {
      expect((await handler(tool(path, body))).status).toBe(404);
    }
    expect(db.calls).toHaveLength(0);
  });
  it("no secret configured → off (404): the tools never run open", async () => {
    delete process.env.ALLDOG_VOICE_AGENT_SECRET;
    expect((await detailsPOST(tool("details", body, null))).status).toBe(404);
  });
  it("a broken body → 400, nothing stored", async () => {
    expect((await detailsPOST(tool("details", { fullName: "דנה" }))).status).toBe(400); // no conversationId
    expect(db.leads).toHaveLength(0);
  });
});

describe("/start — what goes back to the agent", () => {
  it("a new caller → not known, nothing about anyone", async () => {
    const res = await startPOST(tool("start", { conversationId: "conv-1", callerPhone: "+972541110001" }));
    expect(await res.json()).toEqual({ known: false, isCustomer: false, firstName: null, dogName: null, city: null, upcomingMeeting: null });
  });
  it("a known lead → first name, dog and city only (no stage, summary, history, phone)", async () => {
    db.leads.push({ id: "lead-x", phone: "0541110001", name: "דנה כהן", city: "כפר סבא", stage: "s1", notes: "פרטי הכלב:\nשם: רקס\nגזע: לברדור", customerId: null });
    const json = await (await startPOST(tool("start", { conversationId: "conv-1", callerPhone: "+972541110001" }))).json();
    expect(json).toMatchObject({ known: true, isCustomer: false, firstName: "דנה", city: "כפר סבא" });
    expect(Object.keys(json).sort()).toEqual(["city", "dogName", "firstName", "isCustomer", "known", "upcomingMeeting"]);
    expect(JSON.stringify(json)).not.toContain("כהן");
  });
  it("a hidden caller id (missing / empty / 'anonymous') → not known, no lookup by phone", async () => {
    db.leads.push({ id: "lead-x", phone: "", name: "מישהו", city: null, stage: "s1", notes: null, customerId: null });
    for (const callerPhone of [undefined, "", "anonymous", "Restricted"]) {
      const json = await (await startPOST(tool("start", { conversationId: `c-${callerPhone}`, callerPhone }))).json();
      expect(json).toMatchObject({ known: false, firstName: null });
    }
  });
});

describe("/start — the answer does not wait for the call record", () => {
  /** Makes the call-row write hang until released, like a slow database. */
  function holdCallWrites() {
    const prisma = (jest.requireMock("@/lib/prisma") as { default: { voiceAgentCall: { upsert: (a: unknown) => Promise<unknown> } } }).default;
    const real = prisma.voiceAgentCall.upsert;
    let release = () => {};
    const gate = new Promise<void>((r) => (release = r));
    prisma.voiceAgentCall.upsert = async (a: unknown) => { await gate; return real(a); };
    return { release, restore: () => { prisma.voiceAgentCall.upsert = real; } };
  }

  it("the answer comes back while the call-row write is still hanging; the row and its lead link are written after it", async () => {
    db.leads.push({ id: "lead-x", phone: "0541110001", name: "דנה כהן", city: "כפר סבא", stage: "s1", notes: null, customerId: null });
    const hold = holdCallWrites();
    try {
      const res = await startPOST(tool("start", { conversationId: "conv-1", callerPhone: "+972541110001", externalCallId: "sip-1" }));
      expect((await res.json()).firstName).toBe("דנה");
      expect(db.calls).toHaveLength(0); // the caller already has the answer
      hold.release();
      await settle();
    } finally {
      hold.restore();
    }
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0]).toMatchObject({ providerConversationId: "conv-1", callerPhoneNorm: "0541110001", externalCallId: "sip-1", leadId: "lead-x" });
  });
  it("a failure while recording the call never reaches the caller", async () => {
    const prisma = (jest.requireMock("@/lib/prisma") as { default: { voiceAgentCall: { upsert: unknown } } }).default;
    const upsert = prisma.voiceAgentCall.upsert;
    prisma.voiceAgentCall.upsert = async () => { throw new Error("db down"); };
    try {
      const res = await startPOST(tool("start", { conversationId: "conv-1", callerPhone: "+972541110001" }));
      expect(res.status).toBe(200);
      await Promise.allSettled(pending.splice(0));
    } finally {
      prisma.voiceAgentCall.upsert = upsert;
    }
  });
});

describe("/init — the ElevenLabs conversation-initiation webhook", () => {
  // The body exactly as the ElevenLabs docs show it (+ call_id on SIP calls).
  const body = (o: Record<string, unknown> = {}) => ({
    caller_id: "+972541110001", agent_id: "agent-eliran", called_number: "+97237386160", call_sid: "", conversation_id: "conv-init-1", call_id: "sip-call-1", ...o,
  });
  const init = (b: unknown, auth: string | null = SECRET) =>
    new NextRequest("https://petra-app.com/api/webhooks/alldog-voice/init", {
      method: "POST", headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
      body: typeof b === "string" ? b : JSON.stringify(b),
    });
  const EMPTY = { type: "conversation_initiation_client_data", dynamic_variables: { known: false, is_customer: false, first_name: "", dog_name: "", city: "", upcoming_meeting: "" } };
  const knownLead = () => db.leads.push({ id: "lead-x", phone: "0541110001", name: "דנה כהן", city: "כפר סבא", stage: "s1", notes: "פרטי הכלב:\nשם: רקס", customerId: null });

  it("a known caller → the six variables, first name only", async () => {
    knownLead();
    const res = await initPOST(init(body()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.type).toBe("conversation_initiation_client_data");
    expect(json.dynamic_variables).toMatchObject({ known: true, is_customer: false, first_name: "דנה", city: "כפר סבא", upcoming_meeting: "" });
    expect(Object.keys(json.dynamic_variables).sort()).toEqual(Object.keys(EMPTY_INIT_VARIABLES).sort());
    expect(JSON.stringify(json)).not.toContain("כהן");
  });
  it("a new caller → every variable is still there: false / empty strings, never null", async () => {
    const json = await (await initPOST(init(body({ caller_id: "+972549990000" })))).json();
    expect(json).toEqual(EMPTY);
    expect(Object.values(json.dynamic_variables).every((v) => v !== null && v !== undefined)).toBe(true);
  });
  it("the secret is accepted as the bare header value and as 'Bearer <secret>'", async () => {
    knownLead();
    for (const auth of [SECRET, `Bearer ${SECRET}`]) {
      expect((await (await initPOST(init(body(), auth))).json()).dynamic_variables.known).toBe(true);
    }
  });
  it("no secret / a wrong secret → still 200 so the call starts, but nothing about the caller, no lookup, and Or is alerted", async () => {
    knownLead();
    for (const auth of [null, "wrong", "Bearer wrong"]) {
      const res = await initPOST(init(body(), auth));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(EMPTY);
    }
    await settle();
    expect(db.calls).toHaveLength(0);
    expect(sent.failures).toHaveLength(3);
  });
  it("the flag off → 200 with the empty set (a 404 here could stop real calls from starting)", async () => {
    knownLead();
    delete process.env.ALLDOG_VOICE_AGENT_ENABLED;
    const res = await initPOST(init(body()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(EMPTY);
    await settle();
    expect(db.calls).toHaveLength(0);
    expect(sent.failures).toHaveLength(0);
  });
  it("a hidden caller id, a broken body or no body → 200 with the empty set", async () => {
    knownLead();
    for (const b of [body({ caller_id: "anonymous" }), body({ caller_id: "" }), "not json", "[]", "null"]) {
      const res = await initPOST(init(b));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(EMPTY);
    }
  });
  it("a call of another agent → the empty set", async () => {
    knownLead();
    process.env.ALLDOG_VOICE_AGENT_ID = "agent-eliran";
    expect((await (await initPOST(init(body({ agent_id: "agent-other" })))).json())).toEqual(EMPTY);
    expect((await (await initPOST(init(body()))).json()).dynamic_variables.known).toBe(true);
  });
  it("the lookup throws → 200 with the empty set, and Or is alerted", async () => {
    const leads = jest.requireMock("@/lib/alldog/leads") as { resolveLeadForContact: unknown };
    const real = leads.resolveLeadForContact;
    leads.resolveLeadForContact = async () => { throw new Error("db down"); };
    try {
      const res = await initPOST(init(body()));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(EMPTY);
      await Promise.allSettled(pending.splice(0));
      expect(sent.failures).toHaveLength(1);
    } finally {
      leads.resolveLeadForContact = real;
    }
  });
  it("the call row is written after the response, with the SIP call id and the lead", async () => {
    knownLead();
    const res = await initPOST(init(body()));
    expect((await res.json()).dynamic_variables.known).toBe(true);
    await settle();
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0]).toMatchObject({ providerConversationId: "conv-init-1", callerPhoneNorm: "0541110001", externalCallId: "sip-call-1", leadId: "lead-x" });
  });
  it("the time budget: a slow lookup gives the fallback, a fast one its value, a failing one the fallback", async () => {
    jest.useFakeTimers();
    try {
      const slow = withBudget(new Promise<string>((r) => setTimeout(() => r("late"), 5000)), 2000, "fallback");
      jest.advanceTimersByTime(2000);
      expect(await slow).toEqual({ value: "fallback", timedOut: true });
    } finally {
      jest.useRealTimers();
    }
    expect(await withBudget(Promise.resolve("fast"), 2000, "fallback")).toEqual({ value: "fast", timedOut: false });
    expect(await withBudget(Promise.reject(new Error("x")), 2000, "fallback")).toEqual({ value: "fallback", timedOut: false });
  });
});

describe("/details — a hidden caller id", () => {
  it("no caller id and no number said → phone_required, no lead, no task", async () => {
    const res = await detailsPOST(tool("details", { conversationId: "conv-h", callerPhone: "anonymous", fullName: "דנה", problem: "נובח" }));
    expect(await res.json()).toEqual({ status: "phone_required" });
    await settle();
    expect(db.leads).toHaveLength(0);
    expect(db.tasks).toHaveLength(0);
  });
  it("the number the caller said aloud (callbackPhone) → saved under that number", async () => {
    const res = await detailsPOST(tool("details", { conversationId: "conv-h", fullName: "דנה", callbackPhone: "054-111-0002" }));
    expect(await res.json()).toEqual({ status: "saved" });
    await settle();
    expect(db.leads.map((l) => l.phone)).toEqual(["0541110002"]);
    expect(db.calls[0].callerPhoneNorm).toBe("0541110002");
    expect(db.tasks).toHaveLength(1);
  });
});

describe("/details — every field but the phone may be missing", () => {
  it("only the conversation id and the caller id → saved, with a placeholder name", async () => {
    expect(await (await detailsPOST(tool("details", { conversationId: "conv-1", callerPhone: "+972541110001" }))).json()).toEqual({ status: "saved" });
    await settle();
    expect(db.leads[0].name).toBe("שיחה מ-0541110001");
  });
  it("nulls and empty strings are accepted", async () => {
    const res = await detailsPOST(tool("details", { conversationId: "conv-1", callerPhone: "+972541110001", fullName: null, city: "", dogName: null, age: "", breed: null, problem: "", urgent: null, urgentReason: null, eventWhen: null }));
    expect(res.status).toBe(200);
  });
});

describe("two calls from the same number", () => {
  it("one lead, one open callback task — the second call fills what was empty", async () => {
    await detailsPOST(tool("details", { conversationId: "conv-1", callerPhone: "+972541110001", problem: "נובח על אורחים" }));
    await settle();
    await detailsPOST(tool("details", { conversationId: "conv-2", callerPhone: "054-1110001", fullName: "דנה כהן", city: "כפר סבא" }));
    await settle();
    expect(db.calls).toHaveLength(2);
    expect(db.leads).toHaveLength(1);
    expect(db.leads[0]).toMatchObject({ phone: "0541110001", name: "דנה כהן", city: "כפר סבא" });
    expect(db.tasks.filter((t) => t.status === "OPEN")).toHaveLength(1);
    expect(sent.newLead).toHaveLength(1); // the "new lead" alert only once
    // …and its bell skips the sales rep: she gets the bell with the summary instead.
    expect(sent.newLead[0].opts).toEqual({ skipBellUserIds: ["user-racheli"] });
    expect(new Set(db.calls.map((c) => c.leadId)).size).toBe(1);
  });
  it("a second call that is urgent → the same task becomes URGENT and its description opens with the reason", async () => {
    await detailsPOST(tool("details", { conversationId: "conv-1", callerPhone: "+972541110001", problem: "עושה צרכים בבית" }));
    await settle();
    await detailsPOST(tool("details", { conversationId: "conv-2", callerPhone: "+972541110001", urgent: true, urgentReason: "נשך אורח", eventWhen: "לפני שעתיים" }));
    await settle();
    expect(db.tasks).toHaveLength(1);
    expect(db.tasks[0]).toMatchObject({ priority: "URGENT" });
    const description = String(db.tasks[0].description);
    expect(description.startsWith("דחוף: נשך אורח · מתי: לפני שעתיים\n")).toBe(true);
    expect(description).toContain("עושה צרכים בבית"); // what the first call wrote stays
  });
  it("the same tool call repeated (same conversation) → still one lead, one task, one journal line", async () => {
    const body = { conversationId: "conv-1", callerPhone: "+972541110001", fullName: "דנה" };
    await detailsPOST(tool("details", body));
    await settle();
    await detailsPOST(tool("details", body));
    await settle();
    expect(db.calls).toHaveLength(1);
    expect(db.leads).toHaveLength(1);
    expect(db.tasks).toHaveLength(1);
    expect(db.logs).toHaveLength(1);
  });
});

describe("the callback task and the urgent alerts", () => {
  it("the task's target is a time (30 minutes / next opening), and the caller's promise is written in it", async () => {
    await detailsPOST(tool("details", { conversationId: "conv-1", callerPhone: "+972541110001", fullName: "דנה", problem: "נובח" }));
    await settle();
    const task = db.tasks[0];
    expect(task.dueAt).toBeInstanceOf(Date);
    expect(task.dueDate).toBeUndefined();
    expect(task.priority).toBe("HIGH");
    expect(String(task.description)).toContain("הובטח ללקוח שיחזרו אליו");
    expect(db.calls[0].outcome).toBe("details_only");
    // A regular call: the rep is alerted later, with the summary — not from the tool call.
    expect(sent.rep).toHaveLength(0);
    expect(db.notifications).toHaveLength(0);
  });
  it("urgent → URGENT task, the owner alert and the rep's bell + WhatsApp at once, with when it happened", async () => {
    await detailsPOST(tool("details", { conversationId: "conv-1", callerPhone: "+972541110001", fullName: "דנה", urgent: true, urgentReason: "הכלב נשך את הבן ביד", eventWhen: "אתמול בערב" }));
    await settle();
    expect(db.tasks[0]).toMatchObject({ priority: "URGENT" });
    expect(String(db.tasks[0].title).startsWith("דחוף: ")).toBe(true);
    expect(String(db.tasks[0].description)).toContain("מתי: אתמול בערב");
    expect(db.calls[0].outcome).toBe("urgent");
    expect(sent.owner).toHaveLength(1);
    expect(db.notifications).toHaveLength(1);
    expect(db.notifications[0]).toMatchObject({ userId: "user-racheli", actionUrl: `/leads?lead=${db.leads[0].id}` });
    expect(String(db.notifications[0].title).startsWith("דחוף: ")).toBe(true);
    expect(sent.rep).toHaveLength(1);
    expect(sent.rep[0]).toMatchObject({ to: "972501112233", templateOnly: true, context: "voice_rep_alert" });
    // Repeating the tool call does not alert twice.
    await detailsPOST(tool("details", { conversationId: "conv-1", callerPhone: "+972541110001", urgent: true, urgentReason: "נשך" }));
    await settle();
    expect(sent.owner).toHaveLength(1);
    expect(sent.rep).toHaveLength(1);
  });
  it("30 minutes for a call between 09:00 and 16:30 (Sun–Thu); any other call → the next workday at 09:30", () => {
    const due = (ymd: string, hhmm: string) => callbackDueAt(israelInstant(ymd, hhmm)).toISOString();
    const at = (ymd: string, hhmm: string) => israelInstant(ymd, hhmm).toISOString();
    // 22/11/2026 is a Sunday.
    expect(due("2026-11-22", "09:00")).toBe(at("2026-11-22", "09:30")); // the first minute of the day
    expect(due("2026-11-22", "09:49")).toBe(at("2026-11-22", "10:19"));
    expect(due("2026-11-22", "16:30")).toBe(at("2026-11-22", "17:00")); // the last call returned the same day
    expect(due("2026-11-22", "16:31")).toBe(at("2026-11-23", "09:30")); // after 16:30 → the next morning, never after closing
    expect(due("2026-11-22", "16:59")).toBe(at("2026-11-23", "09:30"));
    expect(due("2026-11-22", "08:10")).toBe(at("2026-11-22", "09:30")); // before opening → the same day
    expect(due("2026-11-22", "17:00")).toBe(at("2026-11-23", "09:30")); // closed → Monday
    expect(due("2026-11-25", "22:15")).toBe(at("2026-11-26", "09:30")); // Wednesday night → Thursday
    expect(due("2026-11-26", "16:30")).toBe(at("2026-11-26", "17:00")); // Thursday, still in time
    expect(due("2026-11-26", "16:45")).toBe(at("2026-11-29", "09:30")); // Thursday after 16:30 → Sunday
    expect(due("2026-11-26", "17:01")).toBe(at("2026-11-29", "09:30")); // Thursday after closing → Sunday
    expect(due("2026-11-27", "10:00")).toBe(at("2026-11-29", "09:30")); // Friday is off, also in the morning
    expect(due("2026-11-28", "20:00")).toBe(at("2026-11-29", "09:30")); // Saturday night → Sunday
    expect(due("2026-11-21", "09:49")).toBe(at("2026-11-22", "09:30")); // Saturday → Sunday
  });
  it("summer time too: 09:30 Israel time on the next workday", () => {
    // 5/7/2026 is a Sunday (UTC+3).
    expect(callbackDueAt(israelInstant("2026-07-03", "12:00")).toISOString()).toBe("2026-07-05T06:30:00.000Z");
    expect(callbackDueAt(israelInstant("2026-07-05", "11:00")).toISOString()).toBe("2026-07-05T08:30:00.000Z");
  });
  it("the target in words", () => {
    const now = israelInstant("2026-11-22", "09:49");
    expect(callbackDueLabel(callbackDueAt(now), now)).toBe("היום עד 10:19");
    const early = israelInstant("2026-11-22", "07:30");
    expect(callbackDueLabel(callbackDueAt(early), early)).toBe("היום עד 09:30");
    const fri = israelInstant("2026-11-27", "10:00");
    expect(callbackDueLabel(callbackDueAt(fri), fri)).toBe("יום ראשון 29/11 עד 09:30");
  });
  it("the rep's alert text: who, the summary line, when to call back", () => {
    const base = { businessId: "b", conversationId: "c", kind: "summary" as const, leadId: "l1", displayName: "דנה כהן", phone: "0541110001", urgent: false, line: "נובח על אורחים · כלב: רקס", dueLabel: "היום עד 10:19" };
    expect(repAlertText(base)).toEqual({ title: "שיחת טלפון עם אלירן · דנה כהן", who: "דנה כהן · 0541110001", details: "נובח על אורחים · כלב: רקס · לחזור: היום עד 10:19" });
    expect(repAlertText({ ...base, urgent: true }).title).toBe("דחוף: שיחת טלפון עם אלירן · דנה כהן");
    expect(repAlertText({ ...base, phone: null, displayName: "מתקשר לא מזוהה", dueLabel: null, line: null })).toEqual({ title: "שיחת טלפון עם אלירן · מתקשר לא מזוהה", who: "מתקשר לא מזוהה · מספר חסוי, לא השאיר מספר", details: "הסיכום עוד לא מוכן" });
  });
});

describe("/end — the ElevenLabs webhook", () => {
  const payload = (conversationId = "conv-1") => JSON.stringify({
    type: "post_call_transcription",
    data: {
      conversation_id: conversationId, agent_id: "agent-eliran",
      transcript: [{ role: "agent", message: "שלום, הגעתם ל-AllDog." }, { role: "user", message: "היי, הכלב שלי נובח." }],
      metadata: { start_time_unix_secs: Math.floor(Date.now() / 1000) - 140, call_duration_secs: 139 },
      conversation_initiation_client_data: { dynamic_variables: { system__caller_id: "+972541110001" } },
      analysis: { transcript_summary: "The caller's dog barks." },
    },
  });
  const sign = (body: string, secret = WEBHOOK_SECRET, t = Math.floor(Date.now() / 1000)) => `t=${t},v0=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
  const hook = (body: string, signature: string | null) =>
    new NextRequest("https://petra-app.com/api/webhooks/alldog-voice/end", {
      method: "POST", headers: { "content-type": "application/json", ...(signature ? { "elevenlabs-signature": signature } : {}) }, body,
    });

  it("a wrong signature, a tampered body, an old timestamp or no header → 401, nothing stored, no summary, Or is alerted", async () => {
    const body = payload();
    const cases = [
      sign(body, "another-secret"),
      sign(`${body} `),                                           // signed over a different body
      sign(body, WEBHOOK_SECRET, Math.floor(Date.now() / 1000) - 31 * 60),
      "t=abc,v0=zz",
      null,
    ];
    for (const signature of cases) {
      const res = await endPOST(hook(body, signature));
      expect(res.status).toBe(401);
    }
    await settle();
    expect(db.calls).toHaveLength(0);
    expect(processVoiceSummary).not.toHaveBeenCalled();
    expect(sent.failures).toHaveLength(cases.length);
  });
  it("the webhook secret not configured → 503 (fail closed)", async () => {
    delete process.env.ALLDOG_VOICE_WEBHOOK_SECRET;
    const body = payload();
    expect((await endPOST(hook(body, sign(body)))).status).toBe(503);
    expect(db.calls).toHaveLength(0);
  });
  it("a valid signature → 200, the call stored with its transcript, and the summary started (also when no tool was called)", async () => {
    const body = payload();
    const res = await endPOST(hook(body, sign(body)));
    expect(res.status).toBe(200);
    await settle();
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0]).toMatchObject({ status: "ended", callerPhoneNorm: "0541110001", durationSeconds: 139 });
    expect(processVoiceSummary).toHaveBeenCalledWith(db.calls[0].id, expect.any(Date), { force: true });
  });
  it("after save_details: the same call row gets the transcript, and the summary still runs", async () => {
    await detailsPOST(tool("details", { conversationId: "conv-1", callerPhone: "+972541110001", fullName: "דנה" }));
    await settle();
    expect(db.calls[0].summaryCallLogId).toBeTruthy(); // the interim journal line
    const body = payload();
    expect((await endPOST(hook(body, sign(body)))).status).toBe(200);
    await settle();
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].summaryNextAt).toBeInstanceOf(Date);
    expect(processVoiceSummary).toHaveBeenCalledTimes(1);
  });
  it("a webhook of another agent / another event type → 200, ignored", async () => {
    process.env.ALLDOG_VOICE_AGENT_ID = "agent-other";
    const body = payload();
    expect(await (await endPOST(hook(body, sign(body)))).json()).toEqual({ ok: true, ignored: "other_agent" });
    const audio = JSON.stringify({ type: "post_call_audio", data: {} });
    expect(await (await endPOST(hook(audio, sign(audio)))).json()).toEqual({ ok: true, ignored: "post_call_audio" });
    expect(db.calls).toHaveLength(0);
  });
});
