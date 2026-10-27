/**
 * Item 39 (Or, 27/10 — Irit sent a photo of Lola, the bot answered "I only read text"):
 * photos are seen, described and answered like a person; nothing ever exposes a limitation.
 */
import {
  captionOf,
  classifyInbound,
  customerWords,
  dropLimitationLines,
  dropMidConversationGreeting,
  IMAGE_NOTE,
  IMAGE_PENDING_TEXT,
  imageHistoryText,
  imageMessageText,
  mediaLabelOf,
  MEDIA_REPLY,
  parseImageMessageText,
  revealsLimitation,
  UNREADABLE_MEDIA_NOTE,
} from "@/lib/alldog-bot/logic";
import {
  descriptionLine,
  imageBlockFor,
  MAX_IMAGE_BYTES,
  mediaLogText,
  parseImageDescription,
  parseMediaRef,
} from "@/lib/alldog-bot/images";
import { imageSummaryLines } from "@/lib/alldog-bot/summary";
import { findTextIssues } from "@/lib/alldog-bot/logic";
import { SCENARIOS } from "../../../scripts/alldog-sim/scenarios";

const base = { id: "wamid.1", from: "972501234567" };

describe("classifyInbound — photos, stickers, videos, files", () => {
  it("a photo with / without a caption", () => {
    expect(classifyInbound({ ...base, type: "image", image: { id: "M1", mime_type: "image/jpeg", caption: " זאת לולה " } })).toEqual({
      kind: "image", mediaId: "M1", mimeType: "image/jpeg", caption: "זאת לולה",
    });
    expect(classifyInbound({ ...base, type: "image", image: { id: "M2" } })).toEqual({ kind: "image", mediaId: "M2", mimeType: null, caption: null });
  });
  it("a still sticker is a photo, an animated one is a file", () => {
    expect(classifyInbound({ ...base, type: "sticker", sticker: { id: "S1", mime_type: "image/webp" } }).kind).toBe("image");
    expect(classifyInbound({ ...base, type: "sticker", sticker: { id: "S2", mime_type: "image/webp", animated: true } }).kind).toBe("media");
  });
  it("a video / document keeps its media id and caption", () => {
    expect(classifyInbound({ ...base, type: "video", video: { id: "V1", mime_type: "video/mp4", caption: "ככה הוא נובח" } })).toEqual({
      kind: "media", label: "סרטון", mediaId: "V1", mimeType: "video/mp4", caption: "ככה הוא נובח",
    });
    expect(classifyInbound({ ...base, type: "document", document: { id: "D1" } })).toMatchObject({ kind: "media", label: "מסמך", mediaId: "D1" });
  });
});

describe("stored photo text", () => {
  it("round-trips description + caption", () => {
    const t = imageMessageText("כלבה בינונית, נראית מעורבת", "זאת לולה");
    expect(t).toBe("[תמונה: כלבה בינונית, נראית מעורבת]\nכיתוב: זאת לולה");
    expect(parseImageMessageText(t)).toEqual({ description: "כלבה בינונית, נראית מעורבת", caption: "זאת לולה" });
    expect(parseImageMessageText(IMAGE_PENDING_TEXT)).toEqual({ description: null, caption: null });
  });
  it("the caption is the customer's words, the description is not", () => {
    expect(customerWords({ kind: "image", text: imageMessageText("כלב", "זה רקסי") })).toBe("זה רקסי");
    expect(customerWords({ kind: "image", text: imageMessageText("כלב", null) })).toBeNull();
  });
  it("history line for later turns", () => {
    expect(imageHistoryText(imageMessageText("כורסה קרועה", null))).toBe("(הלקוח שלח תמונה: כורסה קרועה)");
    expect(imageHistoryText(IMAGE_PENDING_TEXT)).toBe("(הלקוח שלח תמונה)");
  });
  it("media label + caption", () => {
    expect(mediaLabelOf("[סרטון]\nכיתוב: ככה")).toBe("סרטון");
    expect(captionOf("[סרטון]\nכיתוב: ככה")).toBe("ככה");
  });
});

