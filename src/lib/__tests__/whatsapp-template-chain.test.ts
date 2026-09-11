/**
 * Tests for the ordered WhatsApp template chain.
 *
 * `@/lib/whatsapp` is mocked so nothing touches Meta/Twilio/DB; we assert on the
 * order of attempts, the fallback behaviour and the businessId/context plumbing.
 */

jest.mock("@/lib/whatsapp", () => ({
  sendWhatsAppTemplate: jest.fn(),
  sendWhatsAppMessage: jest.fn(),
}));

import { sendWhatsAppTemplate, sendWhatsAppMessage } from "@/lib/whatsapp";
import {
  sendWithTemplateChain,
  chainFromPayload,
  buildTemplateChain,
  contextForScheduledMessage,
} from "@/lib/whatsapp-template-chain";

const mockTemplate = sendWhatsAppTemplate as jest.MockedFunction<typeof sendWhatsAppTemplate>;
const mockText = sendWhatsAppMessage as jest.MockedFunction<typeof sendWhatsAppMessage>;

const BASE = {
  to: "972501234567",
  fallbackBody: "שלום, תזכורת",
  businessId: "biz-1",
  context: "lead_followup",
};

const STEPS = [
  { name: "petra_lead_followup_notice", params: ["דנה", "אילוף", "03-1234567"] },
  { name: "petra_lead_followup", params: ["דנה", "אילוף", "03-1234567"] },
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("sendWithTemplateChain", () => {
  it("stops at the first template Meta accepts", async () => {
    mockTemplate.mockResolvedValueOnce({ success: true, messageSid: "wamid.1" });

    const res = await sendWithTemplateChain({ ...BASE, steps: STEPS });

    expect(res).toMatchObject({ success: true, via: "template", templateName: "petra_lead_followup_notice", messageSid: "wamid.1" });
    expect(res.failedTemplates).toEqual([]);
    expect(mockTemplate).toHaveBeenCalledTimes(1);
    expect(mockText).not.toHaveBeenCalled();
  });

  it("falls through to the legacy template when the UTILITY one is rejected, recording the failure", async () => {
    mockTemplate
      .mockResolvedValueOnce({ success: false, error: "(#132001) Template name does not exist" })
      .mockResolvedValueOnce({ success: true, messageSid: "wamid.2" });

    const res = await sendWithTemplateChain({ ...BASE, steps: STEPS });

    expect(res.success).toBe(true);
    expect(res.via).toBe("template");
    expect(res.templateName).toBe("petra_lead_followup");
    expect(res.failedTemplates).toEqual([
      { name: "petra_lead_followup_notice", error: "(#132001) Template name does not exist" },
    ]);
    expect(mockTemplate).toHaveBeenCalledTimes(2);
    expect(mockTemplate.mock.calls[0][0].templateName).toBe("petra_lead_followup_notice");
    expect(mockTemplate.mock.calls[1][0].templateName).toBe("petra_lead_followup");
    expect(mockText).not.toHaveBeenCalled();
  });

  it("sends free text only after every template failed", async () => {
    mockTemplate
      .mockResolvedValueOnce({ success: false, error: "rejected 1" })
      .mockResolvedValueOnce({ success: false, error: "rejected 2" });
    mockText.mockResolvedValueOnce({ success: true, messageSid: "wamid.text" });

    const res = await sendWithTemplateChain({ ...BASE, steps: STEPS });

    expect(res).toMatchObject({ success: true, via: "text", messageSid: "wamid.text" });
    expect(res.templateName).toBeUndefined();
    expect(res.failedTemplates.map((f) => f.name)).toEqual(["petra_lead_followup_notice", "petra_lead_followup"]);
    expect(mockTemplate).toHaveBeenCalledTimes(2);
    expect(mockText).toHaveBeenCalledTimes(1);
    expect(mockText.mock.calls[0][0].body).toBe(BASE.fallbackBody);
  });

  it("passes businessId + context on every template attempt and on the free-text fallback", async () => {
    mockTemplate
      .mockResolvedValueOnce({ success: false, error: "x" })
      .mockResolvedValueOnce({ success: false, error: "y" });
    mockText.mockResolvedValueOnce({ success: true, messageSid: "wamid.t" });

    await sendWithTemplateChain({ ...BASE, steps: STEPS });

    for (const call of mockTemplate.mock.calls) {
      expect(call[0]).toMatchObject({ to: BASE.to, businessId: "biz-1", context: "lead_followup" });
    }
    expect(mockText.mock.calls[0][0]).toMatchObject({ to: BASE.to, businessId: "biz-1", context: "lead_followup" });
  });

  it("forwards each step's params as bodyParams", async () => {
    mockTemplate.mockResolvedValueOnce({ success: true, messageSid: "wamid.p" });

    await sendWithTemplateChain({ ...BASE, steps: STEPS });

    expect(mockTemplate.mock.calls[0][0].bodyParams).toEqual(["דנה", "אילוף", "03-1234567"]);
  });

  it("a step that throws does not abort the chain", async () => {
    mockTemplate
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ success: true, messageSid: "wamid.3" });

    const res = await sendWithTemplateChain({ ...BASE, steps: STEPS });

    expect(res.success).toBe(true);
    expect(res.templateName).toBe("petra_lead_followup");
    expect(res.failedTemplates).toEqual([{ name: "petra_lead_followup_notice", error: "network down" }]);
  });

  it("with no template steps goes straight to free text", async () => {
    mockText.mockResolvedValueOnce({ success: true, messageSid: "wamid.only" });

    const res = await sendWithTemplateChain({ ...BASE, steps: [] });

    expect(res).toMatchObject({ success: true, via: "text" });
    expect(mockTemplate).not.toHaveBeenCalled();
    expect(mockText).toHaveBeenCalledTimes(1);
  });

  it("reports failure (never throws) when templates and free text all fail", async () => {
    mockTemplate.mockResolvedValue({ success: false, error: "nope" });
    mockText.mockResolvedValueOnce({ success: false, error: "outside 24h window" });

    const res = await sendWithTemplateChain({ ...BASE, steps: STEPS });

    expect(res.success).toBe(false);
    expect(res.via).toBeUndefined();
    expect(res.error).toBe("outside 24h window");
    expect(res.failedTemplates).toHaveLength(2);
  });
});

