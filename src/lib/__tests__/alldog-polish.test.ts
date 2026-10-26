/**
 * AllDog bot — item 23 (Or's test 24/10 12:58, "רויטל ויוקי"): surname asked once, at most one
 * echo + compliment, Hebrew slips fixed (doubled / merged words, gender with "נציגה"), urgency.
 */
import {
  applyConversationGuards,
  countMirrorPraise,
  findTextIssues,
  fixHebrewSlips,
  polishReply,
  urgencyReason,
} from "@/lib/alldog-bot/logic";
import {
  ALLDOG_BOT_PROMPT,
  NAME_AND_DOG_QUESTION,
  OPENING_GREETING,
  OPENING_LINE,
  POLITE_OPENING,
  SAFETY_GREETING,
  SAFETY_HANDOFF_LINE,
  HUMAN_QUESTION_ANSWER,
  BOT_QUESTION_ANSWER,
} from "@/lib/alldog-bot/prompt";
import { closingText, CLOSED_NOTE, HANDOFF_MODE_NOTE, HUMAN_ON_THE_WAY, RESUMED_NOTE, WHO_CALLS_BACK } from "@/lib/alldog-bot/handoff";
import { renderPlaybook } from "@/lib/alldog-bot/playbook";

describe("Hebrew slips (23c)", () => {
  it("finds a merged stutter and a doubled word", () => {
    expect(findTextIssues("זה התחיל לפני חודחודשיים")).toEqual([{ kind: "merged_word", text: "חודחודשיים" }]);
    expect(findTextIssues("הוא נובח על על כל רעש")).toEqual([{ kind: "duplicate_word", text: "על על" }]);
  });

  it("leaves normal Hebrew alone", () => {
    for (const t of ["קשקש בזנב", "מקסימום התנהגות", "להתמודד עם בלבול", "חודשיים", "שישים ושש", "דגדגן", "השתלשלות"]) {
      expect(findTextIssues(t)).toEqual([]);
      expect(fixHebrewSlips(t)).toBe(t);
    }
  });

  it("fixes them before sending (polishReply)", () => {
    expect(polishReply("זה התחיל לפני חודחודשיים ?")).toBe("זה התחיל לפני חודשיים?");
    expect(polishReply("נובח על על כל רעש")).toBe("נובח על כל רעש");
  });

  it('"נציגה" takes a feminine singular verb', () => {
    expect(fixHebrewSlips("נציגת AllDog שתיצרו איתכם קשר בהקדם")).toBe("נציגת AllDog שתיצור איתכם קשר בהקדם");
    expect(fixHebrewSlips("נציגה מהמשרד שיחזרו אליכם")).toBe("נציגה מהמשרד שתחזור אליכם");
    expect(fixHebrewSlips("הנציגה תיצור קשר")).toBe("הנציגה תיצור קשר");
    // Only inside the same sentence as נציגה.
    expect(fixHebrewSlips("נציגה תחזור. אנחנו נחזור ונמשיך")).toBe("נציגה תחזור. אנחנו נחזור ונמשיך");
  });

  it("no fixed bot text has a doubled or merged word", () => {
    const texts = [
      ALLDOG_BOT_PROMPT, renderPlaybook(), OPENING_LINE, OPENING_GREETING, POLITE_OPENING, SAFETY_GREETING,
      NAME_AND_DOG_QUESTION, SAFETY_HANDOFF_LINE, HUMAN_QUESTION_ANSWER, BOT_QUESTION_ANSWER,
      closingText("soon"), closingText("after_shabbat"), closingText("after_holiday"),
      CLOSED_NOTE, HANDOFF_MODE_NOTE, HUMAN_ON_THE_WAY, RESUMED_NOTE, WHO_CALLS_BACK,
    ];
    for (const t of texts) expect(findTextIssues(t)).toEqual([]);
  });
});

describe("conversation guards (23a + 23b)", () => {
  it("keeps the first echo + compliment, drops later ones", () => {
    // Item 29e: a compliment on the dog's name is always dropped; another echo + compliment once.
    expect(applyConversationGuards("יוקי , שם מקסים 🙂\nבן כמה הוא ?", [])).toBe("בן כמה הוא ?");
    expect(applyConversationGuards("גאולים , מעולה\nבאיזה גזע מדובר ?", ["יוקי , שם מקסים 🙂\nואיפה אתם גרים ?"])).toBe("באיזה גזע מדובר ?");
    expect(applyConversationGuards("גאולים , מעולה . באיזה גזע מדובר ?", ["יוקי , שם מקסים"])).toBe("באיזה גזע מדובר ?");
    // Two in one reply → the second goes.
    expect(applyConversationGuards("יוקי , שם מקסים\nגאולים , מעולה\nבן כמה הוא ?", [])).toBe("גאולים , מעולה\nבן כמה הוא ?");
  });

  it("does not touch normal openers", () => {
    expect(countMirrorPraise("סבבה , נמשיך")).toBe(0);
    expect(countMirrorPraise("מעולה, קיבלנו הכל 🙏")).toBe(0);
    expect(applyConversationGuards("סבבה , בן כמה הוא ?", ["יוקי , שם מקסים"])).toBe("סבבה , בן כמה הוא ?");
  });

  it("never asks the surname (27b: the name the customer gives is enough)", () => {
    expect(applyConversationGuards("ומה שם המשפחה, רויטל ?", [])).toBe("");
    expect(applyConversationGuards("ומה שם המשפחה, רויטל ?\nבאיזו עיר?", ["נעים מאוד 🙂"])).toBe("באיזו עיר?");
  });

  it("the prompt carries the three rules", () => {
    expect(ALLDOG_BOT_PROMPT).toContain("לא שואלים שם משפחה");
    expect(ALLDOG_BOT_PROMPT).toContain("לכל היותר פעם אחת בכל השיחה");
    expect(ALLDOG_BOT_PROMPT).toContain("בודקים דקדוק ומגדר");
    expect(ALLDOG_BOT_PROMPT).toContain("urgent_reason");
  });
});

describe("urgency (23d)", () => {
  it.each([
    ["זה די דחוף", "הלקוח כתב שזה דחוף"],
    ["צריך בדחיפות", "הלקוח כתב שזה דחוף"],
    ["אשמח שיחזרו אליי בהקדם", "הלקוח ביקש בהקדם"],
    ["כמה שיותר מהר בבקשה", "הלקוח ביקש בהקדם"],
    ["השכנים כבר מתלוננים", "השכנים מתלוננים"],
    ["קיבלנו תלונה מהשכנים", "השכנים מתלוננים"],
    ["זה לא דחוף אבל השכנים מתלוננים", "השכנים מתלוננים"],
    ["אם זה ימשיך נאלץ למסור אותו", "שוקלים למסור את הכלב"],
  ])("%s → %s", (text, reason) => {
    expect(urgencyReason(text)).toBe(reason);
  });

  it.each(["לא דחוף , מתי שנוח", "לא כל כך דחוף", "יש לנו כלב בן שנה", "הוא נובח על השכנים"])("%s → not urgent", (text) => {
    expect(urgencyReason(text)).toBeNull();
  });
});
