/**
 * AllDog — PayCall answered-call summaries: liveLink parsing, summary JSON, idempotency.
 */
jest.mock("@/lib/prisma", () => ({ __esModule: true, default: {}, prisma: {} }));

// ── In-memory stand-ins for the lead layer, the recording, STT and Claude ──
const mockLogs: Array<{ leadId: string; summary: string; treatment: string }> = [];
const mockFollowUps: Array<{ leadId: string; at: Date }> = [];
let mockClaimFree = true;

jest.mock("@/lib/rate-limit", () => ({
  claimOnce: jest.fn(async () => mockClaimFree),
}));
jest.mock("@/lib/alldog/leads", () => {
  const actual = jest.requireActual("@/lib/alldog/leads");
  return {
    hasCallIdToken: actual.hasCallIdToken,
    localPhone: (p: string) => {
      const d = p.replace(/\D/g, "");
      return d.startsWith("972") ? "0" + d.slice(3) : d;
    },
    callIdAlreadyLogged: jest.fn(async (_b: string, callId: string) => mockLogs.some((l) => actual.hasCallIdToken(l.summary, callId))),
    upsertLeadFromContact: jest.fn(async () => ({ leadId: "lead-1", created: mockLogs.length === 0 })),
    addLeadCallLog: jest.fn(async (leadId: string, summary: string, treatment = "") => {
      mockLogs.push({ leadId, summary, treatment });
      return { id: `log-${mockLogs.length}` };
    }),
    setLeadFollowUp: jest.fn(async (_b: string, leadId: string, at: Date) => {
      mockFollowUps.push({ leadId, at });
    }),
  };
});
jest.mock("@/lib/paycall", () => {
  const actual = jest.requireActual("@/lib/paycall");
  return {
    ...actual,
    fetchRecordingFromLink: jest.fn(async () => ({ data: new ArrayBuffer(8), contentType: "audio/mpeg" })),
    downloadRecord: jest.fn(async () => ({ data: new ArrayBuffer(8), contentType: "audio/mpeg" })),
  };
});
jest.mock("@/lib/stt", () => ({
  transcribeAudio: jest.fn(async () => ({ text: "שלום", utterances: [{ speaker: "1", text: "שלום, הכלב שלי נובח" }], languageCode: "he" })),
  formatTranscript: () => "דובר 1: שלום, הכלב שלי נובח",
}));
const mockSummaryJson = {
  customer_name: "דנה כהן",
  dog_name: "לוקי",
  dog_breed: "מעורב",
  dog_age: "שנה",
  city: "רמת גן",
  problem: "נובח על אורחים",
  service: "אילוף אינטנסיבי בבית",
  price_mentioned: "350 ₪ אבחון",
  objections: ["מחיר"],
  next_step: "אבחון בבית",
  next_step_date: "2099-01-05",
  next_step_time: "11:00",
  summary: "דנה התקשרה בגלל נביחות. סוכם אבחון בבית.",
};
jest.mock("@anthropic-ai/sdk", () => {
  return {
    __esModule: true,
    default: class {
      messages = {
        create: jest.fn(async () => ({
          stop_reason: "end_turn",
          content: [{ type: "text", text: JSON.stringify(mockSummaryJson) }],
        })),
      };
    },
  };
});

import { parseLiveLinkParams, isSummarizableAnswer, isSafeRecordingUrl, parseAnalyticsRow } from "@/lib/paycall";
import { parseCallSummary, formatAnsweredCallLog } from "@/lib/alldog/call-summary-schema";
import { hasCallIdToken } from "@/lib/alldog/leads";
import { processAnsweredCall, followUpFor } from "@/lib/alldog/call-summary";
import { israelParts } from "@/lib/alldog/time";

describe("parseLiveLinkParams", () => {
  it("reads the liveLink query (case-insensitive) and prefers dlinkDirect", () => {
    const sp = new URLSearchParams(
      "secret=x&Status=END&Id=987&Disposition=answer&cli=0501234567&billsec=95" +
        "&dlink=https%3A%2F%2Frec.callindex.co.il%2Fa.mp3&dlinkDirect=https%3A%2F%2Frec.callindex.co.il%2Fdirect.mp3" +
        "&Gclid=abc123&campaignName=dogs-tlv&campaignId=55"
    );
    const p = parseLiveLinkParams(sp);
    expect(p).toMatchObject({
      status: "END",
      callId: "987",
      disposition: "ANSWER",
      cli: "0501234567",
      billsec: 95,
      recordingUrl: "https://rec.callindex.co.il/direct.mp3",
      gclid: "abc123",
      campaign: "dogs-tlv",
    });
    expect(p.campaignParams).toEqual({ campaignName: "dogs-tlv", campaignId: "55" });
  });

  it("falls back to dlink and tolerates missing extras", () => {
    const p = parseLiveLinkParams(new URLSearchParams("Status=END&Id=1&Disposition=ANSWER&dlink=https://x.example.com/r.wav"));
    expect(p.recordingUrl).toBe("https://x.example.com/r.wav");
    expect(p.cli).toBeNull();
    expect(p.billsec).toBeNull();
    expect(p.campaign).toBeNull();
  });

  it("drops unsafe recording links (SSRF guard)", () => {
    expect(parseLiveLinkParams(new URLSearchParams("dlink=http://127.0.0.1/a.mp3")).recordingUrl).toBeNull();
    expect(isSafeRecordingUrl("http://localhost/a.mp3")).toBe(false);
    expect(isSafeRecordingUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeRecordingUrl("http://[::1]/a")).toBe(false);
    expect(isSafeRecordingUrl("https://rec.paycall.co.il/a.mp3")).toBe(true);
  });

  it("summarizes only ANSWER with ≥ 20 seconds of talk", () => {
    expect(isSummarizableAnswer({ disposition: "ANSWER", billsec: 20 })).toBe(true);
    expect(isSummarizableAnswer({ disposition: "ANSWER", billsec: 19 })).toBe(false);
    expect(isSummarizableAnswer({ disposition: "ANSWER", billsec: null })).toBe(false);
    expect(isSummarizableAnswer({ disposition: "NOANSWER", billsec: 300 })).toBe(false);
  });

  it("reads getAnalyticsCalls rows defensively", () => {
    expect(parseAnalyticsRow({ ID: "5", GCLID: "g1", Campaign: "c1" })).toEqual({
      id: "5",
      info: { gclid: "g1", campaign: "c1", campaignParams: { Campaign: "c1" } },
    });
    expect(parseAnalyticsRow({ foo: "bar" })).toBeNull();
  });
});

