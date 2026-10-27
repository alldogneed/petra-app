/**
 * PayCall missed call from a number that belongs to an existing customer → no new lead;
 * a note + a "לחזור ללקוח" task on the customer instead. Unknown number → lead as before.
 */

// ── In-memory stand-ins for Prisma and the customer services ──
const mockStore = {
  leads: [] as Array<{
    id: string; phone: string; name: string; stage: string; notes: string | null; customerId: string | null;
    createdAt: Date; lastContactedAt: Date | null; nextFollowUpAt: Date | null;
  }>,
  callLogs: [] as Array<{ leadId: string; summary: string }>,
  notes: [] as Array<{ customerId: string; description: string }>,
  tasks: [] as Array<{ id: string; title: string; priority: string; relatedEntityId: string; status: string; dueAt?: string }>,
  customers: [] as Array<{ id: string; name: string; phone: string }>,
};

jest.mock("@/lib/prisma", () => {
  const prisma = {
    lead: {
      findFirst: jest.fn(async ({ where }: { where: { phone: string } }) => {
        const l = mockStore.leads.find((x) => x.phone === where.phone);
        return l ? { ...l, callLogs: mockStore.callLogs.filter((c) => c.leadId === l.id) } : null;
      }),
      findMany: jest.fn(async ({ where }: { where: { phone: { endsWith: string } } }) =>
        mockStore.leads.filter((l) => l.phone.endsWith(where.phone.endsWith)).reverse()
      ),
      create: jest.fn(async ({ data }: { data: { phone: string; name: string; stage: string; notes: string } }) => {
        const lead = {
          id: `lead-${mockStore.leads.length + 1}`, phone: data.phone, name: data.name, stage: data.stage, notes: data.notes,
          customerId: null, createdAt: new Date("2026-10-23T07:15:00Z"), lastContactedAt: new Date("2026-10-23T07:15:00Z"), nextFollowUpAt: null,
        };
        mockStore.leads.push(lead);
        return lead;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: { notes?: string } }) => {
        const l = mockStore.leads.find((x) => x.id === where.id);
        if (l && data.notes !== undefined) l.notes = data.notes;
        return l;
      }),
    },
    leadStage: {
      findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.filter((id) => id === "stage-won" || id === "stage-lost").map((id) => ({ id }))
      ),
    },
    callLog: {
      findFirst: jest.fn(async ({ where }: { where: { summary: { contains: string } } }) => {
        const c = mockStore.callLogs.find((x) => x.summary.includes(where.summary.contains));
        return c ? { leadId: c.leadId } : null;
      }),
      create: jest.fn(async ({ data }: { data: { leadId: string; summary: string } }) => {
        mockStore.callLogs.push(data);
        return data;
      }),
      count: jest.fn(async () => 1),
    },
    timelineEvent: {
      findMany: jest.fn(async ({ where }: { where: { description: { contains: string } } }) =>
        mockStore.notes.filter((n) => n.description.includes(where.description.contains)).map((n) => ({ description: n.description }))
      ),
    },
    task: {
      findFirst: jest.fn(async ({ where }: { where: { relatedEntityId: string; title: { startsWith: string } } }) =>
        mockStore.tasks.find(
          (t) => t.relatedEntityId === where.relatedEntityId && t.status === "OPEN" && t.title.startsWith(where.title.startsWith)
        ) ?? null
      ),
    },
  };
  return { __esModule: true, default: prisma, prisma };
});
// The handled-call marker (27/10) is covered in paycall-handled-call.test.ts.
jest.mock("@/lib/rate-limit", () => ({ hasActiveClaim: async () => false, claimOnce: async () => true }));
jest.mock("@/lib/reminder-service", () => ({ scheduleLeadFollowup: jest.fn(async () => {}) }));
jest.mock("@/services/clients", () => ({
  findCustomersByPhone: jest.fn(async (_b: string, _db: unknown, phone: string) => {
    const digits = phone.replace(/\D/g, "");
    return mockStore.customers.filter((c) => c.phone.replace(/\D/g, "") === digits).map(({ id, name }) => ({ id, name }));
  }),
  addCustomerNote: jest.fn(async (_b: string, _db: unknown, customerId: string, note: string) => {
    mockStore.notes.push({ customerId, description: note });
    return { customerId, note };
  }),
  createTask: jest.fn(async (_b: string, _db: unknown, input: { title: string; priority: string; relatedEntityId: string; dueAt?: string }) => {
    const t = { id: `task-${mockStore.tasks.length + 1}`, status: "OPEN", ...input };
    mockStore.tasks.push(t);
    return t;
  }),
}));

