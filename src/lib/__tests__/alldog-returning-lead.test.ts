/** Item 24 (Or): returning contact → active lead vs new lead; generic names; missed-call notes counter. */
jest.mock("@/lib/prisma", () => ({ __esModule: true, default: {}, prisma: {} }));
jest.mock("@/services/clients", () => ({}));

import { isActiveLead, isPlaceholderLeadName, returningContactNote, STALE_LEAD_DAYS } from "@/lib/alldog/leads";
import { missedCallNotes } from "@/lib/paycall";

const now = new Date("2026-10-24T10:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

describe("isActiveLead", () => {
  it("open + touched recently → active", () => {
    expect(isActiveLead({ closed: false, createdAt: daysAgo(200), lastContactedAt: daysAgo(10) }, now)).toBe(true);
    expect(isActiveLead({ closed: false, createdAt: daysAgo(5), lastContactedAt: null }, now)).toBe(true);
  });
  it("closed (won / lost) → never active", () => {
    expect(isActiveLead({ closed: true, createdAt: daysAgo(1), lastContactedAt: daysAgo(0) }, now)).toBe(false);
  });
  it(`no contact for more than ${STALE_LEAD_DAYS} days → not active`, () => {
    expect(isActiveLead({ closed: false, createdAt: daysAgo(300), lastContactedAt: daysAgo(STALE_LEAD_DAYS + 1) }, now)).toBe(false);
    expect(isActiveLead({ closed: false, createdAt: daysAgo(300), lastContactedAt: daysAgo(STALE_LEAD_DAYS - 1) }, now)).toBe(true);
  });
  it("a follow-up still ahead keeps an old lead active", () => {
    expect(isActiveLead({ closed: false, createdAt: daysAgo(300), lastContactedAt: daysAgo(90), nextFollowUpAt: daysAgo(-3) }, now)).toBe(true);
  });
});

describe("returningContactNote", () => {
  it("links the previous lead and the customer", () => {
    expect(returningContactNote("L1", "C1")).toBe(
      "פונה חוזר – ליד קודם: https://petra-app.com/leads?lead=L1\nלקוח קיים: https://petra-app.com/customers/C1"
    );
    expect(returningContactNote("L1", null)).toBe("פונה חוזר – ליד קודם: https://petra-app.com/leads?lead=L1");
    expect(returningContactNote(null, null)).toBeNull();
  });
});

describe("generic lead names are replaced by the name the customer gave", () => {
  it.each(["", " ", "שיחה מ-0501112233", "וואטסאפ 0501112233", "ליד", "לקוח חדש", "ללא שם", "?", "050-1112233", "+972501112233"])(
    "%j → placeholder",
    (name) => expect(isPlaceholderLeadName(name)).toBe(true)
  );
  it.each(["רויטל כהן", "דני", "Or"])("%j → a real name", (name) => expect(isPlaceholderLeadName(name)).toBe(false));
});

describe("missedCallNotes", () => {
  it("updates only the counter line", () => {
    const notes = "נוצר אוטומטית משיחה שלא נענתה דרך Paycall.\nמספר ניסיונות: 1\n\nפונה חוזר – ליד קודם: x";
    expect(missedCallNotes(notes, 3)).toBe("נוצר אוטומטית משיחות שלא נענו דרך Paycall.\nמספר ניסיונות: 3\n\nפונה חוזר – ליד קודם: x");
  });
  it("adds a counter to a lead that came from elsewhere, keeping its notes", () => {
    expect(missedCallNotes("פרטי הכלב: לולה", 2)).toBe("פרטי הכלב: לולה\n\nנוצר אוטומטית משיחות שלא נענו דרך Paycall.\nמספר ניסיונות: 2");
  });
});
