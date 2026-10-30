/**
 * Item 41 (Or, Yafit's conversation 29/10): prices written out, the bot masculine about itself,
 * one question per message, a yes to the guide anywhere, one "בעיה נוספת" line, the nudge after an
 * opening without "?".
 */
import {
  asksTrackPrices,
  customerLines,
  dropBackReferences,
  findSelfGenderIssues,
  fixBotSelfGender,
  FULL_PRICE_LIST,
  isNoToOffer,
  oneQuestionPerReply,
  priceAnswer,
  questionCount,
} from "@/lib/alldog-bot/reply-rules";
import { PRICE_ANSWER_LINE } from "@/lib/alldog-bot/general-rules";
import { asksPrice, findPolicyIssues, findTextIssues, PRICE_REPEAT_LINE, trimRepeats } from "@/lib/alldog-bot/logic";
import { isOnlyYes, isYesToOffer } from "@/lib/alldog-bot/guide-offer";
import { otherIssueFact, splitBotLog, withFact, mergeOtherIssues } from "@/lib/alldog-bot/journal";
import { isBotQuestion } from "@/lib/alldog-bot/nudge-rules";
import { OPENING_LINE, POLITE_OPENING } from "@/lib/alldog-bot/prompt";

describe("41.1 — prices are written out", () => {
  it("'כמה עולה כל מסלול?' → the full list, every number, in one message", () => {
    expect(asksPrice("כמה עולה כל מסלול?")).toBe(true);
    expect(asksTrackPrices("כמה עולה כל מסלול?")).toBe(true);
    expect(asksTrackPrices("מה המחיר של כל אחד מהם")).toBe(true);
    const out = priceAnswer("המחירים שכתבתי למעלה בתוקף, ואת המחיר הכולל קובעים באבחון", { full: true, shortLine: PRICE_ANSWER_LINE });
    expect(out).toContain("350 ₪ למפגש בודד, או 300 ₪ למפגש בחבילה של מינימום 6 מפגשים");
    expect(out).toContain("אבחון בבית: 350 ₪");
    expect(out).toContain("בחינם");
    expect(out).toContain("לפי אבחון, ואפשר לפרוס לתשלומים");
    expect(out).not.toContain("כתבתי");
    expect(findPolicyIssues(FULL_PRICE_LIST)).toEqual([]);
    expect(findTextIssues(FULL_PRICE_LIST)).toEqual([]);
  });
  it("asked twice → the full list the second time even for a general price question", () => {
    const second = priceAnswer("את המחיר הכולל קובעים באבחון", { full: true, shortLine: PRICE_ANSWER_LINE });
    expect(second.startsWith(FULL_PRICE_LIST)).toBe(true);
  });
  it("a reply that already has all the lesson + diagnosis prices is untouched", () => {
    const r = "שיעור פרטי 350 ₪ למפגש בודד, או 300 ₪ בחבילה של 6. אבחון בבית 350 ₪.";
    expect(priceAnswer(r, { full: true, shortLine: PRICE_ANSWER_LINE })).toBe(r);
  });
  it("'אבל איפה כתבת?' — a back-reference is never sent; the numbers are", () => {
    expect(dropBackReferences("המחירים שכתבתי למעלה בתוקף. הנציגה תפרט בטלפון")).toBe("הנציגה תפרט בטלפון");
    expect(dropBackReferences("כמו שכתבתי קודם, זה תלוי באבחון. בן כמה הוא?")).toBe("בן כמה הוא?");
    const out = priceAnswer("צודקת, סליחה. המחירים שכתבתי למעלה בתוקף", { full: false, shortLine: PRICE_ANSWER_LINE });
    expect(out).toContain("350 ₪");
    expect(out).not.toContain("כתבתי");
  });
  it("a repeated money sentence nobody asked for is dropped silently — never PRICE_REPEAT_LINE", () => {
    const prior = ["שיחת ייעוץ בחינם, ואבחון בבית 350 ₪."];
    const out = trimRepeats("שיעור פרטי עולה 300 ₪. הנציגה תפרט בטלפון", prior);
    expect(out).not.toContain(PRICE_REPEAT_LINE);
    expect(out).toBe("הנציגה תפרט בטלפון");
    expect(trimRepeats("שיעור פרטי עולה 300 ₪.", prior, [], { priceAskedNow: true })).toContain("300 ₪");
  });
});

describe("41.2 — the bot is masculine about itself", () => {
  it.each([
    ["מבינה למה זה מתסכל, במיוחד אחרי שהשקעת", "מבין למה זה מתסכל, במיוחד אחרי שהשקעת"],
    ["אני מעבירה את הפרטים לנציגה", "אני מעביר את הפרטים לנציגה"],
    ["רושמת. בן כמה הוא?", "רושם. בן כמה הוא?"],
    ["זה מתיש. אני ממש מבינה", "זה מתיש. אני ממש מבין"],
    ["שמחה לעזור 🙂", "שמח לעזור 🙂"],
  ])("%s", (input, expected) => {
    expect(fixBotSelfGender(input)).toBe(expected);
    expect(findSelfGenderIssues(expected)).toEqual([]);
  });
  it("the customer's words are untouched", () => {
    for (const t of ["את מבינה מה הוא צריך?", "בשמחה, יפית", "הכלבה רושמת שיא", "היא מבינה הכל"]) expect(fixBotSelfGender(t)).toBe(t);
  });
});

