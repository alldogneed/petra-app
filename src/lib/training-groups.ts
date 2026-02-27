// ─── Training Groups: constants, types, and helpers ───

export const GROUP_TYPES = [
  { id: "PUPPY_CLASS", label: "כיתת גורים" },
  { id: "REACTIVITY", label: "תגובתיות" },
  { id: "OBEDIENCE", label: "משמעת" },
  { id: "CUSTOM", label: "מותאם אישית" },
  { id: "WORKSHOP", label: "סדנה" },
] as const;

export const GROUP_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  GROUP_TYPES.map((t) => [t.id, t.label])
);

export const GROUP_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PUPPY_CLASS: { bg: "#FFF7ED", text: "#EA580C", border: "#FDBA74" },
  REACTIVITY: { bg: "#FEF2F2", text: "#DC2626", border: "#FCA5A5" },
  OBEDIENCE: { bg: "#EFF6FF", text: "#2563EB", border: "#93C5FD" },
  CUSTOM: { bg: "#F5F3FF", text: "#7C3AED", border: "#C4B5FD" },
  WORKSHOP: { bg: "#FDF2F8", text: "#DB2777", border: "#F9A8D4" },
};

export const PARTICIPANT_STATUSES = [
  { id: "ACTIVE", label: "פעיל", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { id: "PAUSED", label: "מושהה", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "DROPPED", label: "הפסיק", color: "bg-red-50 text-red-600 border-red-200" },
  { id: "COMPLETED", label: "סיים", color: "bg-blue-50 text-blue-700 border-blue-200" },
] as const;

export const PARTICIPANT_STATUS_MAP: Record<string, { label: string; color: string }> =
  Object.fromEntries(PARTICIPANT_STATUSES.map((s) => [s.id, { label: s.label, color: s.color }]));

export const SESSION_STATUSES = [
  { id: "SCHEDULED", label: "מתוזמן", color: "bg-blue-50 text-blue-700" },
  { id: "COMPLETED", label: "הושלם", color: "bg-emerald-50 text-emerald-700" },
  { id: "CANCELED", label: "בוטל", color: "bg-red-50 text-red-600" },
] as const;

export const SESSION_STATUS_MAP: Record<string, { label: string; color: string }> =
  Object.fromEntries(SESSION_STATUSES.map((s) => [s.id, { label: s.label, color: s.color }]));

export const ATTENDANCE_STATUSES = [
  { id: "PRESENT", label: "נוכח", color: "bg-emerald-100 text-emerald-800", emoji: "✅" },
  { id: "NO_SHOW", label: "לא הגיע", color: "bg-red-100 text-red-700", emoji: "❌" },
  { id: "CANCELED", label: "ביטל", color: "bg-slate-100 text-slate-600", emoji: "🚫" },
  { id: "MAKEUP", label: "השלמה", color: "bg-purple-100 text-purple-700", emoji: "🔄" },
] as const;

export const ATTENDANCE_STATUS_MAP: Record<string, { label: string; color: string; emoji: string }> =
  Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s.id, { label: s.label, color: s.color, emoji: s.emoji }]));

// ─── Reminder templates ───

export const REMINDER_TEMPLATES = {
  GROUP_SESSION_REMINDER_48H: {
    key: "GROUP_SESSION_REMINDER_48H",
    name: "תזכורת מפגש קבוצתי - 48 שעות",
    body: "היי {{customer_name}}, תזכורת למפגש {{group_name}} עם {{dog_name}} בתאריך {{session_datetime}} ב{{location}}. נתראה 🙂",
    variables: ["customer_name", "dog_name", "group_name", "session_datetime", "location"],
  },
  GROUP_SESSION_REMINDER_SAME_DAY: {
    key: "GROUP_SESSION_REMINDER_SAME_DAY",
    name: "תזכורת מפגש קבוצתי - יום המפגש",
    body: "היי {{customer_name}}, תזכורת שהיום בשעה {{session_time}} יש מפגש {{group_name}} עם {{dog_name}} ב{{location}}. נתראה! 🐾",
    variables: ["customer_name", "dog_name", "group_name", "session_time", "location"],
  },
} as const;

// ─── TypeScript interfaces for frontend ───

export interface TrainingGroupSummary {
  id: string;
  name: string;
  groupType: string;
  location: string | null;
  isActive: boolean;
  reminderEnabled: boolean;
  reminderLeadHours: number;
  reminderSameDay: boolean;
  defaultDayOfWeek: number | null;
  defaultTime: string | null;
  maxParticipants: number | null;
  notes: string | null;
  createdAt: string;
  _count: {
    sessions: number;
    participants: number;
  };
  nextSession?: {
    id: string;
    sessionDatetime: string;
    sessionNumber: number | null;
    status: string;
  } | null;
}

export interface TrainingGroupDetail extends TrainingGroupSummary {
  sessions: TrainingGroupSessionItem[];
  participants: TrainingGroupParticipantItem[];
}

export interface TrainingGroupSessionItem {
  id: string;
  sessionDatetime: string;
  sessionNumber: number | null;
  status: string;
  notes: string | null;
  _count: { attendance: number };
}

export interface TrainingGroupParticipantItem {
  id: string;
  status: string;
  joinedAt: string;
  dog: { id: string; name: string; breed: string | null };
  customer: { id: string; name: string; phone: string };
}

export interface AttendanceRecord {
  id: string;
  participantId: string;
  dogId: string;
  customerId: string;
  attendanceStatus: string;
  completed: boolean;
  notes: string | null;
  participant: {
    dog: { id: string; name: string };
    customer: { id: string; name: string };
  };
}
