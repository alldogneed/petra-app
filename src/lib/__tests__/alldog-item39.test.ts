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
    expect(IMAGE_NOTE).toMatch(/אסור לאבחן/);
    expect(IMAGE_NOTE).toMatch(/גזע בוודאות/);
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
