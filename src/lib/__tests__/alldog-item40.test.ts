/**
 * Item 40 (Or, 28/10): non-dog requests, a customer already in touch with a rep, who calls back,
 * price questions. Quiet hours (40.3) are in alldog-item32 / alldog-item34; reminders (40.4) in
 * lead-meeting-reminder + business-contact.
 */
import {
  alreadyWithRep,
  enforcePriceAnswer,
  fixWhoCallsBack,
  generalClosingFor,
  generalInquiryKind,
  generalQuestion,
  generalTaskTitle,
  generalTopicMissing,
  isQuestion,
  looksLikeName,
  mentionsDogNeed,
  PRICE_ANSWER_LINE,
  repCallbackMissed,
  repMissedLine,
  trainerNameOf,
  typedNameOf,
  WITH_REP_LINE,
} from "@/lib/alldog-bot/general-rules";
import { customerContactPhoneOf, DEFAULT_MEETING_LABEL } from "@/lib/business-contact";
import { findPolicyIssues, findTextIssues } from "@/lib/alldog-bot/logic";

describe("40.1 — requests that are not about the caller's dog", () => {
  it.each([
    ["אפשר לדבר עם הבעלים?", "owner"],
    ["מי מנהל פה?", "owner"],
    ["אני מוכר מזון לכלבים", "supplier"],
    ["אני מאלף ומחפש עבודה", "job"],
    ["היי, אשמח להצטרף לצוות שלכם כמאלפת", "job"],
    ["מציעה לכם שיתוף פעולה עם העמוד שלי באינסטגרם", "partnership"],
    ["לא קיבלתי חשבונית", "billing"],
    ["חויבתי פעמיים החודש", "billing"],
    ["אני רוצה לדבר עם ליעד, המאלף שלי", "own_trainer"],
    ["המאלף שלי לא חוזר אליי כבר יומיים", "own_trainer"],
    ["יש לי תלונה על השירות", "complaint"],
  ])("%s → %s", (text, kind) => {
    expect(generalInquiryKind(text)).toBe(kind);
  });

  it.each([
    "הכלב שלי נושך את הילדים",
    "יש לי גור בן 3 חודשים ואני צריך עזרה",
    "היה לנו מאלף ולא עזר, הכלב ממשיך למשוך",
    "כמה עולה אילוף?",
    "השכנים מתלוננים על הנביחות",
    "יש החזר כספי אם זה לא עובד?",
    "אפשר לשלם בתשלומים?",
    "הבעלים של הכלב הקודם שלי המליצו עליכם",
  ])("a dog request stays in the normal flow: %s", (text) => {
    expect(generalInquiryKind(text)).toBeNull();
  });

  it("a supplier who also asks about their own dog → normal flow", () => {
    expect(mentionsDogNeed("אני מוכר מזון, ויש לי כלב שנובח כל הלילה")).toBe(true);
    expect(generalInquiryKind("אני מוכר מזון, ויש לי כלב שנובח כל הלילה")).toBeNull();
  });

  it("only one question, only when something is missing", () => {
    expect(generalTopicMissing("owner", "אפשר לדבר עם הבעלים?")).toBe(true);
    expect(generalTopicMissing("owner", "היי, אפשר לדבר עם הבעלים לגבי הצעה לשיתוף פעולה בפרסום")).toBe(false);
    expect(generalTopicMissing("supplier", "אני מוכר מזון לכלבים")).toBe(false);
    expect(generalQuestion({ topic: true, name: true })).toBe("על מה מדובר, בכמה מילים? ואיך קוראים לך?");
    expect(generalQuestion({ topic: true, name: false })).toBe("על מה מדובר, בכמה מילים?");
    expect(generalQuestion({ topic: false, name: true })).toBe("איך קוראים לך?");
    expect(generalQuestion({ topic: false, name: false })).toBeNull();
    for (const q of [generalQuestion({ topic: true, name: true })!, generalQuestion({ topic: false, name: true })!]) {
      expect(q.match(/\?/g)!.length).toBeLessThanOrEqual(2);
      expect(q).not.toMatch(/כלב|עיר|גזע/);
    }
  });

  it("names: typed, trainer, profile", () => {
    expect(typedNameOf("קוראים לי דנה כהן")).toBe("דנה כהן");
    expect(typedNameOf("שמי יוסי")).toBe("יוסי");
    expect(typedNameOf("אני מוכר מזון")).toBeNull();
    expect(trainerNameOf("אני רוצה לדבר עם ליעד, המאלף שלי")).toBe("ליעד");
    expect(trainerNameOf("המאלף שלי לא חוזר אליי")).toBeNull();
    expect(looksLikeName("דנה כהן")).toBe(true);
    expect(looksLikeName("🐶 Dana")).toBe(false);
  });

  it("closing lines: human, singular by gender, no phone, no time promise, no call-center language", () => {
    const cases: Array<[string, string]> = [
      ["אפשר לדבר עם הבעלים?", "הבעלים של AllDog"],
      ["אני מוכר מזון לכלבים", "אם זה רלוונטי"],
      ["אני מאלף ומחפש עבודה", "אם זה רלוונטי"],
      ["לא קיבלתי חשבונית", "מצטער"],
      ["אני רוצה לדבר עם ליעד, המאלף שלי", "אני מעדכן את ליעד שיחזור"],
    ];
    for (const [text, expected] of cases) {
      const kind = generalInquiryKind(text)!;
      for (const seed of ["a", "b", "c", "conv-1234"]) {
        const line = generalClosingFor(kind, "f", seed, [text]);
        expect(line).toContain(expected);
        expect(line).toContain("אלייך");
        expect(line).not.toMatch(/\d{3}|מחלקה|בהקדם|תוך|שעות|\?/);
        expect(findTextIssues(line)).toEqual([]);
      }
    }
    expect(generalClosingFor("own_trainer", "m", "x", ["המאלפת שלי לא חוזרת אליי"])).toBe("אני מעדכן את המאלפת שלך שתחזור אליך");
  });

  it("task title: פנייה כללית: <שם> – <נושא>", () => {
    expect(generalTaskTitle("דנה", "billing", "לא קיבלתי חשבונית")).toBe("פנייה כללית: דנה – לא קיבלתי חשבונית");
    expect(generalTaskTitle("דנה", "owner", "")).toBe("פנייה כללית: דנה – מבקש לדבר עם הבעלים");
    expect(generalTaskTitle("דנה", "supplier", "א".repeat(300)).length).toBeLessThanOrEqual(140);
    expect(generalTaskTitle("אבי", "supplier", "היי , אני מוכר מזון לכלבים , קוראים לי אבי")).toBe("פנייה כללית: אבי – אני מוכר מזון לכלבים");
    expect(generalTaskTitle("דנה כהן", "billing", "היי , לא קיבלתי חשבונית על האבחון , שמי דנה כהן")).toBe("פנייה כללית: דנה כהן – לא קיבלתי חשבונית על האבחון");
  });
});

