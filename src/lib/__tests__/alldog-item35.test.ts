/**
 * Item 35 — fixes from the first real conversation (Dvir, 25/10 19:31) + Or's note on links (26/10).
 */
import {
  applyConversationGuards,
  arrangeGuideLink,
  GUIDE_LINK_INTRO,
  MINOR_NOTE,
  polishReply,
  PRICE_REPEAT_LINE,
  seemsMinor,
  splitReply,
  tidyPunctuation,
  trimRepeats,
} from "@/lib/alldog-bot/logic";
import { callbackClosingText, closingWithTransition, TRANSITION_LINE, withClosing } from "@/lib/alldog-bot/handoff";
import { composeBotLog, MINOR_FACT, urgentFact, withFact } from "@/lib/alldog-bot/journal";
import { formatAnsweredCallLog, parseCallSummary } from "@/lib/alldog/call-summary-schema";
import { ALLDOG_BOT_PROMPT, MINOR_PARENT_LINE } from "@/lib/alldog-bot/prompt";
import { SCENARIOS } from "../../../scripts/alldog-sim/scenarios";

// The bot's messages in Dvir's conversation (no phone number).
const DVIR_PRICES =
  "כן, מגיעים לאלף בבית. מתחילים באבחון מקצועי בבית ב-350 ₪, והסכום מתקזז אם ממשיכים. שיעור פרטי עולה 300–350 ₪, ואילוף אינטנסיבי נמשך בדרך כלל 4-6 שבועות, והמחיר שלו נקבע לפי האבחון\nכלבה בת שנה שמחרבת את החצר כל יום זה משהו ששומעים עליו הרבה בגיל הזה. איך קוראים לה ?";

describe("35b — text cleanup", () => {
  it("a dash between numbers is 'עד', never a comma", () => {
    expect(tidyPunctuation("300–350 ₪")).toBe("300 עד 350 ₪");
    expect(tidyPunctuation("4-6 שבועות")).toBe("4 עד 6 שבועות");
    expect(tidyPunctuation("2 – 3 מפגשים")).toBe("2 עד 3 מפגשים");
    expect(polishReply(DVIR_PRICES)).toContain("300 עד 350 ₪");
    expect(polishReply(DVIR_PRICES)).toContain("4 עד 6 שבועות");
    expect(polishReply(DVIR_PRICES)).not.toMatch(/\d\s*,\s*\d/);
    // Phone numbers stay as they are.
    expect(tidyPunctuation("03-3818670 או 054-1234567")).toBe("03-3818670 או 054-1234567");
  });

  it("no space before ? ! . , and other dashes become a plain comma", () => {
    expect(polishReply("איך קוראים לה ?")).toBe("איך קוראים לה?");
    expect(polishReply("סבבה , נמשיך !")).toBe("סבבה, נמשיך!");
    expect(polishReply("חפירה בחצר — בעיקר כשהיא לבד , או גם כשיש מישהו בבית ?")).toBe("חפירה בחצר, בעיקר כשהיא לבד, או גם כשיש מישהו בבית?");
    expect(ALLDOG_BOT_PROMPT).not.toMatch(/[֐-׿] [?,]/u);
    expect(ALLDOG_BOT_PROMPT).toContain('"4 עד 6 שבועות"');
  });
});

describe("Or 26/10 — a site link is laid out on its own lines", () => {
  const url = "https://all-dog.co.il/guides/behavior/destructive-chewing";
  it("the link comes out of the sentence: intro line + bare URL", () => {
    expect(arrangeGuideLink(`ברוב המקרים זה שעמום, בודקים באבחון. כתבנו על זה מדריך: ${url}`)).toBe(
      `ברוב המקרים זה שעמום, בודקים באבחון\n${GUIDE_LINK_INTRO}\n${url}`
    );
    expect(arrangeGuideLink(`שווה לקרוא ${url}.`)).toBe(`שווה לקרוא\n${GUIDE_LINK_INTRO}\n${url}`);
    expect(arrangeGuideLink("בלי קישור")).toBe("בלי קישור");
  });
  it("stays in the same WhatsApp message as its text", () => {
    const text = polishReply(`ברוב המקרים זה שעמום. כתבנו על זה מדריך: ${url}\nמה עוד חשוב לך ?`);
    expect(splitReply(text, 2)).toEqual([`ברוב המקרים זה שעמום\n${GUIDE_LINK_INTRO}\n${url}`, "מה עוד חשוב לך?"]);
  });
  it("a link that may not be sent drops its intro line too", () => {
    const prior = [`ראה\n${GUIDE_LINK_INTRO}\n${url}`];
    expect(applyConversationGuards(`זה עניין של שעמום\n${GUIDE_LINK_INTRO}\n${url}`, prior)).toBe("זה עניין של שעמום");
  });
});

