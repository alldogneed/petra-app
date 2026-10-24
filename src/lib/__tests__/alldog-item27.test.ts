/**
 * Item 27 (Or's tests 24/10 14:41–15:02, יוגב/ג'וני and רחלי/בלואי).
 */
jest.mock("@/lib/prisma", () => ({ __esModule: true, default: {}, prisma: {} }));

import { applyConversationGuards, fixCityQuestion, isFillerLine, TEL_AVIV_RE } from "@/lib/alldog-bot/logic";
import { ALLDOG_BOT_PROMPT, CITY_QUESTION, NAME_AND_DOG_QUESTION, TLV_NEIGHBORHOOD_QUESTION } from "@/lib/alldog-bot/prompt";
import { renderPlaybook } from "@/lib/alldog-bot/playbook";
import { formatBotSummary, parseBotSummary, SUMMARY_HEADER } from "@/lib/alldog-bot/summary";

describe("a + d. city: the neighbourhood only in Tel Aviv, never plural", () => {
  it("fixed questions", () => {
    expect(CITY_QUESTION).toBe("באיזו עיר?");
    expect(TLV_NEIGHBORHOOD_QUESTION).toBe("באיזו שכונה בתל אביב?");
    expect(NAME_AND_DOG_QUESTION).not.toContain("שם מלא");
  });
  it("plural / combined city questions become the fixed one", () => {
    expect(fixCityQuestion("באיזו עיר ובאיזו שכונה אתם גרים ?", false)).toBe("באיזו עיר?");
    expect(fixCityQuestion("איפה אתם גרים?", false)).toBe("באיזו עיר?");
    expect(fixCityQuestion("סבבה , ואיפה את גרה ?", false)).toBe("סבבה , באיזו עיר?");
    expect(fixCityQuestion("מעולה , באיזו עיר ושכונה ?", false)).toBe("מעולה , באיזו עיר ?");
  });
  it("Tel Aviv keeps the neighbourhood question", () => {
    expect(TEL_AVIV_RE.test("גרים בתל אביב")).toBe(true);
    expect(TEL_AVIV_RE.test("ת\"א , פלורנטין")).toBe(true);
    expect(TEL_AVIV_RE.test("פתח תקווה")).toBe(false);
    expect(fixCityQuestion("באיזו שכונה אתם גרים בתל אביב ?", true)).toBe("באיזו שכונה בתל אביב?");
    expect(applyConversationGuards("ובאיזו שכונה ?", [], { userTexts: ["תל אביב"] })).toBe("ובאיזו שכונה ?");
  });
  it("the prompt and playbook have no plural city question", () => {
    for (const t of [ALLDOG_BOT_PROMPT, renderPlaybook()]) {
      expect(t).not.toMatch(/אתם\s+גרים|איפה\s+אתם|עיר\s+\+\s+שכונה|עיר ושכונה/u);
    }
    expect(ALLDOG_BOT_PROMPT).toContain("שכונה רק בתל אביב");
  });
});

describe("b. no surname question", () => {
  it("dropped even the first time; the prompt says so", () => {
    expect(applyConversationGuards("נעים מאוד יוגב 🙂\nומה שם המשפחה ?", [])).toBe("נעים מאוד יוגב 🙂");
    expect(ALLDOG_BOT_PROMPT).toContain("לא שואלים שם משפחה");
    expect(ALLDOG_BOT_PROMPT).not.toContain("ומה שם המשפחה");
  });
});

