/**
 * AllDog WhatsApp bot — pure rules: debounce, identity answer, attribution line,
 * silence after handoff / stop, media, reply shaping, office hours, tool loop.
 */
import type Anthropic from "@anthropic-ai/sdk";
import {
  botMayReply,
  classifyInbound,
  isStopRequest,
  isWithin24hWindow,
  parseAttributionLine,
  polishReply,
  splitReply,
  toChatTurns,
  typingDelayMs,
  waitForQuiet,
} from "@/lib/alldog-bot/logic";
import {
  ALLDOG_BOT_PROMPT,
  BOT_QUESTION_ANSWER,
  HUMAN_QUESTION_ANSWER,
  enforceIdentityAnswer,
  identityAnswerFor,
  mentionsHumanBite,
} from "@/lib/alldog-bot/prompt";
import { runBotTurn, type BotToolExecutor } from "@/lib/alldog-bot/agent";
import { isWithinOfficeHours, nextCallbackOptions } from "@/lib/alldog/time";

describe("debounce (waitForQuiet)", () => {
  it("continues only when this message is still the latest after the quiet period", async () => {
    const waits: number[] = [];
    const sleep = async (ms: number) => {
      waits.push(ms);
    };
    let latest = "m1";
    // A second message arrives during m1's wait → m1's run stops, m2's run answers.
    const m1 = waitForQuiet({
      myMessageId: "m1",
      latestInboundId: async () => latest,
      sleep: async (ms) => {
        await sleep(ms);
        latest = "m2";
      },
    });
    expect(await m1).toBe(false);
    expect(await waitForQuiet({ myMessageId: "m2", latestInboundId: async () => latest, sleep })).toBe(true);
    expect(waits).toEqual([6000, 6000]);
  });

  it("a lone message goes on", async () => {
    expect(await waitForQuiet({ myMessageId: "a", latestInboundId: async () => "a", sleep: async () => {} })).toBe(true);
  });
});

describe("identity answer", () => {
  it('"אתה בן אדם ?" always gets the fixed answer', () => {
    expect(identityAnswerFor("אתה בן אדם ?")).toBe(HUMAN_QUESTION_ANSWER);
    expect(identityAnswerFor("אתה בנאדם?")).toBe(HUMAN_QUESTION_ANSWER);
    expect(HUMAN_QUESTION_ANSWER).toBe("לא , אני העוזר המנהלתי של צוות המשרד של AllDog 🙂");
  });

  it('"זה בוט ?" gets the bot answer, other text gets none', () => {
    expect(identityAnswerFor("זה בוט ?")).toBe(BOT_QUESTION_ANSWER);
    expect(identityAnswerFor("הכלב שלי נושך")).toBeNull();
  });

  it("replaces a free-form answer but keeps the next question", () => {
    const out = enforceIdentityAnswer("אתה בן אדם ?", "אני נציג וירטואלי\nאיך קוראים לכלב ?");
    expect(out).toBe(`${HUMAN_QUESTION_ANSWER}\n\nאיך קוראים לכלב ?`);
    expect(out).not.toContain("וירטואלי");
  });

  it("leaves a correct answer untouched", () => {
    const ok = "לא , אני העוזר המנהלתי של צוות המשרד של AllDog 🙂\nאיך קוראים לכלב ?";
    expect(enforceIdentityAnswer("אתה בן אדם ?", ok)).toBe(ok);
  });

  it("the system prompt carries the exact wording and never claims to be human", () => {
    expect(ALLDOG_BOT_PROMPT).toContain(HUMAN_QUESTION_ANSWER);
    expect(ALLDOG_BOT_PROMPT).toContain(BOT_QUESTION_ANSWER);
    expect(ALLDOG_BOT_PROMPT).toContain("אף פעם אל תטען שאתה אדם");
  });
});

