"use client";
import { PageTitle } from "@/components/ui/PageTitle";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import {
  Users,
  Calendar,
  PawPrint,
  Clock,
  CheckCircle2,
  AlertCircle,
  Target,
  CreditCard,
  ArrowLeft,
  Plus,
  ShoppingCart,
  Activity,
  LogIn,
  UserPlus,
  MessageCircle,
  Hotel,
  Package,
  ClipboardList,
  Flame,
  CalendarClock,
  Check,
  PhoneCall,
  X,
  Cake,
  Syringe,
  UserX,
  TrendingDown,
  TrendingUp,
  Pill,
  Copy,
  ClipboardCheck,
  RefreshCw,
  Tag,
  ChevronDown,
  ChevronUp,
  Zap,
  Dumbbell,
  Scissors,
} from "lucide-react";
import {
  isToday,
  isPast,
  differenceInMinutes,
  format,
  startOfDay,
} from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { usePlan } from "@/hooks/usePlan";
import { usePermissions } from "@/hooks/usePermissions";
import { formatCurrency, fetchJSON, cn, toWhatsAppPhone, copyToClipboard } from "@/lib/utils";
import { validateIsraeliPhone, validateEmail, sanitizeName, validateName, normalizeIsraeliPhone } from "@/lib/validation";
import dynamic from "next/dynamic";
const SetupChecklist = dynamic(
  () => import("@/components/onboarding/SetupChecklist").then((m) => ({ default: m.SetupChecklist })),
  { ssr: false }
);
const TeamWelcomeModal = dynamic(
  () => import("@/components/onboarding/TeamWelcomeModal").then((m) => ({ default: m.TeamWelcomeModal })),
  { ssr: false }
);
const OnboardingWizardModal = dynamic(
  () => import("@/components/onboarding/OnboardingWizardModal"),
  { ssr: false }
);
const CreateOrderModal = dynamic(
  () => import("@/components/orders/CreateOrderModal").then((m) => ({ default: m.CreateOrderModal })),
  { ssr: false }
);
const RevenueChart = dynamic(
  () => import("@/components/dashboard/RevenueChart"),
  {
    ssr: false,
    loading: () => <div className="card p-5 h-[280px] animate-pulse bg-slate-100 rounded-2xl" />,
  }
);

// ─── Constants ───────────────────────────────────────────────────────────────

const TASK_CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "כללי",
  BOARDING: "פנסיון",
  TRAINING: "אילוף",
  LEADS: "לידים",
  HEALTH: "בריאות",
  MEDICATION: "תרופות",
  FEEDING: "האכלה",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalCustomers: number;
  totalPets: number;
  todayAppointments: number;
  monthRevenue: number;
  todayRevenue: number;
  pendingPayments: number;
  openLeads: number;
  activeOrders: number;
  pendingPaymentsAmount: number;
  upcomingByType: {
    training: number;
    grooming: number;
    boarding: number;
  };
  revenueByMonth: { month: string; amount: number }[];
  revenueTarget: number;
  topService: { name: string; count: number } | null;
  recentTasks: {
    id: string;
    title: string;
    category: string;
    priority: string;
    status: string;
  }[];
  upcomingAppointments: {
    id: string;
    date: string;
    startTime: string;
    status: string;
    service: { id: string; name: string; color: string | null; type?: string } | null;
    priceListItem: { id: string; name: string; category: string | null } | null;
    customer: { name: string; phone: string };
    pet: { name: string; species: string } | null;
    notes: string | null;
  }[];
  tomorrowAppointments: {
    id: string;
    startTime: string;
    customerName: string;
    customerId: string;
    customerPhone: string;
    petName: string | null;
    serviceName: string;
  }[];
  recentOrders: {
    id: string;
    orderType: string;
    status: string;
    total: number;
    customerName: string;
    createdAt: string;
  }[];
  todayTasks: {
    id: string;
    title: string;
    category: string;
    priority: string;
    status: string;
    dueAt: string | null;
    dueDate: string | null;
  }[];
  overdueTasks: {
    id: string;
    title: string;
    category: string;
    priority: string;
    status: string;
    dueAt: string | null;
    dueDate: string | null;
  }[];
  urgentLeads: {
    id: string;
    name: string;
    phone: string | null;
    nextFollowUpAt: string | null;
    customer: { name: string } | null;
  }[];
  topDebtors: {
    id: string;
    name: string;
    phone: string;
    total: number;
  }[];
  atRiskCustomers: {
    id: string;
    name: string;
    phone: string;
    lastAppointment: string;
    daysSinceVisit: number;
    totalVisits: number;
  }[];
  todayArrivals: {
    id: string;
    checkIn: string;
    checkOut: string | null;
    status: string;
    pet: { id: string; name: string; species: string };
    customer: { id: string; name: string; phone: string } | null;
    room: { name: string } | null;
  }[];
  todayDepartures: {
    id: string;
    checkIn: string;
    checkOut: string | null;
    status: string;
    pet: { id: string; name: string; species: string };
    customer: { id: string; name: string; phone: string } | null;
    room: { name: string } | null;
  }[];
  upcomingBirthdays: {
    id: string;
    name: string;
    species: string;
    breed: string | null;
    daysUntil: number;
    age: number;
    customer: { id: string; name: string; phone: string };
  }[];
  pendingBookings?: number;
}

interface ActivityItem {
  id: string;
  type: "activity" | "whatsapp";
  userName: string;
  action: string;
  description: string;
  createdAt: string;
  channel?: string;
  status?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  scheduled: { label: "מתוכנן", color: "#3B82F6", bg: "#EFF6FF", icon: Clock },
  completed: { label: "הושלם", color: "#10B981", bg: "#ECFDF5", icon: CheckCircle2 },
  canceled: { label: "בוטל", color: "#EF4444", bg: "#FEF2F2", icon: AlertCircle },
  no_show: { label: "לא הגיע", color: "#F59E0B", bg: "#FFFBEB", icon: AlertCircle },
};

const SERVICE_TYPE_TABS = [
  { key: "all", label: "הכל" },
  { key: "training", label: "אילוף" },
  { key: "boarding", label: "פנסיון" },
  { key: "grooming", label: "טיפוח" },
];

// Maps Hebrew price-list category names → filter key
const CATEGORY_TO_FILTER: Record<string, string> = {
  "אילוף": "training",
  "פנסיון": "boarding",
  "טיפוח": "grooming",
};

// Maps filter key → Hebrew label for badge display
const FILTER_TO_LABEL: Record<string, string> = {
  training: "אילוף",
  boarding: "פנסיון",
  grooming: "טיפוח",
  consultation: "ייעוץ",
  daycare: "דיי קר",
};

const ORDER_TYPE_INFO: Record<string, { label: string; icon: React.ElementType }> = {
  sale: { label: "מוצרים", icon: Package },
  products: { label: "מוצרים", icon: Package },
  appointment: { label: "תור", icon: Calendar },
  boarding: { label: "פנסיון", icon: Hotel },
  training: { label: "אילוף", icon: Dumbbell },
  grooming: { label: "טיפוח", icon: Scissors },
};

const ORDER_STATUS_BADGE: Record<string, string> = {
  draft: "badge-neutral",
  confirmed: "badge-brand",
  completed: "badge-success",
  canceled: "badge-danger",
  cancelled: "badge-danger",
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: "טיוטה",
  confirmed: "מאושר",
  completed: "הושלם",
  canceled: "בוטל",
  cancelled: "בוטל",
};

