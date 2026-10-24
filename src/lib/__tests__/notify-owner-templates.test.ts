/**
 * Owner WhatsApp alerts pick the template whose text matches the alert.
 * petra_owner_alert's approved text is the new-user message, so bot handoffs and
 * support tickets must try their own template first and fall back to it only when
 * Meta rejects theirs (not approved yet).
 */
import {
  notifyOwnerAllDog,
  notifyOwnerSupportActivity,
  notifyOwnerNewUser,
  notifyOwnerSupportOverdue,
  notifyOwnerPaymentReceived,
  notifyOwnerWhatsAppFailure,
} from "@/lib/notify-owner";

type Sent = { type: string; template?: { name: string; components: { parameters: { text: string }[] }[] } };

function mockMeta(reject: string[] = []) {
  const sent: Sent[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("api.resend.com")) return new Response("{}", { status: 200 });
    const body = JSON.parse(String(init?.body)) as Sent;
    sent.push(body);
    if (body.template && reject.includes(body.template.name)) {
      return new Response('{"error":{"code":132001}}', { status: 400 });
    }
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  return sent;
}

const params = (s: Sent) => s.template!.components[0].parameters.map((p) => p.text);

beforeEach(() => {
  process.env.META_WHATSAPP_TOKEN = "t";
  process.env.META_PHONE_NUMBER_ID = "1";
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("owner alert templates", () => {
  it("bot handoff uses petra_alldog_owner_alert with title, who, details and the lead URL", async () => {
    const sent = mockMeta();
    await notifyOwnerAllDog({
      title: "בוט וואטסאפ: העברה דחופה לנציג",
      lines: ["דנה · 054-*-964", "סיבה: ביקשה נציג\nעכשיו"],
      url: "https://petra-app.com/leads?lead=1",
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].template?.name).toBe("petra_alldog_owner_alert");
    expect(params(sent[0])).toEqual([
      "בוט וואטסאפ: העברה דחופה לנציג",
      "דנה · 054-*-964",
      "סיבה: ביקשה נציג עכשיו",
      "https://petra-app.com/leads?lead=1",
    ]);
  });

  it("falls back to the legacy template while the new one is not approved", async () => {
    const sent = mockMeta(["petra_alldog_owner_alert"]);
    await notifyOwnerAllDog({ title: "בוט וואטסאפ: העברה לנציג", lines: ["דנה · 054-*-964"] });
    expect(sent.map((s) => s.template?.name ?? s.type)).toEqual(["petra_alldog_owner_alert", "petra_owner_alert"]);
    // No details line → "-", never an empty param
    expect(params(sent[0])[2]).toBe("-");
  });

  it("support ticket uses petra_support_ticket_alert", async () => {
    const sent = mockMeta();
    await notifyOwnerSupportActivity({
      kind: "new",
      businessName: "נדב מאמן הכלבים",
      userEmail: "nadav@example.com",
      title: "לא מצליח\nלשלוח תזכורת",
      adminUrl: "https://petra-app.com/owner/support?ticket=1",
    });
    expect(sent[0].template?.name).toBe("petra_support_ticket_alert");
    expect(params(sent[0])).toEqual([
      "פנייה חדשה",
      "נדב מאמן הכלבים",
      "nadav@example.com",
      "לא מצליח לשלוח תזכורת",
      "https://petra-app.com/owner/support?ticket=1",
    ]);
  });

  it("new-user registrations keep petra_owner_alert", async () => {
    const sent = mockMeta();
    await notifyOwnerNewUser({ name: "דנה", email: "d@example.com", plan: "free" });
    expect(sent[0].template?.name).toBe("petra_owner_alert");
  });

  it("support SLA digest uses petra_support_overdue_alert with the oldest ticket", async () => {
    const sent = mockMeta();
    const now = Date.now();
    await notifyOwnerSupportOverdue({
      tickets: [
        { title: "חדשה", businessName: "עסק א", waitingSince: new Date(now - 5 * 3_600_000) },
        { title: "ישנה", businessName: "עסק ב", waitingSince: new Date(now - 9 * 3_600_000) },
      ],
      adminUrl: "https://petra-app.com/owner/support",
    });
    expect(sent[0].template?.name).toBe("petra_support_overdue_alert");
    expect(params(sent[0])).toEqual(["2 פניות", "עסק ב · ישנה (9 ש׳)", "https://petra-app.com/owner/support"]);
  });

  it("payment received uses petra_payment_received_alert", async () => {
    const sent = mockMeta();
    await notifyOwnerPaymentReceived({ businessName: "נדב", paidTier: "pro", effectiveTier: "pro", amount: 199, recurringId: "20010", source: "indicator" });
    expect(sent[0].template?.name).toBe("petra_payment_received_alert");
    const [biz, tier, amount, recurring, url] = params(sent[0]);
    expect([biz, tier, amount]).toEqual(["נדב", "Pro ₪199/חודש", "₪199"]);
    expect(recurring).toContain("20010");
    expect(url).toMatch(/\/owner\/tenants$/);
  });

  it("undelivered customer message uses petra_whatsapp_failure_alert", async () => {
    const sent = mockMeta();
    await notifyOwnerWhatsAppFailure({
      businessName: "נדב",
      flowLabel: "תזכורת לתור",
      customer: "דנה · 054-*-964",
      reason: "מחוץ לחלון 24 שעות",
      fix: "לשלוח בתבנית",
      templateName: null,
      adminUrl: "https://petra-app.com/owner/tenants/1",
    });
    expect(sent[0].template?.name).toBe("petra_whatsapp_failure_alert");
    expect(params(sent[0])).toHaveLength(6);
  });

  it("all templates rejected → free text", async () => {
    const sent = mockMeta(["petra_support_ticket_alert", "petra_owner_alert"]);
    await notifyOwnerSupportActivity({ kind: "reply", businessName: "ב", userEmail: "u@e.com", title: "ת", adminUrl: "https://x" });
    expect(sent.map((s) => s.template?.name ?? s.type)).toEqual(["petra_support_ticket_alert", "petra_owner_alert", "text"]);
  });
});
