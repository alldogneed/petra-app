import { explainWhatsAppFailure, isCustomerFacingContext, contextLabel, maskPhone } from "@/lib/whatsapp-failure";

describe("explainWhatsAppFailure", () => {
  it("free text outside the 24h window (Nadav's follow-up)", () => {
    const r = explainWhatsAppFailure(
      { code: 131047, title: "Re-engagement message", message: "Message failed to send because more than 24 hours have passed since the customer last replied to this number." },
      null
    );
    expect(r.reason).toContain("24");
    expect(r.fix).toContain("תבנית");
    expect(r.actionable).toBe(true);
  });
  it("undeliverable number is the recipient's side", () => {
    const r = explainWhatsAppFailure({ code: 131026, title: "Message undeliverable" }, null);
    expect(r.actionable).toBe(false);
  });
  it("frequency cap and template problems", () => {
    expect(explainWhatsAppFailure({ code: 131049 }, "petra_x").fix).toContain("UTILITY");
    expect(explainWhatsAppFailure({ code: 132001, title: "Template name does not exist" }, "petra_x").reason).toContain("petra_x");
  });
  it("unknown errors keep the raw text", () => {
    expect(explainWhatsAppFailure({ code: 999, title: "Weird" }, null).reason).toContain("Weird");
    expect(explainWhatsAppFailure(null, null).reason).toBeTruthy();
  });
});

describe("helpers", () => {
  it("owner/test messages are not customer-facing", () => {
    expect(isCustomerFacingContext("appointment_followup")).toBe(true);
    expect(isCustomerFacingContext("lead_alert")).toBe(false);
    expect(isCustomerFacingContext("security_alert")).toBe(false);
    expect(isCustomerFacingContext(null)).toBe(false);
  });
  it("labels and masking", () => {
    expect(contextLabel("appointment_followup")).toBe("הודעת מעקב אחרי פגישה");
    expect(contextLabel("something_new")).toBe("something_new");
    expect(maskPhone("972533332128")).toBe("053-***-128");
    expect(maskPhone("")).toBe("—");
  });
});