const ACTIVITY_ICONS: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  LOGIN: { icon: LogIn, color: "#64748B", bg: "#F1F5F9" },
  CREATE_CUSTOMER: { icon: UserPlus, color: "#3B82F6", bg: "#EFF6FF" },
  UPDATE_CUSTOMER: { icon: Users, color: "#3B82F6", bg: "#EFF6FF" },
  CREATE_ORDER: { icon: ShoppingCart, color: "#F97316", bg: "#FFF7ED" },
  UPDATE_ORDER: { icon: ShoppingCart, color: "#F97316", bg: "#FFF7ED" },
  CREATE_PAYMENT: { icon: CreditCard, color: "#10B981", bg: "#ECFDF5" },
  CREATE_APPOINTMENT: { icon: Calendar, color: "#8B5CF6", bg: "#F5F3FF" },
  UPDATE_APPOINTMENT: { icon: Calendar, color: "#8B5CF6", bg: "#F5F3FF" },
  CANCEL_APPOINTMENT: { icon: AlertCircle, color: "#EF4444", bg: "#FEF2F2" },
  CREATE_LEAD: { icon: Target, color: "#EC4899", bg: "#FDF2F8" },
  ADD_PET: { icon: PawPrint, color: "#06B6D4", bg: "#ECFEFF" },
  CREATE_TASK: { icon: ClipboardList, color: "#F59E0B", bg: "#FFFBEB" },
  COMPLETE_TASK: { icon: CheckCircle2, color: "#10B981", bg: "#ECFDF5" },
  CREATE_BOARDING: { icon: Hotel, color: "#6366F1", bg: "#EEF2FF" },
  CHECK_IN: { icon: Hotel, color: "#10B981", bg: "#ECFDF5" },
  CHECK_OUT: { icon: Hotel, color: "#64748B", bg: "#F1F5F9" },
  WHATSAPP_SEND: { icon: MessageCircle, color: "#22C55E", bg: "#F0FDF4" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דקות`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  return `לפני ${Math.floor(hours / 24)} ימים`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  href,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  href?: string;
}) {
  const content = (
    <div className="stat-card group p-5">
      <div className="flex items-start justify-between">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: `${color}15` }}
        >
          <Icon className="w-[22px] h-[22px]" style={{ color }} />
        </div>
        {href && (
          <ArrowLeft className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
        )}
      </div>
      <div className="mt-3.5 leading-tight">
        <div className="text-[30px] font-bold text-petra-text tracking-tight leading-none">{value}</div>
        <div className="mt-1.5 text-[13px] font-medium text-petra-text">{title}</div>
        {subtitle && <div className="mt-0.5 text-xs text-petra-muted">{subtitle}</div>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="card-hover block">
        {content}
      </Link>
    );
  }
  return <div className="card-hover">{content}</div>;
}

function AppointmentRow({
  appointment,
}: {
  appointment: DashboardStats["upcomingAppointments"][0];
}) {
  const status = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.scheduled;
  const StatusIcon = status.icon;
  const date = new Date(appointment.date);
  const dayStr = date.toLocaleDateString("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  // Determine display name and type label
  const itemName = appointment.priceListItem?.name ?? appointment.service?.name ?? appointment.notes ?? "תור";
  const rawCategory = appointment.priceListItem?.category;
  const rawServiceType = appointment.service?.type;
  const typeLabel = rawCategory
    ? rawCategory
    : rawServiceType ? (FILTER_TO_LABEL[rawServiceType] ?? rawServiceType) : null;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 px-1 rounded-lg transition-colors">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: status.bg }}
      >
        <StatusIcon className="w-4 h-4" style={{ color: status.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-petra-text truncate">
            {appointment.customer.name}
          </span>
          {appointment.pet && (
            <span className="text-xs text-petra-muted flex items-center gap-0.5">
              <PawPrint className="w-3 h-3" />
              {appointment.pet.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-petra-muted truncate">{itemName}</span>
          {typeLabel && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600 font-medium shrink-0">
              {typeLabel}
            </span>
          )}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-xs font-medium text-petra-text">{appointment.startTime}</div>
        <div className="text-xs text-petra-muted">{dayStr}</div>
      </div>
    </div>
  );
}

function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  if (activities.length === 0) {
    return (
      <div className="empty-state py-8">
        <div className="empty-state-icon">
          <Activity className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm text-petra-muted">אין פעילות ב-24 שעות האחרונות</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activities.slice(0, 10).map((item) => {
        const iconInfo = ACTIVITY_ICONS[item.action] || ACTIVITY_ICONS.LOGIN;
        const IconComp = iconInfo.icon;
        return (
          <div
            key={item.id}
            className="flex items-center gap-3 py-2.5 px-1 hover:bg-slate-50/50 rounded-lg transition-colors"
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: iconInfo.bg }}
            >
              <IconComp className="w-3.5 h-3.5" style={{ color: iconInfo.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-petra-text truncate">{item.description}</p>
              <p className="text-[11px] text-petra-muted">{item.userName}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {item.type === "whatsapp" && item.status && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    item.status === "SENT"
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  )}
                >
                  {item.status === "SENT" ? "נשלח" : "נכשל"}
                </span>
              )}
              <span className="text-[11px] text-petra-muted whitespace-nowrap">
                {relativeTime(item.createdAt)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <PageTitle title="לוח בקרה" />
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 bg-slate-100 rounded mb-2 animate-pulse" />
          <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="h-10 w-32 bg-slate-100 rounded-xl animate-pulse" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-5 animate-pulse">
            <div className="w-11 h-11 bg-slate-100 rounded-xl mb-4" />
            <div className="h-7 w-16 bg-slate-100 rounded mb-2" />
            <div className="h-4 w-24 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
      {/* Chart + appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5 animate-pulse">
          <div className="h-5 w-24 bg-slate-100 rounded mb-4" />
          <div className="h-[220px] bg-slate-50 rounded-xl" />
        </div>
        <div className="card p-5 animate-pulse">
          <div className="h-5 w-24 bg-slate-100 rounded mb-4" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className="w-8 h-8 bg-slate-100 rounded-lg" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-slate-100 rounded mb-1" />
                <div className="h-3 w-20 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Orders + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="card p-5 animate-pulse">
            <div className="h-5 w-28 bg-slate-100 rounded mb-4" />
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center gap-3 py-2.5">
                <div className="w-7 h-7 bg-slate-100 rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 w-36 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Daily Focus Task Status Logic ───────────────────────────────────────────

type FocusStatus = "active" | "overdue";

function computeFocusStatus(task: { dueAt: string | null; dueDate: string | null; status: string }): FocusStatus {
  const now = new Date();
  if (task.dueAt) {
    const dueAt = new Date(task.dueAt);
    const diffMin = differenceInMinutes(dueAt, now);
    if (isPast(dueAt) && diffMin < -30) return "overdue";
    return "active";
  }
  if (task.dueDate) {
    const dueDate = startOfDay(new Date(task.dueDate));
    if (isToday(dueDate)) return "active";
    if (isPast(dueDate)) return "overdue";
  }
  return "active";
}

function formatFocusTime(task: { dueAt: string | null; dueDate: string | null }): string {
  if (task.dueAt) {
    return format(new Date(task.dueAt), "HH:mm");
  }
  return "כל היום";
}

const FOCUS_CONFIG: Record<FocusStatus, { label: string; color: string; bg: string; border: string }> = {
  active: { label: "עכשיו", color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
  overdue: { label: "באיחור", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
};

function DailyFocusSection({ todayTasks, overdueTasks, onComplete }: {
  todayTasks: DashboardStats["todayTasks"];
  overdueTasks: DashboardStats["overdueTasks"];
  onComplete: (taskId: string) => void;
}) {
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [focusFilter, setFocusFilter] = useState<"overdue" | "today" | null>(null);
  const allFocusTasks = focusFilter === "overdue" ? overdueTasks : focusFilter === "today" ? todayTasks : [...overdueTasks, ...todayTasks];
  const visibleTasks = allFocusTasks.filter((t) => !completingIds.has(t.id));
  if (visibleTasks.length === 0 && allFocusTasks.length === 0) return null;

  const handleComplete = (taskId: string) => {
    setCompletingIds((prev) => new Set(prev).add(taskId));
    // Small delay for animation, then fire the actual API call
    setTimeout(() => onComplete(taskId), 350);
  };

  return (
    <div className="card overflow-hidden"
      style={{ borderTop: "3px solid #F97316" }}
    >
      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-50">
            <Flame className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-petra-text">מיקוד יומי</h2>
            <p className="text-[11px] text-petra-muted flex items-center gap-1">
              {overdueTasks.length > 0 && (
                <button
                  onClick={() => setFocusFilter(focusFilter === "overdue" ? null : "overdue")}
                  className={cn("font-medium transition-colors", focusFilter === "overdue" ? "text-red-600 underline" : "text-red-500 hover:text-red-600")}
                >
                  {overdueTasks.length} באיחור
                </button>
              )}
              {overdueTasks.length > 0 && todayTasks.length > 0 && <span>·</span>}
              {todayTasks.length > 0 && (
                <button
                  onClick={() => setFocusFilter(focusFilter === "today" ? null : "today")}
                  className={cn("transition-colors", focusFilter === "today" ? "text-blue-600 underline" : "hover:text-petra-text")}
                >
                  {todayTasks.length} להיום
                </button>
              )}
              {focusFilter && <button onClick={() => setFocusFilter(null)} className="text-slate-400 hover:text-slate-600 mr-1">× הכל</button>}
            </p>
          </div>
        </div>
        <Link
          href="/tasks"
          className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1"
        >
          כל המשימות
          <ArrowLeft className="w-3 h-3" />
        </Link>
      </div>

      <div className="divide-y divide-slate-50">
        {allFocusTasks.slice(0, 5).map((task) => {
          const isCompleting = completingIds.has(task.id);
          const focusStatus = computeFocusStatus(task);
          const config = FOCUS_CONFIG[focusStatus];
          const timeStr = formatFocusTime(task);
          return (
            <div
              key={task.id}
              className={cn(
                "px-5 py-3 flex items-center gap-3 transition-all duration-300",
                focusStatus === "overdue" ? "bg-red-50/30" : "hover:bg-slate-50/50",
                isCompleting && "opacity-0 max-h-0 py-0 overflow-hidden"
              )}
            >
              {/* Complete checkbox */}
              <button
                onClick={() => handleComplete(task.id)}
                disabled={isCompleting}
                className={cn(
                  "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200",
                  isCompleting
                    ? "bg-green-500 border-green-500"
                    : "border-slate-300 hover:border-green-500 hover:bg-green-50"
                )}
                title="סמן כבוצע"
              >
                {isCompleting && <Check className="w-3 h-3 text-white" />}
              </button>

              {/* Title */}
              <span className={cn(
                "text-sm font-medium text-petra-text flex-1 truncate transition-all duration-200",
                isCompleting && "line-through text-petra-muted"
              )}>
                {task.title}
              </span>

              {/* Time */}
              <span
                className="text-[10px] font-medium flex items-center gap-0.5 px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ color: config.color, background: config.bg }}
              >
                <Clock className="w-3 h-3" />
                {timeStr}
              </span>

              {/* Status badge */}
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ color: config.color, background: config.bg, border: `1px solid ${config.border}` }}
              >
                {config.label}
              </span>

              {/* Priority */}
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  background:
                    task.priority === "URGENT" ? "#DC2626" :
                      task.priority === "HIGH" ? "#EF4444" :
                        task.priority === "MEDIUM" ? "#F59E0B" : "#94A3B8",
                }}
              />
            </div>
          );
        })}
        {allFocusTasks.length > 5 && (
          <div className="px-5 py-2.5 border-t border-slate-100">
            <Link href="/tasks" className="text-xs text-brand-500 hover:text-brand-600 font-medium">
              הצג {allFocusTasks.length - 5} נוספות ←
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Urgent Leads Alert Component ────────────────────────────────────────────

function TodayFollowUpsWidget({ leads }: { leads: DashboardStats["urgentLeads"] }) {
  const todayLeads = leads.filter((l) => {
    if (!l.nextFollowUpAt) return false;
    const d = new Date(l.nextFollowUpAt);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  });

  if (todayLeads.length === 0) return null;

  return (
    <div className="card overflow-hidden" style={{ borderTop: "3px solid #3B82F6" }}>
      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 bg-blue-50/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-100">
            <CalendarClock className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-petra-text">מעקבים להיום</h2>
            <p className="text-[11px] text-petra-muted">
              <span className="text-blue-600 font-medium">{todayLeads.length} לידים</span> לטיפול היום
            </p>
          </div>
        </div>
        <Link href="/leads" className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1">
          ללוח הלידים
          <ArrowLeft className="w-3 h-3" />
        </Link>
      </div>
      <div className="divide-y divide-slate-50">
        {todayLeads.map((lead) => (
          <div key={lead.id} className="px-5 py-3 flex items-center gap-3 transition-colors hover:bg-slate-50/50">
            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-petra-text truncate">{lead.name}</div>
              {lead.customer?.name && (
                <div className="text-[11px] text-petra-muted truncate">לקוח: {lead.customer.name}</div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                מעקב היום
              </span>
              <Link
                href={`/leads`}
                className="w-7 h-7 rounded-md bg-brand-50 text-brand-600 hover:bg-brand-100 flex items-center justify-center transition-colors"
                title="לטפל בליד"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UrgentLeadsAlert({ leads }: { leads: DashboardStats["urgentLeads"] }) {
  const overdueLeads = leads.filter((l) => {
    if (!l.nextFollowUpAt) return false;
    const d = new Date(l.nextFollowUpAt);
    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    return !isToday && d < now;
  });

  if (overdueLeads.length === 0) return null;

  return (
    <div className="card overflow-hidden" style={{ borderTop: "3px solid #EF4444" }}>
      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 bg-red-50/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-100">
            <PhoneCall className="w-4 h-4 text-red-600 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-petra-text">לידים שעבר מועד הפולואפ</h2>
            <p className="text-[11px] text-petra-muted">
              <span className="text-red-600 font-medium">{overdueLeads.length} לידים</span> עבר זמן הטיפול
            </p>
          </div>
        </div>
        <Link
          href="/leads"
          className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1"
        >
          ללוח הלידים
          <ArrowLeft className="w-3 h-3" />
        </Link>
      </div>

      <div className="divide-y divide-slate-50">
        {overdueLeads.map((lead) => {
          const timeStr = lead.nextFollowUpAt
            ? new Date(lead.nextFollowUpAt).toLocaleString("he-IL", {
              day: "2-digit",
              month: "2-digit",
            })
            : "";

          return (
            <div
              key={lead.id}
              className="px-5 py-3 flex items-center gap-3 transition-colors hover:bg-slate-50/50"
            >
              <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-petra-text truncate">
                  {lead.name}
                </div>
                {lead.customer?.name && (
                  <div className="text-[11px] text-petra-muted truncate">
                    לקוח: {lead.customer.name}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-100 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  עבר: {timeStr}
                </span>

                <Link
                  href={`/leads`}
                  className="w-7 h-7 rounded-md bg-brand-50 text-brand-600 hover:bg-brand-100 flex items-center justify-center transition-colors"
                  title="לטפל בליד"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Top Debtors Widget ───────────────────────────────────────────────────────

function TopDebtorsWidget({ debtors }: { debtors: DashboardStats["topDebtors"] }) {
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  if (!debtors || debtors.length === 0) return null;

  return (
    <div className="card overflow-hidden" style={{ borderTop: "3px solid #F97316" }}>
      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 bg-orange-50/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-100">
            <CreditCard className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-petra-text">תשלומים פתוחים</h2>
            <p className="text-[11px] text-petra-muted">
              <span className="text-orange-600 font-medium">{debtors.length} לקוחות</span> עם חוב ממתין
            </p>
          </div>
        </div>
        <Link
          href="/payments?status=pending"
          className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1"
        >
          לכל התשלומים
          <ArrowLeft className="w-3 h-3" />
        </Link>
      </div>

      <div className="divide-y divide-slate-50">
        {debtors.map((debtor) => {
          const waMsg = `שלום ${debtor.name}! 😊\nתזכורת לגבי תשלום ממתין בסך ${formatCurrency(debtor.total)}.\nנשמח לקבל את התשלום בהקדם 🙏`;
          const waLink = `https://wa.me/${toWhatsAppPhone(debtor.phone)}?text=${encodeURIComponent(waMsg)}`;
          const sent = sentIds.has(debtor.id);

          return (
            <div
              key={debtor.id}
              className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <Link href={`/customers/${debtor.id}`} className="text-sm font-medium text-petra-text hover:text-brand-600 truncate block">
                  {debtor.name}
                </Link>
              </div>
              <span className="text-sm font-bold text-orange-600 flex-shrink-0">
                {formatCurrency(debtor.total)}
              </span>
              {debtor.phone && (
                sent ? (
                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    נשלח
                  </span>
                ) : (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-green-600 hover:bg-green-50 border border-transparent hover:border-green-200 transition-colors flex-shrink-0"
                    title="שלח תזכורת בוואטסאפ"
                    onClick={() => setSentIds((prev) => new Set([...prev, debtor.id]))}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </a>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tomorrow Reminders Widget ───────────────────────────────────────────────

function TomorrowReminders({
  appointments,
}: {
  appointments: DashboardStats["tomorrowAppointments"];
}) {
  const [sent, setSent] = useState<Set<string>>(new Set());
  const { can } = usePlan();
  const canWhatsApp = can("whatsapp_reminders");

  if (!appointments || appointments.length === 0) return null;

  const withPhone = appointments.filter((a) => a.customerPhone);

  function buildMsg(a: DashboardStats["tomorrowAppointments"][0]) {
    return encodeURIComponent(
      `שלום ${a.customerName}! 😊\nתזכורת לתור מחר בשעה ${a.startTime}${a.petName ? ` עם ${a.petName}` : ""} לשירות ${a.serviceName}.\nנתראה! 🐾`
    );
  }

  function sendOne(a: DashboardStats["tomorrowAppointments"][0]) {
    const phone = toWhatsAppPhone(a.customerPhone);
    window.open(`https://wa.me/${phone}?text=${buildMsg(a)}`, "_blank");
    setSent((prev) => new Set([...prev, a.id]));
  }

  function sendAll() {
    withPhone.forEach((a, i) => {
      setTimeout(() => {
        const phone = toWhatsAppPhone(a.customerPhone);
        window.open(`https://wa.me/${phone}?text=${buildMsg(a)}`, "_blank");
        setSent((prev) => new Set([...prev, a.id]));
      }, i * 600);
    });
  }

  return (
    <div className="card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", canWhatsApp ? "bg-green-50" : "bg-amber-50")}>
            <MessageCircle className={cn("w-4 h-4", canWhatsApp ? "text-green-600" : "text-amber-600")} />
          </div>
          <div>
            <h2 className="text-base font-bold text-petra-text">{canWhatsApp ? "תזכורות למחר" : "תורים מחר"}</h2>
            <p className="text-xs text-petra-muted">
              {canWhatsApp ? `${appointments.length} תורים מתוכננים` : `${appointments.length} תורים — זכור ליצור קשר עם הלקוחות`}
            </p>
          </div>
        </div>
        {canWhatsApp && withPhone.length > 1 && (
          <button
            onClick={sendAll}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <MessageCircle className="w-3.5 h-3.5 text-green-600" />
            שלח הכל ({withPhone.length})
          </button>
        )}
        {!canWhatsApp && (
          <Link href="/upgrade" className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1 flex-shrink-0">
            <Zap className="w-3 h-3" />
            שדרג לשליחת WhatsApp
          </Link>
        )}
      </div>

      <div className="space-y-2">
        {appointments.map((a) => {
          const hasSent = sent.has(a.id);
          return (
            <div
              key={a.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-colors",
                hasSent ? "bg-green-50" : "bg-slate-50 hover:bg-slate-100"
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-petra-border flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-[10px] text-petra-muted leading-none">מחר</span>
                <span className="text-sm font-bold text-petra-text leading-tight">{a.startTime}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-petra-text truncate">{a.customerName}</p>
                <p className="text-xs text-petra-muted truncate">
                  {a.petName ? `${a.petName} • ` : ""}{a.serviceName}
                </p>
              </div>
              {canWhatsApp ? (
                a.customerPhone ? (
                  <button
                    onClick={() => sendOne(a)}
                    className={cn(
                      "flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
                      hasSent
                        ? "bg-green-100 text-green-700 cursor-default"
                        : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                    )}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {hasSent ? "נשלח ✓" : "שלח"}
                  </button>
                ) : (
                  <span className="text-[10px] text-petra-muted">אין טלפון</span>
                )
              ) : (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 flex-shrink-0">
                  📞 {a.customerPhone || "אין טלפון"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {!canWhatsApp && (
        <p className="mt-3 text-[11px] text-petra-muted text-center">
          שדרג ל<Link href="/upgrade" className="text-brand-500 hover:underline">פרו</Link> כדי לשלוח תזכורות WhatsApp אוטומטיות
        </p>
      )}
    </div>
  );
}

// ─── Birthday Widget ──────────────────────────────────────────────────────────

interface BirthdayItem {
  petId: string;
  petName: string;
  species: string;
  breed: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  birthDate: string;
  nextBirthday: string;
  daysUntil: number;
  age: number;
}

function BirthdayWidget() {
  const { data } = useQuery<{ birthdays: BirthdayItem[]; total: number }>({
    queryKey: ["pet-birthdays"],
    queryFn: () => fetchJSON("/api/pets/birthdays?days=14"),
  });

  if (!data || data.total === 0) return null;

  return (
    <div className="card overflow-hidden" style={{ borderTop: "3px solid #EC4899" }}>
      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-pink-50">
            <Cake className="w-4 h-4 text-pink-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-petra-text">ימי הולדת קרובים</h2>
            <p className="text-[11px] text-petra-muted">
              <span className="text-pink-500 font-medium">{data.total} חיות מחמד</span>{" "}
              ב-14 הימים הקרובים
            </p>
          </div>
        </div>
        <Link
          href="/customers"
          className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1"
        >
          לרשימת לקוחות
          <ArrowLeft className="w-3 h-3" />
        </Link>
      </div>

      <div className="divide-y divide-slate-50">
        {data.birthdays.map((b) => {
          const waMsg = `היי ${b.customerName}! 🎂 יום הולדת שמח ל${b.petName}! ${b.daysUntil === 0 ? "זה היום! 🎉" : `עוד ${b.daysUntil} ימים`} כבר ${b.age} שנה! 🐾`;
          const waLink = `https://wa.me/${toWhatsAppPhone(b.customerPhone)}?text=${encodeURIComponent(waMsg)}`;

          return (
            <div
              key={b.petId}
              className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors"
            >
              {/* Days pill / today emoji */}
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-pink-50 text-sm font-bold text-pink-600">
                {b.daysUntil === 0 ? "🎂" : b.daysUntil}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-petra-text">{b.petName}</span>
                  <span className="text-xs text-petra-muted">בן/בת {b.age}</span>
                </div>
                <div className="text-xs text-petra-muted truncate">{b.customerName}</div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className={cn(
                    "text-[10px] font-medium px-2 py-0.5 rounded-full",
                    b.daysUntil === 0
                      ? "bg-pink-100 text-pink-700 border border-pink-200"
                      : "bg-slate-100 text-slate-600"
                  )}
                >
                  {b.daysUntil === 0 ? "🎉 היום!" : `עוד ${b.daysUntil} ימים`}
                </span>

                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-7 h-7 rounded-md bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors"
                  title="שלח ברכה בוואטסאפ"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Vaccination Alert Widget ────────────────────────────────────────────────

interface VaccinationItem {
  healthId: string;
  petId: string;
  petName: string;
  species: string;
  breed: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vaccineType: "rabies" | "dhpp" | "deworming";
  vaccineLabel: string;
  lastDate: string | null;
  validUntil: string | null;
  daysUntil: number;
  isExpired: boolean;
  isUnknown: boolean;
}

function VaccinationAlertWidget() {
  const queryClient = useQueryClient();
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [taskedIds, setTaskedIds] = useState<Set<string>>(new Set());
  const { data } = useQuery<{ vaccinations: VaccinationItem[]; total: number }>({
    queryKey: ["pet-vaccinations"],
    queryFn: () => fetchJSON("/api/pets/vaccinations?days=30"),
  });

  const createTaskMutation = useMutation({
    mutationFn: (payload: { title: string; category: string; priority: string; dueDate: string }) =>
      fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה ביצירת משימה"); return d; }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  if (!data || data.total === 0) return null;

  return (
    <div className="card overflow-hidden" style={{ borderTop: "3px solid #8B5CF6" }}>
      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 bg-violet-50/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-100">
            <Syringe className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-petra-text">חיסוני כלבת — התראות</h2>
            <p className="text-[11px] text-petra-muted">
              <span className="text-violet-600 font-medium">{data.total} חיות מחמד</span>{" "}
              עם חיסון פג תוקף / עומד לפוג
            </p>
          </div>
        </div>
        <Link
          href="/customers"
          className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1"
        >
          לרשימת לקוחות
          <ArrowLeft className="w-3 h-3" />
        </Link>
      </div>

      <div className="divide-y divide-slate-50">
        {data.vaccinations.map((v) => {
          const expiry = v.validUntil ? new Date(v.validUntil) : null;
          const expiryStr = expiry && !isNaN(expiry.getTime()) ? expiry.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" }) : "";
          const waMsg = `שלום ${v.customerName}! 💉\nחיסון ${v.vaccineLabel} של ${v.petName} ${v.isExpired ? "פג תוקפו" : `עומד לפוג בתאריך ${expiryStr}`}.\nנא לדאוג לחידוש החיסון בהקדם. 🐾`;
          const waLink = `https://wa.me/${toWhatsAppPhone(v.customerPhone)}?text=${encodeURIComponent(waMsg)}`;
          const sent = sentIds.has(v.petId);

          return (
            <div
              key={v.petId}
              className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors"
            >
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold",
                v.isExpired
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700"
              )}>
                {v.isExpired ? "!" : v.daysUntil}
              </div>

              <div className="flex-1 min-w-0">
                <Link href={v.customerId ? `/customers/${v.customerId}` : "/customers"} className="text-sm font-medium text-petra-text hover:text-brand-600 truncate block">
                  {v.petName}{v.customerName && <span className="font-normal text-petra-muted"> ({v.customerName})</span>}
                </Link>
                <div className={cn(
                  "text-[11px] font-medium",
                  v.isExpired ? "text-red-600" : "text-amber-600"
                )}>
                  {v.isExpired ? `פג תוקף ${expiryStr}` : `פג תוקף עוד ${v.daysUntil} ימים · ${expiryStr}`}
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {taskedIds.has(v.petId) ? (
                  <span className="text-xs text-violet-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    משימה
                  </span>
                ) : (
                  <button
                    className="w-7 h-7 rounded-md bg-violet-50 text-violet-600 hover:bg-violet-100 flex items-center justify-center transition-colors"
                    title="צור משימת תזכורת"
                    onClick={() => {
                      const dueDate = new Date();
                      dueDate.setDate(dueDate.getDate() + 1);
                      createTaskMutation.mutate({
                        title: `חידוש חיסון כלבת — ${v.petName} (${v.customerName})`,
                        category: "HEALTH",
                        priority: v.isExpired ? "URGENT" : "HIGH",
                        dueDate: dueDate.toISOString().slice(0, 10),
                      });
                      setTaskedIds((prev) => new Set([...prev, v.petId]));
                    }}
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                  </button>
                )}
                {v.customerPhone && (
                  sent ? (
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      נשלח
                    </span>
                  ) : (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-7 h-7 rounded-md bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors"
                      title="שלח תזכורת חיסון בוואטסאפ"
                      onClick={() => setSentIds((prev) => new Set([...prev, v.petId]))}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Medications Widget ───────────────────────────────────────────────────────

function MedicationsWidget() {
  const { data } = useQuery<{ pets: { petName: string; customerName: string; medications: { medName: string }[] }[]; total: number }>({
    queryKey: ["dashboard-medications"],
    queryFn: () => fetch("/api/pets/medications?boarded=true").then((r) => {
      if (!r.ok) throw new Error("Failed");
      return r.json();
    }),
    staleTime: 120000,
  });

  const pets = data?.pets ?? [];
  if (pets.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
          <Pill className="w-4 h-4 text-violet-500" />
          תרופות – חיות בפנסיון
        </h2>
        <Link
          href="/medications"
          className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1"
        >
          לוח מלא
          <ArrowLeft className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-2">
        {pets.slice(0, 5).map((p) => (
          <div key={p.petName + p.customerName} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              <PawPrint className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
              <span className="text-sm font-medium text-petra-text truncate">{p.petName}</span>
              <span className="text-xs text-petra-muted truncate">({p.customerName})</span>
            </div>
            <div className="flex gap-1 flex-wrap justify-end">
              {p.medications.slice(0, 2).map((m) => (
                <span key={m.medName} className="badge badge-neutral text-[10px] truncate max-w-[100px]">{m.medName}</span>
              ))}
              {p.medications.length > 2 && (
                <span className="badge badge-neutral text-[10px]">+{p.medications.length - 2}</span>
              )}
            </div>
          </div>
        ))}
        {pets.length > 5 && (
          <p className="text-xs text-petra-muted text-center pt-1">
            ועוד {pets.length - 5} חיות נוספות
          </p>
        )}
      </div>
    </div>
  );
}

// ─── At-Risk Customers Widget ─────────────────────────────────────────────────

function AtRiskCustomersWidget({ customers }: { customers: DashboardStats["atRiskCustomers"] }) {
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);

  if (!customers || customers.length === 0) return null;

  function buildMsg(c: DashboardStats["atRiskCustomers"][0]) {
    return `שלום ${c.name}! 🐾\nזמן רב לא ראינו אתכם, מתגעגעים!\nהאם תרצו לקבוע תור? נשמח לראות אתכם שוב 😊`;
  }

  function handleBulkSend() {
    setBulkSending(true);
    const withPhone = customers.filter((c) => c.phone);
    withPhone.forEach((c, i) => {
      setTimeout(() => {
        const text = encodeURIComponent(buildMsg(c));
        window.open(`https://wa.me/${toWhatsAppPhone(c.phone)}?text=${text}`, "_blank");
        setSentIds((prev) => new Set([...prev, c.id]));
        if (i === withPhone.length - 1) setBulkSending(false);
      }, i * 700);
    });
  }

  return (
    <div className="card overflow-hidden" style={{ borderTop: "3px solid #F97316" }}>
      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 bg-orange-50/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-100">
            <TrendingDown className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-petra-text">לקוחות בסיכון אי-חזרה</h2>
            <p className="text-[11px] text-petra-muted">
              <span className="text-orange-600 font-medium">{customers.length} לקוחות</span>{" "}
              לא ביקרו 60+ יום
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBulkSend}
            disabled={bulkSending || customers.filter((c) => c.phone).length === 0}
            className="text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors"
            title="שלח הודעות לכל הלקוחות ברשימה"
          >
            <MessageCircle className="w-3 h-3" />
            שלח לכולם
          </button>
          <Link
            href="/customers"
            className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1"
          >
            כל הלקוחות
            <ArrowLeft className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="divide-y divide-slate-50">
        {customers.map((c) => {
          const sent = sentIds.has(c.id);
          const waMsg = buildMsg(c);
          const waLink = `https://wa.me/${toWhatsAppPhone(c.phone)}?text=${encodeURIComponent(waMsg)}`;
          const urgency = c.daysSinceVisit >= 120 ? "text-red-600" : "text-orange-600";

          return (
            <div key={c.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                <UserX className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/customers/${c.id}`}
                  className="text-sm font-medium text-petra-text hover:text-brand-600 truncate block"
                >
                  {c.name}
                </Link>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[11px] font-medium", urgency)}>
                    לא ביקר {c.daysSinceVisit} ימים
                  </span>
                  <span className="text-[11px] text-petra-muted">
                    · {c.totalVisits} ביקורים סה"כ
                  </span>
                </div>
              </div>
              {c.phone && (
                sent ? (
                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    נשלח
                  </span>
                ) : (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSentIds((prev) => new Set([...prev, c.id]))}
                    className="w-7 h-7 rounded-md bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors flex-shrink-0"
                    title="שלח הודעת חזרה בוואטסאפ"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </a>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Pet Birthdays Widget ─────────────────────────────────────────────────────

function PetBirthdaysWidget({ birthdays }: { birthdays: DashboardStats["upcomingBirthdays"] }) {
  if (!birthdays || birthdays.length === 0) return null;

  return (
    <div className="card overflow-hidden" style={{ borderTop: "3px solid #EC4899" }}>
      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 bg-pink-50/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-pink-100">
            <Cake className="w-4 h-4 text-pink-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-petra-text">ימי הולדת השבוע</h2>
            <p className="text-[11px] text-petra-muted">
              <span className="text-pink-600 font-medium">{birthdays.length} חיות</span>{" "}
              חוגגות ב-7 הימים הקרובים
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-50">
        {birthdays.map((pet) => {
          const isToday = pet.daysUntil === 0;
          const greetingLines = [
            `🎂 יום הולדת שמח ל${pet.name}!`,
            `${pet.name} חוגג/ת ${pet.age + 1} שנים`,
            pet.breed ? `(${pet.breed})` : "",
            "",
            `מאחלים לכם ול${pet.name} המון שנות אושר ובריאות! 🐾`,
          ].filter(Boolean).join("\n");

          return (
            <div key={pet.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition-colors">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${isToday ? "bg-pink-100" : "bg-slate-100"}`}>
                {isToday ? "🎂" : "🐾"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-petra-text">{pet.name}</span>
                  {pet.breed && <span className="text-xs text-petra-muted">({pet.breed})</span>}
                  {isToday && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 text-pink-700">
                      היום!
                    </span>
                  )}
                </div>
                <p className="text-xs text-petra-muted">
                  {pet.customer?.name ?? ""}
                  {" · "}
                  {pet.age + 1} שנ׳
                  {pet.daysUntil > 0 && ` · בעוד ${pet.daysUntil} ימים`}
                </p>
              </div>
              {pet.customer?.phone && (
                <a
                  href={`https://wa.me/${toWhatsAppPhone(pet.customer?.phone ?? "")}?text=${encodeURIComponent(greetingLines)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                  title="שלח ברכת יום הולדת"
                >
                  <MessageCircle className="w-3 h-3" />
                  ברכה
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── New Customer Modal ───────────────────────────────────────────────────────

function NewCustomerModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const queryClient = useQueryClient();
  const PRESET_TAGS = ["VIP", "קבוע", "מזדמן", "פוטנציאל", "לשעבר", "עסקי"];
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    source: "",
    requestedService: "",
    selectedTags: [] as string[],
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [showPetForm, setShowPetForm] = useState(false);
  const [petForm, setPetForm] = useState({ name: "", species: "", breed: "", age: "" });

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sanitizeName(data.name),
          phone: normalizeIsraeliPhone(data.phone),
          email: data.email || null,
          address: data.address || null,
          notes: data.notes || null,
          source: data.source || null,
          tags: JSON.stringify(data.selectedTags),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      const customer = await res.json();
      // Optionally create pet
      if (petForm.name.trim()) {
        const petRes = await fetch(`/api/customers/${customer.id}/pets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: petForm.name,
            species: petForm.species || "dog",
            breed: petForm.breed || null,
            age: petForm.age ? parseInt(petForm.age) : null,
          }),
        });
        if (!petRes.ok) {
          console.error("Pet creation failed:", await petRes.text().catch(() => ""));
        }
      }
      return customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setForm({ name: "", phone: "", email: "", address: "", notes: "", source: "", requestedService: "", selectedTags: [] });
      setPetForm({ name: "", species: "", breed: "", age: "" });
      setShowPetForm(false);
      setFieldErrors({});
      onCreated();
      toast.success("הלקוח נוצר בהצלחה");
    },
    onError: (err) => toast.error(err.message || "שגיאה ביצירת הלקוח"),
  });

  function validateAndSubmitNew() {
    const errors: Record<string, string | undefined> = {};
    const nameErr = validateName(form.name);
    if (nameErr) errors.name = nameErr;
    const phoneErr = validateIsraeliPhone(form.phone);
    if (phoneErr) errors.phone = phoneErr;
    const emailErr = validateEmail(form.email);
    if (emailErr) errors.email = emailErr;
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    mutation.mutate(form);
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-petra-text">לקוח חדש</h2>
            <p className="text-sm text-petra-muted mt-0.5">הוסף לקוח למערכת</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">שם מלא *</label>
            <input
              className={cn("input", fieldErrors.name && "border-red-300 focus:ring-red-200")}
              value={form.name}
              onChange={(e) => { setForm({ ...form, name: e.target.value }); if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: undefined }); }}
              placeholder="שם הלקוח"
            />
            {fieldErrors.name && <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">טלפון *</label>
              <input
                className={cn("input", fieldErrors.phone && "border-red-300 focus:ring-red-200")}
                value={form.phone}
                onChange={(e) => { setForm({ ...form, phone: e.target.value }); if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: undefined }); }}
                placeholder="050-0000000"
                inputMode="tel"
              />
              {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
            </div>
            <div>
              <label className="label">אימייל</label>
              <input
                className={cn("input", fieldErrors.email && "border-red-300 focus:ring-red-200")}
                type="email"
                value={form.email}
                onChange={(e) => { setForm({ ...form, email: e.target.value }); if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined }); }}
              />
              {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
            </div>
          </div>
          <div>
            <label className="label">כתובת</label>
            <input
              className="input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="עיר, רחוב"
            />
          </div>
          {/* Tags */}
          <div>
            <label className="label">תגיות לקוח</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {PRESET_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setForm((f) => ({
                    ...f,
                    selectedTags: f.selectedTags.includes(tag)
                      ? f.selectedTags.filter((t) => t !== tag)
                      : [...f.selectedTags, tag],
                  }))}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${form.selectedTags.includes(tag)
                    ? tag === "VIP"
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-[#3D2E1F] text-white border-[#3D2E1F]"
                    : "bg-[#FAF7F3] text-[#8B7355] border-[#E8DFD5] hover:border-[#C4956A]"
                    }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          {/* Optional fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">סוג שירות מבוקש</label>
              <select className="input" value={form.requestedService} onChange={(e) => setForm({ ...form, requestedService: e.target.value })}>
                <option value="">בחר...</option>
                <option value="training">אילוף</option>
                <option value="grooming">טיפוח</option>
                <option value="boarding">פנסיון</option>
                <option value="other">אחר</option>
              </select>
            </div>
            <div>
              <label className="label">מקור הפנייה</label>
              <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                <option value="">— לא ידוע —</option>
                <option value="referral">המלצה מלקוח</option>
                <option value="google">גוגל</option>
                <option value="instagram">אינסטגרם</option>
                <option value="facebook">פייסבוק</option>
                <option value="tiktok">טיקטוק</option>
                <option value="signage">שלט / מעבר ברחוב</option>
                <option value="other">אחר</option>
              </select>
            </div>
          </div>
          <p className="text-[11px] text-petra-muted -mt-2">ניתן להשלים מאוחר יותר</p>

          {/* Optional pet */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPetForm((p) => !p)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-petra-text hover:bg-slate-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <PawPrint className="w-4 h-4 text-petra-muted" />
                הוספת חיה
                <span className="text-[11px] text-petra-muted font-normal">(אופציונלי)</span>
              </span>
              {showPetForm ? <ChevronUp className="w-4 h-4 text-petra-muted" /> : <ChevronDown className="w-4 h-4 text-petra-muted" />}
            </button>
            {showPetForm && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">שם החיה</label>
                    <input className="input" value={petForm.name} onChange={(e) => setPetForm({ ...petForm, name: e.target.value })} placeholder="בוקי" />
                  </div>
                  <div>
                    <label className="label">סוג</label>
                    <select className="input" value={petForm.species} onChange={(e) => setPetForm({ ...petForm, species: e.target.value })}>
                      <option value="">בחר...</option>
                      <option value="dog">כלב</option>
                      <option value="cat">חתול</option>
                      <option value="other">אחר</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">גזע</label>
                    <input className="input" value={petForm.breed} onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })} placeholder="לברדור" />
                  </div>
                  <div>
                    <label className="label">גיל</label>
                    <input className="input" value={petForm.age} onChange={(e) => setPetForm({ ...petForm, age: e.target.value })} placeholder="2" />
                  </div>
                </div>
              </div>
            )}
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
            disabled={mutation.isPending}
            onClick={validateAndSubmitNew}
          >
            <UserPlus className="w-4 h-4" />
            {mutation.isPending ? "שומר..." : "הוסף לקוח"}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Appointment Modal ────────────────────────────────────────────────────

function NewAppointmentModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    customerId: "",
    petId: "",
    serviceId: "",
    date: today,
    startTime: "09:00",
    endTime: "10:00",
    notes: "",
  });

  const { data: customers } = useQuery<{ id: string; name: string; phone: string; pets: { id: string; name: string; species: string }[] }[]>({
    queryKey: ["customers-for-appt"],
    queryFn: () => fetch("/api/customers?full=1").then((r) => {
      if (!r.ok) throw new Error("Failed");
      return r.json();
    }),
    enabled: isOpen,
  });

  const { data: services } = useQuery<{ id: string; name: string; duration: number | null; type: string }[]>({
    queryKey: ["services-for-appt"],
    queryFn: () => fetch("/api/services").then((r) => {
      if (!r.ok) throw new Error("Failed");
      return r.json();
    }),
    enabled: isOpen,
  });

  const selectedCustomer = customers?.find((c) => c.id === form.customerId);

  // Auto-fill end time when service changes
  const setField = (key: keyof typeof form, value: string) => {
    if (key === "serviceId") {
      const svc = services?.find((s) => s.id === value);
      if (svc?.duration && form.startTime) {
        const [h, m] = form.startTime.split(":").map(Number);
        const endMin = h * 60 + m + svc.duration;
        const endH = Math.floor(endMin / 60) % 24;
        const endM = endMin % 60;
        setForm((prev) => ({
          ...prev,
          serviceId: value,
          endTime: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
        }));
        return;
      }
    }
    if (key === "customerId") {
      setForm((prev) => ({ ...prev, customerId: value, petId: "" }));
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const mutation = useMutation({
    mutationFn: () =>
      fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          serviceId: form.serviceId,
          customerId: form.customerId,
          petId: form.petId || null,
          notes: form.notes || null,
        }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה ביצירת פגישה"); return d; }),
    onSuccess: () => {
      setForm({ customerId: "", petId: "", serviceId: "", date: today, startTime: "09:00", endTime: "10:00", notes: "" });
      toast.success("הפגישה נוצרה בהצלחה!");
      onCreated();
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה ביצירת הפגישה. נסה שוב."),
  });

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-brand-500" />
            תור ידני חדש
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Customer */}
          <div>
            <label className="label">לקוח *</label>
            <select
              className="input"
              value={form.customerId}
              onChange={(e) => setField("customerId", e.target.value)}
            >
              <option value="">בחר לקוח...</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
              ))}
            </select>
          </div>

          {/* Pet (optional, shown when customer selected) */}
          {selectedCustomer && (selectedCustomer.pets?.length ?? 0) > 0 && (
            <div>
              <label className="label">חיית מחמד (אופציונלי)</label>
              <select
                className="input"
                value={form.petId}
                onChange={(e) => setField("petId", e.target.value)}
              >
                <option value="">ללא בחירת חיית מחמד</option>
                {selectedCustomer.pets?.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Service */}
          <div>
            <label className="label">שירות *</label>
            <select
              className="input"
              value={form.serviceId}
              onChange={(e) => setField("serviceId", e.target.value)}
            >
              <option value="">בחר שירות...</option>
              {services?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.duration ? ` (${s.duration} דק׳)` : ""}</option>
              ))}
            </select>
          </div>

          {/* Date + Times */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1">
              <label className="label">תאריך *</label>
              <input
                type="date" lang="he"
                className="input"
                value={form.date}
                onChange={(e) => setField("date", e.target.value)}
              />
            </div>
            <div>
              <label className="label">שעת התחלה</label>
              <input
                type="time"
                className="input"
                value={form.startTime}
                onChange={(e) => setField("startTime", e.target.value)}
              />
            </div>
            <div>
              <label className="label">שעת סיום</label>
              <input
                type="time"
                className="input"
                value={form.endTime}
                onChange={(e) => setField("endTime", e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">הערות</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="הערות נוספות..."
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={() => mutation.mutate()}
            disabled={!form.customerId || !form.serviceId || !form.date || mutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            {mutation.isPending ? "שומר..." : "קבע תור"}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
        {mutation.isError && (
          <p className="text-red-600 text-xs mt-2">שגיאה בשמירת התור. נסה שוב.</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const { subscriptionActive, subscriptionExpired, subscriptionDaysLeft, isFree, isGroomer } = usePlan();
  const perms = usePermissions();
  const queryClient = useQueryClient();
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const [intakeCopied, setIntakeCopied] = useState(false);
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [serviceFilter, setServiceFilter] = useState("all");

  const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isFetching: isDashFetching } = useQuery<DashboardStats>({
    queryKey: ["dashboard"],
    queryFn: () => fetchJSON("/api/dashboard"),
  });

  const { data: activityData } = useQuery<{ activities: ActivityItem[] }>({
    queryKey: ["dashboard-activity"],
    queryFn: () => fetchJSON("/api/dashboard/activity"),
    refetchInterval: 60000,
  });

  const completeTaskMutation = useMutation({
    mutationFn: (taskId: string) =>
      fetchJSON(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const handleCopyIntakeForm = useCallback(async () => {
    setIntakeLoading(true);
    try {
      const res = await fetch("/api/intake/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.url) {
        await copyToClipboard(data.url);
        setIntakeCopied(true);
        setTimeout(() => setIntakeCopied(false), 3000);
        toast.success("קישור טופס הקליטה הועתק ללוח!", { description: data.url });
      }
    } catch {
      toast.error("שגיאה ביצירת קישור טופס הרישום");
    } finally {
      setIntakeLoading(false);
    }
  }, []);

  const handleCompleteTask = useCallback(
    (taskId: string) => {
      completeTaskMutation.mutate(taskId);
    },
    [completeTaskMutation]
  );

  const handleCompleteOpenTask = useCallback(
    (taskId: string) => {
      setCompletingTaskIds((prev) => new Set(prev).add(taskId));
      setTimeout(() => {
        completeTaskMutation.mutate(taskId);
      }, 350);
    },
    [completeTaskMutation]
  );

  if (isLoading) return <DashboardSkeleton />;
  if (!data) return null;

  const todayStr = new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  });

  const filteredAppointments =
    serviceFilter === "all"
      ? data.upcomingAppointments
      : data.upcomingAppointments.filter((a) => {
          // Price-list path: check category → filter key mapping
          if (a.priceListItem?.category && CATEGORY_TO_FILTER[a.priceListItem.category] === serviceFilter) return true;
          // Legacy service path: check service.type directly
          if (a.service?.type === serviceFilter) return true;
          return false;
        });

  return (
    <div className="space-y-6">
      {/* Subscription Banner */}
      {subscriptionExpired && !isFree && (
        <div className="rounded-xl px-4 py-3 flex items-center justify-between bg-red-50 border border-red-200 text-red-800">
          <span className="text-sm font-medium">⚠️ המנוי שלך פג — הגישה לתכונות מתקדמות הוגבלה</span>
          <a href="/upgrade" className="text-sm font-semibold underline shrink-0 mr-4">חדש מנוי</a>
        </div>
      )}
      {subscriptionActive && subscriptionDaysLeft <= 14 && (
        <div className="rounded-xl px-4 py-3 flex items-center justify-between bg-amber-50 border border-amber-200 text-amber-800">
          <span className="text-sm font-medium">⏳ המנוי שלך מסתיים בעוד {subscriptionDaysLeft} ימים</span>
          <a href="/upgrade" className="text-sm font-semibold underline shrink-0 mr-4">חדש מנוי</a>
        </div>
      )}
      {/* Greeting Header */}
      <div className="space-y-3 mb-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-petra-text">
              שלום, {user?.name || "משתמש"} 👋
            </h1>
            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                queryClient.invalidateQueries({ queryKey: ["dashboard-activity"] });
              }}
              title="רענן נתונים"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-petra-muted hover:text-petra-text hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDashFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
          <p className="text-sm text-petra-muted">{todayStr}</p>
        </div>
        <div className="flex flex-col sm:grid sm:grid-cols-2 lg:flex lg:flex-row gap-2">
          <button
            onClick={() => setShowNewCustomer(true)}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4 shrink-0" />
            לקוח חדש
          </button>
          <Link
            href="/scheduler"
            className="btn-secondary flex items-center justify-center gap-2 border-brand-500 text-brand-600 hover:bg-brand-50"
          >
            <CalendarClock className="w-4 h-4 shrink-0" />
            קביעת תור
          </Link>
          <button
            onClick={() => setShowNewOrder(true)}
            className="btn-secondary flex items-center justify-center gap-2 text-slate-500 border-slate-200"
          >
            <ShoppingCart className="w-4 h-4 shrink-0" />
            הזמנה חדשה
          </button>
          <button
            onClick={handleCopyIntakeForm}
            disabled={intakeLoading}
            className={cn(
              "btn-secondary flex items-center justify-center gap-2 text-slate-500 border-slate-200 transition-colors",
              intakeCopied && "bg-green-50 text-green-700 border-green-300"
            )}
            title="יצירת טופס קליטה והעתקת קישור"
          >
            {intakeCopied ? (
              <>
                <ClipboardCheck className="w-4 h-4 shrink-0" />
                הועתק!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 shrink-0" />
                <span>טופס קליטה</span>
              </>
            )}
          </button>
          <button
            onClick={() => {
              const slug = user?.businessSlug || user?.businessId || "demo-business-001";
              const url = `${window.location.origin}/book/${slug}`;
              copyToClipboard(url)
                .then(() => toast.success("קישור הזמנת תורים הועתק!", { description: url }))
                .catch(() => toast.info("הקישור לקוחות שלך:", { description: url, duration: 10000 }));
            }}
            className="btn-secondary flex items-center justify-center gap-2 text-slate-500 border-slate-200"
            title="העתק קישור הזמנת תורים אונליין"
          >
            <Copy className="w-4 h-4 shrink-0" />
            <span>תורים אונליין</span>
          </button>
        </div>
      </div>

      {/* Setup Checklist — shown to users who haven't completed setup yet */}
      <SetupChecklist />

      {/* Welcome modal — shown once to new team members (non-owners) */}
      <TeamWelcomeModal />

      {/* Onboarding Wizard modal */}
      {showOnboardingWizard && (
        <OnboardingWizardModal onClose={() => setShowOnboardingWizard(false)} />
      )}

      {data.totalCustomers === 0 ? (
        /* ── New Business Welcome Section ── */
        <div className="space-y-6">
          <div
            className="card p-8 text-center animate-slide-up"
            style={{
              background: "linear-gradient(135deg, rgba(249,115,22,0.06) 0%, rgba(59,130,246,0.04) 100%)",
              borderColor: "rgba(249,115,22,0.15)",
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl"
              style={{ background: "linear-gradient(135deg, #F97316, #FB923C)" }}
            >
              🐾
            </div>
            <h2 className="text-xl font-bold text-petra-text mb-2">ברוכים הבאים ל-Petra!</h2>
            <p className="text-sm text-petra-muted max-w-md mx-auto">
              המערכת מוכנה — בואו נתחיל לבנות את העסק שלכם. הנה כמה צעדים ראשונים:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={() => setShowNewCustomer(true)}
              className="card p-5 text-right hover:border-brand-300 hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                <UserPlus className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-sm font-bold text-petra-text mb-1">הוסף לקוח ראשון</h3>
              <p className="text-xs text-petra-muted leading-relaxed">הכנס את פרטי הלקוח הראשון שלך למערכת</p>
            </button>

            <Link
              href="/scheduler"
              className="card p-5 text-right hover:border-brand-300 hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mb-3 group-hover:bg-violet-100 transition-colors">
                <CalendarClock className="w-5 h-5 text-violet-600" />
              </div>
              <h3 className="text-sm font-bold text-petra-text mb-1">קבע תור ראשון</h3>
              <p className="text-xs text-petra-muted leading-relaxed">תזמן פגישה ראשונה עם לקוח</p>
            </Link>

            <Link
              href="/settings"
              className="card p-5 text-right hover:border-brand-300 hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3 group-hover:bg-emerald-100 transition-colors">
                <Tag className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-sm font-bold text-petra-text mb-1">הגדר שירותים ומחירון</h3>
              <p className="text-xs text-petra-muted leading-relaxed">הוסף את השירותים שהעסק שלך מציע</p>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={handleCopyIntakeForm}
              disabled={intakeLoading}
              className={cn(
                "card p-4 flex items-center gap-3 hover:border-brand-300 transition-all text-right",
                intakeCopied && "border-green-300 bg-green-50/50"
              )}
            >
              <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                {intakeCopied ? <ClipboardCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-orange-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-petra-text">{intakeCopied ? "הועתק!" : "טופס קליטה"}</p>
                <p className="text-xs text-petra-muted">העתק קישור לטופס קליטה ושלח ללקוח</p>
              </div>
            </button>

            <button
              onClick={() => {
                const slug = user?.businessSlug || user?.businessId || "demo-business-001";
                const url = `${window.location.origin}/book/${slug}`;
                copyToClipboard(url).then(() => {
                  toast.success("קישור הזמנת תורים הועתק!", { description: url });
                }).catch(() => toast.error("לא הצלחנו להעתיק"));
              }}
              className="card p-4 flex items-center gap-3 hover:border-brand-300 transition-all text-right"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Copy className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-petra-text">תורים אונליין</p>
                <p className="text-xs text-petra-muted">העתק קישור לדף ההזמנה לאתר שלך</p>
              </div>
            </button>
          </div>
        </div>
      ) : (
      <>
      {/* Daily Focus — Today's & Overdue Tasks */}
      <DailyFocusSection
        todayTasks={data.todayTasks || []}
        overdueTasks={data.overdueTasks || []}
        onComplete={handleCompleteTask}
      />

      {/* Today's Follow-Ups — hidden for staff (no leads access) */}
      {!perms.isStaff && <TodayFollowUpsWidget leads={data.urgentLeads || []} />}

      {/* Urgent Leads Alert — hidden for staff */}
      {!perms.isStaff && <UrgentLeadsAlert leads={data.urgentLeads || []} />}

      {/* Top Debtors Widget — hidden for staff (financial) */}
      {perms.canSeeFinance && <TopDebtorsWidget debtors={data.topDebtors || []} />}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {perms.canSeeRevenueSummary && (
          <StatCard
            title="הכנסות החודש"
            value={formatCurrency(data.monthRevenue)}
            subtitle={(data.todayRevenue ?? 0) > 0 ? `היום: ${formatCurrency(data.todayRevenue)}` : undefined}
            icon={TrendingUp}
            color="#10B981"
            href="/payments"
          />
        )}
        {perms.canSeeFinance && (
          <StatCard
            title="הזמנות פעילות"
            value={data.activeOrders}
            icon={ShoppingCart}
            color="#F97316"
            href="/orders"
          />
        )}
        {perms.canSeeFinance && (
          <StatCard
            title="תשלומים ממתינים"
            value={data.pendingPayments}
            subtitle={perms.canSeeRevenueSummary && data.pendingPaymentsAmount > 0 ? formatCurrency(data.pendingPaymentsAmount) : undefined}
            icon={CreditCard}
            color="#F59E0B"
            href="/payments"
          />
        )}
        <StatCard
          title="תורים היום"
          value={data.todayAppointments}
          icon={Calendar}
          color="#3B82F6"
          href="/calendar"
        />
        {!perms.isStaff && (
          <StatCard
            title="לידים פתוחים"
            value={data.openLeads}
            icon={Target}
            color="#8B5CF6"
            href="/leads"
          />
        )}
        {(data.pendingBookings ?? 0) > 0 && (
          <StatCard
            title="תורים ממתינים לאישור"
            value={data.pendingBookings ?? 0}
            icon={CalendarClock}
            color="#EF4444"
            href="/bookings"
          />
        )}
      </div>

      {/* Boarding Today Widget */}
      {((data.todayArrivals?.length ?? 0) > 0 || (data.todayDepartures?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(data.todayArrivals?.length ?? 0) > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <LogIn className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="text-sm font-semibold text-petra-text">כניסות היום לפנסיון</h3>
                <span className="badge-success text-[10px] ms-auto">{data.todayArrivals.length}</span>
              </div>
              <div className="space-y-2">
                {data.todayArrivals.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">
                      {s.pet?.name?.charAt(0) ?? "🐾"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-petra-text truncate">{s.pet?.name ?? ""}</p>
                      <p className="text-[10px] text-petra-muted truncate">{s.customer?.name}{s.room ? ` · ${s.room.name}` : ""}</p>
                    </div>
                    <a
                      href={`https://wa.me/${toWhatsAppPhone(s.customer?.phone ?? "")}?text=${encodeURIComponent(`שלום ${s.customer?.name}! מזכירים לך שהיום הגעה של ${s.pet?.name} לפנסיון 🐾`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 flex-shrink-0"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(data.todayDepartures?.length ?? 0) > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Hotel className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="text-sm font-semibold text-petra-text">יציאות היום מהפנסיון</h3>
                <span className="badge-warning text-[10px] ms-auto">{data.todayDepartures.length}</span>
              </div>
              <div className="space-y-2">
                {data.todayDepartures.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">
                      {s.pet?.name?.charAt(0) ?? "🐾"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-petra-text truncate">{s.pet?.name ?? ""}</p>
                      <p className="text-[10px] text-petra-muted truncate">{s.customer?.name}{s.room ? ` · ${s.room.name}` : ""}</p>
                    </div>
                    <a
                      href={`https://wa.me/${toWhatsAppPhone(s.customer?.phone ?? "")}?text=${encodeURIComponent(`שלום ${s.customer?.name}! כלב שלך ${s.pet?.name} מחכה לפיקאפ היום מהפנסיון 🐾`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 flex-shrink-0"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Revenue Chart + Upcoming Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {perms.canSeeRevenueSummary && (
          <RevenueChart
            data={data.revenueByMonth}
            target={data.revenueTarget}
            topService={data.topService}
          />
        )}

        {/* Upcoming Appointments with filter */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-petra-text">תורים קרובים</h2>
            <Link
              href="/calendar"
              className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1"
            >
              הצג הכל
              <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>

          {/* Service type tabs */}
          <div className="flex gap-1 mb-3 overflow-x-auto">
            {SERVICE_TYPE_TABS.filter((tab) => !(isGroomer && (tab.key === "training" || tab.key === "boarding"))).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setServiceFilter(tab.key)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                  serviceFilter === tab.key
                    ? "bg-brand-500 text-white"
                    : "bg-slate-100 text-petra-muted hover:bg-slate-200"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filteredAppointments.length === 0 ? (
            <div className="empty-state py-8">
              <div className="empty-state-icon">
                <Calendar className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-petra-muted">אין תורים קרובים</p>
            </div>
          ) : (
            <div>
              {filteredAppointments.map((apt) => (
                <AppointmentRow key={apt.id} appointment={apt} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-petra-text">הזמנות אחרונות</h2>
            <Link href="/orders" className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1">
              הצג הכל
              <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>

          {data.recentOrders.length === 0 ? (
            <div className="empty-state py-8">
              <div className="empty-state-icon">
                <ShoppingCart className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-petra-muted">אין הזמנות</p>
            </div>
          ) : (
            <div className="space-y-1">
              {data.recentOrders.map((order) => {
                const typeInfo = ORDER_TYPE_INFO[order.orderType] || ORDER_TYPE_INFO.sale;
                const TypeIcon = typeInfo.icon;
                return (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex items-center gap-3 py-2.5 px-1 hover:bg-slate-50/50 rounded-lg transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-brand-50">
                      <TypeIcon className="w-4 h-4 text-brand-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-petra-text truncate">
                          {order.customerName}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                            ORDER_STATUS_BADGE[order.status] || "badge-neutral"
                          )}
                        >
                          {ORDER_STATUS_LABEL[order.status] || order.status}
                        </span>
                      </div>
                      <div className="text-xs text-petra-muted mt-0.5">
                        {typeInfo.label}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-semibold text-petra-text">
                        {formatCurrency(order.total)}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity Feed — owner/manager only */}
        {!perms.isStaff && !perms.isVolunteer && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-petra-text">פעילות אחרונה</h2>
              <span className="text-[11px] text-petra-muted">24 שעות אחרונות</span>
            </div>
            <ActivityFeed activities={activityData?.activities || []} />
          </div>
        )}
      </div>

      {/* Tomorrow Reminders */}
      <TomorrowReminders appointments={data.tomorrowAppointments ?? []} />

      {/* Vaccination Expiry Alerts */}
      <VaccinationAlertWidget />

      {/* Medications for boarded pets */}
      <MedicationsWidget />

      {/* Pet Birthdays */}
      <PetBirthdaysWidget birthdays={data.upcomingBirthdays ?? []} />

      {/* At-Risk Customers */}
      <AtRiskCustomersWidget customers={data.atRiskCustomers ?? []} />

      {/* Open Tasks */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-petra-text">משימות פתוחות</h2>
          <Link
            href="/tasks"
            className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1"
          >
            הצג הכל
            <ArrowLeft className="w-3 h-3" />
          </Link>
        </div>

        {data.recentTasks.length === 0 ? (
          <div className="empty-state py-8">
            <div className="empty-state-icon">
              <CheckCircle2 className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-petra-muted">אין משימות פתוחות</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.recentTasks.map((task) => {
              const isCompleting = completingTaskIds.has(task.id);
              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-all duration-300",
                    isCompleting && "opacity-0 max-h-0 p-0 overflow-hidden"
                  )}
                >
                  <button
                    onClick={() => handleCompleteOpenTask(task.id)}
                    disabled={isCompleting}
                    className={cn(
                      "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200",
                      isCompleting
                        ? "bg-green-500 border-green-500"
                        : "border-slate-300 hover:border-green-500 hover:bg-green-50"
                    )}
                    title="סמן כבוצע"
                  >
                    {isCompleting && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      background:
                        task.priority === "URGENT"
                          ? "#DC2626"
                          : task.priority === "HIGH"
                            ? "#EF4444"
                            : task.priority === "MEDIUM"
                              ? "#F59E0B"
                              : "#94A3B8",
                    }}
                  />
                  <span className={cn(
                    "text-sm text-petra-text flex-1 truncate transition-all duration-200",
                    isCompleting && "line-through text-petra-muted"
                  )}>
                    {task.title}
                  </span>
                  <span className="badge-neutral text-[10px]">{TASK_CATEGORY_LABELS[task.category] ?? task.category}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>
      )}

      {/* New Customer Modal */}
      <NewCustomerModal
        isOpen={showNewCustomer}
        onClose={() => setShowNewCustomer(false)}
        onCreated={() => {
          setShowNewCustomer(false);
          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        }}
      />

      {/* New Appointment Modal */}
      <NewAppointmentModal
        isOpen={showNewAppointment}
        onClose={() => setShowNewAppointment(false)}
        onCreated={() => {
          setShowNewAppointment(false);
          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        }}
      />

      {/* New Order Modal */}
      <CreateOrderModal
        isOpen={showNewOrder}
        onClose={() => setShowNewOrder(false)}
        onCreated={() => {
          setShowNewOrder(false);
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        }}
      />
    </div>
  );
}
