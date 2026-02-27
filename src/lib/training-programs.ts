// ─── Individual Training Programs: constants, types, and helpers ───

export const PROGRAM_TYPES = [
  { id: "BASIC_OBEDIENCE", label: "משמעת בסיסית" },
  { id: "REACTIVITY", label: "תגובתיות" },
  { id: "PUPPY", label: "גורים" },
  { id: "BEHAVIOR", label: "בעיות התנהגות" },
  { id: "ADVANCED", label: "משמעת מתקדמת" },
  { id: "CUSTOM", label: "מותאם אישית" },
] as const;

export const PROGRAM_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PROGRAM_TYPES.map((t) => [t.id, t.label])
);

export const PROGRAM_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  BASIC_OBEDIENCE: { bg: "#EFF6FF", text: "#2563EB", border: "#93C5FD" },
  REACTIVITY:      { bg: "#FEF2F2", text: "#DC2626", border: "#FCA5A5" },
  PUPPY:           { bg: "#FFF7ED", text: "#EA580C", border: "#FDBA74" },
  BEHAVIOR:        { bg: "#FDF4FF", text: "#A21CAF", border: "#E879F9" },
  ADVANCED:        { bg: "#F0FDF4", text: "#16A34A", border: "#86EFAC" },
  CUSTOM:          { bg: "#F5F3FF", text: "#7C3AED", border: "#C4B5FD" },
};

export const PROGRAM_STATUSES = [
  { id: "ACTIVE", label: "פעיל", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { id: "PAUSED", label: "מושהה", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "COMPLETED", label: "הושלם", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "CANCELED", label: "בוטל", color: "bg-red-50 text-red-600 border-red-200" },
] as const;

export const PROGRAM_STATUS_MAP: Record<string, { label: string; color: string }> =
  Object.fromEntries(PROGRAM_STATUSES.map((s) => [s.id, { label: s.label, color: s.color }]));

export const GOAL_STATUSES = [
  { id: "NOT_STARTED", label: "טרם התחיל", color: "bg-slate-100 text-slate-600" },
  { id: "IN_PROGRESS", label: "בתהליך", color: "bg-blue-100 text-blue-700" },
  { id: "ACHIEVED", label: "הושג", color: "bg-emerald-100 text-emerald-700" },
  { id: "DROPPED", label: "נזנח", color: "bg-red-100 text-red-600" },
] as const;

export const GOAL_STATUS_MAP: Record<string, { label: string; color: string }> =
  Object.fromEntries(GOAL_STATUSES.map((s) => [s.id, { label: s.label, color: s.color }]));

export const SESSION_RATINGS = [
  { value: 1, label: "חלש", emoji: "😔" },
  { value: 2, label: "בינוני-", emoji: "😐" },
  { value: 3, label: "בינוני", emoji: "🙂" },
  { value: 4, label: "טוב", emoji: "😊" },
  { value: 5, label: "מעולה", emoji: "🌟" },
] as const;

// ─── TypeScript interfaces ───

export interface TrainingProgramSummary {
  id: string;
  name: string;
  programType: string;
  status: string;
  startDate: string;
  endDate: string | null;
  totalSessions: number | null;
  notes: string | null;
  createdAt: string;
  dog: { id: string; name: string; breed: string | null; species: string };
  customer: { id: string; name: string; phone: string };
  _count: { goals: number; sessions: number; homework: number };
  completedSessionsCount: number;
  achievedGoalsCount: number;
}

export interface TrainingProgramDetail extends TrainingProgramSummary {
  goals: TrainingGoalItem[];
  sessions: TrainingSessionItem[];
  homework: TrainingHomeworkItem[];
}

export interface TrainingGoalItem {
  id: string;
  title: string;
  description: string | null;
  targetDate: string | null;
  status: string;
  progressPercent: number;
  sortOrder: number;
}

export interface TrainingSessionItem {
  id: string;
  sessionNumber: number | null;
  sessionDate: string;
  durationMinutes: number;
  status: string;
  summary: string | null;
  rating: number | null;
}

export interface TrainingHomeworkItem {
  id: string;
  title: string;
  description: string | null;
  assignedDate: string;
  dueDate: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  customerNotes: string | null;
}
