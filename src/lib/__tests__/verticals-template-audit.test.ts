import {
  adaptChainForVertical,
  auditTemplatesForGeneric,
  chainNeedsVerticalCheck,
  GENERIC_TEMPLATE_SWAPS,
  isCustomerTemplate,
} from "@/lib/verticals/template-audit";
import { PETRA_TEMPLATE_CATALOG } from "@/lib/meta-template-catalog";
import { DOG_TEXT_RE } from "@/lib/verticals/help";

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
      { name: "petra_appointment_reminder_v2", status: "APPROVED", mentionsPetra: false, dogWording: true, matched: ["🐾"] },
      { name: "petra_appointment_confirmation", status: "APPROVED", mentionsPetra: true, dogWording: false, matched: ["פטרה"] },
    ]);
  });
  it("owner alerts are not customer templates", () => {
    expect(isCustomerTemplate("petra_owner_alert")).toBe(false);
    expect(isCustomerTemplate("petra_support_ticket_alert")).toBe(false);
    expect(isCustomerTemplate("petra_appointment_followup")).toBe(true);
  });
});

describe("adaptChainForVertical", () => {
  const reminder = [
    { name: "petra_appointment_reminder_v2", params: ["דנה", "שני", "10:00", "שיעור", "050"] },
    { name: "petra_appointment_reminder", params: ["דנה", "שני", "10:00", "שיעור"] },
  ];
  it("dogs: chain unchanged", () => {
    expect(adaptChainForVertical(reminder, "dogs")).toEqual(reminder);
  });
  it("generic: v2 → neutral twin with the same params, legacy dropped", () => {
    expect(adaptChainForVertical(reminder, "generic")).toEqual([
      { name: "petra_meeting_reminder", params: ["דנה", "שני", "10:00", "שיעור", "050"] },
    ]);
  });
  it("generic: confirmation + lead follow-up", () => {
    expect(
      adaptChainForVertical(
        [
          { name: "petra_appointment_confirmation_v2", params: ["a", "b", "c", "d", "e"] },
          { name: "petra_appointment_confirmation", params: ["a", "b", "c", "d"] },
        ],
        "generic",
      ).map((s) => s.name),
    ).toEqual(["petra_meeting_confirmation"]);
    expect(
      adaptChainForVertical(
        [
          { name: "petra_lead_followup_notice", params: ["a", "b", "c"] },
          { name: "petra_lead_followup", params: ["a", "b", "c"] },
        ],
        "generic",
      ).map((s) => s.name),
    ).toEqual(["petra_lead_followup_notice"]);
  });
  it("only chains with a dog-worded template need the vertical lookup", () => {
    expect(chainNeedsVerticalCheck(reminder)).toBe(true);
    expect(chainNeedsVerticalCheck([{ name: "petra_contract_to_sign" }])).toBe(false);
  });
  it("every swap target is a neutral catalog template with the same param count as v2", () => {
    for (const target of Object.values(GENERIC_TEMPLATE_SWAPS)) {
      if (!target) continue;
      const t = PETRA_TEMPLATE_CATALOG.find((c) => c.name === target);
      expect(t).toBeDefined();
      expect(DOG_TEXT_RE.test(t!.body)).toBe(false);
      expect(/פטרה|petra/i.test(t!.body)).toBe(false);
      expect(t!.params).toHaveLength(5);
    }
  });
});
