/**
 * Item 32 (Or, 24/10): automatic WhatsApp after a missed call to 03-3818670.
 */
const msgCreate = jest.fn();
const msgUpdateMany = jest.fn();
const msgUpdate = jest.fn();
const msgFindUnique = jest.fn();
const msgFindFirst = jest.fn();
const convFindUnique = jest.fn();
const convUpsert = jest.fn();
const sendTemplate = jest.fn();
const addLeadCallLog = jest.fn();
const getCalls = jest.fn();
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    waBotMessage: {
      create: (...a: unknown[]) => msgCreate(...a),
      updateMany: (...a: unknown[]) => msgUpdateMany(...a),
      update: (...a: unknown[]) => msgUpdate(...a),
      findUnique: (...a: unknown[]) => msgFindUnique(...a),
      findFirst: (...a: unknown[]) => msgFindFirst(...a),
    },
    waBotConversation: { findUnique: (...a: unknown[]) => convFindUnique(...a), upsert: (...a: unknown[]) => convUpsert(...a) },
  },
}));
jest.mock("@/lib/alldog-bot/wa", () => ({ sendTemplate: (...a: unknown[]) => sendTemplate(...a) }));
jest.mock("@/lib/alldog/leads", () => ({ addLeadCallLog: (...a: unknown[]) => addLeadCallLog(...a) }));
jest.mock("@/lib/paycall", () => ({ getCalls: (...a: unknown[]) => getCalls(...a) }));
jest.mock("@/lib/alldog/failure-alerts", () => ({ alertAllDogFailure: jest.fn() }));

import {
  answeredSince,
  basicSkipReason,
  conversationSkipReason,
  isOfficeLine,
  isQuietTime,
  israeliMobile,
  MISSED_CALL_KINDS,
  MISSED_CALL_SENT_TEXT,
  nextSendTime,
  toWaId,
} from "@/lib/alldog/missed-call-rules";
import { israelInstant, israelParts } from "@/lib/alldog/time";
import { scheduleMissedCallWhatsApp } from "@/lib/alldog/missed-call-wa";

const OLD = process.env;
afterEach(() => {
  process.env = OLD;
});
const on = (extra: Record<string, string> = {}) => {
  process.env = { ...OLD, ALLDOG_MISSED_CALL_WA_ENABLED: "true", ...extra };
};

describe("who gets the message", () => {
  it("Israeli mobiles only; landlines and hidden numbers never", () => {
    expect(israeliMobile("0541234567")).toBe("0541234567");
    expect(israeliMobile("972541234567")).toBe("0541234567");
    expect(israeliMobile("+972-54-123-4567")).toBe("0541234567");
    expect(israeliMobile("033818670")).toBeNull();
    expect(israeliMobile("097654321")).toBeNull();
    expect(israeliMobile("anonymous")).toBeNull();
    expect(israeliMobile("")).toBeNull();
    expect(toWaId("0541234567")).toBe("972541234567");
  });
  it("only calls to 03-3818670 (PayCall PR_NUMBER without the leading 0)", () => {
    expect(isOfficeLine("33818670")).toBe(true);
    expect(isOfficeLine("033818670")).toBe(true);
    expect(isOfficeLine("37654321")).toBe(false);
    expect(isOfficeLine("")).toBe(false);
  });
  it("flag off by default; Or's numbers only in test mode", () => {
    process.env = { ...OLD };
    delete process.env.ALLDOG_MISSED_CALL_WA_ENABLED;
    expect(basicSkipReason({ prNumber: "33818670", callerId: "0541234567" })).toBe("disabled");
    on();
    expect(basicSkipReason({ prNumber: "33818670", callerId: "0541234567" })).toBeNull();
    expect(basicSkipReason({ prNumber: "37654321", callerId: "0541234567" })).toBe("not_office_line");
    expect(basicSkipReason({ prNumber: "33818670", callerId: "035551234" })).toBe("not_mobile");
    expect(basicSkipReason({ prNumber: "33818670", callerId: "0542560964" })).toBe("or_phone");
    expect(basicSkipReason({ prNumber: "33818670", callerId: "0542560963" })).toBe("or_phone");
    on({ ALLDOG_MISSED_CALL_WA_TEST_MODE: "true" });
    expect(basicSkipReason({ prNumber: "33818670", callerId: "0542560964" })).toBeNull();
  });
  it("not with an active / stopped bot conversation, not twice in 7 days", () => {
    const now = new Date("2026-10-25T10:00:00Z");
    const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);
    expect(conversationSkipReason(null, null, now)).toBeNull();
    expect(conversationSkipReason({ status: "active", lastInboundAt: hoursAgo(2) }, null, now)).toBe("active_conversation");
    expect(conversationSkipReason({ status: "active", lastInboundAt: hoursAgo(30) }, null, now)).toBeNull();
    expect(conversationSkipReason({ status: "handoff", lastInboundAt: hoursAgo(30) }, null, now)).toBe("active_conversation");
    expect(conversationSkipReason({ status: "stopped", lastInboundAt: null }, null, now)).toBe("stopped");
    expect(conversationSkipReason({ status: "active", lastInboundAt: null }, hoursAgo(24 * 6), now)).toBe("sent_recently");
    expect(conversationSkipReason({ status: "active", lastInboundAt: null }, hoursAgo(24 * 8), now)).toBeNull();
  });
  it("an answered call from the same phone in the last hour", () => {
    const since = israelInstant("2026-10-25", "10:00");
    const calls = [{ CALLERID: "0541234567", DISPOSITION: "ANSWER", START: "2026-10-25 10:20:00" }];
    expect(answeredSince(calls, "0541234567", since)).toBe(true);
    expect(answeredSince(calls, "0549999999", since)).toBe(false);
    expect(answeredSince([{ ...calls[0], START: "2026-10-25 09:10:00" }], "0541234567", since)).toBe(false);
    expect(answeredSince([{ ...calls[0], DISPOSITION: "NOANSWER" }], "0541234567", since)).toBe(false);
  });
});

