// ─── Service Dog Management: constants, types, and helpers ───

// ─── Phases ───

export const SERVICE_DOG_PHASES = [
  { id: "PUPPY", label: "גור", color: "bg-pink-50 text-pink-700 border-pink-200" },
  { id: "SELECTION", label: "בחירה", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { id: "IN_TRAINING", label: "באימון", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "ADVANCED_TRAINING", label: "אימון מתקדם", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { id: "CERTIFIED", label: "מוסמך", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { id: "RETIRED", label: "בדימוס", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "DECERTIFIED", label: "שלילת הסמכה", color: "bg-red-50 text-red-600 border-red-200" },
] as const;

export const SERVICE_DOG_PHASE_MAP: Record<string, { label: string; color: string }> =
  Object.fromEntries(SERVICE_DOG_PHASES.map((p) => [p.id, { label: p.label, color: p.color }]));

export const SERVICE_DOG_PHASE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PUPPY:             { bg: "#FDF2F8", text: "#BE185D", border: "#FBCFE8" },
  SELECTION:         { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" },
  IN_TRAINING:       { bg: "#EFF6FF", text: "#2563EB", border: "#93C5FD" },
  ADVANCED_TRAINING: { bg: "#EEF2FF", text: "#4338CA", border: "#A5B4FC" },
  CERTIFIED:         { bg: "#F0FDF4", text: "#16A34A", border: "#86EFAC" },
  RETIRED:           { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" },
  DECERTIFIED:       { bg: "#FEF2F2", text: "#DC2626", border: "#FCA5A5" },
};

// ─── Training Statuses ───

export const SERVICE_DOG_TRAINING_STATUSES = [
  { id: "NOT_STARTED", label: "טרם החל", color: "bg-slate-100 text-slate-600" },
  { id: "IN_PROGRESS", label: "בתהליך", color: "bg-blue-100 text-blue-700" },
  { id: "PENDING_CERT", label: "ממתין להסמכה", color: "bg-amber-100 text-amber-700" },
  { id: "CERTIFIED", label: "הוסמך", color: "bg-emerald-100 text-emerald-700" },
  { id: "FAILED", label: "לא עבר", color: "bg-red-100 text-red-600" },
] as const;

export const TRAINING_STATUS_MAP: Record<string, { label: string; color: string }> =
  Object.fromEntries(SERVICE_DOG_TRAINING_STATUSES.map((s) => [s.id, { label: s.label, color: s.color }]));

// ─── Placement Statuses ───

export const SERVICE_DOG_PLACEMENT_STATUSES = [
  { id: "PENDING", label: "ממתין", color: "bg-slate-100 text-slate-600" },
  { id: "TRIAL", label: "תקופת ניסיון", color: "bg-blue-100 text-blue-700" },
  { id: "ACTIVE", label: "פעיל", color: "bg-emerald-100 text-emerald-700" },
  { id: "SUSPENDED", label: "מושהה", color: "bg-amber-100 text-amber-700" },
  { id: "TERMINATED", label: "הסתיים", color: "bg-red-100 text-red-600" },
  { id: "COMPLETED", label: "הושלם", color: "bg-indigo-100 text-indigo-700" },
] as const;

export const PLACEMENT_STATUS_MAP: Record<string, { label: string; color: string }> =
  Object.fromEntries(SERVICE_DOG_PLACEMENT_STATUSES.map((s) => [s.id, { label: s.label, color: s.color }]));

// ─── Recipient Statuses ───

export const RECIPIENT_STATUSES = [
  { id: "WAITLIST", label: "רשימת המתנה", color: "bg-slate-100 text-slate-600" },
  { id: "MATCHED", label: "שובץ", color: "bg-blue-100 text-blue-700" },
  { id: "ACTIVE", label: "פעיל", color: "bg-emerald-100 text-emerald-700" },
  { id: "CLOSED", label: "סגור", color: "bg-red-100 text-red-600" },
] as const;

export const RECIPIENT_STATUS_MAP: Record<string, { label: string; color: string }> =
  Object.fromEntries(RECIPIENT_STATUSES.map((s) => [s.id, { label: s.label, color: s.color }]));

// ─── Disability Types ───

export const DISABILITY_TYPES = [
  { id: "PTSD", label: "PTSD" },
  { id: "VISUAL", label: "לקות ראייה" },
  { id: "HEARING", label: "לקות שמיעה" },
  { id: "MOBILITY", label: "לקות תנועה" },
  { id: "AUTISM", label: "אוטיזם" },
  { id: "DIABETES", label: "סוכרת" },
  { id: "EPILEPSY", label: "אפילפסיה" },
  { id: "OTHER", label: "אחר" },
] as const;

export const DISABILITY_TYPE_MAP: Record<string, string> =
  Object.fromEntries(DISABILITY_TYPES.map((d) => [d.id, d.label]));

// ─── Service Types ───

export const SERVICE_DOG_TYPES = [
  { id: "MOBILITY", label: "ניידות" },
  { id: "PSYCHIATRIC", label: "פסיכיאטרי" },
  { id: "GUIDE", label: "נחייה" },
  { id: "AUTISM", label: "אוטיזם" },
  { id: "ALERT", label: "התרעה" },
  { id: "OTHER", label: "אחר" },
] as const;

export const SERVICE_DOG_TYPE_MAP: Record<string, string> =
  Object.fromEntries(SERVICE_DOG_TYPES.map((t) => [t.id, t.label]));

// ─── Medical Protocol Keys ───

export interface MedicalProtocolDef {
  key: string;
  label: string;
  category: string;
}

export const MEDICAL_PROTOCOL_CATEGORIES = [
  { id: "VACCINATION", label: "חיסונים" },
  { id: "HEALTH_CHECK", label: "בדיקות בריאות" },
  { id: "PARASITE", label: "טפילים" },
  { id: "BEHAVIOR_EVAL", label: "הערכה התנהגותית" },
  { id: "VET_CLEARANCE", label: "אישור וטרינרי" },
] as const;

export const MEDICAL_PROTOCOL_KEYS: MedicalProtocolDef[] = [
  { key: "RABIES_PRIMARY", label: "חיסון כלבת ראשוני", category: "VACCINATION" },
  { key: "RABIES_BOOSTER", label: "חיסון כלבת מחזורי", category: "VACCINATION" },
  { key: "DHPP_PRIMARY", label: "חיסון משושה ראשוני", category: "VACCINATION" },
  { key: "DHPP", label: "חיסון משושה", category: "VACCINATION" },
  { key: "DHPP_BOOSTER", label: "חיסון משושה מחזורי", category: "VACCINATION" },
  { key: "LEPTOSPIROSIS", label: "לפטוספירוזיס", category: "VACCINATION" },
  { key: "BORDETELLA", label: "בורדטלה", category: "VACCINATION" },
  { key: "DEWORMING", label: "תילוע", category: "PARASITE" },
  { key: "FLEA_TICK", label: "טיפול פרעושים וקרציות", category: "PARASITE" },
  { key: "VET_EXAM", label: "בדיקה וטרינרית", category: "HEALTH_CHECK" },
  { key: "VET_CLEARANCE", label: "אישור וטרינרי להמשך", category: "VET_CLEARANCE" },
  { key: "HIP_XRAY", label: "צילום אגן", category: "HEALTH_CHECK" },
  { key: "EYE_EXAM", label: "בדיקת עיניים", category: "HEALTH_CHECK" },
  { key: "TEMPERAMENT_EVAL", label: "הערכת מזג", category: "BEHAVIOR_EVAL" },
  { key: "HEALTH_CERT", label: "תעודת בריאות", category: "VET_CLEARANCE" },
  { key: "ANNUAL_RECERT", label: "הסמכה מחדש שנתית", category: "VET_CLEARANCE" },
];

export const MEDICAL_PROTOCOL_MAP: Record<string, MedicalProtocolDef> =
  Object.fromEntries(MEDICAL_PROTOCOL_KEYS.map((p) => [p.key, p]));

// ─── Phase → Medical Protocols Map ───

export const PHASE_MEDICAL_PROTOCOLS: Record<string, string[]> = {
  PUPPY: ["DHPP_PRIMARY", "DEWORMING", "FLEA_TICK", "VET_EXAM", "TEMPERAMENT_EVAL"],
  SELECTION: ["RABIES_PRIMARY", "DHPP", "DEWORMING", "FLEA_TICK", "VET_EXAM", "TEMPERAMENT_EVAL", "VET_CLEARANCE", "HIP_XRAY", "EYE_EXAM"],
  IN_TRAINING: ["RABIES_BOOSTER", "DHPP_BOOSTER", "LEPTOSPIROSIS", "BORDETELLA", "DEWORMING", "FLEA_TICK", "VET_EXAM", "VET_CLEARANCE"],
  ADVANCED_TRAINING: ["RABIES_BOOSTER", "DHPP_BOOSTER", "DEWORMING", "FLEA_TICK", "VET_CLEARANCE", "HEALTH_CERT"],
  CERTIFIED: ["RABIES_BOOSTER", "DHPP_BOOSTER", "DEWORMING", "FLEA_TICK", "VET_EXAM", "HEALTH_CERT", "ANNUAL_RECERT"],
  RETIRED: ["RABIES_BOOSTER", "VET_EXAM", "DEWORMING", "FLEA_TICK"],
};

// ─── ADI Skill Categories ───

export const ADI_SKILL_CATEGORIES = [
  { id: "BASIC_OBEDIENCE", label: "ציות בסיסי" },
  { id: "PUBLIC_ACCESS", label: "גישה לציבור" },
  { id: "TASK_TRAINING", label: "אימון משימה" },
  { id: "SOCIALIZATION", label: "חברות" },
  { id: "DISTRACTION", label: "הסחות" },
  { id: "HANDLER_SKILLS", label: "כישורי מטפל" },
  { id: "SCENT_WORK", label: "עבודת ריח" },
  { id: "RECALL", label: "חזרה לקריאה" },
  { id: "POSITIONING", label: "שינויי מיקום" },
  { id: "OTHER", label: "אחר" },
] as const;

export const ADI_SKILL_MAP: Record<string, string> =
  Object.fromEntries(ADI_SKILL_CATEGORIES.map((s) => [s.id, s.label]));

// ─── Compliance Event Types ───

export const COMPLIANCE_EVENT_TYPES = [
  { id: "PHASE_CHANGED", label: "שינוי שלב", requiresGovReport: true },
  { id: "PLACEMENT_STARTED", label: "שיבוץ התחיל", requiresGovReport: true },
  { id: "PLACEMENT_ENDED", label: "שיבוץ הסתיים", requiresGovReport: true },
  { id: "CERTIFIED", label: "הוסמך", requiresGovReport: true },
  { id: "DECERTIFIED", label: "הסמכה נשללה", requiresGovReport: true },
  { id: "DOG_RETIRED", label: "פרישה", requiresGovReport: true },
  { id: "TRAINING_MILESTONE", label: "אבן דרך באימון", requiresGovReport: false },
  { id: "MEDICAL_ALERT", label: "התראה רפואית", requiresGovReport: false },
] as const;

export const COMPLIANCE_EVENT_MAP: Record<string, { label: string; requiresGovReport: boolean }> =
  Object.fromEntries(COMPLIANCE_EVENT_TYPES.map((e) => [e.id, { label: e.label, requiresGovReport: e.requiresGovReport }]));

export const COMPLIANCE_NOTIFICATION_HOURS = 48;

// ─── Medical Protocol Statuses ───

export const MEDICAL_PROTOCOL_STATUSES = [
  { id: "PENDING", label: "ממתין", color: "bg-slate-100 text-slate-600" },
  { id: "COMPLETED", label: "בוצע", color: "bg-emerald-100 text-emerald-700" },
  { id: "OVERDUE", label: "באיחור", color: "bg-red-100 text-red-600" },
  { id: "WAIVED", label: "ויתור", color: "bg-amber-100 text-amber-700" },
] as const;

// ─── Compliance Notification Statuses ───

export const COMPLIANCE_NOTIFICATION_STATUSES = [
  { id: "PENDING", label: "ממתין לשליחה", color: "bg-red-100 text-red-600" },
  { id: "SENT", label: "נשלח", color: "bg-emerald-100 text-emerald-700" },
  { id: "FAILED", label: "שליחה נכשלה", color: "bg-red-100 text-red-600" },
  { id: "WAIVED", label: "ויתור", color: "bg-amber-100 text-amber-700" },
  { id: "NOT_REQUIRED", label: "לא נדרש", color: "bg-slate-100 text-slate-600" },
] as const;

// ─── TypeScript Interfaces ───

export interface ServiceDogProfileSummary {
  id: string;
  petId: string;
  phase: string;
  serviceType: string | null;
  trainingTotalHours: number;
  trainingTargetHours: number;
  trainingStatus: string;
  isGovReportPending: boolean;
  idCardIsActive: boolean;
  pet: { id: string; name: string; breed: string | null; species: string };
  medicalCompliance: MedicalComplianceStatus;
  activePlacement: { id: string; recipientName: string; status: string } | null;
}

export interface ServiceDogPlacementDetail {
  id: string;
  status: string;
  placementDate: string | null;
  trialStartDate: string | null;
  trialEndDate: string | null;
  notes: string | null;
  serviceDog: { id: string; petName: string; phase: string };
  recipient: { id: string; name: string; phone: string | null; disabilityType: string | null };
}

export interface ADITrainingProgress {
  totalHours: number;
  targetHours: number;
  percentComplete: number;
  monthsElapsed: number;
  targetMonths: number;
  monthsRemaining: number;
  hoursRemaining: number;
  isReadyForCertification: boolean;
}

export interface MedicalComplianceStatus {
  totalProtocols: number;
  completedCount: number;
  pendingCount: number;
  overdueCount: number;
  compliancePercent: number;
  status: "green" | "amber" | "red";
}
