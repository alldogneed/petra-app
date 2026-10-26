/**
 * Item 38 — fixes from the real conversations of 25–26/10:
 *   a. a price question always gets a number (Gil asked "פרטים ועלויות" and got none);
 *   b. transition + closing read as one message (no "ואיזה. מעולה, רשמתי");
 *   c. the safety line promises a rep, like the closing (not "a trainer will call");
 *   d. not a customer (volunteer, job, wrong number) → one polite answer and done.
 */
import { asksPrice, findPolicyIssues, pricesAlreadySent, PRICE_QUESTION_NOTE } from "@/lib/alldog-bot/logic";
import { callbackClosingText, closingWithTransition, TRANSITION_LINE } from "@/lib/alldog-bot/handoff";
import { ALLDOG_BOT_PROMPT, SAFETY_HANDOFF_LINE } from "@/lib/alldog-bot/prompt";

describe("38a — price questions", () => {
  it("recognises the ways customers ask", () => {
    for (const t of [
      "בוא תסביר לי איך זה עובד\nפרטים\nועלויות",
      "כמה זה עולה?",
      "כמה זה הכל יעלה",
      "מה המחיר",
      "אפשר מחירון?",
      "ומה העלות של אבחון",
      "how much does it cost",
    ]) expect(asksPrice(t)).toBe(true);
  });
  it("does not fire on other words", () => {
    for (const t of ["היא הורסת את החצר", "יש לנו תעלות בגינה", "כמה זמן זה לוקח?", "באיזו עיר אתם עובדים"]) expect(asksPrice(t)).toBe(false);
  });
  it("only until a price was sent", () => {
    expect(pricesAlreadySent(["מתחילים באבחון בבית ב-350 ₪"])).toBe(true);
    expect(pricesAlreadySent(["עם גורים מתחילים באבחון בבית"])).toBe(false);
    expect(PRICE_QUESTION_NOTE).toContain("350 ₪");
    expect(ALLDOG_BOT_PROMPT).toContain("הסבר על התהליך בלי מספר הוא לא תשובה לשאלת מחיר");
  });
});

describe("38e — the diagnosis is offset when they continue to intensive (Or, 26/10)", () => {
  it("prompt + price note say it", () => {
    expect(ALLDOG_BOT_PROMPT).toContain("350 ₪, מתקזז אם ממשיכים לאילוף אינטנסיבי, ואז האבחון בעצם בחינם");
    expect(PRICE_QUESTION_NOTE).toContain("מתקזז אם ממשיכים לאילוף אינטנסיבי, ואז האבחון בעצם בחינם");
  });
  it("the guard keeps the offset sentence but still drops a real intensive price", () => {
    expect(findPolicyIssues("אם ממשיכים לאינטנסיבי, ה-350 ₪ מתקזזים ואז האבחון בעצם בחינם")).toEqual([]);
    expect(findPolicyIssues("אבחון בבית 350 ₪ שמתקזז אם ממשיכים לאילוף אינטנסיבי")).toEqual([]);
    expect(findPolicyIssues("אילוף אינטנסיבי עולה 6,000 ₪")).toEqual(["service_price"]);
    expect(findPolicyIssues("פנסיון ב-3500 ₪")).toEqual(["service_price"]);
  });
});

describe("38b — transition + closing", () => {
  it("no 'מעולה' glued after the transition", () => {
    const closing = closingWithTransition(callbackClosingText("soon", "m"));
    expect(closing).toBe(`${TRANSITION_LINE} רשמתי הכל 🙏 אני דואג שנציגת AllDog תחזור אליך טלפונית בהקדם. אם יש עוד משהו בינתיים, אפשר לכתוב לי פה`);
    expect(closing).not.toMatch(/ואיזה\. מעולה/u);
    // Transition already sent → the closing alone keeps its "מעולה".
    expect(closingWithTransition(callbackClosingText("soon", "m"), true).startsWith("מעולה, רשמתי הכל")).toBe(true);
  });
});

describe("38c — who calls back", () => {
  it("the safety line promises a rep", () => {
    expect(SAFETY_HANDOFF_LINE).toContain("לנציגה");
    expect(SAFETY_HANDOFF_LINE).not.toContain("למאלף שיחזור");
    expect(ALLDOG_BOT_PROMPT).toContain(SAFETY_HANDOFF_LINE);
  });
});

describe("38d — not a customer", () => {
  it("the prompt keeps it to one polite answer", () => {
    expect(ALLDOG_BOT_PROMPT).toContain("# פנייה שלא קשורה לכלב של הפונה");
    expect(ALLDOG_BOT_PROMPT).toContain("בלי עצות, בלי הפניות לעמותות או לעירייה");
    expect(ALLDOG_BOT_PROMPT).toContain("לא ממשיכים את השיחה ולא קוראים ל-save_lead");
  });
});
