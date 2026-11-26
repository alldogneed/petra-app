/**
 * AllDog — a website form from a phone that already has an active lead joins that lead
 * (Or, 26/11/2026: a caller hung up on the voice agent, filled the form, and Petra held two leads).
 */
type Row = Record<string, unknown>;
const state = { active: null as Row | null, upserts: [] as Row[], logs: [] as Row[], emailUpdates: [] as Row[], allDog: true };

jest.mock("@/lib/prisma", () => {
  const p = {
    lead: {
      updateMany: async (a: Row) => { state.emailUpdates.push(a); return { count: 1 }; },
      findFirst: async () => (state.active ? { id: state.active.id, name: state.active.name, stage: state.active.stage } : null),
    },
  };
  return { __esModule: true, default: p, prisma: p };
});
jest.mock("@/lib/alldog/config", () => ({ isAllDogBusiness: () => state.allDog }));
jest.mock("@/lib/alldog/leads", () => ({
  isPlaceholderLeadName: (n: string | null) => !n || /^שיחה מ-/.test(n) || /^[\d\s+\-()]+$/.test(n),
  resolveLeadForContact: async () => ({ active: state.active, previous: null }),
  upsertLeadFromContact: async (input: Row) => {
    state.upserts.push(input);
    if (state.active && input.name && /^שיחה מ-/.test(String(state.active.name))) state.active.name = input.name;
    return { leadId: state.active?.id, created: false };
  },
  addLeadCallLog: async (leadId: string, summary: string) => { state.logs.push({ leadId, summary }); return { id: "log-1" }; },
}));

import { formJournalText, mergeFormIntoActiveLead } from "@/lib/alldog/form-lead-merge";

const NOW = new Date("2026-11-25T09:02:29Z"); // 11:02 in Israel
const form = {
  businessId: "b-alldog", phone: "0537218986", name: "שיר כהן", email: "shir@example.com", source: "אתר · פרסום ממומן",
  city: "תל אביב", service: "אילוף כלבים בבית הלקוח", notes: "ערוץ: טופס באתר (cert-hero)\nעיר: תל אביב",
  attribution: null,
};

beforeEach(() => {
  state.active = null; state.upserts = []; state.logs = []; state.emailUpdates = []; state.allDog = true;
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("a form from a phone with an active lead", () => {
  it("the lead came from a silent call (placeholder name) → the form joins it: real name, a journal line, no new lead", async () => {
    state.active = { id: "lead-1", name: "שיחה מ-0537218986", stage: "stage-new" };
    const r = await mergeFormIntoActiveLead(form, NOW);
    expect(r).toEqual({ id: "lead-1", name: "שיר כהן", stage: "stage-new", replacedPlaceholder: true });
    expect(state.upserts[0]).toMatchObject({ phone: "0537218986", name: "שיר כהן", city: "תל אביב", requestedService: "אילוף כלבים בבית הלקוח" });
    expect(state.logs).toHaveLength(1);
    expect(String(state.logs[0].summary).split("\n")[0]).toBe("[אתר · טופס] השאיר פרטים בטופס באתר (25/11 11:02) · מקור: אתר · פרסום ממומן");
    expect(String(state.logs[0].summary)).toContain("עיר: תל אביב");
  });
  it("the lead already has a real name → still joined, the name is not reported as replaced", async () => {
    state.active = { id: "lead-2", name: "שירה לוי", stage: "stage-x" };
    const r = await mergeFormIntoActiveLead(form, NOW);
    expect(r).toMatchObject({ id: "lead-2", name: "שירה לוי", replacedPlaceholder: false });
    expect(state.logs).toHaveLength(1);
  });
  it("the email is written only where the lead has none", async () => {
    state.active = { id: "lead-1", name: "שיחה מ-0537218986", stage: "s" };
    await mergeFormIntoActiveLead(form, NOW);
    expect(state.emailUpdates[0]).toEqual({ where: { id: "lead-1", businessId: "b-alldog", email: null }, data: { email: "shir@example.com" } });
  });
});

describe("cases that still create a new lead (null)", () => {
  it("no active lead for the phone (none / closed / stale)", async () => {
    expect(await mergeFormIntoActiveLead(form, NOW)).toBeNull();
    expect(state.upserts).toHaveLength(0);
    expect(state.logs).toHaveLength(0);
  });
  it("another business → never touched", async () => {
    state.allDog = false;
    state.active = { id: "lead-1", name: "שיחה מ-0537218986", stage: "s" };
    expect(await mergeFormIntoActiveLead(form, NOW)).toBeNull();
    expect(state.upserts).toHaveLength(0);
  });
  it("a form without a phone", async () => {
    state.active = { id: "lead-1", name: "x", stage: "s" };
    expect(await mergeFormIntoActiveLead({ ...form, phone: null }, NOW)).toBeNull();
  });
});

describe("the journal line", () => {
  it("header only when the form carried no notes", () => {
    expect(formJournalText({ source: "website", notes: null }, NOW)).toBe("[אתר · טופס] השאיר פרטים בטופס באתר (25/11 11:02) · מקור: website");
  });
});
