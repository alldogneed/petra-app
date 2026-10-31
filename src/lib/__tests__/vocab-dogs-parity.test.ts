/**
 * Zero behaviour change for dogs businesses: every string that moved into the
 * dictionary must render, for "dogs", exactly what the code rendered before
 * (copied verbatim from the replaced code — git history of each file).
 */
import { vocab, type VocabKey } from "@/lib/verticals/vocab";

const CASES: { key: VocabKey; params?: Record<string, string>; before: string }[] = [
  { key: "nav.training", before: "ניהול תהליכי אילוף" },
  { key: "training.page_title", before: "אימונים" },
  { key: "training.page_subtitle", before: "קבוצות ותוכניות אימון" },
  { key: "search.placeholder", before: "חפש לקוח, חיית מחמד, תור, ליד, משימה..." },
  {
    key: "customer.followup_message",
    params: { name: "דנה", pet: "רקסי", service: "אילוף", petPart: " של רקסי" },
    before: `שלום דנה 😊\n\nרציתי לבדוק איך רקסי מרגיש/ת אחרי אילוף של רקסי.\n\nאם יש שאלות אנחנו כאן תמיד 🐾`,
  },
  {
    key: "customer.welcome_message",
    params: { name: "דנה" },
    before: `שלום דנה 😊\n\nברוכים הבאים! שמחים שהצטרפתם אלינו 🐾\nאנחנו כאן לכל שאלה ובקשה.\n\nנשמח לראותכם בקרוב!`,
  },
  { key: "customer.bulk_placeholder", before: "שלום {שם}! רצינו להזמין אותך לתור הבא שלך... 🐾" },
  { key: "customer.bulk_delete_warning", before: "פעולה זו תמחק גם את חיות המחמד, התורים ונתוני הלקוח לצמיתות." },
  { key: "service_type.training", before: "אילוף" },
  { key: "pricing.category_program", before: "אילוף" },
  { key: "order.training_kind", before: "סוג האילוף" },
  { key: "order.package_label", before: "חבילת אילוף" },
  { key: "order.no_packages", before: "אין חבילות פעילות. הגדר פריט אילוף עם כמות מפגשים במחירון." },
  { key: "order.payment_request_greeting", params: { name: "דנה" }, before: "שלום דנה! 🐾" },
  { key: "order.open_program", before: "פתח תוכנית אילוף →" },
  { key: "picker.customer_placeholder", before: "חיפוש לפי שם לקוח, טלפון או שם הכלב" },
];

describe("dogs values are the pre-verticals text", () => {
  it.each(CASES)("$key", ({ key, params, before }) => {
    expect(vocab(key, { params })).toBe(before);
    expect(vocab(key, { vertical: "dogs", params })).toBe(before);
  });
});

describe("every dictionary key that replaced code text is covered here", () => {
  it("lists every key that is not a new (verticals-only) string", () => {
    // Keys that never existed as code text (new UI) — nothing to compare against.
    const NEW_KEYS = new Set<string>(["business.kind", "business.kind_hint"]);
    const covered = new Set(CASES.map((c) => c.key));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const all = Object.keys(require("../../../messages/he.json").vocab);
    expect(all.filter((k) => !covered.has(k as VocabKey) && !NEW_KEYS.has(k))).toEqual([]);
  });
});
