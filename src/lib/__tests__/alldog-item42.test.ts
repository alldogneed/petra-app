/**
 * Item 42 (Or, 6/11 — review of the bot's real conversations 30/10–5/11):
 * the customer's language, boarding price, a question at the end of every reply, Shabbat for the
 * reminder / partial closing, "I can't open the picture", the closing glued to the answer.
 */
import {
  closingIn,
  detectLanguage,
  ensureEndsWithQuestion,
  FALLBACK,
  FOREIGN_CLOSING_MARKERS,
  GREETING,
  isNeutralCannedText,
  languageFact,
  languageNote,
  languageOfText,
  missingBasics,
  nextQuestionFor,
  partialClosingIn,
  PRICE_FULL,
  PRICE_SHORT,
} from "@/lib/alldog-bot/language";
import { closingAlreadySent, isClosingText, isTransitionText, TRANSITION_LINE, withClosing, closingText, closingWithTransition } from "@/lib/alldog-bot/handoff";
import { asksPrice, dropLimitationLines, findPolicyIssues, findTextIssues, trimRepeats } from "@/lib/alldog-bot/logic";
import { asksBoarding, FULL_PRICE_LIST, priceAnswer } from "@/lib/alldog-bot/reply-rules";
import { BOARDING_PRICE_LINE, PRICE_ANSWER_LINE } from "@/lib/alldog-bot/general-rules";
import { ALLDOG_BOT_PROMPT, enforceOpening, POLITE_OPENING } from "@/lib/alldog-bot/prompt";
import { isKnownServiceCity } from "@/lib/alldog-bot/areas";
import { decideNudge, outOfQuietHours, type NudgeMessage } from "@/lib/alldog-bot/nudge-rules";
import { isShabbatOrHoliday } from "@/lib/alldog/missed-call-rules";
import { israelInstant } from "@/lib/alldog/time";

