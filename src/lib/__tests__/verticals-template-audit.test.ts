import { auditTemplatesForGeneric, isCustomerTemplate } from "@/lib/verticals/template-audit";

describe("auditTemplatesForGeneric", () => {
  const texts = new Map([
    ["petra_appointment_reminder_v2", { body: "שלום {{1}}, תזכורת לתור ב-{{2}} 🐾", status: "APPROVED" }],
    ["petra_appointment_confirmation", { body: "שלום {{1}}, התור נקבע. צוות פטרה", status: "APPROVED" }],
    ["petra_lead_followup_notice", { body: "שלום {{1}}, קיבלנו את פנייתך", status: "APPROVED" }],
    ["petra_owner_alert", { body: "נרשם משתמש חדש לפטרה", status: "APPROVED" }],
  ]);
  it("flags customer templates with Petra or dog wording only", () => {
    const rows = auditTemplatesForGeneric(texts, [...texts.keys(), "missing_template"]);
    expect(rows).toEqual([
      { name: "petra_appointment_reminder_v2", status: "APPROVED", mentionsPetra: false, dogWording: true },
      { name: "petra_appointment_confirmation", status: "APPROVED", mentionsPetra: true, dogWording: false },
    ]);
  });
  it("owner alerts are not customer templates", () => {
    expect(isCustomerTemplate("petra_owner_alert")).toBe(false);
    expect(isCustomerTemplate("petra_support_ticket_alert")).toBe(false);
    expect(isCustomerTemplate("petra_appointment_followup")).toBe(true);
  });
});
