/**
 * Item 25 (Or, 24/10): the bot speaks for itself in the singular masculine, addresses the customer
 * in the singular by gender (neutral while unknown), plural only when the customer uses it.
 */
import {
  addressNote,
  addressStyleFor,
  applyAddressStyle,
  detectGender,
  findAddressIssues,
  speaksPlural,
  type AddressStyle,
} from "@/lib/alldog-bot/address";
import { closingText, closingAlreadySent, humanOnTheWay, HUMAN_ON_THE_WAY, WHO_CALLS_BACK, CLOSED_NOTE, HANDOFF_MODE_NOTE } from "@/lib/alldog-bot/handoff";
import { ALLDOG_BOT_PROMPT, OPENING_LINE, POLITE_OPENING, SAFETY_HANDOFF_LINE, NAME_AND_DOG_QUESTION } from "@/lib/alldog-bot/prompt";
import { renderPlaybook } from "@/lib/alldog-bot/playbook";
import { MEDIA_REPLY } from "@/lib/alldog-bot/logic";

const F: AddressStyle = { gender: "f", plural: false };
const M: AddressStyle = { gender: "m", plural: false };
const U: AddressStyle = { gender: "unknown", plural: false };

describe("gender detection", () => {
  it("Revital → f (name)", () => {
    expect(detectGender({ texts: ["יש לי כלב שנובח כל הלילה"], name: "רויטל כהן" })).toBe("f");
  });
  it("Yuval → unknown (unisex name, no gendered verbs)", () => {
    expect(detectGender({ texts: ["הכלב מושך חזק ברצועה", "יובל לוי , הכלב סימבה"], name: "יובל לוי" })).toBe("unknown");
  });
  it('"אני מפחד" → m, "אני מפחדת" → f (verbs beat the name)', () => {
    expect(detectGender({ texts: ["אני מפחד שהוא ינשך"], name: "עדי כהן" })).toBe("m");
    expect(detectGender({ texts: ["אני ממש מפחדת שהוא ינשך"], name: null })).toBe("f");
    expect(detectGender({ texts: ["אני יכולה רק בערב"], name: "דני" })).toBe("f");
  });
  it('"אני רוצה" / "אני מחכה" decide nothing (same spelling for both)', () => {
    expect(detectGender({ texts: ["אני רוצה עזרה", "אני מחכה"], name: null })).toBe("unknown");
  });
  it("plural self-talk", () => {
    expect(speaksPlural(["יש לנו כלבה בת שנה"])).toBe(true);
    expect(speaksPlural(["ניסינו רתמה"])).toBe(true);
    expect(speaksPlural(["יש לי כלב"])).toBe(false);
  });
});

