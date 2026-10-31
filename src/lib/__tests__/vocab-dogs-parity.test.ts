/**
 * Zero behaviour change for dogs businesses: every string that moved into the
 * dictionary must render, for "dogs", exactly what the code rendered before
 * (copied verbatim from the replaced code — git history of each file).
 */
import he from "../../../messages/he.json";
import { vocab, type VocabKey } from "@/lib/verticals/vocab";

const CASES: { key: VocabKey; params?: Record<string, string>; before: string }[] = [
  { key: "nav.training", before: "ניהול תהליכי אילוף" },
  { key: "training.page_title", before: "אימונים" },
  { key: "training.page_subtitle", before: "קבוצות ותוכניות אימון" },
  { key: "search.placeholder", before: "חפש לקוח, חיית מחמד, תור, ליד, משימה..." },
  {
    key: "customer.followup_message",
    params: { name: "דנה", pet: "רקסי", service: "אילוף", petPart: " של רקסי" },
    before: `שלום דנה 😊\n\nרציתי לבדוק איך רקסי מרגיש/ת אחרי אילוף של רקסי.\n\nאם יש שאלות אנחנו כאן תמיד 🐾`,
  },
  {
    key: "customer.welcome_message",
    params: { name: "דנה" },
    before: `שלום דנה 😊\n\nברוכים הבאים! שמחים שהצטרפתם אלינו 🐾\nאנחנו כאן לכל שאלה ובקשה.\n\nנשמח לראותכם בקרוב!`,
  },
  { key: "customer.bulk_placeholder", before: "שלום {שם}! רצינו להזמין אותך לתור הבא שלך... 🐾" },
  { key: "customer.bulk_delete_warning", before: "פעולה זו תמחק גם את חיות המחמד, התורים ונתוני הלקוח לצמיתות." },
  { key: "service_type.training", before: "אילוף" },
  { key: "pricing.category_program", before: "אילוף" },
  { key: "order.training_kind", before: "סוג האילוף" },
  { key: "order.package_label", before: "חבילת אילוף" },
  { key: "order.no_packages", before: "אין חבילות פעילות. הגדר פריט אילוף עם כמות מפגשים במחירון." },
  { key: "order.payment_request_greeting", params: { name: "דנה" }, before: "שלום דנה! 🐾" },
  { key: "order.open_program", before: "פתח תוכנית אילוף →" },
  { key: "picker.customer_placeholder", before: "חיפוש לפי שם לקוח, טלפון או שם הכלב" },
  { key: "calendar.group_training", before: "אילוף מקצועי" },
  { key: "calendar.category_training_home", before: "אילוף בבית הלקוח" },
  { key: "calendar.session_title_prefix", before: "אילוף" },
  { key: "calendar.session_icon", before: "🐕" },
  { key: "calendar.reminder_service_icon", before: "🐾" },
  { key: "calendar.next_booking_signoff", before: "נתראה! 🐾" },
  { key: "appointment.attach_to_package", before: "לשייך לחבילת אילוף" },
  { key: "appointment.default_session_note", before: "מפגש אילוף" },
  { key: "appointment.booked_signoff", before: "תודה! 🐾" },
  { key: "gcal.service_icon", before: "🐾" },
  { key: "booking.confirm_signoff", before: "מחכים לראותכם! 🐾" },
  { key: "order.type_training", before: "🐕 אילוף" },
  { key: "starter.appointment_reminder", before: "שלום {customerName}! 🐾\n\nתזכורת לפגישה שלנו ב-{date} בשעה {time}.\nשירות: {serviceName}.\n\nמחכים לראות אתכם! 😊" },
  { key: "starter.appointment_confirmation", before: "שלום {customerName}! ✅\n\nהפגישה שלך נקבעה בהצלחה!\n📅 תאריך: {date}\n🕐 שעה: {time}\nשירות: {serviceName}\n\nמחכים לראות אתכם! 🐾" },
  { key: "starter.payment_request", before: "שלום {customerName}! 🐾\n\n*דרישת תשלום*\nעבור: {serviceName} – {petName}\n\n💰 סה\"כ לתשלום: *{orderTotal}*\n\n💳 לתשלום מאובטח לחצו כאן:\n{paymentUrl}\n\nתודה שבחרתם בנו! 😊\n_לפניות ושאלות: {businessPhone}_" },
  { key: "starter.lead_followup", before: "שלום {customerName}! 🐾\n\nקיבלנו את פנייתך לגבי {serviceName} ונשמח לעזור!\nנחזור אליך בהקדם." },
  { key: "starter.appointment_followup", before: "שלום {customerName}! 🌟\n\nרצינו לדעת איך {petName} מרגיש/ת לאחר הפגישה האחרונה.\nאם הכל בסדר – נשמח לשמוע! ואם יש משהו שלא כשורה, חשוב לנו לדעת.\n\nתודה שבחרתם בנו 💛" },
  { key: "starter.new_customer", before: "שלום {customerName}! 😊\n\nברוכים הבאים! שמחים לקבל אתכם ואת {petName} אלינו.\n\nיש לנו הרבה מה לחגוג ביחד – מחכים לראות אתכם בפגישה הראשונה! 🐾" },
  { key: "starter.review_request", before: "שלום {customerName}! ⭐\n\nתודה שסמכתם עלינו לטפל ב-{petName}.\n\nאם אהבתם, נשמח מאוד לביקורת קצרה – זה עוזר לנו ולבעלי חיות אחרים בחיפוש שירות מקצועי 🙏\n\nתודה מהלב!" },
  { key: "booking.customer_step_title", before: "פרטי בעל הכלב" },
  { key: "booking.customer_label", before: "בעל הכלב" },
  { key: "booking.meta_description", params: { name: "נדב" }, before: "קבע/י תור אצל נדב בקלות ובמהירות. שירותים לכלבים" },
  { key: "onboarding.business_name_placeholder", before: "לדוגמה: אילוף כלבים ישראלי" },
  { key: "onboarding.first_service_placeholder", before: "לדוגמה: שיעור אילוף בסיסי" },
  { key: "onboarding.next_service_placeholder", before: "לדוגמה: שיעור אילוף מתקדם" },
  { key: "onboarding.done_title", before: "הכל מוכן! 🐾" },
  { key: "dashboard.welcome_icon", before: "🐾" },
  { key: "dashboard.at_risk_message", params: { name: "דנה" }, before: "שלום דנה! 🐾\nזמן רב לא ראינו אתכם, מתגעגעים!\nהאם תרצו לקבוע תור? נשמח לראות אתכם שוב 😊" },
  { key: "team.critical_delete_label", before: "למחוק לקוחות וכלבים" },
  { key: "team.view_training_label", before: "תהליכי אילוף" },
  { key: "team.view_training_hint", before: "תוכניות אילוף וקבוצות" },
  { key: "booking.share_link_message", params: { url: "https://x/book/a" }, before: "היי! 🐾\nרוצה לקבוע תור? אפשר לעשות את זה בקלות דרך הלינק הזה:\nhttps://x/book/a" },
  { key: "analytics.training_title", before: "אילוף" },
  { key: "analytics.active_programs", before: "תוכניות אילוף פעילות" },
  { key: "analytics.program_revenue", before: "הכנסות אילוף בתקופה" },
  { key: "analytics.operations_tab", before: "אילוף ופנסיון" },
  { key: "messages.followup_subject", before: "הכלב שלכם" },
  { key: "messages.greeting_emoji", before: "🐾" },
];

describe("dogs values are the pre-verticals text", () => {
  it.each(CASES)("$key", ({ key, params, before }) => {
    expect(vocab(key, { params })).toBe(before);
    expect(vocab(key, { vertical: "dogs", params })).toBe(before);
  });
});

describe("every dictionary key that replaced code text is covered here", () => {
  it("lists every key that is not a new (verticals-only) string", () => {
    // Keys that never existed as code text (new UI) — nothing to compare against.
    const NEW_KEYS = new Set<string>(["business.kind", "business.kind_hint"]);
    const covered = new Set(CASES.map((c) => c.key));
    const all = Object.keys(he.vocab);
    expect(all.filter((k) => !covered.has(k as VocabKey) && !NEW_KEYS.has(k))).toEqual([]);
  });
});
