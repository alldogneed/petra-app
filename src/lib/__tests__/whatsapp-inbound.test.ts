/**
 * Customer replies to Petra's automatic WhatsApp messages (3/11/2026: a cancellation sent as a
 * reply to a reminder was never seen). Pure rules: src/lib/whatsapp-inbound-rules.ts.
 */
import {
  autoReplyText,
  chooseAttribution,
  inboundTaskTitle,
  INBOUND_TASK_PREFIX,
  isAckOnly,
  localPhone,
  looksLikeCancellation,
  parseInboundMessages,
  phoneVariants,
  type AttributionCandidate,
} from "@/lib/whatsapp-inbound-rules";

const NOW = new Date("2026-11-03T08:00:00Z");
const FROM = "972501234567";
const PLATFORM = "PLATFORM_PNID";

const log = (o: Partial<AttributionCandidate>): AttributionCandidate => ({
  businessId: "biz-a",
  toPhone: FROM,
  phoneNumberId: null,
  createdAt: new Date("2026-11-02T12:00:00Z"),
  wamid: "wamid.A",
  ...o,
});

describe("parseInboundMessages", () => {
  it("text, swipe-reply context, button, interactive, media label", () => {
    const out = parseInboundMessages([
      { id: "m1", from: FROM, timestamp: "1793692800", type: "text", text: { body: "  אני צריכה לבטל את הפגישה היום  " }, context: { id: "wamid.A" } },
      { id: "m2", from: FROM, type: "button", button: { text: "לא אגיע" } },
      { id: "m3", from: FROM, type: "interactive", interactive: { button_reply: { title: "אישור" } } },
      { id: "m4", from: FROM, type: "image", image: { caption: "מודעת אבל" } },
      { id: "m5", from: FROM, type: "audio" },
    ]);
    expect(out.map((m) => m.text)).toEqual(["אני צריכה לבטל את הפגישה היום", "לא אגיע", "אישור", "(הלקוח שלח תמונה) מודעת אבל", "(הלקוח שלח הודעה קולית)"]);
    expect(out[0].repliedToWamid).toBe("wamid.A");
    expect(out[0].at.getTime()).toBe(1793692800 * 1000);
    expect(out[1].repliedToWamid).toBeNull();
  });
  it("reactions / system / broken rows are skipped", () => {
    expect(
      parseInboundMessages([
        { id: "r", from: FROM, type: "reaction" },
        { id: "s", from: FROM, type: "system" },
        { from: FROM, type: "text", text: { body: "no id" } },
        { id: "x", from: "12", type: "text", text: { body: "short phone" } },
        { id: "e", from: FROM, type: "text", text: { body: "   " } },
      ])
    ).toEqual([]);
    expect(parseInboundMessages(undefined)).toEqual([]);
    expect(parseInboundMessages({})).toEqual([]);
  });
});

describe("phones", () => {
  it("variants match how toPhone / Customer.phone are stored", () => {
    expect(phoneVariants(FROM)).toEqual(["972501234567", "+972501234567", "0501234567"]);
    expect(localPhone(FROM)).toBe("0501234567");
  });
});

describe("looksLikeCancellation → HIGH task", () => {
  it.each([
    "אני צריכה לבטל את הפגישה היום, דוד שלי נפטר",
    "אפשר לדחות לשבוע הבא?",
    "לא אוכל להגיע מחר",
    "לצערי לא נגיע",
    "נצטרך להזיז את התור",
    "אפשר לשנות את המועד?",
    "אני לא יכולה היום",
    "I need to cancel",
  ])("%s", (t) => expect(looksLikeCancellation(t)).toBe(true));
  it.each(["מאשרת, נתראה מחר", "באיזו שעה זה?", "תודה רבה", "הכלב חולה קצת, זה בסדר?"])("not a cancellation: %s", (t) =>
    expect(looksLikeCancellation(t)).toBe(false)
  );
});

describe("isAckOnly → no task, no bell, no reply", () => {
  it.each(["תודה", "תודה רבה 🙏", "אוקיי", "👍", "🙏🙏", "סבבה", "ok", "Thanks"])("%s", (t) => expect(isAckOnly(t)).toBe(true));
  it.each(["תודה, אבל אני צריכה לבטל", "מאשרת", "באיזו שעה?", "לא אגיע"])("needs a person: %s", (t) => expect(isAckOnly(t)).toBe(false));
});

describe("chooseAttribution — never guess, never another business", () => {
  it("the exact message the customer replied to wins", () => {
    const r = chooseAttribution({
      from: FROM,
      platformPhoneNumberId: PLATFORM,
      repliedTo: log({ businessId: "biz-b", wamid: "wamid.B" }),
      recent: [log({ businessId: "biz-a", createdAt: new Date("2026-11-03T07:00:00Z") })],
      now: NOW,
    });
    expect(r).toEqual({ businessId: "biz-b", wamid: "wamid.B", via: "reply" });
  });
  it("a replied-to message sent to ANOTHER phone is ignored (forged context id)", () => {
    const r = chooseAttribution({
      from: FROM,
      platformPhoneNumberId: PLATFORM,
      repliedTo: log({ businessId: "biz-b", toPhone: "972509999999" }),
      recent: [log({ businessId: "biz-a" })],
      now: NOW,
    });
    expect(r?.businessId).toBe("biz-a");
  });
  it("else the most recent platform message to this phone in 30 days", () => {
    const r = chooseAttribution({
      from: FROM,
      platformPhoneNumberId: PLATFORM,
      repliedTo: null,
      recent: [
        log({ businessId: "old", createdAt: new Date("2026-10-30T10:00:00Z"), wamid: "w1" }),
        log({ businessId: "new", createdAt: new Date("2026-11-02T18:00:00Z"), phoneNumberId: PLATFORM, wamid: "w2" }),
      ],
      now: NOW,
    });
    expect(r).toEqual({ businessId: "new", wamid: "w2", via: "recent" });
  });
  it("messages from a business's own number, older than 30 days or without a business → null", () => {
    expect(chooseAttribution({ from: FROM, platformPhoneNumberId: PLATFORM, repliedTo: null, recent: [log({ phoneNumberId: "BIZ_OWN" })], now: NOW })).toBeNull();
    expect(chooseAttribution({ from: FROM, platformPhoneNumberId: PLATFORM, repliedTo: null, recent: [log({ createdAt: new Date("2026-09-01T00:00:00Z") })], now: NOW })).toBeNull();
    expect(chooseAttribution({ from: FROM, platformPhoneNumberId: PLATFORM, repliedTo: null, recent: [log({ businessId: null })], now: NOW })).toBeNull();
    expect(chooseAttribution({ from: FROM, platformPhoneNumberId: PLATFORM, repliedTo: null, recent: [], now: NOW })).toBeNull();
  });
});

describe("texts", () => {
  it("task title carries the prefix, the name and the message, ≤ 140 chars", () => {
    expect(inboundTaskTitle("לבטל היום", "דנה")).toBe(`${INBOUND_TASK_PREFIX} (דנה): לבטל היום`);
    expect(inboundTaskTitle("א".repeat(500), null).length).toBeLessThanOrEqual(140);
  });
  it("acknowledgement: business name + customer contact phone; no phone → no phone line", () => {
    expect(autoReplyText("AllDog", "03-3818670")).toBe("תודה, קיבלנו את ההודעה 🙏 AllDog יחזרו אליך בהקדם. לפניות ישירות: 03-3818670");
    expect(autoReplyText(null, null)).toBe("תודה, קיבלנו את ההודעה 🙏 העסק יחזור אליך בהקדם.");
  });
});
