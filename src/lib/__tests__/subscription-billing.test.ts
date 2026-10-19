jest.mock("@/lib/prisma", () => ({ __esModule: true, default: {}, prisma: {} }));

import { cardUpdateFirstBillDate, canUpdateCard, BILLING_CARD_EVENTS } from "@/lib/subscription-billing";
import { cardcomBillDate } from "@/lib/cardcom-recurring";

const now = new Date("2026-10-17T09:00:00Z");
const DAY = 86_400_000;

describe("cardUpdateFirstBillDate", () => {
  it("bills on the day the paid period ends", () => {
    const ends = new Date("2026-10-24T01:31:55Z");
    expect(cardUpdateFirstBillDate(ends, now)).toEqual(ends);
  });
  it("a lapsed / grace period bills tomorrow, never today or in the past", () => {
    expect(cardUpdateFirstBillDate(new Date("2026-10-08T09:42:34Z"), now).getTime()).toBe(now.getTime() + DAY);
    expect(cardUpdateFirstBillDate(new Date(now.getTime() + 3600_000), now).getTime()).toBe(now.getTime() + DAY);
  });
  it("no end date → tomorrow", () => {
    expect(cardUpdateFirstBillDate(null, now).getTime()).toBe(now.getTime() + DAY);
  });
});

describe("cardcomBillDate", () => {
  it("uses the Israel calendar day, DD/MM/YYYY", () => {
    // 22:30 UTC on 30.10 is already 31.10 in Israel (UTC+2 after DST ends on 25.10)
    expect(cardcomBillDate(new Date("2026-10-30T22:30:00Z"))).toBe("31/10/2026");
    expect(cardcomBillDate(new Date("2026-01-05T08:00:00Z"))).toBe("05/01/2026");
  });
});

describe("canUpdateCard", () => {
  it("only an active paid subscription", () => {
    expect(canUpdateCard({ tier: "pro", subscriptionStatus: "active" })).toBe(true);
    expect(canUpdateCard({ tier: "pro", subscriptionStatus: "expired" })).toBe(false);
    expect(canUpdateCard({ tier: "pro", subscriptionStatus: "cancel_pending" })).toBe(false);
    expect(canUpdateCard({ tier: "free", subscriptionStatus: "active" })).toBe(false);
  });
});

it("the renewal cron matches charges against the latest card update too", () => {
  expect(BILLING_CARD_EVENTS).toContain("card_updated");
});
