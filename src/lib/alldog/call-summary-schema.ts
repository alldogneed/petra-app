/**
 * The JSON contract of an answered-call summary (pure — no DB, no network).
 * Claude returns it through structured outputs; parseCallSummary() is the only
 * way the rest of the code reads it.
 */
import { z } from "zod";
import { isValidHhmm, isValidYmd } from "@/lib/alldog/time";

/** JSON schema sent to Claude (output_config.format). Every field required; null = not said. */
export const CALL_SUMMARY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "customer_name", "dog_name", "dog_breed", "dog_age", "city", "problem",
    "service", "price_mentioned", "objections", "next_step", "next_step_date", "next_step_time", "summary",
  ],
  properties: {
    customer_name: { type: ["string", "null"], description: "שם הלקוח כפי שנאמר בשיחה" },
    dog_name: { type: ["string", "null"] },
    dog_breed: { type: ["string", "null"] },
    dog_age: { type: ["string", "null"], description: "טקסט חופשי, למשל '4 חודשים'" },
    city: { type: ["string", "null"] },
    problem: { type: ["string", "null"], description: "הבעיה / הסיבה לפנייה, משפט אחד" },
    service: { type: ["string", "null"], description: "השירות שעלה בשיחה" },
    price_mentioned: { type: ["string", "null"], description: "מחיר שהוזכר, כפי שנאמר" },
    objections: { type: "array", items: { type: "string" }, description: "התנגדויות / היסוסים של הלקוח" },
    next_step: { type: ["string", "null"], description: "הצעד הבא שסוכם" },
    next_step_date: { type: ["string", "null"], description: "YYYY-MM-DD אם נאמר תאריך/יום לצעד הבא" },
    next_step_time: { type: ["string", "null"], description: "HH:MM (שעון ישראל) אם נאמרה שעה" },
    summary: { type: "string", description: "סיכום של 3–4 שורות בעברית" },
  },
} as const;

const optStr = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
      return s ? s.slice(0, max) : null;
    });

const rawSchema = z.object({
  customer_name: optStr(100),
  dog_name: optStr(100),
  dog_breed: optStr(100),
  dog_age: optStr(50),
  city: optStr(100),
  problem: optStr(500),
  service: optStr(200),
  price_mentioned: optStr(100),
  objections: z
    .union([z.array(z.unknown()), z.null(), z.undefined()])
    .transform((v) =>
      (v ?? [])
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.replace(/\s+/g, " ").trim().slice(0, 200))
        .filter(Boolean)
        .slice(0, 8)
    ),
  next_step: optStr(300),
  next_step_date: optStr(10),
  next_step_time: optStr(5),
  summary: z.string().transform((s) => s.trim().slice(0, 1500)),
});

export interface CallSummary {
  customerName: string | null;
  dogName: string | null;
  dogBreed: string | null;
  dogAge: string | null;
  city: string | null;
  problem: string | null;
  service: string | null;
  priceMentioned: string | null;
  objections: string[];
  nextStep: string | null;
  /** Valid YYYY-MM-DD or null (invalid dates are dropped). */
  nextStepDate: string | null;
  /** Valid HH:MM or null. */
  nextStepTime: string | null;
  summary: string;
}

/** Validate Claude's JSON (object or string). Null when unusable (no summary text). */
export function parseCallSummary(raw: unknown): CallSummary | null {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const r = rawSchema.safeParse(value);
  if (!r.success || !r.data.summary) return null;
  const d = r.data;
  return {
    customerName: d.customer_name,
    dogName: d.dog_name,
    dogBreed: d.dog_breed,
    dogAge: d.dog_age,
    city: d.city,
    problem: d.problem,
    service: d.service,
    priceMentioned: d.price_mentioned,
    objections: d.objections,
    nextStep: d.next_step,
    nextStepDate: isValidYmd(d.next_step_date) ? d.next_step_date : null,
    nextStepTime: isValidHhmm(d.next_step_time) ? d.next_step_time : null,
    summary: d.summary,
  };
}

/** CallLog lines for a summarized call. `summary` keeps the `call_id:` token (idempotency). */
export function formatAnsweredCallLog(
  s: CallSummary,
  call: { callId: string; startedAt: Date; billsec: number | null; dateLabel: string }
): { summary: string; treatment: string } {
  const duration = call.billsec !== null ? ` (${Math.floor(call.billsec / 60)}:${String(call.billsec % 60).padStart(2, "0")} דק׳)` : "";
  const facts = [
    s.problem && `בעיה: ${s.problem}`,
    s.service && `שירות: ${s.service}`,
    s.priceMentioned && `מחיר שהוזכר: ${s.priceMentioned}`,
    s.objections.length ? `התנגדויות: ${s.objections.join(" · ")}` : null,
  ].filter(Boolean);
  const summary = [
    `[paycall-answered] שיחה שנענתה${duration} ב-${call.dateLabel} • call_id:${call.callId}`,
    s.summary,
    ...facts,
  ].join("\n");
  const when = s.nextStepDate ? ` (${s.nextStepDate}${s.nextStepTime ? ` ${s.nextStepTime}` : ""})` : "";
  const treatment = s.nextStep ? `הצעד הבא: ${s.nextStep}${when}` : "";
  return { summary, treatment };
}
