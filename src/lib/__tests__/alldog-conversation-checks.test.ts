/**
 * Item 26 (Or): no repeated bot message, one compliment at most (incl. "אחלה גזע"), no invented
 * familiarity, and the per-conversation check the simulator runs (≤ 7 questions until the closing since item 37,
 * ≥ 1 professional question, no identity line, no repeat).
 */
import { applyConversationGuards, countMirrorPraise, isRepeatedMessage, removeInventedFamiliarity, INVENTED_FAMILIARITY_RE } from "@/lib/alldog-bot/logic";
import { checkConversation, isProfessionalQuestion, MAX_QUESTIONS_BEFORE_CLOSE, type Turn } from "@/lib/alldog-bot/conversation-checks";
import { closingText } from "@/lib/alldog-bot/handoff";
import { ALLDOG_BOT_PROMPT, NAME_AND_DOG_QUESTION, OPENING_LINE } from "@/lib/alldog-bot/prompt";
import { renderPlaybook } from "@/lib/alldog-bot/playbook";

describe("a. no repeated bot message", () => {
  it("a line already sent is dropped", () => {
    const prior = ["נעים מאוד 🙂 איך קוראים לך (שם מלא), ואיך קוראים לכלב?"];
    expect(applyConversationGuards("נעים מאוד 🙂 איך קוראים לך (שם מלא) , ואיך קוראים לכלב ?\nבאיזו עיר?", prior)).toBe("באיזו עיר?");
    expect(isRepeatedMessage("נעים מאוד 🙂 איך קוראים לך (שם מלא), ואיך קוראים לכלב?", prior)).toBe(true);
  });
  it("a fully repeated reply becomes empty (inbound then sends nothing)", () => {
    expect(applyConversationGuards("בן כמה הוא ?", ["סבבה\nבן כמה הוא?"])).toBe("");
  });
  it("short lines (\"סבבה\", \"🙂\") may repeat", () => {
    expect(applyConversationGuards("סבבה , בן כמה הוא ?", ["סבבה\nבאיזו עיר ?"])).toBe("סבבה , בן כמה הוא ?");
  });
});

describe("b. compliments and invented familiarity", () => {
  it('"רועה גרמני , אחלה גזע" counts as the one echo + compliment', () => {
    expect(countMirrorPraise("רועה גרמני , אחלה גזע")).toBe(1);
    expect(applyConversationGuards("רועה גרמני , אחלה גזע\nבן כמה הוא ?", ["יוקי , שם מקסים"])).toBe("בן כמה הוא ?");
  });
  it('"מכירים" is replaced — the bot never saw this dog', () => {
    expect(removeInventedFamiliarity("יצר צייד כזה , מכירים את זה טוב")).toBe("יצר צייד כזה , שומעים על זה הרבה");
    expect(removeInventedFamiliarity("אנחנו מכירים את הגזע הזה היטב")).toBe("שומעים על זה הרבה");
    expect(INVENTED_FAMILIARITY_RE.test(applyConversationGuards("מכירים את זה טוב", []))).toBe(false);
  });
  it("the prompt and playbook carry no 'מכירים' example", () => {
    expect(ALLDOG_BOT_PROMPT).not.toContain("מכירים את זה");
    expect(ALLDOG_BOT_PROMPT).toContain('אסור להמציא היכרות');
    expect(renderPlaybook()).not.toMatch(INVENTED_FAMILIARITY_RE);
  });
});

describe("c + d. grouped questions, professional depth (prompt)", () => {
  it("rules are in the prompt", () => {
    expect(ALLDOG_BOT_PROMPT).toContain("עומק מקצועי לפני הסגירה");
    expect(ALLDOG_BOT_PROMPT).toContain("לכל היותר 7 שאלות");
    expect(ALLDOG_BOT_PROMPT).toContain("חרדת נטישה: מה קורה כשהוא לבד");
    expect(ALLDOG_BOT_PROMPT).toContain("תוקפנות: כלפי מי, ובאיזה מצב");
  });
});

describe("h. conversation check (simulator)", () => {
  const good: Turn[] = [
    { role: "user", text: "שלום" },
    { role: "bot", text: OPENING_LINE },
    { role: "user", text: "יש לי כלב בשם רוקי , הוא מיילל כשאני יוצא" },
    { role: "bot", text: `שומעים על זה הרבה\n${NAME_AND_DOG_QUESTION}` },
    { role: "user", text: "אורי לוי" },
    { role: "bot", text: "באיזו עיר ושכונה ?" },
    { role: "user", text: "רמת גן , הבורסה" },
    { role: "bot", text: "איזה גזע ובן כמה ?" },
    { role: "user", text: "בוקסר , בן שנה וחצי" },
    { role: "bot", text: "כמה זמן הוא מחזיק לבד עד שמתחיל , וממתי זה ככה ?" },
    { role: "user", text: "רבע שעה , מאז שעברנו דירה" },
    { role: "bot", text: `הרבה פעמים מעבר דירה מערער את התחושה שלו בבית\n\n${closingText("soon", "m")}` },
  ];

  it("a good conversation passes", () => {
    const r = checkConversation(good);
    expect(r).toMatchObject({ closed: true, questionsBeforeClose: 4, professionalQuestions: 1, identityLines: 0, repeatedMessages: 0, problems: [] });
  });

  it("flags too many questions, no professional question, an identity line nobody asked for, a repeat", () => {
    const bad: Turn[] = [
      { role: "user", text: "היי" },
      { role: "bot", text: "לא , אני העוזר המנהלתי של צוות המשרד של AllDog 🙂\nאיך קוראים לך ?" },
      { role: "user", text: "דנה" },
      { role: "bot", text: "ומה שם המשפחה ?\nאיך קוראים לכלב ?" },
      { role: "user", text: "כהן , לולה" },
      { role: "bot", text: "באיזו עיר ?\nבאיזו שכונה ?" },
      { role: "user", text: "חולון" },
      { role: "bot", text: "באיזו עיר ?" },
      { role: "user", text: "חולון!" },
      { role: "bot", text: "איזה גזע הוא ?\nבן כמה ?" },
      { role: "user", text: "מעורב, 3" },
      { role: "bot", text: closingText() },
    ];
    const r = checkConversation(bad);
    expect(r.questionsBeforeClose).toBeGreaterThan(MAX_QUESTIONS_BEFORE_CLOSE);
    expect(r.professionalQuestions).toBe(0);
    expect(r.identityLines).toBe(1);
    expect(r.repeatedMessages).toBe(1);
    expect(r.problems).toHaveLength(4);
  });

  it("an identity line in answer to 'are you human?' is fine", () => {
    const r = checkConversation([
      { role: "user", text: "אתה בן אדם ?" },
      { role: "bot", text: "לא , אני העוזר המנהלתי של צוות המשרד של AllDog 🙂" },
    ]);
    expect(r.identityLines).toBe(0);
  });

  it("basics vs professional questions", () => {
    expect(isProfessionalQuestion("איזה גזע ובן כמה ?")).toBe(false);
    expect(isProfessionalQuestion("באיזו עיר ושכונה ?")).toBe(false);
    expect(isProfessionalQuestion("מה קורה כשהוא לבד בבית ?")).toBe(true);
    expect(isProfessionalQuestion("כלפי מי הוא נוהם , ובאיזה מצב ?")).toBe(true);
  });
});
