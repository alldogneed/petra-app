export const TIERS = {
  basic: {
    name: "בייסיק",
    price: 99,
    features: [
      "ניהול לקוחות וחיות מחמד",
      "יומן תורים",
      "תשלומים וחשבוניות",
      "תזכורות אוטומטיות",
      "משימות צוות",
    ],
  },
  pro: {
    name: "פרו",
    price: 199,
    features: [
      "כל מה שבבייסיק",
      "מערכת לידים / CRM",
      "יומן מתקדם",
      "ניהול הודעות ואוטומציות",
      "ניהול פנסיון - חדרים ותפוסה",
    ],
  },
  groomer: {
    name: "גרומר",
    price: 169,
    features: [
      "יומן תורים",
      "הוספת לקוחות מהירה",
      "תשלומים וחשבוניות",
      "מערכת לידים / CRM",
      "ניהול פורטפוליו",
    ],
  },
} as const;

export const VAT_RATE = 0.17;

export const LEAD_STAGES = [
  { id: "new", label: "חדש", color: "#8B5CF6" },
  { id: "contacted", label: "נוצר קשר", color: "#3B82F6" },
  { id: "qualified", label: "מתאים", color: "#6366F1" },
  { id: "won", label: "נסגר", color: "#22C55E" },
  { id: "lost", label: "אבוד", color: "#EF4444" },
] as const;

export const LEAD_SOURCES = [
  { id: "google", label: "גוגל" },
  { id: "instagram", label: "אינסטגרם" },
  { id: "facebook", label: "פייסבוק" },
  { id: "website", label: "אתר" },
  { id: "referral", label: "המלצה" },
  { id: "manual", label: "ידני" },
] as const;

export const LEAD_CONTACT_DAYS = 7;

export const LEAD_CALL_STATUS = {
  untouched: {
    id: "untouched",
    label: "לא נגעו",
    color: "#FBBF24",
    bgColor: "#FEF3C7",
  },
  needs_action: {
    id: "needs_action",
    label: "צריך לטפל",
    color: "#22C55E",
    bgColor: "#ECFDF5",
  },
  overdue: {
    id: "overdue",
    label: "איחור בטיפול",
    color: "#EF4444",
    bgColor: "#FEE2E2",
  },
  waiting: {
    id: "waiting",
    label: "בטיפול - מחכה",
    color: "#9CA3AF",
    bgColor: "#F3F4F6",
  },
} as const;

export const LOST_REASON_CODES = [
  { id: "PRICE", label: "יקר מדי" },
  { id: "COMPETITOR", label: "בחר מתחרה" },
  { id: "SCHEDULING", label: "לא זמין בזמנים" },
  { id: "TRUST_FIT", label: "לא התחבר מקצועית" },
  { id: "NO_RESPONSE", label: "לא חזר אלינו" },
  { id: "NOT_RELEVANT", label: "לא רלוונטי / רק בירור" },
  { id: "OTHER", label: "אחר" },
] as const;

export const SERVICE_TYPES = [
  { id: "training", label: "אילוף" },
  { id: "grooming", label: "טיפוח" },
  { id: "boarding", label: "פנסיון" },
  { id: "daycare", label: "דיי קר" },
  { id: "consultation", label: "ייעוץ" },
  { id: "other", label: "אחר" },
] as const;

export const PAYMENT_METHODS = [
  { id: "cash", label: "מזומן" },
  { id: "credit_card", label: "אשראי" },
  { id: "transfer", label: "העברה" },
  { id: "bit", label: "ביט" },
  { id: "paybox", label: "פייבוקס" },
  { id: "other", label: "אחר" },
] as const;

export const TEMPLATE_VARIABLES = [
  "{customerName}",
  "{petName}",
  "{date}",
  "{time}",
  "{serviceName}",
  "{businessPhone}",
] as const;

export const WEEK_DAYS_HE = [
  "ראשון",
  "שני",
  "שלישי",
  "רביעי",
  "חמישי",
  "שישי",
  "שבת",
] as const;

export const ORDER_CATEGORIES = [
  { id: "training", label: "אילוף" },
  { id: "boarding", label: "פנסיון" },
  { id: "grooming", label: "טיפוח" },
  { id: "products", label: "מוצרים" },
] as const;

export const ORDER_STATUSES = [
  { id: "draft", label: "טיוטה", color: "#94A3B8" },
  { id: "pending", label: "ממתין", color: "#F59E0B" },
  { id: "accepted", label: "מאושר", color: "#3B82F6" },
  { id: "completed", label: "הושלם", color: "#22C55E" },
  { id: "cancelled", label: "בוטל", color: "#EF4444" },
] as const;

export const ORDER_UNITS = [
  { id: "per_session", label: "לאימון" },
  { id: "per_hour", label: "לשעה" },
  { id: "per_day", label: "ליום" },
  { id: "per_night", label: "ללילה" },
  { id: "per_unit", label: "ליחידה" },
  { id: "package", label: "חבילה" },
] as const;

// ─── Invoicing ───────────────────────────────────────────────────────────────

export const INVOICE_DOCUMENT_TYPES = [
  { id: 305, label: "חשבונית מס" },
  { id: 320, label: "חשבונית מס / קבלה" },
  { id: 400, label: "קבלה" },
  { id: 330, label: "חשבונית זיכוי" },
] as const;

export const INVOICE_STATUSES = [
  { id: "draft", label: "טיוטה", color: "#94A3B8" },
  { id: "pending", label: "ממתין", color: "#F59E0B" },
  { id: "issued", label: "הונפקה", color: "#22C55E" },
  { id: "failed", label: "נכשל", color: "#EF4444" },
  { id: "cancelled", label: "בוטל", color: "#64748B" },
] as const;

export const INVOICE_PROVIDERS = [
  { id: "morning", label: "Morning (חשבונית ירוקה)", description: "חשבוניות וקבלות דיגיטליות דרך Green Invoice" },
  { id: "icount", label: "iCount", description: "מערכת חשבוניות והנהלת חשבונות" },
  { id: "rivhit", label: "רווחית", description: "חשבוניות דיגיטליות ודוחות" },
] as const;
