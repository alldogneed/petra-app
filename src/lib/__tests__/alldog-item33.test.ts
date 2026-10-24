/**
 * Item 33 (Or, 24/10): rep coaching from the answered-call transcripts + weekly report per rep.
 */
import {
  buildRepReport,
  CALL_COACHING_JSON_SCHEMA,
  COACHING_SYSTEM_PROMPT,
  formatRepReport,
  parseCallCoaching,
  periodLabel,
  readStoredCoaching,
  repFromPaycall,
  reportDays,
  stripCustomer,
  type CallCoaching,
} from "@/lib/alldog/call-coaching";
import { fromPayload, toPayload } from "@/lib/alldog/call-retry";

jest.mock("@/lib/prisma", () => ({ __esModule: true, default: {} }));

const base = {
  offered_diagnosis: true,
  explained_tracks: true,
  price_handling: null,
  next_step_set: true,
  outcome: "אבחון נקבע",
  strengths: ["הציעה אבחון בבית ב-350 ₪ שמתקזז"],
  improve: ["לסכם בסוף השיחה את הצעד הבא עם יום ושעה"],
  improve_example: "נדבר בהמשך",
  quote_good: "מתחייבים למטרות שנגדיר יחד באבחון",
  price_before_diagnosis: false,
  said_our_pension: false,
};

describe("rep", () => {
  it("PayCall destination name first, else the number that answered", () => {
    expect(repFromPaycall({ NAME: " מכירות - תמר ", CALLEE: "0501234567" })).toBe("מכירות - תמר");
    expect(repFromPaycall({ NAME: "", CALLEE: "050-123-4567" })).toBe("0501234567");
    expect(repFromPaycall(null)).toBeNull();
  });
  it("the rep survives the retry queue payload", () => {
    const p = toPayload({ callId: "1", phone: "0541234567", startedAt: new Date("2026-10-24T10:00:00Z"), billsec: 60, rep: "מכירות - תמר" });
    expect(fromPayload(JSON.parse(JSON.stringify(p)))?.rep).toBe("מכירות - תמר");
    const old = { callId: "1", phone: "0541234567", startedAt: "2026-10-24T10:00:00Z", billsec: 60 };
    expect(fromPayload(old)?.rep).toBeNull(); // rows queued before item 33
  });
});

describe("assessment", () => {
  it("parses Claude's JSON with the required fields", () => {
    const c = parseCallCoaching(JSON.stringify(base), "מכירות - תמר")!;
    expect(c).toMatchObject({ rep: "מכירות - תמר", offered_diagnosis: true, outcome: "אבחון נקבע", next_step_set: true });
    expect(c.strengths).toHaveLength(1);
    expect(c.improve).toHaveLength(1);
  });
  it("caps strengths at 2 and improve at 1, unknown outcome → אחר, garbage → null", () => {
    const c = parseCallCoaching(JSON.stringify({ ...base, strengths: ["a", "b", "c"], improve: ["x", "y"], outcome: "בטוח" }), "r")!;
    expect(c.strengths).toEqual(["a", "b"]);
    expect(c.improve).toEqual(["x"]);
    expect(c.outcome).toBe("אחר");
    expect(parseCallCoaching("not json", "r")).toBeNull();
  });
  it("no customer name or phone number in the stored texts", () => {
    const c = parseCallCoaching(
      JSON.stringify({ ...base, quote_good: "דנה כהן, נחזור אלייך ל-054-123-4567 מחר", improve_example: "תגידי דנה, 0541234567" }),
      "r",
      ["דנה כהן"]
    )!;
    for (const t of [c.quote_good, c.improve_example]) {
      expect(t).not.toMatch(/דנה|כהן/);
      expect(t).not.toMatch(/\d{4}/);
    }
    expect(stripCustomer("האבחון עולה 350 ₪", [])).toBe("האבחון עולה 350 ₪"); // prices stay
  });
  it("the schema asks for every field Or listed; the prompt carries the messaging rules", () => {
    for (const k of ["offered_diagnosis", "explained_tracks", "price_handling", "next_step_set", "outcome", "strengths", "improve", "quote_good"]) {
      expect(CALL_COACHING_JSON_SCHEMA.required).toContain(k);
    }
    expect(COACHING_SYSTEM_PROMPT).toContain("350");
    expect(COACHING_SYSTEM_PROMPT).toContain("הפנסיון שלנו");
    expect(COACHING_SYSTEM_PROMPT).toContain("לפני אבחון");
  });
});

describe("weekly report", () => {
  const c = (over: Partial<CallCoaching>): CallCoaching => ({ ...(parseCallCoaching(JSON.stringify(base), "תמר") as CallCoaching), ...over });
  const rows = [
    c({}),
    c({ outcome: "יחזור", next_step_set: true }),
    c({ outcome: "יקר", next_step_set: false, offered_diagnosis: false, price_before_diagnosis: true, improve: ["להציע אבחון לפני שמדברים על מחיר"], improve_example: "האינטנסיבי עולה 6,000" }),
    c({ rep: "מכירות - נועה", outcome: "לא רלוונטי", next_step_set: false, said_our_pension: true }),
  ];
  const r = buildRepReport(rows, new Date("2026-10-17T00:00:00Z"), new Date("2026-10-24T00:00:00Z"));

  it("groups by rep with counts and rates", () => {
    expect(r.totalCalls).toBe(4);
    const tamar = r.reps.find((x) => x.rep === "תמר")!;
    expect(tamar).toMatchObject({ calls: 3, diagnosisSet: 1, nextStepSet: 2, diagnosisRate: 33, nextStepRate: 67, priceBeforeDiagnosis: 1 });
    expect(tamar.worked.length).toBeLessThanOrEqual(2);
    expect(tamar.improve).toBeTruthy();
    expect(r.reps[0].rep).toBe("תמר"); // most calls first
    expect(r.reps.find((x) => x.rep === "מכירות - נועה")!.saidOurPension).toBe(1);
  });

  it("Hebrew text: per rep calls, %, what worked, one improvement with an example", () => {
    const text = formatRepReport(r, "17/10–24/10");
    expect(text).toContain("תמר: 3 שיחות");
    expect(text).toContain("אבחון נקבע 33%");
    expect(text).toContain("מה עבד:");
    expect(text).toContain("לשיפור:");
    expect(text).toContain('"הפנסיון שלנו"');
    expect(formatRepReport(buildRepReport([], new Date(), new Date()), "x")).toContain("לא היו שיחות");
  });

  it("helpers", () => {
    expect(reportDays(null)).toBe(7);
    expect(reportDays("14")).toBe(14);
    expect(reportDays("999")).toBe(7);
    expect(periodLabel(new Date("2026-10-17T10:00:00Z"), new Date("2026-10-24T10:00:00Z"))).toBe("17/10–24/10");
    expect(readStoredCoaching({ foo: 1 })).toBeNull();
    expect(readStoredCoaching(rows[0])?.rep).toBe("תמר");
  });
});