describe("42.1 — the conversation follows the customer's language", () => {
  it.each([
    ["Hi! I came across your page and would love more information about your training services", "en"],
    ["Bonjour, mon chien tire beaucoup en laisse et je ne sais pas quoi faire", "fr"],
    ["Здравствуйте, у меня собака лает на других собак", "ru"],
    ["مين؟ عندي كلب بيعض", "ar"],
    ["היי, הכלב שלי נובח על כל מי שעובר", "he"],
  ])("%s → %s", (text, lang) => {
    expect(languageOfText(text)).toBe(lang);
  });

  it("short / canned messages decide nothing; the newest clear message wins", () => {
    expect(languageOfText("Arlo")).toBeNull();
    expect(languageOfText("Max")).toBeNull();
    expect(isNeutralCannedText("I'm interested. Can I learn more?")).toBe(true);
    expect(isNeutralCannedText("היי AllDog, אשמח לעזרה עם הכלב שלי 🐶")).toBe(true);
    // Mika (30/10): Meta's English ad text, then Hebrew → Hebrew.
    expect(detectLanguage(["I'm interested. Can I learn more?", "היי אני מעוניינת לשכן את הכלב שלי לתקופת המילואים"])).toBe("he");
    expect(detectLanguage(["I'm interested. Can I learn more?"])).toBe("he");
    // Ana (1/11): the site's Hebrew text, then English; a bare name later changes nothing.
    expect(detectLanguage(["היי AllDog, אשמח לעזרה עם הכלב שלי 🐶", "My dog is a 1 year old mini golden doodle and he pulls on the leash", "Arlo"])).toBe("en");
    expect(detectLanguage([])).toBe("he");
  });

  it("Meta's canned ad text gets the polite Hebrew opening", () => {
    expect(enforceOpening(true, "I'm interested. Can I learn more?", "Hi! Tell me about your dog")).toBe(POLITE_OPENING);
  });

  it("fixed lines exist in every language, with the real prices", () => {
    for (const lang of ["en", "ru", "fr", "ar"] as const) {
      expect(GREETING[lang]).toContain("AllDog");
      expect(PRICE_SHORT[lang]).toContain("350 ₪");
      expect(PRICE_FULL[lang]).toContain("300 ₪");
      expect(PRICE_FULL[lang]).toContain("120");
      expect(PRICE_FULL[lang]).toContain("140");
      expect(PRICE_FULL[lang]).not.toMatch(/[֐-׿]/); // no Hebrew inside
      expect(FALLBACK[lang]).not.toMatch(/[֐-׿]/);
      const closing = closingIn(lang, "מחר בבוקר", { transition: true });
      expect(closing).not.toMatch(/[֐-׿]/);
      expect(isClosingText(closing)).toBe(true);
      expect(isTransitionText(closing)).toBe(true);
      expect(partialClosingIn(lang, "בהקדם", "Ana")).toContain("Ana");
      expect(findPolicyIssues(PRICE_FULL[lang])).toEqual([]);
    }
    expect(closingIn("en", "מחר בבוקר", { transition: false })).toBe(
      "Great, I've got everything 🙏 An AllDog representative will call you back tomorrow morning. If anything else comes up, you can write to me here"
    );
    expect(closingIn("en", "soon", { transition: true, serious: true })).toContain("I've got everything");
    expect(FOREIGN_CLOSING_MARKERS.length).toBe(4);
  });

  it("a closing in English counts as the closing (never sent twice)", () => {
    expect(closingAlreadySent([{ role: "assistant", text: closingIn("en", "soon", { transition: false }) }])).toBe(true);
    expect(closingAlreadySent([{ role: "assistant", text: closingIn("ru", "soon", { transition: true }) }])).toBe(true);
  });

  it("context note + journal fact; trainers' languages per Or", () => {
    expect(languageNote("he")).toBeNull();
    const en = languageNote("en")!;
    expect(en).toContain("באנגלית");
    expect(en).toMatch(/רוסית וצרפתית/);
    expect(en).toMatch(/לא מבטיחים/);
    expect(languageNote("ar")).toMatch(/בעברית או באנגלית/);
    expect(languageFact("he")).toBeNull();
    expect(languageFact("fr")).toBe("הלקוח כותב בצרפתית – לבדוק מאלף שמדבר צרפתית");
    expect(ALLDOG_BOT_PROMPT).toMatch(/מאלפים דוברי רוסית וצרפתית/);
  });

  it("price questions are recognised in other languages too", () => {
    for (const t of ["how much does each session cost?", "Combien coûte une séance ?", "Сколько стоит?", "كم السعر؟", "can you tell me a range of how much"]) {
      expect(asksPrice(t)).toBe(true);
    }
  });

  it("an English price answer gets the English list, never the Hebrew line", () => {
    const out = priceAnswer("Sessions are private, at your home", { full: false, shortLine: PRICE_SHORT.en, fullList: PRICE_FULL.en });
    expect(out.startsWith(PRICE_SHORT.en)).toBe(true);
    expect(out).not.toMatch(/[֐-׿]/);
  });

  it("English / Russian city names are service cities (Hanna: 'Herzliya', Ana: 'Ramat Gan')", () => {
    for (const c of ["Herzliya", "Ramat Gan", "Tel Aviv", "Petah Tikva", "Ra'anana", "Герцлия", "Нетания"]) expect(isKnownServiceCity(c)).toBe(true);
    expect(isKnownServiceCity("Eilat")).toBe(false);
  });
});