describe("41.4 — one question per message, never asked twice", () => {
  it("a compound question keeps only the first question", () => {
    const out = oneQuestionPerReply("גולדן בן שנה, גיל עם המון אנרגיה. איך קוראים לו, ומה קורה איתו שגרם לך לפנות?", []);
    expect(out).toBe("גולדן בן שנה, גיל עם המון אנרגיה. איך קוראים לו?");
    expect(questionCount(out)).toBe(1);
  });
  it("two question sentences → one", () => {
    const out = oneQuestionPerReply("נשמע מתיש. כבר עבדת עם מאלף בעבר? ולמה החלטת לפנות דווקא עכשיו?", []);
    expect(questionCount(out)).toBe(1);
    expect(out).toContain("כבר עבדת עם מאלף בעבר?");
  });
  it("a question already asked (the dog's name) is not asked again before the customer answered", () => {
    const prior = ["גולדן בן שנה. איך קוראים לו?"];
    const out = oneQuestionPerReply("אוי, חור שלם בגבס 🙈\nאיך קוראים לו, וכמה זמן הוא כבר אצלך?", prior);
    expect(out).not.toContain("איך קוראים לו");
    expect(out).toContain("כמה זמן הוא כבר אצלך?");
  });
  it("statements stay; one line per message", () => {
    expect(oneQuestionPerReply("רשמתי הכל 🙏", [])).toBe("רשמתי הכל 🙏");
  });
});

describe("41.3 — guide offer: a yes anywhere sends the link", () => {
  it("'אוקיי' on its own line inside a message that answers something else", () => {
    const lines = customerLines(["אני עובדת 5 שעות ביום", "בכל פעם", "אוקיי"]);
    expect(lines.some((l) => isYesToOffer(l))).toBe(true);
    expect(lines.every((l) => isOnlyYes(l))).toBe(false); // → the link after the bot's answer
    expect(customerLines(["5 שעות ביום\nאוקיי"]).some((l) => isYesToOffer(l))).toBe(true);
    expect(customerLines(["👍"]).every((l) => isOnlyYes(l))).toBe(true);
  });
  it("a 'no' closes the offer", () => {
    expect(isNoToOffer("לא תודה")).toBe(true);
    expect(isNoToOffer("לא")).toBe(true);
    expect(isNoToOffer("לא יודעת בן כמה הוא")).toBe(false);
  });
});

describe("41.5 — one 'בעיה נוספת' line per lead", () => {
  it("Yafit's 6 near-identical lines → one merged line", () => {
    let log = "[וואטסאפ · בוט] סיכום שיחה";
    for (const issue of [
      "קופץ על אנשים, מתקשה מול גירויים, מושך ברצועה בטיולים",
      "קופץ על אנשים, מושך ברצועה, מתקשה מול גירויים, היפראקטיבי",
      "קופץ על אנשים, מושך בטיולים, מתקשה מול גירויים, היפראקטיבי",
      "קופץ על אנשים, מושך בטיולים, אנרגטי מאוד ומתקשה מול גירויים",
      "קופץ על אנשים, מושך בטיולים, לא עומד בפני גירויים, היפראקטיבי",
    ]) {
      log = withFact(log, otherIssueFact(issue));
    }
    const facts = splitBotLog(log).facts.filter((f) => f.startsWith("בעיה נוספת"));
    expect(facts).toHaveLength(1);
    expect(facts[0]).toContain("קופץ על אנשים");
    expect(facts[0]).toContain("היפראקטיבי");
    expect(facts[0].match(/קופץ/g)).toHaveLength(1);
    expect(facts[0].match(/מושך/g)).toHaveLength(1);
  });
  it("5 messages about the same problem → one line, no repeats", () => {
    let log: string | null = null;
    for (const t of ["קופץ על אנשים", "קופץ על אורחים", "קופץ על כולם", "קופץ על ילדים", "קופץ גם עליי"]) log = withFact(log, otherIssueFact(t));
    const facts = splitBotLog(log).facts;
    expect(facts).toEqual(["בעיה נוספת: קופץ על אנשים"]);
  });
  it("old duplicated lines collapse on the next write; other facts stay", () => {
    const old = "body\n• לחזור טלפונית\n• בעיה נוספת: נובח על כלבים\n• בעיה נוספת: נובח על כלבים בטיול";
    const facts = splitBotLog(withFact(old, otherIssueFact("מושך ברצועה"))).facts;
    expect(facts).toEqual(["לחזור טלפונית", "בעיה נוספת: נובח על כלבים, מושך ברצועה"]);
    expect(mergeOtherIssues(null, "בעיה נוספת: נובח בלילה, מושך ברצועה")).toBe("בעיה נוספת: נובח בלילה, מושך ברצועה");
  });
});

describe("41.6 — the reminder also follows an opening without '?'", () => {
  it("'…אשמח לשמוע בקצרה על הכלב' counts as a question", () => {
    expect(isBotQuestion(POLITE_OPENING)).toBe(true);
    expect(isBotQuestion(OPENING_LINE)).toBe(true);
    expect(isBotQuestion("רשמתי הכל 🙏")).toBe(false);
  });
});
