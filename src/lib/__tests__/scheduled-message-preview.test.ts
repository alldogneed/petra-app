import { renderTemplateText, messageLabel, firstStep, confirmationLogPayload } from "@/lib/scheduled-message-preview";

const steps = [
  { name: "petra_appointment_confirmation_v2", params: ["דנה", "יום שני", "10:00", "אילוף", "03-1234567"] },
  { name: "petra_appointment_confirmation", params: ["דנה", "יום שני", "10:00", "אילוף"] },
];

describe("scheduled-message-preview", () => {
  it("fills positional params and leaves unknown ones", () => {
    expect(renderTemplateText("שלום {{1}}, תור ב{{2}} {{ 3 }} {{9}}", ["דנה", "שני", "10:00"])).toBe("שלום דנה, תור בשני 10:00 {{9}}");
  });

  it("labels the confirmation log row in Hebrew, unknown keys fall through", () => {
    expect(messageLabel("appointment_confirmation_log")).toBe("אישור תור");
    expect(messageLabel("whatever", "lead_followup")).toBe("מעקב ליד");
    expect(messageLabel("my_custom")).toBe("my_custom");
  });

  it("picks the first step whose text is known", () => {
    const texts = new Map([["petra_appointment_confirmation", { body: "היי {{1}} — {{4}}", footer: "Petra" }]]);
    const hit = firstStep(steps, texts);
    expect(hit?.step.name).toBe("petra_appointment_confirmation");
    expect(hit?.body).toBe("היי דנה — אילוף");
    expect(firstStep(steps, new Map())).toBeNull();
  });

  it("logs only the template that went out", () => {
    const p = JSON.parse(confirmationLogPayload(steps, "גיבוי", { success: true, via: "template", templateName: "petra_appointment_confirmation" }));
    expect(p.flow).toBe("appointment_confirmation");
    expect(p.templateChain).toEqual([steps[1]]);
    expect(p.body).toBeUndefined();
  });

  it("logs the free text when it went out as text, and the intent on failure", () => {
    const text = JSON.parse(confirmationLogPayload(steps, "גיבוי", { success: true, via: "text" }));
    expect(text).toEqual({ flow: "appointment_confirmation", body: "גיבוי" });
    const failed = JSON.parse(confirmationLogPayload(steps, "גיבוי", { success: false, error: "boom" }));
    expect(failed.templateChain).toHaveLength(2);
    expect(failed.error).toBeUndefined();
    expect(JSON.parse(confirmationLogPayload(steps, "גיבוי", null)).body).toBe("גיבוי");
  });
});