describe("42.2 — boarding price (Or, 6/11): about 120–140 ₪ a day", () => {
  it("the line and the full list carry the range; the policy guard allows it", () => {
    expect(BOARDING_PRICE_LINE).toMatch(/120 עד 140 ₪ ליום/);
    expect(BOARDING_PRICE_LINE).toMatch(/תלוי במקום/);
    expect(BOARDING_PRICE_LINE).toMatch(/מחירים מסודרים/);
    expect(FULL_PRICE_LIST).toMatch(/פנסיון רגיל: בערך 120 עד 140 ₪ ליום/);
    expect(FULL_PRICE_LIST).toMatch(/אילוף בתנאי פנסיון: לפי אבחון/);
    expect(findPolicyIssues(BOARDING_PRICE_LINE)).toEqual([]);
    expect(findPolicyIssues(FULL_PRICE_LIST)).toEqual([]);
    expect(findPolicyIssues("פנסיון בערך 120-140 ש״ח ליום")).toEqual([]);
    expect(findTextIssues(BOARDING_PRICE_LINE)).toEqual([]);
    expect(PRICE_ANSWER_LINE).toMatch(/אילוף בתנאי פנסיון: לפי אבחון/);
  });
  it("other boarding / intensive prices stay blocked", () => {
    expect(findPolicyIssues("יום פנסיון 150 ₪")).toContain("service_price");
    expect(findPolicyIssues("אילוף בפנסיון עולה 7,500 ₪")).toContain("service_price");
    expect(findPolicyIssues("אינטנסיבי עולה 6,000 ₪")).toContain("service_price");
  });
  it("a boarding question adds the range once", () => {
    expect(asksBoarding("אני מעוניינת לשכן את הכלב שלי בפנסיון לתקופת המילואים")).toBe(true);
    expect(asksBoarding("how much is boarding?")).toBe(true);
    expect(asksBoarding("הכלב נובח")).toBe(false);
    const out = priceAnswer("את המחיר הכולל קובעים באבחון", { full: false, shortLine: PRICE_ANSWER_LINE, boardingLine: BOARDING_PRICE_LINE });
    expect(out).toContain(BOARDING_PRICE_LINE);
    const full = priceAnswer("בסדר", { full: true, shortLine: PRICE_ANSWER_LINE, boardingLine: BOARDING_PRICE_LINE });
    expect(full.match(/120/g)).toHaveLength(1);
  });
});

describe("42.3 — a reply before the closing ends with a question", () => {
  it("the first missing basic, in order", () => {
    expect(nextQuestionFor("he", missingBasics({ problem: true, dogName: false, city: false, breedAge: false }))).toBe("איך קוראים לכלב?");
    expect(nextQuestionFor("he", missingBasics({ problem: true, dogName: true, city: false, breedAge: false }))).toBe("באיזו עיר?");
    expect(nextQuestionFor("en", missingBasics({ problem: true, dogName: true, city: true, breedAge: false }))).toBe("What breed is he, and how old?");
    expect(nextQuestionFor("he", missingBasics({ problem: true, dogName: true, city: true, breedAge: true }))).toBeNull();
  });
  it("9703 (5/11): 'ממש לא מאוחר…' alone → the next question is added", () => {
    const out = ensureEndsWithQuestion("ממש לא מאוחר. עובדים עם כלבים בכל הגילאים", "איך קוראים לכלבה?");
    expect(out).toBe("ממש לא מאוחר. עובדים עם כלבים בכל הגילאים\n\nאיך קוראים לכלבה?");
    expect(ensureEndsWithQuestion("בן כמה הוא?", "באיזו עיר?")).toBe("בן כמה הוא?");
    expect(ensureEndsWithQuestion("רשמתי", null)).toBe("רשמתי");
    for (const q of ["איך קוראים לכלב?", "באיזו עיר?", "איזה גזע הוא, ובן כמה?", "מה הכי מפריע לך כרגע אצל הכלב?"]) {
      expect(findTextIssues(q)).toEqual([]);
    }
  });
});

