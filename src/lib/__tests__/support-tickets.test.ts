import {
  isOverdue,
  isCustomerVisibleEvent,
  isSupportTicketStatus,
  validateSupportReply,
  waitingLabel,
  waitingSince,
  SUPPORT_SLA_HOURS,
} from "@/lib/support-tickets";

const H = 3_600_000;
const now = new Date("2026-10-16T12:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * H);

describe("waitingSince", () => {
  it("new ticket waits since the customer's message", () => {
    const t = { status: "open", createdAt: ago(2), lastCustomerMessageAt: ago(2), lastStaffReplyAt: null };
    expect(waitingSince(t)?.getTime()).toBe(ago(2).getTime());
  });
  it("legacy rows without lastCustomerMessageAt fall back to createdAt", () => {
    const t = { status: "open", createdAt: ago(5), lastCustomerMessageAt: null, lastStaffReplyAt: null };
    expect(waitingSince(t)?.getTime()).toBe(ago(5).getTime());
  });
  it("our reply newer than the customer's message → not waiting", () => {
    const t = { status: "in_progress", createdAt: ago(5), lastCustomerMessageAt: ago(5), lastStaffReplyAt: ago(1) };
    expect(waitingSince(t)).toBeNull();
  });
  it("customer answered after our reply → waiting again", () => {
    const t = { status: "in_progress", createdAt: ago(9), lastCustomerMessageAt: ago(1), lastStaffReplyAt: ago(3) };
    expect(waitingSince(t)?.getTime()).toBe(ago(1).getTime());
  });
  it("resolved never waits", () => {
    const t = { status: "resolved", createdAt: ago(50), lastCustomerMessageAt: ago(50), lastStaffReplyAt: null };
    expect(waitingSince(t)).toBeNull();
  });
});

describe("isOverdue", () => {
  it(`flags only waits of ${SUPPORT_SLA_HOURS}h+`, () => {
    const base = { status: "open", createdAt: ago(10), lastStaffReplyAt: null };
    expect(isOverdue({ ...base, lastCustomerMessageAt: ago(SUPPORT_SLA_HOURS - 0.1) }, now)).toBe(false);
    expect(isOverdue({ ...base, lastCustomerMessageAt: ago(SUPPORT_SLA_HOURS) }, now)).toBe(true);
  });
  it("accepts ISO strings (API rows)", () => {
    expect(isOverdue({ status: "open", createdAt: ago(10).toISOString(), lastCustomerMessageAt: ago(10).toISOString(), lastStaffReplyAt: null }, now)).toBe(true);
  });
});

describe("helpers", () => {
  it("internal notes are hidden from customers", () => {
    expect(isCustomerVisibleEvent("internal_note")).toBe(false);
    expect(isCustomerVisibleEvent("staff_reply")).toBe(true);
    expect(isCustomerVisibleEvent("status_change")).toBe(true);
  });
  it("status guard", () => {
    expect(isSupportTicketStatus("resolved")).toBe(true);
    expect(isSupportTicketStatus("closed")).toBe(false);
    expect(isSupportTicketStatus(undefined)).toBe(false);
  });
  it("reply validation trims and bounds", () => {
    expect(validateSupportReply("  שלום  ")).toEqual({ ok: true, body: "שלום" });
    expect(validateSupportReply(" ").ok).toBe(false);
    expect(validateSupportReply(42).ok).toBe(false);
    expect(validateSupportReply("x".repeat(5001)).ok).toBe(false);
  });
  it("waiting label", () => {
    expect(waitingLabel(new Date(now.getTime() - 5 * 60_000), now)).toBe("5 דק׳");
    expect(waitingLabel(ago(1), now)).toBe("שעה");
    expect(waitingLabel(ago(3), now)).toBe("3 שעות");
    expect(waitingLabel(ago(72), now)).toBe("3 ימים");
  });
});
