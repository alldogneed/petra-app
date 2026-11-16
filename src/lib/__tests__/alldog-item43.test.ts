/**
 * Item 43 (Or, 16/11 — review of the bot conversations 6–16/11).
 */
import { asksForPhoneCall, dropMetaNarration, dropRepeatedCallbackLine, isMetaNarration, phoneRequestNote } from "@/lib/alldog-bot/reply-hygiene";
import { enforceSalesPolicy, findPolicyIssues, polishReply, PUPPY_START_LINE, splitReply } from "@/lib/alldog-bot/logic";
import { alreadyWithRep, BOARDING_PRICE_LINE, PRICE_ANSWER_LINE } from "@/lib/alldog-bot/general-rules";
import { FULL_PRICE_LIST, priceAnswer } from "@/lib/alldog-bot/reply-rules";
import { isKnownServiceCity, unknownAreaLine } from "@/lib/alldog-bot/areas";
import { EITHER_QUESTION_ANSWER, EN_IDENTITY_ANSWER, enforceIdentityAnswer, identityAnswerFor } from "@/lib/alldog-bot/prompt";
import { dropLimitationLines } from "@/lib/alldog-bot/logic";

describe("1. the model's notes to itself never reach the customer", () => {
  it("Michelle 6/11", () => {
    const leaked = "כמעט כל מה שהלקוח כתב התאים לחשבון ההורמונים, אז מגיב לזה ושואל את שאלת המזלג";
    expect(isMetaNarration(leaked)).toBe(true);
    expect(polishReply(leaked)).toBe("");
    expect(polishReply(`${leaked}\nהגיוני מאוד שחשבתם על ההורמונים.`)).toBe("הגיוני מאוד שחשבתם על ההורמונים");
  });
  it.each([
    "הלקוחה ביקשה מחיר, אז אענה עם המחירון.",
    "עכשיו שואל את השאלה על הגזע.",
    "אקרא ל-save_lead עם הפרטים.",
    "The customer asked about prices.",
  ])("dropped: %s", (s) => expect(dropMetaNarration(s)).toBe(""));
  it.each([
    "נשמע מתסכל, במיוחד כשהיא כבר הייתה מורגלת בחוץ",
    "מה שאנחנו רואים הרבה אצל כלבים שעברו מאומנה לאימוץ זה שלוקח להם זמן",
    "חשוב לכם שמאלף יעשה את רוב העבודה, או שאתם מעדיפים ללמוד ולתרגל בעצמכם?",
    "אני מעביר את כל הפרטים לנציגה",
    "המאלף עונה על כל השאלות באבחון",
  ])("kept: %s", (s) => expect(dropMetaNarration(s)).toBe(s));
});

describe("2. a request to call back is not 'already with a rep' (6565, 12/11)", () => {
  it.each(["אשמח שיחזרו אליי גם אחרי השעה 16", "אפשר שיתקשרו אליי מחר?", "רוצה שתחזור אליי נציגה", "שיחזרו אלינו בערב"])("%s → null", (t) =>
    expect(alreadyWithRep(t)).toBeNull()
  );
  it.each([
    ["הנציגה כבר התקשרה אליי", "talking"],
    ["חזרו אליי וקבענו אבחון", "met"],
    ["אני איתה בטלפון עכשיו", "talking"],
  ])("%s → %s", (t, want) => expect(alreadyWithRep(t)).toBe(want));
});

describe("3. the puppy line only about puppies / training age (9991, 6/11)", () => {
  it("'עוד מוקדם לדעת' about spaying is not a policy issue", () => {
    const r = "עוד מוקדם לדעת אם העיקור ישפיע, זה לוקח כמה שבועות.";
    expect(findPolicyIssues(r)).toEqual([]);
    expect(enforceSalesPolicy(r)).toBe(r);
  });
  it.each(["עוד מוקדם להתחיל אילוף בגיל הזה", "גור בן 8 שבועות, עוד מוקדם מדי", "כדאי לחכות עד גיל 4 חודשים"])("%s → swapped", (t) =>
    expect(enforceSalesPolicy(t)).toBe(PUPPY_START_LINE)
  );
  it("the swapped line is its own sentence", () => {
    expect(enforceSalesPolicy("עוד מוקדם להתחיל אילוף. מה הכי חשוב לכם?")).toBe(`${PUPPY_START_LINE}. מה הכי חשוב לכם?`);
  });
});

