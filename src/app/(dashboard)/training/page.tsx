"use client";
import { PageTitle } from "@/components/ui/PageTitle";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { currencySymbol, formatCurrency as fmtCurrency, formatDate as fmtDate } from "@/lib/format";

import { TierGate } from "@/components/paywall/TierGate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState, useMemo, useEffect, useCallback, useRef } from "react";
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
import { cn, toWhatsAppPhone, fetchJSON, escapeHtml } from "@/lib/utils";
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
import { PetraLoader } from "@/components/ui/PetraLoader";
import { CustomerPicker, type PickerCustomer } from "@/components/customers/CustomerPicker";

// ─── Types ───────────────────────────────────────────

interface TrainingGroup {
  id: string;
  name: string;
  groupType: string;
  location: string | null;
  defaultDayOfWeek: number | null;
  defaultTime: string | null;
  maxParticipants: number | null;
  price: number | null;
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
  orderId: string | null;
  order: { id: string; status: string; total: number; paidAmount: number } | null;
  attendedCount: number;
  heldCount: number;
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
  dailyTrainingMinutes?: number | null;
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

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

type TT = ReturnType<typeof useTranslations<"training.trainingPage">>;

const dayName = (t: TT, i: number) => (DAY_KEYS[i] ? t(`days.${DAY_KEYS[i]}`) : "");

/** Business-locale date/currency formatting (identical output to the old utils helpers for he-IL/ILS). */
function useFmt() {
  const { locale, currency } = useBusinessLocale();
  return useMemo(
    () => ({
      formatDate: (d: Date | string) => fmtDate(d, { locale, style: "long" }),
      formatCurrency: (n: number) => fmtCurrency(n, { locale, currency }),
      cur: currencySymbol({ locale, currency }),
    }),
    [locale, currency]
  );
}

type TabId = "overview" | "individual" | "boarding" | "groups" | "archive";

const TABS: { id: TabId; icon: React.ReactNode }[] = [
  { id: "overview", icon: <GraduationCap className="w-4 h-4" /> },
  { id: "individual", icon: <Dog className="w-4 h-4" /> },
  { id: "boarding", icon: <Hotel className="w-4 h-4" /> },
  { id: "groups", icon: <Users className="w-4 h-4" /> },
  { id: "archive", icon: <Archive className="w-4 h-4" /> },
];

// Preset session durations (minutes) — used for all duration selects so the
// user can pick 30 etc. without fighting a number input's min-clamp on keystroke.
const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300, 360, 420, 480];

const TYPE_BADGE: Record<TrainingType, { bg: string; text: string }> = {
  individual: { bg: "bg-blue-100", text: "text-blue-700" },
  boarding: { bg: "bg-green-100", text: "text-green-700" },
  group: { bg: "bg-purple-100", text: "text-purple-700" },
  workshop: { bg: "bg-pink-100", text: "text-pink-700" },
};

const PROGRAM_TYPE_KEYS = [
  "BASIC_OBEDIENCE",
  "REACTIVITY",
  "PUPPY",
  "BEHAVIOR",
  "ADVANCED",
  "CUSTOM",
  // Service dog phases
  "SD_FOUNDATION",
  "SD_BASIC",
  "SD_ADVANCED",
  "SD_FIELD",
  "SD_PLACEMENT",
] as const;

/** Label of a program type (unknown / custom names are shown as stored). */
const programTypeLabel = (t: TT, type: string) => (t.has(`programTypes.${type}`) ? t(`programTypes.${type}`) : type);

const SERVICE_DOG_PHASES = [
  { value: "SD_FOUNDATION" },
  { value: "SD_BASIC" },
  { value: "SD_ADVANCED" },
  { value: "SD_FIELD" },
  { value: "SD_PLACEMENT" },
] as const;

const GROUP_TYPE_KEYS = ["PUPPY_CLASS", "REACTIVITY", "OBEDIENCE", "CUSTOM", "WORKSHOP"] as const;