describe("human bite → immediate handoff", () => {
  it("detects a bite or attack on a person", () => {
    for (const t of [
      "הכלב שלי נשך את הבן שלי אתמול ביד, אני ממש בלחץ",
      "היא נשכה את השכן",
      "הוא תקף ילד בגינה",
      "הילד ננשך ממנו",
      "נשך אותי ברגל",
    ]) expect(mentionsHumanBite(t)).toBe(true);
  });

  it("ignores 'no bites' and questions about other things", () => {
    for (const t of [
      "נובח בעיקר כשאנחנו יוצאים מהבית, התחיל לפני חודש. לא נשך אף אחד",
      "בלי נשיכות, רק נביחות",
      "הוא מושך ברצועה",
      "כמה עולה אילוף אינטנסיבי ?",
    ]) expect(mentionsHumanBite(t)).toBe(false);
  });

  it("the prompt forbids questions before an urgent handoff", () => {
    expect(ALLDOG_BOT_PROMPT).toContain("בלי לשאול אף שאלה נוספת");
    expect(ALLDOG_BOT_PROMPT).not.toContain("אחרי שאספת את המינימום");
  });
});

describe("attribution line", () => {
  it("parses source + page and strips the line", () => {
    const p = parseAttributionLine("היי, הכלב שלי נובח על אורחים (הגעתי דרך: גוגל · /guides/barking)");
    expect(p).toEqual({ source: "גוגל", page: "/guides/barking", text: "היי, הכלב שלי נובח על אורחים" });
  });

  it("source only, extra spaces", () => {
    expect(parseAttributionLine("שלום ( הגעתי דרך :  פייסבוק )")).toEqual({ source: "פייסבוק", page: null, text: "שלום" });
  });

  it("no line → unchanged", () => {
    expect(parseAttributionLine("שלום (בלי שיוך)")).toEqual({ source: null, page: null, text: "שלום (בלי שיוך)" });
  });
});

describe("silence", () => {
  const now = new Date("2026-10-23T10:00:00Z");
  const recent = new Date("2026-10-23T09:00:00Z");

  it("stays silent after handoff and after stop", () => {
    expect(botMayReply({ status: "active", lastInboundAt: recent }, now)).toBe(true);
    expect(botMayReply({ status: "handoff", lastInboundAt: recent }, now)).toBe(false);
    expect(botMayReply({ status: "stopped", lastInboundAt: recent }, now)).toBe(false);
  });

  it("never sends outside the 24h window", () => {
    expect(isWithin24hWindow(new Date("2026-10-22T09:00:00Z"), now)).toBe(false);
    expect(isWithin24hWindow(null, now)).toBe(false);
    expect(botMayReply({ status: "active", lastInboundAt: new Date("2026-10-22T10:30:00Z") }, now)).toBe(true);
  });

  it("stop phrases", () => {
    for (const t of ["תעצור", "די", "די!", "לא מעוניין", "אני לא מעוניינת תודה", "תפסיקו לשלוח לי"]) expect(isStopRequest(t)).toBe(true);
    for (const t of ["דיברתי עם המאלף", "הכלב לא מפסיק לנבוח", "די הרבה זמן זה קורה"]) expect(isStopRequest(t)).toBe(false);
  });

  it("ignores groups, statuses and system messages; media is flagged", () => {
    expect(classifyInbound({ id: "1", from: "972501234567", type: "text", text: { body: "היי" } })).toEqual({ kind: "text", text: "היי" });
    expect(classifyInbound({ id: "1", from: "972501234567", type: "text", text: { body: "x" }, group_id: "g" }).kind).toBe("ignore");
    expect(classifyInbound({ id: "1", from: "status@broadcast", type: "image" }).kind).toBe("ignore");
    expect(classifyInbound({ id: "1", from: "972501234567", type: "system" }).kind).toBe("ignore");
    expect(classifyInbound({ id: "1", from: "972501234567", type: "reaction" }).kind).toBe("ignore");
    expect(classifyInbound({ id: "1", from: "972501234567", type: "audio" })).toEqual({ kind: "media", label: "הודעה קולית" });
    expect(classifyInbound({ id: "1", from: "972501234567", type: "button", button: { text: "כן" } })).toEqual({ kind: "text", text: "כן" });
  });
});

