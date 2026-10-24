/**
 * Meta WhatsApp templates that Petra creates on the PLATFORM WABA by itself.
 *
 * `GET /api/cron/sync-platform-templates` (daily + on demand) creates every entry here
 * that the WABA does not have yet and reports the review status of each. So adding a
 * template = an entry here + a `*Chain()` builder in reminder-service.ts — no manual work
 * in WhatsApp Manager. Older templates (petra_appointment_reminder, …) were created by
 * hand and are not listed; never rename an entry once submitted (Meta keys on the name).
 *
 * Meta rules checked by meta-template-catalog.test.ts: lowercase name, {{1}}..{{n}} in
 * order, body neither starts nor ends with a variable, one example per variable.
 */

export type MetaTemplateCategory = "UTILITY" | "MARKETING";

export interface CatalogTemplate {
  name: string;
  category: MetaTemplateCategory;
  language: "he";
  /** Body with {{1}}..{{n}} */
  body: string;
  /** One example value per variable, in order */
  examples: string[];
  footer?: string;
  /** What fills each variable — documentation for the chain builder */
  params: string[];
}

const FOOTER = "הודעה אוטומטית";

export const PETRA_TEMPLATE_CATALOG: readonly CatalogTemplate[] = [
  {
    name: "petra_appointment_followup",
    category: "UTILITY",
    language: "he",
    body: "שלום {{1}}, רצינו לשמוע איך {{2}} מרגיש/ה אחרי הפגישה האחרונה. אם יש שאלה או משהו שלא כשורה, נשמח לעזור בטלפון {{3}}. תודה!",
    examples: ["דנה", "רקסי", "050-1234567"],
    footer: FOOTER,
    params: ["customer name", "pet name or 'הכלב שלכם'", "business phone"],
  },
  {
    name: "petra_booking_request_received",
    category: "UTILITY",
    language: "he",
    body: "שלום {{1}}, בקשתך לתור ל{{2}} בתאריך {{3}} בשעה {{4}} התקבלה וממתינה לאישור של {{5}}. נעדכן אותך ברגע שהתור יאושר.",
    examples: ["דנה", "אילוף בבית", "24.10.2026", "17:30", "נדב מאמן הכלבים"],
    footer: FOOTER,
    params: ["customer name", "service", "date", "time", "business name"],
  },
  {
    name: "petra_booking_declined",
    category: "UTILITY",
    language: "he",
    body: "שלום {{1}}, לצערנו לא ניתן לאשר את הבקשה לתור בתאריך {{2}} בשעה {{3}}. {{4}} ישמחו לתאם איתך מועד אחר.",
    examples: ["דנה", "24.10.2026", "17:30", "נדב מאמן הכלבים"],
    footer: FOOTER,
    params: ["customer name", "date", "time", "business name"],
  },
  {
    name: "petra_contract_to_sign",
    category: "UTILITY",
    language: "he",
    body: "שלום {{1}}, {{2}} שלחו לך חוזה לחתימה דיגיטלית. לצפייה ולחתימה: {{3}} . הקישור תקף ל-30 יום.",
    examples: ["דנה", "נדב מאמן הכלבים", "https://petra-app.com/sign/abc123"],
    footer: FOOTER,
    params: ["customer name", "business name", "sign URL"],
  },
  {
    name: "petra_vaccination_reminder",
    category: "UTILITY",
    language: "he",
    body: "שלום {{1}}, תזכורת: {{2}} של {{3}} בתוקף עד {{4}}. מומלץ לתאם חידוש בהקדם.",
    examples: ["דנה", "חיסון כלבת", "רקסי", "5 בנובמבר 2026"],
    footer: FOOTER,
    params: ["customer name", "vaccine label", "pet name", "expiry date"],
  },
  {
    name: "petra_pet_birthday",
    category: "MARKETING",
    language: "he",
    body: "יום הולדת שמח ל{{1}}! 🎂 היום {{2}}. מאחלים בריאות, שמחה והרבה עצמות, באהבה {{3}} 🐾",
    examples: ["רקסי", "מלאות לו 3 שנים", "נדב מאמן הכלבים"],
    footer: FOOTER,
    params: ["pet name", "age sentence", "business name"],
  },
  // ── Alerts to the platform owner (Or), sent by notify-owner.ts ─────────────
  // Before these, every owner alert reused petra_owner_alert, whose fixed text is the
  // NEW-USER message ("נרשם משתמש חדש לפטרה") — bot handoffs and support tickets showed
  // up as fake registrations. petra_owner_alert stays as the fallback until these are approved.
  {
    name: "petra_alldog_owner_alert",
    category: "UTILITY",
    language: "he",
    body: "התראה מ-AllDog: {{1}}\n\nפרטים: {{2}}\nהודעה: {{3}}\n\nלפתיחה בפטרה: {{4}}\nנשלח אוטומטית ממערכת פטרה",
    examples: ["בוט וואטסאפ: העברה דחופה לנציג", "דנה כהן · 054-*-964", "סיבה: הלקוחה ביקשה לדבר עם נציג", "https://petra-app.com/leads?lead=abc123"],
    params: ["alert title", "who (name · masked phone)", "details line(s), one line", "Petra URL"],
  },
  {
    name: "petra_support_ticket_alert",
    category: "UTILITY",
    language: "he",
    body: "התראת תמיכה בפטרה: {{1}}\n\nעסק: {{2}}\nמשתמש: {{3}}\nנושא: {{4}}\n\nלטיפול בפנייה: {{5}}\nנשלח אוטומטית ממערכת פטרה",
    examples: ["פנייה חדשה", "נדב מאמן הכלבים", "nadav@example.com", "לא מצליח לשלוח תזכורת ללקוח", "https://petra-app.com/owner/support?ticket=abc123"],
    params: ["kind label (פנייה חדשה / תגובה חדשה בפנייה / פנייה נפתחה מחדש)", "business name", "user email", "ticket title", "admin URL"],
  },
  {
    name: "petra_support_overdue_alert",
    category: "UTILITY",
    language: "he",
    body: "פניות תמיכה בפטרה ממתינות לתשובה: {{1}}\n\nהוותיקה: {{2}}\n\nלפניות: {{3}}\nנשלח אוטומטית ממערכת פטרה",
    examples: ["3 פניות", "נדב מאמן הכלבים · לא מצליח לשלוח תזכורת (6 ש׳)", "https://petra-app.com/owner/support"],
    params: ["count sentence", "oldest ticket: business · title (hours)", "admin URL"],
  },
  {
    name: "petra_payment_received_alert",
    category: "UTILITY",
    language: "he",
    body: "תשלום מנוי התקבל בפטרה: {{1}}\n\nמסלול: {{2}}\nסכום: {{3}}\nהוראת קבע: {{4}}\n\nלניהול העסקים: {{5}}\nנשלח אוטומטית ממערכת פטרה",
    examples: ["נדב מאמן הכלבים", "Pro ₪199/חודש", "₪199", "הוראת קבע 20010 נוצרה", "https://petra-app.com/owner/tenants"],
    params: ["business name", "tier label", "amount", "recurring-order status (warnings included)", "admin URL"],
  },
  {
    name: "petra_whatsapp_failure_alert",
    category: "UTILITY",
    language: "he",
    body: "הודעת וואטסאפ ללקוח לא נמסרה: {{1}}\n\nסוג הודעה: {{2}}\nלקוח: {{3}}\nסיבה: {{4}}\nמה לעשות: {{5}}\n\nלעסק בפאנל: {{6}}\nנשלח אוטומטית ממערכת פטרה",
    examples: ["נדב מאמן הכלבים", "תזכורת לתור", "דנה · 054-*-964", "הלקוח מחוץ לחלון 24 השעות", "לשלוח בתבנית מאושרת", "https://petra-app.com/owner/tenants/abc123"],
    params: ["business name", "flow label", "customer (name · masked phone)", "Hebrew reason", "Hebrew fix", "admin URL"],
  },
];