import { processMissedCall, type PaycallCall } from "@/lib/paycall";
import { customerCallNote, logAnsweredCallOnCustomer } from "@/lib/paycall-customer";

const OLD_ENV = process.env;
beforeEach(() => {
  mockStore.leads.length = 0;
  mockStore.callLogs.length = 0;
  mockStore.notes.length = 0;
  mockStore.tasks.length = 0;
  mockStore.customers.length = 0;
  process.env = { ...OLD_ENV, PAYCALL_BUSINESS_ID: "biz-alldog\n", PAYCALL_NEW_LEAD_STAGE_ID: "stage-new" };
});
afterAll(() => {
  process.env = OLD_ENV;
});

const call = (id: string, callerId = "0526363171"): PaycallCall => ({
  ID: id,
  START: "2026-10-23 10:15:00",
  END: "2026-10-23 10:15:20",
  NAME: "AllDog",
  CALLERID: callerId,
  CALLEE: "0500000000",
  DISPOSITION: "NOANSWER",
  DURATION: "20",
  PR_NUMBER: "33818670",
  ANS_TIME: null,
});

describe("missed call from an existing customer", () => {
  beforeEach(() => {
    mockStore.customers.push({ id: "cust-1", name: "רונית לוי", phone: "052-6363171" });
  });

  it("logs a note + a normal-priority callback task on the customer — no lead", async () => {
    const r = await processMissedCall(call("9001"));
    expect(r).toEqual({ leadId: null, customerId: "cust-1", created: false, skipped: false });
    expect(mockStore.leads).toHaveLength(0);
    expect(mockStore.callLogs).toHaveLength(0);
    expect(mockStore.notes).toHaveLength(1);
    expect(mockStore.notes[0]).toMatchObject({ customerId: "cust-1" });
    expect(mockStore.notes[0].description).toContain("call_id:9001");
    expect(mockStore.notes[0].description).toContain("שיחה שלא נענתה");
    expect(mockStore.tasks).toHaveLength(1);
    expect(mockStore.tasks[0]).toMatchObject({ title: "לחזור ללקוח: רונית לוי", priority: "MEDIUM", relatedEntityId: "cust-1" });
  });

  it("the same call twice is logged once", async () => {
    await processMissedCall(call("9001"));
    const again = await processMissedCall(call("9001"));
    expect(again).toEqual({ leadId: null, customerId: "cust-1", created: false, skipped: true });
    expect(mockStore.notes).toHaveLength(1);
    expect(mockStore.tasks).toHaveLength(1);
  });

  it("a second missed call adds a note but not a second open callback task", async () => {
    await processMissedCall(call("9001"));
    await processMissedCall(call("9002"));
    expect(mockStore.notes).toHaveLength(2);
    expect(mockStore.tasks).toHaveLength(1);
  });
});

describe("missed call from an unknown number", () => {
  it("still creates a lead with a CallLog, as before", async () => {
    const r = await processMissedCall(call("9101", "0501112233"));
    expect(r.created).toBe(true);
    expect(r.leadId).toBe("lead-1");
    expect(r.customerId).toBeUndefined();
    expect(mockStore.leads[0]).toMatchObject({ phone: "0501112233", name: "שיחה מ-0501112233" });
    expect(mockStore.callLogs[0].summary).toContain("call_id:9101");
    expect(mockStore.notes).toHaveLength(0);
    expect(mockStore.tasks).toHaveLength(0);
  });
});

