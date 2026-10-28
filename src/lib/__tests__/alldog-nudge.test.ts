/**
 * Or, 27/10 ("38 – תיקון"): one reminder after 4–6 min of silence, then after 2 h a human closing
 * (closed_partial + summary with "לא השלים" + task). Night → no reminder, closing at 08:00. "תודה" → nothing.
 */
import { israelInstant } from "@/lib/alldog/time";
import {
  CLOSE_AFTER_NUDGE_MS,
  decideNudge,
  FORBIDDEN_NUDGE_RE,
  isBotQuestion,
  isThanksOrBye,
  missingDetails,
  notCompletedFact,
  nudgeDelayMs,
  nudgePool,
  NUDGE_KIND,
  NUDGE_DELAY_MAX_MS,
  NUDGE_DELAY_MIN_MS,
  PARTIAL_CLOSE_KIND,
  partialClosingText,
  partialResumeNote,
  pickNudge,
  VOICE_NUDGE,
  type NudgeMessage,
} from "@/lib/alldog-bot/nudge-rules";
import { withFact, withoutFact } from "@/lib/alldog-bot/journal";
import { findAddressIssues } from "@/lib/alldog-bot/address";

const il = (ymd: string, hhmm: string) => israelInstant(ymd, hhmm);
const min = 60 * 1000;
const at = (d: Date, ms: number) => new Date(d.getTime() + ms);

function conv(lastBotAt: Date, opts: { botText?: string; userText?: string; extra?: NudgeMessage[] } = {}): NudgeMessage[] {
  return [
    { id: "u1", role: "user", kind: "text", text: opts.userText ?? "היי, יש לי כלב שנובח על כל מי שעובר", createdAt: at(lastBotAt, -min) },
    { id: "b1", role: "assistant", kind: "text", text: opts.botText ?? "מבין. איך קוראים לך ולכלב?", createdAt: lastBotAt },
    ...(opts.extra ?? []),
  ];
}
const decide = (messages: NudgeMessage[], now: Date, status = "active", lastHumanAt: Date | null = null) =>
  decideNudge({ status, lastHumanAt, messages, now });

describe("Or's 4 checks", () => {
  const t0 = il("2026-10-27", "11:00"); // Tuesday, office open
  const delay = nudgeDelayMs("b1");

  it("5 minutes of silence → exactly one reminder", () => {
    expect(delay).toBeGreaterThanOrEqual(NUDGE_DELAY_MIN_MS);
    expect(delay).toBeLessThan(NUDGE_DELAY_MAX_MS);
    expect(decide(conv(t0), at(t0, 3 * min)).action).toBe("wait");
    expect(decide(conv(t0), at(t0, 6 * min))).toEqual({ action: "nudge", anchorId: "b1" });
    // After the reminder went out: no second reminder, only the closing timer.
    const nudge: NudgeMessage = { id: "n1", role: "assistant", kind: NUDGE_KIND, text: "?", createdAt: at(t0, 6 * min) };
    expect(decide(conv(t0, { extra: [nudge] }), at(t0, 30 * min)).action).toBe("wait");
  });

  it("2 more hours of silence → the closing (task + summary are done by the runner)", () => {
    const nudge: NudgeMessage = { id: "n1", role: "assistant", kind: NUDGE_KIND, text: "?", createdAt: at(t0, 5 * min) };
    const msgs = conv(t0, { extra: [nudge] });
    expect(decide(msgs, at(nudge.createdAt, CLOSE_AFTER_NUDGE_MS - min)).action).toBe("wait");
    expect(decide(msgs, at(nudge.createdAt, CLOSE_AFTER_NUDGE_MS))).toEqual({ action: "close", anchorId: "n1" });
    // After the closing: nothing more.
    const closing: NudgeMessage = { id: "c1", role: "assistant", kind: PARTIAL_CLOSE_KIND, text: "…", createdAt: at(t0, 3 * 60 * min) };
    expect(decide([...msgs, closing], at(t0, 5 * 60 * min)).action).toBe("none");
  });

  it("night → no reminder, the closing at 08:00", () => {
    const night = il("2026-10-27", "23:10");
    const msgs = conv(night);
    const d = decide(msgs, at(night, 6 * min));
    expect(d.action).toBe("wait");
    expect(d.action === "wait" && d.until.getTime()).toBe(il("2026-10-28", "08:00").getTime());
    expect(decide(msgs, il("2026-10-28", "07:59")).action).toBe("wait");
    expect(decide(msgs, il("2026-10-28", "08:00"))).toEqual({ action: "close", anchorId: "b1" });
    // A question at 21:00 → reminder at ~21:05, closing at 23:05 → moved to 08:00.
    const evening = il("2026-10-27", "21:00");
    const nudge: NudgeMessage = { id: "n1", role: "assistant", kind: NUDGE_KIND, text: "?", createdAt: at(evening, 5 * min) };
    const d2 = decide(conv(evening, { extra: [nudge] }), il("2026-10-27", "23:30"));
    expect(d2.action === "wait" && d2.until.getTime()).toBe(il("2026-10-28", "08:00").getTime());
  });

  it('"תודה" → nothing', () => {
    const msgs = conv(t0, { userText: "תודה רבה!", botText: "בשמחה. יש עוד משהו שאפשר לעזור?" });
    expect(decide(msgs, at(t0, 10 * min)).action).toBe("none");
    expect(decide(msgs, at(t0, 5 * 60 * min)).action).toBe("none");
    expect(isThanksOrBye("ביי")).toBe(true);
    expect(isThanksOrBye("תודה, נדבר")).toBe(true);
    expect(isThanksOrBye("תודה, הכלב שלי בן 3 ונובח על כל אחד שעובר ליד הבית כל היום")).toBe(false);
  });
});

