/**
 * AllDog voice agent — section 5: ElevenLabs end-of-call webhook rules (signature exactly as the
 * official SDK computes it, payload parsing, transcript cap, callback threshold, real-conversation
 * outcomes for section 6, retry schedule) and the summary format. Pure.
 */
jest.mock("@/lib/prisma", () => ({ __esModule: true, default: {}, prisma: {} }));

import { createHmac } from "crypto";
import {
  SUMMARY_MAX_ATTEMPTS,
  TRANSCRIPT_MAX_CHARS,
  callbackDecision,
  capTranscript,
  hasUserWords,
  isRealVoiceConversation,
  nextSummaryAttemptAt,
  parsePostCall,
  transcriptText,
  verifyElevenLabsSignature,
  type TranscriptTurn,
} from "@/lib/alldog/voice-agent/end-rules";
import { formatVoiceLog, parseVoiceSummary, durationLabel } from "@/lib/alldog/voice-agent/summary";

const SECRET = "wsec_test_123";
/** The header exactly as ElevenLabs' SDK verifies it: t=<s>,v0=hex(HMAC-SHA256(secret, `${t}.${body}`)). */
const sign = (body: string, t: number, secret = SECRET) => `t=${t},v0=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;

describe("ElevenLabs-Signature", () => {
  const body = JSON.stringify({ type: "post_call_transcription", data: { conversation_id: "c1" } });
  const now = 1_763_000_000_000;
  const t = Math.floor(now / 1000);

  it("valid signature → ok", () => {
    expect(verifyElevenLabsSignature(body, sign(body, t), SECRET, now)).toEqual({ ok: true });
  });
  it("tampered body / wrong secret → mismatch", () => {
    expect(verifyElevenLabsSignature(body + " ", sign(body, t), SECRET, now)).toEqual({ ok: false, reason: "mismatch" });
    expect(verifyElevenLabsSignature(body, sign(body, t, "other"), SECRET, now)).toEqual({ ok: false, reason: "mismatch" });
  });
  it("older than 30 minutes → too_old; 29 minutes → ok", () => {
    expect(verifyElevenLabsSignature(body, sign(body, t - 31 * 60), SECRET, now)).toEqual({ ok: false, reason: "too_old" });
    expect(verifyElevenLabsSignature(body, sign(body, t - 29 * 60), SECRET, now)).toEqual({ ok: true });
  });
  it("missing / malformed header", () => {
    expect(verifyElevenLabsSignature(body, null, SECRET, now)).toEqual({ ok: false, reason: "missing_header" });
    expect(verifyElevenLabsSignature(body, "v0=abc", SECRET, now)).toEqual({ ok: false, reason: "malformed" });
    expect(verifyElevenLabsSignature(body, `t=${t}`, SECRET, now)).toEqual({ ok: false, reason: "malformed" });
    expect(verifyElevenLabsSignature(body, `t=abc,v0=00`, SECRET, now)).toEqual({ ok: false, reason: "malformed" });
  });
  it("any of several v0 entries may match (secret rotation)", () => {
    const good = sign(body, t).split(",")[1];
    expect(verifyElevenLabsSignature(body, `t=${t},v0=deadbeef,${good}`, SECRET, now)).toEqual({ ok: true });
  });
});

describe("post_call_transcription payload", () => {
  const payload = {
    type: "post_call_transcription",
    event_timestamp: 1763000000,
    data: {
      agent_id: "agent_x",
      conversation_id: "conv_1",
      status: "done",
      transcript: [
        { role: "agent", message: "שלום, הגעתם ל-AllDog. מדבר אלירן, נציג דיגיטלי.", time_in_call_secs: 0 },
        { role: "user", message: "היי, יש לי כלב שנובח", time_in_call_secs: 4 },
        { role: "agent", message: null, tool_calls: [{ tool_name: "book" }], time_in_call_secs: 30 },
        { role: "user", message: "  ", time_in_call_secs: 31 },
      ],
      metadata: { start_time_unix_secs: 1763000000, call_duration_secs: 95.4, termination_reason: "end_call tool", cost: 120 },
      analysis: { transcript_summary: "The caller has a barking dog.", call_successful: "success" },
      conversation_initiation_client_data: { dynamic_variables: { system__caller_id: "+972501234567", system__call_id: "sip-abc" } },
    },
  };

  it("extracts what we store; tool-only and empty turns are dropped", () => {
    const p = parsePostCall(payload)!;
    expect(p.conversationId).toBe("conv_1");
    expect(p.agentId).toBe("agent_x");
    expect(p.startedAt!.toISOString()).toBe(new Date(1763000000 * 1000).toISOString());
    expect(p.durationSeconds).toBe(95);
    expect(p.turns).toEqual([
      { role: "agent", message: "שלום, הגעתם ל-AllDog. מדבר אלירן, נציג דיגיטלי.", t: 0 },
      { role: "user", message: "היי, יש לי כלב שנובח", t: 4 },
    ]);
    expect(p.callerPhone).toBe("+972501234567");
    expect(p.externalCallId).toBe("sip-abc");
    expect(p.terminationReason).toBe("end_call tool");
    expect(p.providerSummary).toBe("The caller has a barking dog.");
  });

  it("other event types / no conversation id → null (ignored)", () => {
    expect(parsePostCall({ type: "post_call_audio", data: { conversation_id: "x" } })).toBeNull();
    expect(parsePostCall({ type: "call_initiation_failure", data: {} })).toBeNull();
    expect(parsePostCall({ type: "post_call_transcription", data: {} })).toBeNull();
    expect(parsePostCall(null)).toBeNull();
  });

  it("missing caller id (hidden number) → null phone", () => {
    const p = parsePostCall({ ...payload, data: { ...payload.data, conversation_initiation_client_data: {} } })!;
    expect(p.callerPhone).toBeNull();
  });
});

describe("transcript cap — 50,000 characters", () => {
  const turn = (role: "agent" | "user", n: number): TranscriptTurn => ({ role, message: "א".repeat(n), t: null });

  it("under the cap → unchanged", () => {
    const turns = [turn("agent", 100), turn("user", 200)];
    expect(capTranscript(turns)).toEqual({ turns, omittedTurns: 0 });
  });

  it("over the cap → first + last halves and an 'omitted' marker, total ≤ cap", () => {
    const turns = Array.from({ length: 100 }, (_, i) => turn(i % 2 ? "user" : "agent", 1000)); // 100,000 chars
    const r = capTranscript(turns);
    expect(r.omittedTurns).toBe(50);
    expect(r.turns).toHaveLength(51);
    expect(r.turns[25].message).toBe("… הושמטו 50 תורים מאמצע השיחה …");
    expect(r.turns.filter((t) => !t.message.startsWith("…")).reduce((n, t) => n + t.message.length, 0)).toBeLessThanOrEqual(TRANSCRIPT_MAX_CHARS);
    expect(r.turns[0]).toBe(turns[0]);
    expect(r.turns[50]).toBe(turns[99]);
  });

  it("speaker lines for the summary model", () => {
    expect(transcriptText([{ role: "agent", message: "שלום", t: 0 }, { role: "user", message: "היי", t: 1 }])).toBe("אלירן: שלום\nמתקשר: היי");
  });
});

describe("callback task after a call without /book or /details", () => {
  const base = { outcome: null, phoneNorm: "0501234567", durationSeconds: 40, userWords: true };
  it("normal call with a number → task", () => {
    expect(callbackDecision(base)).toEqual({ open: true });
  });
  it("/book or /details already ran (any outcome) → no extra task", () => {
    for (const outcome of ["meeting_booked", "details_only", "urgent", "hung_up_early", "not_relevant"]) {
      expect(callbackDecision({ ...base, outcome })).toEqual({ open: false, reason: "tool_outcome" });
    }
  });
  it("hidden number → no task", () => {
    expect(callbackDecision({ ...base, phoneNorm: null })).toEqual({ open: false, reason: "hidden_number" });
  });
  it("under 10 seconds AND the caller said nothing → no task", () => {
    expect(callbackDecision({ ...base, durationSeconds: 9, userWords: false })).toEqual({ open: false, reason: "silent_short_call" });
  });
  it("short but the caller spoke, or silent but long → task", () => {
    expect(callbackDecision({ ...base, durationSeconds: 6, userWords: true })).toEqual({ open: true });
    expect(callbackDecision({ ...base, durationSeconds: 15, userWords: false })).toEqual({ open: true });
  });
  it("user words = letters or digits, not blanks / punctuation", () => {
    expect(hasUserWords([{ role: "user", message: "...", t: 1 }, { role: "agent", message: "שלום", t: 0 }])).toBe(false);
    expect(hasUserWords([{ role: "user", message: "כן", t: 1 }])).toBe(true);
  });
});

describe("section 6 needs: a real conversation is told apart from an early hang-up", () => {
  it("booked / details / urgent = real conversation (missed-call WhatsApp will be blocked)", () => {
    expect(isRealVoiceConversation("meeting_booked")).toBe(true);
    expect(isRealVoiceConversation("details_only")).toBe(true);
    expect(isRealVoiceConversation("urgent")).toBe(true);
  });
  it("hung up early / not relevant / no outcome = not (keeps getting the missed-call WhatsApp)", () => {
    expect(isRealVoiceConversation("hung_up_early")).toBe(false);
    expect(isRealVoiceConversation("not_relevant")).toBe(false);
    expect(isRealVoiceConversation(null)).toBe(false);
  });
});

describe("summary retries", () => {
  const now = new Date("2026-11-12T10:00:00Z");
  it("+3, +10, +30 min, +2 h, then final", () => {
    expect(SUMMARY_MAX_ATTEMPTS).toBe(5);
    expect([1, 2, 3, 4].map((a) => (nextSummaryAttemptAt(a, now)!.getTime() - now.getTime()) / 60000)).toEqual([3, 10, 30, 120]);
    expect(nextSummaryAttemptAt(5, now)).toBeNull();
  });
});

describe("summary parsing + the lead journal line", () => {
  it("'' = not said → null; urgency only low/medium/high", () => {
    const s = parseVoiceSummary(JSON.stringify({ summary: "דנה מכפר סבא, רקס נובח על אורחים.", dog: "רקס", breed: "", age: "", city: "כפר סבא", problem: "נביחות", urgency: "x", relevant: true, notes: "" }))!;
    expect(s).toMatchObject({ dog: "רקס", breed: null, age: null, city: "כפר סבא", urgency: null, relevant: true, notes: null });
    expect(parseVoiceSummary("not json")).toBeNull();
    expect(parseVoiceSummary(JSON.stringify({ summary: "" }))).toBeNull();
  });

  it("journal line: header with time + duration, facts, outcome", () => {
    const text = formatVoiceLog({
      startedAt: new Date("2026-11-12T08:31:00Z"), durationSeconds: 200, summary: "דנה מכפר סבא, רקס נובח על אורחים.",
      dog: "רקס", breed: "לברדור", age: "שנתיים", city: "כפר סבא", problem: "נביחות על אורחים", urgency: "medium", notes: null,
      outcomeLine: "נקבעה שיחה טלפונית עם רחלי ליום ראשון 15/11 בשעה 10:20",
    });
    expect(text.split("\n")).toEqual([
      "[שיחה קולית · אלירן] סיכום שיחה (12/11 10:31 · 3:20 דק׳)",
      "דנה מכפר סבא, רקס נובח על אורחים.",
      "כלב: רקס · לברדור · שנתיים",
      "עיר: כפר סבא",
      "הבעיה: נביחות על אורחים",
      "דחיפות: בינונית",
      "תוצאה: נקבעה שיחה טלפונית עם רחלי ליום ראשון 15/11 בשעה 10:20",
    ]);
  });

  it("fallback note appears on the ElevenLabs summary; duration label", () => {
    expect(formatVoiceLog({ startedAt: null, durationSeconds: null, summary: "x", outcomeLine: "y", fallbackNote: "(סיכום אוטומטי של ElevenLabs)" })).toContain("(סיכום אוטומטי של ElevenLabs)");
    expect(durationLabel(65)).toBe("1:05 דק׳");
  });
});
