/**
 * Activity action catalog — client-safe (no prisma import).
 * Single source of truth for action names, Hebrew labels, filter groups,
 * entity links and which actions are "sensitive" (owner security alerts).
 * Server-side writer: src/lib/activity-log.ts → logActivity().
 */

export const ACTIVITY_ACTIONS = {
  LOGIN: "LOGIN",
  CREATE_CUSTOMER: "CREATE_CUSTOMER",
  UPDATE_CUSTOMER: "UPDATE_CUSTOMER",
  DELETE_CUSTOMER: "DELETE_CUSTOMER",
  MERGE_CUSTOMER: "MERGE_CUSTOMER",
  BULK_UPDATE_CUSTOMERS: "BULK_UPDATE_CUSTOMERS",
  ADD_PET: "ADD_PET",
  DELETE_PET: "DELETE_PET",
  CREATE_APPOINTMENT: "CREATE_APPOINTMENT",
  UPDATE_APPOINTMENT: "UPDATE_APPOINTMENT",
  COMPLETE_APPOINTMENT: "COMPLETE_APPOINTMENT",
  CANCEL_APPOINTMENT: "CANCEL_APPOINTMENT",
  DELETE_APPOINTMENT: "DELETE_APPOINTMENT",
  CREATE_ORDER: "CREATE_ORDER",
  CANCEL_ORDER: "CANCEL_ORDER",
  DELETE_ORDER: "DELETE_ORDER",
  CREATE_PAYMENT: "CREATE_PAYMENT",
  UPDATE_PAYMENT: "UPDATE_PAYMENT",
  CANCEL_PAYMENT: "CANCEL_PAYMENT",
  REFUND_PAYMENT: "REFUND_PAYMENT",
  DELETE_PAYMENT: "DELETE_PAYMENT",
  CREATE_LEAD: "CREATE_LEAD",
  UPDATE_LEAD: "UPDATE_LEAD",
  CLOSE_LEAD_WON: "CLOSE_LEAD_WON",
  CLOSE_LEAD_LOST: "CLOSE_LEAD_LOST",
  DELETE_LEAD: "DELETE_LEAD",
  CREATE_TASK: "CREATE_TASK",
  COMPLETE_TASK: "COMPLETE_TASK",
  CANCEL_TASK: "CANCEL_TASK",
  DELETE_TASK: "DELETE_TASK",
  CREATE_BOARDING_STAY: "CREATE_BOARDING_STAY",
  CHECKIN_BOARDING: "CHECKIN_BOARDING",
  CHECKOUT_BOARDING: "CHECKOUT_BOARDING",
  DELETE_BOARDING: "DELETE_BOARDING",
  DELETE_TRAINING: "DELETE_TRAINING",
  DELETE_SERVICE_DOG: "DELETE_SERVICE_DOG",
  DELETE_RECIPIENT: "DELETE_RECIPIENT",
  UPDATE_SETTINGS: "UPDATE_SETTINGS",
  CREATE_MESSAGE_TEMPLATE: "CREATE_MESSAGE_TEMPLATE",
  EXPORT_CUSTOMERS: "EXPORT_CUSTOMERS",
  EXPORT_DATA: "EXPORT_DATA",
  EXPORT_ACTIVITY: "EXPORT_ACTIVITY",
  CONNECT_WHATSAPP: "CONNECT_WHATSAPP",
  DISCONNECT_WHATSAPP: "DISCONNECT_WHATSAPP",
  SYNC_WHATSAPP_TEMPLATES: "SYNC_WHATSAPP_TEMPLATES",
  // Team & security (ניהול ובקרה)
  INVITE_MEMBER: "INVITE_MEMBER",
  UPDATE_MEMBER_ROLE: "UPDATE_MEMBER_ROLE",
  UPDATE_MEMBER_PERMISSIONS: "UPDATE_MEMBER_PERMISSIONS",
  DEACTIVATE_MEMBER: "DEACTIVATE_MEMBER",
  ACTIVATE_MEMBER: "ACTIVATE_MEMBER",
  REVOKE_SESSION: "REVOKE_SESSION",
  UPDATE_SECURITY_ALERTS: "UPDATE_SECURITY_ALERTS",
  CHANGE_BUSINESS_PHONE: "CHANGE_BUSINESS_PHONE",
  CANCEL_SUBSCRIPTION: "CANCEL_SUBSCRIPTION",
  DELETE_CONTRACT_TEMPLATE: "DELETE_CONTRACT_TEMPLATE",
  DELETE_IMPORT_BATCH: "DELETE_IMPORT_BATCH",
} as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[keyof typeof ACTIVITY_ACTIONS];

