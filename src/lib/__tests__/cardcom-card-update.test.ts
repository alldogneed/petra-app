/**
 * applyCardUpdate — the card-update flow must create a new recurring order that
 * bills when the paid period ends, deactivate the old (broken) one, never touch
 * access, and be idempotent per lowprofilecode.
 */
const events: any[] = [];
const business: any = {
  id: "biz1", name: "royal dog", email: "rd@example.com", tier: "pro",
  subscriptionStatus: "active", subscriptionEndsAt: new Date("2026-10-24T01:31:55Z"), cardcomRecurringId: "20008",
};
const businessUpdates: any[] = [];

jest.mock("@/lib/prisma", () => {
  const db = {
    subscriptionEvent: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.lowprofileCode) {
          const types: string[] = where.eventType?.in ?? [where.eventType];
          return events.find((e) => e.lowprofileCode === where.lowprofileCode && types.includes(e.eventType)) ?? null;
        }
        // billingProfile: latest activation
        return { amount: 199, tier: "pro", metadata: { paidTier: "pro", CardOwnerID: "029434107" } };
      }),
      create: jest.fn(async ({ data }: any) => { events.push(data); return data; }),
    },
    business: {
      findUnique: jest.fn(async () => ({ ...business })),
      update: jest.fn(async ({ data }: any) => { businessUpdates.push(data); Object.assign(business, data); return business; }),
    },
  };
  return { __esModule: true, default: db, prisma: db };
});
jest.mock("@/lib/email", () => ({ sendEmail: jest.fn(async () => undefined) }));
jest.mock("@/lib/cardcom-activation", () => ({ safeEncryptCardcomToken: (v: string | null) => (v ? `enc(${v})` : null) }));
const createMock = jest.fn();
const cancelMock = jest.fn();
jest.mock("@/lib/cardcom-recurring", () => {
  const actual = jest.requireActual("@/lib/cardcom-recurring");
  return { ...actual, createCardcomRecurring: (...a: any[]) => createMock(...a), cancelCardcomRecurring: (...a: any[]) => cancelMock(...a) };
});

import { applyCardUpdate, resolveCardUpdateBusiness } from "@/lib/cardcom-card-update";

const verified = { ResponseCode: "0", DealResponse: "0", Token: "real-cardcom-token", TokenExDate: "0329", CardValidityMonth: "03", CardValidityYear: "2029", CardOwnerID: "029434107", UserId: "biz1::cardupdate" };

beforeEach(() => {
  createMock.mockReset().mockResolvedValue({ success: true, recurringId: "20042" });
  cancelMock.mockReset().mockResolvedValue({ success: true });
});

it("creates a new order billed at the end of the paid period, cancels the old one, keeps access", async () => {
  const out = await applyCardUpdate({ businessId: "biz1", lowProfileCode: "lp-1", data: verified });
  expect(out.status).toBe("updated");
  const args = createMock.mock.calls[0][0];
  expect(args.cardToken).toBe("real-cardcom-token");
  expect(args.price).toBe(199);
  expect(args.nextBillDate).toEqual(new Date("2026-10-24T01:31:55Z"));
  expect(cancelMock).toHaveBeenCalledWith("20008");
  expect(business.cardcomRecurringId).toBe("20042");
  expect(business.cardcomToken).toBe("enc(real-cardcom-token)");
  // access untouched
  for (const u of businessUpdates) {
    expect(u).not.toHaveProperty("tier");
    expect(u).not.toHaveProperty("subscriptionStatus");
    expect(u).not.toHaveProperty("subscriptionEndsAt");
  }
  const ev = events.find((e) => e.eventType === "card_updated");
  expect(ev.amount).toBe(199);
  expect(JSON.stringify(ev.metadata)).not.toContain("real-cardcom-token"); // token never stored in the event
  expect(ev.metadata.previousRecurringId).toBe("20008");
});

it("is idempotent per lowprofilecode (Cardcom retries the indicator)", async () => {
  const out = await applyCardUpdate({ businessId: "biz1", lowProfileCode: "lp-1", data: verified });
  expect(out.status).toBe("duplicate");
  expect(createMock).not.toHaveBeenCalled();
});

it("no token → fails without touching the existing order", async () => {
  const { Token: _t, ...noToken } = verified;
  const before = business.cardcomRecurringId;
  const out = await applyCardUpdate({ businessId: "biz1", lowProfileCode: "lp-2", data: noToken });
  expect(out.status).toBe("failed");
  expect(createMock).not.toHaveBeenCalled();
  expect(cancelMock).not.toHaveBeenCalled();
  expect(business.cardcomRecurringId).toBe(before);
});

it("Cardcom refuses the new order → old order is kept (never left with none)", async () => {
  createMock.mockResolvedValue({ success: false, error: "8000" });
  const before = business.cardcomRecurringId;
  const out = await applyCardUpdate({ businessId: "biz1", lowProfileCode: "lp-3", data: verified });
  expect(out.status).toBe("failed");
  expect(cancelMock).not.toHaveBeenCalled();
  expect(business.cardcomRecurringId).toBe(before);
});

it("resolves the business only for card-update sessions", async () => {
  expect(await resolveCardUpdateBusiness({ UserId: "biz1::cardupdate" }, "x")).toBe("biz1");
  // a payment session (UserId = biz::tier) is never treated as a card update
  expect(await resolveCardUpdateBusiness({ UserId: "biz1::pro" }, "no-such-code")).toBeNull();
});
