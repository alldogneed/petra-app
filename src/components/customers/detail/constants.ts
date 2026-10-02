// Shared label/colour constants for the customer card (src/components/customers/detail/*).

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "מזומן",
  credit_card: "כרטיס אשראי",
  bank_transfer: "העברה בנקאית",
  bit: "ביט",
  paybox: "פייבוקס",
  check: "צ׳ק",
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: "badge-success",
  pending: "badge-warning",
  overdue: "badge-danger",
  canceled: "badge-neutral",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "שולם",
  pending: "ממתין",
  overdue: "באיחור",
  canceled: "בוטל",
};

export const BEHAVIOR_FLAG_LABELS: Record<string, { label: string; severity: "red" | "orange" | "green" }> = {
  dogAggression: { label: "תוקפנות כלבים", severity: "red" },
  humanAggression: { label: "תוקפנות אנשים", severity: "red" },
  biteHistory: { label: "היסטוריית נשיכה", severity: "red" },
  badWithKids: { label: "בעייתי עם ילדים", severity: "red" },
  leashReactivity: { label: "ריאקטיבי בשרשרת", severity: "orange" },
  leashPulling: { label: "משיכה בשרשרת", severity: "orange" },
  jumping: { label: "קפיצה", severity: "orange" },
  separationAnxiety: { label: "חרדת נטישה", severity: "orange" },
  excessiveBarking: { label: "נביחות מוגזמות", severity: "orange" },
  destruction: { label: "הרסנות", severity: "orange" },
  resourceGuarding: { label: "שמירת משאבים", severity: "orange" },
  houseSoiling: { label: "צרכים בבית", severity: "orange" },
  priorTraining: { label: "אילוף קודם", severity: "green" },
};

export const SEVERITY_COLORS: Record<string, string> = {
  red: "bg-red-100 text-red-700 border-red-200",
  orange: "bg-amber-100 text-amber-700 border-amber-200",
  green: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export const PROGRAM_TYPE_LABELS: Record<string, string> = {
  BASIC_OBEDIENCE: "משמעת בסיסית",
  REACTIVITY: "ריאקטיביות",
  PUPPY: "גור",
  BEHAVIOR: "התנהגות",
  ADVANCED: "מתקדם",
  CUSTOM: "מותאם אישית",
};

export const PROGRAM_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "פעיל",
  PAUSED: "מושהה",
  COMPLETED: "הושלם",
  CANCELED: "בוטל",
};

export const PROGRAM_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "badge-success",
  PAUSED: "badge-warning",
  COMPLETED: "badge-brand",
  CANCELED: "badge-neutral",
};

export const ORDER_STATUS_INFO: Record<string, { label: string; color: string }> = {
  draft: { label: "טיוטה", color: "badge-neutral" },
  confirmed: { label: "מאושר", color: "badge-brand" },
  paid: { label: "שולם", color: "badge-success" },
  partially_paid: { label: "שולם חלקית", color: "badge-warning" },
  canceled: { label: "בוטל", color: "badge-danger" },
  refunded: { label: "זוכה", color: "badge-danger" },
};

export const ORDER_TYPE_LABELS: Record<string, string> = {
  sale: "מכירה",
  products: "מוצרים",
  appointment: "תור",
  boarding: "פנסיון",
  training: "אילוף",
  grooming: "טיפוח",
};