describe("reply shaping", () => {
  it("splits into at most two messages", () => {
    expect(splitReply("שורה אחת")).toEqual(["שורה אחת"]);
    expect(splitReply("א\n\nב\n\nג")).toEqual(["א", "ב\nג"]);
    expect(splitReply("א\nב")).toEqual(["א", "ב"]);
    const long = `${"מילה ".repeat(40)}. ${"עוד ".repeat(40)}`;
    expect(splitReply(long).length).toBe(2);
  });

  it("typing pause is 2–8 seconds by length", () => {
    expect(typingDelayMs("היי")).toBe(2000);
    expect(typingDelayMs("x".repeat(1000))).toBe(8000);
    const mid = typingDelayMs("x".repeat(60));
    expect(mid).toBeGreaterThan(2000);
    expect(mid).toBeLessThan(8000);
  });

  it("removes em dashes, bold and trailing periods", () => {
    expect(polishReply("**מעולה** — נמשיך.")).toBe("מעולה , נמשיך");
  });

  it("history → alternating turns, starting with the customer", () => {
    expect(
      toChatTurns([
        { role: "assistant", text: "x" },
        { role: "user", text: "a" },
        { role: "user", text: "b" },
        { role: "assistant", text: "c" },
      ])
    ).toEqual([
      { role: "user", content: "a\nb" },
      { role: "assistant", content: "c" },
    ]);
  });
});

describe("office hours", () => {
  it("Sun–Thu 09–17, Fri 09–14, closed Saturday", () => {
    expect(isWithinOfficeHours("2026-10-25", "09:00")).toBe(true); // Sunday
    expect(isWithinOfficeHours("2026-10-25", "16:30")).toBe(true);
    expect(isWithinOfficeHours("2026-10-25", "17:00")).toBe(false);
    expect(isWithinOfficeHours("2026-10-23", "13:30")).toBe(true); // Friday
    expect(isWithinOfficeHours("2026-10-23", "14:00")).toBe(false);
    expect(isWithinOfficeHours("2026-10-24", "10:00")).toBe(false); // Saturday
  });

  it("callback options skip Saturday and are in office hours", () => {
    const opts = nextCallbackOptions(new Date("2026-10-23T12:30:00Z"), 3); // Fri 15:30 Israel
    expect(opts).toHaveLength(3);
    expect(opts[0].ymd).toBe("2026-10-25");
    for (const o of opts) expect(isWithinOfficeHours(o.ymd, o.hhmm)).toBe(true);
  });
});

describe("runBotTurn", () => {
  function fakeClient(responses: Array<Partial<Anthropic.Message>>) {
    const create = jest.fn(async () => responses.shift());
    return { client: { messages: { create } } as unknown as Anthropic, create };
  }
  const executor = (): BotToolExecutor & { calls: string[] } => {
    const calls: string[] = [];
    return {
      calls,
      saveLead: async () => {
        calls.push("save");
        return "נשמר";
      },
      scheduleCallback: async () => {
        calls.push("schedule");
        return "נקבע";
      },
      handoff: async () => {
        calls.push("handoff");
        return "הועבר";
      },
    };
  };

  it("runs a handoff tool, then returns the final short message", async () => {
    const { client, create } = fakeClient([
      {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "handoff_to_human", input: { reason: "נשיכה של ילד", urgency: "urgent" } } as Anthropic.ToolUseBlock],
      },
      { stop_reason: "end_turn", content: [{ type: "text", text: "נציגה תחזור אליך בהקדם 🙂." } as Anthropic.TextBlock] },
    ]);
    const ex = executor();
    const r = await runBotTurn({ client, model: "m", context: "ctx", history: [{ role: "user", content: "הכלב נשך ילד" }], executor: ex });
    expect(ex.calls).toEqual(["handoff"]);
    expect(r.handedOff).toBe(true);
    expect(r.reply).toBe("נציגה תחזור אליך בהקדם 🙂");
    // The tool result goes back in one user turn after the assistant's tool_use.
    const second = (create.mock.calls[1] as unknown as [Anthropic.MessageCreateParams])[0];
    expect(second.messages.at(-1)).toMatchObject({ role: "user", content: [{ type: "tool_result", tool_use_id: "t1" }] });
  });

  it("invalid tool input comes back as an error result, not a crash", async () => {
    const { client, create } = fakeClient([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "schedule_callback", input: { date: "מחר", time: "10" } } as Anthropic.ToolUseBlock] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "מתי נוח לך ?" } as Anthropic.TextBlock] },
    ]);
    const ex = executor();
    const r = await runBotTurn({ client, model: "m", context: "c", history: [{ role: "user", content: "מחר" }], executor: ex });
    expect(ex.calls).toEqual([]);
    expect(r.handedOff).toBe(false);
    const second = (create.mock.calls[1] as unknown as [Anthropic.MessageCreateParams])[0];
    expect(second.messages.at(-1)).toMatchObject({ content: [{ type: "tool_result", is_error: true }] });
  });
});
