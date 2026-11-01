import { changelogForVertical, hasDogText, helpCategoriesForVertical } from "@/lib/verticals/help";

const CATS = [
  { id: "customers", items: [{ question: "איך מוסיפים לקוח?", answer: "לוחצים על לקוח חדש" }, { question: "איך מוסיפים כלב?", answer: "בכרטיס" }] },
  { id: "pets", items: [{ question: "מעקב משקל", answer: "בכרטיס" }] },
  { id: "boarding", items: [{ question: "חדרים", answer: "מפה" }] },
  { id: "finance", items: [{ question: "תשלום", answer: "מעקב פנסיון" }] },
];
const LOG = [
  { title: "דשבורד חדש", items: ["דשבורד — עיצוב חדש", "פנסיון — יומן טיפול"] },
  { title: "מודול כלבי שירות", items: ["ייבוא"] },
];

describe("help per vertical", () => {
  it("dogs: everything unchanged", () => {
    expect(helpCategoriesForVertical(CATS, "dogs")).toEqual(CATS);
    expect(changelogForVertical(LOG, undefined)).toEqual(LOG);
  });
  it("generic: no dog categories, no dog-worded entries, no empty categories", () => {
    const out = helpCategoriesForVertical(CATS, "generic");
    expect(out.map((c) => c.id)).toEqual(["customers"]);
    expect(out[0].items.map((i) => i.question)).toEqual(["איך מוסיפים לקוח?"]);
    for (const c of out) for (const i of c.items) expect(hasDogText(i.question + i.answer)).toBe(false);
  });
  it("generic changelog: dog lines and dog-titled releases removed", () => {
    expect(changelogForVertical(LOG, "generic")).toEqual([{ title: "דשבורד חדש", items: ["דשבורד — עיצוב חדש"] }]);
  });
});

describe("hasDogText", () => {
  it.each(["הגורם המרכזי", "חייה של", "מגורים", "שירות לקוחות"])("no false positive: %s", (t) => expect(hasDogText(t)).toBe(false));
  it.each(["הוספת חיה", "לחיה", "גור בן 3", "הגור", "כלבים", "פנסיון", "🐾"])("dog wording: %s", (t) => expect(hasDogText(t)).toBe(true));
});
