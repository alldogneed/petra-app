/**
 * Item 37 — the bot learns from 33 real PayCall sales calls + Or's decisions (26/10).
 * Deterministic parts: the prompt carries the rules, the text guard enforces the never-list, the
 * rep summary carries the new fields, and every new simulator scenario exists.
 */
import { applyConversationGuards, enforceSalesPolicy, findPolicyIssues, OLD_DOG_LINE, PUPPY_START_LINE } from "@/lib/alldog-bot/logic";
import { formatBotSummary, isPuppyAge, parseBotSummary, BOT_SUMMARY_JSON_SCHEMA } from "@/lib/alldog-bot/summary";
import { ALLDOG_BOT_PROMPT } from "@/lib/alldog-bot/prompt";
import { BOUNDARIES, OBJECTIONS } from "@/lib/alldog-bot/playbook";
import { checkConversation, MAX_QUESTIONS_BEFORE_CLOSE } from "@/lib/alldog-bot/conversation-checks";
import { SCENARIOS } from "../../../scripts/alldog-sim/scenarios";

const EMPTY = {
  dog_name: null, dog_breed: null, dog_age: null, problem: null, city: null, neighborhood: null, urgency: null,
  promised: null, next_step: null, caller_seems_minor: false, dog_since: null, previous_training: null, trigger: null,
  urgency_level: null, preferred_track: null, decision_maker: null, decision_maker_absent: false, objections: [],
  heard_from: null, needs_boarding_referral: false, travel_dates: null, recommended_step: null,
};
const summary = (over: Record<string, unknown>) => formatBotSummary(parseBotSummary(JSON.stringify({ ...EMPTY, ...over }))!, "26/10 10:00");

describe("Or's decisions in the prompt (26/10)", () => {
  it("lesson package, deposit, boarding for a vacation, puppies, business name", () => {
    expect(ALLDOG_BOT_PROMPT).toContain("חבילה של מינימום 6 מפגשים, 300 ₪ למפגש. מפגש בודד או ראשון 350 ₪");
    expect(ALLDOG_BOT_PROMPT).toContain("הנציגה תשריין איתך מועד, השריון במקדמה של 150 ₪ שמתקזזת");
    expect(ALLDOG_BOT_PROMPT).toContain("הבוט לא שולח קישור לתשלום ולא גובה");
    expect(ALLDOG_BOT_PROMPT).toContain("נציגה תחזור עם מקומות שמפעילים פנסיון");
    expect(ALLDOG_BOT_PROMPT).toContain("מתחילים במפגש אבחון וקבלת כלים לחינוך גורים: כלוב, נשיכות, צרכים וסדר יום");
    expect(ALLDOG_BOT_PROMPT).toContain('תמיד "AllDog"');
    expect(ALLDOG_BOT_PROMPT).not.toContain("שיעור: 300–350");
  });
  it("the sales questions (only when missing) and at most 7 questions", () => {
    expect(ALLDOG_BOT_PROMPT).toContain("כבר עבדת עם מאלף או מעון? מה לא עבד?");
    expect(ALLDOG_BOT_PROMPT).toContain("ולמה דווקא עכשיו?");
    expect(ALLDOG_BOT_PROMPT).toContain("חשוב לך שמישהו יעשה את רוב העבודה, או שאתה מעדיף ללמוד ולתרגל בעצמך?");
    expect(ALLDOG_BOT_PROMPT).toContain("מי עוד גר עם הכלב ומי מחליט");
    expect(ALLDOG_BOT_PROMPT).toContain("לכל היותר 7 שאלות");
    expect(MAX_QUESTIONS_BEFORE_CLOSE).toBe(7);
    expect(ALLDOG_BOT_PROMPT).toContain("בדיוק על זה עובדים בשיעור הראשון");
  });
  it("the objections and situations from the calls are in the playbook", () => {
    const ids = [...OBJECTIONS, ...BOUNDARIES].map((e) => e.id);
    for (const id of ["expensive", "consult-partner", "tried-trainers", "guarantee", "practice-myself", "method", "try-alone", "boarding-trip", "boarding-vacation", "puppy", "baby-coming", "old-dog", "far-city", "guard-training", "surrender", "wrong-number", "how-to-proceed", "lessons-price", "more-advice"]) {
      expect(ids).toContain(id);
    }
    const all = JSON.stringify([...OBJECTIONS, ...BOUNDARIES]);
    expect(all).toContain("אפשר לפרוס לתשלומים");
    expect(all).toContain("אסור לבקר את המאלף או המעון הקודם");
    expect(all).toContain("התהליך כחודש");
    expect(all).toContain("אסור להבטיח שהכלב יוכל להיות ליד התינוק");
  });
});

