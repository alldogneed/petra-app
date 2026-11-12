/**
 * AllDog voice agent × PayCall (section 6, "ממתין לשיחה אמיתית"): the Telnyx-leg filter for the
 * answered-call summaries, the missed-call WhatsApp decision (block / defer / send), the verification
 * log line, and that everything is off with the flag off. Prisma / alerts mocked.
 */
const vac = { findMany: jest.fn() };
jest.mock("@/lib/prisma", () => {
  const p = { voiceAgentCall: vac };
  return { __esModule: true, prisma: p, default: p };
});
const claim = jest.fn(async () => true);
jest.mock("@/lib/rate-limit", () => ({ claimOnce: (...a: unknown[]) => claim(...(a as [])) }));
const notify = jest.fn(async () => undefined);
jest.mock("@/lib/notify-owner", () => ({ notifyOwnerAllDog: (...a: unknown[]) => notify(...(a as [])) }));

import {
  VOICE_WA_DEFER_MS,
  VOICE_WA_MIN_DELAY_MS,
  firstVoiceCheckAt,
  isVoiceAgentLeg,
  missedCallVoiceDecision,
  missedCallWriteLabel,
  normalizeIlNumber,
  paycallVoiceLogLine,
} from "@/lib/alldog/voice-agent/paycall-rules";
import { missedCallSendAt, missedCallVoiceCheck, skipPaycallSummaryForVoiceAgent } from "@/lib/alldog/voice-agent/paycall-guard";
import { SKIP_REASON_LABELS } from "@/lib/alldog/missed-call-rules";

