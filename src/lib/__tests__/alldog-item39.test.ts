/**
 * Item 39 (27/10) — bot conversation summaries stopped after item 37: the summary schema had
 * 18 union-typed parameters ("type": ["string","null"]) and the Claude API allows 16 per request
 * → 400 on every call, silently. Now: plain strings ("" = not said), a failed summary gives its
 * claim back (the idle cron retries) and Or gets a "bot_summary" alert.
 */
// Pure checks only — no DB (also lets the suite run where the Prisma client is not generated).
jest.mock("@/lib/prisma", () => ({ __esModule: true, default: {} }));
jest.mock("@prisma/client", () => ({ Prisma: {}, PrismaClient: class {} }));

import { BOT_SUMMARY_JSON_SCHEMA, parseBotSummary } from "@/lib/alldog-bot/summary";
import { CALL_SUMMARY_JSON_SCHEMA } from "@/lib/alldog/call-summary-schema";
import { CALL_COACHING_JSON_SCHEMA } from "@/lib/alldog/call-coaching";
import { FAILURE_KIND_TITLES } from "@/lib/alldog/failure-alerts";

/** Anthropic structured-output limits per request (platform docs, "Explicit limits"). */
const MAX_UNION_PARAMS = 16;
const MAX_OPTIONAL_PARAMS = 24;

type Schema = { type?: unknown; anyOf?: unknown; properties?: Record<string, Schema>; items?: Schema; required?: readonly string[] };

function countUnions(s: Schema): number {
  let n = Array.isArray(s.type) || Array.isArray(s.anyOf) ? 1 : 0;
  for (const p of Object.values(s.properties ?? {})) n += countUnions(p);
  if (s.items) n += countUnions(s.items);
  return n;
}
function countOptional(s: Schema): number {
  let n = 0;
  const req = new Set(s.required ?? []);
  for (const [k, p] of Object.entries(s.properties ?? {})) {
    if (!req.has(k)) n++;
    n += countOptional(p);
  }
  if (s.items) n += countOptional(s.items);
  return n;
}

describe("39 — structured-output schemas stay inside the API limits", () => {
  it.each([
    ["bot summary", BOT_SUMMARY_JSON_SCHEMA],
    ["PayCall call summary", CALL_SUMMARY_JSON_SCHEMA],
    ["call coaching", CALL_COACHING_JSON_SCHEMA],
  ])("%s", (_name, schema) => {
    expect(countUnions(schema as unknown as Schema)).toBeLessThanOrEqual(MAX_UNION_PARAMS);
    expect(countOptional(schema as unknown as Schema)).toBeLessThanOrEqual(MAX_OPTIONAL_PARAMS);
  });

  it("the bot summary has no union types at all", () => {
    expect(countUnions(BOT_SUMMARY_JSON_SCHEMA as unknown as Schema)).toBe(0);
  });
});

describe("39 — empty strings mean 'not said'", () => {
  it("parses the new shape", () => {
    const sum = parseBotSummary(
      JSON.stringify({
        dog_name: "סימבה", dog_breed: "גולדנדודל", dog_age: "8 שבועות", problem: "", city: "חולון", neighborhood: "",
        urgency: "", promised: "נציגה תחזור טלפונית", next_step: "", caller_seems_minor: false, dog_since: "", previous_training: "",
        trigger: "", urgency_level: "", preferred_track: "", decision_maker: "", decision_maker_absent: false, objections: [],
        heard_from: "", needs_boarding_referral: false, travel_dates: "", recommended_step: "",
      })
    );
    expect(sum).not.toBeNull();
    expect(sum!.dog_name).toBe("סימבה");
    expect(sum!.problem).toBeNull();
    expect(sum!.neighborhood).toBeNull();
    expect(sum!.urgency_level).toBeNull();
    expect(sum!.preferred_track).toBeNull();
  });
  it("still reads the old null shape", () => {
    const sum = parseBotSummary(JSON.stringify({ dog_name: null, urgency_level: "high", preferred_track: null }));
    expect(sum!.dog_name).toBeNull();
    expect(sum!.urgency_level).toBe("high");
  });
});

describe("39 — a failed summary is reported", () => {
  it("has its own alert kind", () => {
    expect(FAILURE_KIND_TITLES.bot_summary).toBe("סיכום שיחת הבוט בוואטסאפ נכשל");
  });
});
