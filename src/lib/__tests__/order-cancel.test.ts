import { canCancelOrder } from "@/lib/order-cancel";

describe("canCancelOrder", () => {
  it("draft / confirmed → always", () => {
    expect(canCancelOrder("draft", 0)).toBe(true);
    expect(canCancelOrder("confirmed", 300)).toBe(true);
  });
  it("completed / in_progress → only when nothing was paid (ticket: unpaid completed order stuck as debt)", () => {
    expect(canCancelOrder("completed", 0)).toBe(true);
    expect(canCancelOrder("in_progress", 0)).toBe(true);
    expect(canCancelOrder("completed", 450)).toBe(false);
  });
  it("cancelled / unknown → no", () => {
    expect(canCancelOrder("cancelled", 0)).toBe(false);
    expect(canCancelOrder("weird", 0)).toBe(false);
  });
});
