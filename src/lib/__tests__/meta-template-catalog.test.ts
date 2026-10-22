import { PETRA_TEMPLATE_CATALOG, validateCatalogTemplate, toMetaTemplatePayload } from "@/lib/meta-template-catalog";
import { META_TEMPLATES } from "@/lib/reminder-service";

jest.mock("@/lib/prisma", () => ({ __esModule: true, default: {} }));

describe("Meta template catalog", () => {
  it.each(PETRA_TEMPLATE_CATALOG.map((t) => [t.name, t]))("%s follows Meta's rules", (_n, t) => {
    expect(validateCatalogTemplate(t as never)).toEqual([]);
  });
  it("names are unique", () => {
    const names = PETRA_TEMPLATE_CATALOG.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
  it("every chain template that is not a hand-made legacy one is in the catalog", () => {
    const legacy = new Set([
      "petra_appointment_reminder_v2", "petra_appointment_reminder", "petra_lead_followup_notice", "petra_lead_followup",
      "petra_boarding_checkout_v2", "petra_boarding_checkout", "petra_boarding_stay_summary", "petra_boarding_thank_you_v2",
      "petra_boarding_thank_you", "petra_appointment_confirmation_v2", "petra_appointment_confirmation",
    ]);
    const catalog = new Set(PETRA_TEMPLATE_CATALOG.map((t) => t.name));
    const missing = Object.values(META_TEMPLATES).flat().filter((n) => !legacy.has(n) && !catalog.has(n));
    expect(missing).toEqual([]);
  });
  it("validator catches broken templates", () => {
    const bad = { name: "Bad Name", category: "UTILITY" as const, language: "he" as const, body: "{{1}} שלום {{3}}", examples: ["a"], params: ["a"] };
    expect(validateCatalogTemplate(bad).length).toBeGreaterThanOrEqual(3);
  });
  it("payload has body example + footer", () => {
    const p = toMetaTemplatePayload(PETRA_TEMPLATE_CATALOG[0]);
    expect(p.components[0]).toMatchObject({ type: "BODY", example: { body_text: [PETRA_TEMPLATE_CATALOG[0].examples] } });
    expect(p.components[1]).toMatchObject({ type: "FOOTER" });
  });
});