describe("35c — fewer repeats", () => {
  it("a stock phrase is used once per conversation", () => {
    const prior = [polishReply(DVIR_PRICES)];
    const out = trimRepeats("האסקית צעירה שנשארת לבד צריכה הרבה פעילות, אז הרס כזה בחצר הוא משהו ששומעים עליו הרבה. מה שבאמת גורם לזה בודקים באבחון", prior);
    expect(out).not.toMatch(/שומעים עליו הרבה/);
    expect(out).toContain("בודקים באבחון");
    const out2 = trimRepeats("צוצה בת שנה עם המון אנרגיה לחצר, זה נשמע מוכר בגיל הזה 🐾", ["זה נשמע מוכר"]);
    expect(out2).toBe("צוצה בת שנה עם המון אנרגיה לחצר");
  });
  it("no 'ולא נקמה' unless the customer raised it", () => {
    expect(trimRepeats("ברוב המקרים זה שעמום ולא נקמה", [])).toBe("ברוב המקרים זה שעמום");
    expect(trimRepeats("זה עניין של שעמום, ולא נקמה", [])).toBe("זה עניין של שעמום");
    expect(trimRepeats("זה שעמום ולא נקמה", [], ["נראה לי שהיא מתנקמת בנו"])).toBe("זה שעמום ולא נקמה");
  });
  it("prices once — repeated unasked: dropped silently, never 'כתבתי למעלה' (item 41); asked now: kept", () => {
    const prior = [polishReply(DVIR_PRICES)];
    const again = polishReply(
      "אי אפשר להגיד מראש כמה שיעורים צריך, כי זה תלוי בכלבה ובמטרות. את זה קובעים באבחון בבית (350 ₪, שמתקזז אם ממשיכים). שיעור פרטי עולה 300 עד 350 ₪, ואילוף אינטנסיבי הוא בדרך כלל 2 עד 3 מפגשים בשבוע. הנציגה תפרט הכל בטלפון"
    );
    const out = trimRepeats(again, prior);
    expect(out).not.toMatch(/₪/);
    expect(out).not.toContain(PRICE_REPEAT_LINE);
    expect(out).toContain("הנציגה תפרט הכל בטלפון");
    // The customer asked about prices in this batch → the numbers stay.
    expect(trimRepeats(again, prior, [], { priceAskedNow: true })).toMatch(/350 ₪/);
    // First time: untouched.
    expect(trimRepeats("שיעור פרטי עולה 300 עד 350 ₪", [])).toBe("שיעור פרטי עולה 300 עד 350 ₪");
  });
  it("the transition and the closing go out as ONE message", () => {
    const closing = closingWithTransition(callbackClosingText("soon", "unknown"));
    expect(closing).toBe(`${TRANSITION_LINE} ${callbackClosingText("soon", "unknown").replace(/^מעולה, /u, "")}`);
    expect(splitReply(closing, 2)).toEqual([closing]);
    const parts = splitReply(withClosing("ברוב המקרים זה שעמום", closing), 2);
    expect(parts).toEqual(["ברוב המקרים זה שעמום", closing]);
  });
});

describe("35a — a caller who seems to be a child", () => {
  it("detects the signs from Dvir's conversation", () => {
    expect(seemsMinor(["אני רוצה לדעת כמה זה יעלה כדי שאני ידבר עם האחים שלי"])).toBe(true);
    expect(seemsMinor(["זה קורה שאנחנו בבצפר וההורים בעבודה"])).toBe(true);
    expect(seemsMinor(["אני צריך לשאול את אמא"])).toBe(true);
    expect(seemsMinor(["אני בן 12"])).toBe(true);
    expect(seemsMinor(["הכלבה שלי בת שנה ומחרבת את החצר"])).toBe(false);
    expect(seemsMinor(["אני בן 42"])).toBe(false);
    expect(seemsMinor(["גאולים , ליד בית הספר"])).toBe(false); // an address, not a child
    expect(seemsMinor(["אני חוזר מבית ספר בשתיים"])).toBe(true);
  });
  it("the bot keeps it polite, collects nothing more, asks for a parent", () => {
    expect(MINOR_NOTE).toContain(MINOR_PARENT_LINE);
    expect(MINOR_NOTE).toContain("לא אוספים עוד פרטים אישיים");
    expect(ALLDOG_BOT_PROMPT).toContain(MINOR_PARENT_LINE);
    expect(ALLDOG_BOT_PROMPT).toContain("caller_seems_minor");
  });
  it("a prominent line in the WhatsApp journal line (first fact)", () => {
    const log = withFact(withFact(composeBotLog("[וואטסאפ · בוט] סיכום", ["בעיה נוספת: מים"]), urgentFact("דחוף")), MINOR_FACT);
    const lines = log.split("\n");
    expect(lines[1]).toBe(`• ${MINOR_FACT}`);
    expect(MINOR_FACT).toBe("⚠️ נראה שהפונה קטין – לדבר עם הורה");
  });
  it("the same line in a phone call summary", () => {
    const sum = parseCallSummary({ summary: "התקשר נער לגבי כלב", caller_seems_minor: true });
    expect(sum?.callerSeemsMinor).toBe(true);
    const { summary } = formatAnsweredCallLog(sum!, { callId: "C1", startedAt: new Date(), billsec: 60, dateLabel: "25/10" });
    expect(summary.split("\n")[1]).toBe(MINOR_FACT);
    const plain = parseCallSummary({ summary: "שיחה רגילה" });
    expect(formatAnsweredCallLog(plain!, { callId: "C2", startedAt: new Date(), billsec: 60, dateLabel: "25/10" }).summary).not.toContain(MINOR_FACT);
  });
});

describe("Dvir's conversation is a simulator scenario (no phone)", () => {
  it("exists and carries no phone number", () => {
    const s = SCENARIOS.find((x) => x.id === "dvir");
    expect(s).toBeDefined();
    expect(s!.lines.join(" ")).not.toMatch(/0\d{8,9}|972\d{8,9}/);
    expect(seemsMinor(s!.lines)).toBe(true);
  });
});
