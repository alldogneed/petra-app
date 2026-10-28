/** 27/10: a missed call whose lead was deleted by hand must not open a new lead on the next sync. */
jest.mock("@/lib/read-env", () => ({ readEnv: (k: string) => ({ PAYCALL_BUSINESS_ID: "biz", PAYCALL_NEW_LEAD_STAGE_ID: "stage" } as Record<string, string>)[k] }));
const claims = new Set<string>();
jest.mock("@/lib/rate-limit", () => ({
  hasActiveClaim: async (k: string) => claims.has(k),
  claimOnce: async (k: string) => (claims.has(k) ? false : (claims.add(k), true)),
}));
const leadCreate = jest.fn(async () => ({ id: "L-new" }));
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    callLog: { findFirst: jest.fn(async () => null), create: jest.fn(async () => ({})), count: jest.fn(async () => 1) },
    lead: { create: (...a: unknown[]) => leadCreate(...(a as [])), update: jest.fn(async () => ({})), findUnique: jest.fn(async () => null), findFirst: jest.fn(async () => null) },
    customer: { findMany: jest.fn(async () => []) },
  },
}));

import { processMissedCall } from "@/lib/paycall";

describe("processMissedCall — handled call ids", () => {
  it("skips a call already marked as handled (lead deleted since)", async () => {
    claims.add("paycall-call-handled:999");
    const res = await processMissedCall({
      ID: "999", START: "2026-10-26 17:03:00", END: "2026-10-26 17:03:30", NAME: "", CALLERID: "0501234567",
      CALLEE: "", DISPOSITION: "CANCEL", DURATION: "30", PR_NUMBER: "33818670", ANS_TIME: null,
    });
    expect(res.skipped).toBe(true);
    expect(leadCreate).not.toHaveBeenCalled();
  });
});
