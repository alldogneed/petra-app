/**
 * AllDog bot — handoff mode rules + the rep's reply / "החזר לבוט" (rep.ts).
 */
let mockConv: Record<string, unknown> | null;
const mockSendText = jest.fn();
const mockConvUpdate = jest.fn();
const mockConvUpdateMany = jest.fn();
const mockMsgCreate = jest.fn();
const mockCallLog = jest.fn();

jest.mock("@/lib/prisma", () => {
  const prisma = {
    lead: { findFirst: jest.fn(async () => ({ id: "lead-1", phone: "050-1234567" })) },
    waBotConversation: {
      findFirst: jest.fn(async () => mockConv),
      update: (...a: unknown[]) => mockConvUpdate(...a),
      updateMany: (...a: unknown[]) => mockConvUpdateMany(...a),
    },
    waBotMessage: { create: (...a: unknown[]) => mockMsgCreate(...a), findMany: jest.fn(async () => []) },
  };
  return { __esModule: true, default: prisma, prisma };
});
jest.mock("@/lib/alldog-bot/wa", () => ({ sendText: (...a: unknown[]) => mockSendText(...a) }));
jest.mock("@/lib/alldog/leads", () => ({ addLeadCallLog: (...a: unknown[]) => mockCallLog(...a) }));
jest.mock("@/lib/alldog/config", () => ({ allDogBusinessId: () => "biz-alldog", isWaBotEnabled: () => true }));

import {
  HANDOFF_ACK_COOLDOWN_MS,
  autoResumeAt,
  handoffAckDue,
  handoffAckText,
  handoffNoteText,
  isResetCommand,
  shouldAutoResume,
} from "@/lib/alldog-bot/handoff";
import { getBotConversationForLead, resumeBot, sendRepMessage } from "@/lib/alldog-bot/rep";
import { ServiceError } from "@/services/types";

// Israel is UTC+3 in this period (IDT until 2026-10-25).
const il = (ymd: string, hhmm: string) => new Date(`${ymd}T${hhmm}:00+03:00`);
const H = 60 * 60 * 1000;

describe("#reset", () => {
  it("only from Or's number, only the exact command", () => {
    expect(isResetCommand("#reset", "972542560964")).toBe(true);
    expect(isResetCommand(" #RESET ", "0542560964")).toBe(true);
    expect(isResetCommand("#reset", "972542560963")).toBe(false);
    expect(isResetCommand("#reset please", "972542560964")).toBe(false);
    expect(isResetCommand("reset", "972542560964")).toBe(false);
  });
});

describe("handoffAckText", () => {
  it("inside office hours → today", () => {
    expect(handoffAckText(il("2026-10-20", "11:00"))).toBe("קיבלנו 🙂 נציגה מהצוות חוזרת אליכם היום"); // Tuesday
  });
  it("evening → tomorrow morning", () => {
    expect(handoffAckText(il("2026-10-20", "19:30"))).toBe("קיבלנו 🙂 נציגה מהצוות חוזרת אליכם מחר בבוקר");
  });
  it("early morning → this morning", () => {
    expect(handoffAckText(il("2026-10-20", "06:30"))).toBe("קיבלנו 🙂 נציגה מהצוות חוזרת אליכם היום בבוקר");
  });
  it("Friday afternoon / Saturday → Sunday morning, not 'tomorrow'", () => {
    expect(handoffAckText(il("2026-10-23", "15:00"))).toBe("קיבלנו 🙂 נציגה מהצוות חוזרת אליכם ביום ראשון בבוקר");
    expect(handoffAckText(il("2026-10-24", "12:00"))).toBe("קיבלנו 🙂 נציגה מהצוות חוזרת אליכם מחר בבוקר");
  });
  it("last half hour of the day counts as after hours", () => {
    expect(handoffAckText(il("2026-10-20", "16:45"))).toContain("מחר בבוקר");
  });
});

describe("handoffAckDue — once, then at most every 6 hours", () => {
  const handoffAt = new Date("2026-10-20T08:00:00Z");
  it("first message after the handoff", () => {
    expect(handoffAckDue({ handoffAt, handoffAckAt: null })).toBe(true);
  });
  it("not again within 6 hours, again after", () => {
    const ackAt = new Date("2026-10-20T09:00:00Z");
    expect(handoffAckDue({ handoffAt, handoffAckAt: ackAt }, new Date(ackAt.getTime() + HANDOFF_ACK_COOLDOWN_MS - 1))).toBe(false);
    expect(handoffAckDue({ handoffAt, handoffAckAt: ackAt }, new Date(ackAt.getTime() + HANDOFF_ACK_COOLDOWN_MS))).toBe(true);
  });
  it("an ack from an earlier handoff does not count", () => {
    expect(handoffAckDue({ handoffAt, handoffAckAt: new Date("2026-10-19T08:00:00Z") }, new Date("2026-10-20T08:05:00Z"))).toBe(true);
  });
});