const ENV = ["ALLDOG_BUSINESS_ID", "PAYCALL_BUSINESS_ID", "ALLDOG_VOICE_AGENT_ENABLED", "ALLDOG_VOICE_AGENT_SECRET", "ALLDOG_VOICE_AGENT_NUMBER"] as const;
const saved: Record<string, string | undefined> = {};
beforeAll(() => ENV.forEach((k) => (saved[k] = process.env[k])));
afterAll(() => ENV.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]))));
function flagOn(number: string | null = "+97237386160") {
  process.env.ALLDOG_BUSINESS_ID = "b-alldog";
  process.env.PAYCALL_BUSINESS_ID = "b-alldog";
  process.env.ALLDOG_VOICE_AGENT_ENABLED = "true";
  process.env.ALLDOG_VOICE_AGENT_SECRET = "s";
  if (number) process.env.ALLDOG_VOICE_AGENT_NUMBER = number;
  else delete process.env.ALLDOG_VOICE_AGENT_NUMBER;
}
beforeEach(() => {
  jest.clearAllMocks();
  ENV.forEach((k) => delete process.env[k]);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("the Telnyx number in any spelling", () => {
  it("normalizes +972 / 972 / 0 / dashes to the same number", () => {
    for (const v of ["+97237386160", "97237386160", "037386160", "03-738-6160", "0097237386160"]) expect(normalizeIlNumber(v)).toBe("037386160");
  });
  it("CALLEE = the Telnyx number → voice-agent leg; anything else / missing → not", () => {
    expect(isVoiceAgentLeg("037386160", "+97237386160")).toBe(true);
    expect(isVoiceAgentLeg("97237386160", "037386160")).toBe(true);
    expect(isVoiceAgentLeg("0504828080", "+97237386160")).toBe(false);
    expect(isVoiceAgentLeg("", "+97237386160")).toBe(false);
    expect(isVoiceAgentLeg("037386160", null)).toBe(false);
  });
});

describe("missed-call WhatsApp × the conversation with Eliran", () => {
  const now = new Date("2026-11-12T10:00:00Z");
  const min = (m: number) => new Date(now.getTime() - m * 60 * 1000);

  it("real outcome while the call is STILL in progress → blocked at once (Or's change 1)", () => {
    expect(missedCallVoiceDecision([{ status: "in_progress", outcome: "meeting_booked", startedAt: min(2) }], now)).toEqual({ action: "block", reason: "voice_agent_conversation" });
    expect(missedCallVoiceDecision([{ status: "in_progress", outcome: "urgent", startedAt: min(1) }], now).action).toBe("block");
  });
  it("real outcome after the call ended → blocked", () => {
    expect(missedCallVoiceDecision([{ status: "ended", outcome: "details_only", startedAt: min(30) }], now).action).toBe("block");
  });
  it("in progress, no real outcome, under 15 minutes → deferred 5 minutes", () => {
    const d = missedCallVoiceDecision([{ status: "in_progress", outcome: null, startedAt: min(4) }], now);
    expect(d).toEqual({ action: "defer", reason: "voice_call_in_progress", until: new Date(now.getTime() + VOICE_WA_DEFER_MS) });
  });
  it("still in progress after 15 minutes, no real outcome → sent as usual (Or's change 2: the cap)", () => {
    expect(missedCallVoiceDecision([{ status: "in_progress", outcome: null, startedAt: min(15) }], now)).toEqual({ action: "send", reason: "voice_wait_cap" });
    expect(missedCallVoiceDecision([{ status: "in_progress", outcome: null, startedAt: min(40) }], now).action).toBe("send");
  });
  it("ended without a real outcome (hung up early / not relevant) → sent", () => {
    expect(missedCallVoiceDecision([{ status: "ended", outcome: "hung_up_early", startedAt: min(5) }], now)).toEqual({ action: "send", reason: "no_real_conversation" });
    expect(missedCallVoiceDecision([{ status: "failed", outcome: null, startedAt: min(70) }], now).action).toBe("send");
    expect(missedCallVoiceDecision([{ status: "ended", outcome: "not_relevant", startedAt: min(5) }], now).action).toBe("send");
  });
  it("no conversation with Eliran → sent", () => {
    expect(missedCallVoiceDecision([], now)).toEqual({ action: "send", reason: "no_voice_call" });
  });
  it("the skip reason has a Hebrew label", () => {
    expect(SKIP_REASON_LABELS.voice_agent_conversation).toContain("אלירן");
  });
});

describe("missedCallVoiceCheck (DB)", () => {
  const start = new Date("2026-11-12T09:58:00Z");

  it("flag off → null, no query (PayCall exactly as before)", async () => {
    expect(await missedCallVoiceCheck("b-alldog", "0541110001", start)).toBeNull();
    expect(vac.findMany).not.toHaveBeenCalled();
  });
  it("another business → null even with the flag on", async () => {
    flagOn();
    expect(await missedCallVoiceCheck("b-other", "0541110001", start)).toBeNull();
    expect(vac.findMany).not.toHaveBeenCalled();
  });
  it("flag on: looks up the same caller from 2 min before to 15 min after the PayCall call", async () => {
    flagOn();
    vac.findMany.mockResolvedValue([{ status: "in_progress", outcome: "meeting_booked", startedAt: new Date("2026-11-12T09:58:25Z"), createdAt: new Date() }]);
    const d = await missedCallVoiceCheck("b-alldog", "+972541110001", start, new Date("2026-11-12T10:01:00Z"));
    expect(d?.action).toBe("block");
    const where = vac.findMany.mock.calls[0][0].where;
    expect(where.callerPhoneNorm).toBe("0541110001");
    expect(where.createdAt.gte.toISOString()).toBe("2026-11-12T09:56:00.000Z");
    expect(where.createdAt.lte.toISOString()).toBe("2026-11-12T10:13:00.000Z");
  });
});

describe("answered-call summaries: skip the calls Eliran answered", () => {
  const eliranCall = { ID: "c1", CALLERID: "0541110001", CALLEE: "037386160", DISPOSITION: "ANSWER", DURATION: "140" };
  const repCall = { ...eliranCall, ID: "c2", CALLEE: "0504828080" };

  it("flag off → never skipped, nothing logged", async () => {
    expect(await skipPaycallSummaryForVoiceAgent(eliranCall, "webhook", 120)).toBe(false);
    expect(console.log).not.toHaveBeenCalled();
  });
  it("flag on: CALLEE = Telnyx → skipped; a rep's call → summarized as usual; both logged", async () => {
    flagOn();
    expect(await skipPaycallSummaryForVoiceAgent(eliranCall, "webhook", 120)).toBe(true);
    expect(await skipPaycallSummaryForVoiceAgent(repCall, "webhook", 120)).toBe(false);
    const lines = (console.log as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(lines[0]).toContain("voiceAgentLeg=true");
    expect(lines[0]).toContain("summary=skipped(voice-agent)");
    expect(lines[1]).toContain("summary=normal");
  });
  it("flag on but ALLDOG_VOICE_AGENT_NUMBER not set → not filtered (as before) + warning + daily alert", async () => {
    flagOn(null);
    expect(await skipPaycallSummaryForVoiceAgent(eliranCall, "webhook", 120)).toBe(false);
    expect(console.warn).toHaveBeenCalled();
    expect(claim).toHaveBeenCalledWith("alldog-voice-agent-number-missing", 24 * 60 * 60);
    expect(notify).toHaveBeenCalledTimes(1);
  });
  it("sync: the line is logged once per call (claimOnce), the skip decision every time", async () => {
    flagOn();
    claim.mockResolvedValueOnce(false);
    expect(await skipPaycallSummaryForVoiceAgent(eliranCall, "sync", 120)).toBe(true);
    expect(console.log).not.toHaveBeenCalled();
  });
});

describe("verification log line", () => {
  it("status, CALLEE, voice-agent leg, duration, talk time, caller last 4 only, what was written", () => {
    const line = paycallVoiceLogLine({
      source: "webhook", callId: "123", disposition: "NOANSWER", callee: "+97237386160", agentNumber: "037386160",
      duration: "95", billsec: null, caller: "0541234567", extra: "missed=lead-line-written",
    });
    expect(line).toBe("[paycall voice-agent] webhook call 123: disposition=NOANSWER callee=037386160 voiceAgentLeg=true duration=95 billsec=? caller=…4567 missed=lead-line-written");
    expect(line).not.toContain("0541234567");
  });
  it("what processMissedCall wrote ('שיחה שלא נענתה' lead line or not)", () => {
    expect(missedCallWriteLabel({ skipped: false, leadId: "l1" })).toBe("lead-line-written");
    expect(missedCallWriteLabel({ skipped: true, leadId: null })).toBe("already-handled");
    expect(missedCallWriteLabel({ skipped: false, customerId: "c1" })).toBe("customer-note");
    expect(missedCallWriteLabel({ skipped: true, customerId: "c1" })).toBe("customer-note-existed");
  });
});

describe("missed-call WhatsApp timing: first check ≥ 2 minutes after the PayCall event", () => {
  const event = new Date("2026-11-12T10:00:00Z");

  it("the delay is 2 minutes", () => {
    expect(VOICE_WA_MIN_DELAY_MS).toBe(2 * 60 * 1000);
  });
  it("an immediate send moves to event + 2 min; a later send (quiet hours) stays as it is", () => {
    expect(firstVoiceCheckAt(event, event).toISOString()).toBe("2026-11-12T10:02:00.000Z");
    const morning = new Date("2026-11-13T06:00:00Z");
    expect(firstVoiceCheckAt(morning, event)).toBe(morning);
  });
  it("flag off → the normal send time, exactly as before (immediate)", async () => {
    expect(await missedCallSendAt(event, event)).toBe(event);
  });
  it("flag on + Telnyx number → event + 2 min", async () => {
    flagOn();
    expect((await missedCallSendAt(event, event)).toISOString()).toBe("2026-11-12T10:02:00.000Z");
  });
  it("flag on but no Telnyx number → as before (immediate) + the daily warning", async () => {
    flagOn(null);
    expect(await missedCallSendAt(event, event)).toBe(event);
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
