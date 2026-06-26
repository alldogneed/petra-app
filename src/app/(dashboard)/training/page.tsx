"use client";
import { PageTitle } from "@/components/ui/PageTitle";

import { TierGate } from "@/components/paywall/TierGate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { usePlan } from "@/hooks/usePlan";
import { getMaxTrainingPrograms } from "@/lib/feature-flags";
import {
  GraduationCap,
  Plus,
  X,
  Users,
  Calendar,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  Dog,
  Search,
  Hotel,
  CheckCircle2,
  Send,
  Trash2,
  Package,
  AlertTriangle,
  Settings,
  BookOpen,
  Circle,
  Shield,
  RefreshCw,
  Archive,
  Download,
  XCircle,
  ShoppingCart,
  Home,
  UserCheck,
  Printer,
  Sparkles,
  LayoutGrid,
  LayoutList,
  Pencil,
  Repeat,
} from "lucide-react";
import { cn, formatDate, formatCurrency, toWhatsAppPhone, fetchJSON, escapeHtml } from "@/lib/utils";
import { triggerLimitModal } from "@/lib/limit-reached";
import { toast } from "sonner";
import {
  GROUP_TYPE_LABELS,
  GROUP_TYPE_COLORS,
} from "@/lib/training-groups";
import {
  PROGRAM_TYPE_COLORS,
} from "@/lib/training-programs";
import { DISABILITY_TYPES } from "@/lib/service-dogs";

// ─── Types ───────────────────────────────────────────

interface TrainingGroup {
  id: string;
  name: string;
  groupType: string;
  location: string | null;
  defaultDayOfWeek: number | null;
  defaultTime: string | null;
  maxParticipants: number | null;
  notes: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  participants: Participant[];
  sessions: GroupSession[];
  _count: { participants: number; sessions: number };
}

interface Participant {
  id: string;
  status: string;
  dog: { id: string; name: string; breed: string | null };
  customer: { id: string; name: string; phone: string };
}

interface GroupSession {
  id: string;
  sessionNumber: number | null;
  sessionDatetime: string;
  status: string;
  notes: string | null;
  attendance: { id: string; attendanceStatus: string; participantId: string; participant?: { dog: { name: string }; customer: { name: string } } }[];
}

interface TrainingPackage {
  id: string;
  name: string;
  description: string | null;
  type: string; // HOME | BOARDING | GROUP | WORKSHOP
  sessions: number;
  durationDays: number | null;
  price: number;
  isActive: boolean;
  _count: { programs: number };
}

interface TrainingProgram {
  id: string;
  name: string;
  programType: string;
  status: string;
  startDate: string;
  endDate: string | null;
  totalSessions: number | null;
  location: string | null;
  frequency: string | null;
  price: number | null;
  notes: string | null;
  trainingType: string;
  packageId: string | null;
  isPackage: boolean;
  orderId: string | null;
  priceListItemId: string | null;
  workPlan: string | null;
  behaviorBaseline: string | null;
  customerExpectations: string | null;
  boardingStayId: string | null;
  dog: { id: string; name: string; breed: string | null };
  customer: { id: string; name: string; phone: string } | null;
  goals: { id: string; title: string; status: string; progressPercent: number }[];
  sessions: ProgramSession[];
  homework: { id: string; title: string; isCompleted: boolean }[];
  _count: { goals: number; sessions: number; homework: number };
}

interface ProgramSession {
  id: string;
  sessionNumber: number | null;
  sessionDate: string;
  durationMinutes: number;
  status: string;
  summary: string | null;
  rating: number | null;
  practiceItems: string | null;
  nextSessionGoals: string | null;
  homeworkForCustomer: string | null;
  trainerName: string | null;
}

interface BoardingStay {
  id: string;
  checkIn: string;
  checkOut: string | null;
  status: string;
  notes: string | null;
  pet: { id: string; name: string; species: string; breed: string | null };
  customer: { id: string; name: string };
  room: { id: string; name: string } | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  pets: { id: string; name: string; species: string }[];
}

// ─── Unified dog type for Overview ───

type TrainingType = "individual" | "boarding" | "group" | "workshop";

interface UnifiedDog {
  key: string;
  dogName: string;
  customerName: string;
  customerPhone: string;
  type: TrainingType;
  status: string;
  detail: string;
  progress?: { used: number; total: number };
  entityId: string;
  lastSessionDate?: string;
  daysSinceLastSession?: number;
  sessionsRemaining?: number;
}

// ─── Constants ───────────────────────────────────────

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

type TabId = "overview" | "individual" | "boarding" | "groups" | "archive";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "סקירה", icon: <GraduationCap className="w-4 h-4" /> },
  { id: "individual", label: "אילוף בבית הלקוח", icon: <Dog className="w-4 h-4" /> },
  { id: "boarding", label: "אילוף בתנאי פנסיון", icon: <Hotel className="w-4 h-4" /> },
  { id: "groups", label: "אילוף קבוצתי", icon: <Users className="w-4 h-4" /> },
  { id: "archive", label: "ארכיון", icon: <Archive className="w-4 h-4" /> },
];

// Preset session durations (minutes) — used for all duration selects so the
// user can pick 30 etc. without fighting a number input's min-clamp on keystroke.
const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300, 360, 420, 480];

const TYPE_BADGE: Record<TrainingType, { label: string; bg: string; text: string }> = {
  individual: { label: "אילוף בבית הלקוח", bg: "bg-blue-100", text: "text-blue-700" },
  boarding: { label: "פנסיון", bg: "bg-green-100", text: "text-green-700" },
  group: { label: "קבוצה", bg: "bg-purple-100", text: "text-purple-700" },
  workshop: { label: "סדנה", bg: "bg-pink-100", text: "text-pink-700" },
};

const PROGRAM_TYPES_MAP: Record<string, string> = {
  BASIC_OBEDIENCE: "משמעת בסיסית",
  REACTIVITY: "תגובתיות",
  PUPPY: "גורים",
  BEHAVIOR: "בעיות התנהגות",
  ADVANCED: "משמעת מתקדמת",
  CUSTOM: "מותאם אישית",
  // Service dog phases
  SD_FOUNDATION: "שלב הסתגלות",
  SD_BASIC: "שלב בסיסי",
  SD_ADVANCED: "שלב מתקדם",
  SD_FIELD: "שלב שטח",
  SD_PLACEMENT: "שלב שיבוץ",
};

const SERVICE_DOG_PHASES = [
  { value: "SD_FOUNDATION", label: "הסתגלות" },
  { value: "SD_BASIC", label: "בסיסי" },
  { value: "SD_ADVANCED", label: "מתקדם" },
  { value: "SD_FIELD", label: "שטח" },
  { value: "SD_PLACEMENT", label: "שיבוץ" },
] as const;

const GROUP_TYPES_MAP: Record<string, string> = {
  PUPPY_CLASS: "כיתת גורים",
  REACTIVITY: "תגובתיות",
  OBEDIENCE: "משמעת",
  CUSTOM: "מותאם אישית",
  WORKSHOP: "סדנה",
};

const PROGRAM_STATUS_MAP: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "פעיל", color: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "הושלם", color: "bg-green-100 text-green-700" },
  PAUSED: { label: "מושהה", color: "bg-yellow-100 text-yellow-700" },
  CANCELED: { label: "בוטל", color: "bg-red-100 text-red-700" },
};

// ═══════════════════════════════════════════════════════
// SESSION LOG MODAL
// ═══════════════════════════════════════════════════════