describe("text guard — Or's never-list", () => {
  it("no price for intensive / boarding (other prices stay)", () => {
    expect(findPolicyIssues("אילוף אינטנסיבי עולה 6,000 ₪")).toEqual(["service_price"]);
    expect(findPolicyIssues("פנסיון ב-150 שקל ליום")).toEqual(["service_price"]);
    expect(findPolicyIssues("אבחון 350 ₪, ואילוף אינטנסיבי נמשך 4 עד 6 שבועות")).toEqual([]);
    expect(enforceSalesPolicy("אילוף אינטנסיבי עולה 6,000 ₪. הנציגה תפרט בטלפון")).toBe("הנציגה תפרט בטלפון");
  });
  it("no promised result / refund", () => {
    expect(findPolicyIssues("תוצאות מובטחות או החזר כספי")).toContain("promise");
    expect(findPolicyIssues("הוא יהיה מאולף לכל מה שתרצה")).toContain("promise");
    expect(findPolicyIssues("מתחייבים למטרות שמוגדרות מראש באבחון ובתיאום הציפיות")).toEqual([]);
  });
  it("puppies: never 'עוד מוקדם' — the puppy line instead; old dogs: never 'מאוחר מדי'", () => {
    expect(enforceSalesPolicy("גור בן חודשיים? עוד מוקדם לאילוף. כדאי לחכות לגיל 4 חודשים")).toBe(`גור בן חודשיים? ${PUPPY_START_LINE}`);
    expect(enforceSalesPolicy("בגיל 11 זה כבר מאוחר מדי לשנות")).toBe(OLD_DOG_LINE);
  });
  it("no own boarding, no payment link, no baby promise", () => {
    expect(findPolicyIssues("יש לנו פנסיון בכפר סבא")).toEqual(["own_boarding"]);
    expect(findPolicyIssues("הנציגה שלנו תסביר לך על אילוף בתנאי פנסיון")).toEqual([]);
    expect(findPolicyIssues("באזור שלך עובדים אצלנו כמה מאלפים")).toEqual([]);
    expect(findPolicyIssues("אשלח לך קישור לתשלום")).toEqual(["payment"]);
    expect(findPolicyIssues("https://pay.example.com/x")).toEqual(["payment"]);
    expect(findPolicyIssues("כתבנו על זה מדריך:\nhttps://all-dog.co.il/guides/x")).toEqual([]);
    expect(findPolicyIssues("אחרי האילוף הוא יוכל להיות ליד התינוק")).toEqual(["baby_promise"]);
  });
  it("runs inside applyConversationGuards", () => {
    expect(applyConversationGuards("אילוף אינטנסיבי עולה 6,000 ₪\nמה הגזע שלו?", [], { userTexts: ["כמה זה עולה?"] })).toBe("מה הגזע שלו?");
  });
  it("the simulator flags a breach", () => {
    const r = checkConversation([
      { role: "user", text: "כמה עולה פנסיון עם אילוף?" },
      { role: "bot", text: "פנסיון עם אילוף עולה 7,500 ₪" },
    ]);
    expect(r.policyIssues).toEqual(["service_price"]);
    expect(r.problems.join(" ")).toContain("הפרת כללים");
  });
});