describe("never expose a limitation", () => {
  it("the old reply is gone; the new fallback exposes nothing", () => {
    expect(MEDIA_REPLY).toBe("תודה ששלחת 🙂 צירפתי לפרטים בשביל הנציגה");
    expect(revealsLimitation(MEDIA_REPLY)).toBe(false);
    expect(findTextIssues(MEDIA_REPLY)).toEqual([]);
    expect(revealsLimitation("היי, אני יודע לקרוא רק הודעות טקסט 🙂")).toBe(true);
  });
  it.each([
    ["אני לא יכול לראות תמונות, אבל אשמח לשמוע. באיזו עיר?", "באיזו עיר?"],
    ["אני בוט ולא רואה תמונות. איך קוראים לכלבה?", "איך קוראים לכלבה?"],
    ["לולה נראית מתוקה 🙂\nבאיזו עיר אתם?", "לולה נראית מתוקה 🙂\nבאיזו עיר אתם?"],
  ])("%s", (input, expected) => {
    expect(dropLimitationLines(input)).toBe(expected);
  });
  it("the notes forbid diagnosis / certain breed / promises and limitation lines", () => {
    expect(IMAGE_NOTE).toMatch(/בלי משקל, פרווה מוזנחת, בריאות או התנהגות/);
    expect(IMAGE_NOTE).toMatch(/ברור וחד-משמעי/);
    expect(IMAGE_NOTE).toMatch(/להבטיח/);
    expect(IMAGE_NOTE).toMatch(/אף פעם לא אומרים שאתה בוט/);
    expect(UNREADABLE_MEDIA_NOTE).toContain(MEDIA_REPLY);
  });
});

describe("no greeting mid-conversation (39.6)", () => {
  it.each([
    ["היי, לולה נראית מתוקה 🙂 באיזו עיר?", "לולה נראית מתוקה 🙂 באיזו עיר?"],
    ["היי עירית, לולה נראית מתוקה", "עירית, לולה נראית מתוקה"],
    ["שלום שוב! איך קוראים לכלב?", "איך קוראים לכלב?"],
    ["היילו מה קורה", "היילו מה קורה"],
  ])("%s", (input, expected) => {
    expect(dropMidConversationGreeting(input, false)).toBe(expected);
  });
  it("the first reply keeps its greeting", () => {
    expect(dropMidConversationGreeting("היי, מה קורה?", true)).toBe("היי, מה קורה?");
  });
});

describe("images.ts", () => {
  const buf = (n: number) => new Uint8Array(n).buffer;
  it("image block: supported types only, ≤ 5MB", () => {
    expect(imageBlockFor({ data: buf(10), contentType: "image/jpeg" })?.source).toMatchObject({ type: "base64", media_type: "image/jpeg" });
    expect(imageBlockFor({ data: buf(10), contentType: "application/octet-stream" }, "image/webp")?.type).toBe("image");
    expect(imageBlockFor({ data: buf(10), contentType: "video/mp4" })).toBeNull();
    expect(imageBlockFor({ data: buf(MAX_IMAGE_BYTES + 1), contentType: "image/png" })).toBeNull();
    expect(imageBlockFor({ data: buf(0), contentType: "image/png" })).toBeNull();
  });
  it("description: parsed, trimmed, screenshot text kept", () => {
    const d = parseImageDescription(JSON.stringify({ kind: "screenshot", rep_line: "צילום מסך של הודעה ממאלף", text_in_image: "אני לא יכול להמשיך" }));
    expect(d).toEqual({ kind: "screenshot", repLine: "צילום מסך של הודעה ממאלף", textInImage: "אני לא יכול להמשיך" });
    expect(descriptionLine(d!)).toBe('צילום מסך של הודעה ממאלף · בתמונה כתוב: "אני לא יכול להמשיך"');
    expect(parseImageDescription("{}")).toBeNull();
    expect(parseImageDescription("not json")).toBeNull();
  });
  it("media ref", () => {
    expect(parseMediaRef(JSON.stringify({ messageId: "m1", mediaId: "M1", mimeType: "image/jpeg", label: "תמונה" }))).toEqual({
      messageId: "m1", mediaId: "M1", mimeType: "image/jpeg", label: "תמונה",
    });
    expect(parseMediaRef("{}")).toBeNull();
  });
  it("journal line: 📷 + description + caption + link", () => {
    expect(mediaLogText({ label: "תמונה", description: "כלבה בינונית", caption: "לולה", url: "https://petra-app.com/api/leads/L/whatsapp-bot/media/m1" })).toBe(
      "[וואטסאפ · בוט] 📷 תמונה · כלבה בינונית\nכיתוב: לולה\nhttps://petra-app.com/api/leads/L/whatsapp-bot/media/m1"
    );
    expect(mediaLogText({ label: "סרטון", description: null, caption: null, url: null })).toBe("[וואטסאפ · בוט] 🎬 סרטון");
  });
});