function SessionLogModal({
  dogName,
  sessionNumber,
  isWeekly,
  isServiceDog,
  isPending,
  onClose,
  onSubmit,
  programId,
  goals,
  initialData,
}: {
  dogName: string;
  sessionNumber: number;
  isWeekly?: boolean;
  isServiceDog?: boolean;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (summary: string, sessionDate: string, rating: number | null, practiceItems: string, nextSessionGoals: string, homeworkForCustomer: string, trainerName?: string, durationMinutes?: number) => void;
  programId?: string;
  goals?: { id: string; title: string; status: string; progressPercent: number }[];
  initialData?: { summary: string; sessionDate: string; sessionTime: string; rating: number | null; practiceItems: string; nextSessionGoals: string; homeworkForCustomer: string; trainerName: string; durationMinutes: number };
}) {
  const isEdit = !!initialData;
  const today = new Date().toISOString().slice(0, 10);
  const [summary, setSummary] = useState(initialData?.summary ?? "");
  const [sessionDate, setSessionDate] = useState(initialData?.sessionDate ?? today);
  const [sessionTime, setSessionTime] = useState(initialData?.sessionTime ?? "10:00");
  const [rating, setRating] = useState<number | null>(initialData?.rating ?? null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [practiceItems, setPracticeItems] = useState(initialData?.practiceItems ?? "");
  const [nextSessionGoals, setNextSessionGoals] = useState(initialData?.nextSessionGoals ?? "");
  const [homeworkForCustomer, setHomeworkForCustomer] = useState(initialData?.homeworkForCustomer ?? "");
  const [trainerName, setTrainerName] = useState(initialData?.trainerName ?? "");
  const [durationMinutes, setDurationMinutes] = useState(initialData?.durationMinutes ?? 60);
  const [homeSession, setHomeSession] = useState(false);

  const isSameWeek = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    return d >= startOfWeek && d < endOfWeek;
  };

  const STAR_LABELS = ["חלש", "סביר", "טוב", "מצוין", "מושלם"];

  const L = isWeekly ? {
    title: isEdit ? "עריכת עדכון שבועי" : "עדכון שבועי",
    badge: `שבוע ${sessionNumber}`,
    dateLabel: "תאריך עדכון שבועי",
    ratingLabel: "דירוג התקדמות השבוע (אופציונלי)",
    practiceLabel: "יעדים שהושגו השבוע",
    practicePlaceholder: "אילו יעדים הושגו השבוע...",
    goalsLabel: "יעדים לשבוע הבא",
    goalsPlaceholder: "מה תעבדו בשבוע הבא...",
    homeworkLabel: "הנחיות לבעלים לשבוע הבא",
    homeworkPlaceholder: "תרגול לבית לשבוע הבא...",
    summaryLabel: "סיכום שבועי (אופציונלי)",
    summaryPlaceholder: "תאר את ההתקדמות השבועית, נקודות לשיפור, הצלחות...",
    saveBtn: isEdit ? "שמור שינויים" : "שמור עדכון שבועי",
  } : isServiceDog ? {
    title: isEdit ? "עריכת אימון" : "רישום אימון",
    badge: `אימון מספר ${sessionNumber}`,
    dateLabel: "תאריך האימון",
    ratingLabel: "דירוג הכלב באימון (אופציונלי)",
    practiceLabel: "תרגילים שבוצעו",
    practicePlaceholder: "אילו תרגילים עשיתם היום...",
    goalsLabel: "יעדים לאימון הבא",
    goalsPlaceholder: "מה תעבדו באימון הבא...",
    homeworkLabel: "הערות לצוות",
    homeworkPlaceholder: "הערות רלוונטיות לשאר הצוות...",
    summaryLabel: "סיכום האימון (אופציונלי)",
    summaryPlaceholder: "תאר מה עבדתם היום, התקדמות, הצלחות, נקודות לשיפור...",
    saveBtn: isEdit ? "שמור שינויים" : "שמור אימון",
  } : {
    title: isEdit ? "עריכת מפגש" : "רישום מפגש",
    badge: `מפגש מספר ${sessionNumber}`,
    dateLabel: "תאריך המפגש",
    ratingLabel: "דירוג הכלב במפגש (אופציונלי)",
    practiceLabel: "תרגילים שבוצעו",
    practicePlaceholder: "אילו תרגילים עשיתם היום...",
    goalsLabel: "יעדים לפגישה הבאה",
    goalsPlaceholder: "מה תעבדו בפגישה הבאה...",
    homeworkLabel: "שיעורי בית ללקוח",
    homeworkPlaceholder: "תרגול לבית...",
    summaryLabel: "סיכום המפגש (אופציונלי)",
    summaryPlaceholder: "תאר מה עבדתם היום, התקדמות, הוראות לתרגול בבית...",
    saveBtn: isEdit ? "שמור שינויים" : "שמור מפגש",
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">
            {L.title} — {dogName}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-brand-50 border border-brand-100 text-sm text-brand-700 font-medium">
            {L.badge}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{L.dateLabel}</label>
              <input
                type="date" lang="he"
                className="input"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">שעה</label>
              <input
                type="time"
                className="input"
                value={sessionTime}
                onChange={(e) => setSessionTime(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">משך (דקות)</label>
            <select
              className="input"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
            >
              {(DURATION_OPTIONS.includes(durationMinutes) ? DURATION_OPTIONS : [durationMinutes, ...DURATION_OPTIONS].sort((a, b) => a - b)).map((d) => (
                <option key={d} value={d}>{d} דקות</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{L.ratingLabel}</label>
            <div className="flex items-center gap-1.5 mt-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = (hoverRating ?? rating ?? 0) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    className={cn(
                      "text-2xl transition-transform hover:scale-110",
                      active ? "text-amber-400" : "text-slate-200"
                    )}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => setRating(rating === star ? null : star)}
                  >
                    ★
                  </button>
                );
              })}
              {(hoverRating ?? rating) && (
                <span className="text-xs text-petra-muted mr-1">
                  {STAR_LABELS[(hoverRating ?? rating ?? 1) - 1]}
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{L.practiceLabel}</label>
              <textarea className="input" rows={3} placeholder={L.practicePlaceholder} value={practiceItems} onChange={(e) => setPracticeItems(e.target.value)} />
            </div>
            <div>
              <label className="label">{L.goalsLabel}</label>
              <textarea className="input" rows={3} placeholder={L.goalsPlaceholder} value={nextSessionGoals} onChange={(e) => setNextSessionGoals(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">{L.homeworkLabel}</label>
            <textarea className="input" rows={2} placeholder={L.homeworkPlaceholder} value={homeworkForCustomer} onChange={(e) => setHomeworkForCustomer(e.target.value)} />
          </div>
          {isServiceDog && (
            <div>
              <label className="label">שם המאמן/ת</label>
              <input className="input" placeholder="שם המאמן שביצע את האימון..." value={trainerName} onChange={(e) => setTrainerName(e.target.value)} />
            </div>
          )}
          <div>
            <label className="label">{L.summaryLabel}</label>
            <textarea
              className="input"
              rows={4}
              placeholder={L.summaryPlaceholder}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
          {isWeekly && programId && (
            <div className="rounded-xl border border-green-200 overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 bg-green-50 hover:bg-green-100 transition-colors text-right"
                onClick={() => setHomeSession(!homeSession)}
              >
                <ChevronDown className={cn("w-4 h-4 text-green-600 transition-transform flex-shrink-0", homeSession && "rotate-180")} />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-green-800">מפגשים בבית השבוע</span>
                  <Home className="w-4 h-4 text-green-600" />
                </div>
              </button>
              {homeSession && (
                <div className="px-4 py-3 space-y-2 bg-white">
                  {!isSameWeek(sessionDate) && (
                    <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                      שים לב — התאריך שבחרת אינו בשבוע הנוכחי
                    </p>
                  )}
                  {goals && goals.length > 0 ? (
                    <>
                      <p className="text-[11px] text-petra-muted pb-1">עדכן התקדמות יעדים שהושגו גם בבית</p>
                      {goals.map((goal) => (
                        <GoalProgressRow key={goal.id} goal={goal} programId={programId} />
                      ))}
                    </>
                  ) : (
                    <p className="text-xs text-petra-muted text-center py-4">אין יעדים מוגדרים לתוכנית זו — הגדר יעדים כדי לעדכן כאן</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={isPending || !sessionDate}
            onClick={() => onSubmit(summary, `${sessionDate}T${sessionTime || "10:00"}:00`, rating, practiceItems, nextSessionGoals, homeworkForCustomer, trainerName || undefined, durationMinutes)}
          >
            <CheckCircle2 className="w-4 h-4" />
            {isPending ? "שומר..." : L.saveBtn}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SCHEDULE SESSION MODAL
// ═══════════════════════════════════════════════════════

function ScheduleSessionModal({
  dogName,
  sessionNumber,
  isPending,
  onClose,
  onSubmit,
}: {
  dogName: string;
  sessionNumber: number;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (data: { sessionDate: string; durationMinutes: number; sessionNumber: number; repeat: boolean; occurrences: number; intervalDays: number }) => void;
}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().slice(0, 10);

  const [sessionDate, setSessionDate] = useState(defaultDate);
  const [sessionTime, setSessionTime] = useState("10:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [repeat, setRepeat] = useState(false);
  const [intervalDays, setIntervalDays] = useState(7); // 7 = weekly, 14 = biweekly
  const [occurrences, setOccurrences] = useState(4);

  const isValidDate = sessionDate && new Date(`${sessionDate}T${sessionTime}:00`) > new Date();
  const dayOfWeek = sessionDate ? new Date(`${sessionDate}T00:00:00`).getDay() : 0;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">קבע מפגש — {dogName}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-700 font-medium mb-5">
          מפגש מספר {sessionNumber}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תאריך המפגש</label>
              <input
                type="date"
                lang="he"
                className="input"
                value={sessionDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">שעה</label>
              <input
                type="time"
                className="input"
                value={sessionTime}
                onChange={(e) => setSessionTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">משך (דקות)</label>
            <select
              className="input"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>{d} דקות</option>
              ))}
            </select>
          </div>

          {/* Recurring sessions */}
          <div className="rounded-xl border border-slate-200 p-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 accent-brand-500"
                checked={repeat}
                onChange={(e) => setRepeat(e.target.checked)}
              />
              <span className="text-sm font-medium text-petra-text">מפגש חוזר (קביעה מראש לכמה שבועות)</span>
            </label>

            {repeat && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">תדירות</label>
                    <select
                      className="input"
                      value={intervalDays}
                      onChange={(e) => setIntervalDays(parseInt(e.target.value))}
                    >
                      <option value={7}>כל שבוע</option>
                      <option value={14}>כל שבועיים</option>
                      <option value={21}>כל 3 שבועות</option>
                      <option value={28}>כל 4 שבועות</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">מספר מפגשים</label>
                    <select
                      className="input"
                      value={occurrences}
                      onChange={(e) => setOccurrences(parseInt(e.target.value))}
                    >
                      {[2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-brand-600 bg-brand-50 rounded-lg p-2">
                  ייקבעו {occurrences} מפגשים — כל יום {DAY_NAMES[dayOfWeek]} בשעה {sessionTime}
                  {intervalDays > 7 ? ` (אחת ל-${intervalDays / 7} שבועות)` : ""}.
                </p>
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-emerald-600" />
            <span>תזכורת ווצאפ תישלח ללקוח אוטומטית לפני המפגש (אם תזכורות ווצאפ מופעלות)</span>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={isPending || !isValidDate}
            onClick={() => onSubmit({ sessionDate: `${sessionDate}T${sessionTime}:00`, durationMinutes, sessionNumber, repeat, occurrences, intervalDays })}
          >
            <Calendar className="w-4 h-4" />
            {isPending ? "קובע..." : repeat ? `קבע ${occurrences} מפגשים` : "קבע מפגש"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════

function TrainingPageContent() {
  const { isFree, tier } = usePlan();
  const maxTrainingPrograms = getMaxTrainingPrograms(tier);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [individualSubTab, setIndividualSubTab] = useState<"private" | "package" | "boarding-alt">("private");
  const [groupSubTab, setGroupSubTab] = useState<"groups" | "workshops">("groups");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSellPackage, setShowSellPackage] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showNewWorkshop, setShowNewWorkshop] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TrainingGroup | null>(null);
  const [showAssignDog, setShowAssignDog] = useState<{ groupId: string; groupName: string } | null>(null);
  const [editingProgram, setEditingProgram] = useState<TrainingProgram | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [sessionLogTarget, setSessionLogTarget] = useState<{ programId: string; sessionNumber: number; dogName: string; customerPhone?: string; customerName?: string; isWeekly?: boolean; isServiceDog?: boolean; goals?: { id: string; title: string; status: string; progressPercent: number }[] } | null>(null);
  const [editSessionTarget, setEditSessionTarget] = useState<{ programId: string; sessionId: string; sessionNumber: number; dogName: string; isWeekly?: boolean; isServiceDog?: boolean; initialData: { summary: string; sessionDate: string; sessionTime: string; rating: number | null; practiceItems: string; nextSessionGoals: string; homeworkForCustomer: string; trainerName: string; durationMinutes: number } } | null>(null);
  const [sessionSummarySend, setSessionSummarySend] = useState<{ customerPhone: string; customerName: string; dogName: string; sessionNumber: number; practiceItems?: string; homeworkForCustomer?: string; nextSessionGoals?: string; rating?: number | null } | null>(null);
  const [showCreatePackage, setShowCreatePackage] = useState(false);
  const [editingPackage, setEditingPackage] = useState<TrainingPackage | null>(null);
  const [showBoardingTraining, setShowBoardingTraining] = useState<{ stay: BoardingStay } | null>(null);
  const [showAddServiceDog, setShowAddServiceDog] = useState(false);
  const [showAddRecipient, setShowAddRecipient] = useState(false);
  const [showCreateServiceDogProgram, setShowCreateServiceDogProgram] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [dropoutTarget, setDropoutTarget] = useState<{ programId: string; dogName: string } | null>(null);
  const [finishTarget, setFinishTarget] = useState<{ programId: string; dogName: string } | null>(null);
  const [convertToGroupTarget, setConvertToGroupTarget] = useState<TrainingProgram | null>(null);
  const [deleteProgramTarget, setDeleteProgramTarget] = useState<TrainingProgram | null>(null);
  const [convertParticipantTarget, setConvertParticipantTarget] = useState<{ groupId: string; participantId: string; dogName: string } | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<{ groupId: string; groupName: string; isWorkshop: boolean } | null>(null);
  const [scheduleSessionTarget, setScheduleSessionTarget] = useState<{
    programId: string; sessionNumber: number; dogName: string;
    customerId?: string; customerName?: string; customerPhone?: string;
  } | null>(null);
  const queryClient = useQueryClient();


  // Auto-refresh every 30 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      queryClient.invalidateQueries({ queryKey: ["training-groups"] });
    }, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, queryClient]);

  // ─── Data fetching ───

  const { data: programs = [], isLoading: programsLoading, isError: programsError, isFetching: programsFetching, refetch: refetchPrograms } = useQuery<TrainingProgram[]>({
    queryKey: ["training-programs"],
    queryFn: () => fetchJSON<TrainingProgram[]>("/api/training-programs?status=ACTIVE,PAUSED"),
  });

  const { data: groups = [], isLoading: groupsLoading, isError: groupsError } = useQuery<TrainingGroup[]>({
    queryKey: ["training-groups"],
    queryFn: () => fetchJSON<TrainingGroup[]>("/api/training-groups?active=true"),
  });

  const { data: stays = [], isLoading: staysLoading, isError: staysError } = useQuery<BoardingStay[]>({
    queryKey: ["boarding-stays"],
    queryFn: () => fetchJSON<BoardingStay[]>("/api/boarding"),
  });

  const { data: packagesData, refetch: refetchPackages } = useQuery<{ packages: TrainingPackage[] }>({
    queryKey: ["training-packages"],
    queryFn: () => fetchJSON<{ packages: TrainingPackage[] }>("/api/training-packages?includeInactive=true"),
  });
  const packages = packagesData?.packages ?? [];

  const { data: boardingPrograms = [] } = useQuery<TrainingProgram[]>({
    queryKey: ["training-programs-boarding"],
    queryFn: () => fetchJSON<TrainingProgram[]>("/api/training-programs?trainingType=BOARDING&status=ACTIVE,PAUSED"),
  });

  const { data: serviceDogPrograms = [] } = useQuery<TrainingProgram[]>({
    queryKey: ["training-programs-service"],
    queryFn: () => fetchJSON<TrainingProgram[]>("/api/training-programs?trainingType=SERVICE_DOG&status=ACTIVE,PAUSED"),
  });

  const { data: archivedPrograms = [], isLoading: archiveLoading } = useQuery<TrainingProgram[]>({
    queryKey: ["training-programs-archive"],
    queryFn: () => fetchJSON<TrainingProgram[]>("/api/training-programs?status=COMPLETED,CANCELED"),
    enabled: activeTab === "archive",
  });

  const isLoading = programsLoading || groupsLoading || staysLoading;
  const isError = programsError || groupsError || staysError;

  // ─── Derived data ───

  const regularGroups = useMemo(() => groups.filter((g) => g.groupType !== "WORKSHOP"), [groups]);
  const workshops = useMemo(() => groups.filter((g) => g.groupType === "WORKSHOP"), [groups]);
  const activeStays = useMemo(() => {
    const now = new Date();
    return stays.filter((s) => {
      if (s.status === "checked_in") return true;
      const checkInDate = new Date(s.checkIn);
      const checkOutDate = s.checkOut ? new Date(s.checkOut) : null;
      return checkInDate <= now && (!checkOutDate || checkOutDate >= now);
    });
  }, [stays]);

  const allDogs = useMemo<UnifiedDog[]>(() => {
    const dogs: UnifiedDog[] = [];

    // Individual programs
    programs.forEach((p) => {
      const usedSessions = p.sessions.filter((s) => s.status === "COMPLETED").length;
      const sortedSessions = [...p.sessions].sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
      const lastSession = sortedSessions[0];
      const daysSince = lastSession
        ? Math.floor((Date.now() - new Date(lastSession.sessionDate).getTime()) / 86400000)
        : undefined;
      const remaining = p.totalSessions ? p.totalSessions - usedSessions : undefined;
      dogs.push({
        key: `program-${p.id}`,
        dogName: p.dog.name,
        customerName: p.customer?.name ?? "",
        customerPhone: p.customer?.phone ?? "",
        type: "individual",
        status: p.status,
        detail: PROGRAM_TYPES_MAP[p.programType] || p.programType,
        progress: p.totalSessions ? { used: usedSessions, total: p.totalSessions } : undefined,
        entityId: p.id,
        lastSessionDate: lastSession?.sessionDate,
        daysSinceLastSession: daysSince,
        sessionsRemaining: remaining,
      });
    });

    // Boarding stays
    activeStays.forEach((s) => {
      const daysLeft = s.checkOut
        ? Math.ceil((new Date(s.checkOut).getTime() - Date.now()) / 86400000)
        : null;
      dogs.push({
        key: `boarding-${s.id}`,
        dogName: s.pet.name,
        customerName: s.customer.name,
        customerPhone: "",
        type: "boarding",
        status: "checked_in",
        detail: daysLeft !== null ? `${Math.max(0, daysLeft)} ימים נותרו` : "ללא תאריך יציאה",
        entityId: s.id,
      });
    });

    // Regular groups
    regularGroups.forEach((g) => {
      g.participants.forEach((p) => {
        dogs.push({
          key: `group-${g.id}-${p.id}`,
          dogName: p.dog.name,
          customerName: p.customer?.name ?? "",
          customerPhone: p.customer?.phone ?? "",
          type: "group",
          status: p.status,
          detail: g.name,
          entityId: g.id,
        });
      });
    });

    // Workshops
    workshops.forEach((g) => {
      g.participants.forEach((p) => {
        dogs.push({
          key: `workshop-${g.id}-${p.id}`,
          dogName: p.dog.name,
          customerName: p.customer?.name ?? "",
          customerPhone: p.customer?.phone ?? "",
          type: "workshop",
          status: p.status,
          detail: g.name,
          entityId: g.id,
        });
      });
    });

    return dogs;
  }, [programs, activeStays, regularGroups, workshops]);

  const filteredDogs = useMemo(() => {
    if (!searchQuery.trim()) return allDogs;
    const q = searchQuery.toLowerCase();
    return allDogs.filter(
      (d) =>
        d.dogName.toLowerCase().includes(q) ||
        d.customerName.toLowerCase().includes(q)
    );
  }, [allDogs, searchQuery]);

  // ─── Mutations ───

  const markAttendanceMutation = useMutation({
    mutationFn: async ({ programId, sessionNumber, summary, sessionDate, rating, practiceItems, nextSessionGoals, homeworkForCustomer, trainerName, durationMinutes, customerPhone: _cp, customerName: _cn, dogName: _dn }: { programId: string; sessionNumber: number; summary?: string; sessionDate?: string; rating?: number | null; practiceItems?: string; nextSessionGoals?: string; homeworkForCustomer?: string; trainerName?: string; durationMinutes?: number; customerPhone?: string; customerName?: string; dogName?: string }) => {
      const res = await fetch(`/api/training-programs/${programId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionDate: sessionDate ? new Date(sessionDate).toISOString() : new Date().toISOString(),
          status: "COMPLETED",
          sessionNumber,
          durationMinutes: durationMinutes ?? 60,
          ...(summary ? { summary } : {}),
          ...(rating != null ? { rating } : {}),
          ...(practiceItems ? { practiceItems } : {}),
          ...(nextSessionGoals ? { nextSessionGoals } : {}),
          ...(homeworkForCustomer ? { homeworkForCustomer } : {}),
          ...(trainerName ? { trainerName } : {}),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      queryClient.invalidateQueries({ queryKey: ["training-programs-boarding"] });
      queryClient.invalidateQueries({ queryKey: ["training-programs-service"] });
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
      queryClient.invalidateQueries({ queryKey: ["training-program-sessions-cal"] });
      if (variables.customerPhone) {
        setSessionSummarySend({
          customerPhone: variables.customerPhone,
          customerName: variables.customerName || "",
          dogName: variables.dogName || "",
          sessionNumber: variables.sessionNumber,
          practiceItems: variables.practiceItems,
          homeworkForCustomer: variables.homeworkForCustomer,
          nextSessionGoals: variables.nextSessionGoals,
          rating: variables.rating,
        });
      } else {
        toast.success("מפגש נרשם בהצלחה");
      }
      setSessionLogTarget(null);
    },
    onError: () => { setSessionLogTarget(null); toast.error("שגיאה בשמירת המפגש. נסה שוב."); },
  });

  const editSessionMutation = useMutation({
    mutationFn: async ({ programId, sessionId, summary, sessionDate, rating, practiceItems, nextSessionGoals, homeworkForCustomer, trainerName, durationMinutes }: { programId: string; sessionId: string; summary: string; sessionDate: string; rating: number | null; practiceItems: string; nextSessionGoals: string; homeworkForCustomer: string; trainerName?: string; durationMinutes?: number }) => {
      const res = await fetch(`/api/training-programs/${programId}/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionDate: new Date(sessionDate).toISOString(), durationMinutes: durationMinutes ?? 60, summary: summary || null, rating, practiceItems: practiceItems || null, nextSessionGoals: nextSessionGoals || null, homeworkForCustomer: homeworkForCustomer || null, trainerName: trainerName || null }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      queryClient.invalidateQueries({ queryKey: ["training-programs-boarding"] });
      queryClient.invalidateQueries({ queryKey: ["training-programs-service"] });
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
      queryClient.invalidateQueries({ queryKey: ["training-program-sessions-cal"] });
      setEditSessionTarget(null);
      toast.success("המפגש עודכן");
    },
    onError: () => toast.error("שגיאה בעדכון המפגש"),
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/training-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const e = new Error(err.error || "Failed");
        (e as unknown as Record<string, unknown>).code = err.code;
        throw e;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-groups"] });
      setShowNewGroup(false);
      setShowNewWorkshop(false);
      toast.success("הקבוצה נוצרה בהצלחה");
    },
    onError: (err: Error) => {
      if ((err as unknown as Record<string, unknown>).code === "LIMIT_REACHED") {
        triggerLimitModal(err.message);
      } else {
        toast.error(err.message || "שגיאה ביצירת הקבוצה. נסה שוב.");
      }
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      fetchJSON(`/api/training-groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-groups"] });
      setEditingGroup(null);
      toast.success("השינויים נשמרו בהצלחה");
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה בעדכון הקבוצה. נסה שוב."),
  });

  const addParticipantMutation = useMutation({
    mutationFn: async ({ groupId, customerId, dogId }: { groupId: string; customerId: string; dogId: string }) => {
      const res = await fetch(`/api/training-groups/${groupId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, dogId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-groups"] });
      setShowAssignDog(null);
      toast.success("הכלב נוסף לקבוצה");
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה בהוספת כלב לקבוצה"),
  });

  const removeParticipantMutation = useMutation({
    mutationFn: async ({ groupId, participantId }: { groupId: string; participantId: string }) => {
      const res = await fetch(`/api/training-groups/${groupId}/participants`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-groups"] });
      toast.success("הכלב הוסר מהקבוצה");
    },
    onError: () => toast.error("שגיאה בהסרת הכלב מהקבוצה"),
  });

  // Invalidate every training-related query (programs across sub-tabs + groups + calendars)
  const invalidateAllTraining = () => {
    [
      "training-programs", "training-programs-boarding", "training-programs-service",
      "training-programs-archive", "training-groups",
      "training-program-sessions-cal", "training-group-sessions-cal",
    ].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  };

  // Convert individual program → group participation
  const convertToGroupMutation = useMutation({
    mutationFn: async ({ programId, trainingGroupId, orderAction }: { programId: string; trainingGroupId: string; orderAction: string }) => {
      const res = await fetch(`/api/training-programs/${programId}/convert-to-group`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingGroupId, orderAction }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      invalidateAllTraining();
      setConvertToGroupTarget(null);
      toast.success("התהליך הומר לאילוף קבוצתי");
      if (data?.orderDowngraded) toast.warning("ההזמנה בוטלה במקום להימחק (הזמנה ששולמה/הופקה לא ניתנת למחיקה)");
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בהמרה לקבוצה"),
  });

  // Delete individual program (+ chosen order action). Handles owner-confirm + manager approval.
  const deleteProgramMutation = useMutation({
    mutationFn: async ({ programId, orderAction }: { programId: string; orderAction: string }) => {
      const res = await fetch(`/api/training-programs/${programId}?orderAction=${orderAction}`, {
        method: "DELETE",
        headers: { "x-confirm-action": `DELETE_TRAINING_${programId}` },
      });
      if (res.status === 202) return { pendingApproval: true };
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      invalidateAllTraining();
      setDeleteProgramTarget(null);
      if (data?.pendingApproval) { toast.success("בקשת המחיקה נשלחה לאישור הבעלים"); return; }
      toast.success("תהליך האילוף נמחק");
      if (data?.orderDowngraded) toast.warning("ההזמנה בוטלה במקום להימחק (הזמנה ששולמה/הופקה לא ניתנת למחיקה)");
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה במחיקת התהליך"),
  });

  // Convert group participant → individual program
  const convertParticipantMutation = useMutation({
    mutationFn: async ({ groupId, participantId }: { groupId: string; participantId: string }) => {
      const res = await fetch(`/api/training-groups/${groupId}/participants/${participantId}/convert-to-individual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      invalidateAllTraining();
      setConvertParticipantTarget(null);
      toast.success("הכלב הומר לאילוף פרטני");
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בהמרה לפרטני"),
  });

  // Delete a whole group / workshop
  const deleteGroupMutation = useMutation({
    mutationFn: async ({ groupId }: { groupId: string }) => {
      const res = await fetch(`/api/training-groups/${groupId}`, { method: "DELETE" });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      invalidateAllTraining();
      setDeleteGroupTarget(null);
      toast.success("הקבוצה נמחקה");
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה במחיקת הקבוצה"),
  });

  const createProgramMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/training-programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const e = new Error(err.error || "Failed");
        (e as unknown as Record<string, unknown>).code = err.code;
        throw e;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      setShowSellPackage(false);
      setShowManualAdd(false);
      toast.success("תוכנית אילוף נוצרה בהצלחה");
    },
    onError: (err: Error) => {
      if ((err as unknown as Record<string, unknown>).code === "LIMIT_REACHED") {
        triggerLimitModal(err.message);
      } else {
        toast.error(err.message || "שגיאה ביצירת תוכנית אימון. נסה שוב.");
      }
    },
  });

  const createPackageMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/training-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-packages"] });
      setShowCreatePackage(false);
      toast.success("חבילה נוצרה בהצלחה");
    },
    onError: () => toast.error("שגיאה ביצירת חבילה"),
  });

  const updatePackageMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/training-packages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-packages"] });
      setEditingPackage(null);
      toast.success("חבילה עודכנה");
    },
    onError: () => toast.error("שגיאה בעדכון חבילה"),
  });

  const deletePackageMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/training-packages/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-packages"] });
      toast.success("חבילה נמחקה");
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה במחיקת חבילה"),
  });

  const createBoardingTrainingMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const homeFollowupSessions = (data.homeFollowupSessions as number) || 0;
      const { homeFollowupSessions: _hfs, ...boardingData } = data;
      const res = await fetch("/api/training-programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(boardingData),
      });
      if (!res.ok) throw new Error("Failed");
      const boardingProgram = await res.json();
      if (homeFollowupSessions > 0) {
        await fetch("/api/training-programs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dogId: boardingData.dogId,
            customerId: boardingData.customerId,
            trainingType: "HOME",
            name: `מפגשי המשך — ${boardingProgram.dog?.name || ""}`,
            programType: "CUSTOM",
            startDate: boardingData.endDate || new Date().toISOString(),
            totalSessions: homeFollowupSessions,
            notes: "מפגשי המשך לאחר אילוף פנסיון",
          }),
        }).catch(console.error);
      }
      return boardingProgram;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      queryClient.invalidateQueries({ queryKey: ["training-programs-boarding"] });
      setShowBoardingTraining(null);
      toast.success("תוכנית אילוף נוצרה בהצלחה");
    },
    onError: () => toast.error("שגיאה ביצירת תוכנית אילוף"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes, endDate }: { id: string; status: string; notes?: string; endDate?: string }) => {
      const res = await fetch(`/api/training-programs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(notes !== undefined && { notes }),
          endDate: endDate ?? new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      queryClient.invalidateQueries({ queryKey: ["training-programs-boarding"] });
      queryClient.invalidateQueries({ queryKey: ["training-programs-service"] });
      queryClient.invalidateQueries({ queryKey: ["training-programs-archive"] });
      setDropoutTarget(null);
      setFinishTarget(null);
      toast.success(variables.status === "COMPLETED" ? "אילוף הסתיים ✓" : "כלב עבר לארכיון");
    },
    onError: () => toast.error("שגיאה בעדכון סטטוס"),
  });

  const updateProgramSettingsMutation = useMutation({
    mutationFn: async ({
      id,
      programType,
      startDate,
      endDate,
      location,
      frequency,
      totalSessions,
    }: {
      id: string;
      programType: string;
      startDate: string;
      endDate: string | null;
      location: string | null;
      frequency: string | null;
      totalSessions: number | null;
    }) => {
      const res = await fetch(`/api/training-programs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programType, startDate, endDate, location, frequency, totalSessions }),
      });
      if (!res.ok) throw new Error("Failed to update program settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      setEditingProgram(null);
      toast.success("הגדרות התוכנית עודכנו");
    },
    onError: () => { setEditingProgram(null); toast.error("שגיאה בעדכון הגדרות התוכנית. נסה שוב."); },
  });

  const scheduleSessionMutation = useMutation({
    mutationFn: async ({ programId, sessionNumber, sessionDate, durationMinutes, repeat, occurrences, intervalDays }: {
      programId: string; sessionNumber: number; sessionDate: string; durationMinutes: number;
      repeat?: boolean; occurrences?: number; intervalDays?: number;
    }) => {
      // Recurring series → use the generate endpoint
      if (repeat && (occurrences ?? 1) > 1) {
        const res = await fetch(`/api/training-programs/${programId}/sessions/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: new Date(sessionDate).toISOString(),
            count: occurrences,
            durationMinutes,
            intervalDays: intervalDays ?? 7,
          }),
        });
        if (!res.ok) throw new Error("Failed");
        return res.json() as Promise<{ created: number }>;
      }
      // Single session
      const res = await fetch(`/api/training-programs/${programId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionDate: new Date(sessionDate).toISOString(),
          status: "SCHEDULED",
          sessionNumber,
          durationMinutes,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data: { created?: number } | unknown) => {
      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      queryClient.invalidateQueries({ queryKey: ["training-programs-boarding"] });
      // Force the calendar overlays to refetch so the new session shows up there
      queryClient.invalidateQueries({ queryKey: ["training-program-sessions-cal"] });
      queryClient.invalidateQueries({ queryKey: ["training-group-sessions-cal"] });
      setScheduleSessionTarget(null);
      const created = (data as { created?: number })?.created;
      toast.success(created && created > 1
        ? `${created} מפגשים נקבעו ליומן ✓ — תזכורות ווצאפ יישלחו אוטומטית`
        : "מפגש נוסף ליומן ✓ — תזכורת ווצאפ תישלח ללקוח אוטומטית");
    },
    onError: () => toast.error("שגיאה בקביעת מפגש"),
  });

  const cancelScheduledSessionMutation = useMutation({
    mutationFn: async ({ programId, sessionId }: { programId: string; sessionId: string }) => {
      const res = await fetch(`/api/training-programs/${programId}/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      queryClient.invalidateQueries({ queryKey: ["training-programs-boarding"] });
      queryClient.invalidateQueries({ queryKey: ["training-program-sessions-cal"] });
      queryClient.invalidateQueries({ queryKey: ["training-group-sessions-cal"] });
      toast.success("מפגש מתוזמן בוטל");
    },
    onError: () => toast.error("שגיאה בביטול מפגש"),
  });

  // ─── Helpers ───

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Switch to the right tab, expand a specific card and scroll to it.
  const focusCard = useCallback((opts: {
    tab: TabId;
    subTab?: "private" | "package" | "boarding-alt";
    groupSubTab?: "groups" | "workshops";
    expandId?: string;
  }) => {
    setActiveTab(opts.tab);
    if (opts.subTab) setIndividualSubTab(opts.subTab);
    if (opts.groupSubTab) setGroupSubTab(opts.groupSubTab);
    if (opts.expandId) {
      const id = opts.expandId;
      setExpandedCards((prev) => new Set(prev).add(id));
      setTimeout(() => {
        document.getElementById(`tcard-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 250);
    }
  }, []);

  // Jump directly to a dog's process from the overview table/cards.
  const focusDog = useCallback((dog: UnifiedDog) => {
    if (dog.type === "individual") {
      const prog = programs.find((p) => p.id === dog.entityId);
      focusCard({ tab: "individual", subTab: prog?.isPackage ? "package" : "private", expandId: dog.entityId });
    } else if (dog.type === "boarding") {
      // overview boarding rows are boarding stays — just open the boarding tab
      focusCard({ tab: "boarding" });
    } else if (dog.type === "workshop") {
      focusCard({ tab: "groups", groupSubTab: "workshops", expandId: dog.entityId });
    } else {
      focusCard({ tab: "groups", groupSubTab: "groups", expandId: dog.entityId });
    }
  }, [programs, focusCard]);

  // Deep-link from a customer/pet card: /training?program=<id> or ?group=<id>
  const deepLinkConsumed = useRef(false);
  useEffect(() => {
    if (deepLinkConsumed.current) return;
    const params = new URLSearchParams(window.location.search);
    const programId = params.get("program");
    const groupId = params.get("group");
    if (programId) {
      if (programs.some((p) => p.id === programId)) {
        focusCard({ tab: "individual", subTab: programs.find((p) => p.id === programId)?.isPackage ? "package" : "private", expandId: programId });
        deepLinkConsumed.current = true;
      } else if (boardingPrograms.some((p) => p.id === programId)) {
        focusCard({ tab: "boarding", expandId: programId });
        deepLinkConsumed.current = true;
      }
    } else if (groupId && groups.length) {
      focusCard({ tab: "groups", groupSubTab: workshops.some((g) => g.id === groupId) ? "workshops" : "groups", expandId: groupId });
      deepLinkConsumed.current = true;
    }
  }, [programs, boardingPrograms, groups, workshops, focusCard]);

  const activePrograms = programs.filter((p) => p.status === "ACTIVE");

  // ─── Stats ───

  const stats = [
    { label: "כלבים באימון", value: allDogs.length, color: "bg-orange-50 text-orange-600", iconBg: "bg-orange-100" },
    { label: "אימון אישי", value: activePrograms.length, color: "bg-blue-50 text-blue-600", iconBg: "bg-blue-100" },
    { label: "אימון בפנסיון", value: activeStays.length, color: "bg-green-50 text-green-600", iconBg: "bg-green-100" },
    { label: "קבוצות וסדנאות", value: regularGroups.length + workshops.length, color: "bg-purple-50 text-purple-600", iconBg: "bg-purple-100" },
  ];

  const statIcons = [
    <Dog key="dog" className="w-5 h-5" />,
    <GraduationCap key="grad" className="w-5 h-5" />,
    <Hotel key="hotel" className="w-5 h-5" />,
    <Users key="users" className="w-5 h-5" />,
  ];

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-brand-500" />
        </div>
        <h1 className="page-title">אימונים וניהול כלבים</h1>

        {/* Refresh controls */}
        <div className="flex items-center gap-2 ms-auto">
          <button
            onClick={() => setShowManualAdd(true)}
            className="btn-primary text-sm"
            title="הוסף תהליך אילוף ידני ללא הזמנה"
          >
            <Plus className="w-4 h-4" />
            הוסף תהליך ידני
          </button>
          <button
            onClick={() => refetchPrograms()}
            disabled={programsFetching}
            title="רענן עכשיו"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-petra-muted hover:text-petra-text transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", programsFetching && "animate-spin")} />
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? "כבה אוטו-רענון" : "הפעל אוטו-רענון (30 שנ׳)"}
            className={cn(
              "flex items-center gap-1.5 px-3 h-8 rounded-lg border text-xs font-medium transition-all",
              autoRefresh
                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                : "bg-white border-slate-200 text-petra-muted hover:text-petra-text"
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
            {autoRefresh ? "רענון אוטו פעיל" : "אוטו-רענון"}
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map((stat, i) => (
          <div key={stat.label} className={cn("card p-4 flex items-center gap-3", stat.color)}>
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", stat.iconBg)}>
              {statIcons[i]}
            </div>
            <div>
              <p className="text-2xl font-bold">{isLoading ? "..." : stat.value}</p>
              <p className="text-xs opacity-75">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Free tier training limit banner */}
      {isFree && maxTrainingPrograms !== null && (
        <div className={`flex items-center justify-between gap-3 mb-4 px-4 py-3 rounded-xl border ${
          programs.length >= maxTrainingPrograms
            ? "bg-amber-50 border-amber-200"
            : "bg-slate-50 border-slate-200"
        }`}>
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className={`w-4 h-4 flex-shrink-0 ${programs.length >= maxTrainingPrograms ? "text-amber-500" : "text-slate-400"}`} />
            <span className={programs.length >= maxTrainingPrograms ? "text-amber-800" : "text-slate-600"}>
              {programs.length}/{maxTrainingPrograms} תהליכי אילוף — מגבלת המנוי החינמי
            </span>
          </div>
          {programs.length >= maxTrainingPrograms && (
            <a href="/upgrade" className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap">
              שדרג לבייסיק ←
            </a>
          )}
        </div>
      )}

      {/* Global Search */}
      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted" />
        <input
          className="input pr-10 w-full"
          placeholder="חיפוש לפי שם כלב או בעלים..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === tab.id
                ? "bg-brand-500 text-white"
                : "bg-slate-100 text-petra-muted hover:bg-slate-200"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading / Error */}
      {isError ? (
        <div className="card p-8 text-center">
          <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-400" />
          <p className="text-red-600 font-medium mb-2">שגיאה בטעינת נתוני אילוף</p>
          <button className="btn-secondary text-sm" onClick={() => refetchPrograms()}>נסה שוב</button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse h-24" />
          ))}
        </div>
      ) : (
        <>
          {/* ═══ OVERVIEW TAB ═══ */}
          {activeTab === "overview" && (
            <OverviewTab
              dogs={filteredDogs}
              onFocus={focusDog}
            />
          )}

          {/* ═══ INDIVIDUAL TAB ═══ */}
          {activeTab === "individual" && (
            <div>
              {/* Sub-tabs */}
              <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 overflow-x-auto scrollbar-hide">
                {[
                  { id: "private" as const, label: "אילוף פרטני" },
                  { id: "package" as const, label: "חבילת אילוף" },
                  // { id: "boarding-alt" as const, label: "חלופות פנסיון בבית הלקוח" }, // hidden — future feature
                ].map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setIndividualSubTab(sub.id)}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                      individualSubTab === sub.id
                        ? "bg-white shadow-sm text-petra-text"
                        : "text-petra-muted hover:bg-white/60"
                    )}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              {/* אילוף פרטני */}
              {individualSubTab === "private" && (
                <IndividualTab
                  programs={programs.filter((p) => !p.isPackage && !p.boardingStayId)}
                  groups={groups}
                  searchQuery={searchQuery}
                  expandedCards={expandedCards}
                  toggleExpand={toggleExpand}
                  onMarkAttendance={(programId, sessionNumber, dogName, customerPhone, customerName) =>
                    setSessionLogTarget({ programId, sessionNumber, dogName, customerPhone, customerName })
                  }
                  onScheduleSession={(programId, sessionNumber, dogName, customerId, customerName, customerPhone) =>
                    setScheduleSessionTarget({ programId, sessionNumber, dogName, customerId, customerName, customerPhone })
                  }
                  onCancelSession={(programId, sessionId) =>
                    cancelScheduledSessionMutation.mutate({ programId, sessionId })
                  }
                  onEditSession={(programId, session, dogName) => {
                    const d = new Date(session.sessionDate);
                    const pad = (n: number) => String(n).padStart(2, "0");
                    setEditSessionTarget({ programId, sessionId: session.id, sessionNumber: session.sessionNumber ?? 1, dogName, initialData: { summary: session.summary ?? "", sessionDate: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`, sessionTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`, rating: session.rating, practiceItems: session.practiceItems ?? "", nextSessionGoals: session.nextSessionGoals ?? "", homeworkForCustomer: session.homeworkForCustomer ?? "", trainerName: session.trainerName ?? "", durationMinutes: session.durationMinutes } });
                  }}
                  onEditSettings={(program) => setEditingProgram(program)}
                  onConvertToGroup={(program) => setConvertToGroupTarget(program)}
                  onDeleteProgram={(program) => setDeleteProgramTarget(program)}
                  isMarkingAttendance={markAttendanceMutation.isPending}
                  onFinishProgram={(id, dogName) => setFinishTarget({ programId: id, dogName })}
                  onDropoutProgram={(id, dogName) => setDropoutTarget({ programId: id, dogName })}
                  isUpdatingStatus={updateStatusMutation.isPending}
                />
              )}

              {/* חבילת אילוף */}
              {individualSubTab === "package" && (
                <IndividualTab
                  programs={programs.filter((p) => p.isPackage)}
                  searchQuery={searchQuery}
                  expandedCards={expandedCards}
                  toggleExpand={toggleExpand}
                  onMarkAttendance={(programId, sessionNumber, dogName, customerPhone, customerName) =>
                    setSessionLogTarget({ programId, sessionNumber, dogName, customerPhone, customerName })
                  }
                  onScheduleSession={(programId, sessionNumber, dogName, customerId, customerName, customerPhone) =>
                    setScheduleSessionTarget({ programId, sessionNumber, dogName, customerId, customerName, customerPhone })
                  }
                  onCancelSession={(programId, sessionId) =>
                    cancelScheduledSessionMutation.mutate({ programId, sessionId })
                  }
                  onEditSession={(programId, session, dogName) => {
                    const d = new Date(session.sessionDate);
                    const pad = (n: number) => String(n).padStart(2, "0");
                    setEditSessionTarget({ programId, sessionId: session.id, sessionNumber: session.sessionNumber ?? 1, dogName, initialData: { summary: session.summary ?? "", sessionDate: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`, sessionTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`, rating: session.rating, practiceItems: session.practiceItems ?? "", nextSessionGoals: session.nextSessionGoals ?? "", homeworkForCustomer: session.homeworkForCustomer ?? "", trainerName: session.trainerName ?? "", durationMinutes: session.durationMinutes } });
                  }}
                  onEditSettings={(program) => setEditingProgram(program)}
                  onConvertToGroup={(program) => setConvertToGroupTarget(program)}
                  onDeleteProgram={(program) => setDeleteProgramTarget(program)}
                  isMarkingAttendance={markAttendanceMutation.isPending}
                  onFinishProgram={(id, dogName) => setFinishTarget({ programId: id, dogName })}
                  onDropoutProgram={(id, dogName) => setDropoutTarget({ programId: id, dogName })}
                  isUpdatingStatus={updateStatusMutation.isPending}
                />
              )}

              {/* חלופות פנסיון בבית הלקוח — hidden, infrastructure kept for future use */}
              {individualSubTab === "boarding-alt" && (
                <IndividualTab
                  programs={programs.filter((p) => p.boardingStayId !== null)}
                  searchQuery={searchQuery}
                  expandedCards={expandedCards}
                  toggleExpand={toggleExpand}
                  onMarkAttendance={(programId, sessionNumber, dogName, customerPhone, customerName) =>
                    setSessionLogTarget({ programId, sessionNumber, dogName, customerPhone, customerName })
                  }
                  onScheduleSession={(programId, sessionNumber, dogName, customerId, customerName, customerPhone) =>
                    setScheduleSessionTarget({ programId, sessionNumber, dogName, customerId, customerName, customerPhone })
                  }
                  onCancelSession={(programId, sessionId) =>
                    cancelScheduledSessionMutation.mutate({ programId, sessionId })
                  }
                  onEditSession={(programId, session, dogName) => {
                    const d = new Date(session.sessionDate);
                    const pad = (n: number) => String(n).padStart(2, "0");
                    setEditSessionTarget({ programId, sessionId: session.id, sessionNumber: session.sessionNumber ?? 1, dogName, initialData: { summary: session.summary ?? "", sessionDate: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`, sessionTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`, rating: session.rating, practiceItems: session.practiceItems ?? "", nextSessionGoals: session.nextSessionGoals ?? "", homeworkForCustomer: session.homeworkForCustomer ?? "", trainerName: session.trainerName ?? "", durationMinutes: session.durationMinutes } });
                  }}
                  onEditSettings={(program) => setEditingProgram(program)}
                  onConvertToGroup={(program) => setConvertToGroupTarget(program)}
                  onDeleteProgram={(program) => setDeleteProgramTarget(program)}
                  isMarkingAttendance={markAttendanceMutation.isPending}
                />
              )}
            </div>
          )}

          {/* ═══ BOARDING TAB ═══ */}
          {activeTab === "boarding" && (
            <BoardingTrainingTab
              stays={activeStays}
              boardingPrograms={boardingPrograms}
              homePrograms={programs.filter((p) => p.trainingType === "HOME")}
              searchQuery={searchQuery}
              onAddTraining={(stay) => setShowBoardingTraining({ stay })}
              onLogSession={(programId, sessionNumber, dogName, goals) =>
                setSessionLogTarget({ programId, sessionNumber, dogName, isWeekly: true, goals })
              }
              onLogHomeSession={(programId, sessionNumber, dogName) =>
                setSessionLogTarget({ programId, sessionNumber, dogName, isWeekly: false })
              }
            />
          )}

          {/* ═══ GROUPS TAB (אילוף קבוצתי) ═══ */}
          {activeTab === "groups" && (
            <div>
              {/* Sub-tabs */}
              <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 overflow-x-auto scrollbar-hide">
                {[
                  { id: "groups" as const, label: "קבוצות אימון" },
                  { id: "workshops" as const, label: "סדנאות מיוחדות" },
                ].map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setGroupSubTab(sub.id)}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                      groupSubTab === sub.id
                        ? "bg-white shadow-sm text-petra-text"
                        : "text-petra-muted hover:bg-white/60"
                    )}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              {groupSubTab === "groups" && (
                <GroupsTab
                  groups={regularGroups}
                  searchQuery={searchQuery}
                  expandedCards={expandedCards}
                  toggleExpand={toggleExpand}
                  onNewGroup={() => setShowNewGroup(true)}
                  onEditGroup={(group) => setEditingGroup(group)}
                  onAssignDog={(groupId, groupName) => setShowAssignDog({ groupId, groupName })}
                  onRemoveParticipant={(groupId, participantId) =>
                    removeParticipantMutation.mutate({ groupId, participantId })
                  }
                  onConvertParticipant={(groupId, participantId, dogName) =>
                    setConvertParticipantTarget({ groupId, participantId, dogName })
                  }
                  onDeleteGroup={(groupId, groupName) =>
                    setDeleteGroupTarget({ groupId, groupName, isWorkshop: false })
                  }
                />
              )}

              {groupSubTab === "workshops" && (
                <WorkshopsTab
                  workshops={workshops}
                  searchQuery={searchQuery}
                  expandedCards={expandedCards}
                  toggleExpand={toggleExpand}
                  onNewWorkshop={() => setShowNewWorkshop(true)}
                  onEditGroup={(group) => setEditingGroup(group)}
                  onAssignDog={(groupId, groupName) => setShowAssignDog({ groupId, groupName })}
                  onRemoveParticipant={(groupId, participantId) =>
                    removeParticipantMutation.mutate({ groupId, participantId })
                  }
                  onConvertParticipant={(groupId, participantId, dogName) =>
                    setConvertParticipantTarget({ groupId, participantId, dogName })
                  }
                  onDeleteGroup={(groupId, groupName) =>
                    setDeleteGroupTarget({ groupId, groupName, isWorkshop: true })
                  }
                />
              )}
            </div>
          )}

          {/* ═══ ARCHIVE TAB ═══ */}
          {activeTab === "archive" && (
            <ArchiveTab
              programs={archivedPrograms}
              isLoading={archiveLoading}
              onRestore={(id) => updateStatusMutation.mutate({ id, status: "ACTIVE" })}
            />
          )}

        </>
      )}

      {/* ═══ MODALS ═══ */}

      {showSellPackage && (
        <SellPackageModal
          onClose={() => setShowSellPackage(false)}
          onSubmit={(data) => createProgramMutation.mutate(data)}
          isPending={createProgramMutation.isPending}
          packages={packages.filter((p) => p.type === "HOME" && p.isActive)}
        />
      )}

      {showManualAdd && (
        <ManualAddProgramModal
          onClose={() => setShowManualAdd(false)}
          onSubmit={(data) => createProgramMutation.mutate(data)}
          isPending={createProgramMutation.isPending}
        />
      )}

      {editingProgram && (
        <ProgramSettingsModal
          program={editingProgram}
          onClose={() => setEditingProgram(null)}
          onSubmit={(data) => updateProgramSettingsMutation.mutate({ id: editingProgram!.id, ...data })}
          isPending={updateProgramSettingsMutation.isPending}
        />
      )}

      {showNewGroup && (
        <CreateGroupModal
          onClose={() => setShowNewGroup(false)}
          onSubmit={(data) => createGroupMutation.mutate(data)}
          isPending={createGroupMutation.isPending}
          isWorkshop={false}
        />
      )}

      {showNewWorkshop && (
        <CreateGroupModal
          onClose={() => setShowNewWorkshop(false)}
          onSubmit={(data) => createGroupMutation.mutate({ ...data, groupType: "WORKSHOP" })}
          isPending={createGroupMutation.isPending}
          isWorkshop={true}
        />
      )}

      {editingGroup && (
        <CreateGroupModal
          onClose={() => setEditingGroup(null)}
          onSubmit={(data) => updateGroupMutation.mutate({ id: editingGroup.id, ...data })}
          isPending={updateGroupMutation.isPending}
          isWorkshop={editingGroup.groupType === "WORKSHOP"}
          initial={editingGroup}
        />
      )}

      {showAssignDog && (
        <AssignDogModal
          groupId={showAssignDog.groupId}
          groupName={showAssignDog.groupName}
          onClose={() => setShowAssignDog(null)}
          onSubmit={(customerId, dogId) =>
            addParticipantMutation.mutate({
              groupId: showAssignDog.groupId,
              customerId,
              dogId,
            })
          }
          isPending={addParticipantMutation.isPending}
          error={addParticipantMutation.error?.message || null}
        />
      )}

      {sessionSummarySend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="modal-backdrop" onClick={() => setSessionSummarySend(null)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full border border-green-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-petra-text text-sm">מפגש נרשם בהצלחה! ✓</h3>
                <p className="text-xs text-petra-muted">{sessionSummarySend.dogName} — מפגש {sessionSummarySend.sessionNumber}</p>
              </div>
              <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted flex-shrink-0" onClick={() => setSessionSummarySend(null)}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-petra-muted mb-4">שלח סיכום מפגש ישירות ללקוח בוואטסאפ</p>
            {(() => {
              const lines: string[] = [
                `שלום ${sessionSummarySend.customerName}! 🐾`,
                `סיכום מפגש ${sessionSummarySend.sessionNumber} — ${sessionSummarySend.dogName}`,
                "",
              ];
              if (sessionSummarySend.practiceItems) lines.push(`📝 תרגילים שעשינו:\n${sessionSummarySend.practiceItems}`, "");
              if (sessionSummarySend.homeworkForCustomer) lines.push(`🏠 שיעורי בית לתרגול:\n${sessionSummarySend.homeworkForCustomer}`, "");
              if (sessionSummarySend.nextSessionGoals) lines.push(`🎯 יעדים לפגישה הבאה:\n${sessionSummarySend.nextSessionGoals}`, "");
              if (sessionSummarySend.rating) lines.push(`⭐ דירוג המפגש: ${"★".repeat(sessionSummarySend.rating)}`);
              lines.push("", "נתראה בפגישה הבאה! 🐾");
              const msg = lines.join("\n");
              const url = `https://wa.me/${toWhatsAppPhone(sessionSummarySend.customerPhone)}?text=${encodeURIComponent(msg)}`;
              return (
                <div className="space-y-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors"
                    onClick={() => setTimeout(() => setSessionSummarySend(null), 800)}
                  >
                    <Send className="w-4 h-4" />
                    שלח סיכום בוואטסאפ
                  </a>
                  <button
                    className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-petra-muted text-xs font-medium transition-colors"
                    onClick={() => setSessionSummarySend(null)}
                  >
                    דלג — לא עכשיו
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {sessionLogTarget && (
        <SessionLogModal
          dogName={sessionLogTarget.dogName}
          sessionNumber={sessionLogTarget.sessionNumber}
          isWeekly={sessionLogTarget.isWeekly}
          isServiceDog={sessionLogTarget.isServiceDog}
          isPending={markAttendanceMutation.isPending}
          programId={sessionLogTarget.programId}
          goals={sessionLogTarget.goals}
          onClose={() => setSessionLogTarget(null)}
          onSubmit={(summary, sessionDate, rating, practiceItems, nextSessionGoals, homeworkForCustomer, trainerName, durationMinutes) =>
            markAttendanceMutation.mutate({
              programId: sessionLogTarget.programId,
              sessionNumber: sessionLogTarget.sessionNumber,
              summary,
              sessionDate,
              rating,
              practiceItems,
              nextSessionGoals,
              homeworkForCustomer,
              trainerName,
              durationMinutes,
              customerPhone: sessionLogTarget.customerPhone,
              customerName: sessionLogTarget.customerName,
              dogName: sessionLogTarget.dogName,
            })
          }
        />
      )}

      {editSessionTarget && (
        <SessionLogModal
          dogName={editSessionTarget.dogName}
          sessionNumber={editSessionTarget.sessionNumber}
          isWeekly={editSessionTarget.isWeekly}
          isServiceDog={editSessionTarget.isServiceDog}
          isPending={editSessionMutation.isPending}
          initialData={editSessionTarget.initialData}
          onClose={() => setEditSessionTarget(null)}
          onSubmit={(summary, sessionDate, rating, practiceItems, nextSessionGoals, homeworkForCustomer, trainerName, durationMinutes) =>
            editSessionMutation.mutate({
              programId: editSessionTarget.programId,
              sessionId: editSessionTarget.sessionId,
              summary,
              sessionDate,
              rating,
              practiceItems,
              nextSessionGoals,
              homeworkForCustomer,
              trainerName,
              durationMinutes,
            })
          }
        />
      )}

      {showCreateServiceDogProgram && (
        <CreateServiceDogProgramModal
          onClose={() => setShowCreateServiceDogProgram(false)}
          onSuccess={() => {
            setShowCreateServiceDogProgram(false);
            queryClient.invalidateQueries({ queryKey: ["training-programs-service"] });
          }}
        />
      )}

      {showCreatePackage && (
        <CreatePackageModal
          onClose={() => setShowCreatePackage(false)}
          onSubmit={(data) => createPackageMutation.mutate(data)}
          isPending={createPackageMutation.isPending}
        />
      )}

      {editingPackage && (
        <EditPackageModal
          package={editingPackage}
          onClose={() => setEditingPackage(null)}
          onSubmit={(data) => updatePackageMutation.mutate({ id: editingPackage.id, ...data })}
          isPending={updatePackageMutation.isPending}
        />
      )}

      {showBoardingTraining && (
        <BoardingTrainingModal
          stay={showBoardingTraining.stay}
          onClose={() => setShowBoardingTraining(null)}
          onSubmit={(data) => createBoardingTrainingMutation.mutate(data)}
          isPending={createBoardingTrainingMutation.isPending}
        />
      )}

      {dropoutTarget && (
        <DropoutModal
          dogName={dropoutTarget.dogName}
          isPending={updateStatusMutation.isPending}
          onClose={() => setDropoutTarget(null)}
          onSubmit={(reason) =>
            updateStatusMutation.mutate({
              id: dropoutTarget.programId,
              status: "CANCELED",
              notes: reason || undefined,
            })
          }
        />
      )}

      {finishTarget && (
        <FinishTrainingModal
          dogName={finishTarget.dogName}
          isPending={updateStatusMutation.isPending}
          onClose={() => setFinishTarget(null)}
          onSubmit={() =>
            updateStatusMutation.mutate({
              id: finishTarget.programId,
              status: "COMPLETED",
            })
          }
        />
      )}

      {scheduleSessionTarget && (
        <ScheduleSessionModal
          dogName={scheduleSessionTarget.dogName}
          sessionNumber={scheduleSessionTarget.sessionNumber}
          isPending={scheduleSessionMutation.isPending}
          onClose={() => setScheduleSessionTarget(null)}
          onSubmit={(data) => scheduleSessionMutation.mutate({
            programId: scheduleSessionTarget.programId,
            ...data,
          })}
        />
      )}

      {showAddServiceDog && (
        <AddStandaloneServiceDogModal
          onClose={() => setShowAddServiceDog(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["training-programs-service"] });
            queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
          }}
        />
      )}

      {showAddRecipient && (
        <AddRecipientInlineModal onClose={() => setShowAddRecipient(false)} />
      )}

      {convertToGroupTarget && (
        <ConvertToGroupModal
          program={convertToGroupTarget}
          groups={groups}
          isPending={convertToGroupMutation.isPending}
          onClose={() => setConvertToGroupTarget(null)}
          onSubmit={(trainingGroupId) =>
            convertToGroupMutation.mutate({ programId: convertToGroupTarget.id, trainingGroupId, orderAction: "keep" })
          }
        />
      )}

      {deleteProgramTarget && (
        <DeleteProgramModal
          program={deleteProgramTarget}
          isPending={deleteProgramMutation.isPending}
          onClose={() => setDeleteProgramTarget(null)}
          onSubmit={(orderAction) =>
            deleteProgramMutation.mutate({ programId: deleteProgramTarget.id, orderAction })
          }
        />
      )}

      {convertParticipantTarget && (
        <ConfirmActionModal
          title="המרה לאילוף פרטני"
          message={`להמיר את ${convertParticipantTarget.dogName} מהקבוצה לאילוף פרטני? תיווצר תוכנית אילוף פרטנית והכלב יוסר מהקבוצה.`}
          confirmLabel="המר לפרטני"
          isPending={convertParticipantMutation.isPending}
          onClose={() => setConvertParticipantTarget(null)}
          onConfirm={() =>
            convertParticipantMutation.mutate({
              groupId: convertParticipantTarget.groupId,
              participantId: convertParticipantTarget.participantId,
            })
          }
        />
      )}

      {deleteGroupTarget && (
        <ConfirmActionModal
          title={deleteGroupTarget.isWorkshop ? "מחיקת סדנה" : "מחיקת קבוצה"}
          message={`למחוק את "${deleteGroupTarget.groupName}"? פעולה זו תמחק את כל המפגשים והמשתתפים בקבוצה. ההזמנות של הלקוחות לא יימחקו.`}
          confirmLabel="מחק לצמיתות"
          danger
          isPending={deleteGroupMutation.isPending}
          onClose={() => setDeleteGroupTarget(null)}
          onConfirm={() => deleteGroupMutation.mutate({ groupId: deleteGroupTarget.groupId })}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════

function DogStatusDot({ dog }: { dog: UnifiedDog }) {
  const isAlert = (dog.sessionsRemaining !== undefined && dog.sessionsRemaining <= 2 && dog.status === "ACTIVE")
    || (dog.daysSinceLastSession !== undefined && dog.daysSinceLastSession >= 14 && dog.status === "ACTIVE");
  const isCompleted = dog.status === "COMPLETED";
  if (isAlert) return <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />;
  if (isCompleted) return <span className="w-2.5 h-2.5 rounded-full bg-slate-400 flex-shrink-0" />;
  return <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />;
}

function OverviewDogCard({ dog, onFocus }: { dog: UnifiedDog; onFocus?: (dog: UnifiedDog) => void }) {
  const badge = TYPE_BADGE[dog.type];
  const isLowSessions = dog.sessionsRemaining !== undefined && dog.sessionsRemaining <= 2 && dog.status === "ACTIVE";
  const isOverdue = dog.daysSinceLastSession !== undefined && dog.daysSinceLastSession >= 14 && dog.status === "ACTIVE";
  const isCompleted = dog.status === "COMPLETED";

  const whatsappUrl = dog.customerPhone
    ? `https://wa.me/${toWhatsAppPhone(dog.customerPhone)}?text=${encodeURIComponent(`שלום! עדכון אימון עבור ${dog.dogName} 🐾`)}`
    : null;

  return (
    <div
      onClick={() => onFocus?.(dog)}
      className={cn(
      "card p-4 transition-all",
      onFocus && "cursor-pointer hover:shadow-md",
      isLowSessions || isOverdue ? "border-red-200 bg-red-50/30" : isCompleted ? "opacity-70" : ""
    )}>
      {/* Top row */}
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0",
          isCompleted ? "bg-slate-100 text-slate-500" : "bg-brand-50 text-brand-600"
        )}>
          {dog.dogName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <DogStatusDot dog={dog} />
            <h3 className="text-sm font-semibold text-petra-text truncate">{dog.dogName}</h3>
          </div>
          <p className="text-xs text-petra-muted truncate">{dog.customerName}</p>
        </div>
        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0", badge.bg, badge.text)}>
          {badge.label}
        </span>
      </div>

      {/* Detail */}
      <p className="text-xs text-petra-muted mb-3">{dog.detail}</p>

      {/* Progress bar */}
      {dog.progress && (
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-petra-muted mb-1">
            <span>מפגשים</span>
            <span className="font-semibold">{dog.progress.used}/{dog.progress.total}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100">
            <div
              className={cn("h-full rounded-full transition-all", isLowSessions ? "bg-red-400" : "bg-emerald-500")}
              style={{ width: `${Math.min(100, (dog.progress.used / dog.progress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Alert tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {isLowSessions && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {dog.sessionsRemaining} מפגשים נותרו
          </span>
        )}
        {isOverdue && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
            {dog.daysSinceLastSession} ימים ללא מפגש
          </span>
        )}
        {isCompleted && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> הושלם
          </span>
        )}
        {dog.lastSessionDate && !isCompleted && !isOverdue && (
          <span className="text-[10px] text-petra-muted">
            מפגש אחרון: {formatDate(dog.lastSessionDate)}
          </span>
        )}
      </div>

      {/* WhatsApp */}
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] text-green-700 hover:text-green-800 font-medium bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg transition-colors w-full justify-center border border-green-200"
          onClick={(e) => e.stopPropagation()}
        >
          <Send className="w-3 h-3" />
          שלח עדכון לבעלים
        </a>
      )}
    </div>
  );
}

function OverviewDogRow({ dog, onFocus }: { dog: UnifiedDog; onFocus: (dog: UnifiedDog) => void }) {
  const badge = TYPE_BADGE[dog.type];
  const isLowSessions = dog.sessionsRemaining !== undefined && dog.sessionsRemaining <= 2 && dog.status === "ACTIVE";
  const isOverdue = dog.daysSinceLastSession !== undefined && dog.daysSinceLastSession >= 14 && dog.status === "ACTIVE";
  const isCompleted = dog.status === "COMPLETED";

  const whatsappUrl = dog.customerPhone
    ? `https://wa.me/${toWhatsAppPhone(dog.customerPhone)}?text=${encodeURIComponent(`שלום! עדכון אימון עבור ${dog.dogName} 🐾`)}`
    : null;

  return (
    <tr
      className={cn("border-b last:border-0 hover:bg-brand-50/60 transition-colors cursor-pointer", isCompleted && "opacity-60")}
      onClick={() => onFocus(dog)}
    >
      <td className="p-3">
        <div className="flex items-center gap-2">
          <DogStatusDot dog={dog} />
          <span className="text-sm font-semibold text-petra-text">{dog.dogName}</span>
          {(isLowSessions || isOverdue) && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
        </div>
      </td>
      <td className="p-3 text-sm text-petra-muted">{dog.customerName}</td>
      <td className="p-3">
        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", badge.bg, badge.text)}>
          {badge.label}
        </span>
      </td>
      <td className="p-3">
        {dog.progress ? (
          <div className="flex items-center gap-2 min-w-[80px]">
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={cn("h-full rounded-full", isLowSessions ? "bg-red-400" : "bg-emerald-500")}
                style={{ width: `${Math.min(100, (dog.progress.used / dog.progress.total) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-petra-muted whitespace-nowrap">{dog.progress.used}/{dog.progress.total}</span>
          </div>
        ) : (
          <span className="text-xs text-petra-muted">—</span>
        )}
      </td>
      <td className="p-3 text-xs text-petra-muted">
        {isOverdue ? (
          <span className="text-amber-600 font-medium">{dog.daysSinceLastSession} ימים</span>
        ) : dog.lastSessionDate ? (
          formatDate(dog.lastSessionDate)
        ) : "—"}
      </td>
      <td className="p-3">
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[11px] text-green-700 hover:text-green-800 font-medium bg-green-50 hover:bg-green-100 px-2 py-1 rounded-lg transition-colors border border-green-200"
          >
            <Send className="w-3 h-3" />
            שלח
          </a>
        )}
      </td>
    </tr>
  );
}

function OverviewTab({ dogs, onFocus }: { dogs: UnifiedDog[]; onFocus: (dog: UnifiedDog) => void }) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  if (dogs.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Dog className="w-6 h-6 text-slate-400" /></div>
        <h3 className="text-base font-semibold text-petra-text mb-1">אין כלבים באימון</h3>
        <p className="text-sm text-petra-muted">הוסף כלבים לאימון דרך הטאבים השונים</p>
      </div>
    );
  }

  const attention = dogs.filter((d) =>
    (d.sessionsRemaining !== undefined && d.sessionsRemaining <= 2 && d.status === "ACTIVE") ||
    (d.daysSinceLastSession !== undefined && d.daysSinceLastSession >= 14 && d.status === "ACTIVE")
  );
  const active = dogs.filter((d) => d.status === "ACTIVE" && !attention.some((a) => a.key === d.key));
  const completed = dogs.filter((d) => d.status === "COMPLETED");

  const sections: { label: string; icon: React.ReactNode; labelClass: string; dogs: UnifiedDog[] }[] = [
    { label: `דורשים תשומת לב (${attention.length})`, icon: <AlertTriangle className="w-4 h-4" />, labelClass: "text-red-600", dogs: attention },
    { label: `באימון פעיל (${active.length})`, icon: <CheckCircle2 className="w-4 h-4" />, labelClass: "text-emerald-700", dogs: active },
    { label: `הושלמו (${completed.length})`, icon: <Clock className="w-4 h-4" />, labelClass: "text-slate-500", dogs: completed },
  ].filter((s) => s.dogs.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="flex items-center bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode("list")}
            className={cn("p-1.5 rounded transition-colors", viewMode === "list" ? "bg-white shadow-sm text-brand-600" : "text-petra-muted")}
            title="תצוגת שורות"
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={cn("p-1.5 rounded transition-colors", viewMode === "grid" ? "bg-white shadow-sm text-brand-600" : "text-petra-muted")}
            title="תצוגת כרטיסים"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {viewMode === "grid" ? (
        sections.map((section) => (
          <section key={section.label}>
            <h2 className={cn("text-sm font-semibold mb-3 flex items-center gap-2", section.labelClass)}>
              {section.icon}
              {section.label}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {section.dogs.map((dog) => <OverviewDogCard key={dog.key} dog={dog} onFocus={onFocus} />)}
            </div>
          </section>
        ))
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="p-3 font-medium text-petra-muted">כלב</th>
                <th className="p-3 font-medium text-petra-muted">בעלים</th>
                <th className="p-3 font-medium text-petra-muted">סוג אימון</th>
                <th className="p-3 font-medium text-petra-muted">מפגשים</th>
                <th className="p-3 font-medium text-petra-muted">מפגש אחרון</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <>
                  <tr key={section.label} className="bg-slate-50/80">
                    <td colSpan={6} className={cn("px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5", section.labelClass)}>
                      {section.icon}
                      {section.label}
                    </td>
                  </tr>
                  {section.dogs.map((dog) => <OverviewDogRow key={dog.key} dog={dog} onFocus={onFocus} />)}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// INDIVIDUAL TAB
// ═══════════════════════════════════════════════════════
// GOAL PROGRESS ROW
// ═══════════════════════════════════════════════════════

function GoalProgressRow({ goal, programId }: { goal: { id: string; title: string; status: string; progressPercent: number }; programId: string }) {
  const queryClient = useQueryClient();
  const [localProgress, setLocalProgress] = useState(goal.progressPercent);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["training-programs"] });
    queryClient.invalidateQueries({ queryKey: ["training-programs-boarding"] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ progress, status }: { progress: number; status: string }) =>
      fetchJSON(`/api/training-programs/${programId}/goals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId: goal.id, progressPercent: progress, status }),
      }),
    onSuccess: invalidate,
    onError: () => toast.error("שגיאה בעדכון יעד"),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      fetchJSON(`/api/training-programs/${programId}/goals?goalId=${goal.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); toast.success("יעד הוסר"); },
    onError: () => toast.error("שגיאה במחיקת יעד"),
  });

  const cycleStatus = () => {
    const next = goal.status === "NOT_STARTED" ? "IN_PROGRESS"
      : goal.status === "IN_PROGRESS" ? "ACHIEVED"
      : "NOT_STARTED";
    const nextProgress = next === "ACHIEVED" ? 100 : next === "IN_PROGRESS" ? Math.max(localProgress, 10) : 0;
    setLocalProgress(nextProgress);
    updateMutation.mutate({ progress: nextProgress, status: next });
  };

  const statusColor = goal.status === "ACHIEVED" ? "text-emerald-600" : goal.status === "IN_PROGRESS" ? "text-brand-600" : "text-petra-muted";
  const statusIcon = goal.status === "ACHIEVED" ? "✓" : goal.status === "IN_PROGRESS" ? "●" : "○";

  return (
    <div className="p-2 rounded-lg bg-slate-50 space-y-1.5">
      <div className="flex items-center gap-2">
        <button
          title="שנה סטטוס"
          onClick={cycleStatus}
          disabled={updateMutation.isPending}
          className={cn("text-[11px] font-bold flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full border transition-all hover:scale-110", statusColor,
            goal.status === "ACHIEVED" ? "border-emerald-300 bg-emerald-50" : goal.status === "IN_PROGRESS" ? "border-brand-300 bg-brand-50" : "border-slate-300 bg-white")}
        >
          {statusIcon}
        </button>
        <span className="text-xs text-petra-text flex-1 truncate">{goal.title}</span>
        <span className="text-[10px] text-petra-muted font-medium">{localProgress}%</span>
        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 text-petra-muted hover:text-red-500 transition-colors flex-shrink-0"
          title="מחק יעד"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          step={10}
          value={localProgress}
          onChange={(e) => setLocalProgress(parseInt(e.target.value))}
          onMouseUp={() => {
            const next = localProgress >= 100 ? "ACHIEVED" : localProgress > 0 ? "IN_PROGRESS" : "NOT_STARTED";
            if (localProgress !== goal.progressPercent) updateMutation.mutate({ progress: localProgress, status: next });
          }}
          onTouchEnd={() => {
            const next = localProgress >= 100 ? "ACHIEVED" : localProgress > 0 ? "IN_PROGRESS" : "NOT_STARTED";
            if (localProgress !== goal.progressPercent) updateMutation.mutate({ progress: localProgress, status: next });
          }}
          className="flex-1 accent-brand-500 h-1.5"
        />
      </div>
      <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", localProgress >= 100 ? "bg-emerald-500" : "bg-brand-500")}
          style={{ width: `${localProgress}%` }}
        />
      </div>
    </div>
  );
}

// ─── Homework Section ────────────────────────────────────────────────────────

function HomeworkSection({ program }: { program: TrainingProgram }) {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: ({ homeworkId, isCompleted }: { homeworkId: string; isCompleted: boolean }) =>
      fetchJSON(`/api/training-programs/${program.id}/homework`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeworkId, isCompleted }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["training-programs"] }),
    onError: () => toast.error("שגיאה בעדכון שיעורי בית"),
  });

  const addMutation = useMutation({
    mutationFn: (title: string) =>
      fetchJSON(`/api/training-programs/${program.id}/homework`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      setNewTitle("");
      setShowAdd(false);
      toast.success("שיעור בית נוסף ✓");
    },
    onError: () => toast.error("שגיאה בהוספת שיעור בית"),
  });

  const deleteMutation = useMutation({
    mutationFn: (homeworkId: string) =>
      fetchJSON(`/api/training-programs/${program.id}/homework?homeworkId=${homeworkId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["training-programs"] }),
    onError: () => toast.error("שגיאה במחיקת שיעור בית"),
  });

  const completed = program.homework.filter((h) => h.isCompleted).length;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="w-3.5 h-3.5 text-petra-muted" />
        <h4 className="text-xs font-semibold text-petra-muted flex-1">
          שיעורי בית ({completed}/{program.homework.length})
        </h4>
        {program.customer?.phone && program.homework.filter((h) => !h.isCompleted).length > 0 && (() => {
          const pending = program.homework.filter((h) => !h.isCompleted);
          const lines = [
            `📝 שיעורי בית לאימון — ${program.dog.name}`,
            "",
            ...pending.map((h, i) => `${i + 1}. ${h.title}`),
            "",
            "יש להתאמן על הנקודות הנ״ל עד המפגש הבא 🐾",
          ];
          return (
            <a
              href={`https://wa.me/${toWhatsAppPhone(program.customer?.phone ?? "")}?text=${encodeURIComponent(lines.join("\n"))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-green-700 hover:text-green-800 font-medium flex items-center gap-0.5 bg-green-50 px-1.5 py-0.5 rounded"
              title="שלח שיעורי בית"
              onClick={(e) => e.stopPropagation()}
            >
              <Send className="w-2.5 h-2.5" />
              שלח
            </a>
          );
        })()}
        <button
          className="me-0 ms-auto flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors border border-brand-200"
          onClick={() => setShowAdd((v) => !v)}
        >
          <Plus className="w-3.5 h-3.5" />
          הוסף
        </button>
      </div>

      {program.homework.length === 0 && !showAdd && (
        <p className="text-xs text-petra-muted">אין שיעורי בית עדיין</p>
      )}

      <div className="space-y-1.5">
        {program.homework.map((hw) => (
          <div
            key={hw.id}
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg transition-colors group",
              hw.isCompleted ? "bg-emerald-50" : "bg-slate-50"
            )}
          >
            <button
              onClick={() => toggleMutation.mutate({ homeworkId: hw.id, isCompleted: !hw.isCompleted })}
              disabled={toggleMutation.isPending}
              className="flex-shrink-0"
            >
              {hw.isCompleted ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <Circle className="w-4 h-4 text-slate-300 hover:text-brand-400" />
              )}
            </button>
            <span className={cn("text-xs flex-1", hw.isCompleted ? "line-through text-petra-muted" : "text-petra-text")}>
              {hw.title}
            </span>
            <button
              onClick={() => deleteMutation.mutate(hw.id)}
              disabled={deleteMutation.isPending}
              className="text-petra-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            type="text"
            className="input text-xs flex-1 py-1"
            placeholder="תיאור שיעור הבית..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTitle.trim()) addMutation.mutate(newTitle.trim());
              if (e.key === "Escape") { setShowAdd(false); setNewTitle(""); }
            }}
          />
          <button
            className="btn-primary text-xs px-2 py-1"
            disabled={!newTitle.trim() || addMutation.isPending}
            onClick={() => { if (newTitle.trim()) addMutation.mutate(newTitle.trim()); }}
          >
            {addMutation.isPending ? "..." : "הוסף"}
          </button>
          <button className="btn-secondary text-xs px-2 py-1" onClick={() => { setShowAdd(false); setNewTitle(""); }}>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// GOAL SECTION (inline add-goal)
// ═══════════════════════════════════════════════════════

function GoalSection({ program, label = "יעדי אילוף" }: { program: TrainingProgram; label?: string }) {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const addMutation = useMutation({
    mutationFn: (title: string) =>
      fetchJSON(`/api/training-programs/${program.id}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      queryClient.invalidateQueries({ queryKey: ["training-programs-boarding"] });
      queryClient.invalidateQueries({ queryKey: ["training-programs-service"] });
      setNewTitle("");
      setShowAdd(false);
      toast.success("יעד נוסף ✓");
    },
    onError: () => toast.error("שגיאה בהוספת יעד"),
  });

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="w-3.5 h-3.5 text-petra-muted" />
        <h4 className="text-xs font-semibold text-petra-muted flex-1">
          {label} ({program.goals.length})
        </h4>
        <button
          className="me-0 ms-auto flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors border border-brand-200"
          onClick={() => setShowAdd((v) => !v)}
        >
          <Plus className="w-3.5 h-3.5" />
          הוסף יעד
        </button>
      </div>

      {program.goals.length === 0 && !showAdd && (
        <p className="text-xs text-petra-muted">אין יעדים עדיין — לחץ &ldquo;הוסף יעד&rdquo; כדי לעקוב אחר ההתקדמות</p>
      )}

      <div className="space-y-2">
        {program.goals.map((goal) => (
          <GoalProgressRow key={goal.id} goal={goal} programId={program.id} />
        ))}
      </div>

      {showAdd && (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            type="text"
            className="input text-xs flex-1 py-1"
            placeholder="תאר את היעד..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTitle.trim()) addMutation.mutate(newTitle.trim());
              if (e.key === "Escape") { setShowAdd(false); setNewTitle(""); }
            }}
          />
          <button
            className="btn-primary text-xs px-2 py-1"
            disabled={!newTitle.trim() || addMutation.isPending}
            onClick={() => { if (newTitle.trim()) addMutation.mutate(newTitle.trim()); }}
          >
            {addMutation.isPending ? "..." : "הוסף"}
          </button>
          <button className="btn-secondary text-xs px-2 py-1" onClick={() => { setShowAdd(false); setNewTitle(""); }}>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SESSION CHECKLIST COMPONENT
// ═══════════════════════════════════════════════════════

function SessionChecklist({
  program,
  usedSessions,
  onAddSession,
  isAdding,
  onScheduleSession,
  onCancelSession,
  onEditSession,
}: {
  program: TrainingProgram;
  usedSessions: number;
  onAddSession: () => void;
  isAdding: boolean;
  onScheduleSession?: (sessionNumber: number) => void;
  onCancelSession?: (sessionId: string) => void;
  onEditSession?: (session: ProgramSession) => void;
}) {
  const queryClient = useQueryClient();
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<{ id: string; date: string; time: string; duration: number } | null>(null);

  const rescheduleSessionMutation = useMutation({
    mutationFn: async ({ sessionId, date, time, duration }: { sessionId: string; date: string; time: string; duration: number }) => {
      const res = await fetch(`/api/training-programs/${program.id}/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionDate: new Date(`${date}T${time}:00`).toISOString(),
          durationMinutes: duration,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      queryClient.invalidateQueries({ queryKey: ["training-programs-boarding"] });
      queryClient.invalidateQueries({ queryKey: ["training-program-sessions-cal"] });
      queryClient.invalidateQueries({ queryKey: ["training-group-sessions-cal"] });
      setEditingSession(null);
      toast.success("מועד המפגש עודכן");
    },
    onError: () => toast.error("שגיאה בעדכון מועד המפגש"),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/training-programs/${program.id}/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      queryClient.invalidateQueries({ queryKey: ["training-programs-boarding"] });
      toast.success("המפגש נמחק");
    },
    onError: () => toast.error("שגיאה במחיקת המפגש"),
  });
  const total = program.totalSessions;
  const sessionsByNumber = new Map(program.sessions.map((s) => [s.sessionNumber ?? 0, s]));

  const formatSessionDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const date = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long" }).format(d);
    const time = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
    return `${date} בשעה ${time}`;
  };

  return (
    <div className="mt-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-petra-muted flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          {total ? `מפגשים (${usedSessions}/${total})` : `מפגשים (${usedSessions})`}
        </h4>
        {total && (
          <span className="text-[11px] text-petra-muted">
            {total - usedSessions > 0 ? `נותרו ${total - usedSessions}` : "הכל הושלם ✓"}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {total && total > 0 && (
        <div className="w-full h-1.5 rounded-full bg-slate-100 mb-2">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(100, (usedSessions / total) * 100)}%` }}
          />
        </div>
      )}

      {/* Rating trend dots */}
      {total && total > 0 && program.sessions.some((s) => s.rating) && (
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          {Array.from({ length: total }, (_, i) => {
            const num = i + 1;
            const session = sessionsByNumber.get(num);
            if (!session || session.status !== "COMPLETED") {
              return <span key={num} className="w-2.5 h-2.5 rounded-full bg-slate-100 border border-slate-200" title={`מפגש ${num}`} />;
            }
            const r = session.rating;
            const color = !r ? "bg-slate-300" : r >= 4 ? "bg-emerald-500" : r === 3 ? "bg-amber-400" : "bg-red-400";
            return (
              <span
                key={num}
                className={cn("w-2.5 h-2.5 rounded-full", color)}
                title={`מפגש ${num}${r ? ` — ${r}★` : " — בוצע"}`}
              />
            );
          })}
          <span className="text-[10px] text-petra-muted mr-0.5">דירוגי מפגשים</span>
        </div>
      )}

      {/* Session rows */}
      <div className="space-y-1.5">
        {/* Render planned slots */}
        {total ? Array.from({ length: total }, (_, i) => {
          const num = i + 1;
          const session = sessionsByNumber.get(num);
          const isCompleted = session?.status === "COMPLETED";
          const isScheduled = session?.status === "SCHEDULED";
          const isNext = num === usedSessions + 1 && program.status === "ACTIVE";
          const expanded = expandedSessionId === session?.id;

          return (
            <div key={num}>
              <div
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all",
                  isCompleted
                    ? "bg-emerald-50 border-emerald-100 cursor-pointer hover:bg-emerald-100"
                    : isScheduled
                      ? "bg-blue-50 border-blue-200"
                      : isNext
                        ? "bg-brand-50 border-brand-200"
                        : "bg-slate-50 border-transparent opacity-50"
                )}
                onClick={() => isCompleted && session && setExpandedSessionId(expanded ? null : session.id)}
              >
                {/* Icon / number */}
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold",
                  isCompleted ? "bg-emerald-500 text-white"
                    : isScheduled ? "bg-blue-500 text-white"
                    : isNext ? "bg-brand-100 text-brand-600"
                    : "bg-slate-200 text-slate-400"
                )}>
                  {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : isScheduled ? <Calendar className="w-3 h-3" /> : num}
                </div>

                <span className="text-xs font-medium text-petra-text flex-1">מפגש {num}</span>

                {isCompleted && session && (
                  <>
                    <span className="text-[10px] text-petra-muted">{formatDate(session.sessionDate)}</span>
                    {session.rating && (
                      <span className="text-[10px] text-amber-500">{"★".repeat(session.rating)}</span>
                    )}
                    {onEditSession && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEditSession(session); }}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-emerald-100 text-slate-300 hover:text-emerald-600 transition-colors"
                        title="ערוך מפגש"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (confirm("למחוק את רישום המפגש?")) deleteSessionMutation.mutate(session.id); }}
                      disabled={deleteSessionMutation.isPending}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 text-slate-300 hover:text-red-500 transition-colors"
                      title="מחק מפגש"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform", expanded && "rotate-180")} />
                  </>
                )}

                {isScheduled && session && (
                  <>
                    <span className="text-[10px] text-blue-600 font-medium">{formatSessionDateTime(session.sessionDate)}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const d = new Date(session.sessionDate);
                        const pad = (n: number) => String(n).padStart(2, "0");
                        setEditingSession(editingSession?.id === session.id ? null : {
                          id: session.id,
                          date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
                          time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
                          duration: session.durationMinutes ?? 60,
                        });
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-colors"
                      title="ערוך מועד"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    {onCancelSession && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onCancelSession(session.id); }}
                        className="text-[10px] text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors"
                      >
                        ביטול
                      </button>
                    )}
                  </>
                )}

                {isNext && !isScheduled && (
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      disabled={isAdding}
                      onClick={onAddSession}
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      הוסף
                    </button>
                    {onScheduleSession && (
                      <button
                        type="button"
                        onClick={() => onScheduleSession(num)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                      >
                        <Calendar className="w-3 h-3" />
                        קבע מועד
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Inline edit form for SCHEDULED sessions */}
              {editingSession && editingSession.id === session?.id && isScheduled && (() => {
                const es = editingSession;
                return (
                  <div className="mx-3 mt-0.5 mb-1 p-3 bg-blue-50 border border-blue-200 rounded-xl" onClick={(e) => e.stopPropagation()}>
                    <p className="text-[10px] font-semibold text-blue-700 mb-2">עריכת מועד מפגש</p>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="label text-[10px]">תאריך</label>
                        <input type="date" lang="he" className="input text-xs py-1.5" value={es.date} onChange={(e) => setEditingSession({ id: es.id, date: e.target.value, time: es.time, duration: es.duration })} />
                      </div>
                      <div className="flex-1">
                        <label className="label text-[10px]">שעה</label>
                        <input type="time" className="input text-xs py-1.5" value={es.time} onChange={(e) => setEditingSession({ id: es.id, date: es.date, time: e.target.value, duration: es.duration })} />
                      </div>
                      <div className="w-20">
                        <label className="label text-[10px]">משך (דקות)</label>
                        <select className="input text-xs py-1.5" value={es.duration} onChange={(e) => setEditingSession({ id: es.id, date: es.date, time: es.time, duration: parseInt(e.target.value) })}>
                          {(DURATION_OPTIONS.includes(es.duration) ? DURATION_OPTIONS : [es.duration, ...DURATION_OPTIONS].sort((a, b) => a - b)).map((d) => (
                            <option key={d} value={d}>{d} דק׳</option>
                          ))}
                        </select>
                      </div>
                      <button className="btn-primary text-xs py-1.5" disabled={rescheduleSessionMutation.isPending || !es.date || !es.time} onClick={() => rescheduleSessionMutation.mutate({ sessionId: es.id, date: es.date, time: es.time, duration: es.duration })}>
                        {rescheduleSessionMutation.isPending ? "שומר..." : "שמור"}
                      </button>
                      <button className="btn-secondary text-xs py-1.5" onClick={() => setEditingSession(null)}>ביטול</button>
                    </div>
                  </div>
                );
              })()}

              {/* Expanded session details */}
              {expanded && session && (
                <div className="mx-3 mt-0.5 mb-1 p-3 bg-white border border-emerald-100 rounded-xl text-xs space-y-1.5">
                  {session.practiceItems && (
                    <div><span className="font-semibold text-petra-muted">תרגילים: </span>{session.practiceItems}</div>
                  )}
                  {session.nextSessionGoals && (
                    <div><span className="font-semibold text-petra-muted">יעדים הבאים: </span>{session.nextSessionGoals}</div>
                  )}
                  {session.homeworkForCustomer && (
                    <div><span className="font-semibold text-petra-muted">שיעורי בית: </span>{session.homeworkForCustomer}</div>
                  )}
                  {session.summary && (
                    <div><span className="font-semibold text-petra-muted">סיכום: </span>{session.summary}</div>
                  )}
                </div>
              )}
            </div>
          );
        }) : (
          /* No totalSessions - show all sessions: completed + scheduled */
          <>
            {[...program.sessions]
              .sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime())
              .map((session) => {
                const expanded = expandedSessionId === session.id;
                const isCompleted = session.status === "COMPLETED";
                const isScheduled = session.status === "SCHEDULED";

                return (
                  <div key={session.id}>
                    <div
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all",
                        isCompleted
                          ? "bg-emerald-50 border-emerald-100 cursor-pointer hover:bg-emerald-100"
                          : isScheduled
                            ? "bg-blue-50 border-blue-200"
                            : "bg-slate-50 border-transparent opacity-60"
                      )}
                      onClick={() => isCompleted && setExpandedSessionId(expanded ? null : session.id)}
                    >
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                        isCompleted ? "bg-emerald-500 text-white"
                          : isScheduled ? "bg-blue-500 text-white"
                          : "bg-slate-200 text-slate-400"
                      )}>
                        {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Calendar className="w-3 h-3" />}
                      </div>
                      <span className="text-xs font-medium text-petra-text flex-1">
                        {isScheduled ? "מפגש מתוזמן" : `מפגש ${session.sessionNumber || ""}`}
                      </span>
                      {isCompleted && (
                        <>
                          <span className="text-[10px] text-petra-muted">{formatDate(session.sessionDate)}</span>
                          {session.rating && <span className="text-[10px] text-amber-500">{"★".repeat(session.rating)}</span>}
                          {onEditSession && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onEditSession(session); }}
                              className="w-5 h-5 flex items-center justify-center rounded hover:bg-emerald-100 text-slate-300 hover:text-emerald-600 transition-colors"
                              title="ערוך מפגש"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); if (confirm("למחוק את רישום המפגש?")) deleteSessionMutation.mutate(session.id); }}
                            disabled={deleteSessionMutation.isPending}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 text-slate-300 hover:text-red-500 transition-colors"
                            title="מחק מפגש"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform", expanded && "rotate-180")} />
                        </>
                      )}
                      {isScheduled && (
                        <>
                          <span className="text-[10px] text-blue-600 font-medium">{formatSessionDateTime(session.sessionDate)}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const d = new Date(session.sessionDate);
                              const pad = (n: number) => String(n).padStart(2, "0");
                              setEditingSession(editingSession?.id === session.id ? null : {
                                id: session.id,
                                date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
                                time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
                                duration: session.durationMinutes ?? 60,
                              });
                            }}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-colors"
                            title="ערוך מועד"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          {onCancelSession && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onCancelSession(session.id); }}
                              className="text-[10px] text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors"
                            >
                              ביטול
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    {editingSession && editingSession.id === session.id && isScheduled && (() => {
                      const es = editingSession;
                      return (
                        <div className="mx-3 mt-0.5 mb-1 p-3 bg-blue-50 border border-blue-200 rounded-xl" onClick={(e) => e.stopPropagation()}>
                          <p className="text-[10px] font-semibold text-blue-700 mb-2">עריכת מועד מפגש</p>
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <label className="label text-[10px]">תאריך</label>
                              <input type="date" lang="he" className="input text-xs py-1.5" value={es.date} onChange={(e) => setEditingSession({ id: es.id, date: e.target.value, time: es.time, duration: es.duration })} />
                            </div>
                            <div className="flex-1">
                              <label className="label text-[10px]">שעה</label>
                              <input type="time" className="input text-xs py-1.5" value={es.time} onChange={(e) => setEditingSession({ id: es.id, date: es.date, time: e.target.value, duration: es.duration })} />
                            </div>
                            <div className="w-20">
                              <label className="label text-[10px]">משך (דקות)</label>
                              <select className="input text-xs py-1.5" value={es.duration} onChange={(e) => setEditingSession({ id: es.id, date: es.date, time: es.time, duration: parseInt(e.target.value) })}>
                          {(DURATION_OPTIONS.includes(es.duration) ? DURATION_OPTIONS : [es.duration, ...DURATION_OPTIONS].sort((a, b) => a - b)).map((d) => (
                            <option key={d} value={d}>{d} דק׳</option>
                          ))}
                        </select>
                            </div>
                            <button className="btn-primary text-xs py-1.5" disabled={rescheduleSessionMutation.isPending || !es.date || !es.time} onClick={() => rescheduleSessionMutation.mutate({ sessionId: es.id, date: es.date, time: es.time, duration: es.duration })}>
                              {rescheduleSessionMutation.isPending ? "שומר..." : "שמור"}
                            </button>
                            <button className="btn-secondary text-xs py-1.5" onClick={() => setEditingSession(null)}>ביטול</button>
                          </div>
                        </div>
                      );
                    })()}
                    {expanded && (
                      <div className="mx-3 mt-0.5 mb-1 p-3 bg-white border border-emerald-100 rounded-xl text-xs space-y-1.5">
                        {session.practiceItems && <div><span className="font-semibold text-petra-muted">תרגילים: </span>{session.practiceItems}</div>}
                        {session.nextSessionGoals && <div><span className="font-semibold text-petra-muted">יעדים הבאים: </span>{session.nextSessionGoals}</div>}
                        {session.homeworkForCustomer && <div><span className="font-semibold text-petra-muted">שיעורי בית: </span>{session.homeworkForCustomer}</div>}
                        {session.summary && <div><span className="font-semibold text-petra-muted">סיכום: </span>{session.summary}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
          </>
        )}
      </div>

      {/* Bottom action buttons */}
      {program.status === "ACTIVE" && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={isAdding}
            onClick={onAddSession}
            className="flex-1 py-2 rounded-xl border-2 border-dashed border-brand-200 text-xs font-semibold text-brand-500 hover:bg-brand-50 hover:border-brand-400 transition-all flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            רשום מפגש
          </button>
          {onScheduleSession && (
            <button
              type="button"
              onClick={() => onScheduleSession(usedSessions + 1)}
              className="flex-1 py-2 rounded-xl border-2 border-dashed border-blue-200 text-xs font-semibold text-blue-500 hover:bg-blue-50 hover:border-blue-400 transition-all flex items-center justify-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              קבע מפגש קדימה
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SERVICE DOG PHASE ROW
// ═══════════════════════════════════════════════════════

function ServiceDogPhaseRow({ program }: { program: TrainingProgram }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (programType: string) =>
      fetchJSON(`/api/training-programs/${program.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programType }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-programs-service"] });
      toast.success("שלב עודכן ✓");
    },
    onError: () => toast.error("שגיאה בעדכון שלב"),
  });

  const currentIdx = SERVICE_DOG_PHASES.findIndex((p) => p.value === program.programType);

  return (
    <div className="mb-4 p-3 rounded-xl bg-brand-50 border border-brand-100 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
          <span className="text-xs font-semibold text-brand-700">שלב הכשרה</span>
        </div>
        <a href="/service-dogs/dogs" className="text-[10px] text-brand-600 hover:text-brand-700 font-medium flex items-center gap-0.5">
          פרופיל מלא ←
        </a>
      </div>
      {/* Phase dots */}
      <div className="flex items-center gap-1.5">
        {SERVICE_DOG_PHASES.map((phase, idx) => (
          <button
            key={phase.value}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(phase.value)}
            className="flex flex-col items-center gap-1 group"
            title={phase.label}
          >
            <span className={cn(
              "w-4 h-4 rounded-full border-2 transition-all",
              idx < currentIdx ? "bg-brand-500 border-brand-500" :
              idx === currentIdx ? "bg-brand-500 border-brand-500 ring-2 ring-brand-200" :
              "bg-white border-slate-300 group-hover:border-brand-400"
            )} />
            <span className={cn(
              "text-[9px] font-medium whitespace-nowrap",
              idx === currentIdx ? "text-brand-600" : "text-petra-muted"
            )}>
              {phase.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SERVICE DOG SESSION LOG
// ═══════════════════════════════════════════════════════

function ServiceDogSessionLog({
  programs,
  searchQuery,
  onMarkAttendance,
  isMarkingAttendance,
  onEditSettings,
  onFinishProgram,
  onDropoutProgram,
  isUpdatingStatus,
}: {
  programs: TrainingProgram[];
  searchQuery: string;
  onMarkAttendance: (programId: string, sessionNumber: number, dogName: string, customerPhone?: string, customerName?: string) => void;
  onEditSettings: (program: TrainingProgram) => void;
  isMarkingAttendance: boolean;
  onFinishProgram?: (programId: string, dogName: string) => void;
  onDropoutProgram?: (programId: string, dogName: string) => void;
  isUpdatingStatus?: boolean;
}) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return programs;
    const q = searchQuery.toLowerCase();
    return programs.filter((p) => p.dog.name.toLowerCase().includes(q));
  }, [programs, searchQuery]);

  if (filtered.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Shield className="w-6 h-6 text-slate-400" /></div>
        <h3 className="text-base font-semibold text-petra-text mb-1">אין תוכניות אילוף לכלבי שירות</h3>
        <p className="text-sm text-petra-muted">
          <a href="/service-dogs" className="text-brand-600 hover:underline">עבור לניהול כלבי שירות</a>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {filtered.map((program) => {
        const completedSessions = [...program.sessions]
          .filter((s) => s.status === "COMPLETED")
          .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
        const usedSessions = completedSessions.length;
        const statusInfo = PROGRAM_STATUS_MAP[program.status] || PROGRAM_STATUS_MAP.ACTIVE;

        return (
          <div key={program.id} id={`tcard-${program.id}`} className="card overflow-hidden">
            {/* Program header */}
            <div className="p-4 border-b border-petra-border bg-brand-50/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-petra-text">{program.dog.name}</h3>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusInfo.color)}>{statusInfo.label}</span>
                    {program.programType && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-brand-100 text-brand-700">
                        {SERVICE_DOG_PHASES.find((p) => p.value === program.programType)?.label ?? program.programType}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-petra-muted">
                    <span>{usedSessions} אימונים בוצעו</span>
                    {program.startDate && <span>• התחיל {formatDate(program.startDate)}</span>}
                  </div>
                </div>
                <a href={`/service-dogs/${program.dog.id}`} className="text-xs text-brand-600 hover:underline flex items-center gap-0.5 flex-shrink-0">
                  פרופיל ←
                </a>
              </div>
              {/* Actions — no finish/dropout for service dogs; managed via service dogs system */}
              <div className="flex gap-2 mt-3 flex-wrap">
                <button className="btn-secondary text-xs" onClick={() => onEditSettings(program)}>
                  <Settings className="w-3.5 h-3.5" /> הגדרות
                </button>
                <a href={`/service-dogs/${program.dog.id}`} className="btn-secondary text-xs flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" /> ניהול כלב שירות ←
                </a>
              </div>
            </div>

            {/* Session log */}
            <div className="p-4">
              <h4 className="text-xs font-semibold text-petra-muted mb-3 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                יומן אימונים
              </h4>

              {completedSessions.length === 0 ? (
                <p className="text-xs text-petra-muted text-center py-4">טרם בוצעו אימונים</p>
              ) : (
                <div className="space-y-2">
                  {completedSessions.map((session) => (
                    <div key={session.id} className="p-3 rounded-xl bg-slate-50 border border-petra-border text-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-petra-text">אימון {session.sessionNumber}</span>
                        <div className="flex items-center gap-2">
                          {session.rating && <span className="text-amber-500">{"★".repeat(session.rating)}</span>}
                          <span className="text-petra-muted">{formatDate(session.sessionDate)}</span>
                        </div>
                      </div>
                      {session.practiceItems && (
                        <div className="mb-1.5">
                          <span className="font-medium text-petra-muted">📝 תרגילים: </span>
                          <span className="text-petra-text whitespace-pre-line">{session.practiceItems}</span>
                        </div>
                      )}
                      {session.summary && (
                        <div className="mb-1.5">
                          <span className="font-medium text-petra-muted">💬 סיכום: </span>
                          <span className="text-petra-text whitespace-pre-line">{session.summary}</span>
                        </div>
                      )}
                      {session.nextSessionGoals && (
                        <div className="mb-1.5">
                          <span className="font-medium text-petra-muted">🎯 יעדים לאימון הבא: </span>
                          <span className="text-petra-text whitespace-pre-line">{session.nextSessionGoals}</span>
                        </div>
                      )}
                      {session.homeworkForCustomer && (
                        <div className="mb-1.5">
                          <span className="font-medium text-petra-muted">📋 הערות לצוות: </span>
                          <span className="text-petra-text whitespace-pre-line">{session.homeworkForCustomer}</span>
                        </div>
                      )}
                      {(session as { trainerName?: string | null }).trainerName && (
                        <div className="mt-1 text-[11px] text-petra-muted">
                          👤 מאמן: {(session as { trainerName?: string | null }).trainerName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Print training history */}
              {completedSessions.length > 0 && (
                <button
                  type="button"
                  className="mt-2 w-full py-1.5 rounded-xl border border-slate-200 text-xs text-petra-muted hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5"
                  onClick={() => {
                    const win = window.open("", "_blank");
                    if (!win) return;
                    win.document.write(`<html dir="rtl"><head><title>יומן אימונים — ${escapeHtml(program.dog.name)}</title><style>body{font-family:sans-serif;padding:24px;direction:rtl}h1{font-size:20px;margin-bottom:4px}h2{font-size:13px;color:#666;margin-bottom:20px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:8px;text-align:right}th{background:#f3f4f6}@media print{button{display:none}}</style></head><body>`);
                    win.document.write(`<h1>יומן אימונים — ${escapeHtml(program.dog.name)}</h1><h2>סה"כ ${completedSessions.length} אימונים · הודפס ${new Date().toLocaleDateString("he-IL")}</h2>`);
                    win.document.write(`<table><thead><tr><th>#</th><th>תאריך</th><th>מאמן</th><th>דירוג</th><th>תרגילים</th><th>יעדים הבאים</th><th>הערות לצוות</th><th>סיכום</th></tr></thead><tbody>`);
                    completedSessions.forEach((s) => {
                      const sTyped = s as { sessionNumber?: number | null; sessionDate: string; trainerName?: string | null; rating?: number | null; practiceItems?: string | null; nextSessionGoals?: string | null; homeworkForCustomer?: string | null; summary?: string | null };
                      win.document.write(`<tr><td>${sTyped.sessionNumber ?? ""}</td><td>${new Date(sTyped.sessionDate).toLocaleDateString("he-IL")}</td><td>${escapeHtml(sTyped.trainerName)}</td><td>${sTyped.rating ? "★".repeat(sTyped.rating) : ""}</td><td>${escapeHtml(sTyped.practiceItems)?.replace(/\n/g, "<br>")}</td><td>${escapeHtml(sTyped.nextSessionGoals)?.replace(/\n/g, "<br>")}</td><td>${escapeHtml(sTyped.homeworkForCustomer)?.replace(/\n/g, "<br>")}</td><td>${escapeHtml(sTyped.summary)?.replace(/\n/g, "<br>")}</td></tr>`);
                    });
                    win.document.write("</tbody></table></body></html>");
                    win.document.close();
                    win.print();
                  }}
                >
                  <Printer className="w-3.5 h-3.5" />
                  הדפס יומן אימונים
                </button>
              )}

              {/* Add session button */}
              {program.status === "ACTIVE" && (
                <button
                  type="button"
                  disabled={isMarkingAttendance}
                  onClick={() => onMarkAttendance(program.id, usedSessions + 1, program.dog.name, program.customer?.phone ?? "", program.customer?.name ?? "")}
                  className="mt-3 w-full py-2.5 rounded-xl border-2 border-dashed border-brand-200 text-xs font-semibold text-brand-500 hover:bg-brand-50 hover:border-brand-400 transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  הוסף אימון +
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════

function IndividualTab({
  programs,
  groups,
  searchQuery,
  expandedCards,
  toggleExpand,
  onMarkAttendance,
  isMarkingAttendance,
  onEditSettings,
  onFinishProgram,
  onDropoutProgram,
  onConvertToGroup,
  onDeleteProgram,
  isUpdatingStatus,
  onScheduleSession,
  onCancelSession,
  onEditSession,
}: {
  programs: TrainingProgram[];
  groups?: TrainingGroup[];
  searchQuery: string;
  expandedCards: Set<string>;
  toggleExpand: (id: string) => void;
  onMarkAttendance: (programId: string, sessionNumber: number, dogName: string, customerPhone?: string, customerName?: string) => void;
  onEditSettings: (program: TrainingProgram) => void;
  isMarkingAttendance: boolean;
  onFinishProgram?: (programId: string, dogName: string) => void;
  onDropoutProgram?: (programId: string, dogName: string) => void;
  onConvertToGroup?: (program: TrainingProgram) => void;
  onDeleteProgram?: (program: TrainingProgram) => void;
  isUpdatingStatus?: boolean;
  onScheduleSession?: (programId: string, sessionNumber: number, dogName: string, customerId?: string, customerName?: string, customerPhone?: string) => void;
  onCancelSession?: (programId: string, sessionId: string) => void;
  onEditSession?: (programId: string, session: ProgramSession, dogName: string) => void;
}) {
  // Map dog IDs to their group names for cross-reference
  const dogGroupMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!groups) return map;
    for (const g of groups) {
      for (const p of g.participants) {
        if (p.status === "ACTIVE") map.set(p.dog.id, g.name);
      }
    }
    return map;
  }, [groups]);
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return programs;
    const q = searchQuery.toLowerCase();
    return programs.filter(
      (p) =>
        p.dog.name.toLowerCase().includes(q) ||
        p.customer?.name?.toLowerCase().includes(q)
    );
  }, [programs, searchQuery]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-petra-muted">{filtered.length} תוכניות אילוף</p>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><GraduationCap className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין תוכניות אילוף בבית לקוח</h3>
          <p className="text-sm text-petra-muted">חבילות אילוף יופיעו כאן לאחר מכירה דרך &ldquo;הזמנה חדשה&rdquo;</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((program) => {
            const expanded = expandedCards.has(program.id);
            const usedSessions = program.sessions.filter((s) => s.status === "COMPLETED").length;
            const remaining = program.totalSessions ? program.totalSessions - usedSessions : null;
            const allSessionsDone = !program.totalSessions || usedSessions >= program.totalSessions;
            const statusInfo = PROGRAM_STATUS_MAP[program.status] || PROGRAM_STATUS_MAP.ACTIVE;
            const isLowSessions = remaining !== null && remaining <= 2 && program.status === "ACTIVE";
            const typeColors = PROGRAM_TYPE_COLORS[program.programType];

            return (
              <div key={program.id} id={`tcard-${program.id}`} className="card overflow-hidden">
                <div
                  className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleExpand(program.id)}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: typeColors?.bg || "#EFF6FF" }}
                  >
                    <Dog className="w-5 h-5" style={{ color: typeColors?.text || "#2563EB" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-petra-text">{program.dog.name}</h3>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusInfo.color)}>
                        {statusInfo.label}
                      </span>
                      {isLowSessions && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          מפגשים נמוכים
                        </span>
                      )}
                      {dogGroupMap.get(program.dog.id) && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          גם בקבוצה: {dogGroupMap.get(program.dog.id)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-petra-muted">
                      <span>{program.customer?.name ?? ""}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{
                          background: typeColors?.bg || "#EFF6FF",
                          color: typeColors?.text || "#2563EB",
                        }}
                      >
                        {PROGRAM_TYPES_MAP[program.programType] || program.programType}
                      </span>
                      {program.price && (
                        <span>{formatCurrency(program.price)}</span>
                      )}
                    </div>
                  </div>

                  {/* Progress */}
                  {program.totalSessions && (
                    <div className="flex flex-col items-center gap-0.5 min-w-[60px]">
                      <span className="text-lg font-bold text-brand-500">
                        {usedSessions}/{program.totalSessions}
                      </span>
                      <div className="w-full h-1.5 rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand-500 transition-all"
                          style={{ width: `${Math.min(100, (usedSessions / program.totalSessions) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>

                {expanded && (
                  <div className="border-t border-petra-border p-4">
                    {/* Actions */}
                    <div className="flex gap-2 mb-4 flex-wrap">
                      <button
                        className="btn-secondary text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditSettings(program);
                        }}
                      >
                        <Settings className="w-3.5 h-3.5" />
                        הגדרות
                      </button>
                      {program.status === "ACTIVE" && onFinishProgram && (
                        <button
                          className={cn(
                            "btn-secondary text-xs border-emerald-200",
                            allSessionsDone
                              ? "text-emerald-600 hover:text-emerald-700 hover:border-emerald-300"
                              : "text-slate-400 cursor-not-allowed opacity-60"
                          )}
                          disabled={isUpdatingStatus || !allSessionsDone}
                          title={!allSessionsDone ? `יש להשלים את כל ${program.totalSessions} המפגשים לפני סיום האילוף (הושלמו ${usedSessions})` : undefined}
                          onClick={(e) => { e.stopPropagation(); onFinishProgram(program.id, program.dog.name); }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          סיים אילוף
                          {!allSessionsDone && program.totalSessions && (
                            <span className="text-[10px] font-normal">({usedSessions}/{program.totalSessions})</span>
                          )}
                        </button>
                      )}
                      {program.status === "ACTIVE" && onDropoutProgram && (
                        <button
                          className="btn-secondary text-xs text-red-500 hover:text-red-600 border-red-200 hover:border-red-300"
                          disabled={isUpdatingStatus}
                          onClick={(e) => { e.stopPropagation(); onDropoutProgram(program.id, program.dog.name); }}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          נשר מתהליך
                        </button>
                      )}
                      {onConvertToGroup && (
                        <button
                          className="btn-secondary text-xs"
                          onClick={(e) => { e.stopPropagation(); onConvertToGroup(program); }}
                          title="העבר את הכלב מאילוף פרטני לקבוצה"
                        >
                          <Repeat className="w-3.5 h-3.5" />
                          המר לקבוצתי
                        </button>
                      )}
                      {onDeleteProgram && (
                        <button
                          className="btn-secondary text-xs text-red-500 hover:text-red-600 border-red-200 hover:border-red-300"
                          onClick={(e) => { e.stopPropagation(); onDeleteProgram(program); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          מחק תהליך
                        </button>
                      )}
                      {program.customer?.phone && (
                        <a
                          href={(() => {
                            const completedGoals = program.goals?.filter((g: { status: string }) => g.status === "ACHIEVED").length ?? 0;
                            const totalGoals = program.goals?.length ?? 0;
                            const completedHomework = program.homework?.filter((h: { isCompleted: boolean }) => h.isCompleted).length ?? 0;
                            const totalHomework = program.homework?.length ?? 0;
                            const lastSession = [...(program.sessions ?? [])].sort(
                              (a, b) => ((b.sessionNumber ?? 0) - (a.sessionNumber ?? 0))
                            )[0];
                            const lines = [
                              `שלום ${program.customer?.name ?? ""}! 🐾`,
                              `דוח התקדמות אילוף — ${program.dog.name}`,
                              "",
                              `📊 מפגשים: ${usedSessions}${program.totalSessions ? `/${program.totalSessions}` : ""}`,
                            ];
                            if (totalGoals > 0) lines.push(`🎯 יעדים: ${completedGoals}/${totalGoals} הושגו`);
                            if (totalHomework > 0) lines.push(`📝 שיעורי בית: ${completedHomework}/${totalHomework} הושלמו`);
                            if (lastSession?.summary) {
                              lines.push("", `💬 סיכום מפגש אחרון:`, lastSession.summary);
                            }
                            return `https://wa.me/${toWhatsAppPhone(program.customer?.phone ?? "")}?text=${encodeURIComponent(lines.join("\n"))}`;
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Send className="w-3.5 h-3.5" />
                          שלח דוח
                        </a>
                      )}
                      {program.customer?.phone && program.status === "COMPLETED" && (
                        <a
                          href={(() => {
                            const completedGoals = program.goals?.filter((g: { status: string }) => g.status === "ACHIEVED").length ?? 0;
                            const totalGoals = program.goals?.length ?? 0;
                            const lines = [
                              `🎓 *תעודת סיום אילוף*`,
                              "",
                              `כלב: ${program.dog.name}${program.dog.breed ? ` (${program.dog.breed})` : ""}`,
                              `בעלים: ${program.customer?.name ?? ""}`,
                              `תוכנית: ${program.name}`,
                              `מפגשים שהושלמו: ${usedSessions}`,
                              totalGoals > 0 ? `יעדים שהושגו: ${completedGoals}/${totalGoals}` : "",
                              "",
                              `🏆 ${program.dog.name} סיים/ה בהצלחה את תוכנית האילוף!`,
                              `מברכים אתכם ומאחלים המשך הנאה עם הכלב! 🐾`,
                            ].filter(Boolean);
                            return `https://wa.me/${toWhatsAppPhone(program.customer?.phone ?? "")}?text=${encodeURIComponent(lines.join("\n"))}`;
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-xs"
                          onClick={(e) => e.stopPropagation()}
                          title="שלח תעודת סיום"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          תעודת סיום
                        </a>
                      )}
                    </div>

                    {/* Details Info */}
                    <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-petra-muted bg-slate-50 p-3 rounded-xl border border-petra-border">
                      <div>
                        <span className="font-semibold block mb-0.5">תאריך התחלה</span>
                        {program.startDate ? formatDate(program.startDate) : "-"}
                      </div>
                      <div>
                        <span className="font-semibold block mb-0.5">יעד סיום משוער</span>
                        {program.endDate ? formatDate(program.endDate) : "-"}
                      </div>
                      <div>
                        <span className="font-semibold block mb-0.5">מיקום</span>
                        {program.location || "-"}
                      </div>
                      <div>
                        <span className="font-semibold block mb-0.5">תדירות מפגשים</span>
                        {program.frequency === "WEEKLY" ? "אחת לשבוע" :
                          program.frequency === "BIWEEKLY" ? "אחת לשבועיים" :
                            program.frequency || "-"}
                      </div>
                    </div>

                    {/* Order link */}
                    {program.orderId && (
                      <a
                        href={`/orders/${program.orderId}`}
                        className="mb-4 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 hover:bg-blue-100 transition-colors w-fit"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ShoppingCart className="w-3.5 h-3.5 flex-shrink-0" />
                        צפה בהזמנה המקורית
                      </a>
                    )}

                    {/* Service dog phase selector */}
                    {program.trainingType === "SERVICE_DOG" && (
                      <ServiceDogPhaseRow program={program} />
                    )}

                    {/* Behavior Baseline */}
                    {program.behaviorBaseline && (
                      <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                        <span className="font-semibold block mb-0.5">📋 קו בסיס התנהגותי</span>
                        {program.behaviorBaseline}
                      </div>
                    )}

                    {/* Goals */}
                    <GoalSection program={program} />

                    {/* Homework */}
                    <HomeworkSection program={program} />

                    {/* Session checklist */}
                    <SessionChecklist
                      program={program}
                      usedSessions={usedSessions}
                      onAddSession={() => onMarkAttendance(program.id, usedSessions + 1, program.dog.name, program.customer?.phone ?? "", program.customer?.name ?? "")}
                      isAdding={isMarkingAttendance}
                      onScheduleSession={onScheduleSession ? (num) => onScheduleSession(program.id, num, program.dog.name, program.customer?.id ?? undefined, program.customer?.name ?? undefined, program.customer?.phone ?? undefined) : undefined}
                      onCancelSession={onCancelSession ? (sessionId) => onCancelSession(program.id, sessionId) : undefined}
                      onEditSession={onEditSession ? (session) => onEditSession(program.id, session, program.dog.name) : undefined}
                    />

                    {/* Notes */}
                    {program.notes && (
                      <div className="mt-3 p-2 rounded-lg bg-amber-50 text-xs text-amber-800">{program.notes}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// BOARDING TRAINING TAB
// ═══════════════════════════════════════════════════════

function BoardingTrainingTab({
  stays,
  boardingPrograms,
  homePrograms,
  searchQuery,
  onAddTraining,
  onLogSession,
  onLogHomeSession,
}: {
  stays: BoardingStay[];
  boardingPrograms: TrainingProgram[];
  homePrograms: TrainingProgram[];
  searchQuery: string;
  onAddTraining: (stay: BoardingStay) => void;
  onLogSession: (programId: string, sessionNumber: number, dogName: string, goals?: { id: string; title: string; status: string; progressPercent: number }[]) => void;
  onLogHomeSession: (programId: string, sessionNumber: number, dogName: string) => void;
}) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return stays;
    const q = searchQuery.toLowerCase();
    return stays.filter(
      (s) =>
        s.pet.name.toLowerCase().includes(q) ||
        s.customer.name.toLowerCase().includes(q)
    );
  }, [stays, searchQuery]);

  if (filtered.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Hotel className="w-6 h-6 text-slate-400" /></div>
        <h3 className="text-base font-semibold text-petra-text mb-1">אין לינות פעילות</h3>
        <p className="text-sm text-petra-muted">לינות פעילות עם תוכניות אילוף יופיעו כאן</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filtered.map((stay) => {
        const linkedProgram = boardingPrograms.find((p) => p.boardingStayId === stay.id);
        const homeProgram = linkedProgram
          ? homePrograms.find((p) => p.dog.id === linkedProgram.dog.id && ["ACTIVE", "PAUSED"].includes(p.status))
          : null;
        const daysRemaining = stay.checkOut
          ? Math.ceil((new Date(stay.checkOut).getTime() - Date.now()) / 86400000)
          : null;
        const usedSessions = linkedProgram?.sessions?.filter((s) => s.status === "COMPLETED").length ?? 0;
        const nextSessionNum = usedSessions + 1;
        const homeUsedSessions = homeProgram?.sessions?.filter((s) => s.status === "COMPLETED").length ?? 0;
        const homeNextSession = homeUsedSessions + 1;

        return (
          <div key={stay.id} className="card p-0 overflow-hidden">
            {/* ── Card header ── */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                {linkedProgram ? (
                  linkedProgram.startDate && linkedProgram.endDate ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> פעיל
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">חסרים תאריכים</span>
                  )
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">ללא תוכנית</span>
                )}
                {daysRemaining !== null && (
                  <span className={cn(
                    "text-[10px] font-medium px-2 py-0.5 rounded-full",
                    daysRemaining <= 1 ? "bg-red-100 text-red-700" :
                    daysRemaining <= 3 ? "bg-amber-100 text-amber-700" :
                    "bg-slate-100 text-slate-600"
                  )}>
                    נותרו {Math.max(0, daysRemaining)} ימים
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <div>
                  <p className="text-sm font-bold text-petra-text text-right">{stay.pet.name}</p>
                  <p className="text-xs text-petra-muted text-right">{stay.customer.name}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Hotel className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </div>

            {/* ── Stay dates row ── */}
            <div className="flex items-center justify-end gap-3 text-xs text-petra-muted bg-slate-50 px-4 py-2 border-t border-b">
              {stay.checkOut && <span>יציאה: {formatDate(stay.checkOut)}</span>}
              {stay.checkOut && <span>•</span>}
              <span>כניסה: {formatDate(stay.checkIn)}</span>
              <span>•</span>
              <span>{stay.room?.name ?? "ללא חדר"}</span>
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            </div>

            {/* ── Program section ── */}
            <div className="px-4 pb-4 pt-3">
              {linkedProgram ? (
                <div className="space-y-3">
                  {(linkedProgram.startDate || linkedProgram.endDate) && (
                    <div className="flex items-center justify-end gap-2 text-xs text-petra-muted">
                      {linkedProgram.endDate && <span>סיום: {formatDate(linkedProgram.endDate)}</span>}
                      {linkedProgram.startDate && linkedProgram.endDate && <span>•</span>}
                      {linkedProgram.startDate && <span>התחלה: {formatDate(linkedProgram.startDate)}</span>}
                    </div>
                  )}
                  <div className="space-y-2">
                    {linkedProgram.behaviorBaseline && (
                      <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                        <p className="text-[10px] font-bold text-blue-600 mb-1">בסיס התנהגותי</p>
                        <p className="text-xs text-petra-text">{linkedProgram.behaviorBaseline}</p>
                      </div>
                    )}
                    {linkedProgram.customerExpectations && (
                      <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
                        <p className="text-[10px] font-bold text-purple-600 mb-1">ציפיות הלקוח</p>
                        <p className="text-xs text-petra-text">{linkedProgram.customerExpectations}</p>
                      </div>
                    )}
                    {linkedProgram.workPlan && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                        <p className="text-[10px] font-bold text-amber-600 mb-1">תוכנית עבודה — גלוי לצוות</p>
                        <p className="text-xs text-petra-text whitespace-pre-line">{linkedProgram.workPlan}</p>
                      </div>
                    )}
                  </div>
                  <GoalSection program={linkedProgram} label="יעדי אילוף — לפני יציאה לבית" />
                  {linkedProgram.sessions && linkedProgram.sessions.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-petra-muted">עדכונים שבועיים ({usedSessions})</p>
                      {linkedProgram.sessions.slice(0, 3).map((s) => (
                        <div key={s.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-0.5">
                          <p className="font-semibold text-petra-text">{formatDate(s.sessionDate)}</p>
                          {s.practiceItems && <p className="text-brand-700">✓ {s.practiceItems}</p>}
                          {s.summary && <p className="text-petra-muted">{s.summary}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    className="btn-primary text-sm w-full mt-1"
                    onClick={() => onLogSession(linkedProgram.id, nextSessionNum, stay.pet.name, linkedProgram.goals)}
                  >
                    <Plus className="w-4 h-4" />
                    עדכון שבועי {nextSessionNum > 1 ? `(שבוע ${nextSessionNum})` : "(שבוע 1)"}
                  </button>
                  {homeProgram && (
                    <button
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mt-1 border border-green-200 bg-green-50 text-green-800 hover:bg-green-100"
                      onClick={() => onLogHomeSession(homeProgram.id, homeNextSession, stay.pet.name)}
                    >
                      <span className="text-[11px] text-green-600">
                        {homeProgram.totalSessions ? `${homeUsedSessions}/${homeProgram.totalSessions} מפגשים` : `${homeUsedSessions} מפגשים`}
                      </span>
                      <div className="flex items-center gap-1.5">
                        מפגש בית הלקוח {homeNextSession > 1 ? `(${homeNextSession})` : ""}
                        <Home className="w-4 h-4" />
                      </div>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {daysRemaining !== null && daysRemaining <= 3 && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-red-700">
                          {daysRemaining <= 0 ? "הכלב צפוי לצאת היום!" : `נותרו ${daysRemaining} ימים בלבד`}
                        </p>
                        <p className="text-[10px] text-red-600 mt-0.5">טרם נוצרה תוכנית אילוף לפנסיון</p>
                      </div>
                    </div>
                  )}
                  <button
                    className={cn(
                      "text-sm w-full",
                      daysRemaining !== null && daysRemaining <= 3
                        ? "btn-primary bg-red-500 hover:bg-red-600"
                        : "btn-secondary"
                    )}
                    onClick={() => onAddTraining(stay)}
                  >
                    <Plus className="w-4 h-4" />
                    צור תוכנית אילוף לפנסיון
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// GROUPS TAB
// ═══════════════════════════════════════════════════════

function GroupsTab({
  groups,
  searchQuery,
  expandedCards,
  toggleExpand,
  onNewGroup,
  onEditGroup,
  onAssignDog,
  onRemoveParticipant,
  onConvertParticipant,
  onDeleteGroup,
}: {
  groups: TrainingGroup[];
  searchQuery: string;
  expandedCards: Set<string>;
  toggleExpand: (id: string) => void;
  onNewGroup: () => void;
  onEditGroup: (group: TrainingGroup) => void;
  onAssignDog: (groupId: string, groupName: string) => void;
  onRemoveParticipant: (groupId: string, participantId: string) => void;
  onConvertParticipant: (groupId: string, participantId: string, dogName: string) => void;
  onDeleteGroup: (groupId: string, groupName: string) => void;
}) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.participants.some(
          (p) => p.dog.name.toLowerCase().includes(q) || (p.customer?.name ?? "").toLowerCase().includes(q)
        )
    );
  }, [groups, searchQuery]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-petra-muted">{filtered.length} קבוצות</p>
        <button className="btn-primary" onClick={onNewGroup}>
          <Plus className="w-4 h-4" />
          קבוצה חדשה
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Users className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין קבוצות אימון</h3>
          <p className="text-sm text-petra-muted">צור קבוצת אימון חדשה כדי להתחיל</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              expanded={expandedCards.has(group.id)}
              onToggle={() => toggleExpand(group.id)}
              onEditGroup={() => onEditGroup(group)}
              onAssignDog={() => onAssignDog(group.id, group.name)}
              onRemoveParticipant={(participantId) => onRemoveParticipant(group.id, participantId)}
              onConvertParticipant={(participantId, dogName) => onConvertParticipant(group.id, participantId, dogName)}
              onDeleteGroup={() => onDeleteGroup(group.id, group.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// WORKSHOPS TAB
// ═══════════════════════════════════════════════════════

function WorkshopsTab({
  workshops,
  searchQuery,
  expandedCards,
  toggleExpand,
  onNewWorkshop,
  onEditGroup,
  onAssignDog,
  onRemoveParticipant,
  onConvertParticipant,
  onDeleteGroup,
}: {
  workshops: TrainingGroup[];
  searchQuery: string;
  expandedCards: Set<string>;
  toggleExpand: (id: string) => void;
  onNewWorkshop: () => void;
  onEditGroup: (group: TrainingGroup) => void;
  onAssignDog: (groupId: string, groupName: string) => void;
  onRemoveParticipant: (groupId: string, participantId: string) => void;
  onConvertParticipant: (groupId: string, participantId: string, dogName: string) => void;
  onDeleteGroup: (groupId: string, groupName: string) => void;
}) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return workshops;
    const q = searchQuery.toLowerCase();
    return workshops.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.participants.some(
          (p) => p.dog.name.toLowerCase().includes(q) || (p.customer?.name ?? "").toLowerCase().includes(q)
        )
    );
  }, [workshops, searchQuery]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-petra-muted">{filtered.length} סדנאות</p>
        <button className="btn-primary" onClick={onNewWorkshop}>
          <Plus className="w-4 h-4" />
          סדנה חדשה
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Calendar className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין סדנאות</h3>
          <p className="text-sm text-petra-muted">צור סדנה חדשה כדי להתחיל</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((workshop) => (
            <GroupCard
              key={workshop.id}
              group={workshop}
              expanded={expandedCards.has(workshop.id)}
              onToggle={() => toggleExpand(workshop.id)}
              onEditGroup={() => onEditGroup(workshop)}
              onAssignDog={() => onAssignDog(workshop.id, workshop.name)}
              onRemoveParticipant={(participantId) => onRemoveParticipant(workshop.id, participantId)}
              onConvertParticipant={(participantId, dogName) => onConvertParticipant(workshop.id, participantId, dogName)}
              onDeleteGroup={() => onDeleteGroup(workshop.id, workshop.name)}
              isWorkshop
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// GROUP / WORKSHOP CARD
// ═══════════════════════════════════════════════════════

function GroupCard({
  group,
  expanded,
  onToggle,
  onEditGroup,
  onAssignDog,
  onRemoveParticipant,
  onConvertParticipant,
  onDeleteGroup,
  isWorkshop = false,
}: {
  group: TrainingGroup;
  expanded: boolean;
  onToggle: () => void;
  onEditGroup: () => void;
  onAssignDog: () => void;
  onRemoveParticipant: (participantId: string) => void;
  onConvertParticipant?: (participantId: string, dogName: string) => void;
  onDeleteGroup?: () => void;
  isWorkshop?: boolean;
}) {
  const queryClient = useQueryClient();
  const [expandedAttendanceSession, setExpandedAttendanceSession] = useState<string | null>(null);
  const [sessionNotesInput, setSessionNotesInput] = useState<Record<string, string>>({});
  const [showAddSession, setShowAddSession] = useState(false);
  const [editingSession, setEditingSession] = useState<{ id: string; date: string; time: string } | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const defaultTime = group.defaultTime || "10:00";
  const [newSessionDate, setNewSessionDate] = useState(today);
  const [newSessionTime, setNewSessionTime] = useState(defaultTime);
  const [seriesCount, setSeriesCount] = useState(8);

  const addSessionMutation = useMutation({
    mutationFn: () =>
      fetchJSON(`/api/training-groups/${group.id}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionDatetime: new Date(`${newSessionDate}T${newSessionTime}:00`).toISOString(), status: "SCHEDULED" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-groups"] });
      queryClient.invalidateQueries({ queryKey: ["training-group-sessions-cal"] });
      setShowAddSession(false);
      toast.success("מפגש נוצר בהצלחה");
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה ביצירת מפגש"),
  });

  const generateSeriesMutation = useMutation({
    mutationFn: () =>
      fetchJSON(`/api/training-groups/${group.id}/sessions/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: seriesCount, startDate: new Date(`${newSessionDate}T${newSessionTime}:00`).toISOString(), time: newSessionTime }),
      }) as Promise<{ created?: number }>,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["training-groups"] });
      queryClient.invalidateQueries({ queryKey: ["training-group-sessions-cal"] });
      setShowAddSession(false);
      toast.success(`נוצרו ${res?.created ?? seriesCount} מפגשים שבועיים`);
    },
    onError: () => toast.error("שגיאה ביצירת סדרת מפגשים"),
  });
  const typeColor = GROUP_TYPE_COLORS[group.groupType] || GROUP_TYPE_COLORS.CUSTOM;

  const attendanceMutation = useMutation({
    mutationFn: ({ attendanceId, status }: { attendanceId: string; status: string }) =>
      fetchJSON(`/api/training-attendance/${attendanceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceStatus: status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["training-groups"] }),
    onError: () => toast.error("שגיאה בעדכון נוכחות"),
  });

  const sessionNotesMutation = useMutation({
    mutationFn: ({ sessionId, notes }: { sessionId: string; notes: string }) =>
      fetchJSON(`/api/training-groups/${group.id}/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, status: "COMPLETED" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-groups"] });
      queryClient.invalidateQueries({ queryKey: ["training-group-sessions-cal"] });
      toast.success("סיכום המפגש נשמר");
    },
    onError: () => toast.error("שגיאה בשמירת הסיכום"),
  });

  const updateSessionDatetimeMutation = useMutation({
    mutationFn: ({ sessionId, date, time }: { sessionId: string; date: string; time: string }) =>
      fetchJSON(`/api/training-groups/${group.id}/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionDatetime: new Date(`${date}T${time}:00`).toISOString() }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-groups"] });
      queryClient.invalidateQueries({ queryKey: ["training-group-sessions-cal"] });
      setEditingSession(null);
      toast.success("מועד המפגש עודכן");
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה בעדכון מועד המפגש"),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      fetchJSON(`/api/training-groups/${group.id}/sessions/${sessionId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-groups"] });
      queryClient.invalidateQueries({ queryKey: ["training-group-sessions-cal"] });
      toast.success("המפגש נמחק");
    },
    onError: () => toast.error("שגיאה במחיקת המפגש"),
  });

  return (
    <div id={`tcard-${group.id}`} className="card overflow-hidden">
      <div
        className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={onToggle}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: typeColor.bg }}
        >
          {isWorkshop
            ? <Calendar className="w-5 h-5" style={{ color: typeColor.text }} />
            : <GraduationCap className="w-5 h-5" style={{ color: typeColor.text }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-petra-text">{group.name}</h3>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: typeColor.bg, color: typeColor.text }}
            >
              {GROUP_TYPE_LABELS[group.groupType] || group.groupType}
            </span>
            {!group.isActive && <span className="badge-danger text-[10px]">לא פעיל</span>}
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-petra-muted flex-wrap">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {group._count.participants} משתתפים
              {group.maxParticipants && ` / ${group.maxParticipants}`}
            </span>
            {group.defaultDayOfWeek !== null && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                יום {DAY_NAMES[group.defaultDayOfWeek]}
              </span>
            )}
            {group.defaultTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {group.defaultTime}
              </span>
            )}
            {group.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {group.location}
              </span>
            )}
            {group.startDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(group.startDate)}{group.endDate ? ` — ${formatDate(group.endDate)}` : ""}
              </span>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>

      {expanded && (
        <div className="border-t border-petra-border">
          {/* Actions */}
          <div className="p-4 pb-2 flex gap-2 flex-wrap">
            <button
              className="btn-primary text-xs"
              onClick={(e) => { e.stopPropagation(); setShowAddSession(!showAddSession); }}
            >
              <Plus className="w-3.5 h-3.5" />
              הוסף מפגש
            </button>
            <button className="btn-secondary text-xs" onClick={(e) => { e.stopPropagation(); onAssignDog(); }}>
              <Plus className="w-3.5 h-3.5" />
              שייך לקוח
            </button>
            <button className="btn-secondary text-xs" onClick={(e) => { e.stopPropagation(); onEditGroup(); }}>
              <Pencil className="w-3.5 h-3.5" />
              {isWorkshop ? "ערוך סדנה" : "ערוך קבוצה"}
            </button>
            {onDeleteGroup && (
              <button
                className="btn-secondary text-xs text-red-500 hover:text-red-600 border-red-200 hover:border-red-300"
                onClick={(e) => { e.stopPropagation(); onDeleteGroup(); }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isWorkshop ? "מחק סדנה" : "מחק קבוצה"}
              </button>
            )}
            {isWorkshop && group.participants.length > 0 && (
              <button
                className="btn-secondary text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  // Open WhatsApp for each participant
                  group.participants.forEach((p) => {
                    if (p.customer?.phone ?? "") {
                      const phone = toWhatsAppPhone(p.customer?.phone ?? "");
                      const msg = encodeURIComponent(
                        `היי! תזכורת לסדנת "${group.name}"${group.location ? ` ב${group.location}` : ""}${group.defaultTime ? ` בשעה ${group.defaultTime}` : ""}. נתראה!`
                      );
                      window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
                    }
                  });
                }}
              >
                <Send className="w-3.5 h-3.5" />
                שלח תזכורת
              </button>
            )}
          </div>

          {/* Add Session Inline Form */}
          {showAddSession && (
            <div className="mx-4 mb-3 p-3 rounded-xl bg-brand-50 border border-brand-100 space-y-2">
              <p className="text-xs font-semibold text-brand-700">מפגש חדש</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="label text-[10px]">תאריך</label>
                  <input
                    type="date" lang="he"
                    className="input text-xs py-1.5"
                    value={newSessionDate}
                    onChange={(e) => setNewSessionDate(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="flex-1">
                  <label className="label text-[10px]">שעה</label>
                  <input
                    type="time"
                    className="input text-xs py-1.5"
                    value={newSessionTime}
                    onChange={(e) => setNewSessionTime(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-primary text-xs flex-1"
                  disabled={addSessionMutation.isPending || !newSessionDate}
                  onClick={(e) => { e.stopPropagation(); addSessionMutation.mutate(); }}
                >
                  {addSessionMutation.isPending ? "יוצר..." : "צור מפגש"}
                </button>
                <button
                  className="btn-secondary text-xs"
                  onClick={(e) => { e.stopPropagation(); setShowAddSession(false); }}
                >
                  ביטול
                </button>
              </div>
              {/* Recurring weekly series */}
              <div className="pt-2 mt-1 border-t border-brand-100 flex items-end gap-2">
                <div className="flex-1">
                  <label className="label text-[10px]">סדרה שבועית (מספר מפגשים)</label>
                  <input
                    type="number" min={1} max={52}
                    className="input text-xs py-1.5"
                    value={seriesCount}
                    onChange={(e) => setSeriesCount(parseInt(e.target.value, 10) || 1)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <button
                  className="btn-secondary text-xs whitespace-nowrap"
                  disabled={generateSeriesMutation.isPending || !newSessionDate || seriesCount < 1}
                  onClick={(e) => { e.stopPropagation(); generateSeriesMutation.mutate(); }}
                  title="יוצר מפגשים שבועיים החל מהתאריך/שעה שנבחרו"
                >
                  {generateSeriesMutation.isPending ? "יוצר..." : `צור סדרה (${seriesCount})`}
                </button>
              </div>
            </div>
          )}

          {/* Participants */}
          <div className="p-4 border-b border-petra-border">
            <h4 className="text-xs font-semibold text-petra-muted mb-3 flex items-center gap-1.5">
              <Dog className="w-3.5 h-3.5" />
              משתתפים ({group.participants.length})
            </h4>
            {group.participants.length === 0 ? (
              <p className="text-xs text-petra-muted">אין משתתפים רשומים</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.participants.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 group/item">
                    <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center text-xs font-bold text-brand-600">
                      {p.dog.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-petra-text truncate">
                        {p.dog.name}
                        {p.dog.breed && <span className="text-petra-muted font-normal"> ({p.dog.breed})</span>}
                      </p>
                      <p className="text-[10px] text-petra-muted truncate">{p.customer?.name ?? ""}</p>
                    </div>
                    {onConvertParticipant && (
                      <button
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-brand-50 text-slate-300 hover:text-brand-600 opacity-0 group-hover/item:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); onConvertParticipant(p.id, p.dog.name); }}
                        title="המר לאילוף פרטני"
                      >
                        <Repeat className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-slate-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); onRemoveParticipant(p.id); }}
                      title="הסר משתתף"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Sessions */}
          <div className="p-4">
            <h4 className="text-xs font-semibold text-petra-muted mb-3 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              מפגשים ({group._count.sessions})
            </h4>
            {group.sessions.length === 0 ? (
              <p className="text-xs text-petra-muted">אין מפגשים</p>
            ) : (
              <div className="space-y-1.5">
                {group.sessions.slice(0, 5).map((session) => {
                  const isAttendanceOpen = expandedAttendanceSession === session.id;
                  const presentCount = session.attendance.filter((a) => a.attendanceStatus === "PRESENT").length;
                  return (
                    <div key={session.id} className="rounded-lg bg-slate-50 overflow-hidden">
                      <div className="flex items-center gap-3 p-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full flex-shrink-0",
                          session.status === "COMPLETED" ? "bg-emerald-500" :
                            session.status === "CANCELED" ? "bg-red-400" : "bg-blue-400"
                        )} />
                        <span className="text-xs text-petra-text">מפגש {session.sessionNumber || ""}</span>
                        <span className="text-[10px] text-petra-muted">{formatDate(session.sessionDatetime)}</span>
                        <span className="text-[10px] badge-neutral">{presentCount}/{session.attendance.length || group.participants.length} נוכחים</span>
                        <div className="ms-auto flex items-center gap-1.5">
                          {session.attendance.length > 0 && (
                            <button
                              className="text-[10px] text-brand-600 hover:text-brand-700 font-medium"
                              onClick={(e) => { e.stopPropagation(); setExpandedAttendanceSession(isAttendanceOpen ? null : session.id); }}
                            >
                              {isAttendanceOpen ? "סגור" : "סמן נוכחות"}
                            </button>
                          )}
                          <button
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-brand-50 text-slate-400 hover:text-brand-600"
                            title="שנה מועד מפגש"
                            onClick={(e) => {
                              e.stopPropagation();
                              const d = new Date(session.sessionDatetime);
                              const pad = (n: number) => String(n).padStart(2, "0");
                              setEditingSession(editingSession?.id === session.id ? null : {
                                id: session.id,
                                date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
                                time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
                              });
                            }}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                            title="מחק מפגש"
                            disabled={deleteSessionMutation.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`למחוק את מפגש ${session.sessionNumber || ""} בתאריך ${formatDate(session.sessionDatetime)}? הפעולה תסיר אותו גם מהיומן.`)) {
                                deleteSessionMutation.mutate(session.id);
                              }
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {editingSession?.id === session.id && (
                        <div className="px-3 pb-2 pt-1 border-t border-slate-200 flex items-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex-1">
                            <label className="label text-[10px]">תאריך</label>
                            <input
                              type="date" lang="he"
                              className="input text-xs py-1.5"
                              value={editingSession.date}
                              onChange={(e) => setEditingSession({ ...editingSession, date: e.target.value })}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="label text-[10px]">שעה</label>
                            <input
                              type="time"
                              className="input text-xs py-1.5"
                              value={editingSession.time}
                              onChange={(e) => setEditingSession({ ...editingSession, time: e.target.value })}
                            />
                          </div>
                          <button
                            className="btn-primary text-xs py-1.5"
                            disabled={updateSessionDatetimeMutation.isPending || !editingSession.date || !editingSession.time}
                            onClick={() => updateSessionDatetimeMutation.mutate({ sessionId: session.id, date: editingSession.date, time: editingSession.time })}
                          >
                            {updateSessionDatetimeMutation.isPending ? "שומר..." : "שמור"}
                          </button>
                          <button className="btn-secondary text-xs py-1.5" onClick={() => setEditingSession(null)}>
                            ביטול
                          </button>
                        </div>
                      )}
                      {isAttendanceOpen && (
                        <div className="px-3 pb-3 border-t border-slate-200 pt-2 space-y-1.5">
                          {session.attendance.map((att) => {
                            const participant = group.participants.find((p) => p.id === att.participantId);
                            const dogName = att.participant?.dog.name ?? participant?.dog.name ?? "כלב";
                            const customerName = att.participant?.customer.name ?? participant?.customer.name ?? "";
                            const isPresent = att.attendanceStatus === "PRESENT";
                            return (
                              <div key={att.id} className="flex items-center gap-2">
                                <button
                                  className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors flex-shrink-0",
                                    isPresent
                                      ? "bg-emerald-500 border-emerald-500 text-white"
                                      : "bg-white border-red-300 text-red-400"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    attendanceMutation.mutate({ attendanceId: att.id, status: isPresent ? "NO_SHOW" : "PRESENT" });
                                  }}
                                  disabled={attendanceMutation.isPending}
                                  title={isPresent ? "סמן כנעדר" : "סמן כנוכח"}
                                >
                                  {isPresent ? "✓" : "✗"}
                                </button>
                                <span className="text-xs text-petra-text font-medium">{dogName}</span>
                                {customerName && <span className="text-[10px] text-petra-muted">{customerName}</span>}
                                <span className={cn(
                                  "text-[10px] ms-auto",
                                  isPresent ? "text-emerald-600" : "text-red-500"
                                )}>
                                  {isPresent ? "נוכח" : "נעדר"}
                                </span>
                              </div>
                            );
                          })}
                          {/* Session notes */}
                          <div className="pt-2 border-t border-slate-100 space-y-1.5">
                            <p className="text-[10px] font-semibold text-petra-muted">סיכום מפגש</p>
                            <textarea
                              className="input text-xs py-1.5 resize-none w-full"
                              rows={2}
                              placeholder="מה עבדנו היום, הצלחות, נקודות לשיפור..."
                              value={sessionNotesInput[session.id] ?? session.notes ?? ""}
                              onChange={(e) => setSessionNotesInput((prev) => ({ ...prev, [session.id]: e.target.value }))}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button
                              className="btn-primary text-[11px] py-1 px-3"
                              disabled={sessionNotesMutation.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                sessionNotesMutation.mutate({ sessionId: session.id, notes: sessionNotesInput[session.id] ?? session.notes ?? "" });
                              }}
                            >
                              שמור סיכום
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MANUAL ADD PROGRAM MODAL
// ═══════════════════════════════════════════════════════

function ManualAddProgramModal({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [customerId, setCustomerId] = useState("");
  const [dogId, setDogId] = useState("");
  const [programType, setProgramType] = useState("BASIC_OBEDIENCE");
  const [customTypeName, setCustomTypeName] = useState("");
  const [totalSessions, setTotalSessions] = useState("10");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["customers-full"],
    queryFn: () => fetchJSON<Customer[]>("/api/customers?full=1"),
  });

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const selectedDog = selectedCustomer?.pets.find((p) => p.id === dogId);
  const effectiveProgramType = programType === "CUSTOM" ? (customTypeName.trim() || "מותאם אישית") : (PROGRAM_TYPES_MAP[programType] || programType);
  const autoName = selectedDog
    ? `אילוף ${effectiveProgramType} - ${selectedDog.name}`
    : "";

  const handleSubmit = () => {
    if (!customerId || !dogId) return;
    onSubmit({
      customerId,
      dogId,
      name: autoName,
      programType: programType === "CUSTOM" && customTypeName.trim() ? customTypeName.trim() : programType,
      trainingType: "HOME",
      isPackage: true,
      totalSessions: totalSessions ? parseInt(totalSessions) : null,
      startDate,
      endDate: endDate || null,
      notes: notes || null,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-brand-500" />
            הוסף תהליך אילוף ידני
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-petra-muted bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-4">
          להוספת לקוחות שכבר בתהליך אילוף ממערכת אחרת — ללא קישור להזמנה חדשה
        </p>

        <div className="space-y-4">
          <div>
            <label className="label">לקוח *</label>
            <select
              className="input"
              value={customerId}
              onChange={(e) => { setCustomerId(e.target.value); setDogId(""); }}
              disabled={customersLoading}
            >
              <option value="">{customersLoading ? "טוען..." : "בחר לקוח..."}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {customerId && selectedCustomer && (
            <div>
              <label className="label">כלב *</label>
              {selectedCustomer.pets.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                  ללקוח זה אין כלבים רשומים — יש להוסיף כלב בפרופיל הלקוח תחילה.
                </p>
              ) : (
                <select className="input" value={dogId} onChange={(e) => setDogId(e.target.value)}>
                  <option value="">בחר כלב...</option>
                  {selectedCustomer.pets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="label">סוג אילוף</label>
            <select className="input" value={programType} onChange={(e) => { setProgramType(e.target.value); setCustomTypeName(""); }}>
              {Object.entries(PROGRAM_TYPES_MAP).filter(([k]) => !k.startsWith("SD_")).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {programType === "CUSTOM" && (
              <input
                className="input mt-2"
                placeholder="פרט את סוג האילוף..."
                value={customTypeName}
                onChange={(e) => setCustomTypeName(e.target.value)}
                autoFocus
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">מספר מפגשים</label>
              <input
                type="number"
                className="input"
                value={totalSessions}
                onChange={(e) => setTotalSessions(e.target.value)}
                min="1"
                placeholder="10"
              />
            </div>
            <div>
              <label className="label">תאריך התחלה</label>
              <input
                type="date" lang="he"
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תאריך סיום <span className="text-petra-muted font-normal">(אופציונלי)</span></label>
              <input
                type="date" lang="he"
                className="input"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div />
          </div>

          <div>
            <label className="label">הערות</label>
            <textarea
              className="input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הקשר, שלב התהליך לפני המעבר..."
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!customerId || !dogId || isPending}
            onClick={handleSubmit}
          >
            <Plus className="w-4 h-4" />
            {isPending ? "שומר..." : "הוסף תהליך"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SELL PACKAGE MODAL
// ═══════════════════════════════════════════════════════

function SellPackageModal({
  onClose,
  onSubmit,
  isPending,
  packages = [],
}: {
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
  packages?: TrainingPackage[];
}) {
  const [step, setStep] = useState(packages.length > 0 ? 1 : 2);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [dogId, setDogId] = useState("");
  const [programType, setProgramType] = useState("BASIC_OBEDIENCE");
  const [customTypeName, setCustomTypeName] = useState("");
  const [totalSessions, setTotalSessions] = useState("10");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["customers-full"],
    queryFn: () => fetchJSON<Customer[]>("/api/customers?full=1"),
  });

  const customersWithPets = useMemo(
    () => customers.filter((c) => c.pets && c.pets.length > 0),
    [customers]
  );

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const selectedDog = selectedCustomer?.pets.find((p) => p.id === dogId);
  const selectedPkg = packages.find((p) => p.id === selectedPackageId);
  const effectiveProgramType = programType === "CUSTOM" ? (customTypeName.trim() || "מותאם אישית") : (PROGRAM_TYPES_MAP[programType] || programType);
  const autoName = selectedDog
    ? selectedPkg
      ? `${selectedPkg.name} - ${selectedDog.name}`
      : `אילוף ${effectiveProgramType} - ${selectedDog.name}`
    : "";

  const handleSelectPackage = (pkg: TrainingPackage | null) => {
    if (pkg) {
      setSelectedPackageId(pkg.id);
      setTotalSessions(String(pkg.sessions));
      setPrice(String(pkg.price));
    } else {
      setSelectedPackageId(null);
    }
    setStep(2);
  };

  const handleSubmit = () => {
    if (!customerId || !dogId || !totalSessions) return;
    onSubmit({
      customerId,
      dogId,
      name: autoName,
      programType: programType === "CUSTOM" && customTypeName.trim() ? customTypeName.trim() : programType,
      totalSessions: parseInt(totalSessions),
      price: price ? parseFloat(price) : null,
      notes: notes || null,
      packageId: selectedPackageId || null,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
            <Package className="w-5 h-5 text-brand-500" />
            מכירת חבילת אימון
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 1 && packages.length > 0 && (
          <div>
            <p className="text-sm text-petra-muted mb-4">בחר חבילת אילוף:</p>
            <div className="space-y-2 mb-4">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  className={cn(
                    "w-full text-right p-3 rounded-xl border-2 transition-all",
                    selectedPackageId === pkg.id
                      ? "border-brand-500 bg-brand-50"
                      : "border-petra-border bg-white hover:border-brand-200"
                  )}
                  onClick={() => setSelectedPackageId(pkg.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-petra-text">{pkg.name}</span>
                    <span className="text-sm font-bold text-brand-600">{formatCurrency(pkg.price)}</span>
                  </div>
                  <p className="text-xs text-petra-muted mt-0.5">{pkg.sessions} מפגשים</p>
                  {pkg.description && <p className="text-xs text-petra-muted mt-0.5 line-clamp-1">{pkg.description}</p>}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                className="btn-primary flex-1"
                disabled={!selectedPackageId}
                onClick={() => handleSelectPackage(packages.find((p) => p.id === selectedPackageId) ?? null)}
              >
                המשך
              </button>
              <button className="btn-secondary" onClick={() => handleSelectPackage(null)}>
                ללא חבילה
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <>
            {selectedPkg && (
              <div className="p-3 mb-4 rounded-xl bg-brand-50 border border-brand-100 text-sm text-brand-700 flex items-center justify-between">
                <span>{selectedPkg.name} — {selectedPkg.sessions} מפגשים</span>
                {packages.length > 0 && (
                  <button className="text-xs text-brand-500 hover:underline" onClick={() => setStep(1)}>שנה</button>
                )}
              </div>
            )}

            <div className="space-y-4">
              {/* Customer */}
              <div>
                <label className="label">לקוח *</label>
                {customersLoading ? (
                  <div className="input bg-slate-50 text-petra-muted text-sm">טוען לקוחות...</div>
                ) : (
                  <select
                    className="input"
                    value={customerId}
                    onChange={(e) => { setCustomerId(e.target.value); setDogId(""); }}
                  >
                    <option value="">בחר לקוח...</option>
                    {customersWithPets.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.phone} ({c.pets.length} כלבים)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Dog */}
              {customerId && selectedCustomer && (
                <div>
                  <label className="label">כלב *</label>
                  <select className="input" value={dogId} onChange={(e) => setDogId(e.target.value)}>
                    <option value="">בחר כלב...</option>
                    {selectedCustomer.pets.map((pet) => (
                      <option key={pet.id} value={pet.id}>{pet.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Program Type */}
              {!selectedPkg && (
                <div>
                  <label className="label">סוג תוכנית</label>
                  <select className="input" value={programType} onChange={(e) => { setProgramType(e.target.value); setCustomTypeName(""); }}>
                    {Object.entries(PROGRAM_TYPES_MAP).filter(([k]) => !k.startsWith("SD_")).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  {programType === "CUSTOM" && (
                    <input
                      className="input mt-2"
                      placeholder="פרט את סוג האילוף..."
                      value={customTypeName}
                      onChange={(e) => setCustomTypeName(e.target.value)}
                      autoFocus
                    />
                  )}
                </div>
              )}

              {/* Auto Name */}
              {autoName && (
                <div>
                  <label className="label">שם תוכנית</label>
                  <input className="input bg-slate-50" value={autoName} readOnly />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">מספר מפגשים *</label>
                  <input
                    type="number"
                    className="input"
                    value={totalSessions}
                    onChange={(e) => setTotalSessions(e.target.value)}
                    min="1"
                  />
                </div>
                <div>
                  <label className="label">מחיר (₪)</label>
                  <input
                    type="number"
                    className="input"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="label">הערות</label>
                <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                className="btn-primary flex-1"
                disabled={!customerId || !dogId || !totalSessions || isPending}
                onClick={handleSubmit}
              >
                <Package className="w-4 h-4" />
                {isPending ? "שומר..." : "צור חבילה"}
              </button>
              <button className="btn-secondary" onClick={onClose}>ביטול</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CREATE GROUP / WORKSHOP MODAL
// ═══════════════════════════════════════════════════════

function CreateGroupModal({
  onClose,
  onSubmit,
  isPending,
  isWorkshop,
  initial,
}: {
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
  isWorkshop: boolean;
  initial?: TrainingGroup | null;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    groupType: initial?.groupType ?? (isWorkshop ? "WORKSHOP" : "CUSTOM"),
    location: initial?.location ?? "",
    defaultDayOfWeek: initial?.defaultDayOfWeek != null ? String(initial.defaultDayOfWeek) : "",
    defaultTime: initial?.defaultTime ?? "",
    maxParticipants: initial?.maxParticipants != null ? String(initial.maxParticipants) : "",
    notes: initial?.notes ?? "",
    startDate: initial?.startDate ? initial.startDate.slice(0, 10) : "",
    endDate: initial?.endDate ? initial.endDate.slice(0, 10) : "",
  });

  const handleSubmit = () => {
    if (!form.name) return;
    onSubmit({
      name: form.name,
      groupType: form.groupType,
      location: form.location || null,
      defaultDayOfWeek: form.defaultDayOfWeek ? parseInt(form.defaultDayOfWeek) : null,
      defaultTime: form.defaultTime || null,
      maxParticipants: form.maxParticipants ? parseInt(form.maxParticipants) : null,
      notes: form.notes || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text">
            {initial
              ? (isWorkshop ? "עריכת סדנה" : "עריכת קבוצה")
              : (isWorkshop ? "סדנה חדשה" : "קבוצת אימון חדשה")}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">שם {isWorkshop ? "הסדנה" : "הקבוצה"} *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={isWorkshop ? "למשל: סדנת סוציאליזציה" : "למשל: קבוצת גורים - מחזור 3"}
            />
          </div>

          {!isWorkshop && (
            <div>
              <label className="label">סוג</label>
              <select
                className="input"
                value={form.groupType}
                onChange={(e) => setForm({ ...form, groupType: e.target.value })}
              >
                {Object.entries(GROUP_TYPES_MAP)
                  .filter(([k]) => k !== "WORKSHOP")
                  .map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">יום קבוע</label>
              <select
                className="input"
                value={form.defaultDayOfWeek}
                onChange={(e) => setForm({ ...form, defaultDayOfWeek: e.target.value })}
              >
                <option value="">לא נקבע</option>
                {DAY_NAMES.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">שעה</label>
              <input
                type="time"
                className="input"
                value={form.defaultTime}
                onChange={(e) => setForm({ ...form, defaultTime: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">מיקום</label>
              <input
                className="input"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="גן ציבורי..."
              />
            </div>
            <div>
              <label className="label">מקסימום משתתפים</label>
              <input
                type="number"
                className="input"
                value={form.maxParticipants}
                onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })}
                placeholder="6"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תאריך התחלה <span className="text-petra-muted font-normal">(אופציונלי)</span></label>
              <input
                type="date" lang="he"
                className="input"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">תאריך סיום <span className="text-petra-muted font-normal">(אופציונלי)</span></label>
              <input
                type="date" lang="he"
                className="input"
                value={form.endDate}
                min={form.startDate || undefined}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">הערות</label>
            <textarea
              className="input"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!form.name || isPending}
            onClick={handleSubmit}
          >
            {initial ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {isPending ? "שומר..." : initial ? "שמור שינויים" : isWorkshop ? "צור סדנה" : "צור קבוצה"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ASSIGN DOG MODAL
// ═══════════════════════════════════════════════════════

function AssignDogModal({
  groupId: _groupId,
  groupName,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  groupId: string;
  groupName: string;
  onClose: () => void;
  onSubmit: (customerId: string, dogId: string) => void;
  isPending: boolean;
  error: string | null;
}) {
  const [customerId, setCustomerId] = useState("");
  const [dogId, setDogId] = useState("");

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["customers-full"],
    queryFn: () => fetchJSON<Customer[]>("/api/customers?full=1"),
  });

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text">שיוך לקוח וכלב — {groupName}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Customer */}
          <div>
            <label className="label">לקוח *</label>
            {customersLoading ? (
              <div className="input bg-slate-50 text-petra-muted text-sm">טוען לקוחות...</div>
            ) : (
              <select
                className="input"
                value={customerId}
                onChange={(e) => { setCustomerId(e.target.value); setDogId(""); }}
              >
                <option value="">בחר לקוח...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.phone ? ` — ${c.phone}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Dog — shown after customer selected */}
          {customerId && selectedCustomer && (
            <div>
              <label className="label">כלב *</label>
              {selectedCustomer.pets.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                  ללקוח זה אין כלבים רשומים — יש להוסיף כלב בפרופיל הלקוח תחילה.
                </p>
              ) : (
                <select className="input" value={dogId} onChange={(e) => setDogId(e.target.value)}>
                  <option value="">בחר כלב...</option>
                  {selectedCustomer.pets.map((pet) => (
                    <option key={pet.id} value={pet.id}>{pet.name}{pet.species ? ` (${pet.species})` : ""}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!customerId || !dogId || isPending}
            onClick={() => onSubmit(customerId, dogId)}
          >
            <Plus className="w-4 h-4" />
            {isPending ? "שומר..." : "שייך לקוח וכלב"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PROGRAM SETTINGS MODAL
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// SERVICE DOGS TRAINING TAB
// ═══════════════════════════════════════════════════════

function ServiceDogsTrainingTab({
  programs,
  searchQuery,
  onNewProgram,
}: {
  programs: TrainingProgram[];
  searchQuery: string;
  onNewProgram: () => void;
}) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return programs;
    const q = searchQuery.toLowerCase();
    return programs.filter(
      (p) => p.dog.name.toLowerCase().includes(q) || (p.customer?.name ?? "").toLowerCase().includes(q)
    );
  }, [programs, searchQuery]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-petra-muted">{filtered.length} תוכניות כלבי שירות</p>
        <button className="btn-primary text-sm" onClick={onNewProgram}>
          <Plus className="w-4 h-4" />
          תוכנית חדשה
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Shield className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין תוכניות אילוף לכלבי שירות</h3>
          <p className="text-sm text-petra-muted">
            <a href="/service-dogs" className="text-brand-600 hover:underline">עבור לניהול כלבי שירות</a>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => {
            const usedSessions = p.sessions.filter((s) => s.status === "COMPLETED").length;
            const statusInfo = PROGRAM_STATUS_MAP[p.status] || PROGRAM_STATUS_MAP.ACTIVE;
            return (
              <div key={p.id} className="card p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-petra-text truncate">{p.dog.name}</h3>
                    <p className="text-xs text-petra-muted truncate">{p.customer?.name ?? ""}</p>
                  </div>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusInfo.color)}>
                    {statusInfo.label}
                  </span>
                </div>
                {p.totalSessions && (
                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] text-petra-muted mb-1">
                      <span>מפגשים</span>
                      <span>{usedSessions}/{p.totalSessions}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, (usedSessions / p.totalSessions) * 100)}%` }} />
                    </div>
                  </div>
                )}
                <a
                  href={`/service-dogs/${p.dog.id}`}
                  className="text-xs text-brand-600 hover:underline mt-1 block"
                >
                  צפה בפרופיל כלב שירות ←
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PACKAGES TAB
// ═══════════════════════════════════════════════════════

const PACKAGE_TYPE_LABELS: Record<string, string> = {
  HOME: "אילוף בבית",
  BOARDING: "אילוף בפנסיון",
  GROUP: "קבוצה",
  WORKSHOP: "סדנה",
};

const PACKAGE_TYPE_COLORS: Record<string, string> = {
  HOME: "bg-blue-100 text-blue-700",
  BOARDING: "bg-orange-100 text-orange-700",
  GROUP: "bg-green-100 text-green-700",
  WORKSHOP: "bg-purple-100 text-purple-700",
};

function PackagesTab({
  packages,
  onCreatePackage,
  onEditPackage,
  onDeletePackage,
  onToggleActive,
  isDeleting,
}: {
  packages: TrainingPackage[];
  onCreatePackage: () => void;
  onEditPackage: (pkg: TrainingPackage) => void;
  onDeletePackage: (id: string) => void;
  onToggleActive: (pkg: TrainingPackage) => void;
  isDeleting: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-petra-muted">{packages.length} חבילות</p>
        <button className="btn-primary text-sm" onClick={onCreatePackage}>
          <Plus className="w-4 h-4" />
          חבילה חדשה
        </button>
      </div>

      {packages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Package className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין חבילות אילוף</h3>
          <p className="text-sm text-petra-muted">הגדר חבילות אילוף כדי למכור ללקוחות בקלות</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {packages.map((pkg) => (
            <div key={pkg.id} className={cn("card p-4", !pkg.isActive && "opacity-60")}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-petra-text mb-1">{pkg.name}</h3>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", PACKAGE_TYPE_COLORS[pkg.type] || "bg-slate-100 text-slate-600")}>
                    {PACKAGE_TYPE_LABELS[pkg.type] || pkg.type}
                  </span>
                </div>
                <div className="flex gap-1 mr-2 flex-shrink-0">
                  <button
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
                    onClick={() => onEditPackage(pkg)}
                    title="עריכה"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  {pkg._count.programs === 0 ? (
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-petra-muted hover:text-red-500"
                      onClick={() => onDeletePackage(pkg.id)}
                      disabled={isDeleting}
                      title="מחק"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-bold text-petra-text">{formatCurrency(pkg.price)}</span>
                <span className="text-xs text-petra-muted">{pkg.sessions} מפגשים</span>
              </div>

              {pkg.durationDays && (
                <p className="text-xs text-petra-muted mb-2">{pkg.durationDays} ימי פנסיון</p>
              )}

              {pkg.description && (
                <p className="text-xs text-petra-muted mb-3 line-clamp-2">{pkg.description}</p>
              )}

              <div className="flex items-center justify-between border-t pt-2 mt-2">
                <span className="text-[10px] text-petra-muted">{pkg._count.programs} תוכניות פעילות</span>
                <button
                  onClick={() => onToggleActive(pkg)}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded font-medium transition-colors",
                    pkg.isActive
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  )}
                >
                  {pkg.isActive ? "פעיל" : "לא פעיל"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CREATE PACKAGE MODAL
// ═══════════════════════════════════════════════════════

function CreatePackageModal({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("HOME");
  const [sessions, setSessions] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!name.trim() || !sessions || !price) return;
    onSubmit({ name: name.trim(), type, sessions, durationDays: durationDays || undefined, price, description: description || undefined });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">חבילת אילוף חדשה</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">שם החבילה *</label>
            <input className="input" placeholder='דוג׳ "5 מפגשי אילוף בסיסי"' value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">סוג</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="HOME">אילוף בבית</option>
              <option value="BOARDING">אילוף בפנסיון</option>
              <option value="GROUP">קבוצה</option>
              <option value="WORKSHOP">סדנה</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">מספר מפגשים *</label>
              <input type="number" min={1} className="input" placeholder="5" value={sessions} onChange={(e) => setSessions(e.target.value)} />
            </div>
            <div>
              <label className="label">מחיר (₪) *</label>
              <input type="number" min={0} className="input" placeholder="1500" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          {type === "BOARDING" && (
            <div>
              <label className="label">ימי פנסיון</label>
              <input type="number" min={1} className="input" placeholder="14" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
            </div>
          )}
          <div>
            <label className="label">תיאור (אופציונלי)</label>
            <textarea className="input" rows={2} placeholder="תיאור קצר..." value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={isPending || !name.trim() || !sessions || !price} onClick={handleSubmit}>
            {isPending ? "יוצר..." : "צור חבילה"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// EDIT PACKAGE MODAL
// ═══════════════════════════════════════════════════════

function EditPackageModal({
  package: pkg,
  onClose,
  onSubmit,
  isPending,
}: {
  package: TrainingPackage;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(pkg.name);
  const [type, setType] = useState(pkg.type);
  const [sessions, setSessions] = useState(String(pkg.sessions));
  const [durationDays, setDurationDays] = useState(pkg.durationDays ? String(pkg.durationDays) : "");
  const [price, setPrice] = useState(String(pkg.price));
  const [description, setDescription] = useState(pkg.description ?? "");

  const handleSubmit = () => {
    if (!name.trim() || !sessions || !price) return;
    onSubmit({ name: name.trim(), type, sessions, durationDays: durationDays || null, price, description: description || null });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">עריכת חבילה</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">שם החבילה *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">סוג</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="HOME">אילוף בבית</option>
              <option value="BOARDING">אילוף בפנסיון</option>
              <option value="GROUP">קבוצה</option>
              <option value="WORKSHOP">סדנה</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">מספר מפגשים *</label>
              <input type="number" min={1} className="input" value={sessions} onChange={(e) => setSessions(e.target.value)} />
            </div>
            <div>
              <label className="label">מחיר (₪) *</label>
              <input type="number" min={0} className="input" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          {type === "BOARDING" && (
            <div>
              <label className="label">ימי פנסיון</label>
              <input type="number" min={1} className="input" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
            </div>
          )}
          <div>
            <label className="label">תיאור</label>
            <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={isPending || !name.trim() || !sessions || !price} onClick={handleSubmit}>
            {isPending ? "שומר..." : "שמור שינויים"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// BOARDING TRAINING MODAL
// ═══════════════════════════════════════════════════════

function BoardingTrainingModal({
  stay,
  onClose,
  onSubmit,
  isPending,
}: {
  stay: BoardingStay;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const stayCheckIn = stay.checkIn ? new Date(stay.checkIn).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const stayCheckOut = stay.checkOut ? new Date(stay.checkOut).toISOString().slice(0, 10) : "";

  const [startDate, setStartDate] = useState(stayCheckIn);
  const [endDate, setEndDate] = useState(stayCheckOut);
  const [behaviorBaseline, setBehaviorBaseline] = useState("");
  const [customerExpectations, setCustomerExpectations] = useState("");
  const [workPlan, setWorkPlan] = useState("");
  const [homeFollowupSessions, setHomeFollowupSessions] = useState(0);

  const handleSubmit = () => {
    onSubmit({
      dogId: stay.pet.id,
      customerId: stay.customer.id,
      boardingStayId: stay.id,
      trainingType: "BOARDING",
      name: `תוכנית אילוף פנסיון — ${stay.pet.name}`,
      programType: "CUSTOM",
      startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : null,
      behaviorBaseline: behaviorBaseline || null,
      customerExpectations: customerExpectations || null,
      workPlan: workPlan || null,
      homeFollowupSessions: homeFollowupSessions > 0 ? homeFollowupSessions : 0,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">תוכנית אילוף לפנסיון — {stay.pet.name}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-700 mb-4">
          {stay.pet.name} • {stay.customer.name} • {stay.room?.name ?? "ללא חדר"}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">התחלת תוכנית *</label>
              <input type="date" lang="he" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="label">סיום תוכנית *</label>
              <input type="date" lang="he" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          {(!startDate || !endDate) && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              נדרשים תאריך התחלה וסיום כדי שהלקוח יסומן כ&quot;לקוח פעיל&quot;
            </p>
          )}
          <div>
            <label className="label">בסיס התנהגותי ראשוני</label>
            <textarea
              className="input"
              rows={3}
              placeholder="תאר את ההתנהגות הנוכחית של הכלב: רמת עצמאות, תגובות לגירויים, כישורים קיימים..."
              value={behaviorBaseline}
              onChange={(e) => setBehaviorBaseline(e.target.value)}
            />
          </div>
          <div>
            <label className="label">ציפיות הלקוח</label>
            <textarea
              className="input"
              rows={2}
              placeholder="מה הלקוח מצפה להשיג במהלך הפנסיון..."
              value={customerExpectations}
              onChange={(e) => setCustomerExpectations(e.target.value)}
            />
          </div>
          <div>
            <label className="label">תוכנית עבודה שבועית <span className="text-[10px] text-amber-600 font-normal">— גלוי לצוות</span></label>
            <textarea
              className="input"
              rows={4}
              placeholder="תאר את תוכנית האילוף היומית/שבועית לצוות הפנסיון..."
              value={workPlan}
              onChange={(e) => setWorkPlan(e.target.value)}
            />
          </div>

          {/* Home follow-up sessions */}
          <div className="p-3 rounded-xl border border-brand-100 bg-brand-50/50 space-y-2">
            <label className="text-xs font-semibold text-brand-700 flex items-center gap-1.5">
              <Dog className="w-3.5 h-3.5" />
              העברת שרביט — מפגשי המשך בבית הלקוח
            </label>
            <p className="text-[11px] text-brand-600">
              מפגשים בבית הלקוח לאחר סיום הפנסיון — להבטיח רצף ולהעביר את הכלי לידיים של הבעלים
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={20}
                className="input w-20 text-center"
                value={homeFollowupSessions || ""}
                placeholder="0"
                onChange={(e) => setHomeFollowupSessions(Math.max(0, parseInt(e.target.value) || 0))}
              />
              <span className="text-xs text-petra-muted">מפגשים (0 = ללא מפגשי המשך)</span>
            </div>
            {homeFollowupSessions > 0 && (
              <p className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                ✓ תוכנית המשך של {homeFollowupSessions} מפגשים תיווצר אוטומטית תחת &quot;אילוף בבית הלקוח&quot;
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={isPending || !startDate || !endDate} onClick={handleSubmit}>
            {isPending ? "יוצר..." : "צור תוכנית אילוף"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PROGRAM SETTINGS MODAL
// ═══════════════════════════════════════════════════════

function ProgramSettingsModal({
  program,
  onClose,
  onSubmit,
  isPending,
}: {
  program: TrainingProgram;
  onClose: () => void;
  onSubmit: (data: {
    programType: string;
    startDate: string;
    endDate: string | null;
    location: string | null;
    frequency: string | null;
    totalSessions: number | null;
  }) => void;
  isPending: boolean;
}) {
  const isKnownType = (t: string) => t in PROGRAM_TYPES_MAP;
  const initialType = program.programType && isKnownType(program.programType) ? program.programType : "CUSTOM";
  const initialCustomName = program.programType && !isKnownType(program.programType) ? program.programType : "";

  const [form, setForm] = useState({
    programType: initialType,
    startDate: program.startDate ? new Date(program.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    endDate: program.endDate ? new Date(program.endDate).toISOString().split('T')[0] : "",
    location: program.location || "",
    frequency: program.frequency || "",
    totalSessions: program.totalSessions ? String(program.totalSessions) : "",
  });
  const [customTypeName, setCustomTypeName] = useState(initialCustomName);

  const handleSubmit = () => {
    const parsedSessions = parseInt(form.totalSessions, 10);
    onSubmit({
      programType: form.programType === "CUSTOM" && customTypeName.trim() ? customTypeName.trim() : form.programType,
      startDate: new Date(form.startDate).toISOString(),
      endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      location: form.location || null,
      frequency: form.frequency || null,
      totalSessions: form.totalSessions && !isNaN(parsedSessions) && parsedSessions > 0 ? parsedSessions : null,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-500" />
            הגדרות חבילה - {program.dog.name}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">סוג אילוף</label>
            <select
              className="input"
              value={form.programType}
              onChange={(e) => { setForm({ ...form, programType: e.target.value }); setCustomTypeName(""); }}
            >
              <option value="BASIC_OBEDIENCE">משמעת בסיסית</option>
              <option value="REACTIVITY">תגובתיות</option>
              <option value="PUPPY">גורים</option>
              <option value="BEHAVIOR">בעיות התנהגות</option>
              <option value="ADVANCED">משמעת מתקדמת</option>
              <option value="CUSTOM">מותאם אישית</option>
            </select>
            {form.programType === "CUSTOM" && (
              <input
                className="input mt-2"
                placeholder="פרט את סוג האילוף..."
                value={customTypeName}
                onChange={(e) => setCustomTypeName(e.target.value)}
                autoFocus
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תאריך התחלה *</label>
              <input
                type="date" lang="he"
                className="input"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">יעד סיום משוער</label>
              <input
                type="date" lang="he"
                className="input"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">תדירות מפגשים</label>
            <select
              className="input"
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
            >
              <option value="">לא מוגדר</option>
              <option value="WEEKLY">אחת לשבוע</option>
              <option value="BIWEEKLY">אחת לשבועיים</option>
              <option value="CUSTOM">אחר</option>
            </select>
          </div>

          <div>
            <label className="label">
              כמות מפגשים בחבילה
              <span className="text-xs font-normal text-petra-muted mr-1">(לצ׳קליסט מעקב)</span>
            </label>
            <input
              type="number"
              min={1}
              max={100}
              className="input"
              placeholder="למשל: 8"
              value={form.totalSessions}
              onChange={(e) => setForm({ ...form, totalSessions: e.target.value })}
            />
            {form.totalSessions && parseInt(form.totalSessions) > 0 && (
              <p className="text-[11px] text-petra-muted mt-1">
                כפתור ״סיים אילוף״ יהיה זמין רק לאחר סימון כל {form.totalSessions} המפגשים
              </p>
            )}
          </div>

          <div>
            <label className="label">כתובת (מיקום האימון)</label>
            <input
              type="text"
              className="input"
              placeholder="רחוב, עיר..."
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!form.startDate || isPending}
            onClick={handleSubmit}
          >
            <CheckCircle2 className="w-4 h-4" />
            {isPending ? "שומר..." : "שמור הגדרות"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DROPOUT MODAL
// ═══════════════════════════════════════════════════════

function DropoutModal({
  dogName,
  isPending,
  onClose,
  onSubmit,
}: {
  dogName: string;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            נשירה מתהליך — {dogName}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-petra-muted mb-4">
          הכלב יועבר לארכיון עם סטטוס &ldquo;נשר&rdquo;. ניתן לציין את סיבת הנשירה לצורכי מעקב.
        </p>
        <div>
          <label className="label">סיבת הנשירה (אופציונלי)</label>
          <textarea
            className="input"
            rows={3}
            placeholder="לדוגמה: לקוח ביטל, לא הגיע לפגישות, עבר לאימון אחר..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="flex gap-3 mt-5">
          <button
            className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            disabled={isPending}
            onClick={() => onSubmit(reason)}
          >
            <XCircle className="w-4 h-4" />
            {isPending ? "מעבד..." : "אשר נשירה"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CONVERT TO GROUP MODAL (individual → group)
// ═══════════════════════════════════════════════════════

function ConvertToGroupModal({
  program,
  groups,
  isPending,
  onClose,
  onSubmit,
}: {
  program: TrainingProgram;
  groups: TrainingGroup[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (trainingGroupId: string) => void;
}) {
  const [groupId, setGroupId] = useState("");

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
            <Repeat className="w-5 h-5 text-brand-500" />
            המרה לאילוף קבוצתי — {program.dog.name}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-petra-muted mb-4">
          הכלב יתווסף כמשתתף בקבוצה הנבחרת, ותוכנית האילוף הפרטנית הקיימת (כולל המפגשים והיעדים שלה) תימחק.
          ההזמנה תישאר מקושרת — המחיר לא ישתנה אוטומטית וניתן לעדכן אותו ידנית.
        </p>
        <div>
          <label className="label">בחר קבוצת יעד</label>
          <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">— בחר קבוצה —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          {groups.length === 0 && (
            <p className="text-xs text-amber-600 mt-2">אין קבוצות פעילות. צור קבוצה תחילה בלשונית &ldquo;אילוף קבוצתי&rdquo;.</p>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <button
            className="flex-1 btn-primary disabled:opacity-50"
            disabled={isPending || !groupId}
            onClick={() => groupId && onSubmit(groupId)}
          >
            <Repeat className="w-4 h-4" />
            {isPending ? "ממיר..." : "המר לקבוצתי"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DELETE PROGRAM MODAL (double-check + order action)
// ═══════════════════════════════════════════════════════

function DeleteProgramModal({
  program,
  isPending,
  onClose,
  onSubmit,
}: {
  program: TrainingProgram;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (orderAction: string) => void;
}) {
  const [orderAction, setOrderAction] = useState<"keep" | "cancel" | "delete">("keep");
  const hasOrder = !!program.orderId;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            מחיקת תהליך אילוף — {program.dog.name}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-petra-muted mb-4">
          פעולה זו תמחק לצמיתות את תוכנית האילוף כולל כל המפגשים, היעדים ושיעורי הבית. לא ניתן לשחזר.
        </p>
        {hasOrder && (
          <div className="mb-4">
            <label className="label">מה לעשות עם ההזמנה המקושרת?</label>
            <div className="space-y-2 mt-1">
              {([
                { v: "keep", label: "להשאיר את ההזמנה כפי שהיא" },
                { v: "cancel", label: "לבטל את ההזמנה (סטטוס: מבוטל)" },
                { v: "delete", label: "למחוק גם את ההזמנה" },
              ] as const).map((opt) => (
                <label key={opt.v} className="flex items-center gap-2 text-sm text-petra-text cursor-pointer">
                  <input
                    type="radio"
                    name="orderAction"
                    value={opt.v}
                    checked={orderAction === opt.v}
                    onChange={() => setOrderAction(opt.v)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            {orderAction === "delete" && (
              <p className="text-xs text-amber-600 mt-2">הזמנה ששולמה או שהופקה ממנה חשבונית תבוטל במקום להימחק.</p>
            )}
          </div>
        )}
        <div className="flex gap-3 mt-5">
          <button
            className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            disabled={isPending}
            onClick={() => onSubmit(orderAction)}
          >
            <Trash2 className="w-4 h-4" />
            {isPending ? "מוחק..." : "מחק לצמיתות"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// GENERIC CONFIRM ACTION MODAL
// ═══════════════════════════════════════════════════════

function ConfirmActionModal({
  title,
  message,
  confirmLabel,
  danger = false,
  isPending,
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
            {danger ? <Trash2 className="w-5 h-5 text-red-500" /> : <Repeat className="w-5 h-5 text-brand-500" />}
            {title}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-petra-muted mb-5">{message}</p>
        <div className="flex gap-3">
          <button
            className={cn(
              "flex-1 py-2 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2",
              danger ? "bg-red-500 hover:bg-red-600" : "bg-brand-500 hover:bg-brand-600"
            )}
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? "מעבד..." : confirmLabel}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// FINISH TRAINING MODAL
// ═══════════════════════════════════════════════════════

function FinishTrainingModal({
  dogName,
  isPending,
  onClose,
  onSubmit,
}: {
  dogName: string;
  isPending: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            סיום אילוף — {dogName}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-petra-muted mb-5">
          האילוף של {dogName} יסומן כהושלם ויועבר לארכיון. פעולה זו אינה הפיכה.
        </p>
        <div className="flex gap-3">
          <button
            className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            disabled={isPending}
            onClick={onSubmit}
          >
            <CheckCircle2 className="w-4 h-4" />
            {isPending ? "מעבד..." : "אשר סיום"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ARCHIVE TAB
// ═══════════════════════════════════════════════════════

function exportArchiveXLSX(programs: TrainingProgram[]) {
  import("xlsx").then((XLSX) => {
    const headers = ["שם הכלב", "גזע", "שם הלקוח", "טלפון", "סוג תוכנית", "מפגשים שהושלמו", "תאריך התחלה", "תאריך סיום", "סטטוס", "סיבת נשירה / הערות"];
    const rows = programs.map((p) => {
      const usedSessions = p.sessions.filter((s) => s.status === "COMPLETED").length;
      const statusLabel = p.status === "COMPLETED" ? "הושלם" : "נשר";
      return [
        p.dog.name,
        (p.dog as { breed?: string | null }).breed || "",
        p.customer?.name ?? "",
        p.customer?.phone ?? "",
        PROGRAM_TYPES_MAP[p.programType] || p.programType,
        usedSessions,
        p.startDate ? formatDate(p.startDate) : "",
        p.endDate ? formatDate(p.endDate) : "",
        statusLabel,
        p.notes || "",
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [14, 12, 14, 12, 14, 10, 12, 12, 10, 20].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ארכיון אילוף");
    XLSX.writeFile(wb, `training_archive_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });
}

function ArchiveTab({ programs, isLoading, onRestore }: { programs: TrainingProgram[]; isLoading: boolean; onRestore: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "COMPLETED" | "CANCELED">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    let list = programs;
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (dateFrom) {
      const from = new Date(dateFrom);
      list = list.filter((p) => p.startDate && new Date(p.startDate) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59);
      list = list.filter((p) => p.startDate && new Date(p.startDate) <= to);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.dog.name.toLowerCase().includes(q) ||
          (p.customer?.name ?? "").toLowerCase().includes(q) ||
          (p.customer?.phone ?? "").includes(q)
      );
    }
    return list;
  }, [programs, search, statusFilter, dateFrom, dateTo]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="card p-6 animate-pulse h-20" />)}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          {(["all", "COMPLETED", "CANCELED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                statusFilter === s ? "bg-white shadow-sm text-petra-text" : "text-petra-muted hover:bg-white/60"
              )}
            >
              {s === "all" ? "הכל" : s === "COMPLETED" ? "הושלמו" : "נשרו"}
            </button>
          ))}
        </div>
        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-petra-muted whitespace-nowrap">מ-</span>
          <input type="date" lang="he" className="input text-xs h-8 px-2 w-32" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span className="text-xs text-petra-muted whitespace-nowrap">עד-</span>
          <input type="date" lang="he" className="input text-xs h-8 px-2 w-32" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-[10px] text-petra-muted hover:text-red-500 px-1">✕</button>
          )}
        </div>
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-petra-muted" />
          <input
            className="input pr-9 text-sm w-full"
            placeholder="חיפוש לפי כלב / לקוח..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {programs.length > 0 && (
          <button
            className="btn-secondary text-xs flex items-center gap-1.5"
            onClick={() => exportArchiveXLSX(filtered.length > 0 ? filtered : programs)}
          >
            <Download className="w-3.5 h-3.5" />
            יצא Excel ({filtered.length})
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Archive className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">
            {programs.length === 0 ? "הארכיון ריק" : "אין תוצאות לחיפוש"}
          </h3>
          <p className="text-sm text-petra-muted">
            {programs.length === 0
              ? 'תהליכי אילוף שהסתיימו או שבהם הכלב נשר יופיעו כאן. לחץ "סיים אילוף" או "נשר מתהליך" בכרטיסיית הכלב.'
              : "נסה לשנות את החיפוש או הסינון"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const usedSessions = p.sessions.filter((s) => s.status === "COMPLETED").length;
            const isCompleted = p.status === "COMPLETED";
            return (
              <div key={p.id} className={cn("card p-4 flex items-start gap-4", !isCompleted && "border-red-100 bg-red-50/20")}>
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0",
                  isCompleted ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                )}>
                  {p.dog.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-petra-text text-sm">{p.dog.name}</span>
                    {(p.dog as { breed?: string | null }).breed && (
                      <span className="text-[10px] text-petra-muted">({(p.dog as { breed?: string | null }).breed})</span>
                    )}
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-medium",
                      isCompleted ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    )}>
                      {isCompleted ? "הושלם ✓" : "נשר"}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {PROGRAM_TYPES_MAP[p.programType] || p.programType}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-petra-muted flex-wrap">
                    <span>{p.customer?.name ?? ""}</span>
                    <span>{p.customer?.phone ?? ""}</span>
                    <span>{usedSessions} מפגשים</span>
                    {p.startDate && <span>התחלה: {formatDate(p.startDate)}</span>}
                    {p.endDate && <span>סיום: {formatDate(p.endDate)}</span>}
                  </div>
                  {!isCompleted && p.notes && (
                    <p className="mt-1.5 text-xs text-red-700 bg-red-50 px-2 py-1 rounded-lg">
                      <span className="font-semibold">סיבת נשירה: </span>{p.notes}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onRestore(p.id)}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-1.5 rounded-lg transition-colors"
                  title="השב לתהליך פעיל"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  השב לתהליך
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ADD STANDALONE SERVICE DOG MODAL
// ═══════════════════════════════════════════════════════

function AddStandaloneServiceDogModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [weight, setWeight] = useState("");
  const [microchip, setMicrochip] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [behaviorNotes, setBehaviorNotes] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch("/api/service-dogs/standalone-pet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      toast.success("כלב שירות נוסף בהצלחה");
      onSuccess();
      onClose();
    },
    onError: () => toast.error("שגיאה בהוספת כלב"),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
            <Dog className="w-5 h-5 text-brand-500" />
            הוסף כלב שירות
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3 rounded-xl bg-brand-50 border border-brand-100 text-xs text-brand-700 mb-4">
          כלב זה יופיע בתהליכי אילוף — כלבי שירות ובניהול כלבי שירות. לא ישויך ללקוח.
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">שם הכלב *</label>
            <input type="text" className="input" placeholder="שם הכלב" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">גזע</label>
              <input type="text" className="input" placeholder="גזע..." value={breed} onChange={(e) => setBreed(e.target.value)} />
            </div>
            <div>
              <label className="label">מין</label>
              <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">לא ידוע</option>
                <option value="male">זכר</option>
                <option value="female">נקבה</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תאריך לידה</label>
              <input type="date" lang="he" className="input" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
            <div>
              <label className="label">משקל (ק״ג)</label>
              <input type="number" className="input" placeholder="0.0" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">מיקרוצ׳יפ</label>
            <input type="text" className="input" placeholder="מספר שבב..." value={microchip} onChange={(e) => setMicrochip(e.target.value)} />
          </div>
          <div>
            <label className="label">סוג שירות</label>
            <input type="text" className="input" placeholder="כלב ניידות / פרכוסים / רגשי..." value={serviceType} onChange={(e) => setServiceType(e.target.value)} />
          </div>
          <div>
            <label className="label">הערות רפואיות</label>
            <textarea className="input" rows={2} value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} />
          </div>
          <div>
            <label className="label">הערות התנהגותיות</label>
            <textarea className="input" rows={2} value={behaviorNotes} onChange={(e) => setBehaviorNotes(e.target.value)} />
          </div>
          <div>
            <label className="label">הערות כלליות</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button
            className="btn-primary flex-1"
            disabled={!name.trim() || mutation.isPending}
            onClick={() => mutation.mutate({ name, breed, gender, birthDate, weight, microchip, medicalNotes, behaviorNotes, serviceType, notes })}
          >
            {mutation.isPending ? "שומר..." : "הוסף כלב שירות"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CREATE SERVICE DOG PROGRAM MODAL
// ═══════════════════════════════════════════════════════

interface ServiceDogOption {
  id: string;
  petId: string;
  phase: string;
  pet: { id: string; name: string; breed: string | null; customerId: string | null };
}

function CreateServiceDogProgramModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedDogId, setSelectedDogId] = useState("");
  const [programType, setProgramType] = useState("SD_FOUNDATION");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: dogs = [], isLoading } = useQuery<ServiceDogOption[]>({
    queryKey: ["service-dogs-list-for-program"],
    queryFn: () =>
      fetch("/api/service-dogs").then((r) => r.json()).then((d) => Array.isArray(d) ? d : d.dogs ?? []),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const dog = dogs.find((d) => d.id === selectedDogId);
      if (!dog) throw new Error("No dog selected");
      const res = await fetch("/api/training-programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dogId: dog.petId,
          customerId: dog.pet.customerId ?? null,
          trainingType: "SERVICE_DOG",
          name: `הכשרת כלב שירות — ${dog.pet.name}`,
          programType,
          startDate: new Date(startDate).toISOString(),
          status: "ACTIVE",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("תוכנית אימון נוצרה בהצלחה");
      onSuccess();
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה ביצירת תוכנית"),
  });

  const activeDogs = dogs.filter((d) => !["RETIRED", "DECERTIFIED"].includes(d.phase));

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-500" />
            תוכנית אימון חדשה — כלב שירות
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">כלב שירות *</label>
            {isLoading ? (
              <div className="input text-petra-muted text-sm">טוען...</div>
            ) : activeDogs.length === 0 ? (
              <p className="text-sm text-petra-muted py-2">אין כלבי שירות פעילים. <a href="/service-dogs" className="text-brand-600 hover:underline">הוסף כלב שירות</a></p>
            ) : (
              <select className="input" value={selectedDogId} onChange={(e) => setSelectedDogId(e.target.value)}>
                <option value="">בחר כלב...</option>
                {activeDogs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.pet.name}{d.pet.breed ? ` (${d.pet.breed})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="label">שלב הכשרה</label>
            <select className="input" value={programType} onChange={(e) => setProgramType(e.target.value)}>
              {SERVICE_DOG_PHASES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">תאריך התחלה</label>
            <input type="date" lang="he" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!selectedDogId || !startDate || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "יוצר..." : "צור תוכנית אימון"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ADD RECIPIENT INLINE MODAL (from training page)
// ═══════════════════════════════════════════════════════

function AddRecipientInlineModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [address, setAddress] = useState("");
  const [disabilityType, setDisabilityType] = useState("");
  const [disabilityNotes, setDisabilityNotes] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch("/api/service-recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-recipients"] });
      toast.success("זכאי נוסף בהצלחה");
      onClose();
    },
    onError: () => toast.error("שגיאה בהוספת זכאי"),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-brand-500" />
            הוסף זכאי חדש
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">שם מלא *</label>
            <input type="text" className="input" placeholder="שם ומשפחה" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">טלפון</label>
              <input type="tel" className="input" placeholder="05x-xxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="label">אימייל</label>
              <input type="email" className="input" placeholder="mail@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תעודת זהות</label>
              <input type="text" className="input" placeholder="9 ספרות" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
            </div>
            <div>
              <label className="label">סוג לקות</label>
              <select className="input" value={disabilityType} onChange={(e) => setDisabilityType(e.target.value)}>
                <option value="">לא נבחר</option>
                {DISABILITY_TYPES.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">כתובת</label>
            <input type="text" className="input" placeholder="רחוב, עיר" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <label className="label">פירוט הלקות</label>
            <textarea className="input" rows={2} placeholder="מידע נוסף על הלקות..." value={disabilityNotes} onChange={(e) => setDisabilityNotes(e.target.value)} />
          </div>
          <div>
            <label className="label">הערות</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button
            className="btn-primary flex-1"
            disabled={!name.trim() || mutation.isPending}
            onClick={() => mutation.mutate({ name, phone, email, idNumber, address, disabilityType, disabilityNotes, notes })}
          >
            {mutation.isPending ? "שומר..." : "הוסף זכאי"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

export default function TrainingPage() {
  return (
    <>
      <PageTitle title="אילוף" />
      <TierGate
      feature="training"
      title="מנוע תהליכי אילוף"
      description="ניהול תוכניות אילוף, מטרות ומפגשים. עקוב אחרי ההתקדמות של כל כלב בכל תוכנית אילוף."
    >
      <TrainingPageContent />
    </TierGate>
    </>
  );
}
