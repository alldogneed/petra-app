/**
 * Item 29 (Or's test 24/10 16:13 — באלו, a German shepherd that attacks dogs).
 */
import { primaryProblemSlugs, searchKnowledge } from "@/lib/alldog-bot/knowledge";
import {
  applyConversationGuards,
  cityAlreadyGiven,
  dropCheerfulOpeners,
  dropKnownQuestion,
  isSeriousIncident,
  NAME_CONFIRM_PREFIX,
  namePlaceNote,
  parseNamePlace,
  splitReply,
  stripNamePraise,
  stripVocativeName,
  voiceOnlyName,
  polishReply,
} from "@/lib/alldog-bot/logic";
import { callbackClosingText, closingText, closingWithTransition, TRANSITION_LINE, withClosing } from "@/lib/alldog-bot/handoff";

describe("29a — lookup_guide: the main problem wins", () => {
  it("attacks / lunges at dogs → dog-aggression / reactive-dog, never leash pulling", () => {
    const slugs = (q: string) => searchKnowledge(q).map((m) => m.entry.slug);
    expect(slugs("תוקף כלבים ומושך קדימה ברצועה")).toEqual(["dog-aggression", "reactive-dog"]);
    expect(slugs("רועה גרמני מושך קדימה כשרואה כלב ותוקף")).toEqual(["reactive-dog", "dog-aggression"]);
    expect(slugs("מתפרץ על כלבים בטיול")[0]).toBe("reactive-dog");
    expect(slugs("נובח על כלבים אחרים")[0]).toBe("reactive-dog");
    expect(slugs("נשך את הבן שלי")[0]).toBe("dog-aggression");
    expect(slugs("רועה גרמני תוקף כלבים בן 4")[0]).toBe("dog-aggression");
  });
  it("other problems keep the keyword search", () => {
    expect(primaryProblemSlugs("מושך ברצועה")).toEqual([]);
    expect(primaryProblemSlugs("נובח כל הלילה")).toEqual([]);
    expect(searchKnowledge("מושך ברצועה")[0].entry.slug).toBe("leash-pulling");
    expect(searchKnowledge("רודף אחרי חתולים")[0].entry.slug).toBe("prey-drive");
  });
});

describe("29b — a short answer carries the name + the city", () => {
  it("'באלו מקרני שומרון' = name + city", () => {
    expect(parseNamePlace("באלו מקרני שומרון")).toEqual({ name: "באלו", place: "קרני שומרון" });
    expect(parseNamePlace("רקס מרעננה 🙂")).toEqual({ name: "רקס", place: "רעננה" });
    expect(parseNamePlace("אני מתל אביב")).toBeNull();
    expect(parseNamePlace("יש לי כלב שנובח על כולם")).toBeNull();
    expect(namePlaceNote("באלו מקרני שומרון")).toContain('"באלו"');
    expect(namePlaceNote("באלו מקרני שומרון")).toContain('"קרני שומרון"');
  });
  it("a question about something already given is not asked again", () => {
    expect(cityAlreadyGiven([{ role: "assistant", text: "נעים מאוד 🙂 איך קוראים לך, ואיך קוראים לכלב?" }, { role: "user", text: "באלו מקרני שומרון" }])).toBe(true);
    expect(cityAlreadyGiven([{ role: "assistant", text: "באיזו עיר?" }, { role: "user", text: "רעננה" }])).toBe(true);
    expect(cityAlreadyGiven([{ role: "user", text: "היי" }])).toBe(false);
    expect(dropKnownQuestion("באיזו עיר?", { city: true })).toBe("");
    expect(dropKnownQuestion("באיזו עיר?", {})).toBe("באיזו עיר?");
    expect(dropKnownQuestion("נעים מאוד 🙂 איך קוראים לך, ואיך קוראים לכלב?", { dogName: true })).toBe("נעים מאוד 🙂 איך קוראים לך?");
    expect(
      applyConversationGuards("זה נשמע מאתגר\nבאיזו עיר?", ["נעים מאוד 🙂 איך קוראים לך, ואיך קוראים לכלב?"], { known: { city: true, dogName: true } })
    ).toBe("זה נשמע מאתגר");
  });
});

