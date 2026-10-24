/**
 * Item 28 (Or, 24/10): voice notes, cities outside the list, the transition line before the
 * closing, Hebrew slips that came back, and the model name from ALLDOG_BOT_MODEL.
 */
import {
  classifyInbound,
  cleanTranscript,
  customerWords,
  findTextIssues,
  fixHebrewSlips,
  isVoiceFailed,
  polishReply,
  toChatTurns,
  VOICE_FAILED_REPLY,
  VOICE_FAILED_TEXT,
  VOICE_PENDING_TEXT,
  voiceHistoryText,
  voiceNoteLogText,
} from "@/lib/alldog-bot/logic";
import {
  areaToCheckNote,
  fixOutOfAreaLines,
  isKnownServiceCity,
  unknownAreaLine,
  unknownAreaToolNote,
} from "@/lib/alldog-bot/areas";
import {
  callbackClosingText,
  closingWithTransition,
  isClosingText,
  TRANSITION_LINE,
  withClosing,
} from "@/lib/alldog-bot/handoff";
import { saveLeadInput } from "@/lib/alldog-bot/agent";
import { botModel } from "@/lib/alldog/config";

describe("28a — voice notes", () => {
  it("an inbound voice note is classified for transcription (media id kept)", () => {
    expect(classifyInbound({ id: "w1", from: "972501234567", type: "audio", audio: { id: "MEDIA1", mime_type: "audio/ogg; codecs=opus", voice: true } }))
      .toEqual({ kind: "voice", mediaId: "MEDIA1", mimeType: "audio/ogg; codecs=opus" });
    // No media id → the old media path (a person looks at it).
    expect(classifyInbound({ id: "w1", from: "972501234567", type: "audio" })).toEqual({ kind: "media", label: "הודעה קולית" });
    // Images stay media.
    expect(classifyInbound({ id: "w1", from: "972501234567", type: "image" })).toEqual({ kind: "media", label: "תמונה" });
  });

  it("the transcript counts as the customer's words; pending / failed do not", () => {
    expect(customerWords({ kind: "voice", text: "הכלב שלי נובח כל הלילה" })).toBe("הכלב שלי נובח כל הלילה");
    expect(customerWords({ kind: "voice", text: VOICE_PENDING_TEXT })).toBeNull();
    expect(customerWords({ kind: "voice", text: VOICE_FAILED_TEXT })).toBeNull();
    expect(customerWords({ kind: "media", text: "[תמונה]" })).toBeNull();
    expect(customerWords({ kind: "text", text: "היי" })).toBe("היי");
    expect(isVoiceFailed({ kind: "voice", text: VOICE_FAILED_TEXT })).toBe(true);
    expect(isVoiceFailed({ kind: "voice", text: VOICE_PENDING_TEXT })).toBe(true); // still pending after the wait = failed
    expect(isVoiceFailed({ kind: "voice", text: "שלום" })).toBe(false);
  });

  it("the model sees the transcript as the customer's turn", () => {
    const turns = toChatTurns([{ role: "user", text: voiceHistoryText("יש לי גור בן חמישה חודשים") }]);
    expect(turns).toEqual([{ role: "user", content: "(הודעה קולית, תומללה) יש לי גור בן חמישה חודשים" }]);
  });

  it("cleans a transcript; empty / audio events only = failed", () => {
    expect(cleanTranscript("  היי ,  (מוזיקה) יש לי כלב  ")).toBe("היי , יש לי כלב");
    expect(cleanTranscript("(רעש)")).toBeNull();
    expect(cleanTranscript("")).toBeNull();
    expect(cleanTranscript(null)).toBeNull();
  });

  it("failed transcription: Or's line, never 'נציגה תראה את ההודעה'", () => {
    expect(VOICE_FAILED_REPLY).toBe("לא הצלחתי לשמוע את ההקלטה 🙏 אפשר לכתוב לי בקצרה?");
    expect(VOICE_FAILED_REPLY).not.toMatch(/נציג/);
    expect(findTextIssues(VOICE_FAILED_REPLY)).toEqual([]);
  });

  it("the lead journal gets the transcript + the WhatsApp media id", () => {
    expect(voiceNoteLogText("MEDIA1", "הכלב נובח")).toBe('[וואטסאפ · בוט] 🎤 הודעה קולית · תמלול: "הכלב נובח" · מזהה הקלטה ב-WhatsApp: MEDIA1');
    expect(voiceNoteLogText("MEDIA2", null)).toContain("התמלול נכשל");
    expect(voiceNoteLogText("MEDIA2", null)).toContain("MEDIA2");
  });
});