const PROGRAM_STATUS_MAP: Record<string, { color: string }> = {
  ACTIVE: { color: "bg-blue-100 text-blue-700" },
  COMPLETED: { color: "bg-green-100 text-green-700" },
  PAUSED: { color: "bg-yellow-100 text-yellow-700" },
  CANCELED: { color: "bg-red-100 text-red-700" },
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
  processKind,
  onSelectProcessType,
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
  processKind?: "INDIVIDUAL" | "PACKAGE";
  onSelectProcessType?: (target: "INDIVIDUAL" | "PACKAGE" | "GROUP") => void;
}) {
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
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

  const STAR_LABELS = [t("stars.1"), t("stars.2"), t("stars.3"), t("stars.4"), t("stars.5")];

  const L = isWeekly ? {
    title: isEdit ? t("sessionLog.weekly.titleEdit") : t("sessionLog.weekly.title"),
    badge: t("sessionLog.weekly.badge", { n: sessionNumber }),
    dateLabel: t("sessionLog.weekly.dateLabel"),
    ratingLabel: t("sessionLog.weekly.ratingLabel"),
    practiceLabel: t("sessionLog.weekly.practiceLabel"),
    practicePlaceholder: t("sessionLog.weekly.practicePlaceholder"),
    goalsLabel: t("sessionLog.weekly.goalsLabel"),
    goalsPlaceholder: t("sessionLog.weekly.goalsPlaceholder"),
    homeworkLabel: t("sessionLog.weekly.homeworkLabel"),
    homeworkPlaceholder: t("sessionLog.weekly.homeworkPlaceholder"),
    summaryLabel: t("sessionLog.weekly.summaryLabel"),
    summaryPlaceholder: t("sessionLog.weekly.summaryPlaceholder"),
    saveBtn: isEdit ? t("sessionLog.saveChanges") : t("sessionLog.weekly.save"),
  } : isServiceDog ? {
    title: isEdit ? t("sessionLog.serviceDog.titleEdit") : t("sessionLog.serviceDog.title"),
    badge: t("sessionLog.serviceDog.badge", { n: sessionNumber }),
    dateLabel: t("sessionLog.serviceDog.dateLabel"),
    ratingLabel: t("sessionLog.serviceDog.ratingLabel"),
    practiceLabel: t("sessionLog.practiceLabel"),
    practicePlaceholder: t("sessionLog.practicePlaceholder"),
    goalsLabel: t("sessionLog.serviceDog.goalsLabel"),
    goalsPlaceholder: t("sessionLog.serviceDog.goalsPlaceholder"),
    homeworkLabel: t("sessionLog.serviceDog.homeworkLabel"),
    homeworkPlaceholder: t("sessionLog.serviceDog.homeworkPlaceholder"),
    summaryLabel: t("sessionLog.serviceDog.summaryLabel"),
    summaryPlaceholder: t("sessionLog.serviceDog.summaryPlaceholder"),
    saveBtn: isEdit ? t("sessionLog.saveChanges") : t("sessionLog.serviceDog.save"),
  } : {
    title: isEdit ? t("sessionLog.session.titleEdit") : t("sessionLog.session.title"),
    badge: t("sessionLog.session.badge", { n: sessionNumber }),
    dateLabel: t("sessionLog.session.dateLabel"),
    ratingLabel: t("sessionLog.session.ratingLabel"),
    practiceLabel: t("sessionLog.practiceLabel"),
    practicePlaceholder: t("sessionLog.practicePlaceholder"),
    goalsLabel: t("sessionLog.session.goalsLabel"),
    goalsPlaceholder: t("sessionLog.session.goalsPlaceholder"),
    homeworkLabel: t("sessionLog.session.homeworkLabel"),
    homeworkPlaceholder: t("sessionLog.session.homeworkPlaceholder"),
    summaryLabel: t("sessionLog.session.summaryLabel"),
    summaryPlaceholder: t("sessionLog.session.summaryPlaceholder"),
    saveBtn: isEdit ? t("sessionLog.saveChanges") : t("sessionLog.session.save"),
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
          {processKind && onSelectProcessType && (
            <div>
              <label className="label">{t("sessionLog.processType")}</label>
              <select
                className="input"
                value={processKind}
                onChange={(e) => {
                  const target = e.target.value as "INDIVIDUAL" | "PACKAGE" | "GROUP";
                  if (target !== processKind) onSelectProcessType(target);
                }}
              >
                <option value="INDIVIDUAL">{t("sessionLog.processIndividual")}</option>
                <option value="PACKAGE">{t("sessionLog.processPackage")}</option>
                <option value="GROUP">{t("sessionLog.processGroup")}</option>
              </select>
              <p className="text-[11px] text-petra-muted mt-1">{t("sessionLog.processHint")}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{L.dateLabel}</label>
              <input
                type="date" lang={cfg.lang}
                className="input"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">{t("time")}</label>
              <input
                type="time"
                className="input"
                value={sessionTime}
                onChange={(e) => setSessionTime(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">{t("durationMinutes")}</label>
            <select
              className="input"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
            >
              {(DURATION_OPTIONS.includes(durationMinutes) ? DURATION_OPTIONS : [durationMinutes, ...DURATION_OPTIONS].sort((a, b) => a - b)).map((d) => (
                <option key={d} value={d}>{t("minutesOption", { n: d })}</option>
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
                <span className="text-xs text-petra-muted ms-1">
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
              <label className="label">{t("sessionLog.trainerName")}</label>
              <input className="input" placeholder={t("sessionLog.trainerNamePlaceholder")} value={trainerName} onChange={(e) => setTrainerName(e.target.value)} />
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
                className="w-full flex items-center justify-between px-4 py-3 bg-green-50 hover:bg-green-100 transition-colors text-start"
                onClick={() => setHomeSession(!homeSession)}
              >
                <ChevronDown className={cn("w-4 h-4 text-green-600 transition-transform flex-shrink-0", homeSession && "rotate-180")} />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-green-800">{t("sessionLog.homeSessions")}</span>
                  <Home className="w-4 h-4 text-green-600" />
                </div>
              </button>
              {homeSession && (
                <div className="px-4 py-3 space-y-2 bg-white">
                  {!isSameWeek(sessionDate) && (
                    <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                      {t("sessionLog.notThisWeek")}
                    </p>
                  )}
                  {goals && goals.length > 0 ? (
                    <>
                      <p className="text-[11px] text-petra-muted pb-1">{t("sessionLog.updateHomeGoals")}</p>
                      {goals.map((goal) => (
                        <GoalProgressRow key={goal.id} goal={goal} programId={programId} />
                      ))}
                    </>
                  ) : (
                    <p className="text-xs text-petra-muted text-center py-4">{t("sessionLog.noGoals")}</p>
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
            {isPending ? tc("progress.saving") : L.saveBtn}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
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
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
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
          <h2 className="text-lg font-bold text-petra-text">{t("schedule.title", { dog: dogName })}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-700 font-medium mb-5">
          {t("sessionLog.session.badge", { n: sessionNumber })}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("sessionLog.session.dateLabel")}</label>
              <input
                type="date"
                lang={cfg.lang}
                className="input"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">{t("time")}</label>
              <input
                type="time"
                className="input"
                value={sessionTime}
                onChange={(e) => setSessionTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">{t("durationMinutes")}</label>
            <select
              className="input"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>{t("minutesOption", { n: d })}</option>
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
              <span className="text-sm font-medium text-petra-text">{t("schedule.recurring")}</span>
            </label>

            {repeat && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">{t("schedule.frequency")}</label>
                    <select
                      className="input"
                      value={intervalDays}
                      onChange={(e) => setIntervalDays(parseInt(e.target.value))}
                    >
                      <option value={7}>{t("schedule.everyWeek")}</option>
                      <option value={14}>{t("schedule.every2Weeks")}</option>
                      <option value={21}>{t("schedule.every3Weeks")}</option>
                      <option value={28}>{t("schedule.every4Weeks")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">{t("schedule.occurrences")}</label>
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
                  {t("schedule.preview", { count: occurrences, day: dayName(t, dayOfWeek), time: sessionTime })}
                  {intervalDays > 7 ? t("schedule.previewInterval", { weeks: intervalDays / 7 }) : ""}.
                </p>
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-emerald-600" />
            <span>{t("schedule.reminderNote")}</span>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={isPending || !isValidDate}
            onClick={() => onSubmit({ sessionDate: `${sessionDate}T${sessionTime}:00`, durationMinutes, sessionNumber, repeat, occurrences, intervalDays })}
          >
            <Calendar className="w-4 h-4" />
            {isPending ? t("schedule.scheduling") : repeat ? t("schedule.submitMany", { count: occurrences }) : t("schedule.submit")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
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
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
  const [groupId, setGroupId] = useState("");

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
            <Repeat className="w-5 h-5 text-brand-500" />
            {t("convert.title", { dog: program.dog.name })}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-petra-muted mb-4">
          {t("convert.body")}
        </p>
        <div>
          <label className="label">{t("convert.selectGroup")}</label>
          <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">{t("convert.selectPlaceholder")}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          {groups.length === 0 && (
            <p className="text-xs text-amber-600 mt-2">{t("convert.noGroups")}</p>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <button
            className="flex-1 btn-primary disabled:opacity-50"
            disabled={isPending || !groupId}
            onClick={() => groupId && onSubmit(groupId)}
          >
            <Repeat className="w-4 h-4" />
            {isPending ? t("convert.converting") : t("convert.submit")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════

function TrainingPageContent() {
  const t = useTranslations("training.trainingPage");
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
  const [showAssignDog, setShowAssignDog] = useState<{ groupId: string; groupName: string; isWorkshop?: boolean } | null>(null);
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

  const { data: boardingPrograms = [], isLoading: boardingProgramsLoading } = useQuery<TrainingProgram[]>({
    queryKey: ["training-programs-boarding"],
    queryFn: () => fetchJSON<TrainingProgram[]>("/api/training-programs?trainingType=BOARDING&status=ACTIVE,PAUSED"),
  });

  const { data: serviceDogPrograms = [], isLoading: serviceDogProgramsLoading } = useQuery<TrainingProgram[]>({
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
  // Stays the dog is in right now: reserved/checked-in (many boarding businesses never
  // press "check-in"), already started, not past their check-out day. Canceled,
  // checked-out and overdue stays are excluded.
  const currentStays = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return stays.filter((s) => {
      if (s.status !== "reserved" && s.status !== "checked_in") return false;
      if (new Date(s.checkIn) > now) return false;
      return !s.checkOut || new Date(s.checkOut) >= todayStart;
    });
  }, [stays]);

  // Only stays that actually have training: a linked BOARDING program, or daily
  // training minutes set on the stay. A boarded dog without training is NOT shown as
  // "in training" (customer report: "the system assigned dogs to training without me").
  const activeStays = useMemo(() => {
    const linked = new Set(boardingPrograms.map((p) => p.boardingStayId).filter(Boolean));
    return currentStays.filter((s) => linked.has(s.id) || (s.dailyTrainingMinutes ?? 0) > 0);
  }, [currentStays, boardingPrograms]);

  // Current stays without training — offered only through the explicit "add training" picker.
  const staysWithoutTraining = useMemo(() => {
    const withTraining = new Set(activeStays.map((s) => s.id));
    return currentStays.filter((s) => !withTraining.has(s.id));
  }, [currentStays, activeStays]);

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
        detail: programTypeLabel(t, p.programType),
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
        detail: daysLeft !== null ? t("overview.daysLeft", { count: Math.max(0, daysLeft) }) : t("overview.noCheckout"),
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
  }, [programs, activeStays, regularGroups, workshops, t]);

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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || t("toasts.sessionSaveError"));
      }
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
        toast.success(t("toasts.sessionLogged"));
      }
      setSessionLogTarget(null);
    },
    // Keep the modal open on failure — closing it would discard everything typed.
    onError: (err: Error) => { toast.error(err.message || t("toasts.sessionSaveError")); },
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
      toast.success(t("toasts.sessionUpdated"));
    },
    onError: () => toast.error(t("toasts.sessionUpdateError")),
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
      toast.success(t("toasts.groupCreated"));
    },
    onError: (err: Error) => {
      if ((err as unknown as Record<string, unknown>).code === "LIMIT_REACHED") {
        triggerLimitModal(err.message);
      } else {
        toast.error(err.message || t("toasts.groupCreateError"));
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
      toast.success(t("toasts.changesSaved"));
    },
    onError: (err: Error) => toast.error(err.message || t("toasts.groupUpdateError")),
  });

  const addParticipantMutation = useMutation({
    mutationFn: async ({ groupId, customerId, dogId, waitlist }: { groupId: string; customerId: string; dogId: string; waitlist?: boolean }) => {
      const res = await fetch(`/api/training-groups/${groupId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, dogId, waitlist: waitlist === true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      return res.json();
    },
    onSuccess: (data: { status?: string; participant?: { status?: string } }) => {
      queryClient.invalidateQueries({ queryKey: ["training-groups"] });
      setShowAssignDog(null);
      const status = data?.status ?? data?.participant?.status;
      if (status === "WAITLIST") {
        toast.success(t("toasts.addedToWaitlist"));
      } else {
        toast.success(t("toasts.dogAddedToGroup"));
      }
    },
    onError: (err: Error) => toast.error(err.message || t("toasts.dogAddToGroupError")),
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
      toast.success(t("toasts.dogRemovedFromGroup"));
    },
    onError: () => toast.error(t("toasts.dogRemoveFromGroupError")),
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
      toast.success(t("toasts.convertedToGroup"));
      if (data?.orderDowngraded) toast.warning(t("toasts.orderDowngraded"));
    },
    onError: (e: Error) => toast.error(e.message || t("toasts.convertToGroupError")),
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
      if (data?.pendingApproval) { toast.success(t("toasts.deleteRequestSent")); return; }
      toast.success(t("toasts.programDeleted"));
      if (data?.orderDowngraded) toast.warning(t("toasts.orderDowngraded"));
    },
    onError: (e: Error) => toast.error(e.message || t("toasts.programDeleteError")),
  });

  // Toggle individual ↔ package (same TrainingProgram, just the isPackage flag)
  const setProgramPackageMutation = useMutation({
    mutationFn: async ({ programId, isPackage }: { programId: string; isPackage: boolean }) => {
      const res = await fetch(`/api/training-programs/${programId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPackage }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed"); }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      invalidateAllTraining();
      setEditSessionTarget(null);
      setEditingProgram(null);
      toast.success(vars.isPackage ? t("toasts.convertedToPackage") : t("toasts.convertedToPrivate"));
    },
    onError: (e: Error) => toast.error(e.message || t("toasts.processTypeError")),
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
      toast.success(t("toasts.dogConvertedToPrivate"));
    },
    onError: (e: Error) => toast.error(e.message || t("toasts.convertToPrivateError")),
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
      toast.success(t("toasts.groupDeleted"));
    },
    onError: (e: Error) => toast.error(e.message || t("toasts.groupDeleteError")),
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
      toast.success(t("toasts.programCreated"));
    },
    onError: (err: Error) => {
      if ((err as unknown as Record<string, unknown>).code === "LIMIT_REACHED") {
        triggerLimitModal(err.message);
      } else {
        toast.error(err.message || t("toasts.programCreateErrorRetry"));
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
      toast.success(t("toasts.packageCreated"));
    },
    onError: () => toast.error(t("toasts.packageCreateError")),
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
      toast.success(t("toasts.packageUpdated"));
    },
    onError: () => toast.error(t("toasts.packageUpdateError")),
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
      toast.success(t("toasts.packageDeleted"));
    },
    onError: (err: Error) => toast.error(err.message || t("toasts.packageDeleteError")),
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
            name: t("boardingFollowup.name", { dog: boardingProgram.dog?.name || "" }),
            programType: "CUSTOM",
            startDate: boardingData.endDate || new Date().toISOString(),
            totalSessions: homeFollowupSessions,
            notes: t("boardingFollowup.notes"),
          }),
        }).catch(console.error);
      }
      return boardingProgram;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      queryClient.invalidateQueries({ queryKey: ["training-programs-boarding"] });
      setShowBoardingTraining(null);
      toast.success(t("toasts.programCreated"));
    },
    onError: () => toast.error(t("toasts.programCreateError")),
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
      toast.success(variables.status === "COMPLETED" ? t("toasts.trainingFinished") : t("toasts.dogArchived"));
    },
    onError: () => toast.error(t("toasts.statusUpdateError")),
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
      toast.success(t("toasts.programSettingsUpdated"));
    },
    onError: () => { setEditingProgram(null); toast.error(t("toasts.programSettingsError")); },
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
        ? t("toasts.sessionsScheduled", { count: created })
        : t("toasts.sessionScheduled"));
    },
    onError: () => toast.error(t("toasts.scheduleError")),
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
      toast.success(t("toasts.scheduledSessionCanceled"));
    },
    onError: () => toast.error(t("toasts.cancelSessionError")),
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

  // Deep-link: /training?program=<id> | ?group=<id> | ?dogId=<petId> (service-dogs alerts)
  // | ?pet=<petId> (customer page) | ?customerId=<id>&petId=<id> (order flows)
  const deepLinkConsumed = useRef(false);
  useEffect(() => {
    if (deepLinkConsumed.current) return;
    const params = new URLSearchParams(window.location.search);
    const programId = params.get("program");
    const groupId = params.get("group");
    // dogId / pet / petId all carry a Pet id — resolve them to a program the same way.
    const petId = params.get("dogId") || params.get("pet") || params.get("petId");
    const customerId = params.get("customerId");

    // Apply the existing program-focus behavior to a resolved program.
    const focusProgram = (prog: TrainingProgram, tab: "individual" | "boarding") => {
      deepLinkConsumed.current = true;
      if (tab === "boarding") focusCard({ tab: "boarding", expandId: prog.id });
      else focusCard({ tab: "individual", subTab: prog.isPackage ? "package" : "private", expandId: prog.id });
    };

    if (programId) {
      const prog = programs.find((p) => p.id === programId);
      if (prog) {
        focusProgram(prog, "individual");
      } else {
        const bp = boardingPrograms.find((p) => p.id === programId);
        if (bp) focusProgram(bp, "boarding");
      }
    } else if (groupId && groups.length) {
      focusCard({ tab: "groups", groupSubTab: workshops.some((g) => g.id === groupId) ? "workshops" : "groups", expandId: groupId });
      deepLinkConsumed.current = true;
    } else if (petId || customerId) {
      // Shared resolver: find the program matching this dog (or, failing that, this customer).
      const findProgram = (list: TrainingProgram[]) => {
        let matches = petId ? list.filter((p) => p.dog.id === petId) : [];
        if (!matches.length && customerId) matches = list.filter((p) => p.customer?.id === customerId);
        return matches.find((p) => p.status === "ACTIVE") ?? matches[0];
      };
      const individual = findProgram(programs.filter((p) => p.trainingType !== "BOARDING"));
      if (individual) {
        focusProgram(individual, "individual");
      } else {
        const boarding = findProgram(boardingPrograms);
        if (boarding) {
          focusProgram(boarding, "boarding");
        } else if (!isLoading && !boardingProgramsLoading && !serviceDogProgramsLoading) {
          // All sources loaded and nothing matched — don't leave the user staring at the wrong tab.
          deepLinkConsumed.current = true;
          setActiveTab("overview");
          if (findProgram(serviceDogPrograms)) {
            // SERVICE_DOG programs have no card on this page — point to the profile instead.
            toast.info(t("toasts.serviceDogProgramElsewhere"));
          } else {
            toast.info(t("toasts.noActiveProgram"));
          }
        }
      }
    }
  }, [programs, boardingPrograms, serviceDogPrograms, groups, workshops, focusCard, isLoading, boardingProgramsLoading, serviceDogProgramsLoading, t]);

  const activePrograms = programs.filter((p) => p.status === "ACTIVE");

  // ─── Stats ───

  const stats = [
    { label: t("stats.dogsInTraining"), value: allDogs.length, color: "bg-orange-50 text-orange-600", iconBg: "bg-orange-100" },
    { label: t("stats.personal"), value: activePrograms.length, color: "bg-blue-50 text-blue-600", iconBg: "bg-blue-100" },
    { label: t("stats.boarding"), value: activeStays.length, color: "bg-green-50 text-green-600", iconBg: "bg-green-100" },
    { label: t("stats.groups"), value: regularGroups.length + workshops.length, color: "bg-purple-50 text-purple-600", iconBg: "bg-purple-100" },
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
        <h1 className="page-title">{t("header.title")}</h1>

        {/* Refresh controls */}
        <div className="flex items-center gap-2 ms-auto">
          <button
            onClick={() => setShowManualAdd(true)}
            className="btn-primary text-sm"
            title={t("header.manualAddTitle")}
          >
            <Plus className="w-4 h-4" />
            {t("header.manualAdd")}
          </button>
          <button
            onClick={() => refetchPrograms()}
            disabled={programsFetching}
            title={t("header.refreshNow")}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-petra-muted hover:text-petra-text transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", programsFetching && "animate-spin")} />
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? t("header.autoRefreshOff") : t("header.autoRefreshOn")}
            className={cn(
              "flex items-center gap-1.5 px-3 h-8 rounded-lg border text-xs font-medium transition-all",
              autoRefresh
                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                : "bg-white border-slate-200 text-petra-muted hover:text-petra-text"
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
            {autoRefresh ? t("header.autoRefreshActive") : t("header.autoRefresh")}
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
              {t("freeLimit.count", { used: programs.length, max: maxTrainingPrograms })}
            </span>
          </div>
          {programs.length >= maxTrainingPrograms && (
            <a href="/upgrade" className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap">
              {t("freeLimit.upgrade")}
            </a>
          )}
        </div>
      )}

      {/* Global Search */}
      <div className="relative mb-4">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted" />
        <input
          className="input ps-10 w-full"
          placeholder={t("searchPlaceholder")}
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
            {t(`tabs.${tab.id}`)}
          </button>
        ))}
      </div>

      {/* Loading / Error */}
      {isError ? (
        <div className="card p-8 text-center">
          <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-400" />
          <p className="text-red-600 font-medium mb-2">{t("loadError")}</p>
          <button className="btn-secondary text-sm" onClick={() => refetchPrograms()}>{t("tryAgain")}</button>
        </div>
      ) : isLoading ? (
        <PetraLoader />
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
                  { id: "private" as const, label: t("subTabs.private") },
                  { id: "package" as const, label: t("subTabs.package") },
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
              availableStays={staysWithoutTraining}
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
                  { id: "groups" as const, label: t("subTabs.groups") },
                  { id: "workshops" as const, label: t("subTabs.workshops") },
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
                  onAssignDog={(groupId, groupName) => setShowAssignDog({ groupId, groupName, isWorkshop: true })}
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

      {editingProgram && (() => {
        const canChangeType = editingProgram.trainingType === "HOME" && !editingProgram.boardingStayId;
        return (
        <ProgramSettingsModal
          program={editingProgram}
          onClose={() => setEditingProgram(null)}
          onSubmit={(data) => updateProgramSettingsMutation.mutate({ id: editingProgram!.id, ...data })}
          isPending={updateProgramSettingsMutation.isPending}
          processKind={canChangeType ? (editingProgram.isPackage ? "PACKAGE" : "INDIVIDUAL") : undefined}
          onSelectProcessType={
            canChangeType
              ? (target) => {
                  if (target === "GROUP") { setEditingProgram(null); setConvertToGroupTarget(editingProgram!); return; }
                  setProgramPackageMutation.mutate({ programId: editingProgram!.id, isPackage: target === "PACKAGE" });
                }
              : undefined
          }
        />
        );
      })()}

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
          isWorkshop={showAssignDog.isWorkshop ?? false}
          onClose={() => setShowAssignDog(null)}
          onSubmit={(customerId, dogId, waitlist) =>
            addParticipantMutation.mutate({
              groupId: showAssignDog.groupId,
              customerId,
              dogId,
              waitlist,
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
                <h3 className="font-semibold text-petra-text text-sm">{t("summarySend.title")}</h3>
                <p className="text-xs text-petra-muted">{t("summarySend.subtitle", { dog: sessionSummarySend.dogName, n: sessionSummarySend.sessionNumber })}</p>
              </div>
              <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted flex-shrink-0" onClick={() => setSessionSummarySend(null)}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-petra-muted mb-4">{t("summarySend.hint")}</p>
            {(() => {
              const lines: string[] = [
                `שלום ${sessionSummarySend.customerName}! 🐾`, // i18n-ok — WhatsApp text the trainer sends to the client
                `סיכום מפגש ${sessionSummarySend.sessionNumber} — ${sessionSummarySend.dogName}`, // i18n-ok
                "",
              ];
              if (sessionSummarySend.practiceItems) lines.push(`📝 תרגילים שעשינו:\n${sessionSummarySend.practiceItems}`, ""); // i18n-ok
              if (sessionSummarySend.homeworkForCustomer) lines.push(`🏠 שיעורי בית לתרגול:\n${sessionSummarySend.homeworkForCustomer}`, ""); // i18n-ok
              if (sessionSummarySend.nextSessionGoals) lines.push(`🎯 יעדים לפגישה הבאה:\n${sessionSummarySend.nextSessionGoals}`, ""); // i18n-ok
              if (sessionSummarySend.rating) lines.push(`⭐ דירוג המפגש: ${"★".repeat(sessionSummarySend.rating)}`); // i18n-ok
              lines.push("", "נתראה בפגישה הבאה! 🐾"); // i18n-ok
              const msg = lines.join("\n");
              const url = `https://api.whatsapp.com/send?phone=${toWhatsAppPhone(sessionSummarySend.customerPhone)}&text=${encodeURIComponent(msg)}`;
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
                    {t("summarySend.send")}
                  </a>
                  <button
                    className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-petra-muted text-xs font-medium transition-colors"
                    onClick={() => setSessionSummarySend(null)}
                  >
                    {t("summarySend.skip")}
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

      {editSessionTarget && (() => {
        const editingProgram = programs.find((p) => p.id === editSessionTarget.programId);
        // Type change (פרטני / חבילה / קבוצתי) only applies to a HOME individual program —
        // not boarding-weekly, not service dogs, not boarding-linked programs.
        const canChangeType =
          !!editingProgram &&
          !editSessionTarget.isWeekly &&
          !editSessionTarget.isServiceDog &&
          editingProgram.trainingType === "HOME" &&
          !editingProgram.boardingStayId;
        return (
        <SessionLogModal
          dogName={editSessionTarget.dogName}
          sessionNumber={editSessionTarget.sessionNumber}
          isWeekly={editSessionTarget.isWeekly}
          isServiceDog={editSessionTarget.isServiceDog}
          isPending={editSessionMutation.isPending}
          initialData={editSessionTarget.initialData}
          onClose={() => setEditSessionTarget(null)}
          processKind={canChangeType ? (editingProgram!.isPackage ? "PACKAGE" : "INDIVIDUAL") : undefined}
          onSelectProcessType={
            canChangeType
              ? (target) => {
                  if (target === "GROUP") { setEditSessionTarget(null); setConvertToGroupTarget(editingProgram!); return; }
                  setProgramPackageMutation.mutate({ programId: editingProgram!.id, isPackage: target === "PACKAGE" });
                }
              : undefined
          }
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
        );
      })()}

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
          title={t("convertToPrivate.title")}
          message={t("convertToPrivate.message", { dog: convertParticipantTarget.dogName })}
          confirmLabel={t("convertToPrivate.confirm")}
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
          title={deleteGroupTarget.isWorkshop ? t("deleteGroup.titleWorkshop") : t("deleteGroup.title")}
          message={t("deleteGroup.message", { name: deleteGroupTarget.groupName })}
          confirmLabel={t("deleteGroup.confirm")}
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
  const t = useTranslations("training.trainingPage");
  const { formatDate } = useFmt();
  const badge = TYPE_BADGE[dog.type];
  const isLowSessions = dog.sessionsRemaining !== undefined && dog.sessionsRemaining <= 2 && dog.status === "ACTIVE";
  const isOverdue = dog.daysSinceLastSession !== undefined && dog.daysSinceLastSession >= 14 && dog.status === "ACTIVE";
  const isCompleted = dog.status === "COMPLETED";

  const whatsappUrl = dog.customerPhone
    ? `https://api.whatsapp.com/send?phone=${toWhatsAppPhone(dog.customerPhone)}&text=${encodeURIComponent(`שלום! עדכון אימון עבור ${dog.dogName} 🐾`)}` // i18n-ok — WhatsApp text sent to the client
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
          {t(`typeBadge.${dog.type}`)}
        </span>
      </div>

      {/* Detail */}
      <p className="text-xs text-petra-muted mb-3">{dog.detail}</p>

      {/* Progress bar */}
      {dog.progress && (
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-petra-muted mb-1">
            <span>{t("overview.sessions")}</span>
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
            {t("overview.sessionsLeft", { count: dog.sessionsRemaining })}
          </span>
        )}
        {isOverdue && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
            {t("overview.daysWithoutSession", { count: dog.daysSinceLastSession })}
          </span>
        )}
        {isCompleted && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> {t("overview.completed")}
          </span>
        )}
        {dog.lastSessionDate && !isCompleted && !isOverdue && (
          <span className="text-[10px] text-petra-muted">
            {t("overview.lastSessionAt", { date: formatDate(dog.lastSessionDate) })}
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
          {t("overview.sendOwnerUpdate")}
        </a>
      )}
    </div>
  );
}

function OverviewDogRow({ dog, onFocus }: { dog: UnifiedDog; onFocus: (dog: UnifiedDog) => void }) {
  const t = useTranslations("training.trainingPage");
  const { formatDate } = useFmt();
  const badge = TYPE_BADGE[dog.type];
  const isLowSessions = dog.sessionsRemaining !== undefined && dog.sessionsRemaining <= 2 && dog.status === "ACTIVE";
  const isOverdue = dog.daysSinceLastSession !== undefined && dog.daysSinceLastSession >= 14 && dog.status === "ACTIVE";
  const isCompleted = dog.status === "COMPLETED";

  const whatsappUrl = dog.customerPhone
    ? `https://api.whatsapp.com/send?phone=${toWhatsAppPhone(dog.customerPhone)}&text=${encodeURIComponent(`שלום! עדכון אימון עבור ${dog.dogName} 🐾`)}` // i18n-ok — WhatsApp text sent to the client
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
          {t(`typeBadge.${dog.type}`)}
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
          <span className="text-amber-600 font-medium">{t("overview.days", { count: dog.daysSinceLastSession })}</span>
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
            {t("overview.send")}
          </a>
        )}
      </td>
    </tr>
  );
}

function OverviewTab({ dogs, onFocus }: { dogs: UnifiedDog[]; onFocus: (dog: UnifiedDog) => void }) {
  const t = useTranslations("training.trainingPage");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  if (dogs.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Dog className="w-6 h-6 text-slate-400" /></div>
        <h3 className="text-base font-semibold text-petra-text mb-1">{t("overview.emptyTitle")}</h3>
        <p className="text-sm text-petra-muted">{t("overview.emptyHint")}</p>
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
    { label: t("overview.sectionAttention", { count: attention.length }), icon: <AlertTriangle className="w-4 h-4" />, labelClass: "text-red-600", dogs: attention },
    { label: t("overview.sectionActive", { count: active.length }), icon: <CheckCircle2 className="w-4 h-4" />, labelClass: "text-emerald-700", dogs: active },
    { label: t("overview.sectionCompleted", { count: completed.length }), icon: <Clock className="w-4 h-4" />, labelClass: "text-slate-500", dogs: completed },
  ].filter((s) => s.dogs.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="flex items-center bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode("list")}
            className={cn("p-1.5 rounded transition-colors", viewMode === "list" ? "bg-white shadow-sm text-brand-600" : "text-petra-muted")}
            title={t("overview.listView")}
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={cn("p-1.5 rounded transition-colors", viewMode === "grid" ? "bg-white shadow-sm text-brand-600" : "text-petra-muted")}
            title={t("overview.gridView")}
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
        <div className="card overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="p-3 font-medium text-petra-muted">{t("overview.colDog")}</th>
                <th className="p-3 font-medium text-petra-muted">{t("overview.colOwner")}</th>
                <th className="p-3 font-medium text-petra-muted">{t("overview.colType")}</th>
                <th className="p-3 font-medium text-petra-muted">{t("overview.colSessions")}</th>
                <th className="p-3 font-medium text-petra-muted">{t("overview.colLastSession")}</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <Fragment key={section.label}>
                  <tr className="bg-slate-50/80">
                    <td colSpan={6} className={cn("px-3 py-1.5 text-xs font-semibold", section.labelClass)}>
                      <div className="flex items-center gap-1.5">
                        {section.icon}
                        {section.label}
                      </div>
                    </td>
                  </tr>
                  {section.dogs.map((dog) => <OverviewDogRow key={dog.key} dog={dog} onFocus={onFocus} />)}
                </Fragment>
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
  const t = useTranslations("training.trainingPage");
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
    onError: () => toast.error(t("goals.updateError")),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      fetchJSON(`/api/training-programs/${programId}/goals?goalId=${goal.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); toast.success(t("goals.removed")); },
    onError: () => toast.error(t("goals.deleteError")),
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
          title={t("goals.changeStatus")}
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
          title={t("goals.delete")}
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
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
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
    onError: () => toast.error(t("homework.updateError")),
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
      toast.success(t("homework.added"));
    },
    onError: () => toast.error(t("homework.addError")),
  });

  const deleteMutation = useMutation({
    mutationFn: (homeworkId: string) =>
      fetchJSON(`/api/training-programs/${program.id}/homework?homeworkId=${homeworkId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["training-programs"] }),
    onError: () => toast.error(t("homework.deleteError")),
  });

  const completed = program.homework.filter((h) => h.isCompleted).length;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="w-3.5 h-3.5 text-petra-muted" />
        <h4 className="text-xs font-semibold text-petra-muted flex-1">
          {t("homework.title", { done: completed, total: program.homework.length })}
        </h4>
        {program.customer?.phone && program.homework.filter((h) => !h.isCompleted).length > 0 && (() => {
          const pending = program.homework.filter((h) => !h.isCompleted);
          const lines = [
            `📝 שיעורי בית לאימון — ${program.dog.name}`, // i18n-ok — WhatsApp text sent to the client
            "",
            ...pending.map((h, i) => `${i + 1}. ${h.title}`),
            "",
            "יש להתאמן על הנקודות הנ״ל עד המפגש הבא 🐾", // i18n-ok
          ];
          return (
            <a
              href={`https://api.whatsapp.com/send?phone=${toWhatsAppPhone(program.customer?.phone ?? "")}&text=${encodeURIComponent(lines.join("\n"))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-green-700 hover:text-green-800 font-medium flex items-center gap-0.5 bg-green-50 px-1.5 py-0.5 rounded"
              title={t("homework.send")}
              onClick={(e) => e.stopPropagation()}
            >
              <Send className="w-2.5 h-2.5" />
              {t("overview.send")}
            </a>
          );
        })()}
        <button
          className="me-0 ms-auto flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors border border-brand-200"
          onClick={() => setShowAdd((v) => !v)}
        >
          <Plus className="w-3.5 h-3.5" />
          {tc("actions.add")}
        </button>
      </div>

      {program.homework.length === 0 && !showAdd && (
        <p className="text-xs text-petra-muted">{t("homework.empty")}</p>
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
              className="text-petra-muted hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
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
            placeholder={t("homework.placeholder")}
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
            {addMutation.isPending ? "..." : tc("actions.add")}
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

function GoalSection({ program, label: labelProp }: { program: TrainingProgram; label?: string }) {
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
  const label = labelProp ?? t("goals.defaultLabel");
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
      toast.success(t("goals.added"));
    },
    onError: () => toast.error(t("goals.addError")),
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
          {t("goals.add")}
        </button>
      </div>

      {program.goals.length === 0 && !showAdd && (
        <p className="text-xs text-petra-muted">{t("goals.empty")}</p>
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
            placeholder={t("goals.placeholder")}
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
            {addMutation.isPending ? "..." : tc("actions.add")}
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

// First session slot with no COMPLETED row — completedCount+1 skips a
// scheduled-but-unrecorded session and records onto the wrong number.
function firstUnrecordedSession(sessions: Array<{ sessionNumber: number | null; status: string }>): number {
  const done = new Set(sessions.filter((s) => s.status === "COMPLETED").map((s) => s.sessionNumber ?? 0));
  let n = 1;
  while (done.has(n)) n++;
  return n;
}

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
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
  const { formatDate } = useFmt();
  const { cfg, locale } = useBusinessLocale();
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
      toast.success(t("checklist.rescheduled"));
    },
    onError: () => toast.error(t("checklist.rescheduleError")),
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
      toast.success(t("checklist.deleted"));
    },
    onError: () => toast.error(t("checklist.deleteError")),
  });
  const total = program.totalSessions;
  // Prefer the COMPLETED row when duplicate rows share a sessionNumber —
  // otherwise a stale SCHEDULED row hides the recorded session content.
  const sessionsByNumber = new Map<number, (typeof program.sessions)[number]>();
  for (const s of program.sessions) {
    const key = s.sessionNumber ?? 0;
    const existing = sessionsByNumber.get(key);
    if (!existing || (existing.status !== "COMPLETED" && s.status === "COMPLETED")) {
      sessionsByNumber.set(key, s);
    }
  }

  const formatSessionDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(d);
    const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: cfg.hourCycle }).format(d);
    return t("checklist.dateAtTime", { date, time });
  };

  return (
    <div className="mt-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-petra-muted flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          {total ? t("checklist.headerOf", { used: usedSessions, total }) : t("checklist.header", { used: usedSessions })}
        </h4>
        {total && (
          <span className="text-[11px] text-petra-muted">
            {total - usedSessions > 0 ? t("checklist.remaining", { count: total - usedSessions }) : t("checklist.allDone")}
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
              return <span key={num} className="w-2.5 h-2.5 rounded-full bg-slate-100 border border-slate-200" title={t("checklist.sessionN", { num })} />;
            }
            const r = session.rating;
            const color = !r ? "bg-slate-300" : r >= 4 ? "bg-emerald-500" : r === 3 ? "bg-amber-400" : "bg-red-400";
            return (
              <span
                key={num}
                className={cn("w-2.5 h-2.5 rounded-full", color)}
                title={r ? t("checklist.dotRated", { num, r }) : t("checklist.dotDone", { num })}
              />
            );
          })}
          <span className="text-[10px] text-petra-muted ms-0.5">{t("checklist.ratings")}</span>
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
          const isNext = num === firstUnrecordedSession(program.sessions) && program.status === "ACTIVE";
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

                <span className="text-xs font-medium text-petra-text flex-1">{t("checklist.sessionN", { num })}</span>

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
                        title={t("checklist.editSession")}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (confirm(t("checklist.confirmDelete"))) deleteSessionMutation.mutate(session.id); }}
                      disabled={deleteSessionMutation.isPending}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 text-slate-300 hover:text-red-500 transition-colors"
                      title={t("checklist.deleteSession")}
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
                      title={t("checklist.editTime")}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    {onCancelSession && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onCancelSession(session.id); }}
                        className="text-[10px] text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors"
                      >
                        {tc("actions.cancel")}
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
                      {tc("actions.add")}
                    </button>
                    {onScheduleSession && (
                      <button
                        type="button"
                        onClick={() => onScheduleSession(num)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                      >
                        <Calendar className="w-3 h-3" />
                        {t("checklist.setTime")}
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
                    <p className="text-[10px] font-semibold text-blue-700 mb-2">{t("checklist.editTimeTitle")}</p>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="label text-[10px]">{t("date")}</label>
                        <input type="date" lang={cfg.lang} className="input text-xs py-1.5" value={es.date} onChange={(e) => setEditingSession({ id: es.id, date: e.target.value, time: es.time, duration: es.duration })} />
                      </div>
                      <div className="flex-1">
                        <label className="label text-[10px]">{t("time")}</label>
                        <input type="time" className="input text-xs py-1.5" value={es.time} onChange={(e) => setEditingSession({ id: es.id, date: es.date, time: e.target.value, duration: es.duration })} />
                      </div>
                      <div className="w-20">
                        <label className="label text-[10px]">{t("durationMinutes")}</label>
                        <select className="input text-xs py-1.5" value={es.duration} onChange={(e) => setEditingSession({ id: es.id, date: es.date, time: es.time, duration: parseInt(e.target.value) })}>
                          {(DURATION_OPTIONS.includes(es.duration) ? DURATION_OPTIONS : [es.duration, ...DURATION_OPTIONS].sort((a, b) => a - b)).map((d) => (
                            <option key={d} value={d}>{t("minutesShort", { n: d })}</option>
                          ))}
                        </select>
                      </div>
                      <button className="btn-primary text-xs py-1.5" disabled={rescheduleSessionMutation.isPending || !es.date || !es.time} onClick={() => rescheduleSessionMutation.mutate({ sessionId: es.id, date: es.date, time: es.time, duration: es.duration })}>
                        {rescheduleSessionMutation.isPending ? tc("progress.saving") : tc("actions.save")}
                      </button>
                      <button className="btn-secondary text-xs py-1.5" onClick={() => setEditingSession(null)}>{tc("actions.cancel")}</button>
                    </div>
                  </div>
                );
              })()}

              {/* Expanded session details */}
              {expanded && session && (
                <div className="mx-3 mt-0.5 mb-1 p-3 bg-white border border-emerald-100 rounded-xl text-xs space-y-1.5">
                  {session.practiceItems && (
                    <div><span className="font-semibold text-petra-muted">{t("checklist.practice")} </span>{session.practiceItems}</div>
                  )}
                  {session.nextSessionGoals && (
                    <div><span className="font-semibold text-petra-muted">{t("checklist.nextGoals")} </span>{session.nextSessionGoals}</div>
                  )}
                  {session.homeworkForCustomer && (
                    <div><span className="font-semibold text-petra-muted">{t("checklist.homework")} </span>{session.homeworkForCustomer}</div>
                  )}
                  {session.summary && (
                    <div><span className="font-semibold text-petra-muted">{t("checklist.summary")} </span>{session.summary}</div>
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
                        {isScheduled ? t("checklist.scheduledSession") : t("checklist.sessionN", { num: session.sessionNumber || "" })}
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
                              title={t("checklist.editSession")}
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); if (confirm(t("checklist.confirmDelete"))) deleteSessionMutation.mutate(session.id); }}
                            disabled={deleteSessionMutation.isPending}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 text-slate-300 hover:text-red-500 transition-colors"
                            title={t("checklist.deleteSession")}
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
                            title={t("checklist.editTime")}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          {onCancelSession && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onCancelSession(session.id); }}
                              className="text-[10px] text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors"
                            >
                              {tc("actions.cancel")}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    {editingSession && editingSession.id === session.id && isScheduled && (() => {
                      const es = editingSession;
                      return (
                        <div className="mx-3 mt-0.5 mb-1 p-3 bg-blue-50 border border-blue-200 rounded-xl" onClick={(e) => e.stopPropagation()}>
                          <p className="text-[10px] font-semibold text-blue-700 mb-2">{t("checklist.editTimeTitle")}</p>
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <label className="label text-[10px]">{t("date")}</label>
                              <input type="date" lang={cfg.lang} className="input text-xs py-1.5" value={es.date} onChange={(e) => setEditingSession({ id: es.id, date: e.target.value, time: es.time, duration: es.duration })} />
                            </div>
                            <div className="flex-1">
                              <label className="label text-[10px]">{t("time")}</label>
                              <input type="time" className="input text-xs py-1.5" value={es.time} onChange={(e) => setEditingSession({ id: es.id, date: es.date, time: e.target.value, duration: es.duration })} />
                            </div>
                            <div className="w-20">
                              <label className="label text-[10px]">{t("durationMinutes")}</label>
                              <select className="input text-xs py-1.5" value={es.duration} onChange={(e) => setEditingSession({ id: es.id, date: es.date, time: es.time, duration: parseInt(e.target.value) })}>
                          {(DURATION_OPTIONS.includes(es.duration) ? DURATION_OPTIONS : [es.duration, ...DURATION_OPTIONS].sort((a, b) => a - b)).map((d) => (
                            <option key={d} value={d}>{t("minutesShort", { n: d })}</option>
                          ))}
                        </select>
                            </div>
                            <button className="btn-primary text-xs py-1.5" disabled={rescheduleSessionMutation.isPending || !es.date || !es.time} onClick={() => rescheduleSessionMutation.mutate({ sessionId: es.id, date: es.date, time: es.time, duration: es.duration })}>
                              {rescheduleSessionMutation.isPending ? tc("progress.saving") : tc("actions.save")}
                            </button>
                            <button className="btn-secondary text-xs py-1.5" onClick={() => setEditingSession(null)}>{tc("actions.cancel")}</button>
                          </div>
                        </div>
                      );
                    })()}
                    {expanded && (
                      <div className="mx-3 mt-0.5 mb-1 p-3 bg-white border border-emerald-100 rounded-xl text-xs space-y-1.5">
                        {session.practiceItems && <div><span className="font-semibold text-petra-muted">{t("checklist.practice")} </span>{session.practiceItems}</div>}
                        {session.nextSessionGoals && <div><span className="font-semibold text-petra-muted">{t("checklist.nextGoals")} </span>{session.nextSessionGoals}</div>}
                        {session.homeworkForCustomer && <div><span className="font-semibold text-petra-muted">{t("checklist.homework")} </span>{session.homeworkForCustomer}</div>}
                        {session.summary && <div><span className="font-semibold text-petra-muted">{t("checklist.summary")} </span>{session.summary}</div>}
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
            {t("checklist.logSession")}
          </button>
          {onScheduleSession && (
            <button
              type="button"
              onClick={() => onScheduleSession(usedSessions + 1)}
              className="flex-1 py-2 rounded-xl border-2 border-dashed border-blue-200 text-xs font-semibold text-blue-500 hover:bg-blue-50 hover:border-blue-400 transition-all flex items-center justify-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              {t("checklist.scheduleAhead")}
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
  const t = useTranslations("training.trainingPage");
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
      toast.success(t("sdPhase.updated"));
    },
    onError: () => toast.error(t("sdPhase.updateError")),
  });

  const currentIdx = SERVICE_DOG_PHASES.findIndex((p) => p.value === program.programType);

  return (
    <div className="mb-4 p-3 rounded-xl bg-brand-50 border border-brand-100 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
          <span className="text-xs font-semibold text-brand-700">{t("sdPhase.title")}</span>
        </div>
        <a href="/service-dogs/dogs" className="text-[10px] text-brand-600 hover:text-brand-700 font-medium flex items-center gap-0.5">
          {t("sdPhase.fullProfile")}
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
            title={t(`sdPhases.${phase.value}`)}
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
              {t(`sdPhases.${phase.value}`)}
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
  const t = useTranslations("training.trainingPage");
  const { formatDate } = useFmt();
  const { cfg, locale } = useBusinessLocale();
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return programs;
    const q = searchQuery.toLowerCase();
    return programs.filter((p) => p.dog.name.toLowerCase().includes(q));
  }, [programs, searchQuery]);

  if (filtered.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Shield className="w-6 h-6 text-slate-400" /></div>
        <h3 className="text-base font-semibold text-petra-text mb-1">{t("sdLog.emptyTitle")}</h3>
        <p className="text-sm text-petra-muted">
          <a href="/service-dogs" className="text-brand-600 hover:underline">{t("sdLog.goToServiceDogs")}</a>
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
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusInfo.color)}>{t(`programStatus.${PROGRAM_STATUS_MAP[program.status] ? program.status : "ACTIVE"}`)}</span>
                    {program.programType && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-brand-100 text-brand-700">
                        {SERVICE_DOG_PHASES.some((p) => p.value === program.programType) ? t(`sdPhases.${program.programType}`) : program.programType}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-petra-muted">
                    <span>{t("sdLog.sessionsDone", { count: usedSessions })}</span>
                    {program.startDate && <span>{t("sdLog.started", { date: formatDate(program.startDate) })}</span>}
                  </div>
                </div>
                <a href={`/service-dogs/${program.dog.id}`} className="text-xs text-brand-600 hover:underline flex items-center gap-0.5 flex-shrink-0">
                  {t("sdLog.profile")}
                </a>
              </div>
              {/* Actions — no finish/dropout for service dogs; managed via service dogs system */}
              <div className="flex gap-2 mt-3 flex-wrap">
                <button className="btn-secondary text-xs" onClick={() => onEditSettings(program)}>
                  <Settings className="w-3.5 h-3.5" /> {t("sdLog.settings")}
                </button>
                <a href={`/service-dogs/${program.dog.id}`} className="btn-secondary text-xs flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" /> {t("sdLog.manage")}
                </a>
              </div>
            </div>

            {/* Session log */}
            <div className="p-4">
              <h4 className="text-xs font-semibold text-petra-muted mb-3 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {t("sdLog.title")}
              </h4>

              {completedSessions.length === 0 ? (
                <p className="text-xs text-petra-muted text-center py-4">{t("sdLog.empty")}</p>
              ) : (
                <div className="space-y-2">
                  {completedSessions.map((session) => (
                    <div key={session.id} className="p-3 rounded-xl bg-slate-50 border border-petra-border text-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-petra-text">{t("sdLog.sessionN", { n: session.sessionNumber })}</span>
                        <div className="flex items-center gap-2">
                          {session.rating && <span className="text-amber-500">{"★".repeat(session.rating)}</span>}
                          <span className="text-petra-muted">{formatDate(session.sessionDate)}</span>
                        </div>
                      </div>
                      {session.practiceItems && (
                        <div className="mb-1.5">
                          <span className="font-medium text-petra-muted">{t("sdLog.practice")} </span>
                          <span className="text-petra-text whitespace-pre-line">{session.practiceItems}</span>
                        </div>
                      )}
                      {session.summary && (
                        <div className="mb-1.5">
                          <span className="font-medium text-petra-muted">{t("sdLog.summary")} </span>
                          <span className="text-petra-text whitespace-pre-line">{session.summary}</span>
                        </div>
                      )}
                      {session.nextSessionGoals && (
                        <div className="mb-1.5">
                          <span className="font-medium text-petra-muted">{t("sdLog.nextGoals")} </span>
                          <span className="text-petra-text whitespace-pre-line">{session.nextSessionGoals}</span>
                        </div>
                      )}
                      {session.homeworkForCustomer && (
                        <div className="mb-1.5">
                          <span className="font-medium text-petra-muted">{t("sdLog.teamNotes")} </span>
                          <span className="text-petra-text whitespace-pre-line">{session.homeworkForCustomer}</span>
                        </div>
                      )}
                      {(session as { trainerName?: string | null }).trainerName && (
                        <div className="mt-1 text-[11px] text-petra-muted">
                          {t("sdLog.trainer", { name: (session as { trainerName?: string | null }).trainerName ?? "" })}
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
                    win.document.write(`<html dir="${cfg.dir}" lang="${cfg.lang}"><head><title>${t("printLog.title", { dog: escapeHtml(program.dog.name) })}</title><style>body{font-family:sans-serif;padding:24px;direction:${cfg.dir}}h1{font-size:20px;margin-bottom:4px}h2{font-size:13px;color:#666;margin-bottom:20px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:8px;text-align:start}th{background:#f3f4f6}@media print{button{display:none}}</style></head><body>`);
                    win.document.write(`<h1>${t("printLog.title", { dog: escapeHtml(program.dog.name) })}</h1><h2>${t("printLog.subtitle", { count: completedSessions.length, date: new Date().toLocaleDateString(locale) })}</h2>`);
                    win.document.write(`<table><thead><tr><th>#</th><th>${t("date")}</th><th>${t("printLog.colTrainer")}</th><th>${t("printLog.colRating")}</th><th>${t("printLog.colPractice")}</th><th>${t("printLog.colNextGoals")}</th><th>${t("printLog.colTeamNotes")}</th><th>${t("printLog.colSummary")}</th></tr></thead><tbody>`);
                    completedSessions.forEach((s) => {
                      const sTyped = s as { sessionNumber?: number | null; sessionDate: string; trainerName?: string | null; rating?: number | null; practiceItems?: string | null; nextSessionGoals?: string | null; homeworkForCustomer?: string | null; summary?: string | null };
                      win.document.write(`<tr><td>${sTyped.sessionNumber ?? ""}</td><td>${new Date(sTyped.sessionDate).toLocaleDateString(locale)}</td><td>${escapeHtml(sTyped.trainerName)}</td><td>${sTyped.rating ? "★".repeat(sTyped.rating) : ""}</td><td>${escapeHtml(sTyped.practiceItems)?.replace(/\n/g, "<br>")}</td><td>${escapeHtml(sTyped.nextSessionGoals)?.replace(/\n/g, "<br>")}</td><td>${escapeHtml(sTyped.homeworkForCustomer)?.replace(/\n/g, "<br>")}</td><td>${escapeHtml(sTyped.summary)?.replace(/\n/g, "<br>")}</td></tr>`);
                    });
                    win.document.write("</tbody></table></body></html>");
                    win.document.close();
                    win.print();
                  }}
                >
                  <Printer className="w-3.5 h-3.5" />
                  {t("printLog.print")}
                </button>
              )}

              {/* Add session button */}
              {program.status === "ACTIVE" && (
                <button
                  type="button"
                  disabled={isMarkingAttendance}
                  onClick={() => onMarkAttendance(program.id, firstUnrecordedSession(program.sessions), program.dog.name, program.customer?.phone ?? "", program.customer?.name ?? "")}
                  className="mt-3 w-full py-2.5 rounded-xl border-2 border-dashed border-brand-200 text-xs font-semibold text-brand-500 hover:bg-brand-50 hover:border-brand-400 transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t("sdLog.addSession")}
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
  onDeleteProgram?: (program: TrainingProgram) => void;
  isUpdatingStatus?: boolean;
  onScheduleSession?: (programId: string, sessionNumber: number, dogName: string, customerId?: string, customerName?: string, customerPhone?: string) => void;
  onCancelSession?: (programId: string, sessionId: string) => void;
  onEditSession?: (programId: string, session: ProgramSession, dogName: string) => void;
}) {
  const t = useTranslations("training.trainingPage");
  const { formatDate, formatCurrency } = useFmt();
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
        <p className="text-sm text-petra-muted">{t("individual.count", { count: filtered.length })}</p>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><GraduationCap className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">{t("individual.emptyTitle")}</h3>
          <p className="text-sm text-petra-muted">{t("individual.emptyHint")}</p>
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
                        {t(`programStatus.${PROGRAM_STATUS_MAP[program.status] ? program.status : "ACTIVE"}`)}
                      </span>
                      {isLowSessions && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {t("individual.lowSessions")}
                        </span>
                      )}
                      {dogGroupMap.get(program.dog.id) && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {t("individual.alsoInGroup", { group: dogGroupMap.get(program.dog.id) ?? "" })}
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
                        {programTypeLabel(t, program.programType)}
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
                        {t("sdLog.settings")}
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
                          title={!allSessionsDone ? t("individual.finishBlocked", { total: program.totalSessions ?? "", done: usedSessions }) : undefined}
                          onClick={(e) => { e.stopPropagation(); onFinishProgram(program.id, program.dog.name); }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {t("individual.finish")}
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
                          {t("individual.dropout")}
                        </button>
                      )}
                      {onDeleteProgram && (
                        <button
                          className="btn-secondary text-xs text-red-500 hover:text-red-600 border-red-200 hover:border-red-300"
                          onClick={(e) => { e.stopPropagation(); onDeleteProgram(program); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {t("individual.deleteProgram")}
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
                              `שלום ${program.customer?.name ?? ""}! 🐾`, // i18n-ok
                              `דוח התקדמות אילוף — ${program.dog.name}`, // i18n-ok
                              "",
                              `📊 מפגשים: ${usedSessions}${program.totalSessions ? `/${program.totalSessions}` : ""}`, // i18n-ok
                            ];
                            if (totalGoals > 0) lines.push(`🎯 יעדים: ${completedGoals}/${totalGoals} הושגו`); // i18n-ok
                            if (totalHomework > 0) lines.push(`📝 שיעורי בית: ${completedHomework}/${totalHomework} הושלמו`); // i18n-ok
                            if (lastSession?.summary) {
                              lines.push("", `💬 סיכום מפגש אחרון:`, lastSession.summary); // i18n-ok
                            }
                            return `https://api.whatsapp.com/send?phone=${toWhatsAppPhone(program.customer?.phone ?? "")}&text=${encodeURIComponent(lines.join("\n"))}`;
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Send className="w-3.5 h-3.5" />
                          {t("individual.sendReport")}
                        </a>
                      )}
                      {program.customer?.phone && program.status === "COMPLETED" && (
                        <a
                          href={(() => {
                            const completedGoals = program.goals?.filter((g: { status: string }) => g.status === "ACHIEVED").length ?? 0;
                            const totalGoals = program.goals?.length ?? 0;
                            const lines = [
                              `🎓 *תעודת סיום אילוף*`, // i18n-ok
                              "",
                              `כלב: ${program.dog.name}${program.dog.breed ? ` (${program.dog.breed})` : ""}`, // i18n-ok
                              `בעלים: ${program.customer?.name ?? ""}`, // i18n-ok
                              `תוכנית: ${program.name}`, // i18n-ok
                              `מפגשים שהושלמו: ${usedSessions}`, // i18n-ok
                              totalGoals > 0 ? `יעדים שהושגו: ${completedGoals}/${totalGoals}` : "", // i18n-ok
                              "",
                              `🏆 ${program.dog.name} סיים/ה בהצלחה את תוכנית האילוף!`, // i18n-ok
                              `מברכים אתכם ומאחלים המשך הנאה עם הכלב! 🐾`, // i18n-ok
                            ].filter(Boolean);
                            return `https://api.whatsapp.com/send?phone=${toWhatsAppPhone(program.customer?.phone ?? "")}&text=${encodeURIComponent(lines.join("\n"))}`;
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-xs"
                          onClick={(e) => e.stopPropagation()}
                          title={t("individual.sendCertificateTitle")}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {t("individual.certificate")}
                        </a>
                      )}
                    </div>

                    {/* Details Info */}
                    <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-petra-muted bg-slate-50 p-3 rounded-xl border border-petra-border">
                      <div>
                        <span className="font-semibold block mb-0.5">{t("individual.startDate")}</span>
                        {program.startDate ? formatDate(program.startDate) : "-"}
                      </div>
                      <div>
                        <span className="font-semibold block mb-0.5">{t("individual.estimatedEnd")}</span>
                        {program.endDate ? formatDate(program.endDate) : "-"}
                      </div>
                      <div>
                        <span className="font-semibold block mb-0.5">{t("individual.location")}</span>
                        {program.location || "-"}
                      </div>
                      <div>
                        <span className="font-semibold block mb-0.5">{t("individual.frequency")}</span>
                        {program.frequency === "WEEKLY" ? t("frequency.WEEKLY") :
                          program.frequency === "BIWEEKLY" ? t("frequency.BIWEEKLY") :
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
                        {t("individual.viewOrder")}
                      </a>
                    )}

                    {/* Service dog phase selector */}
                    {program.trainingType === "SERVICE_DOG" && (
                      <ServiceDogPhaseRow program={program} />
                    )}

                    {/* Behavior Baseline */}
                    {program.behaviorBaseline && (
                      <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                        <span className="font-semibold block mb-0.5">{t("individual.baseline")}</span>
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
                      onAddSession={() => onMarkAttendance(program.id, firstUnrecordedSession(program.sessions), program.dog.name, program.customer?.phone ?? "", program.customer?.name ?? "")}
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
  availableStays,
  boardingPrograms,
  homePrograms,
  searchQuery,
  onAddTraining,
  onLogSession,
  onLogHomeSession,
}: {
  stays: BoardingStay[];
  /** Current stays with no training — listed only in the explicit "add training" picker. */
  availableStays: BoardingStay[];
  boardingPrograms: TrainingProgram[];
  homePrograms: TrainingProgram[];
  searchQuery: string;
  onAddTraining: (stay: BoardingStay) => void;
  onLogSession: (programId: string, sessionNumber: number, dogName: string, goals?: { id: string; title: string; status: string; progressPercent: number }[]) => void;
  onLogHomeSession: (programId: string, sessionNumber: number, dogName: string) => void;
}) {
  const t = useTranslations("training.trainingPage");
  const { formatDate } = useFmt();
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return stays;
    const q = searchQuery.toLowerCase();
    return stays.filter(
      (s) =>
        s.pet.name.toLowerCase().includes(q) ||
        s.customer.name.toLowerCase().includes(q)
    );
  }, [stays, searchQuery]);

  const [showPicker, setShowPicker] = useState(false);
  const pickerStays = useMemo(() => {
    if (!searchQuery.trim()) return availableStays;
    const q = searchQuery.toLowerCase();
    return availableStays.filter(
      (s) => s.pet.name.toLowerCase().includes(q) || s.customer.name.toLowerCase().includes(q)
    );
  }, [availableStays, searchQuery]);

  const picker = availableStays.length > 0 && (
    <div className="card p-0 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-petra-text hover:bg-slate-50"
        onClick={() => setShowPicker((v) => !v)}
        aria-expanded={showPicker}
      >
        <span className="text-xs text-petra-muted">{t("boardingTab.availableCount", { count: availableStays.length })}</span>
        <span className="flex items-center gap-1.5">
          {t("boardingTab.addToStay")}
          <Plus className="w-4 h-4" />
        </span>
      </button>
      {showPicker && (
        <div className="border-t divide-y">
          {pickerStays.length === 0 ? (
            <p className="px-4 py-3 text-xs text-petra-muted text-start">{t("boardingTab.noStays")}</p>
          ) : (
            pickerStays.map((stay) => (
              <div key={stay.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <button type="button" className="btn-secondary text-xs" onClick={() => onAddTraining(stay)}>
                  <Plus className="w-3.5 h-3.5" />
                  {t("boardingTab.createProgram")}
                </button>
                <div className="min-w-0 text-start">
                  <p className="text-sm font-medium text-petra-text truncate">{stay.pet.name}</p>
                  <p className="text-xs text-petra-muted truncate">
                    {stay.customer.name}
                    {stay.checkOut ? t("boardingTab.pickerCheckout", { date: formatDate(stay.checkOut) }) : ""}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  if (filtered.length === 0) {
    return (
      <div className="space-y-3">
        <div className="empty-state">
          <div className="empty-state-icon"><Hotel className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">{t("boardingTab.emptyTitle")}</h3>
          <p className="text-sm text-petra-muted">{t("boardingTab.emptyHint")}</p>
        </div>
        {picker}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {picker}
      {filtered.map((stay) => {
        const linkedProgram = boardingPrograms.find((p) => p.boardingStayId === stay.id);
        const homeProgram = linkedProgram
          ? homePrograms.find((p) => p.dog.id === linkedProgram.dog.id && ["ACTIVE", "PAUSED"].includes(p.status))
          : null;
        const daysRemaining = stay.checkOut
          ? Math.ceil((new Date(stay.checkOut).getTime() - Date.now()) / 86400000)
          : null;
        const usedSessions = linkedProgram?.sessions?.filter((s) => s.status === "COMPLETED").length ?? 0;
        const nextSessionNum = firstUnrecordedSession(linkedProgram?.sessions ?? []);
        const homeUsedSessions = homeProgram?.sessions?.filter((s) => s.status === "COMPLETED").length ?? 0;
        const homeNextSession = firstUnrecordedSession(homeProgram?.sessions ?? []);

        return (
          <div key={stay.id} className="card p-0 overflow-hidden">
            {/* ── Card header ── */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                {linkedProgram ? (
                  linkedProgram.startDate && linkedProgram.endDate ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {t("programStatus.ACTIVE")}
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{t("boardingTab.missingDates")}</span>
                  )
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">{t("boardingTab.noProgram")}</span>
                )}
                {daysRemaining !== null && (
                  <span className={cn(
                    "text-[10px] font-medium px-2 py-0.5 rounded-full",
                    daysRemaining <= 1 ? "bg-red-100 text-red-700" :
                    daysRemaining <= 3 ? "bg-amber-100 text-amber-700" :
                    "bg-slate-100 text-slate-600"
                  )}>
                    {t("boardingTab.daysLeft", { count: Math.max(0, daysRemaining) })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <div>
                  <p className="text-sm font-bold text-petra-text text-start">{stay.pet.name}</p>
                  <p className="text-xs text-petra-muted text-start">{stay.customer.name}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Hotel className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </div>

            {/* ── Stay dates row ── */}
            <div className="flex items-center justify-end gap-3 text-xs text-petra-muted bg-slate-50 px-4 py-2 border-t border-b">
              {stay.checkOut && <span>{t("boardingTab.checkOut", { date: formatDate(stay.checkOut) })}</span>}
              {stay.checkOut && <span>•</span>}
              <span>{t("boardingTab.checkIn", { date: formatDate(stay.checkIn) })}</span>
              <span>•</span>
              <span>{stay.room?.name ?? t("boardingTab.noRoom")}</span>
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            </div>

            {/* ── Program section ── */}
            <div className="px-4 pb-4 pt-3">
              {linkedProgram ? (
                <div className="space-y-3">
                  {(linkedProgram.startDate || linkedProgram.endDate) && (
                    <div className="flex items-center justify-end gap-2 text-xs text-petra-muted">
                      {linkedProgram.endDate && <span>{t("endAt", { date: formatDate(linkedProgram.endDate) })}</span>}
                      {linkedProgram.startDate && linkedProgram.endDate && <span>•</span>}
                      {linkedProgram.startDate && <span>{t("startAt", { date: formatDate(linkedProgram.startDate) })}</span>}
                    </div>
                  )}
                  <div className="space-y-2">
                    {linkedProgram.behaviorBaseline && (
                      <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                        <p className="text-[10px] font-bold text-blue-600 mb-1">{t("boardingTab.baseline")}</p>
                        <p className="text-xs text-petra-text">{linkedProgram.behaviorBaseline}</p>
                      </div>
                    )}
                    {linkedProgram.customerExpectations && (
                      <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
                        <p className="text-[10px] font-bold text-purple-600 mb-1">{t("boardingTab.expectations")}</p>
                        <p className="text-xs text-petra-text">{linkedProgram.customerExpectations}</p>
                      </div>
                    )}
                    {linkedProgram.workPlan && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                        <p className="text-[10px] font-bold text-amber-600 mb-1">{t("boardingTab.workPlan")}</p>
                        <p className="text-xs text-petra-text whitespace-pre-line">{linkedProgram.workPlan}</p>
                      </div>
                    )}
                  </div>
                  <GoalSection program={linkedProgram} label={t("boardingTab.goalsLabel")} />
                  {linkedProgram.sessions && linkedProgram.sessions.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-petra-muted">{t("boardingTab.weeklyUpdates", { count: usedSessions })}</p>
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
                    {nextSessionNum > 1 ? t("boardingTab.weeklyUpdateBtn", { n: nextSessionNum }) : t("boardingTab.weeklyUpdateBtnFirst")}
                  </button>
                  {homeProgram && (
                    <button
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mt-1 border border-green-200 bg-green-50 text-green-800 hover:bg-green-100"
                      onClick={() => onLogHomeSession(homeProgram.id, homeNextSession, stay.pet.name)}
                    >
                      <span className="text-[11px] text-green-600">
                        {homeProgram.totalSessions ? t("boardingTab.homeSessionsOf", { used: homeUsedSessions, total: homeProgram.totalSessions }) : t("boardingTab.homeSessions", { count: homeUsedSessions })}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {homeNextSession > 1 ? t("boardingTab.homeSessionN", { n: homeNextSession }) : t("boardingTab.homeSession")}
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
                          {daysRemaining <= 0 ? t("boardingTab.leavingToday") : t("boardingTab.onlyDaysLeft", { count: daysRemaining })}
                        </p>
                        <p className="text-[10px] text-red-600 mt-0.5">{t("boardingTab.noProgramYet")}</p>
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
                    {t("boardingTab.createBoardingProgram")}
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
  const t = useTranslations("training.trainingPage");
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
        <p className="text-sm text-petra-muted">{t("groupsTab.count", { count: filtered.length })}</p>
        <button className="btn-primary" onClick={onNewGroup}>
          <Plus className="w-4 h-4" />
          {t("groupsTab.new")}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Users className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">{t("groupsTab.emptyTitle")}</h3>
          <p className="text-sm text-petra-muted">{t("groupsTab.emptyHint")}</p>
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
  const t = useTranslations("training.trainingPage");
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
        <p className="text-sm text-petra-muted">{t("workshopsTab.count", { count: filtered.length })}</p>
        <button className="btn-primary" onClick={onNewWorkshop}>
          <Plus className="w-4 h-4" />
          {t("workshopsTab.new")}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Calendar className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">{t("workshopsTab.emptyTitle")}</h3>
          <p className="text-sm text-petra-muted">{t("workshopsTab.emptyHint")}</p>
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
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const { formatDate, formatCurrency } = useFmt();
  const queryClient = useQueryClient();
  const [expandedAttendanceSession, setExpandedAttendanceSession] = useState<string | null>(null);
  const [sessionNotesInput, setSessionNotesInput] = useState<Record<string, string>>({});
  const [showAddSession, setShowAddSession] = useState(false);
  const [editingSession, setEditingSession] = useState<{ id: string; date: string; time: string } | null>(null);
  const [convertParticipantId, setConvertParticipantId] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const defaultTime = group.defaultTime || "10:00";
  const [newSessionDate, setNewSessionDate] = useState(today);
  const [newSessionTime, setNewSessionTime] = useState(defaultTime);
  const [seriesCount, setSeriesCount] = useState(8);

  // Workshop ops: capacity counts ACTIVE only (WAITLIST/DROPPED/PAUSED don't take seats)
  const activeParticipants = group.participants.filter((p) => p.status === "ACTIVE");
  const waitlistParticipants = group.participants.filter((p) => p.status === "WAITLIST");
  const isFull = group.maxParticipants != null && activeParticipants.length >= group.maxParticipants;
  const collectedAmount = activeParticipants.reduce((sum, p) => sum + (p.order?.paidAmount ?? 0), 0);
  const expectedAmount = (group.price ?? 0) * activeParticipants.length;
  const mainParticipants = isWorkshop ? activeParticipants : group.participants;

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
      toast.success(t("group.sessionCreated"));
    },
    onError: (err: Error) => toast.error(err.message || t("group.sessionCreateError")),
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
      toast.success(t("group.seriesCreated", { count: res?.created ?? seriesCount }));
    },
    onError: () => toast.error(t("group.seriesError")),
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
    onError: () => toast.error(t("group.attendanceError")),
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
      toast.success(t("group.summarySaved"));
    },
    onError: () => toast.error(t("group.summaryError")),
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
      toast.success(t("checklist.rescheduled"));
    },
    onError: (err: Error) => toast.error(err.message || t("checklist.rescheduleError")),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      fetchJSON(`/api/training-groups/${group.id}/sessions/${sessionId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-groups"] });
      queryClient.invalidateQueries({ queryKey: ["training-group-sessions-cal"] });
      toast.success(t("checklist.deleted"));
    },
    onError: () => toast.error(t("checklist.deleteError")),
  });

  // Seed attendance rows for a session (idempotent); optional markAll bulk-sets everyone PRESENT
  const seedAttendanceMutation = useMutation({
    mutationFn: ({ sessionId, markAll }: { sessionId: string; markAll?: "PRESENT" }) =>
      fetchJSON(`/api/training-groups/${group.id}/sessions/${sessionId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(markAll ? { markAll } : {}),
      }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["training-groups"] });
      setExpandedAttendanceSession(vars.sessionId);
      if (vars.markAll === "PRESENT") toast.success(t("group.allMarkedPresent"));
    },
    onError: (err: Error) => toast.error(err.message || t("group.attendanceUpdateError")),
  });

  // Promote WAITLIST → ACTIVE (workshops)
  const promoteMutation = useMutation({
    mutationFn: (participantId: string) =>
      fetchJSON(`/api/training-groups/${group.id}/participants/${participantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "promote" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-groups"] });
      toast.success(t("group.promoted"));
    },
    onError: (err: Error) => toast.error(err.message || t("group.promoteError")),
  });

  // Create payment-request Order for a workshop participant, then open WhatsApp
  const createOrderMutation = useMutation({
    mutationFn: (participantId: string) =>
      fetchJSON<{
        order: { id: string; total: number };
        customer: { name: string; phone: string };
        businessPhone: string | null;
        paymentUrl: string | null;
      }>(`/api/training-groups/${group.id}/participants/${participantId}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["training-groups"] });
      toast.success(t("group.paymentRequestCreated"));
      const phone = toWhatsAppPhone(data.customer?.phone ?? "");
      if (!phone) return;
      const amount = formatCurrency(data.order?.total ?? group.price ?? 0);
      const lines: string[] = [
        `שלום ${data.customer?.name ?? ""}! 🐾`, // i18n-ok
        `דרישת תשלום עבור הסדנה "${group.name}"`, // i18n-ok
        `סכום לתשלום: ${amount}`, // i18n-ok
      ];
      if (data.paymentUrl) lines.push("", `לתשלום מאובטח בקישור:`, data.paymentUrl); // i18n-ok
      lines.push("", `לשאלות אנחנו זמינים${data.businessPhone ? ` בטלפון ${data.businessPhone}` : ""}. תודה! 🐾`); // i18n-ok
      window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
    },
    onError: (err: Error) => toast.error(err.message || t("group.paymentRequestError")),
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
            {isWorkshop && group.maxParticipants != null && (
              <span
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-medium",
                  isFull ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                )}
              >
                {activeParticipants.length}/{group.maxParticipants}
                {isFull && t("group.full")}
              </span>
            )}
            {isWorkshop && group.price != null && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700">
                {formatCurrency(group.price)}
              </span>
            )}
            {!group.isActive && <span className="badge-danger text-[10px]">{t("group.inactive")}</span>}
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-petra-muted flex-wrap">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {t("group.participants", { count: isWorkshop ? activeParticipants.length : group._count.participants })}
              {group.maxParticipants && ` / ${group.maxParticipants}`}
            </span>
            {group.defaultDayOfWeek !== null && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {t("group.dayOf", { day: dayName(t, group.defaultDayOfWeek) })}
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
              {t("group.addSession")}
            </button>
            <button className="btn-secondary text-xs" onClick={(e) => { e.stopPropagation(); onAssignDog(); }}>
              <Plus className="w-3.5 h-3.5" />
              {t("group.assignClient")}
            </button>
            <button className="btn-secondary text-xs" onClick={(e) => { e.stopPropagation(); onEditGroup(); }}>
              <Pencil className="w-3.5 h-3.5" />
              {isWorkshop ? t("group.editWorkshop") : t("group.editGroup")}
            </button>
            {onDeleteGroup && (
              <button
                className="btn-secondary text-xs text-red-500 hover:text-red-600 border-red-200 hover:border-red-300"
                onClick={(e) => { e.stopPropagation(); onDeleteGroup(); }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isWorkshop ? t("group.deleteWorkshop") : t("group.deleteGroup")}
              </button>
            )}
            {isWorkshop && activeParticipants.length > 0 && (
              <button
                className="btn-secondary text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  // Open WhatsApp for each active participant (waitlist excluded)
                  activeParticipants.forEach((p) => {
                    if (p.customer?.phone ?? "") {
                      const phone = toWhatsAppPhone(p.customer?.phone ?? "");
                      const msg = encodeURIComponent(
                        `היי! תזכורת לסדנת "${group.name}"${group.location ? ` ב${group.location}` : ""}${group.defaultTime ? ` בשעה ${group.defaultTime}` : ""}. נתראה!` // i18n-ok
                      );
                      window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${msg}`, "_blank");
                    }
                  });
                }}
              >
                <Send className="w-3.5 h-3.5" />
                {t("group.sendReminder")}
              </button>
            )}
          </div>

          {/* Add Session Inline Form */}
          {showAddSession && (
            <div className="mx-4 mb-3 p-3 rounded-xl bg-brand-50 border border-brand-100 space-y-2">
              <p className="text-xs font-semibold text-brand-700">{t("group.newSession")}</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="label text-[10px]">{t("date")}</label>
                  <input
                    type="date" lang={cfg.lang}
                    className="input text-xs py-1.5"
                    value={newSessionDate}
                    onChange={(e) => setNewSessionDate(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="flex-1">
                  <label className="label text-[10px]">{t("time")}</label>
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
                  {addSessionMutation.isPending ? t("group.creating") : t("group.createSession")}
                </button>
                <button
                  className="btn-secondary text-xs"
                  onClick={(e) => { e.stopPropagation(); setShowAddSession(false); }}
                >
                  {tc("actions.cancel")}
                </button>
              </div>
              {/* Recurring weekly series */}
              <div className="pt-2 mt-1 border-t border-brand-100 flex items-end gap-2">
                <div className="flex-1">
                  <label className="label text-[10px]">{t("group.weeklySeries")}</label>
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
                  title={t("group.seriesHint")}
                >
                  {generateSeriesMutation.isPending ? t("group.creating") : t("group.createSeries", { count: seriesCount })}
                </button>
              </div>
            </div>
          )}

          {/* Participants */}
          <div className="p-4 border-b border-petra-border">
            <h4 className="text-xs font-semibold text-petra-muted mb-3 flex items-center gap-1.5">
              <Dog className="w-3.5 h-3.5" />
              {t("group.participantsHeader", { count: mainParticipants.length })}
            </h4>
            {mainParticipants.length === 0 ? (
              <p className="text-xs text-petra-muted">{t("group.noParticipants")}</p>
            ) : (
              <div className={cn("grid gap-2", isWorkshop ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
                {mainParticipants.map((p) => {
                  const paymentChip = !isWorkshop
                    ? null
                    : !p.order
                      ? { label: t("group.pay.noOrder"), cls: "bg-slate-100 text-slate-500" }
                      : p.order.paidAmount >= p.order.total
                        ? { label: t("group.pay.paid"), cls: "bg-emerald-100 text-emerald-700" }
                        : p.order.paidAmount > 0
                          ? { label: t("group.pay.partial"), cls: "bg-blue-100 text-blue-700" }
                          : { label: t("group.pay.pending"), cls: "bg-amber-100 text-amber-700" };
                  return (
                    <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 group/item">
                      <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center text-xs font-bold text-brand-600 flex-shrink-0">
                        {p.dog.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-petra-text truncate">
                          {p.dog.name}
                          {p.dog.breed && <span className="text-petra-muted font-normal"> ({p.dog.breed})</span>}
                        </p>
                        <p className="text-[10px] text-petra-muted truncate">{p.customer?.name ?? ""}</p>
                      </div>
                      {isWorkshop && (p.heldCount ?? 0) > 0 && (
                        <span className="text-[10px] text-petra-muted whitespace-nowrap">
                          {t("group.attended", { attended: p.attendedCount ?? 0, held: p.heldCount ?? 0 })}
                        </span>
                      )}
                      {paymentChip && (
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0", paymentChip.cls)}>
                          {paymentChip.label}
                        </span>
                      )}
                      {isWorkshop && !p.order && !p.orderId && group.price != null && (
                        <button
                          className="btn-secondary text-[10px] py-1 px-2 whitespace-nowrap flex-shrink-0"
                          disabled={createOrderMutation.isPending}
                          onClick={(e) => { e.stopPropagation(); createOrderMutation.mutate(p.id); }}
                          title={t("group.paymentRequestHint")}
                        >
                          <Send className="w-3 h-3" />
                          {createOrderMutation.isPending ? t("group.creating") : t("group.paymentRequest")}
                        </button>
                      )}
                      <button
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-slate-300 hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity flex-shrink-0"
                        onClick={(e) => { e.stopPropagation(); onRemoveParticipant(p.id); }}
                        title={t("group.removeParticipant")}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {isWorkshop && group.price != null && activeParticipants.length > 0 && (
              <p className="text-xs text-petra-muted mt-3 pt-2 border-t border-dashed border-slate-200">
                {t.rich("group.collected", { collected: formatCurrency(collectedAmount), expected: formatCurrency(expectedAmount), ok: (c) => <span className="font-semibold text-emerald-600">{c}</span>, total: (c) => <span className="font-semibold text-petra-text">{c}</span> })}
              </p>
            )}
          </div>

          {/* Waitlist (workshops) */}
          {isWorkshop && waitlistParticipants.length > 0 && (
            <div className="p-4 border-b border-petra-border">
              <h4 className="text-xs font-semibold text-petra-muted mb-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {t("group.waitlist", { count: waitlistParticipants.length })}
              </h4>
              <div className="space-y-2">
                {waitlistParticipants.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-amber-50/60 border border-amber-100 group/item">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700 flex-shrink-0">
                      {p.dog.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-petra-text truncate">
                        {p.dog.name}
                        {p.dog.breed && <span className="text-petra-muted font-normal"> ({p.dog.breed})</span>}
                      </p>
                      <p className="text-[10px] text-petra-muted truncate">{p.customer?.name ?? ""}</p>
                    </div>
                    <button
                      className="btn-secondary text-[10px] py-1 px-2 whitespace-nowrap flex-shrink-0 disabled:opacity-50"
                      disabled={isFull || promoteMutation.isPending}
                      title={isFull ? t("group.promoteFull") : t("group.promoteHint")}
                      onClick={(e) => { e.stopPropagation(); promoteMutation.mutate(p.id); }}
                    >
                      {promoteMutation.isPending ? t("group.promoting") : t("group.promote")}
                    </button>
                    <button
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-slate-300 hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity flex-shrink-0"
                      onClick={(e) => { e.stopPropagation(); onRemoveParticipant(p.id); }}
                      title={t("group.removeFromWaitlist")}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Sessions */}
          <div className="p-4">
            <h4 className="text-xs font-semibold text-petra-muted mb-3 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {t("checklist.header", { used: group._count.sessions })}
            </h4>
            {group.sessions.length === 0 ? (
              <p className="text-xs text-petra-muted">{t("group.noSessions")}</p>
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
                        <span className="text-xs text-petra-text">{t("checklist.sessionN", { num: session.sessionNumber || "" })}</span>
                        <span className="text-[10px] text-petra-muted">{formatDate(session.sessionDatetime)}</span>
                        <span className="text-[10px] badge-neutral">{t("group.presentCount", { present: presentCount, total: session.attendance.length || mainParticipants.length })}</span>
                        <div className="ms-auto flex items-center gap-1.5">
                          <button
                            className="text-[10px] text-brand-600 hover:text-brand-700 font-medium disabled:opacity-50"
                            disabled={seedAttendanceMutation.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isAttendanceOpen) { setExpandedAttendanceSession(null); return; }
                              if (session.attendance.length === 0) {
                                // Seed attendance rows first, then the panel opens (onSuccess)
                                seedAttendanceMutation.mutate({ sessionId: session.id });
                                return;
                              }
                              setExpandedAttendanceSession(session.id);
                            }}
                          >
                            {isAttendanceOpen ? tc("actions.close") : seedAttendanceMutation.isPending ? tc("loading") : t("group.markAttendance")}
                          </button>
                          <button
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-brand-50 text-slate-400 hover:text-brand-600"
                            title={t("group.reschedule")}
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
                            title={t("checklist.deleteSession")}
                            disabled={deleteSessionMutation.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(t("group.confirmDeleteSession", { num: session.sessionNumber || "", date: formatDate(session.sessionDatetime) }))) {
                                deleteSessionMutation.mutate(session.id);
                              }
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {editingSession?.id === session.id && (
                        <div className="px-3 pb-2 pt-1 border-t border-slate-200 space-y-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <label className="label text-[10px]">{t("date")}</label>
                              <input
                                type="date" lang={cfg.lang}
                                className="input text-xs py-1.5"
                                value={editingSession.date}
                                onChange={(e) => setEditingSession({ ...editingSession, date: e.target.value })}
                              />
                            </div>
                            <div className="flex-1">
                              <label className="label text-[10px]">{t("time")}</label>
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
                              {updateSessionDatetimeMutation.isPending ? tc("progress.saving") : tc("actions.save")}
                            </button>
                            <button className="btn-secondary text-xs py-1.5" onClick={() => setEditingSession(null)}>
                              {tc("actions.cancel")}
                            </button>
                          </div>
                          {onConvertParticipant && group.participants.length > 0 && (
                            <div className="flex items-end gap-2 border-t border-dashed border-slate-200 pt-2">
                              <div className="flex-1">
                                <label className="label text-[10px]">{t("group.convertDog")}</label>
                                <select
                                  className="input text-xs py-1.5"
                                  value={convertParticipantId}
                                  onChange={(e) => setConvertParticipantId(e.target.value)}
                                >
                                  <option value="">{t("group.selectDog")}</option>
                                  {group.participants.map((p) => (
                                    <option key={p.id} value={p.id}>{p.dog.name}{p.customer?.name ? ` (${p.customer.name})` : ""}</option>
                                  ))}
                                </select>
                              </div>
                              <button
                                className="btn-secondary text-xs py-1.5"
                                disabled={!convertParticipantId}
                                onClick={() => {
                                  const p = group.participants.find((x) => x.id === convertParticipantId);
                                  if (p) { onConvertParticipant(p.id, p.dog.name); setConvertParticipantId(""); }
                                }}
                              >
                                <Repeat className="w-3 h-3" />
                                {t("convertToPrivate.confirm")}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {isAttendanceOpen && (
                        <div className="px-3 pb-3 border-t border-slate-200 pt-2 space-y-1.5">
                          {session.attendance.length === 0 ? (
                            <p className="text-[10px] text-petra-muted">{t("group.noActiveForAttendance")}</p>
                          ) : (
                            <button
                              className="btn-secondary text-[10px] py-1 px-2"
                              disabled={seedAttendanceMutation.isPending}
                              onClick={(e) => { e.stopPropagation(); seedAttendanceMutation.mutate({ sessionId: session.id, markAll: "PRESENT" }); }}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {seedAttendanceMutation.isPending ? t("group.marking") : t("group.markAllPresent")}
                            </button>
                          )}
                          {session.attendance.map((att) => {
                            const participant = group.participants.find((p) => p.id === att.participantId);
                            const dogName = att.participant?.dog.name ?? participant?.dog.name ?? t("group.dogFallback");
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
                                  title={isPresent ? t("group.markAbsent") : t("group.markPresent")}
                                >
                                  {isPresent ? "✓" : "✗"}
                                </button>
                                <span className="text-xs text-petra-text font-medium">{dogName}</span>
                                {customerName && <span className="text-[10px] text-petra-muted">{customerName}</span>}
                                <span className={cn(
                                  "text-[10px] ms-auto",
                                  isPresent ? "text-emerald-600" : "text-red-500"
                                )}>
                                  {isPresent ? t("group.present") : t("group.absent")}
                                </span>
                              </div>
                            );
                          })}
                          {/* Session notes */}
                          <div className="pt-2 border-t border-slate-100 space-y-1.5">
                            <p className="text-[10px] font-semibold text-petra-muted">{t("group.sessionSummary")}</p>
                            <textarea
                              className="input text-xs py-1.5 resize-none w-full"
                              rows={2}
                              placeholder={t("group.summaryPlaceholder")}
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
                              {t("group.saveSummary")}
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
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const [customerId, setCustomerId] = useState("");
  const [dogId, setDogId] = useState("");
  const [programType, setProgramType] = useState("BASIC_OBEDIENCE");
  const [customTypeName, setCustomTypeName] = useState("");
  const [totalSessions, setTotalSessions] = useState("10");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [pickedCustomer, setPickedCustomer] = useState<PickerCustomer | null>(null);

  const selectedCustomer: Customer | undefined =
    pickedCustomer && pickedCustomer.id === customerId ? pickedCustomer : undefined;
  const selectedDog = selectedCustomer?.pets.find((p) => p.id === dogId);
  const effectiveProgramType = programType === "CUSTOM" ? (customTypeName.trim() || t("programTypes.CUSTOM")) : programTypeLabel(t, programType);
  const autoName = selectedDog
    ? t("programForm.autoName", { type: effectiveProgramType, dog: selectedDog.name })
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
            {t("programForm.manualTitle")}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-petra-muted bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-4">
          {t("programForm.manualHint")}
        </p>

        <div className="space-y-4">
          <div>
            <label className="label">{t("programForm.client")}</label>
            <CustomerPicker
              value={customerId || null}
              selectedCustomer={pickedCustomer}
              onSelect={(c, matchedPetId) => {
                setPickedCustomer(c);
                setCustomerId(c.id);
                setDogId(matchedPetId ?? "");
              }}
              onClear={() => { setPickedCustomer(null); setCustomerId(""); setDogId(""); }}
            />
          </div>

          {customerId && selectedCustomer && (
            <div>
              <label className="label">{t("programForm.dog")}</label>
              {selectedCustomer.pets.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                  {t("programForm.noDogs")}
                </p>
              ) : (
                <select className="input" value={dogId} onChange={(e) => setDogId(e.target.value)}>
                  <option value="">{t("programForm.selectDog")}</option>
                  {selectedCustomer.pets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="label">{t("programForm.trainingType")}</label>
            <select className="input" value={programType} onChange={(e) => { setProgramType(e.target.value); setCustomTypeName(""); }}>
              {PROGRAM_TYPE_KEYS.filter((k) => !k.startsWith("SD_")).map((value) => (
                <option key={value} value={value}>{programTypeLabel(t, value)}</option>
              ))}
            </select>
            {programType === "CUSTOM" && (
              <input
                className="input mt-2"
                placeholder={t("programForm.customTypePlaceholder")}
                value={customTypeName}
                onChange={(e) => setCustomTypeName(e.target.value)}
                autoFocus
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("schedule.occurrences")}</label>
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
              <label className="label">{t("individual.startDate")}</label>
              <input
                type="date" lang={cfg.lang}
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("programForm.endDate")} <span className="text-petra-muted font-normal">{t("programForm.optional")}</span></label>
              <input
                type="date" lang={cfg.lang}
                className="input"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div />
          </div>

          <div>
            <label className="label">{t("programForm.notes")}</label>
            <textarea
              className="input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("programForm.manualNotesPlaceholder")}
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
            {isPending ? tc("progress.saving") : t("programForm.addProgram")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
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
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
  const { formatCurrency, cur } = useFmt();
  const [step, setStep] = useState(packages.length > 0 ? 1 : 2);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [dogId, setDogId] = useState("");
  const [programType, setProgramType] = useState("BASIC_OBEDIENCE");
  const [customTypeName, setCustomTypeName] = useState("");
  const [totalSessions, setTotalSessions] = useState("10");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [pickedCustomer, setPickedCustomer] = useState<PickerCustomer | null>(null);

  const selectedCustomer: Customer | undefined =
    pickedCustomer && pickedCustomer.id === customerId ? pickedCustomer : undefined;
  const selectedDog = selectedCustomer?.pets.find((p) => p.id === dogId);
  const selectedPkg = packages.find((p) => p.id === selectedPackageId);
  const effectiveProgramType = programType === "CUSTOM" ? (customTypeName.trim() || t("programTypes.CUSTOM")) : programTypeLabel(t, programType);
  const autoName = selectedDog
    ? selectedPkg
      ? `${selectedPkg.name} - ${selectedDog.name}`
      : t("programForm.autoName", { type: effectiveProgramType, dog: selectedDog.name })
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
            {t("sellPackage.title")}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 1 && packages.length > 0 && (
          <div>
            <p className="text-sm text-petra-muted mb-4">{t("sellPackage.choose")}</p>
            <div className="space-y-2 mb-4">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  className={cn(
                    "w-full text-start p-3 rounded-xl border-2 transition-all",
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
                  <p className="text-xs text-petra-muted mt-0.5">{t("boardingTab.homeSessions", { count: pkg.sessions })}</p>
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
                {t("sellPackage.continue")}
              </button>
              <button className="btn-secondary" onClick={() => handleSelectPackage(null)}>
                {t("sellPackage.noPackage")}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <>
            {selectedPkg && (
              <div className="p-3 mb-4 rounded-xl bg-brand-50 border border-brand-100 text-sm text-brand-700 flex items-center justify-between">
                <span>{t("sellPackage.selected", { name: selectedPkg.name, count: selectedPkg.sessions })}</span>
                {packages.length > 0 && (
                  <button className="text-xs text-brand-500 hover:underline" onClick={() => setStep(1)}>{t("sellPackage.change")}</button>
                )}
              </div>
            )}

            <div className="space-y-4">
              {/* Customer */}
              <div>
                <label className="label">{t("programForm.client")}</label>
                <CustomerPicker
                  value={customerId || null}
                  selectedCustomer={pickedCustomer}
                  requirePets
                  onSelect={(c, matchedPetId) => {
                    setPickedCustomer(c);
                    setCustomerId(c.id);
                    setDogId(matchedPetId ?? "");
                  }}
                  onClear={() => { setPickedCustomer(null); setCustomerId(""); setDogId(""); }}
                />
              </div>

              {/* Dog */}
              {customerId && selectedCustomer && (
                <div>
                  <label className="label">{t("programForm.dog")}</label>
                  <select className="input" value={dogId} onChange={(e) => setDogId(e.target.value)}>
                    <option value="">{t("programForm.selectDog")}</option>
                    {selectedCustomer.pets.map((pet) => (
                      <option key={pet.id} value={pet.id}>{pet.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Program Type */}
              {!selectedPkg && (
                <div>
                  <label className="label">{t("programForm.programType")}</label>
                  <select className="input" value={programType} onChange={(e) => { setProgramType(e.target.value); setCustomTypeName(""); }}>
                    {PROGRAM_TYPE_KEYS.filter((k) => !k.startsWith("SD_")).map((k) => (
                      <option key={k} value={k}>{programTypeLabel(t, k)}</option>
                    ))}
                  </select>
                  {programType === "CUSTOM" && (
                    <input
                      className="input mt-2"
                      placeholder={t("programForm.customTypePlaceholder")}
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
                  <label className="label">{t("programForm.programName")}</label>
                  <input className="input bg-slate-50" value={autoName} readOnly />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t("programForm.sessionsRequired")}</label>
                  <input
                    type="number"
                    className="input"
                    value={totalSessions}
                    onChange={(e) => setTotalSessions(e.target.value)}
                    min="1"
                  />
                </div>
                <div>
                  <label className="label">{t("programForm.price", { cur })}</label>
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
                <label className="label">{t("programForm.notes")}</label>
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
                {isPending ? tc("progress.saving") : t("sellPackage.create")}
              </button>
              <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
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
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const { cur } = useFmt();
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    groupType: initial?.groupType ?? (isWorkshop ? "WORKSHOP" : "CUSTOM"),
    location: initial?.location ?? "",
    defaultDayOfWeek: initial?.defaultDayOfWeek != null ? String(initial.defaultDayOfWeek) : "",
    defaultTime: initial?.defaultTime ?? "",
    maxParticipants: initial?.maxParticipants != null ? String(initial.maxParticipants) : "",
    price: initial?.price != null ? String(initial.price) : "",
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
      ...(isWorkshop ? { price: form.price ? parseFloat(form.price) : null } : {}),
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
              ? (isWorkshop ? t("groupForm.editWorkshop") : t("groupForm.editGroup"))
              : (isWorkshop ? t("workshopsTab.new") : t("groupForm.newGroup"))}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">{isWorkshop ? t("groupForm.nameWorkshop") : t("groupForm.nameGroup")}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={isWorkshop ? t("groupForm.namePlaceholderWorkshop") : t("groupForm.namePlaceholderGroup")}
            />
          </div>

          {!isWorkshop && (
            <div>
              <label className="label">{t("groupForm.type")}</label>
              <select
                className="input"
                value={form.groupType}
                onChange={(e) => setForm({ ...form, groupType: e.target.value })}
              >
                {GROUP_TYPE_KEYS
                  .filter((k) => k !== "WORKSHOP")
                  .map((k) => (
                    <option key={k} value={k}>{t(`groupTypes.${k}`)}</option>
                  ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("groupForm.fixedDay")}</label>
              <select
                className="input"
                value={form.defaultDayOfWeek}
                onChange={(e) => setForm({ ...form, defaultDayOfWeek: e.target.value })}
              >
                <option value="">{t("groupForm.notSet")}</option>
                {DAY_KEYS.map((dk, i) => (
                  <option key={i} value={i}>{t(`days.${dk}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t("time")}</label>
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
              <label className="label">{t("individual.location")}</label>
              <input
                className="input"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder={t("groupForm.locationPlaceholder")}
              />
            </div>
            <div>
              <label className="label">{isWorkshop ? t("groupForm.capacity") : t("groupForm.maxParticipants")} {isWorkshop && <span className="text-petra-muted font-normal">{t("programForm.optional")}</span>}</label>
              <input
                type="number"
                min={1}
                className="input"
                value={form.maxParticipants}
                onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })}
                placeholder="6"
              />
            </div>
          </div>

          {isWorkshop && (
            <div>
              <label className="label">{t("programForm.price", { cur })} <span className="text-petra-muted font-normal">{t("programForm.optional")}</span></label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="input"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="450"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("individual.startDate")} <span className="text-petra-muted font-normal">{t("programForm.optional")}</span></label>
              <input
                type="date" lang={cfg.lang}
                className="input"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t("programForm.endDate")} <span className="text-petra-muted font-normal">{t("programForm.optional")}</span></label>
              <input
                type="date" lang={cfg.lang}
                className="input"
                value={form.endDate}
                min={form.startDate || undefined}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">{t("programForm.notes")}</label>
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
            {isPending ? tc("progress.saving") : initial ? t("sessionLog.saveChanges") : isWorkshop ? t("groupForm.createWorkshop") : t("groupForm.createGroup")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
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
  isWorkshop = false,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  groupId: string;
  groupName: string;
  isWorkshop?: boolean;
  onClose: () => void;
  onSubmit: (customerId: string, dogId: string, waitlist: boolean) => void;
  isPending: boolean;
  error: string | null;
}) {
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
  const [customerId, setCustomerId] = useState("");
  const [dogId, setDogId] = useState("");
  const [waitlist, setWaitlist] = useState(false);
  const [pickedCustomer, setPickedCustomer] = useState<PickerCustomer | null>(null);

  const selectedCustomer: Customer | undefined =
    pickedCustomer && pickedCustomer.id === customerId ? pickedCustomer : undefined;


  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text">{t("assign.title", { group: groupName })}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Customer — search-first picker */}
          <div>
            <label className="label">{t("programForm.client")}</label>
            <CustomerPicker
              value={customerId || null}
              selectedCustomer={pickedCustomer}
              autoFocus
              onSelect={(c, matchedPetId) => {
                setPickedCustomer(c);
                setCustomerId(c.id);
                setDogId(matchedPetId ?? (c.pets.length === 1 ? c.pets[0].id : ""));
              }}
              onClear={() => { setPickedCustomer(null); setCustomerId(""); setDogId(""); }}
            />
          </div>

          {/* Dog — shown after customer selected */}
          {customerId && selectedCustomer && (
            <div>
              <label className="label">{t("programForm.dog")}</label>
              {selectedCustomer.pets.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                  {t("programForm.noDogs")}
                </p>
              ) : (
                <select className="input" value={dogId} onChange={(e) => setDogId(e.target.value)}>
                  <option value="">{t("programForm.selectDog")}</option>
                  {selectedCustomer.pets.map((pet) => (
                    <option key={pet.id} value={pet.id}>{pet.name}{pet.species ? ` (${pet.species})` : ""}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Workshops: opt into the waitlist explicitly (full workshops waitlist automatically) */}
          {isWorkshop && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded accent-orange-500 w-4 h-4"
                checked={waitlist}
                onChange={(e) => setWaitlist(e.target.checked)}
              />
              <span className="text-sm text-petra-text">{t("assign.addToWaitlist")}</span>
              <span className="text-[11px] text-petra-muted">{t("assign.evenIfRoom")}</span>
            </label>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!customerId || !dogId || isPending}
            onClick={() => onSubmit(customerId, dogId, waitlist)}
          >
            <Plus className="w-4 h-4" />
            {isPending ? tc("progress.saving") : waitlist ? t("assign.submitWaitlist") : t("assign.submit")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
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
  const t = useTranslations("training.trainingPage");
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
        <p className="text-sm text-petra-muted">{t("sdTab.count", { count: filtered.length })}</p>
        <button className="btn-primary text-sm" onClick={onNewProgram}>
          <Plus className="w-4 h-4" />
          {t("sdTab.new")}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Shield className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">{t("sdLog.emptyTitle")}</h3>
          <p className="text-sm text-petra-muted">
            <a href="/service-dogs" className="text-brand-600 hover:underline">{t("sdLog.goToServiceDogs")}</a>
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
                    {t(`programStatus.${PROGRAM_STATUS_MAP[p.status] ? p.status : "ACTIVE"}`)}
                  </span>
                </div>
                {p.totalSessions && (
                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] text-petra-muted mb-1">
                      <span>{t("overview.sessions")}</span>
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
                  {t("sdTab.viewProfile")}
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

/** Package type ids; labels live in messages (training.trainingPage.packageTypes.*). */

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
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
  const { formatCurrency } = useFmt();
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-petra-muted">{t("packagesTab.count", { count: packages.length })}</p>
        <button className="btn-primary text-sm" onClick={onCreatePackage}>
          <Plus className="w-4 h-4" />
          {t("packagesTab.new")}
        </button>
      </div>

      {packages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Package className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">{t("packagesTab.emptyTitle")}</h3>
          <p className="text-sm text-petra-muted">{t("packagesTab.emptyHint")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {packages.map((pkg) => (
            <div key={pkg.id} className={cn("card p-4", !pkg.isActive && "opacity-60")}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-petra-text mb-1">{pkg.name}</h3>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", PACKAGE_TYPE_COLORS[pkg.type] || "bg-slate-100 text-slate-600")}>
                    {t.has(`packageTypes.${pkg.type}`) ? t(`packageTypes.${pkg.type}`) : pkg.type}
                  </span>
                </div>
                <div className="flex gap-1 ms-2 flex-shrink-0">
                  <button
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
                    onClick={() => onEditPackage(pkg)}
                    title={tc("actions.edit")}
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  {pkg._count.programs === 0 ? (
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-petra-muted hover:text-red-500"
                      onClick={() => onDeletePackage(pkg.id)}
                      disabled={isDeleting}
                      title={tc("actions.delete")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-bold text-petra-text">{formatCurrency(pkg.price)}</span>
                <span className="text-xs text-petra-muted">{t("boardingTab.homeSessions", { count: pkg.sessions })}</span>
              </div>

              {pkg.durationDays && (
                <p className="text-xs text-petra-muted mb-2">{t("packagesTab.boardingDays", { count: pkg.durationDays })}</p>
              )}

              {pkg.description && (
                <p className="text-xs text-petra-muted mb-3 line-clamp-2">{pkg.description}</p>
              )}

              <div className="flex items-center justify-between border-t pt-2 mt-2">
                <span className="text-[10px] text-petra-muted">{t("packagesTab.activePrograms", { count: pkg._count.programs })}</span>
                <button
                  onClick={() => onToggleActive(pkg)}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded font-medium transition-colors",
                    pkg.isActive
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  )}
                >
                  {pkg.isActive ? t("programStatus.ACTIVE") : t("group.inactive")}
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
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
  const { cur } = useFmt();
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
          <h2 className="text-lg font-bold text-petra-text">{t("packageForm.newTitle")}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">{t("packageForm.name")}</label>
            <input className="input" placeholder={t("packageForm.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("groupForm.type")}</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="HOME">{t("packageTypes.HOME")}</option>
              <option value="BOARDING">{t("packageTypes.BOARDING")}</option>
              <option value="GROUP">{t("packageTypes.GROUP")}</option>
              <option value="WORKSHOP">{t("packageTypes.WORKSHOP")}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("programForm.sessionsRequired")}</label>
              <input type="number" min={1} className="input" placeholder="5" value={sessions} onChange={(e) => setSessions(e.target.value)} />
            </div>
            <div>
              <label className="label">{t("packageForm.priceRequired", { cur })}</label>
              <input type="number" min={0} className="input" placeholder="1500" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          {type === "BOARDING" && (
            <div>
              <label className="label">{t("packageForm.boardingDays")}</label>
              <input type="number" min={1} className="input" placeholder="14" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
            </div>
          )}
          <div>
            <label className="label">{t("packageForm.descriptionOptional")}</label>
            <textarea className="input" rows={2} placeholder={t("packageForm.descriptionPlaceholder")} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={isPending || !name.trim() || !sessions || !price} onClick={handleSubmit}>
            {isPending ? t("group.creating") : t("sellPackage.create")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
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
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
  const { cur } = useFmt();
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
          <h2 className="text-lg font-bold text-petra-text">{t("packageForm.editTitle")}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">{t("packageForm.name")}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("groupForm.type")}</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="HOME">{t("packageTypes.HOME")}</option>
              <option value="BOARDING">{t("packageTypes.BOARDING")}</option>
              <option value="GROUP">{t("packageTypes.GROUP")}</option>
              <option value="WORKSHOP">{t("packageTypes.WORKSHOP")}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("programForm.sessionsRequired")}</label>
              <input type="number" min={1} className="input" value={sessions} onChange={(e) => setSessions(e.target.value)} />
            </div>
            <div>
              <label className="label">{t("packageForm.priceRequired", { cur })}</label>
              <input type="number" min={0} className="input" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          {type === "BOARDING" && (
            <div>
              <label className="label">{t("packageForm.boardingDays")}</label>
              <input type="number" min={1} className="input" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
            </div>
          )}
          <div>
            <label className="label">{t("packageForm.description")}</label>
            <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={isPending || !name.trim() || !sessions || !price} onClick={handleSubmit}>
            {isPending ? tc("progress.saving") : t("sessionLog.saveChanges")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
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
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
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
      name: t("boardingForm.programName", { dog: stay.pet.name }),
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
          <h2 className="text-lg font-bold text-petra-text">{t("boardingForm.title", { dog: stay.pet.name })}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-700 mb-4">
          {stay.pet.name} • {stay.customer.name} • {stay.room?.name ?? t("boardingTab.noRoom")}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("boardingForm.start")}</label>
              <input type="date" lang={cfg.lang} className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="label">{t("boardingForm.end")}</label>
              <input type="date" lang={cfg.lang} className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          {(!startDate || !endDate) && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {t("boardingForm.datesRequired")}
            </p>
          )}
          <div>
            <label className="label">{t("boardingForm.baseline")}</label>
            <textarea
              className="input"
              rows={3}
              placeholder={t("boardingForm.baselinePlaceholder")}
              value={behaviorBaseline}
              onChange={(e) => setBehaviorBaseline(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("boardingTab.expectations")}</label>
            <textarea
              className="input"
              rows={2}
              placeholder={t("boardingForm.expectationsPlaceholder")}
              value={customerExpectations}
              onChange={(e) => setCustomerExpectations(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("boardingForm.workPlan")} <span className="text-[10px] text-amber-600 font-normal">{t("boardingForm.visibleToStaff")}</span></label>
            <textarea
              className="input"
              rows={4}
              placeholder={t("boardingForm.workPlanPlaceholder")}
              value={workPlan}
              onChange={(e) => setWorkPlan(e.target.value)}
            />
          </div>

          {/* Home follow-up sessions */}
          <div className="p-3 rounded-xl border border-brand-100 bg-brand-50/50 space-y-2">
            <label className="text-xs font-semibold text-brand-700 flex items-center gap-1.5">
              <Dog className="w-3.5 h-3.5" />
              {t("boardingForm.handoff")}
            </label>
            <p className="text-[11px] text-brand-600">
              {t("boardingForm.handoffHint")}
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
              <span className="text-xs text-petra-muted">{t("boardingForm.followupCount")}</span>
            </div>
            {homeFollowupSessions > 0 && (
              <p className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                {t("boardingForm.followupNote", { count: homeFollowupSessions })}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={isPending || !startDate || !endDate} onClick={handleSubmit}>
            {isPending ? t("group.creating") : t("boardingTab.createProgram")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
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
  processKind,
  onSelectProcessType,
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
  processKind?: "INDIVIDUAL" | "PACKAGE";
  onSelectProcessType?: (target: "INDIVIDUAL" | "PACKAGE" | "GROUP") => void;
}) {
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const isKnownType = (pt: string) => (PROGRAM_TYPE_KEYS as readonly string[]).includes(pt);
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
            {t("settingsForm.title", { dog: program.dog.name })}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {processKind && onSelectProcessType && (
            <div className="p-3 rounded-xl border border-brand-100 bg-brand-50/50">
              <label className="label">{t("sessionLog.processType")}</label>
              <select
                className="input"
                value={processKind}
                onChange={(e) => {
                  const target = e.target.value as "INDIVIDUAL" | "PACKAGE" | "GROUP";
                  if (target !== processKind) onSelectProcessType(target);
                }}
              >
                <option value="INDIVIDUAL">{t("sessionLog.processIndividual")}</option>
                <option value="PACKAGE">{t("sessionLog.processPackage")}</option>
                <option value="GROUP">{t("sessionLog.processGroup")}</option>
              </select>
              <p className="text-[11px] text-petra-muted mt-1">{t("sessionLog.processHint")}</p>
            </div>
          )}
          <div>
            <label className="label">{t("programForm.trainingType")}</label>
            <select
              className="input"
              value={form.programType}
              onChange={(e) => { setForm({ ...form, programType: e.target.value }); setCustomTypeName(""); }}
            >
              <option value="BASIC_OBEDIENCE">{t("programTypes.BASIC_OBEDIENCE")}</option>
              <option value="REACTIVITY">{t("programTypes.REACTIVITY")}</option>
              <option value="PUPPY">{t("programTypes.PUPPY")}</option>
              <option value="BEHAVIOR">{t("programTypes.BEHAVIOR")}</option>
              <option value="ADVANCED">{t("programTypes.ADVANCED")}</option>
              <option value="CUSTOM">{t("programTypes.CUSTOM")}</option>
            </select>
            {form.programType === "CUSTOM" && (
              <input
                className="input mt-2"
                placeholder={t("programForm.customTypePlaceholder")}
                value={customTypeName}
                onChange={(e) => setCustomTypeName(e.target.value)}
                autoFocus
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("settingsForm.startRequired")}</label>
              <input
                type="date" lang={cfg.lang}
                className="input"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t("individual.estimatedEnd")}</label>
              <input
                type="date" lang={cfg.lang}
                className="input"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">{t("individual.frequency")}</label>
            <select
              className="input"
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
            >
              <option value="">{t("settingsForm.notDefined")}</option>
              <option value="WEEKLY">{t("frequency.WEEKLY")}</option>
              <option value="BIWEEKLY">{t("frequency.BIWEEKLY")}</option>
              <option value="CUSTOM">{t("frequency.CUSTOM")}</option>
            </select>
          </div>

          <div>
            <label className="label">
              {t("settingsForm.sessionsInPackage")}
              <span className="text-xs font-normal text-petra-muted ms-1">{t("settingsForm.forChecklist")}</span>
            </label>
            <input
              type="number"
              min={1}
              max={100}
              className="input"
              placeholder={t("settingsForm.sessionsPlaceholder")}
              value={form.totalSessions}
              onChange={(e) => setForm({ ...form, totalSessions: e.target.value })}
            />
            {form.totalSessions && parseInt(form.totalSessions) > 0 && (
              <p className="text-[11px] text-petra-muted mt-1">
                {t("settingsForm.finishHint", { total: form.totalSessions })}
              </p>
            )}
          </div>

          <div>
            <label className="label">{t("settingsForm.address")}</label>
            <input
              type="text"
              className="input"
              placeholder={t("settingsForm.addressPlaceholder")}
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
            {isPending ? tc("progress.saving") : t("settingsForm.save")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
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
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
  const [reason, setReason] = useState("");

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            {t("dropout.title", { dog: dogName })}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-petra-muted mb-4">
          {t("dropout.body")}
        </p>
        <div>
          <label className="label">{t("dropout.reason")}</label>
          <textarea
            className="input"
            rows={3}
            placeholder={t("dropout.reasonPlaceholder")}
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
            {isPending ? t("processing") : t("dropout.confirm")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
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
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
  const [orderAction, setOrderAction] = useState<"keep" | "cancel" | "delete">("keep");
  const hasOrder = !!program.orderId;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            {t("deleteProgram.title", { dog: program.dog.name })}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-petra-muted mb-4">
          {t("deleteProgram.body")}
        </p>
        {hasOrder && (
          <div className="mb-4">
            <label className="label">{t("deleteProgram.orderQuestion")}</label>
            <div className="space-y-2 mt-1">
              {([
                { v: "keep", label: t("deleteProgram.orderKeep") },
                { v: "cancel", label: t("deleteProgram.orderCancel") },
                { v: "delete", label: t("deleteProgram.orderDelete") },
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
              <p className="text-xs text-amber-600 mt-2">{t("deleteProgram.paidNote")}</p>
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
            {isPending ? tc("progress.deleting") : t("deleteGroup.confirm")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
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
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
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
            {isPending ? t("processing") : confirmLabel}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
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
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            {t("finish.title", { dog: dogName })}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-petra-muted mb-5">
          {t("finish.body", { dog: dogName })}
        </p>
        <div className="flex gap-3">
          <button
            className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            disabled={isPending}
            onClick={onSubmit}
          >
            <CheckCircle2 className="w-4 h-4" />
            {isPending ? t("processing") : t("finish.confirm")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ARCHIVE TAB
// ═══════════════════════════════════════════════════════

function exportArchiveXLSX(programs: TrainingProgram[], t: TT, formatDate: (d: string) => string) {
  import("xlsx").then((XLSX) => {
    const headers = [t("archive.xlsx.dogName"), t("archive.xlsx.breed"), t("archive.xlsx.clientName"), t("archive.xlsx.phone"), t("archive.xlsx.programType"), t("archive.xlsx.sessionsDone"), t("archive.xlsx.startDate"), t("archive.xlsx.endDate"), t("archive.xlsx.status"), t("archive.xlsx.notes")];
    const rows = programs.map((p) => {
      const usedSessions = p.sessions.filter((s) => s.status === "COMPLETED").length;
      const statusLabel = p.status === "COMPLETED" ? t("overview.completed") : t("archive.droppedOut");
      return [
        p.dog.name,
        (p.dog as { breed?: string | null }).breed || "",
        p.customer?.name ?? "",
        p.customer?.phone ?? "",
        programTypeLabel(t, p.programType),
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
    XLSX.utils.book_append_sheet(wb, ws, t("archive.xlsx.sheetName"));
    XLSX.writeFile(wb, `training_archive_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });
}

function ArchiveTab({ programs, isLoading, onRestore }: { programs: TrainingProgram[]; isLoading: boolean; onRestore: (id: string) => void }) {
  const t = useTranslations("training.trainingPage");
  const { cfg } = useBusinessLocale();
  const { formatDate } = useFmt();
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
    return <PetraLoader />;
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
              {s === "all" ? t("archive.filterAll") : s === "COMPLETED" ? t("archive.filterCompleted") : t("archive.filterDropped")}
            </button>
          ))}
        </div>
        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-petra-muted whitespace-nowrap">{t("archive.from")}</span>
          <input type="date" lang={cfg.lang} className="input text-xs h-8 px-2 w-32" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span className="text-xs text-petra-muted whitespace-nowrap">{t("archive.to")}</span>
          <input type="date" lang={cfg.lang} className="input text-xs h-8 px-2 w-32" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-[10px] text-petra-muted hover:text-red-500 px-1">✕</button>
          )}
        </div>
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-petra-muted" />
          <input
            className="input ps-9 text-sm w-full"
            placeholder={t("archive.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {programs.length > 0 && (
          <button
            className="btn-secondary text-xs flex items-center gap-1.5"
            onClick={() => exportArchiveXLSX(filtered.length > 0 ? filtered : programs, t, formatDate)}
          >
            <Download className="w-3.5 h-3.5" />
            {t("archive.export", { count: filtered.length })}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Archive className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">
            {programs.length === 0 ? t("archive.empty") : t("archive.noResults")}
          </h3>
          <p className="text-sm text-petra-muted">
            {programs.length === 0
              ? t("archive.emptyHint")
              : t("archive.noResultsHint")}
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
                      {isCompleted ? t("archive.completed") : t("archive.droppedOut")}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {programTypeLabel(t, p.programType)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-petra-muted flex-wrap">
                    <span>{p.customer?.name ?? ""}</span>
                    <span>{p.customer?.phone ?? ""}</span>
                    <span>{t("boardingTab.homeSessions", { count: usedSessions })}</span>
                    {p.startDate && <span>{t("startAt", { date: formatDate(p.startDate) })}</span>}
                    {p.endDate && <span>{t("endAt", { date: formatDate(p.endDate) })}</span>}
                  </div>
                  {!isCompleted && p.notes && (
                    <p className="mt-1.5 text-xs text-red-700 bg-red-50 px-2 py-1 rounded-lg">
                      <span className="font-semibold">{t("archive.dropoutReason")} </span>{p.notes}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onRestore(p.id)}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-1.5 rounded-lg transition-colors"
                  title={t("archive.restoreTitle")}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {t("archive.restore")}
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
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
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
      toast.success(t("sdDog.added"));
      onSuccess();
      onClose();
    },
    onError: () => toast.error(t("sdDog.addError")),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
            <Dog className="w-5 h-5 text-brand-500" />
            {t("sdDog.add")}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3 rounded-xl bg-brand-50 border border-brand-100 text-xs text-brand-700 mb-4">
          {t("sdDog.hint")}
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">{t("sdDog.nameRequired")}</label>
            <input type="text" className="input" placeholder={t("archive.xlsx.dogName")} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("archive.xlsx.breed")}</label>
              <input type="text" className="input" placeholder={t("sdDog.breedPlaceholder")} value={breed} onChange={(e) => setBreed(e.target.value)} />
            </div>
            <div>
              <label className="label">{t("sdDog.sex")}</label>
              <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">{t("sdDog.unknown")}</option>
                <option value="male">{t("sdDog.male")}</option>
                <option value="female">{t("sdDog.female")}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("sdDog.birthDate")}</label>
              <input type="date" lang={cfg.lang} className="input" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
            <div>
              <label className="label">{t("sdDog.weight")}</label>
              <input type="number" className="input" placeholder="0.0" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">{t("sdDog.microchip")}</label>
            <input type="text" className="input" placeholder={t("sdDog.microchipPlaceholder")} value={microchip} onChange={(e) => setMicrochip(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("sdDog.serviceType")}</label>
            <input type="text" className="input" placeholder={t("sdDog.serviceTypePlaceholder")} value={serviceType} onChange={(e) => setServiceType(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("sdDog.medicalNotes")}</label>
            <textarea className="input" rows={2} value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("sdDog.behaviorNotes")}</label>
            <textarea className="input" rows={2} value={behaviorNotes} onChange={(e) => setBehaviorNotes(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("sdDog.generalNotes")}</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button
            className="btn-primary flex-1"
            disabled={!name.trim() || mutation.isPending}
            onClick={() => mutation.mutate({ name, breed, gender, birthDate, weight, microchip, medicalNotes, behaviorNotes, serviceType, notes })}
          >
            {mutation.isPending ? tc("progress.saving") : t("sdDog.add")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
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
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
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
          name: t("sdProgram.name", { dog: dog.pet.name }),
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
      toast.success(t("sdProgram.created"));
      onSuccess();
    },
    onError: (err: Error) => toast.error(err.message || t("sdProgram.createError")),
  });

  const activeDogs = dogs.filter((d) => !["RETIRED", "DECERTIFIED"].includes(d.phase));

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-500" />
            {t("sdProgram.title")}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">{t("sdProgram.dog")}</label>
            {isLoading ? (
              <div className="input text-petra-muted text-sm">{tc("loading")}</div>
            ) : activeDogs.length === 0 ? (
              <p className="text-sm text-petra-muted py-2">{t.rich("sdProgram.noDogs", { link: (c) => <a href="/service-dogs" className="text-brand-600 hover:underline">{c}</a> })}</p>
            ) : (
              <select className="input" value={selectedDogId} onChange={(e) => setSelectedDogId(e.target.value)}>
                <option value="">{t("programForm.selectDog")}</option>
                {activeDogs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.pet.name}{d.pet.breed ? ` (${d.pet.breed})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="label">{t("sdPhase.title")}</label>
            <select className="input" value={programType} onChange={(e) => setProgramType(e.target.value)}>
              {SERVICE_DOG_PHASES.map((p) => (
                <option key={p.value} value={p.value}>{t(`sdPhases.${p.value}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t("individual.startDate")}</label>
            <input type="date" lang={cfg.lang} className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!selectedDogId || !startDate || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? t("group.creating") : t("sdProgram.create")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ADD RECIPIENT INLINE MODAL (from training page)
// ═══════════════════════════════════════════════════════

function AddRecipientInlineModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("training.trainingPage");
  const tc = useTranslations("common");
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
      toast.success(t("recipient.added"));
      onClose();
    },
    onError: () => toast.error(t("recipient.addError")),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-brand-500" />
            {t("recipient.title")}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">{t("recipient.fullName")}</label>
            <input type="text" className="input" placeholder={t("recipient.fullNamePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("archive.xlsx.phone")}</label>
              <input type="tel" dir="ltr" className="input text-right" placeholder="05x-xxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="label">{t("recipient.email")}</label>
              <input type="email" dir="ltr" className="input text-right" placeholder="mail@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("recipient.idNumber")}</label>
              <input type="text" className="input" placeholder={t("recipient.idPlaceholder")} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
            </div>
            <div>
              <label className="label">{t("recipient.disabilityType")}</label>
              <select className="input" value={disabilityType} onChange={(e) => setDisabilityType(e.target.value)}>
                <option value="">{t("recipient.notSelected")}</option>
                {DISABILITY_TYPES.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{t("recipient.address")}</label>
            <input type="text" className="input" placeholder={t("settingsForm.addressPlaceholderShort")} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("recipient.disabilityDetails")}</label>
            <textarea className="input" rows={2} placeholder={t("recipient.disabilityPlaceholder")} value={disabilityNotes} onChange={(e) => setDisabilityNotes(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("programForm.notes")}</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button
            className="btn-primary flex-1"
            disabled={!name.trim() || mutation.isPending}
            onClick={() => mutation.mutate({ name, phone, email, idNumber, address, disabilityType, disabilityNotes, notes })}
          >
            {mutation.isPending ? tc("progress.saving") : t("recipient.add")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

export default function TrainingPage() {
  const t = useTranslations("training.trainingPage");
  return (
    <>
      <PageTitle title={t("pageTitle")} />
      <TierGate
      feature="training"
      title={t("tierGate.title")}
      description={t("tierGate.description")}
    >
      <TrainingPageContent />
    </TierGate>
    </>
  );
}