describe("fixed texts (item 25)", () => {
  it("opening", () => {
    expect(OPENING_LINE).toBe("היי, מה קורה? כאן צוות AllDog 🙂 אשמח לשמוע בקצרה על הכלב");
    expect(POLITE_OPENING).toBe("היי! כאן צוות AllDog 🙂 אשמח לשמוע בקצרה על הכלב");
  });
  it("closing by gender", () => {
    expect(closingText("soon", "f")).toBe(
      "מעולה, רשמתי הכל 🙏 אני דואג שנציגת AllDog תחזור אלייך טלפונית בהקדם, תיתן את כל הפרטים, תתאים את המסלול הנכון ותגיד איזה מאלף יגיע. אם יש עוד משהו בינתיים, אפשר לכתוב לי פה"
    );
    expect(closingText("soon", "m")).toContain("תחזור אליך טלפונית בהקדם,");
    expect(closingText("soon", "unknown")).toContain("תחזור בטלפון בהקדם,");
  });
  it("conversations closed with the old text still count as closed", () => {
    expect(closingAlreadySent([{ role: "assistant", text: "מעולה, קיבלנו הכל 🙏 נציגת AllDog תחזור אליכם" }])).toBe(true);
    expect(closingAlreadySent([{ role: "assistant", text: closingText("soon", "m") }])).toBe(true);
  });
  it("after handoff", () => {
    expect(humanOnTheWay("f")).toBe("המאלף כבר בדרך אלייך 🙂");
    expect(humanOnTheWay("m")).toBe("המאלף כבר בדרך אליך 🙂");
    expect(HUMAN_ON_THE_WAY).toBe("המאלף כבר בדרך, הוא יחזור בטלפון 🙂");
  });
  it("no fixed customer text says 'we did' or addresses the customer in the plural", () => {
    const texts = [
      OPENING_LINE, POLITE_OPENING, SAFETY_HANDOFF_LINE, NAME_AND_DOG_QUESTION, MEDIA_REPLY, WHO_CALLS_BACK, HUMAN_ON_THE_WAY,
      humanOnTheWay("f"), humanOnTheWay("m"),
      ...(["soon", "after_shabbat", "after_holiday"] as const).flatMap((w) => [closingText(w, "f"), closingText(w, "m"), closingText(w, "unknown")]),
    ];
    for (const t of texts) expect(findAddressIssues(t, U)).toEqual([]);
  });
  it("the prompt / notes carry the rules and no plural example lines", () => {
    expect(ALLDOG_BOT_PROMPT).toContain('אף פעם לא "רשמנו", "העברנו", "אנחנו דואגים"');
    expect(ALLDOG_BOT_PROMPT).not.toContain("פונים ברבים");
    expect(ALLDOG_BOT_PROMPT).not.toMatch(/איפה אתם גרים|ספרו לנו|נבדוק ונחזור אליכם/);
    expect(renderPlaybook()).not.toMatch(/ספרו |לכלב שלכם|איתכם|אליכם/);
    expect(CLOSED_NOTE).not.toContain("איתכם");
    expect(HANDOFF_MODE_NOTE).not.toContain("איתכם");
  });
});

describe("applyAddressStyle", () => {
  it("the bot never says 'we did'", () => {
    expect(applyAddressStyle("רשמנו את הפרטים והעברנו לנציגה", U)).toBe("רשמתי את הפרטים והעברתי לנציגה");
    expect(applyAddressStyle("אנחנו דואגים שיחזרו", U)).toBe("אני דואג שיחזרו");
    // "אנחנו" about the business stays.
    expect(applyAddressStyle("אנחנו עובדים מאז 2012", U)).toBe("אנחנו עובדים מאז 2012");
  });
  it("Revital (f): plural → אלייך / את", () => {
    expect(applyAddressStyle("הנציגה תחזור אליכם , ואם יש לכם שאלה אפשר לכתוב", F)).toBe("הנציגה תחזור אלייך , ואם יש לך שאלה אפשר לכתוב");
    expect(applyAddressStyle("ספרו לי על הכלב שלכם", F)).toBe("ספרי לי על הכלב שלך");
  });
  it('"אני מפחד" (m): plural → אליך / אתה', () => {
    expect(applyAddressStyle("המאלף יחזור אליכם", M)).toBe("המאלף יחזור אליך");
    expect(applyAddressStyle("ספרו לי", M)).toBe("ספר לי");
  });
  it("Yuval (unknown): neutral wording", () => {
    expect(applyAddressStyle("הנציגה תחזור אליכם טלפונית", U)).toBe("הנציגה תחזור בטלפון");
    expect(applyAddressStyle("ספרו לי בקצרה על הכלב שלכם", U)).toBe("אשמח לשמוע בקצרה על הכלב");
    expect(applyAddressStyle("איפה אתם גרים ?", U)).toBe("באיזו עיר?");
  });
  it("plural is fine when the customer speaks for a household", () => {
    const style = addressStyleFor({ texts: ["יש לנו כלבה שנובחת"], name: "רויטל" });
    expect(style).toEqual({ gender: "f", plural: true });
    expect(applyAddressStyle("הנציגה תחזור אליכם", style)).toBe("הנציגה תחזור אליכם");
    expect(findAddressIssues("הנציגה תחזור אליכם", style)).toEqual([]);
  });
  it("issues are flagged", () => {
    expect(findAddressIssues("רשמנו הכל, נחזור אליכם", U).map((i) => i.kind)).toEqual(["self_plural", "plural_address"]);
  });
  it("the context note names the form", () => {
    expect(addressNote(F)).toContain("אלייך");
    expect(addressNote(M)).toContain("אליך");
    expect(addressNote(U)).toContain("ניסוח ניטרלי");
  });
});