describe("rep summary — the new fields, one line each, only what is known", () => {
  it("schema asks for every field", () => {
    for (const k of ["dog_since", "previous_training", "trigger", "urgency_level", "preferred_track", "decision_maker", "decision_maker_absent", "objections", "heard_from", "needs_boarding_referral", "travel_dates", "recommended_step"]) {
      expect(BOT_SUMMARY_JSON_SCHEMA.required).toContain(k);
    }
  });
  it("only known fields are printed", () => {
    expect(summary({ dog_name: "מקס" }).split("\n")).toHaveLength(2);
  });
  it.each([
    ["boarding-trip", { trigger: "טיסה בעוד חודש", travel_dates: "בעוד חודש, לשבועיים", dog_since: "שנה", recommended_step: "להסביר שהתהליך כחודש ולהציע אינטנסיבי בבית" }, ["טריגר: טיסה בעוד חודש", "נסיעה: בעוד חודש, לשבועיים", "אצלם: שנה", "צעד מומלץ לנציגה:"]],
    ["boarding-vacation", { needs_boarding_referral: true, travel_dates: "10–17 באוגוסט" }, ["פנסיון לחופשה בלבד – להפנות למקומות שמפעילים פנסיון · תאריכים: 10–17 באוגוסט"]],
    ["puppy-young", { dog_age: "חודשיים וחצי", heard_from: "המלצה של הווטרינרית", recommended_step: "גור 10 שבועות, וטרינרית המליצה: לסגור שיעור פתיחה" }, ["גור בן חודשיים וחצי – להציע מפגש אבחון וכלים לחינוך גורים", "שמע עלינו: המלצה של הווטרינרית"]],
    ["baby-coming", { urgency: "תינוק בדרך, ננשך ילד", urgency_level: "high", trigger: "תינוק בדרך" }, ["דחיפות: תינוק בדרך, ננשך ילד (גבוהה)", "טריגר: תינוק בדרך"]],
    ["expensive", { objections: ["יקר", "שאל על תשלומים"], preferred_track: "private" }, ["התנגדויות: יקר · שאל על תשלומים", "מסלול מועדף: שיעורים פרטיים (ללמוד ולתרגל בעצמו)"]],
    ["consult-partner", { decision_maker: "הלקוח ואשתו", decision_maker_absent: true, recommended_step: "להציע שתי שעות לאבחון עם שני בני הזוג" }, ["מי מחליט: הלקוח ואשתו (לא היה בשיחה)", "צעד מומלץ לנציגה: להציע שתי שעות לאבחון עם שני בני הזוג"]],
    ["guarantee", { previous_training: "מאלף קודם, לא עזר לתוקפנות", objections: ["התחייבות"] }, ["ניסיון קודם: מאלף קודם, לא עזר לתוקפנות", "התנגדויות: התחייבות"]],
    ["method", { objections: ["שיטה", "תרגול עצמי"], preferred_track: "unsure" }, ["מסלול מועדף: לא בטוח"]],
    ["out-of-area", { city: "קריית שמונה", heard_from: "פודקאסט" }, ["עיר: קריית שמונה", "שמע עלינו: פודקאסט"]],
    ["old-dog", { dog_age: "11", urgency_level: "low" }, ["כלב: 11"]],
  ])("%s", (_id, fields, expected) => {
    const text = summary(fields);
    for (const e of expected) expect(text).toContain(e);
    expect(findPolicyIssues(text)).toEqual([]);
  });
  it("puppy ages", () => {
    for (const a of ["חודשיים וחצי", "10 שבועות", "גור", "4 חודשים", "חודש"]) expect(isPuppyAge(a)).toBe(true);
    for (const a of ["שנה", "8 חודשים", "שנה וחצי", "3", null]) expect(isPuppyAge(a)).toBe(false);
  });
});

describe("simulator scenarios (no identifying details)", () => {
  const ids = SCENARIOS.map((s) => s.id);
  it("at least 10 item-37 scenarios exist", () => {
    const wanted = ["boarding-trip", "boarding-vacation", "puppy-young", "baby-coming", "expensive", "consult-partner", "guarantee", "method", "try-alone", "out-of-area", "old-dog", "how-to-proceed", "wrong-number", "guard-training", "surrender"];
    for (const id of wanted) expect(ids).toContain(id);
  });
  it("no phone numbers in any scenario", () => {
    for (const s of SCENARIOS) expect(s.lines.join(" ")).not.toMatch(/0\d{8,9}|972\d{8,9}/);
  });
});
