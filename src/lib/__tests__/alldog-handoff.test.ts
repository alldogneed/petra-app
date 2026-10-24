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
  handoffNoteText,
  isResetCommand,
  shouldAutoResume,
} from "@/lib/alldog-bot/handoff";
import { getBotConversationForLead, resumeBot, sendRepMessage } from "@/lib/alldog-bot/rep";
import { ServiceError } from "@/services/types";


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

// ─── Or's fixes from the 24/10 test (item 15) ─────────────────────────────────
import {
  HUMAN_ON_THE_WAY,
  callbackClosingText,
  closingText,
  handoffClosingText,
  isHumanRequest,
  repIsActive,
  withClosing,
} from "@/lib/alldog-bot/handoff";
import {
  OPENING_GREETING,
  OPENING_LINE,
  POLITE_OPENING,
  SAFETY_GREETING,
  enforceOpening,
  isGenericFirstMessage,
  stripTemplatePlaceholders,
} from "@/lib/alldog-bot/prompt";
import { HANDOFF_MODE_TOOLS } from "@/lib/alldog-bot/agent";
import { parseAttributionLine } from "@/lib/alldog-bot/logic";

describe("closing message (Or, 24/10: the site's approved line, no callback time)", () => {
  const approved = "קיבלנו הכל 🙏 נציגת AllDog תחזור אליכם בהקדם. אם יש עוד משהו בינתיים, אפשר לכתוב פה";
  it("handoff and callback close with the same line, without היום / מחר / an hour", () => {
    expect(handoffClosingText()).toBe(approved);
    expect(callbackClosingText()).toBe(approved);
    expect(approved).not.toMatch(/היום|מחר|בבוקר|\d{1,2}:\d{2}/);
  });
  it("with a trainer name for the area", () => {
    expect(closingText("שחר")).toBe("קיבלנו הכל 🙏 שחר מהצוות יחזור אליכם בהקדם. אם יש עוד משהו בינתיים, אפשר לכתוב פה");
    expect(closingText("  ")).toBe(approved);
  });
  it("withClosing drops the model's own callback promise / questions, keeps the rest", () => {
    const closing = handoffClosingText();
    expect(withClosing("זה באמת לא פשוט , שמחים שפניתם\nנציגה תחזור אליכם מחר בבוקר", closing)).toBe(`זה באמת לא פשוט , שמחים שפניתם\n\n${closing}`);
    expect(withClosing("מתי נוח לכם ?", closing)).toBe(closing);
    expect(withClosing(closing, closing)).toBe(closing);
  });
});

describe("after handoff the bot keeps helping (d)", () => {
  it("only lookup_guide + save_lead", () => {
    expect(HANDOFF_MODE_TOOLS.map((t) => t.name).sort()).toEqual(["lookup_guide", "save_lead"]);
  });
  it.each(["אפשר לדבר עם בן אדם ?", "תעבירו אותי לנציגה", "נציג", "אני רוצה לדבר עם המאלף", "תחברי אותי למישהו מהצוות"])(
    "explicit person request: %s",
    (t) => expect(isHumanRequest(t)).toBe(true)
  );
  it.each(["אתה בן אדם ?", "למה עכשיו אתה לא עונה ?", "כמה עולה אבחון ?", "היי"])("not a person request: %s", (t) =>
    expect(isHumanRequest(t)).toBe(false)
  );
  it("fixed line", () => expect(HUMAN_ON_THE_WAY).toBe("המאלף כבר בדרך אליכם 🙂"));
  it("a rep who replied in the last 2 hours keeps the bot quiet", () => {
    const now = new Date("2026-10-20T12:00:00Z");
    expect(repIsActive(new Date("2026-10-20T11:00:00Z"), now)).toBe(true);
    expect(repIsActive(new Date("2026-10-20T09:30:00Z"), now)).toBe(false);
    expect(repIsActive(null, now)).toBe(false);
  });
});

describe("first message from the website (e)", () => {
  const site = "היי AllDog, אשמח לעזרה עם הכלב שלי 🐶";
  it("polite generic request → POLITE_OPENING, not the 'מה קורה' line", () => {
    expect(isGenericFirstMessage(site)).toBe(true);
    expect(enforceOpening(true, site, "היי , כאן AllDog 🙂 איך קוראים לכלב ?")).toBe(POLITE_OPENING);
    expect(POLITE_OPENING).toBe("היי! כאן צוות AllDog 🙂 ספרו לנו בקצרה על הכלב שלכם");
  });
  it("the old template sent without filling it is generic too", () => {
    const tpl = "היי, יש לי [גזע/גיל] מ[עיר], והבעיה היא: ___ . אשמח לשיחה.";
    expect(stripTemplatePlaceholders(tpl)).not.toMatch(/\[|_/);
    expect(isGenericFirstMessage(tpl)).toBe(true);
  });
  it("a message with real details is not generic", () => {
    expect(isGenericFirstMessage("היי, יש לי לברדור בן שנה מרעננה והוא מושך ברצועה")).toBe(false);
    expect(enforceOpening(true, "הכלב שלי נובח על עוברים", "בן כמה הוא ?")).toBe(`${OPENING_GREETING}\n\nבן כמה הוא ?`);
  });
  it("bare greeting still gets Or's line", () => expect(enforceOpening(true, "שלום ?", "x")).toBe(OPENING_LINE));
  it("a bite in the first message: no 'מה קורה?'", () => {
    const out = enforceOpening(true, "הכלב נשך את הילד שלי", "אוי , זה רציני");
    expect(out).toBe(`${SAFETY_GREETING}\n\nאוי , זה רציני`);
    expect(out).not.toContain("מה קורה");
  });
});

describe("the website's prepared messages (alldog-landing-page PR #4, NEXT_PUBLIC_WA_BOT_ENABLED=1)", () => {
  const src = " (הגעתי דרך: חיפוש אורגני · עמוד הבית)";
  it("the source line is parsed out (saved on the lead), the bot never sees it", () => {
    const p = parseAttributionLine(`היי AllDog, אשמח לעזרה עם הכלב שלי 🐶${src}`);
    expect(p).toEqual({ source: "חיפוש אורגני", page: "עמוד הבית", text: "היי AllDog, אשמח לעזרה עם הכלב שלי 🐶" });
  });
  it("default text → POLITE_OPENING", () => {
    const t = parseAttributionLine(`היי AllDog, אשמח לעזרה עם הכלב שלי 🐶${src}`).text;
    expect(enforceOpening(true, t, "בן כמה הכלב ?")).toBe(POLITE_OPENING);
  });
  it.each([
    "היי AllDog, אשמח לעזרה עם תוקפנות של הכלב שלי",
    "היי AllDog, אשמח לעזרה עם חרדת נטישה של הכלב שלי",
    "היי AllDog, יש לי גור ואשמח להתחיל אילוף נכון",
    "היי AllDog, אשמח לשמוע על המסלולים והמחירים",
    "היי AllDog, קראתי את המדריך על משיכה ברצועה ואשמח לעזרה עם הכלב שלי",
    "היי AllDog, יש לי רועה גרמני ואשמח לעזרה",
    "היי AllDog, אני מרעננה ואשמח לעזרה עם הכלב שלי",
  ])("page-specific text carries information → greeting + the model's reaction: %s", (t) => {
    expect(isGenericFirstMessage(t)).toBe(false);
    expect(enforceOpening(true, t, "ספרו לי עוד ?")).toBe(`${OPENING_GREETING}\n\nספרו לי עוד ?`);
  });
});
