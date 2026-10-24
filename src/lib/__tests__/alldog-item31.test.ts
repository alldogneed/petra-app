/**
 * Item 31 (Or, 24/10): failure alerts for the bot and the call summaries.
 */
const claimOnce = jest.fn();
const notifyOwnerAllDog = jest.fn();
jest.mock("@/lib/rate-limit", () => ({ claimOnce: (...a: unknown[]) => claimOnce(...a) }));
jest.mock("@/lib/notify-owner", () => ({ notifyOwnerAllDog: (...a: unknown[]) => notifyOwnerAllDog(...a) }));
jest.mock("@/lib/alldog/leads", () => ({ findLeadByPhone: async () => ({ id: "lead-9" }) }));
jest.mock("@/lib/prisma", () => ({ __esModule: true, default: {} }));

import {
  alertAllDogFailure,
  buildFailureAlert,
  explainFailure,
  FAILURE_ALERT_THROTTLE_SECONDS,
  last4,
  scrubSecrets,
} from "@/lib/alldog/failure-alerts";
import { botFallbackText } from "@/lib/alldog-bot/handoff";
import { findTextIssues } from "@/lib/alldog-bot/logic";

describe("short Hebrew reason per failure", () => {
  it.each([
    ['400 {"error":{"message":"Your credit balance is too low to access the Anthropic API."}}', "נגמר הקרדיט ב-Anthropic (Claude)"],
    ['401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}', "מפתח Anthropic לא תקין"],
    ["Could not resolve authentication method. Expected either apiKey or authToken to be set.", "מפתח Anthropic חסר"],
    ['529 {"type":"overloaded_error"}', "השרת של Claude עמוס (overloaded)"],
    ["Request timed out.", "פסק זמן (timeout)"],
    ["ElevenLabs STT failed: HTTP 401 quota_exceeded", "נגמרה המכסה ב-ElevenLabs"],
    ["401 190 Error validating access token: Session has expired", "הטוקן של Meta פג או לא תקין"],
    ["400 131026 Message undeliverable", "המספר לא זמין בוואטסאפ"],
    ["not_configured", "חסרים משתני סביבה (token / phone number id)"],
  ])("%s", (err, reason) => {
    expect(explainFailure(new Error(err))).toBe(reason);
  });
  it("unknown errors are shortened and scrubbed of secrets / phone numbers", () => {
    const out = explainFailure("boom Bearer EAAGabcdefghijklmnopqrstuvwxyz0123456789 for 972542560964");
    expect(out).not.toMatch(/EAAG|972542560964/);
    expect(out).toContain("…0964");
    expect(scrubSecrets("key sk-ant-api03-abcdefghijklmnop")).toBe("key sk-ant-***");
  });
});

describe("alert text", () => {
  it("what failed, reason, last 4 digits, link to the lead", () => {
    const a = buildFailureAlert({ kind: "bot_reply", error: new Error("Request timed out."), phone: "972542560964", leadId: "abc" });
    expect(a.title).toBe("הבוט לא הצליח לענות ללקוח");
    expect(a.lines).toEqual(["לקוח: …0964", "סיבה: פסק זמן (timeout)"]);
    expect(a.url).toMatch(/\/leads\?lead=abc$/);
    expect(JSON.stringify(a)).not.toContain("542560964");
    expect(last4("05")).toBeNull();
    expect(buildFailureAlert({ kind: "webhook", error: "x", test: true }).title).toBe("🧪 בדיקה: ה-webhook של וואטסאפ דחה הודעות או נכשל");
  });
});

describe("throttle: one alert per kind per 30 minutes", () => {
  beforeEach(() => {
    claimOnce.mockReset();
    notifyOwnerAllDog.mockReset();
  });
  it("sends when the claim is free, finds the lead by phone", async () => {
    claimOnce.mockResolvedValue(true);
    process.env.ALLDOG_BUSINESS_ID = "biz";
    expect(await alertAllDogFailure({ kind: "wa_send", error: "190 access token", phone: "0542560964" })).toBe(true);
    delete process.env.ALLDOG_BUSINESS_ID;
    expect(claimOnce).toHaveBeenCalledWith("alldog-failure:wa_send", FAILURE_ALERT_THROTTLE_SECONDS);
    expect(notifyOwnerAllDog).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringMatching(/lead=lead-9$/) }));
  });
  it("throttled → nothing sent", async () => {
    claimOnce.mockResolvedValue(false);
    expect(await alertAllDogFailure({ kind: "wa_send", error: "x" })).toBe(false);
    expect(notifyOwnerAllDog).not.toHaveBeenCalled();
  });
  it("never throws", async () => {
    claimOnce.mockRejectedValue(new Error("db down"));
    await expect(alertAllDogFailure({ kind: "bot_reply", error: "x" })).resolves.toBe(false);
  });
  it("test alerts use their own 1-minute key", async () => {
    claimOnce.mockResolvedValue(true);
    await alertAllDogFailure({ kind: "transcription", error: "x", test: true });
    expect(claimOnce).toHaveBeenCalledWith("alldog-failure-test:transcription", 60);
  });
});

describe("the customer's fallback answer", () => {
  it("Or's text, by gender", () => {
    expect(botFallbackText("m")).toBe("תודה! קיבלנו את ההודעה, נציגה תחזור אליך בהקדם 🙏");
    expect(botFallbackText("f")).toBe("תודה! קיבלנו את ההודעה, נציגה תחזור אלייך בהקדם 🙏");
    expect(botFallbackText()).toBe("תודה! קיבלנו את ההודעה, נציגה תחזור בטלפון בהקדם 🙏");
    expect(findTextIssues(botFallbackText("m"))).toEqual([]);
  });
});