describe("when there is never a reminder", () => {
  const t0 = il("2026-10-27", "11:00");
  it("the bot's last message is not a question", () => {
    expect(decide(conv(t0, { botText: "מעולה, רשמתי." }), at(t0, 10 * min)).action).toBe("none");
  });
  it("a rep is in the conversation", () => {
    expect(decide(conv(t0), at(t0, 10 * min), "handoff").action).toBe("none");
    expect(decide(conv(t0), at(t0, 10 * min), "active", at(t0, -30 * min)).action).toBe("none");
    const human: NudgeMessage = { id: "h", role: "human", kind: "text", text: "היי", createdAt: at(t0, -2 * min) };
    expect(decide([human, ...conv(t0)], at(t0, 10 * min)).action).toBe("none");
  });
  it("after the regular closing", () => {
    const closing = "מעולה, רשמתי הכל 🙏 אני דואג שנציגת AllDog תחזור אליך טלפונית בהקדם. אם יש עוד משהו?";
    expect(decide(conv(t0, { botText: closing }), at(t0, 10 * min)).action).toBe("none");
  });
  it("the customer wrote last / never wrote", () => {
    const msgs = [...conv(t0), { id: "u2", role: "user", kind: "text", text: "רגע", createdAt: at(t0, min) }];
    expect(decide(msgs, at(t0, 10 * min)).action).toBe("none");
    expect(decide([conv(t0)[1]], at(t0, 10 * min)).action).toBe("none");
  });
  it("a late cron run (>20 min) skips the reminder; the closing still follows", () => {
    expect(decide(conv(t0), at(t0, 40 * min)).action).toBe("wait");
    expect(decide(conv(t0), at(t0, 2 * 60 * min + 7 * min)).action).toBe("close");
  });
});

describe("texts", () => {
  it("question detection ignores a trailing emoji", () => {
    expect(isBotQuestion("מבין.\nבאיזו עיר? 🙂")).toBe(true);
    expect(isBotQuestion("כתבנו על זה מדריך:\nhttps://all-dog.co.il/guides/x")).toBe(false);
  });
  it("the pool: '?', the name only when known, the voice line; never a system-sounding text", () => {
    expect(nudgePool(null)).toEqual(["?", VOICE_NUDGE]);
    expect(nudgePool("דנה")).toEqual(["?", "דנה?", VOICE_NUDGE]);
    for (const t of nudgePool("דנה")) expect(t).not.toMatch(FORBIDDEN_NUDGE_RE);
  });
  it("never the same reminder twice in a conversation", () => {
    expect(pickNudge("דנה", ["?", "דנה?"], "x")).toBe(VOICE_NUDGE);
    expect(pickNudge(null, ["?", VOICE_NUDGE], "x")).toBeNull();
  });
  it("the closing: singular by gender, name when known, callback phrase, varies between conversations", () => {
    const f = partialClosingText({ firstName: "מיכל", gender: "f", phrase: "בהקדם", seed: "c-1" });
    expect(f.startsWith("מיכל, ")).toBe(true);
    expect(f).toContain("אלייך בהקדם");
    expect(f).toContain("אני כאן");
    const m = partialClosingText({ firstName: null, gender: "m", phrase: "מחר בבוקר", seed: "c-1" });
    expect(m).toContain("אליך מחר בבוקר");
    expect(m).not.toMatch(/^,/);
    const n = partialClosingText({ firstName: null, gender: "unknown", phrase: "בהקדם", seed: "c-1" });
    expect(n).toContain("תחזור בטלפון בהקדם");
    expect(n).not.toMatch(/תכתבי|תכתוב/);
    const all = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map((seed) => partialClosingText({ firstName: null, gender: "m", phrase: "בהקדם", seed })));
    expect(all.size).toBeGreaterThan(1);
    for (const t of [f, m, n]) expect(t).not.toMatch(FORBIDDEN_NUDGE_RE);
    expect(findAddressIssues(f, { gender: "f", plural: false })).toEqual([]);
    expect(findAddressIssues(m, { gender: "m", plural: false })).toEqual([]);
  });
});

describe("summary + resume", () => {
  const sum = { dog_name: "רקסי", dog_breed: null, dog_age: null, problem: "נובח", city: null };
  it('"לא השלים: …" lists what is missing', () => {
    expect(missingDetails(sum, true)).toEqual(["עיר", "גזע", "גיל הכלב"]);
    expect(missingDetails(sum, false)[0]).toBe("שם");
    expect(notCompletedFact(["עיר"])).toBe("לא השלים: עיר · הלקוח הפסיק לענות באמצע");
    expect(notCompletedFact([])).toContain("הפרטים הבסיסיים נאספו");
    expect(notCompletedFact(null)).toContain("לא השלים");
  });
  it("one 'לא השלים' fact per conversation; removed when the customer is back", () => {
    let log = withFact("[וואטסאפ · בוט] סיכום שיחה (27/10 11:00)", notCompletedFact(["עיר", "גזע"]));
    log = withFact(log, notCompletedFact(["גזע"]));
    expect(log.match(/לא השלים/g)).toHaveLength(1);
    expect(withoutFact(log, "לא השלים")).not.toContain("לא השלים");
  });
  it("resume note: collect only what is missing", () => {
    const note = partialResumeNote(["עיר", "גזע"]);
    expect(note).toContain("רק את מה שחסר: עיר, גזע");
    expect(note).toContain("אל תשאל שוב");
  });
});
