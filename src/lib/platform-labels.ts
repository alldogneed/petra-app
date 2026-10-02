/**
 * Hebrew labels for the platform admin panel — client-safe (no prisma import).
 * AuditLog actions (admin/security events) live here; ActivityLog actions
 * (what business users do) are in src/lib/activity-actions.ts.
 */

import { ACTION_LABELS } from "@/lib/activity-actions";

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: "התחברות",
  LOGIN_FAILURE: "התחברות נכשלה",
  LOGOUT: "התנתקות",
  TWO_FA_ENROLLED: "הפעלת אימות דו-שלבי",
  TWO_FA_VERIFIED: "אימות דו-שלבי עבר",
  TWO_FA_FAILED: "אימות דו-שלבי נכשל",
  PLATFORM_USER_CREATED: "יצירת משתמש",
  PLATFORM_USER_DELETED: "מחיקת משתמש",
  PLATFORM_USER_BLOCKED: "חסימת משתמש",
  PLATFORM_USER_UNBLOCKED: "ביטול חסימת משתמש",
  PLATFORM_ROLE_CHANGED: "שינוי תפקיד פלטפורמה",
  USER_ONBOARDED: "הרשמת משתמש",
  TENANT_CREATED: "יצירת עסק",
  TENANT_UPDATED: "עדכון עסק",
  TENANT_SUSPENDED: "השהיית עסק",
  TENANT_ACTIVATED: "הפעלת עסק",
  TENANT_CLOSED: "סגירת עסק",
  SUPER_ADMIN_TENANT_ACCESS: "כניסת אדמין לעסק",
  IMPERSONATION_STARTED: "התחזות לעסק — התחלה",
  IMPERSONATION_ENDED: "התחזות לעסק — סיום",
  FEATURE_FLAG_CHANGED: "שינוי Feature Flag",
  SYSTEM_SETTING_CHANGED: "שינוי הגדרת מערכת",
  TENANT_MEMBER_INVITED: "הוספת חבר צוות",
  TENANT_MEMBER_ROLE_CHANGED: "שינוי תפקיד בצוות",
  TENANT_MEMBER_DEACTIVATED: "השבתת חבר צוות",
  TENANT_MEMBER_REACTIVATED: "הפעלת חבר צוות",
  TENANT_SETTINGS_CHANGED: "שינוי הגדרות עסק",
  GOOGLE_ACCOUNT_LINKED: "קישור חשבון Google",
  DATA_EXPORT_REQUESTED: "בקשת ייצוא נתונים",
  DATA_EXPORT_DOWNLOADED: "הורדת ייצוא נתונים",
  PASSWORD_CHANGED: "שינוי סיסמה",
  ALL_SESSIONS_REVOKED: "ניתוק כל הסשנים",
};

/** Hebrew label for an AuditLog action; unknown codes fall back to a readable form. */
export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? humanizeCode(action);
}

/** Neutral noun-form label for an ActivityLog action (for charts and filters). */
export function activityActionLabel(action: string): string {
  const label = ACTION_LABELS[action];
  return label ? label.replace(/\/ה|\/תה/g, "") : humanizeCode(action);
}

function humanizeCode(code: string): string {
  return code.replace(/_/g, " ").toLowerCase();
}

export const TARGET_TYPE_LABELS: Record<string, string> = {
  business: "עסק",
  user: "משתמש",
  feature_flag: "Feature Flag",
  setting: "הגדרה",
  member: "חבר צוות",
};

export const TIER_LABELS: Record<string, string> = {
  free: "חינמי",
  basic: "Basic",
  pro: "Pro",
  groomer: "Groomer",
  groomer_plus: "Groomer+",
  service_dog: "Service Dog",
};

export const PLATFORM_ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  support: "Support",
};