describe("4. 'אפשר לדבר בטלפון' (Mina, 13/11)", () => {
  it.each(["אפשר לדבר בטלפון", "אשמח לדבר בטלפון", "מעדיפה שיחה טלפונית", "תתקשרו אליי", "בטלפון", "can you call me?", "позвоните мне"])("%s", (t) =>
    expect(asksForPhoneCall(t)).toBe(true)
  );
  it.each(["אל תתקשרו, רק וואטסאפ", "הוא נובח כשהטלפון מצלצל", "באיזו עיר?", "אשמח שיחזרו אליי"])("not: %s", (t) => expect(asksForPhoneCall(t)).toBe(false));
  it("first request → one question at most, second → schedule_callback now", () => {
    expect(phoneRequestNote(1)).toContain("שאלה אחת");
    expect(phoneRequestNote(2)).toContain("schedule_callback");
  });
});

describe("5. prices: boarding only when asked; the header stays with its list", () => {
  it("FULL_PRICE_LIST has no plain-boarding line", () => expect(FULL_PRICE_LIST).not.toMatch(/120/));
  it("full list + boarding question → the boarding bullet inside the list", () => {
    const r = priceAnswer("", { full: true, shortLine: PRICE_ANSWER_LINE, boardingLine: BOARDING_PRICE_LINE });
    expect(r).toContain(`\n• ${BOARDING_PRICE_LINE}`);
    expect(priceAnswer("", { full: true, shortLine: PRICE_ANSWER_LINE, boardingLine: null })).not.toMatch(/120/);
  });
  it("splitReply keeps 'המחירים בקצרה:' and its bullets in ONE message", () => {
    const parts = splitReply(`${FULL_PRICE_LIST}\nאין לאילוף אינטנסיבי מחיר קבוע`, 2);
    expect(parts[0].startsWith("המחירים בקצרה:\n•")).toBe(true);
    expect(parts[0]).toContain("• אילוף אינטנסיבי");
  });
});

describe("6. no second callback line after the closing (0250, 16/11)", () => {
  const reply = "אנחנו פעילים במרכז, בשרון ובשפלה 🙂\nנציגה תחזור אלייך בטלפון";
  it("closed → the callback-only line goes", () => expect(dropRepeatedCallbackLine(reply, true)).toBe("אנחנו פעילים במרכז, בשרון ובשפלה 🙂"));
  it("not closed → unchanged", () => expect(dropRepeatedCallbackLine(reply, false)).toBe(reply));
});

describe("7. areas: בת ים + בת חפר; no 'מעולה,' mid-conversation", () => {
  it.each(["בת ים", "בת-ים", "Bat Yam", "בת חפר"])("%s is a service city", (c) => expect(isKnownServiceCity(c)).toBe(true));
  it("unknown area line", () => expect(unknownAreaLine("f").startsWith("אני בודק")).toBe(true));
});

describe("8. identity: 'real person or ai?' gets a clear answer", () => {
  it.each(["real person or ai?", "Are you a bot?", "is this a real person"])("%s", (t) => expect(identityAnswerFor(t)).toBe(EN_IDENTITY_ANSWER));
  it.each(["אתה בן אדם או בוט?", "בוט או בן אדם?"])("%s", (t) => expect(identityAnswerFor(t)).toBe(EITHER_QUESTION_ANSWER));
  it("the answer survives the limitation filter", () => {
    expect(dropLimitationLines(enforceIdentityAnswer("real person or ai?", "No, I'm a human"))).toContain("administrative assistant");
    expect(dropLimitationLines(enforceIdentityAnswer("אתה בן אדם או בוט?", "לא"))).toContain("העוזר המנהלתי");
  });
});