describe("when it goes out (Israel time)", () => {
  const at = (ymd: string, hhmm: string) => israelInstant(ymd, hhmm);
  const label = (d: Date) => {
    const p = israelParts(d);
    return `${p.ymd} ${p.hhmm}`;
  };
  // 2026-10-25 = Sunday, 2026-10-30 = Friday, 2026-10-31 = Saturday
  it("quiet hours: 22:00–08:00, Friday 14:00 – Saturday 20:00", () => {
    expect(isQuietTime("2026-10-25", "12:00")).toBe(false);
    expect(isQuietTime("2026-10-25", "22:00")).toBe(true);
    expect(isQuietTime("2026-10-25", "07:59")).toBe(true);
    expect(isQuietTime("2026-10-30", "13:59")).toBe(false);
    expect(isQuietTime("2026-10-30", "14:00")).toBe(true);
    expect(isQuietTime("2026-10-31", "19:59")).toBe(true);
    expect(isQuietTime("2026-10-31", "20:00")).toBe(false);
  });
  it("now, or the start of the next window", () => {
    expect(label(nextSendTime(at("2026-10-25", "12:00")))).toBe("2026-10-25 12:00");
    expect(label(nextSendTime(at("2026-10-25", "23:30")))).toBe("2026-10-26 08:00");
    expect(label(nextSendTime(at("2026-10-26", "03:00")))).toBe("2026-10-26 08:00");
    expect(label(nextSendTime(at("2026-10-30", "15:00")))).toBe("2026-10-31 20:00");
    expect(label(nextSendTime(at("2026-10-31", "10:00")))).toBe("2026-10-31 20:00");
    expect(label(nextSendTime(at("2026-10-31", "22:30")))).toBe("2026-11-01 08:00");
    expect(label(nextSendTime(at("2026-10-29", "23:00")))).toBe("2026-10-30 08:00");
  });
});

