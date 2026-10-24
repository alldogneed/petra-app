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
  humanOnTheWay,
  CLOSED_NOTE,
  WHO_CALLS_BACK,
  callbackClosingText,
  closingAlreadySent,
  closingText,
  closingWhen,
  handoffClosingText,
  isHumanRequest,
  repIsActive,
  withClosing,
} from "@/lib/alldog-bot/handoff";
import {
  ALLDOG_BOT_PROMPT,
  NAME_AND_DOG_QUESTION,
  OPENING_GREETING,
  OPENING_LINE,
  buildBotContext,
  POLITE_OPENING,
  SAFETY_GREETING,
  enforceOpening,
  isGenericFirstMessage,
  stripTemplatePlaceholders,
} from "@/lib/alldog-bot/prompt";
import { BOT_TOOLS, HANDOFF_MODE_TOOLS, scheduleCallbackInput } from "@/lib/alldog-bot/agent";
import { parseAttributionLine } from "@/lib/alldog-bot/logic";

describe("closing message (Or, 24/10 11:53: phone call, no time, no trainer, no price)", () => {
  const closing =
    "מעולה, רשמתי הכל 🙏 אני דואג שנציגת AllDog תחזור בטלפון בהקדם. אם יש עוד משהו בינתיים, אפשר לכתוב לי פה";
  const il = (ymd: string, hhmm: string) => new Date(`${ymd}T${hhmm}:00+03:00`);
  it("handoff and callback close with the same line, without a time", () => {
    expect(handoffClosingText()).toBe(closing);
    expect(callbackClosingText()).toBe(closing);
    expect(closing).not.toMatch(/היום|מחר|בבוקר|\d{1,2}:\d{2}|₪/);
  });
  it("Shabbat / holiday → 'אחרי השבת' / 'אחרי החג'", () => {
    expect(closingText("after_shabbat")).toContain("תחזור בטלפון אחרי השבת.");
    expect(closingText("after_holiday")).toContain("תחזור בטלפון אחרי החג.");
    expect(closingText("after_shabbat", "f")).toContain("תחזור אלייך טלפונית אחרי השבת.");
    expect(closingWhen(il("2026-10-23", "13:59"))).toBe("soon"); // Friday before 14:00
    expect(closingWhen(il("2026-10-23", "14:00"))).toBe("after_shabbat");
    expect(closingWhen(il("2026-10-24", "11:00"))).toBe("after_shabbat"); // Saturday
    expect(closingWhen(il("2026-10-25", "09:30"))).toBe("soon"); // Sunday
    const tue = il("2026-10-20", "11:00");
    const block = (reason: string | null) => [{ startAt: new Date(tue.getTime() - 3600e3), endAt: new Date(tue.getTime() + 3600e3), reason }];
    expect(closingWhen(tue, block("חג סוכות"))).toBe("after_holiday");
    expect(closingWhen(tue, block("חופשה"))).toBe("soon");
  });
  it("withClosing drops the model's own callback promise / questions, keeps the rest", () => {
    expect(withClosing("זה באמת לא פשוט , שמחים שפניתם\nנציגה תחזור אליכם מחר בבוקר", closing)).toBe(`זה באמת לא פשוט , שמחים שפניתם\n\n${closing}`);
    expect(withClosing("מתי נוח לכם ?", closing)).toBe(closing);
    expect(withClosing(closing, closing)).toBe(closing);
  });
  it("the closing is never repeated: closingAlreadySent + CLOSED_NOTE", () => {
    expect(closingAlreadySent([{ role: "assistant", text: closing }])).toBe(true);
    expect(closingAlreadySent([{ role: "user", text: "קיבלנו הכל" }])).toBe(false);
    expect(CLOSED_NOTE).toContain("בלי לחזור על הודעת הסגירה");
    expect(CLOSED_NOTE).toContain(WHO_CALLS_BACK);
    expect(WHO_CALLS_BACK).toBe("אחת הנציגות מהמשרד שלנו, והיא גם תתאם את המאלף שיגיע 🙂");
  });
});

describe("no scheduling at all (Or, 24/10 11:53)", () => {
  it("schedule_callback takes no date / time (a date is an input error)", () => {
    const tool = BOT_TOOLS.find((t) => t.name === "schedule_callback")!;
    expect(Object.keys((tool.input_schema as { properties: object }).properties)).toEqual(["note"]);
    expect(scheduleCallbackInput.safeParse({}).success).toBe(true);
    expect(scheduleCallbackInput.safeParse({ date: "2026-10-26", time: "10:00" }).success).toBe(false);
  });
  it("the prompt forbids offering times and 'מתי נוח', and has no slot list", () => {
    expect(ALLDOG_BOT_PROMPT).toContain('אסור להציע שעות, ימים או חלונות זמן, ואסור לשאול "מתי נוח"');
    expect(ALLDOG_BOT_PROMPT).not.toContain("מציעים 2–3");
    expect(buildBotContext({ nowLabel: "x", isFirstReply: true })).not.toMatch(/זמנים פנויים/);
  });
  it("fixed order: name + dog → area → the rest", () => {
    expect(NAME_AND_DOG_QUESTION).toBe("נעים מאוד 🙂 איך קוראים לך, ואיך קוראים לכלב?");
    const i1 = ALLDOG_BOT_PROMPT.indexOf("1. השם של הבעלים + שם הכלב");
    const i2 = ALLDOG_BOT_PROMPT.indexOf("2. עיר: ");
    const i3 = ALLDOG_BOT_PROMPT.indexOf("3. כל השאר: גזע וגיל");
    expect(i1).toBeGreaterThan(0);
    expect(i2).toBeGreaterThan(i1);
    expect(i3).toBeGreaterThan(i2);
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
  it("fixed line, by gender", () => {
    expect(HUMAN_ON_THE_WAY).toBe("המאלף כבר בדרך, הוא יחזור בטלפון 🙂");
    expect(humanOnTheWay("f")).toBe("המאלף כבר בדרך אלייך 🙂");
    expect(humanOnTheWay("m")).toBe("המאלף כבר בדרך אליך 🙂");
  });
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
    expect(POLITE_OPENING).toBe("היי! כאן צוות AllDog 🙂 אשמח לשמוע בקצרה על הכלב");
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

// ─── simulator checks (item 22e) ──────────────────────────────────────────────
import { offersTime } from "../../../scripts/alldog-sim/engine";

describe("simulator: time-offer detector", () => {
  it.each(["מתי נוח לכם שנחזור ?", "אפשר ביום שלישי ב-10:00 ?", "מחר בבוקר או אחר הצהריים ?", "באיזו שעה נוח ?"])("flags: %s", (t) =>
    expect(offersTime(t)).toBe(true)
  );
  it.each([
    "מעולה, קיבלנו הכל 🙏 נציגת AllDog תחזור אליכם טלפונית בהקדם, תיתן את כל הפרטים, תתאים לכם את המסלול הנכון ותגיד איזה מאלף יגיע אליכם. אם יש עוד משהו בינתיים, אפשר לכתוב פה",
    "נעים מאוד 🙂 איך קוראים לך (שם מלא), ואיך קוראים לכלב?",
    "רשמתי שנוח לכם רק אחרי 18 , נעביר לנציגה",
  ])("does not flag: %s", (t) => expect(offersTime(t)).toBe(false));
  it("the prompt has the identity rule", () => {
    expect(ALLDOG_BOT_PROMPT).toContain("הודעות זהות רק כשהלקוח שואל");
  });
});
