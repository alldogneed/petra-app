/**
 * Appointment confirmation goes out as an approved template first — a
 * business's custom free text is only the last fallback (Meta 131047 outside
 * the 24h window: נדב מאמן הכלבים, 2026-09-17 / 09-23).
 */

jest.mock("@/lib/prisma", () => ({ prisma: {}, default: {} }));

import { appointmentConfirmationChain, defaultConfirmationText, META_TEMPLATES } from "@/lib/reminder-service";

const base = { customerName: "דנה", date: "יום שני, 28 בספטמבר", time: "10:00", serviceName: "אילוף" };

describe("appointmentConfirmationChain", () => {
  it("v2 (with business phone) first, legacy 4-param second", () => {
    const steps = appointmentConfirmationChain({ ...base, businessPhone: "0501234567" });
    expect(steps.map((s) => s.name)).toEqual([...META_TEMPLATES.appointmentConfirmation]);
    expect(steps[0].params).toEqual(["דנה", base.date, "10:00", "אילוף", "0501234567"]);
    expect(steps[1].params).toEqual(["דנה", base.date, "10:00", "אילוף"]);
  });

  it("no business phone → v2 dropped (Meta rejects empty params)", () => {
    const steps = appointmentConfirmationChain({ ...base, businessPhone: "" });
    expect(steps.map((s) => s.name)).toEqual(["petra_appointment_confirmation"]);
  });

  it("default free-text fallback carries the booking details", () => {
    const text = defaultConfirmationText(base);
    expect(text).toContain("דנה");
    expect(text).toContain("10:00");
    expect(text).toContain("אילוף");
  });
});