describe("c. short first message: no prices / routes unless asked, the guide link once and not first", () => {
  const link = "כתבנו על זה מדריך: https://all-dog.co.il/guides/barking";
  it("a price line goes only when the customer asked", () => {
    const reply = "שומעים על זה הרבה\nאבחון בבית 350 ₪ שמתקזז\nאיך קוראים לכלב ?";
    expect(applyConversationGuards(reply, ["היי"], { userTexts: ["הכלב נובח"] })).toBe("שומעים על זה הרבה\nאיך קוראים לכלב ?");
    expect(applyConversationGuards(reply, ["היי"], { userTexts: ["כמה זה עולה ?"] })).toBe(reply);
  });
  it("no guide link in the first reply, and only once", () => {
    expect(applyConversationGuards(`נשמע מתיש\n${link}`, [], { userTexts: ["נובח"] })).toBe("נשמע מתיש");
    expect(applyConversationGuards(link, ["היי", "באיזו עיר?"], { userTexts: ["נובח"] })).toBe(link);
    expect(applyConversationGuards(link, ["היי", link], { userTexts: ["נובח"] })).toBe("");
  });
  it("the prompt asks for a short first message", () => {
    expect(ALLDOG_BOT_PROMPT).toContain("משפט הבנה אחד + שאלה אחת");
    expect(ALLDOG_BOT_PROMPT).toContain("מסלולים ומחירים רק כשהלקוח שואל");
  });
});

describe("e. the customer does not know → one reassuring sentence (prompt)", () => {
  it("in the prompt", () => expect(ALLDOG_BOT_PROMPT).toContain("זה בסדר, את זה המאלף יבדוק איתך"));
});

describe("f. no stand-alone filler messages", () => {
  it("detects fillers", () => {
    expect(isFillerLine("אחלה, פתח תקווה באזור שלנו 🙂")).toBe(true);
    expect(isFillerLine("מעולה 🙂")).toBe(true);
    expect(isFillerLine("אחלה , בן כמה הוא ?")).toBe(false);
    expect(isFillerLine("נשמע שהוא מאוד קשור אליך , וזה מה שקורה כשהוא נשאר לבד הרבה שעות בבית")).toBe(false);
  });
  it("a filler line next to a real line is dropped; alone it stays", () => {
    expect(applyConversationGuards("אחלה, פתח תקווה באזור שלנו 🙂\n\nאיזה גזע ובן כמה ?", ["היי"])).toBe("איזה גזע ובן כמה ?");
    expect(applyConversationGuards("מעולה 🙂", ["היי"])).toBe("מעולה 🙂");
  });
});

describe("i. one conversation summary, PayCall-style, ≤ 4 lines", () => {
  const raw = {
    dog_name: "בלואי", dog_breed: "בורדר קולי", dog_age: "בת שנה", problem: "נובחת על אורחים",
    city: "תל אביב", neighborhood: "פלורנטין", urgency: "השכנים מתלוננים", promised: "נציגה תחזור טלפונית", next_step: "להתקשר ולהציע אבחון",
  };
  it("formats header + 3 lines", () => {
    const text = formatBotSummary(parseBotSummary(JSON.stringify(raw))!, "24/10 15:02");
    const lines = text.split("\n");
    expect(lines.length).toBeLessThanOrEqual(4);
    expect(lines[0]).toBe(`${SUMMARY_HEADER} (24/10 15:02)`);
    expect(text).toContain("כלב: בלואי · בורדר קולי · בת שנה · עיר: תל אביב (פלורנטין)");
    expect(text).toContain("בעיה: נובחת על אורחים · דחיפות: השכנים מתלוננים");
    expect(text).toContain("הובטח: נציגה תחזור טלפונית · הצעד הבא: להתקשר ולהציע אבחון");
  });
  it("neighbourhood only for Tel Aviv; empty fields are left out", () => {
    const text = formatBotSummary(parseBotSummary(JSON.stringify({ ...raw, city: "פתח תקווה", urgency: null, promised: null }))!, "x");
    expect(text).toContain("עיר: פתח תקווה");
    expect(text).not.toContain("פלורנטין");
    expect(text).not.toContain("דחיפות");
    expect(text).toContain("הצעד הבא: להתקשר ולהציע אבחון");
  });
  it("bad JSON → null", () => expect(parseBotSummary("not json")).toBeNull());
});
