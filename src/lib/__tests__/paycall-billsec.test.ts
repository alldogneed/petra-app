/** 27/10: answered calls without billsec in the liveLink were dropped — billsec now comes from the API. */
import { paycallBillsec, isSummarizableAnswer, parseLiveLinkParams } from "@/lib/paycall";

describe("paycallBillsec", () => {
  it("END − ANS_TIME", () => {
    expect(paycallBillsec({ END: "2026-10-27 15:40:30", ANS_TIME: "2026-10-27 15:38:00", DURATION: "170" })).toBe(150);
  });
  it("falls back to DURATION, null when unknown", () => {
    expect(paycallBillsec({ END: "", ANS_TIME: null, DURATION: "42" })).toBe(42);
    expect(paycallBillsec({ END: "", ANS_TIME: null, DURATION: "" })).toBeNull();
  });
  it("a liveLink without billsec is not 'short' (the webhook looks it up)", () => {
    const live = parseLiveLinkParams(new URLSearchParams("Status=END&Id=1&Disposition=ANSWER"));
    expect(live.billsec).toBeNull();
    expect(isSummarizableAnswer(live)).toBe(false); // the old rule that dropped it; the route no longer relies on it alone
  });
});