describe("40.2 — the customer is already in touch with a rep", () => {
  it.each([
    ["אני איתה בטלפון", "talking"],
    ["כבר מדברים איתי", "talking"],
    ["היא התקשרה", "talking"],
    ["רחלי כבר חזרה אליי וקבענו", "met"],
    ["כבר קבענו", "met"],
  ])("%s → %s", (text, kind) => {
    expect(alreadyWithRep(text)).toBe(kind);
  });
  it.each(["עדיין לא חזרו אליי", "אף אחד לא התקשר", "הכלב שלי נושך", "התקשרתי חזרה ולא ענו"])("not 'with a rep': %s", (text) => {
    expect(alreadyWithRep(text)).toBeNull();
  });
  it("tried to call back → missed callback", () => {
    expect(repCallbackMissed("התקשרתי חזרה ולא ענו")).toBe(true);
    expect(repCallbackMissed("ניסיתי לחזור אליה")).toBe(true);
    expect(repCallbackMissed("הכלב נושך")).toBe(false);
    expect(repMissedLine("f")).toBe("אני מעדכן אותה עכשיו שתחזור אלייך. מתי הכי נוח לך?");
    expect(repMissedLine("m").match(/\?/g)!.length).toBe(1);
  });
  it("fixed lines read well", () => {
    for (const t of [WITH_REP_LINE, repMissedLine("f"), repMissedLine("unknown")]) expect(findTextIssues(t)).toEqual([]);
    expect(isQuestion("כמה זמן לוקח האבחון?")).toBe(true);
    expect(isQuestion("הוא בן שנתיים ונובח על כלבים")).toBe(false);
  });
});

describe("40.5 — always 'נציגת AllDog' calls back, never a trainer", () => {
  it.each([
    ["אני מעביר את הפנייה ישירות למאלף שיחזור אלייך", "אני מעביר את הפנייה לנציגת AllDog שתחזור אלייך"],
    ["העברתי את הפרטים למאלף שלנו", "העברתי את הפרטים לנציגת AllDog"],
    ["המאלף יחזור אליך בהקדם", "נציגת AllDog תחזור אליך בהקדם"],
    ["מאלף מתאים יתקשר אלייך", "נציגת AllDog תתקשר אלייך"],
    ["אני מעדכן את המאלף שיחזור אליך", "אני מעדכן את נציגת AllDog שתחזור אליך"],
  ])("%s", (input, expected) => {
    expect(fixWhoCallsBack(input)).toBe(expected);
  });
  it("trainer talk that is not a callback promise stays", () => {
    for (const t of ["ותגיד איזה מאלף יגיע", "את זה המאלף יבדוק איתך", "המאלפים שלנו עובדים במרכז"]) expect(fixWhoCallsBack(t)).toBe(t);
  });
});

describe("40.6 — a price question gets the numbers", () => {
  it("a reply without the diagnosis price gets the short price answer first", () => {
    const out = enforcePriceAnswer("קודם כל, ספר לי על הכלב: בן כמה הוא?");
    expect(out.startsWith(PRICE_ANSWER_LINE)).toBe(true);
    expect(out).toContain("בן כמה הוא?");
    expect(PRICE_ANSWER_LINE).toMatch(/בחינם/);
    expect(PRICE_ANSWER_LINE).toMatch(/350 ₪/);
    expect(PRICE_ANSWER_LINE).toMatch(/לפי אבחון/);
    expect(findPolicyIssues(PRICE_ANSWER_LINE)).toEqual([]);
    expect(findTextIssues(PRICE_ANSWER_LINE)).toEqual([]);
  });
  it("a reply that already has the price is untouched", () => {
    const r = "שיחת ייעוץ בחינם, ואבחון בבית 350 ₪ שמתקזז. בן כמה הכלב?";
    expect(enforcePriceAnswer(r)).toBe(r);
  });
});

describe("40.4 — the phone in automatic messages is a business setting", () => {
  it("customerContactPhone wins, empty → Business.phone", () => {
    expect(customerContactPhoneOf({ phone: "0542560964", customerContactPhone: "03-3818670" })).toBe("03-3818670");
    expect(customerContactPhoneOf({ phone: "0542560964", customerContactPhone: "  " })).toBe("0542560964");
    expect(customerContactPhoneOf({ phone: null, customerContactPhone: null })).toBeNull();
    expect(customerContactPhoneOf(null)).toBeNull();
    expect(DEFAULT_MEETING_LABEL).toBe("הפגישה שלנו");
  });
});