describe("send flow", () => {
  const call = { ID: "777", START: "2026-10-25 12:00:00", CALLERID: "0541234567", PR_NUMBER: "33818670" };
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(israelInstant("2026-10-25", "12:01"));
    for (const f of [msgCreate, msgUpdateMany, msgUpdate, msgFindUnique, msgFindFirst, convFindUnique, convUpsert, sendTemplate, addLeadCallLog, getCalls]) f.mockReset();
    on({ ALLDOG_BUSINESS_ID: "biz", PAYCALL_BUSINESS_ID: "biz", ALLDOG_WA_TOKEN: "t", ALLDOG_WA_PHONE_NUMBER_ID: "p" });
    convFindUnique.mockResolvedValue(null);
    convUpsert.mockResolvedValue({ id: "conv1" });
    msgCreate.mockResolvedValue({ id: "row1" });
    msgUpdateMany.mockResolvedValue({ count: 1 });
    msgFindFirst.mockResolvedValue(null);
    getCalls.mockResolvedValue([]);
    addLeadCallLog.mockResolvedValue({ id: "log1" });
    msgUpdate.mockResolvedValue({});
  });
  afterEach(() => jest.useRealTimers());

  it("daytime: template from the bot number, the bot's copy, lead note", async () => {
    msgFindUnique.mockResolvedValue({
      id: "row1",
      text: JSON.stringify({ callId: "777", sendAt: new Date().toISOString(), leadId: "L1", mobile: "0541234567", startedAt: israelInstant("2026-10-25", "12:00").toISOString() }),
      conversation: { id: "conv1", businessId: "biz", phone: "972541234567", status: "active", lastInboundAt: null, leadId: "L1" },
    });
    sendTemplate.mockResolvedValue("wamid.1");
    const r = await scheduleMissedCallWhatsApp(call, { leadId: "L1" });
    expect(r.status).toBe("sent");
    expect(msgCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ role: "system", kind: MISSED_CALL_KINDS.pending, waMessageId: "missed-call:777" }) }));
    expect(sendTemplate).toHaveBeenCalledWith("972541234567", "missed_call_followup", "he");
    expect(msgCreate).toHaveBeenCalledWith({ data: { conversationId: "conv1", role: "assistant", text: MISSED_CALL_SENT_TEXT, waMessageId: "wamid.1" } });
    expect(addLeadCallLog).toHaveBeenCalledWith("L1", expect.stringContaining("נשלחה הודעת וואטסאפ אוטומטית"));
    expect(addLeadCallLog.mock.calls[0][1]).not.toContain("[paycall]"); // the missed-call counter stays right
    expect(addLeadCallLog.mock.calls[0][1]).not.toContain("call_id:");
  });

  it("night: only scheduled, nothing sent", async () => {
    jest.setSystemTime(israelInstant("2026-10-25", "23:10"));
    const r = await scheduleMissedCallWhatsApp({ ...call, START: "2026-10-25 23:09:00" }, { leadId: "L1" });
    expect(r.status).toBe("scheduled");
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  it("answered in another call meanwhile → skipped at send time", async () => {
    msgFindUnique.mockResolvedValue({
      id: "row1",
      text: JSON.stringify({ callId: "777", sendAt: new Date().toISOString(), leadId: "L1", mobile: "0541234567", startedAt: israelInstant("2026-10-25", "12:00").toISOString() }),
      conversation: { id: "conv1", businessId: "biz", phone: "972541234567", status: "active", lastInboundAt: null, leadId: "L1" },
    });
    getCalls.mockResolvedValue([{ CALLERID: "0541234567", DISPOSITION: "ANSWER", START: "2026-10-25 12:00:30" }]);
    const r = await scheduleMissedCallWhatsApp(call, { leadId: "L1" });
    expect(r).toEqual({ status: "skipped", reason: "answered_recently" });
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  it("send failure → marked failed, no retry (the alert is raised by sendTemplate)", async () => {
    msgFindUnique.mockResolvedValue({
      id: "row1",
      text: JSON.stringify({ callId: "777", sendAt: new Date().toISOString(), leadId: "L1", mobile: "0541234567", startedAt: null }),
      conversation: { id: "conv1", businessId: "biz", phone: "972541234567", status: "active", lastInboundAt: null, leadId: "L1" },
    });
    sendTemplate.mockResolvedValue(null);
    const r = await scheduleMissedCallWhatsApp(call, { leadId: "L1" });
    expect(r.status).toBe("failed");
    expect(msgUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: MISSED_CALL_KINDS.failed }) }));
    expect(sendTemplate).toHaveBeenCalledTimes(1);
  });

  it("same call twice (PayCall retry) → one message", async () => {
    const { Prisma } = await import("@prisma/client");
    msgCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }));
    const r = await scheduleMissedCallWhatsApp(call, { leadId: "L1" });
    expect(r).toEqual({ status: "skipped", reason: "already_scheduled" });
  });

  it("flag off → nothing at all", async () => {
    process.env = { ...process.env, ALLDOG_MISSED_CALL_WA_ENABLED: "" };
    const r = await scheduleMissedCallWhatsApp(call, { leadId: "L1" });
    expect(r.status).toBe("skipped");
    expect(convUpsert).not.toHaveBeenCalled();
  });
});
