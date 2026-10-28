/**
 * AllDog bot — professional knowledge (lookup_guide), Or's opening, and the knowledge build helpers.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { KNOWLEDGE, lookupGuide, searchKnowledge, tokens } from "@/lib/alldog-bot/knowledge";
import {
  forbiddenIn,
  guideUrl,
  parseFrontmatter,
  parseToolsPage,
  readGuide,
  reusable,
  toolEntry,
  validateInsights,
} from "@/lib/alldog-bot/knowledge-build";
import {
  ALLDOG_BOT_PROMPT,
  OPENING_GREETING,
  OPENING_LINE,
  enforceOpening,
  isBareGreeting,
} from "@/lib/alldog-bot/prompt";
import { BOT_TOOLS, runBotTurn, type BotToolExecutor } from "@/lib/alldog-bot/agent";

describe("knowledge-data.json", () => {
  const entries = KNOWLEDGE.entries;

  it("has every guide + the tools, each with a valid card", () => {
    expect(entries.filter((e) => e.kind === "guide").length).toBeGreaterThanOrEqual(40);
    expect(entries.filter((e) => e.kind === "tool").length).toBeGreaterThanOrEqual(3);
    for (const e of entries) {
      expect(e.url).toMatch(/^https:\/\/all-dog\.co\.il\/guides\//);
      expect(e.keywords.length).toBeGreaterThan(0);
      if (e.kind === "guide") {
        expect(validateInsights({ topic: e.topic, insights: e.insights, whenToRecommend: e.whenToRecommend })).toEqual([]);
      }
    }
  });

  it("slugs are unique", () => {
    const keys = entries.map((e) => `${e.kind}:${e.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("follows the site's messaging rules (no own pension, no prices, no promises)", () => {
    const text = entries.map((e) => [e.topic, e.whenToRecommend, ...e.insights].join("\n")).join("\n");
    expect(forbiddenIn(text)).toEqual([]);
    expect(forbiddenIn("לפי משקל הכלב")).toEqual([]);
    expect(forbiddenIn("עולה 300 שקל")).toEqual(["שקל"]);
    expect(text).not.toMatch(/אצלנו|הפנסיון שלנו/);
  });
});

describe("searchKnowledge / lookup_guide", () => {
  it.each([
    ["רודף אחרי חתולים", "prey-drive"],
    ["נובח על כל מי שעובר ליד הגדר", /territorial-behavior|barking/],
    ["מושך ברצועה כל הטיול", /leash-pulling|loose-leash-walking/],
    ["בוכה ומייללת כשאנחנו יוצאים מהבית", /separation-anxiety|home-alone-training/],
    ["גור נושך ידיים ונעליים", "puppy-mouthing"],
    ["לא מגיע כשקוראים לו", "recall-training"],
    ["עושה צרכים בבית", "house-training"],
    ["אכל שוקולד", "chocolate-calculator"],
  ])("%s → %s", (q, expected) => {
    const slugs = searchKnowledge(q).map((m) => m.entry.slug);
    expect(slugs.length).toBeGreaterThan(0);
    if (typeof expected === "string") expect(slugs[0]).toBe(expected);
    else expect(slugs[0]).toMatch(expected);
  });

  it("returns at most 2 cards, with link and insights", () => {
    const out = lookupGuide("רודף אחרי חתולים");
    expect(out).toContain("https://all-dog.co.il/guides/behavior/prey-drive");
    expect(out).toContain("תובנות:");
    expect(out).toContain("המערכת מציעה אותו ללקוח"); // item 39: the guide is offered by the system, never sent by the model
    expect(searchKnowledge("נובח על עוברים").length).toBeLessThanOrEqual(2);
  });

  it("no match → tells the model not to invent", () => {
    expect(searchKnowledge("מתכון לעוגת גבינה")).toEqual([]);
    expect(lookupGuide("מתכון לעוגת גבינה")).toContain("אל תמציא");
  });

  it("tokens strip glued prefixes and stop words", () => {
    expect(tokens("והחתולים של הכלב")).toEqual(expect.arrayContaining(["והחתולים", "חתולים"]));
    expect(tokens("של הכלב")).toEqual([]);
  });
});

describe("Or's opening", () => {
  it("is the exact line in the prompt", () => {
    expect(OPENING_LINE).toBe("היי, מה קורה? כאן צוות AllDog 🙂 אשמח לשמוע בקצרה על הכלב");
    expect(ALLDOG_BOT_PROMPT).toContain(OPENING_LINE);
    expect(ALLDOG_BOT_PROMPT).toContain("lookup_guide");
    expect(ALLDOG_BOT_PROMPT).toContain("לא נותנים תוכנית אילוף");
  });

  it.each(["היי", "הי!", "שלום", "אהלן 🙂", "בוקר טוב", "היי מה קורה?".replace(" מה קורה", "")])("bare greeting: %s", (t) => {
    expect(isBareGreeting(t)).toBe(true);
  });

  it.each(["כמה זה עולה?", "היי , הכלב שלי נובח", "יש לי כלבה שרודפת אחרי חתולים"])("not a bare greeting: %s", (t) => {
    expect(isBareGreeting(t)).toBe(false);
  });

  it("bare greeting → exactly Or's line", () => {
    expect(enforceOpening(true, "היי", "היי , כאן AllDog 🙂 איך קוראים לכלב ?")).toBe(OPENING_LINE);
  });

  it("customer already told something → greeting + the model's reaction, old greeting dropped", () => {
    expect(enforceOpening(true, "הכלב שלי נובח על עוברים", "נביחות על עוברים זה מתיש , בן כמה הוא ?")).toBe(
      `${OPENING_GREETING}\n\nנביחות על עוברים זה מתיש , בן כמה הוא ?`
    );
    expect(enforceOpening(true, "כמה זה עולה?", "היי , כאן AllDog 🙂 שיחת ייעוץ חינם")).toBe(`${OPENING_GREETING}\n\nשיחת ייעוץ חינם`);
    const already = `${OPENING_GREETING} שיחת ייעוץ חינם`;
    expect(enforceOpening(true, "כמה זה עולה?", already)).toBe(already);
  });

  it("does nothing after the first reply", () => {
    expect(enforceOpening(false, "היי", "בן כמה הוא ?")).toBe("בן כמה הוא ?");
  });
});

describe("lookup_guide inside a bot turn", () => {
  it("is offered to the model and answered locally (no executor)", async () => {
    expect(BOT_TOOLS.map((t) => t.name)).toContain("lookup_guide");
    const create = jest
      .fn()
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "lookup_guide", input: { topic: "רודף אחרי חתולים" } }],
      })
      .mockResolvedValueOnce({ stop_reason: "end_turn", content: [{ type: "text", text: "יצר צייד זה טבעי" }] });
    const executor = { saveLead: jest.fn(), scheduleCallback: jest.fn(), handoff: jest.fn() } as unknown as BotToolExecutor;
    const r = await runBotTurn({
      client: { messages: { create } } as unknown as Anthropic,
      model: "m",
      context: "",
      history: [{ role: "user", content: "רודפת אחרי חתולים" }],
      executor,
    });
    expect(r.reply).toBe("יצר צייד זה טבעי");
    expect(r.toolsUsed).toEqual(["lookup_guide"]);
    const toolResult = create.mock.calls[1][0].messages.at(-1).content[0];
    expect(toolResult.content).toContain("prey-drive");
    expect(toolResult.is_error).toBeUndefined();
  });
});

describe("knowledge build helpers", () => {
  const mdx = `---
title: "כלב נובח"
description: "תיאור"
category: "behavior"
slug: "barking"
tldr: "תקציר"
keywords:
  - "כלב נובח"
  - "נביחות"
faq:
  - q: "שאלה?"
    a: "תשובה"
relatedSlugs:
  - "reactive-dog"
---

גוף המאמר`;

  it("parses the front matter it needs and skips nested blocks", () => {
    const { data, body } = parseFrontmatter(mdx);
    expect(data.title).toBe("כלב נובח");
    expect(data.keywords).toEqual(["כלב נובח", "נביחות"]);
    expect(data.relatedSlugs).toEqual(["reactive-dog"]);
    expect(body.trim()).toBe("גוף המאמר");
  });

  it("readGuide → url + stable hash; reuse only when unchanged", () => {
    const g = readGuide("behavior/barking.mdx", mdx)!;
    expect(guideUrl(g.category, g.slug)).toBe("https://all-dog.co.il/guides/behavior/barking");
    expect(readGuide("behavior/barking.mdx", mdx)!.sourceHash).toBe(g.sourceHash);
    const old = { kind: "guide" as const, slug: "barking", sourceHash: g.sourceHash } as Parameters<typeof reusable>[0];
    expect(reusable(old, g)).toBe(true);
    expect(reusable(old, readGuide("behavior/barking.mdx", `${mdx}\nעוד`)!)).toBe(false);
  });

  it("parses the tools page and maps known tools", () => {
    const src = `const TOOLS = [
      { href: "/guides/tools/chocolate-calculator", title: "מחשבון שוקולד", description: "הכלב אכל שוקולד?", icon: X },
      { href: "/guides/tools/unknown", title: "חדש", description: "משהו", icon: Y },
    ];`;
    const tools = parseToolsPage(src);
    expect(tools.map((t) => t.href)).toEqual(["/guides/tools/chocolate-calculator", "/guides/tools/unknown"]);
    expect(toolEntry(tools[0])?.url).toBe("https://all-dog.co.il/guides/tools/chocolate-calculator");
    expect(toolEntry(tools[1])).toBeNull();
  });

  it("validateInsights rejects prices, own-pension wording, dashes and wrong counts", () => {
    const ok = { topic: "נביחות", whenToRecommend: "כשנובח", insights: ["א", "ב", "ג", "ד", "ה"] };
    expect(validateInsights(ok)).toEqual([]);
    expect(validateInsights({ ...ok, insights: ["א"] })).toContain("צריך 5–8 תובנות");
    expect(validateInsights({ ...ok, topic: "הפנסיון שלנו" }).join()).toContain("הפנסיון שלנו");
    expect(validateInsights({ ...ok, whenToRecommend: "עולה 350 ₪" }).join()).toContain("₪");
    expect(validateInsights({ ...ok, topic: "נביחות — תמיד" })).toContain("מקף ארוך");
  });
});

// ─── Or's playbook (item 19) ──────────────────────────────────────────────────
import { BOUNDARIES, NEVER, OBJECTIONS, renderPlaybook } from "@/lib/alldog-bot/playbook";
import { SCENARIOS } from "../../../scripts/alldog-sim/scenarios";
import { polishReply } from "@/lib/alldog-bot/logic";

describe("playbook", () => {
  it("is in the system prompt (stable text)", () => {
    expect(ALLDOG_BOT_PROMPT).toContain(renderPlaybook());
    expect(renderPlaybook()).toBe(renderPlaybook());
  });
  it("fixed lines are word for word", () => {
    const guard = BOUNDARIES.find((b) => b.id === "guard-training")!;
    expect(guard.fixed).toBe(true);
    expect(ALLDOG_BOT_PROMPT).toContain("אנחנו לא מתעסקים בכלבי שמירה ותקיפה. אנחנו מתמקדים בשיפור החיים עם כלבי בית");
    expect(ALLDOG_BOT_PROMPT).toContain("שימוש בקולר אלקטרוני נעשה רק על ידי מאלף שהוכשר לזה, ורק במקרים ספציפיים");
  });
  it("zoom consultation 250 ₪ is an allowed price, next to diagnosis 350 ₪ and lessons", () => {
    expect(ALLDOG_BOT_PROMPT).toContain("ייעוץ בזום: 250 ₪");
    expect(ALLDOG_BOT_PROMPT).toContain("אבחון מקצועי בבית: 350 ₪");
    expect(OBJECTIONS.find((o) => o.id === "zoom")!.answer).toContain("250 ₪");
  });
  it("'אל דאגה' is no longer suggested — only forbidden — and is stripped from replies", () => {
    expect(ALLDOG_BOT_PROMPT).not.toContain('"אל דאגה", "דואגים לזה"');
    expect(NEVER.join(" ")).toContain("אל דאגה");
    expect(polishReply("אל דאגה , דואגים לזה 🙂")).toBe("דואגים לזה 🙂");
    expect(polishReply("סבבה , אל דאגה")).toBe("סבבה,");
  });
  it("no own pension / promises in the playbook answers", () => {
    // Sentences that START with "אף פעם לא" are instructions to the bot, not things it says.
    const said = [...OBJECTIONS, ...BOUNDARIES]
      .flatMap((e) => e.answer.split(/(?<=\.)\s+/))
      .filter((sentence) => !sentence.startsWith("אף פעם לא"))
      .join("\n");
    expect(said).not.toMatch(/הפנסיון שלנו|המתקן שלנו|אצלנו|100%|נפתור כל בעיה|אל דאגה/);
  });
  it("every professional boundary has a simulator scenario", () => {
    const ids = new Set(SCENARIOS.map((s) => s.id));
    for (const b of BOUNDARIES) expect(ids.has(b.id)).toBe(true);
  });
});