describe("42.4 — fixes from the review", () => {
  it("'את התמונה אני לא מצליח לפתוח' is never sent (0184, 3/11)", () => {
    expect(dropLimitationLines("סליחה שלא קיבלת מענה עד עכשיו. את התמונה אני לא מצליח לפתוח פה, אפשר לכתוב בכמה מילים?")).toBe(
      "סליחה שלא קיבלת מענה עד עכשיו."
    );
    expect(dropLimitationLines("Sorry, I can't open the image. What's going on?")).toBe("What's going on?");
  });

  it("a dropped price list never leaves its intro behind (Hanna: 'Here are the prices I can give you:')", () => {
    const prior = ["The phone consultation is free, and a home assessment is 350 ₪."];
    expect(trimRepeats("I can't give a range. Here are the prices I can give you:\nThe assessment is 350 ₪.", prior)).toBe("I can't give a range");
    expect(trimRepeats("Here are the prices I can give you: The assessment is 350 ₪.", prior)).toBe("");
  });

  it("the transition goes before the closing, never glued to the answer (Mika, 30/10)", () => {
    const model = `עבודה על הקשב בחוץ יכולה לעזור עם שני הדברים\n${closingText("soon", "f")}`;
    const out = withClosing(model, closingWithTransition(closingText("soon", "f")));
    expect(out.startsWith("עבודה על הקשב בחוץ יכולה לעזור עם שני הדברים\n\n")).toBe(true);
    expect(out).toContain(`${TRANSITION_LINE} רשמתי הכל`);
    expect(out).not.toMatch(/הדברים אני מעביר/);
  });

  it("an English 'will call you back' line goes before the English closing", () => {
    const out = withClosing("Mochi is lucky to have you.\nA representative will call you back soon.", closingIn("en", "soon", { transition: false }));
    expect(out).toBe(`Mochi is lucky to have you.\n\n${closingIn("en", "soon", { transition: false })}`);
  });
});

describe("42.5 — no reminder / partial closing on Shabbat (9385, 31/10 08:00)", () => {
  const fri = (hhmm: string) => israelInstant("2026-10-30", hhmm);
  const sat = (hhmm: string) => israelInstant("2026-10-31", hhmm);
  it("Shabbat = candle lighting → its end; holiday blocks count", () => {
    expect(isShabbatOrHoliday(fri("12:00"))).toBe(false);
    expect(isShabbatOrHoliday(fri("19:00"))).toBe(true);
    expect(isShabbatOrHoliday(sat("08:00"))).toBe(true);
    expect(isShabbatOrHoliday(sat("20:00"))).toBe(false);
    const block = { startAt: israelInstant("2026-11-03", "00:00"), endAt: israelInstant("2026-11-04", "00:00"), reason: "חג" };
    expect(isShabbatOrHoliday(israelInstant("2026-11-03", "10:00"), [block])).toBe(true);
  });
  it("Saturday 08:00 → after Shabbat; a weekday stays 08:00", () => {
    const t = outOfQuietHours(sat("06:53"));
    expect(t.getTime()).toBeGreaterThan(sat("17:00").getTime());
    expect(outOfQuietHours(israelInstant("2026-11-02", "06:00")).getTime()).toBe(israelInstant("2026-11-02", "08:00").getTime());
  });
  it("a question at 04:53 on Saturday → no reminder, the closing only after Shabbat", () => {
    const messages: NudgeMessage[] = [
      { id: "u1", role: "user", kind: "text", text: "היי AllDog, אשמח לעזרה עם הכלב שלי 🐶", createdAt: sat("04:53") },
      { id: "a1", role: "assistant", kind: "text", text: "היי! כאן צוות AllDog 🙂 אשמח לשמוע בקצרה על הכלב", createdAt: sat("04:53") },
    ];
    expect(decideNudge({ status: "active", lastHumanAt: null, messages, now: sat("08:00") }).action).toBe("wait");
    expect(decideNudge({ status: "active", lastHumanAt: null, messages, now: sat("12:00") }).action).toBe("wait");
    expect(decideNudge({ status: "active", lastHumanAt: null, messages, now: sat("20:00") }).action).toBe("close");
  });
  it("a question on Saturday afternoon → no reminder during Shabbat", () => {
    const messages: NudgeMessage[] = [
      { id: "u1", role: "user", kind: "text", text: "הכלב נובח על כלבים", createdAt: sat("13:00") },
      { id: "a2", role: "assistant", kind: "text", text: "איך קוראים לו?", createdAt: sat("13:00") },
    ];
    const d = decideNudge({ status: "active", lastHumanAt: null, messages, now: sat("13:06") });
    expect(d.action).not.toBe("nudge");
  });
});
