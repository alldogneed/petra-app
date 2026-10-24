/** Item 27h: a lead deleted by hand in Petra → the bot drops the dangling link and re-resolves by phone. */
const mockLeads = new Set<string>();
const mockConvUpdate = jest.fn(async () => ({}));
jest.mock("@/lib/prisma", () => {
  const prisma = {
    lead: { findFirst: jest.fn(async ({ where }: { where: { id: string } }) => (mockLeads.has(where.id) ? { id: where.id } : null)) },
    waBotConversation: { update: (...a: unknown[]) => mockConvUpdate(...(a as [])) },
  };
  return { __esModule: true, default: prisma, prisma };
});
jest.mock("@/lib/rate-limit", () => ({ claimOnce: jest.fn(async () => true) }));

import { dropDeletedLeadLink, type BotConversationRef } from "@/lib/alldog-bot/actions";

const ref = (leadId: string | null): BotConversationRef => ({
  id: "conv-1", businessId: "biz", phone: "972521234567", profileName: null, leadId,
  summaryCallLogId: leadId ? "log-1" : null, attributionSource: null, attributionPage: null,
});

beforeEach(() => {
  mockLeads.clear();
  mockConvUpdate.mockClear();
});

it("an existing lead stays linked", async () => {
  mockLeads.add("lead-1");
  const r = ref("lead-1");
  await dropDeletedLeadLink(r);
  expect(r.leadId).toBe("lead-1");
  expect(mockConvUpdate).not.toHaveBeenCalled();
});

it("a deleted lead → link + summary log cleared on the conversation", async () => {
  const r = ref("33242f65-deleted");
  await dropDeletedLeadLink(r);
  expect(r).toMatchObject({ leadId: null, summaryCallLogId: null });
  expect(mockConvUpdate).toHaveBeenCalledWith({ where: { id: "conv-1" }, data: { leadId: null, summaryCallLogId: null } });
});