/** Hebrew past-tense label shown after the user's name ("דנה מחקה לקוח"). */
export const ACTION_LABELS: Record<string, string> = {
  LOGIN: "התחבר/ה למערכת",
  CREATE_CUSTOMER: "יצר/ה לקוח חדש",
  UPDATE_CUSTOMER: "עדכן/ה לקוח",
  DELETE_CUSTOMER: "מחק/ה לקוח",
  MERGE_CUSTOMER: "מיזג/ה לקוח כפול",
  BULK_UPDATE_CUSTOMERS: "עדכן/ה לקוחות בקבוצה",
  ADD_PET: "הוסיף/ה חיית מחמד",
  DELETE_PET: "מחק/ה חיית מחמד",
  CREATE_APPOINTMENT: "יצר/ה תור חדש",
  UPDATE_APPOINTMENT: "עדכן/ה תור",
  COMPLETE_APPOINTMENT: "סיים/ה תור",
  CANCEL_APPOINTMENT: "ביטל/ה תור",
  DELETE_APPOINTMENT: "מחק/ה תור",
  CREATE_ORDER: "יצר/ה הזמנה חדשה",
  CANCEL_ORDER: "ביטל/ה הזמנה",
  DELETE_ORDER: "מחק/ה הזמנה",
  CREATE_PAYMENT: "רשם/ה תשלום",
  UPDATE_PAYMENT: "עדכן/ה תשלום",
  CANCEL_PAYMENT: "ביטל/ה תשלום",
  REFUND_PAYMENT: "החזיר/ה תשלום",
  DELETE_PAYMENT: "מחק/ה תשלום",
  CREATE_LEAD: "יצר/ה ליד חדש",
  UPDATE_LEAD: "עדכן/ה ליד",
  CLOSE_LEAD_WON: "סגר/ה ליד בהצלחה",
  CLOSE_LEAD_LOST: "סגר/ה ליד כאבוד",
  DELETE_LEAD: "מחק/ה ליד",
  CREATE_TASK: "יצר/ה משימה",
  COMPLETE_TASK: "השלים/ה משימה",
  CANCEL_TASK: "ביטל/ה משימה",
  DELETE_TASK: "מחק/ה משימה",
  CREATE_BOARDING_STAY: "יצר/ה שהייה בפנסיון",
  CHECKIN_BOARDING: "ביצע/ה צ׳ק-אין",
  CHECKOUT_BOARDING: "ביצע/ה צ׳ק-אאוט",
  DELETE_BOARDING: "מחק/ה שהייה",
  DELETE_TRAINING: "מחק/ה תוכנית אילוף",
  DELETE_SERVICE_DOG: "מחק/ה כלב שירות",
  DELETE_RECIPIENT: "מחק/ה זכאי",
  UPDATE_SETTINGS: "עדכן/ה הגדרות",
  CREATE_MESSAGE_TEMPLATE: "יצר/ה תבנית הודעה",
  EXPORT_CUSTOMERS: "ייצא/ה את רשימת הלקוחות",
  EXPORT_DATA: "ייצא/ה נתונים",
  EXPORT_ACTIVITY: "ייצא/ה את יומן הפעילות",
  CONNECT_WHATSAPP: "חיבר/ה WhatsApp",
  DISCONNECT_WHATSAPP: "ניתק/ה WhatsApp",
  SYNC_WHATSAPP_TEMPLATES: "סנכרן/ה תבניות WhatsApp",
  INVITE_MEMBER: "הוסיף/ה עובד לצוות",
  UPDATE_MEMBER_ROLE: "שינה/תה תפקיד לעובד",
  UPDATE_MEMBER_PERMISSIONS: "שינה/תה הרשאות לעובד",
  DEACTIVATE_MEMBER: "השבית/ה עובד",
  ACTIVATE_MEMBER: "הפעיל/ה עובד",
  REVOKE_SESSION: "ניתק/ה סשן",
  UPDATE_SECURITY_ALERTS: "עדכן/ה התראות אבטחה",
  CHANGE_BUSINESS_PHONE: "שינה/תה את טלפון העסק",
  CANCEL_SUBSCRIPTION: "ביטל/ה את המנוי",
  DELETE_CONTRACT_TEMPLATE: "מחק/ה תבנית חוזה",
  DELETE_IMPORT_BATCH: "ביטל/ה ייבוא לקוחות",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/** Options for the activity-log action filter (value "" = all). */
export const ACTION_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "כל הפעולות" },
  { value: "LOGIN", label: "כניסות" },
  { value: "CREATE_CUSTOMER", label: "יצירת לקוח" },
  { value: "UPDATE_CUSTOMER", label: "עדכון לקוח" },
  { value: "DELETE_CUSTOMER", label: "מחיקת לקוח" },
  { value: "MERGE_CUSTOMER", label: "מיזוג לקוחות" },
  { value: "BULK_UPDATE_CUSTOMERS", label: "עדכון לקוחות בקבוצה" },
  { value: "ADD_PET", label: "הוספת חיית מחמד" },
  { value: "CREATE_APPOINTMENT", label: "יצירת תור" },
  { value: "CANCEL_APPOINTMENT", label: "ביטול תור" },
  { value: "DELETE_APPOINTMENT", label: "מחיקת תור" },
  { value: "CREATE_ORDER", label: "יצירת הזמנה" },
  { value: "CREATE_PAYMENT", label: "רישום תשלום" },
  { value: "CANCEL_PAYMENT", label: "ביטול תשלום" },
  { value: "REFUND_PAYMENT", label: "החזר תשלום" },
  { value: "CREATE_LEAD", label: "יצירת ליד" },
  { value: "CLOSE_LEAD_WON", label: "ליד נסגר בהצלחה" },
  { value: "DELETE_LEAD", label: "מחיקת ליד" },
  { value: "CREATE_TASK", label: "יצירת משימה" },
  { value: "CREATE_BOARDING_STAY", label: "פנסיון" },
  { value: "UPDATE_SETTINGS", label: "הגדרות" },
  { value: "EXPORT_CUSTOMERS", label: "ייצוא לקוחות" },
  { value: "REVOKE_SESSION", label: "ניתוק סשן" },
  { value: "UPDATE_MEMBER_PERMISSIONS", label: "שינוי הרשאות" },
];