describe("auto-resume after 24h without a person", () => {
  const handoffAt = new Date("2026-10-20T08:00:00Z");
  it("counts from the handoff", () => {
    const c = { status: "handoff", handoffAt, lastHumanAt: null };
    expect(shouldAutoResume(c, new Date(handoffAt.getTime() + 23 * H))).toBe(false);
    expect(shouldAutoResume(c, new Date(handoffAt.getTime() + 24 * H))).toBe(true);
  });
  it("a rep reply restarts the 24h", () => {
    const lastHumanAt = new Date(handoffAt.getTime() + 20 * H);
    const c = { status: "handoff", handoffAt, lastHumanAt };
    expect(shouldAutoResume(c, new Date(handoffAt.getTime() + 30 * H))).toBe(false);
    expect(autoResumeAt(c)?.toISOString()).toBe(new Date(lastHumanAt.getTime() + 24 * H).toISOString());
  });
  it("only for handoff conversations", () => {
    expect(shouldAutoResume({ status: "active", handoffAt, lastHumanAt: null })).toBe(false);
    expect(shouldAutoResume({ status: "stopped", handoffAt, lastHumanAt: null })).toBe(false);
  });
});

it("handoffNoteText carries every message", () => {
  const t = handoffNoteText(["שלום?", "מישהו\nיחזור אליי?"]);
  expect(t).toContain("• שלום?");
  expect(t).toContain("• מישהו יחזור אליי?");
});

describe("rep.ts", () => {
  const recent = () => new Date(Date.now() - H);
  beforeEach(() => {
    jest.clearAllMocks();
    mockConv = { id: "c1", businessId: "biz-alldog", phone: "972501234567", status: "handoff", leadId: "lead-1", lastInboundAt: recent(), handoffAt: recent(), lastHumanAt: null };
    mockSendText.mockResolvedValue("wamid.1");
    mockCallLog.mockResolvedValue({});
  });

  it("other businesses never see a conversation", async () => {
    expect(await getBotConversationForLead("other-biz", "lead-1")).toBeNull();
    await expect(sendRepMessage("other-biz", "lead-1", "היי")).rejects.toBeInstanceOf(ServiceError);
  });

  it("sends through the bot number, stores role human, restarts the 24h", async () => {
    await sendRepMessage("biz-alldog", "lead-1", "  היי , זו נועה מ-AllDog  ");
    expect(mockSendText).toHaveBeenCalledWith("972501234567", "היי , זו נועה מ-AllDog");
    expect(mockMsgCreate.mock.calls[0][0].data).toMatchObject({ role: "human", conversationId: "c1" });
    expect(mockConvUpdate.mock.calls[0][0].data.lastHumanAt).toBeInstanceOf(Date);
    expect(mockConvUpdate.mock.calls[0][0].data.status).toBeUndefined(); // already handoff
  });

  it("a rep reply on an active chat moves it to handoff (the bot stops)", async () => {
    mockConv!.status = "active";
    await sendRepMessage("biz-alldog", "lead-1", "היי");
    expect(mockConvUpdate.mock.calls[0][0].data).toMatchObject({ status: "handoff" });
  });

  it("refuses outside the 24h window and for stopped chats", async () => {
    mockConv!.lastInboundAt = new Date(Date.now() - 25 * H);
    await expect(sendRepMessage("biz-alldog", "lead-1", "היי")).rejects.toThrow("24 שעות");
    mockConv!.lastInboundAt = recent();
    mockConv!.status = "stopped";
    await expect(sendRepMessage("biz-alldog", "lead-1", "היי")).rejects.toThrow("להפסיק");
    expect(mockSendText).not.toHaveBeenCalled();
  });

  it("send failure → EXTERNAL, nothing stored", async () => {
    mockSendText.mockResolvedValue(null);
    await expect(sendRepMessage("biz-alldog", "lead-1", "היי")).rejects.toMatchObject({ code: "EXTERNAL" });
    expect(mockMsgCreate).not.toHaveBeenCalled();
  });

  it("החזר לבוט: handoff → active, only from handoff", async () => {
    await resumeBot("biz-alldog", "lead-1");
    expect(mockConvUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "c1", businessId: "biz-alldog", status: "handoff" },
      data: { status: "active" },
    });
    mockConv!.status = "active";
    await expect(resumeBot("biz-alldog", "lead-1")).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
