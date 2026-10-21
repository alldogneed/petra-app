import { claimWhere, SEND_LEASE_MS } from "@/lib/scheduled-message-claim";

const now = new Date("2026-10-21T10:00:00Z");
const due = new Date(now.getTime() - 60_000);
const later = new Date(now.getTime() + 3_600_000);
const old = new Date(now.getTime() - 10 * 60_000);

describe("scheduled message claim", () => {
  it("cron: compare-and-swap on updatedAt + lease, unsent statuses only", () => {
    const w = claimWhere({ id: "m1", status: "PENDING", updatedAt: old, sendAt: due }, now);
    expect(w.id).toBe("m1");
    expect(w.status).toEqual({ in: ["PENDING", "FAILED"] });
    expect(w.AND[0]).toEqual({ updatedAt: old });
    expect(w.AND[1]).toEqual({ updatedAt: { lt: new Date(now.getTime() - SEND_LEASE_MS) } });
  });
  it("cron: FAILED retries also wait for the lease", () => {
    const w = claimWhere({ id: "m1", status: "FAILED", updatedAt: old, sendAt: due }, now);
    expect(w.AND[1]).toHaveProperty("updatedAt");
  });
  it("manual: a due PENDING message waits for the lease (cron may be sending it)", () => {
    const w = claimWhere({ id: "m1", status: "PENDING", updatedAt: old, sendAt: due }, now, { manual: true });
    expect(w.AND[1]).toHaveProperty("updatedAt");
  });
  it("manual: FAILED or not-yet-due messages are sent right away", () => {
    expect(claimWhere({ id: "m1", status: "FAILED", updatedAt: old, sendAt: due }, now, { manual: true }).AND[1]).toEqual({});
    expect(claimWhere({ id: "m1", status: "PENDING", updatedAt: old, sendAt: later }, now, { manual: true }).AND[1]).toEqual({});
  });
});