describe("answered call on a customer", () => {
  it("note with the summary; a task only when a next step was agreed", async () => {
    const customer = { id: "cust-1", name: "רונית לוי", matches: 1 };
    const noStep = await logAnsweredCallOnCustomer("biz", customer, { callId: "1", dateLabel: "2026-10-23 10:00", summary: "שאלה על חיסונים" });
    expect(noStep.taskCreated).toBe(false);
    const withStep = await logAnsweredCallOnCustomer("biz", customer, {
      callId: "2",
      dateLabel: "2026-10-23 11:00",
      summary: "רוצה לקבוע אבחון",
      nextStep: "לתאם אבחון בבית",
      followUpAt: new Date("2026-10-25T07:00:00Z"),
    });
    expect(withStep.taskCreated).toBe(true);
    expect(mockStore.notes.map((n) => n.description)).toEqual([
      "[paycall-answered] שיחה שנענתה ב-2026-10-23 10:00 • call_id:1\nשאלה על חיסונים",
      "[paycall-answered] שיחה שנענתה ב-2026-10-23 11:00 • call_id:2\nרוצה לקבוע אבחון",
    ]);
    expect(mockStore.tasks[0]).toMatchObject({ title: "המשך טיפול: רונית לוי", priority: "MEDIUM", dueAt: "2026-10-25T07:00:00.000Z" });
  });

  it("note text stays within addCustomerNote's 2000-char limit and flags a shared number", () => {
    const n = customerCallNote({ kind: "answered", callId: "5", dateLabel: "x", detail: "א".repeat(5000), matches: 3 });
    expect(n.length).toBeLessThanOrEqual(2000);
    expect(customerCallNote({ kind: "missed", callId: "6", dateLabel: "x", matches: 2 })).toContain("(המספר רשום אצל 2 לקוחות)");
  });
});

describe("returning caller (item 24)", () => {
  const old = (over: Partial<(typeof mockStore.leads)[number]>) => ({
    id: "lead-old", phone: "0501112233", name: "דנה כהן", stage: "stage-new", notes: "פרטי הכלב: לולה",
    customerId: null, createdAt: new Date("2026-01-01T08:00:00Z"), lastContactedAt: new Date("2026-01-05T08:00:00Z"), nextFollowUpAt: null,
    ...over,
  });

  it("an active open lead keeps getting the calls", async () => {
    mockStore.leads.push(old({ lastContactedAt: new Date("2026-10-01T08:00:00Z") }));
    const r = await processMissedCall(call("9201", "0501112233"));
    expect(r).toMatchObject({ leadId: "lead-old", created: false });
    expect(mockStore.leads).toHaveLength(1);
    // Only the counter changes — the dog details stay.
    expect(mockStore.leads[0].notes).toContain("פרטי הכלב: לולה");
    expect(mockStore.leads[0].notes).toContain("מספר ניסיונות: 1");
  });

  it.each([
    ["closed (lost)", { stage: "stage-lost", lastContactedAt: new Date("2026-10-01T08:00:00Z") }],
    ["closed (won)", { stage: "stage-won", lastContactedAt: new Date("2026-10-01T08:00:00Z") }],
    ["no contact for > 60 days", {}],
  ])("%s → a new lead linked to the previous one", async (_label, over) => {
    mockStore.leads.push(old(over));
    const r = await processMissedCall(call("9202", "0501112233"));
    expect(r.created).toBe(true);
    expect(r.leadId).not.toBe("lead-old");
    const created = mockStore.leads.find((l) => l.id === r.leadId)!;
    expect(created.name).toBe("שיחה מ-0501112233");
    expect(created.notes).toContain("פונה חוזר – ליד קודם: https://petra-app.com/leads?lead=lead-old");
  });

  it("a won stage owned by another business still counts as closed (Or's lead 5a7f…, item 27g)", async () => {
    mockStore.leads.push(old({ stage: "stage-won", lastContactedAt: new Date("2026-10-20T08:00:00Z") }));
    const r = await processMissedCall(call("9204", "0501112233"));
    expect(r.created).toBe(true);
    const prismaMock = jest.requireMock("@/lib/prisma").default;
    const where = prismaMock.leadStage.findMany.mock.calls.at(-1)[0].where;
    expect(where.businessId).toBeUndefined(); // stages are looked up by id only
  });

  it("the same call is never logged twice, whatever lead it went to", async () => {
    mockStore.leads.push(old({ stage: "stage-lost" }));
    await processMissedCall(call("9203", "0501112233"));
    const again = await processMissedCall(call("9203", "0501112233"));
    expect(again.skipped).toBe(true);
    expect(mockStore.leads).toHaveLength(2);
  });
});