describe("rep summary line (39.5)", () => {
  it("one line per described photo, max 3", () => {
    const rows = [
      { role: "user", kind: "text", text: "היי" },
      { role: "user", kind: "image", text: imageMessageText("כלבה בינונית, נראית מעורבת", null) },
      { role: "user", kind: "image", text: IMAGE_PENDING_TEXT },
    ];
    expect(imageSummaryLines(rows)).toEqual(["תמונה מהלקוח: כלבה בינונית, נראית מעורבת"]);
  });
});

describe("simulator scenarios (39.7)", () => {
  it("cover photo with/without caption, after the name, screenshot, damage, video and a failed download", () => {
    const ids = SCENARIOS.map((s) => s.id);
    for (const id of ["photo-lola", "photo-first", "photo-caption", "photo-screenshot", "photo-damage", "photo-video-fail"]) expect(ids).toContain(id);
  });
});

// ─── Item 39 addition: offer the guide instead of sending it ─────────────────────────────
import {
  asksForReading,
  guideLinkMessage,
  guideOfferText,
  isOnlyYes,
  isYesToOffer,
  preciseGuideFor,
  stripGuideLinks,
} from "@/lib/alldog-bot/guide-offer";
import { KNOWLEDGE } from "@/lib/alldog-bot/knowledge";
import { checkConversation } from "@/lib/alldog-bot/conversation-checks";
import {
  correctsOwner,
  dropCorrectionsAndLabels,
  findTerminologyIssues,
  labelsDiagnosis,
  polishReply,
  proTermCount,
} from "@/lib/alldog-bot/logic";