/** Meta create-template request body for one catalog entry. */
export function toMetaTemplatePayload(t: CatalogTemplate) {
  return {
    name: t.name,
    category: t.category,
    language: t.language,
    components: [
      { type: "BODY", text: t.body, example: { body_text: [t.examples] } },
      ...(t.footer ? [{ type: "FOOTER", text: t.footer }] : []),
    ],
  };
}

/** Problems with a catalog entry against Meta's template rules (empty = valid). */
export function validateCatalogTemplate(t: CatalogTemplate): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9_]{1,512}$/.test(t.name)) problems.push("name must be lowercase a-z, 0-9, _");
  const vars = [...t.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  vars.forEach((v, i) => {
    if (v !== i + 1) problems.push(`variables must be {{1}}..{{n}} in order (found {{${v}}} at position ${i + 1})`);
  });
  if (/^\s*\{\{\d+\}\}/.test(t.body)) problems.push("body must not start with a variable");
  if (/\{\{\d+\}\}\s*$/.test(t.body)) problems.push("body must not end with a variable");
  if (t.examples.length !== vars.length) problems.push(`${vars.length} variables but ${t.examples.length} examples`);
  if (t.params.length !== vars.length) problems.push(`${vars.length} variables but ${t.params.length} param docs`);
  if (t.examples.some((e) => !e.trim())) problems.push("empty example");
  if (t.body.length > 1024) problems.push("body over 1024 chars");
  if (t.footer && t.footer.length > 60) problems.push("footer over 60 chars");
  return problems;
}