describe("29c — closing after an attack: no 'מעולה' (transition + closing = one message since item 35)", () => {
  it("serious → the closing opens with 'רשמתי הכל'", () => {
    expect(isSeriousIncident(["הוא תוקף כלבים בטיול"])).toBe(true);
    expect(isSeriousIncident(["נשך את השכן"])).toBe(true);
    expect(isSeriousIncident(["הוא נובח כל הלילה"])).toBe(false);
    expect(closingText("soon", "m", { serious: true }).startsWith("רשמתי הכל 🙏")).toBe(true);
    expect(closingText("soon", "m").startsWith("מעולה, רשמתי הכל 🙏")).toBe(true);
    expect(dropCheerfulOpeners("מעולה , זה עוזר להבין\nאחלה, בן כמה הוא ?")).toBe("זה עוזר להבין\nבן כמה הוא ?");
  });
  it("answer + guide link | transition + closing = two messages (item 35)", () => {
    const closing = closingWithTransition(callbackClosingText("soon", "m", { serious: true }));
    const model = polishReply("מה שאתה מתאר זה תגובתיות לכלבים , ובודקים את זה באבחון. כתבנו על זה מדריך: https://all-dog.co.il/guides/behavior/reactive-dog");
    const parts = splitReply(withClosing(model, closing), 2);
    expect(parts).toEqual([
      "מה שאתה מתאר זה תגובתיות לכלבים, ובודקים את זה באבחון\nכתבנו על זה מדריך:\nhttps://all-dog.co.il/guides/behavior/reactive-dog",
      `${TRANSITION_LINE} ${callbackClosingText("soon", "m", { serious: true })}`,
    ]);
    expect(parts.join("\n")).not.toMatch(/מעולה/);
  });
});

describe("29d — a name heard only in a voice note", () => {
  const base = { name: "אור", priorBotTexts: [] as string[] };
  it("voice only → not used; typed / profile / confirmed → used", () => {
    expect(voiceOnlyName({ ...base, typedTexts: ["באלו מקרני שומרון"], voiceTexts: ["קוראים לי אור , יש לי רועה גרמני"] })).toBe("אור");
    expect(voiceOnlyName({ ...base, typedTexts: ["אני אור"], voiceTexts: ["קוראים לי אור"] })).toBeNull();
    expect(voiceOnlyName({ ...base, typedTexts: [], voiceTexts: ["קוראים לי אור"], profileName: "Or אור" })).toBeNull();
    expect(
      voiceOnlyName({ ...base, typedTexts: ["כן"], voiceTexts: ["קוראים לי אור"], priorBotTexts: [`${NAME_CONFIRM_PREFIX}אור?`] })
    ).toBeNull();
    expect(voiceOnlyName({ ...base, name: null, typedTexts: [], voiceTexts: ["קוראים לי אור"] })).toBeNull();
  });
  it("the address by name is removed; the one confirmation stays", () => {
    expect(stripVocativeName("אור , בן כמה הוא ?", "אור")).toBe("בן כמה הוא ?");
    expect(stripVocativeName("תודה, אור 🙂", "אור")).toBe("תודה 🙂");
    expect(stripVocativeName(`${NAME_CONFIRM_PREFIX}אור?`, "אור")).toBe(`${NAME_CONFIRM_PREFIX}אור?`);
    expect(stripVocativeName("אורית , היי", "אור")).toBe("אורית , היי");
    expect(stripVocativeName("אור , בן כמה הוא ?", null)).toBe("אור , בן כמה הוא ?");
  });
});

describe("29e — no compliment on the dog's name", () => {
  it("'שם חזק' / 'שם מקסים' are always dropped", () => {
    expect(stripNamePraise("באלו , שם חזק ! ובאיזו עיר ?")).toBe("באיזו עיר ?");
    expect(stripNamePraise("איזה שם חזק 🙂 בן כמה הוא ?")).toBe("בן כמה הוא ?");
    expect(stripNamePraise("באלו, שם חזק יש לו 💪")).toBe("");
    expect(stripNamePraise("רועה גרמני , אחלה גזע")).toBe("רועה גרמני , אחלה גזע");
    expect(applyConversationGuards("באלו , שם חזק !\nבן כמה הוא ?", [])).toBe("בן כמה הוא ?");
  });
});
