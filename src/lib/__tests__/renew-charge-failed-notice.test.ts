/**
 * renew-subscriptions: when the monthly charge is missing > 3 days, the business
 * owner gets ONE in-app message + email per period (not one per cron run).
 */
const events: any[] = [];
const systemMessages: any[] = [];
const ENDS = new Date(Date.now() - 5 * 86_400_000);

jest.mock("@/lib/prisma", () => {
  const db = {
    business: {
      findMany: jest.fn(async () => [{ id: "biz1", name: "שחר", tier: "pro", subscriptionEndsAt: ENDS, cardcomRecurringId: "20009" }]),
      update: jest.fn(),
    },
    subscriptionEvent: {
      findFirst: jest.fn(async () => ({ amount: 99, tier: "pro", metadata: { paidTier: "basic", CardOwnerID: "312324080" } })),
      count: jest.fn(async ({ where }: any) => events.filter((e) => e.businessId === where.businessId && e.eventType === where.eventType).length),
      create: jest.fn(async ({ data }: any) => { events.push(data); return data; }),
    },
    systemMessage: { create: jest.fn(async ({ data }: any) => { systemMessages.push(data); return data; }) },
    businessUser: { findMany: jest.fn(async () => [{ user: { email: "owner@example.com", name: "שחר" } }]) },
  };
  return { __esModule: true, default: db, prisma: db };
});
const paymentFailed = jest.fn(async () => undefined);
jest.mock("@/lib/email", () => ({ sendEmail: jest.fn(async () => undefined), sendPaymentFailedEmail: (...a: any[]) => (paymentFailed as any)(...a) }));
jest.mock("@/lib/cron-auth", () => ({ verifyCronAuth: () => true }));
jest.mock("@/lib/cardcom-activation", () => ({ reconcilePendingPayments: async () => [] }));
jest.mock("@/lib/cardcom-transactions", () => {
  const actual = jest.requireActual("@/lib/cardcom-transactions");
  // An unrelated charge on the terminal — none for this business's card.
  return { ...actual, listTerminalTransactions: async () => [{ ResponseCode: 0, Amount: 99, CreateDate: new Date().toISOString(), CardOwnerIdentityNumber: "000000000" }] };
});

import { GET } from "@/app/api/cron/renew-subscriptions/route";

const req = () => new Request("http://localhost/api/cron/renew-subscriptions") as any;

it("notifies the customer once, on the first overdue run of the period", async () => {
  await GET(req());
  expect(systemMessages).toHaveLength(1);
  expect(systemMessages[0].actionUrl).toBe("/settings?tab=subscription&update-card=1");
  expect(paymentFailed).toHaveBeenCalledTimes(1);
  expect((paymentFailed.mock.calls[0] as any)[0].to).toBe("owner@example.com");
  expect(events.filter((e) => e.eventType === "renew_overdue")).toHaveLength(1);

  await GET(req()); // next day's run
  expect(systemMessages).toHaveLength(1);
  expect(paymentFailed).toHaveBeenCalledTimes(1);
  expect(events.filter((e) => e.eventType === "renew_overdue")).toHaveLength(2);
});
