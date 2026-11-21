/**
 * Item 44 (Or, 21/11): "בשיחות האחרונות ממש הורגש שזה בוט, בגלל אובר אמפתיה ומלא שאלות במקום להיות
 * מאוד פרקטי". Practical clerk: no empathy lines, no echo, tips only in a safety case, ≤ 5 questions;
 * the summary carries a classification + the customer's own words.
 */
import { childAtRisk, classifyProblem, customerQuote, isEmpathyLine, isUnaskedTip, practicalStyle, withControlLines } from "@/lib/alldog-bot/reply-hygiene";
import { applyConversationGuards } from "@/lib/alldog-bot/logic";
import { alreadyWithRep } from "@/lib/alldog-bot/general-rules";
import { ALLDOG_BOT_PROMPT } from "@/lib/alldog-bot/prompt";
import { MAX_QUESTIONS_BEFORE_CLOSE } from "@/lib/alldog-bot/conversation-checks";

describe("1. no empathy lines (the real ones from 6–19/11)", () => {
  it.each([
    "נשמע כמו משהו שמחייב לשים לב כל הזמן כשמישהו זר מתקרב, במיוחד עם כלב גדול.",
    "נביחות בלי הפסקה יכולות ממש להתיש, טוב שפנית",
    "נשמע מתסכל, במיוחד כשהיא כבר הייתה מורגלת בחוץ.",
    "ממש רואים כמה אתם משקיעים בה.",
    "ממש מורגש כמה אתם משקיעים בה, ושאתם לא מענישים אותה זה הכי נכון.",
    "מבין למה זה מתסכל, במיוחד כשהיא קלטה הכול כל כך מהר.",
    "נשמע מלחיץ מאוד בטיול, במיוחד כשאין דרך לעצור אותה.",
    "זה מצב שמלחיץ, וטוב שפונים עכשיו.",
  ])("dropped: %s", (s) => {
    expect(isEmpathyLine(s)).toBe(true);
    expect(practicalStyle(s)).toBe("");
  });
  it("the question that rides on an empathy sentence stays", () => {
    expect(practicalStyle("נשמע כמו משהו שמחייב לשים לב כל הזמן. איך קוראים לכלב?")).toBe("איך קוראים לכלב?");
    expect(practicalStyle("נשמע לא פשוט, איך קוראים לכלב?")).toBe("איך קוראים לכלב?");
  });
  it.each(["רשמתי. באיזו עיר?", "איך קוראים לך?", "מה הגזע של רון ובן כמה הוא?", "כלפי אנשים או כלפי כלבים?"])("kept: %s", (s) =>
    expect(practicalStyle(s)).toBe(s)
  );
});

describe("2. no unasked tips — except a safety case", () => {
  const tip = "מה שאנחנו רואים הרבה זה שכלב שנובח או מתנפל, וכל פעם הזר מתרחק, לומד שזה עובד.";
  it("dropped, the question after it stays", () => {
    expect(isUnaskedTip(tip)).toBe(true);
    expect(practicalStyle(`${tip} מה הגזע של רון?`)).toBe("מה הגזע של רון?");
    expect(practicalStyle("מה שמקדם הכי הרבה הוא סדר יום קבוע של אוכל ויציאות.")).toBe("");
  });
  it("a safety case keeps the serious sentence and the safety tip", () => {
    const reply = "זה מצב שמלחיץ, וטוב שפונים עכשיו. הכי בטוח לא להשאיר אותו ואת הקטנה יחד בלי השגחה.";
    expect(practicalStyle(reply, { safety: true })).toBe(reply);
    expect(applyConversationGuards(reply, ["היי"], { safety: true })).toContain("הכי בטוח לא להשאיר אותו ואת הקטנה יחד בלי השגחה");
    expect(childAtRisk(["הכלב שלי בן שנתיים יש תינוקת בבית בת שנה וחצי שמציקה לו מאוד והוא מגרגר"])).toBe(true);
    expect(childAtRisk(["הכלב נובח על ילדים ברחוב"])).toBe(false);
  });
});

describe("3. emoji: one per conversation on top of the opening", () => {
  it("kept when the conversation has almost none, dropped after two", () => {
    expect(practicalStyle("רשמתי 🙂 באיזו עיר?", { priorBotTexts: ["היי 🙂"] })).toBe("רשמתי 🙂 באיזו עיר?");
    expect(practicalStyle("רשמתי 🙂 באיזו עיר? 🐶", { priorBotTexts: ["היי 🙂"] })).toBe("רשמתי 🙂 באיזו עיר?");
    expect(practicalStyle("רשמתי 🙂 באיזו עיר?", { priorBotTexts: ["היי 🙂", "נעים מאוד 🐶"] })).toBe("רשמתי באיזו עיר?");
  });
});