describe("parseCallSummary", () => {
  it("accepts the JSON (string or object) and normalizes it", () => {
    const s = parseCallSummary(JSON.stringify(mockSummaryJson))!;
    expect(s.customerName).toBe("דנה כהן");
    expect(s.objections).toEqual(["מחיר"]);
    expect(s.nextStepDate).toBe("2099-01-05");
    expect(s.nextStepTime).toBe("11:00");
    expect(parseCallSummary(mockSummaryJson)!.city).toBe("רמת גן");
  });

  it("drops invalid dates / times and empty strings, keeps the rest", () => {
    const s = parseCallSummary({ ...mockSummaryJson, next_step_date: "2026-02-30", next_step_time: "25:00", city: "  " })!;
    expect(s.nextStepDate).toBeNull();
    expect(s.nextStepTime).toBeNull();
    expect(s.city).toBeNull();
  });

  it("returns null without a summary or for broken JSON", () => {
    expect(parseCallSummary("{not json")).toBeNull();
    expect(parseCallSummary({ ...mockSummaryJson, summary: "" })).toBeNull();
    expect(parseCallSummary({ customer_name: "x" })).toBeNull();
  });

  it("formats the CallLog with the call_id token and the next step", () => {
    const s = parseCallSummary(mockSummaryJson)!;
    const log = formatAnsweredCallLog(s, { callId: "987", startedAt: new Date(), billsec: 95, dateLabel: "2026-10-23 10:00" });
    expect(log.summary).toContain("call_id:987");
    expect(log.summary).toContain("(1:35 דק׳)");
    expect(log.summary).toContain("התנגדויות: מחיר");
    expect(log.treatment).toBe("הצעד הבא: אבחון בבית (2099-01-05 11:00)");
  });
});

describe("call_id token", () => {
  it("does not confuse call_id:12 with call_id:123", () => {
    expect(hasCallIdToken("x • call_id:123", "12")).toBe(false);
    expect(hasCallIdToken("x • call_id:12\nmore", "12")).toBe(true);
    expect(hasCallIdToken("x • call_id:12", "12")).toBe(true);
  });
});

describe("processAnsweredCall", () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    mockLogs.length = 0;
    mockFollowUps.length = 0;
    mockClaimFree = true;
    process.env = {
      ...OLD_ENV,
      ALLDOG_CALL_SUMMARIES_ENABLED: "true",
      ALLDOG_BUSINESS_ID: "biz-alldog",
      ANTHROPIC_API_KEY: "test",
      ELEVENLABS_API_KEY: "test",
    };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  const input = { callId: "777", phone: "972501234567", startedAt: new Date(), billsec: 60, recordingUrl: "https://rec.example.com/a.mp3" };

  it("is idempotent: the same call_id twice writes one CallLog", async () => {
    const first = await processAnsweredCall(input);
    const second = await processAnsweredCall(input);
    expect(first).toMatchObject({ status: "logged", summarized: true });
    expect(second).toEqual({ status: "duplicate" });
    expect(mockLogs).toHaveLength(1);
    expect(mockLogs[0].summary).toContain("call_id:777");
    expect(mockFollowUps).toHaveLength(1);
  });

  it("skips while another run holds the call", async () => {
    mockClaimFree = false;
    expect(await processAnsweredCall(input)).toEqual({ status: "in_progress" });
    expect(mockLogs).toHaveLength(0);
  });

  it("does nothing when the flag is off", async () => {
    process.env.ALLDOG_CALL_SUMMARIES_ENABLED = "false";
    expect(await processAnsweredCall(input)).toEqual({ status: "disabled" });
    expect(mockLogs).toHaveLength(0);
  });
});

describe("followUpFor", () => {
  const now = new Date("2026-10-23T08:00:00.000Z"); // Fri 11:00 Israel
  it("uses the agreed date/time when it is in the future", () => {
    const at = followUpFor({ ...parseCallSummary(mockSummaryJson)!, nextStepDate: "2026-10-26", nextStepTime: "12:30" }, now);
    expect(israelParts(at)).toMatchObject({ ymd: "2026-10-26", hhmm: "12:30" });
  });
  it("defaults to two days later at 10:00 Israel time", () => {
    const at = followUpFor(null, now);
    expect(israelParts(at)).toMatchObject({ ymd: "2026-10-25", hhmm: "10:00" });
    const past = followUpFor({ ...parseCallSummary(mockSummaryJson)!, nextStepDate: "2026-10-01", nextStepTime: null }, now);
    expect(israelParts(past)).toMatchObject({ ymd: "2026-10-25", hhmm: "10:00" });
  });
});