describe("28b — city outside the list", () => {
  it("known cities (with common spellings) vs. a city to check", () => {
    for (const c of ["תל אביב", "ת״א", "רמת גן", "פתח תקוה", "כפר סבא", "ראשון לציון", "ראשל״צ", "נס ציונה", "הרצליה פיתוח"]) {
      expect(isKnownServiceCity(c)).toBe(true);
    }
    for (const c of ["קריית שמונה", "באר שבע", "חיפה", "אילת"]) expect(isKnownServiceCity(c)).toBe(false);
    expect(isKnownServiceCity("")).toBe(true);
  });

  it("Or's optimistic line, by gender, and the lead note", () => {
    expect(unknownAreaLine("m")).toBe("מעולה, אני בודק מי מהמאלפים שלנו זמין באזור שלך, והנציגה תחזור אליך עם תשובה 🙂");
    expect(unknownAreaLine("f")).toContain("תחזור אלייך עם תשובה");
    expect(unknownAreaLine("unknown")).toContain("תחזור בטלפון עם תשובה");
    expect(areaToCheckNote(" קריית  שמונה ")).toBe("[וואטסאפ · בוט] אזור לבדיקה: קריית שמונה");
    expect(unknownAreaToolNote("קריית שמונה", "m")).toContain(unknownAreaLine("m"));
  });

  it("'מחוץ לאזור' / 'לא באזור' / 'לא ברשימה' never reach the customer", () => {
    for (const bad of [
      "קריית שמונה מחוץ לאזורי השירות שלנו , אבל יש ייעוץ בזום",
      "זה לא באזור שלנו",
      "העיר לא ברשימה שלנו",
      "אנחנו לא מגיעים לקריית שמונה",
    ]) {
      const out = fixOutOfAreaLines(`${bad}\nאיזה גזע הוא ובן כמה ?`, "m");
      expect(out).toBe(`${unknownAreaLine("m")}\nאיזה גזע הוא ובן כמה ?`);
    }
    // Once per conversation.
    expect(fixOutOfAreaLines("זה מחוץ לאזור\nבן כמה הוא ?", "f", [unknownAreaLine("f")])).toBe("בן כמה הוא ?");
    // "בכל הארץ" / normal lines untouched.
    expect(fixOutOfAreaLines("אילוף בתנאי פנסיון זמין בכל הארץ", "m")).toBe("אילוף בתנאי פנסיון זמין בכל הארץ");
  });
});

describe("28c — transition line before the closing", () => {
  it("callback closing = transition + a shorter closing, no repeated content", () => {
    const closing = closingWithTransition(callbackClosingText("soon", "m"));
    expect(closing).toBe(`${TRANSITION_LINE}\nמעולה, רשמתי הכל 🙏 אני דואג שנציגת AllDog תחזור אליך טלפונית בהקדם. אם יש עוד משהו בינתיים, אפשר לכתוב לי פה`);
    expect(TRANSITION_LINE).toBe(
      "אני מעביר את כל הפרטים לנציגה. היא תסביר לך על כל התוכניות והמסלולים, ומשם תחליטו יחד אם מתאים לעבוד עם מאלף מקצועי ואיזה."
    );
    expect(isClosingText(closing)).toBe(true);
    expect(findTextIssues(closing)).toEqual([]);
    // Already sent earlier → only the closing.
    expect(closingWithTransition(callbackClosingText("soon", "m"), true)).toBe(callbackClosingText("soon", "m"));
  });

  it("the model's reply to the problem stays before the transition; its own callback lines are dropped", () => {
    const closing = closingWithTransition(callbackClosingText("soon", "f"));
    const out = withClosing("נביחות על כלבים בטיול זה משהו שעובדים עליו הרבה\nאני מעביר את הפרטים לנציגה", closing);
    expect(out).toBe(`נביחות על כלבים בטיול זה משהו שעובדים עליו הרבה\n\n${closing}`);
    // The model wrote the closing itself → the transition is still added in front.
    const own = withClosing(callbackClosingText("soon", "f"), closing);
    expect(own.startsWith(TRANSITION_LINE)).toBe(true);
  });

  it("save_lead accepts another problem mentioned on the way", () => {
    expect(saveLeadInput.parse({ other_issues: "  נובח   על כלבים " })).toEqual({ other_issues: "נובח על כלבים" });
  });
});

describe("28d — Hebrew slips that came back", () => {
  it("'מחטף' → 'חוטף'", () => {
    expect(fixHebrewSlips("הוא מחטף אוכל מהשולחן")).toBe("הוא חוטף אוכל מהשולחן");
    expect(findTextIssues("הוא מחטף אוכל")).toEqual([{ kind: "wrong_form", text: "מחטף" }]);
  });
  it("'חמש חודשים' → 'חמישה חודשים' (feminine number + masculine noun)", () => {
    expect(fixHebrewSlips("גור בן חמש חודשים")).toBe("גור בן חמישה חודשים");
    expect(fixHebrewSlips("כבר שלוש שבועות , ושתי ימים")).toBe("כבר שלושה שבועות , ושני ימים");
    expect(findTextIssues("בן חמש חודשים")).toEqual([{ kind: "number_gender", text: "חמש חודשים" }]);
    // Correct forms untouched.
    expect(fixHebrewSlips("בת חמש שנים , חמישה חודשים")).toBe("בת חמש שנים , חמישה חודשים");
    expect(findTextIssues("בת חמש שנים , חמישה חודשים")).toEqual([]);
  });
  it("doubled / merged words still caught", () => {
    expect(polishReply("כבר חודחודשיים שזה ככה")).toBe("כבר חודשיים שזה ככה");
    expect(findTextIssues("כבר חודחודשיים")).toEqual([{ kind: "merged_word", text: "חודחודשיים" }]);
    expect(findTextIssues("של של")).toEqual([{ kind: "duplicate_word", text: "של של" }]);
  });
});

describe("model from ALLDOG_BOT_MODEL", () => {
  const OLD = process.env;
  afterEach(() => {
    process.env = OLD;
  });
  it("claude-opus-5-5 passes through as is (no fallback to the default)", () => {
    process.env = { ...OLD, ALLDOG_BOT_MODEL: "claude-opus-5-5" };
    expect(botModel()).toBe("claude-opus-5-5");
    process.env = { ...OLD, ALLDOG_BOT_MODEL: " claude-opus-5-5\n" };
    expect(botModel()).toBe("claude-opus-5-5");
    process.env = { ...OLD, ALLDOG_BOT_MODEL: "" };
    expect(botModel()).toBe("claude-sonnet-5-5");
  });
});