describe("guide offer (39 addition)", () => {
  it("a precise guide for a clear problem; none for a loose / unknown one", () => {
    expect(["barking", "territorial-behavior"]).toContain(preciseGuideFor("נובח על עוברים ליד הבית")?.slug);
    expect(preciseGuideFor("נובח בלי הפסקה")?.slug).toBe("barking");
    expect(preciseGuideFor("תוקף כלבים בטיול")?.slug).toBe("dog-aggression");
    expect(preciseGuideFor("עושה צרכים בבית")?.slug).toBe("house-training");
    expect(["leash-pulling", "loose-leash-walking"]).toContain(preciseGuideFor("מושכת ברצועה")?.slug);
    expect(preciseGuideFor("הורס את הבית כשאנחנו יוצאים")?.slug).toBe("destructive-chewing");
    // One shared word is not a guide for this problem → no offer.
    expect(preciseGuideFor("הכלב לא אוכל")).toBeNull();
    expect(preciseGuideFor("הכלב מלקק את הכפות כל הזמן")).toBeNull();
    expect(preciseGuideFor("נושר שיער")).toBeNull();
    expect(preciseGuideFor("")).toBeNull();
  });
  it("the offer: its own short message, 3 wordings, by gender, no link", () => {
    const f = guideOfferText("f", "a");
    expect(guideOfferText("f", "any-seed-1")).toMatch(/שתיפגשי|תיפגשי/);
    expect(guideOfferText("m", "x")).toMatch(/שתיפגש עם/);
    expect(guideOfferText("unknown", "x")).toMatch(/עד הפגישה עם המאלף/);
    expect(f).not.toMatch(/https?:/);
    expect(f).toMatch(/\?/);
    const all = new Set(["a", "b", "c", "d", "e", "f", "g"].map((seed) => guideOfferText("m", seed)));
    expect(all.size).toBeGreaterThan(1);
  });
  it("the link message: one line on what is in it + the URL", () => {
    const e = KNOWLEDGE.entries.find((x) => x.slug === "barking")!;
    const msg = guideLinkMessage(e);
    expect(msg.startsWith("הנה 🙂 ")).toBe(true);
    expect(msg.split("\n")).toHaveLength(2);
    expect(msg).toContain(e.url);
  });
  it.each(["כן", "כן!", "בטח", "שלח", "שלחי בבקשה", "👍", "אשמח", "יאללה", "אפשר"])("yes: %s", (t) => {
    expect(isYesToOffer(t)).toBe(true);
  });
  it.each(["לא", "לא תודה", "אין צורך", "כמה זה עולה בערך?", "אפשר לשאול על המחיר?", "תודה"])("not a yes: %s", (t) => {
    expect(isYesToOffer(t)).toBe(false);
  });
  it("only-yes vs yes + more", () => {
    expect(isOnlyYes("כן בטח")).toBe(true);
    expect(isOnlyYes("כן, ובנוסף הוא גם נובח על אורחים בערב")).toBe(false);
  });
  it("asking for something to read → sent straight away", () => {
    expect(asksForReading("יש משהו לקרוא בינתיים?")).toBe(true);
    expect(asksForReading("תשלח לי מאמר על זה")).toBe(true);
    expect(asksForReading("יש לכם מדריך על זה?")).toBe(true);
    expect(asksForReading("הוא קורא לי כל בוקר")).toBe(false);
  });
  it("the model never sends a guide link (tool links stay)", () => {
    expect(stripGuideLinks("נביחה היא שפה.\nכתבנו על זה מדריך:\nhttps://all-dog.co.il/guides/behavior/barking\nבאיזו עיר?")).toBe("נביחה היא שפה.\nבאיזו עיר?");
    expect(stripGuideLinks("לפנות לוטרינר עכשיו. https://all-dog.co.il/guides/tools/chocolate")).toContain("/guides/tools/chocolate");
  });
});

describe("professional terms, with taste (39 addition)", () => {
  it.each([
    "זה נקרא יללות, לא בכי.",
    "בעצם מה שאתה מתאר זה תגובתיות.",
    "המונח המקצועי לזה הוא שמירה על משאבים.",
  ])("a correction of the owner's word is dropped: %s", (t) => {
    expect(correctsOwner(t)).toBe(true);
    expect(dropCorrectionsAndLabels(t)).toBe("");
  });
  it.each(["יש לו חרדת נטישה.", "זו תוקפנות.", "נשמע כמו חרדת נטישה."])("a diagnosis label is dropped: %s", (t) => {
    expect(labelsDiagnosis(t)).toBe(true);
  });
  it("Or's good example passes untouched", () => {
    const good = "נשמע מתיש, כל לילה ככה. היללות מתחילות ברגע שאתם סוגרים את הדלת, או אחרי זמן מה?";
    expect(findTerminologyIssues(good)).toEqual([]);
    expect(polishReply(good)).toBe(good);
    expect(proTermCount(good)).toBe(1);
  });
  it("a gentle angle on 'עושה דווקא' is fine", () => {
    expect(findTerminologyIssues("הרבה פעמים זה נראה ככה, ובפועל זה בדרך כלל קשור לקושי להישאר לבד.")).toEqual([]);
  });
  it("conversation check: ≤ 2 terms, no corrections, no exposed limitation", () => {
    const r = checkConversation([
      { role: "user", text: "הוא בוכה כל הלילה" },
      { role: "assistant", text: "זה נקרא יללות, לא בכי. אני לא יכול לראות תמונות" },
      { role: "assistant", text: "היללות, גמילה, שמירה על משאבים" },
    ]);
    expect(r.terminologyIssues.length).toBeGreaterThan(0);
    expect(r.proTerms).toBeGreaterThan(2);
    expect(r.limitationLines).toBe(1);
  });
  it("simulator scenarios for the 4 phrases + the 5 guide cases", () => {
    const ids = SCENARIOS.map((s) => s.id);
    for (const id of ["term-crying", "term-spite", "term-jealous", "term-dogs", "guide-yes", "guide-no", "guide-ignore", "guide-ask", "guide-none"]) {
      expect(ids).toContain(id);
    }
  });
});

