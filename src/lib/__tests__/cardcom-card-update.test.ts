/**
 * applyCardUpdate — creates a new recurring order that bills when the paid period
 * ends, deactivates the old (broken) one, never touches access, and can never
 * leave two live orders (retries, races, errors after creation).
 */
const events: any[] = [];
let business: any;
let txFeed: any[] = [];
let failNextEventCreate = false;

const freshBusiness = () => ({
  id: "biz1", name: "royal dog", email: "rd@example.com", tier: "pro",
  subscriptionStatus: "active", subscriptionEndsAt: new Date(Date.now() + 7 * 86_400_000), cardcomRecurringId: "20008",
});

jest.mock("@/lib/prisma", () => {
  const db = {
    subscriptionEvent: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.lowprofileCode) {
          const types: string[] = where.eventType?.in ?? [where.eventType];
          return events.find((e) => e.lowprofileCode === where.lowprofileCode && types.includes(e.eventType)) ?? null;
        }
        return { amount: 199, tier: "pro", metadata: { paidTier: "pro", CardOwnerID: "029434107" } };
      }),
      create: jest.fn(async ({ data }: any) => {
        if (failNextEventCreate && data.eventType === "card_updated") { failNextEventCreate = false; throw new Error("db down"); }
        events.push(data); return data;
      }),
    },
    business: {
      findUnique: jest.fn(async () => ({ ...business })),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (business.id !== where.id || business.cardcomRecurringId !== where.cardcomRecurringId) return { count: 0 };
        Object.assign(business, data); return { count: 1 };
      }),
    },
  };
  return { __esModule: true, default: db, prisma: db };
});
jest.mock("@/lib/email", () => ({ sendEmail: jest.fn(async () => undefined) }));
jest.mock("@/lib/cardcom-activation", () => ({ safeEncryptCardcomToken: (v: string | null) => (v ? `enc(${v})` : null) }));
jest.mock("@/lib/cardcom-transactions", () => {
  const actual = jest.requireActual("@/lib/cardcom-transactions");
  return { ...actual, listTerminalTransactions: async () => txFeed };
});
const createMock = jest.fn();
const cancelMock = jest.fn();
jest.mock("@/lib/cardcom-recurring", () => {
  const actual = jest.requireActual("@/lib/cardcom-recurring");
  return { ...actual, createCardcomRecurring: (...a: any[]) => createMock(...a), cancelCardcomRecurring: (...a: any[]) => cancelMock(...a) };
});

import { applyCardUpdate, resolveCardUpdateBusiness } from "@/lib/cardcom-card-update";

const verified = { ResponseCode: "0", DealResponse: "0", Token: "real-cardcom-token", TokenExDate: "0329", CardValidityMonth: "03", CardValidityYear: "2029", CardOwnerID: "029434107", UserId: "biz1::cardupdate" };
let nextId = 20040;

beforeEach(() => {
  business = freshBusiness();
  events.length = 0;
  txFeed = [];
  createMock.mockReset().mockImplementation(async () => ({ success: true, recurringId: String(++nextId) }));
  cancelMock.mockReset().mockResolvedValue({ success: true });
});

it("new order billed at the end of the paid period, old one cancelled, access untouched, token never in the event", async () => {
  const before = { ...business };
  const out: any = await applyCardUpdate({ businessId: "biz1", lowProfileCode: "lp-1", data: verified });
  expect(out.status).toBe("updated");
  const args = createMock.mock.calls[0][0];
  expect(args.cardToken).toBe("real-cardcom-token");
  expect(args.price).toBe(199);
  expect(args.nextBillDate).toEqual(before.subscriptionEndsAt);
  expect(cancelMock).toHaveBeenCalledWith("20008");
  expect(business.cardcomRecurringId).toBe(out.recurringId);
  expect(business.cardcomToken).toBe("enc(real-cardcom-token)");
  expect(business.tier).toBe(before.tier);
  expect(business.subscriptionStatus).toBe(before.subscriptionStatus);
  expect(business.subscriptionEndsAt).toEqual(before.subscriptionEndsAt);
  const ev = events.find((e) => e.eventType === "card_updated");
  expect(JSON.stringify(ev.metadata)).not.toContain("real-cardcom-token");
});