describe("4. the whole guard on a real reply (עדי, 19/11)", () => {
  it("empathy + echo-free question", () => {
    const reply = "נשמע כמו משהו שמחייב לשים לב כל הזמן כשמישהו זר מתקרב, במיוחד עם כלב גדול. איך קוראים לכלב?";
    expect(applyConversationGuards(reply, ["היי עדי, כאן צוות AllDog 🙂"], { userTexts: ["גדול ריאקטיבי טריטוריאלי תוקפני לזרים ."] })).toBe("איך קוראים לכלב?");
  });
});

describe("5. 'גבר זר מדבר איתי' is the dog's problem, not 'already with a rep' (עדי, 19/11)", () => {
  it.each(["יכול לנבוח אם גבר זר מדבר איתי ברחוב", "הוא נובח כשמישהו מדבר איתי", "גבר זר מדבר איתי"])("%s → null", (t) =>
    expect(alreadyWithRep(t)).toBeNull()
  );
  it.each(["הנציגה כבר מדברת איתי", "אני מדברת איתה עכשיו", "דיברתי איתה אתמול", "כבר מדברים איתי"])("%s → talking", (t) =>
    expect(alreadyWithRep(t)).toBe("talking")
  );
});

describe("6. the summary: classification on top + the customer's own words (Or: בקרה)", () => {
  it("classification by the customer's words, up to 3 labels", () => {
    expect(classifyProblem(["גדול ריאקטיבי טריטוריאלי תוקפני לזרים ."])).toBe("תגובתיות / תוקפנות לזרים");
    expect(classifyProblem(["יש לי כלבת תחש בת 4 חודשים היא עושה פיפי וקקי בכל מקום היא קופצנית והורסת הכל"])).toBe("צרכים בבית · הרס / לעיסה · קפיצות / חוסר משמעת");
    expect(classifyProblem(["הכלב נשך את הבן שלי אתמול"])).toBe("נשיכה / תקיפה של אדם");
    expect(classifyProblem(["מתנפל על כלבים בטיול"])).toContain("תוקפנות / תגובתיות כלפי כלבים");
    expect(classifyProblem(["מחפשים פנסיון לשישי הקרוב"])).toBe("פנסיון");
    expect(classifyProblem(["רון", "כפר שלם"])).toBeNull();
  });
  it("the quote is word for word, without names / cities / the site's canned text", () => {
    const said = ["היי AllDog, אשמח לעזרה עם הכלב שלי 🐶", "גדול ריאקטיבי טריטוריאלי תוקפני לזרים .", "רון", "כפר שלם", "נביחות כשעוברים אנשים מחוץ לשער או באים אורחים. בטיולים תמיד עם רסן."];
    expect(customerQuote(said)).toBe("גדול ריאקטיבי טריטוריאלי תוקפני לזרים . | נביחות כשעוברים אנשים מחוץ לשער או באים אורחים. בטיולים תמיד עם רסן.");
    expect(customerQuote(["רון", "תל אביב"])).toBeNull();
  });
  it("the journal text: header → סיווג → the summary lines → הלקוח כתב", () => {
    const text = withControlLines("[וואטסאפ · בוט] סיכום שיחה (19/11 17:07)\nכלב: רון · לברדור מעורב · שנתיים · עיר: תל אביב\nבעיה: תוקפני לזרים", ["גדול ריאקטיבי טריטוריאלי תוקפני לזרים ."]);
    expect(text.split("\n")).toEqual([
      "[וואטסאפ · בוט] סיכום שיחה (19/11 17:07)",
      "סיווג: תגובתיות / תוקפנות לזרים",
      "כלב: רון · לברדור מעורב · שנתיים · עיר: תל אביב",
      "בעיה: תוקפני לזרים",
      'הלקוח כתב: "גדול ריאקטיבי טריטוריאלי תוקפני לזרים ."',
    ]);
  });
});

describe("7. the prompt", () => {
  it("practical, 5 questions, one clarifying question, tips only in a safety case", () => {
    expect(MAX_QUESTIONS_BEFORE_CLOSE).toBe(5);
    expect(ALLDOG_BOT_PROMPT).toContain("ענייני ופרקטי, כמו נציגת משרד נחמדה ועסוקה");
    expect(ALLDOG_BOT_PROMPT).toContain('"נשמע מתסכל", "נשמע מלחיץ"');
    expect(ALLDOG_BOT_PROMPT).toContain("שאלת הבהרה אחת, לא יותר");
    expect(ALLDOG_BOT_PROMPT).toContain("עצות וטיפים מקצועיים: לא נותנים");
    expect(ALLDOG_BOT_PROMPT).toContain("חריג יחיד: מקרה בטיחות");
    expect(ALLDOG_BOT_PROMPT).not.toContain("משפט הבנה אחד + שאלה אחת");
    expect(ALLDOG_BOT_PROMPT).not.toContain("חום אמיתי במקום נימוס ריק");
  });
});