describe("chainFromPayload", () => {
  it("reads the new templateChain shape in order", () => {
    const steps = chainFromPayload({
      body: "x",
      flow: "boarding_thank_you",
      templateChain: [
        { name: "petra_boarding_stay_summary", params: ["רון", "בלו", "050"] },
        { name: "petra_boarding_thank_you", params: ["רון", "בלו"] },
      ],
    });
    expect(steps).toEqual([
      { name: "petra_boarding_stay_summary", params: ["רון", "בלו", "050"] },
      { name: "petra_boarding_thank_you", params: ["רון", "בלו"] },
    ]);
  });

  it("still reads the legacy metaTemplateName / metaTemplateParams payload (rows already queued)", () => {
    const steps = chainFromPayload({
      body: "x",
      metaTemplateName: "petra_appointment_reminder_v2",
      metaTemplateParams: ["דנה", "יום שני", "10:00", "אילוף", "03-1234567"],
    });
    expect(steps).toEqual([
      { name: "petra_appointment_reminder_v2", params: ["דנה", "יום שני", "10:00", "אילוף", "03-1234567"] },
    ]);
  });

  it("returns an empty chain for text-only / malformed payloads", () => {
    expect(chainFromPayload({ body: "x" })).toEqual([]);
    expect(chainFromPayload(null)).toEqual([]);
    expect(chainFromPayload({ templateChain: [{ params: ["a"] }, null, "junk"] })).toEqual([]);
    expect(chainFromPayload({ metaTemplateName: "" })).toEqual([]);
  });
});

describe("buildTemplateChain", () => {
  it("drops a step that has an empty parameter (Meta rejects empty params) and keeps the rest in order", () => {
    const steps = buildTemplateChain([
      { name: "petra_appointment_reminder_v2", params: ["דנה", "יום שני", "10:00", "אילוף", ""] },
      { name: "petra_appointment_reminder", params: ["דנה", "יום שני", "10:00", "אילוף"] },
    ]);
    expect(steps).toEqual([
      { name: "petra_appointment_reminder", params: ["דנה", "יום שני", "10:00", "אילוף"] },
    ]);
  });

  it("treats whitespace-only and null params as empty", () => {
    expect(buildTemplateChain([{ name: "t", params: ["a", "  "] }])).toEqual([]);
    expect(buildTemplateChain([{ name: "t", params: ["a", null] }])).toEqual([]);
    expect(buildTemplateChain([{ name: "t", params: [" a ", "b"] }])).toEqual([{ name: "t", params: ["a", "b"] }]);
  });
});

describe("contextForScheduledMessage", () => {
  it("prefers the explicit flow from new payloads", () => {
    expect(contextForScheduledMessage({ flow: "lead_followup" }, "APPOINTMENT")).toBe("lead_followup");
  });

  it("maps legacy rows by relatedEntityType", () => {
    expect(contextForScheduledMessage({}, "APPOINTMENT")).toBe("appointment_reminder");
    expect(contextForScheduledMessage({}, "LEAD_FOLLOWUP")).toBe("lead_followup");
    expect(contextForScheduledMessage({}, "BOARDING")).toBe("boarding_checkout");
    expect(contextForScheduledMessage({}, "BOARDING_THANKYOU")).toBe("boarding_thank_you");
    expect(contextForScheduledMessage({}, "TRAINING_SESSION")).toBe("training_session_reminder");
    expect(contextForScheduledMessage(null, null)).toBe("scheduled_message");
  });

  it("ignores a flow value that is not a plain identifier", () => {
    expect(contextForScheduledMessage({ flow: "drop table; --" }, "BOARDING")).toBe("boarding_checkout");
  });
});