it("Cardcom retries the indicator → no second order", async () => {
  await applyCardUpdate({ businessId: "biz1", lowProfileCode: "lp-1", data: verified });
  createMock.mockClear();
  const out = await applyCardUpdate({ businessId: "biz1", lowProfileCode: "lp-1", data: verified });
  expect(out.status).toBe("duplicate");
  expect(createMock).not.toHaveBeenCalled();
});

it("two calls racing → the loser cancels its own new order (never two live orders)", async () => {
  const [a, b] = await Promise.all([
    applyCardUpdate({ businessId: "biz1", lowProfileCode: "lp-a", data: verified }),
    applyCardUpdate({ businessId: "biz1", lowProfileCode: "lp-b", data: verified }),
  ]);
  const statuses = [a.status, b.status].sort();
  expect(statuses).toEqual(["duplicate", "updated"]);
  const created = createMock.mock.results.map((r: any) => r.value);
  const ids = await Promise.all(created).then((rs: any[]) => rs.map((r) => r.recurringId));
  const loser = ids.find((id: string) => id !== business.cardcomRecurringId);
  expect(cancelMock).toHaveBeenCalledWith(loser);
  expect(cancelMock).toHaveBeenCalledWith("20008");
});

it("cancelled between opening the page and submitting → no order", async () => {
  business.subscriptionStatus = "cancel_pending";
  const out = await applyCardUpdate({ businessId: "biz1", lowProfileCode: "lp-c", data: verified });
  expect(out.status).toBe("failed");
  expect(createMock).not.toHaveBeenCalled();
});

it("error after the order was created → the new order is cancelled and the old one restored", async () => {
  failNextEventCreate = true;
  const out = await applyCardUpdate({ businessId: "biz1", lowProfileCode: "lp-e", data: verified });
  expect(out.status).toBe("failed");
  const newId = (await createMock.mock.results[0].value).recurringId;
  expect(cancelMock).toHaveBeenCalledWith(newId);
  expect(business.cardcomRecurringId).toBe("20008");
});

it("no token / Cardcom refuses the order → existing order untouched", async () => {
  const { Token: _t, ...noToken } = verified;
  expect((await applyCardUpdate({ businessId: "biz1", lowProfileCode: "lp-2", data: noToken })).status).toBe("failed");
  createMock.mockResolvedValue({ success: false, error: "8000" });
  expect((await applyCardUpdate({ businessId: "biz1", lowProfileCode: "lp-3", data: verified })).status).toBe("failed");
  expect(cancelMock).not.toHaveBeenCalled();
  expect(business.cardcomRecurringId).toBe("20008");
});

it("a working old order already charged this period → the new one starts a month later", async () => {
  business.subscriptionEndsAt = new Date(Date.now() - 86_400_000); // period ended yesterday
  const chargedAt = new Date(Date.now() - 20 * 3600_000);
  txFeed = [{ ResponseCode: 0, Amount: 199, CreateDate: chargedAt.toISOString(), CardOwnerIdentityNumber: "029434107" }];
  await applyCardUpdate({ businessId: "biz1", lowProfileCode: "lp-p", data: verified });
  const first: Date = createMock.mock.calls[0][0].nextBillDate;
  expect(Math.round((first.getTime() - chargedAt.getTime()) / 86_400_000)).toBe(30);
});

it("resolves the business only for card-update sessions", async () => {
  expect(await resolveCardUpdateBusiness({ UserId: "biz1::cardupdate" }, "x")).toBe("biz1");
  expect(await resolveCardUpdateBusiness({ UserId: "biz1::pro" }, "no-such-code")).toBeNull();
});