// ─── Item 39 update: compliments on the dog's photo ─────────────────────────────────────
import {
  asksBreedGuess,
  BREED_GUESS_ANSWER,
  dropBreedGuesses,
  enforceBreedAnswer,
  MORE_PHOTOS_NOTE,
  ownerBreedNote,
  PLAIN_COMPLIMENT,
} from "@/lib/alldog-bot/logic";

describe("photo compliments (39 update)", () => {
  it("a clear breed in a compliment stays", () => {
    expect(dropBreedGuesses("איזה פודל מהמם 😍 גזע מדהים\nובאיזו עיר אתם?")).toBe("איזה פודל מהמם 😍 גזע מדהים\nובאיזו עיר אתם?");
    expect(dropBreedGuesses("גולדן מקסים, איזה פרווה")).toBe("גולדן מקסים, איזה פרווה");
  });
  it("'מעורב' / 'נראה כמו' never reach the customer — the sentence becomes a plain compliment", () => {
    const out = dropBreedGuesses("איזו מעורבת מתוקה! נראית כמו רועה בלגי. באיזו עיר?");
    expect(out).not.toMatch(/מעורב|נרא(?:ה|ית) כמו/);
    expect(out).toContain(PLAIN_COMPLIMENT);
    expect(out).toContain("באיזו עיר?");
    expect(dropBreedGuesses("לולה נראית מתוקה ממש")).toBe("לולה נראית מתוקה ממש");
  });
  it("the history the model sees has no 'נראית מעורבת'", () => {
    expect(imageHistoryText(imageMessageText("כלבה בינונית ג׳ינג׳ית, נראית מעורבת רועים", null))).toBe("(הלקוח שלח תמונה: כלבה בינונית ג׳ינג׳ית)");
  });
  it("the owner's breed wins, never corrected", () => {
    expect(ownerBreedNote("רועה גרמני")).toMatch(/רועה גרמני.*לא מתקנים/);
  });
  it.each(["איזה גזע הוא לדעתך?", "מה הגזע שלו?", "לדעתך מה הגזע?", "איזה גזע זה"])("breed-guess question: %s", (t) => {
    expect(asksBreedGuess(t)).toBe(true);
  });
  it("not a breed-guess question", () => {
    expect(asksBreedGuess("הוא רועה גרמני")).toBe(false);
  });
  it("the breed-guess answer: fixed, no guess kept", () => {
    expect(enforceBreedAnswer("איזה גזע הוא לדעתך?", "נראה כמו מעורב לברדור\nבאיזו עיר?")).toBe(`${BREED_GUESS_ANSWER}\nבאיזו עיר?`);
    expect(enforceBreedAnswer("באיזו עיר אתם?", "תל אביב 🙂")).toBe("תל אביב 🙂");
  });
  it("more photos → a very short reaction, not the same wording", () => {
    expect(MORE_PHOTOS_NOTE).toMatch(/קצרה מאוד/);
    expect(MORE_PHOTOS_NOTE).toMatch(/בלי לחזור/);
  });
  it("scenarios: poodle, mixed, owner said GSD, breed question, three photos", () => {
    const ids = SCENARIOS.map((x) => x.id);
    for (const id of ["photo-poodle", "photo-mixed", "photo-owner-breed", "photo-breed-question", "photo-three"]) expect(ids).toContain(id);
  });
});