/** Entity types stored in ActivityLog.entityType. */
export const ENTITY_TYPES = {
  CUSTOMER: "CUSTOMER",
  PET: "PET",
  APPOINTMENT: "APPOINTMENT",
  ORDER: "ORDER",
  PAYMENT: "PAYMENT",
  LEAD: "LEAD",
  TASK: "TASK",
  BOARDING: "BOARDING",
  TRAINING: "TRAINING",
  MEMBER: "MEMBER",
  SESSION: "SESSION",
  SETTINGS: "SETTINGS",
} as const;
export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

/**
 * In-app link for an entity, or null when there is no page to open
 * (deleted entities get no link — the caller passes `deleted`).
 */
export function entityHref(
  entityType: string | null | undefined,
  entityId: string | null | undefined,
  deleted = false
): string | null {
  if (!entityType || !entityId || deleted) return null;
  const id = encodeURIComponent(entityId);
  switch (entityType) {
    case "CUSTOMER": return `/customers/${id}`;
    case "PET": return `/pets/${id}`;
    case "ORDER": return `/orders/${id}`;
    case "LEAD": return `/leads`;
    case "TASK": return `/tasks`;
    case "BOARDING": return `/boarding`;
    case "TRAINING": return `/training`;
    case "APPOINTMENT": return `/calendar`;
    case "PAYMENT": return `/payments`;
    default: return null;
  }
}

/** Actions whose entity no longer exists after the action (render without a link). */
export const DELETE_ACTIONS = new Set<string>([
  "DELETE_CUSTOMER", "DELETE_PET", "DELETE_APPOINTMENT", "DELETE_ORDER", "DELETE_PAYMENT",
  "DELETE_LEAD", "DELETE_TASK", "DELETE_BOARDING", "DELETE_TRAINING", "DELETE_SERVICE_DOG", "DELETE_RECIPIENT",
]);

/** Max length of ActivityLog.entityLabel. */
export const ENTITY_LABEL_MAX = 120;

/** Strip control chars / newlines and cap length (labels come from customer-controlled names). */
export function sanitizeEntityLabel(label: string | null | undefined): string | null {
  if (label == null) return null;
  // eslint-disable-next-line no-control-regex
  const clean = String(label).replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > ENTITY_LABEL_MAX ? clean.slice(0, ENTITY_LABEL_MAX - 1) + "…" : clean;
}

/** Short device label from a User-Agent, e.g. "Chrome · Windows", "Safari · iPhone". Used for LOGIN rows + sessions. */
export function describeDevice(ua: string | null | undefined): string {
  if (!ua) return "מכשיר לא ידוע";
  const os =
    /iPhone/i.test(ua) ? "iPhone" :
    /iPad/i.test(ua) ? "iPad" :
    /Android/i.test(ua) ? "Android" :
    /Windows/i.test(ua) ? "Windows" :
    /Mac OS X|Macintosh/i.test(ua) ? "Mac" :
    /Linux/i.test(ua) ? "Linux" : "אחר";
  const browser =
    /Edg\//i.test(ua) ? "Edge" :
    /OPR\/|Opera/i.test(ua) ? "Opera" :
    /SamsungBrowser/i.test(ua) ? "Samsung" :
    /CriOS|Chrome\//i.test(ua) ? "Chrome" :
    /FxiOS|Firefox\//i.test(ua) ? "Firefox" :
    /Safari\//i.test(ua) ? "Safari" : "דפדפן";
  return `${browser} · ${os}`;
}
