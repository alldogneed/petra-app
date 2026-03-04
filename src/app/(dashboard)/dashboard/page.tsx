"use client";

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
} from "lucide-react";
import {
  isToday,
  isPast,
  differenceInMinutes,
  format,
  startOfDay,
} from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { formatCurrency, fetchJSON, cn, toWhatsAppPhone } from "@/lib/utils";
import { SetupChecklist } from "@/components/onboarding/SetupChecklist";
import { TeamWelcomeModal } from "@/components/onboarding/TeamWelcomeModal";
import OnboardingWizardModal from "@/components/onboarding/OnboardingWizardModal";
import dynamic from "next/dynamic";
const CreateOrderModal = dynamic(
  () => import("@/components/orders/CreateOrderModal").then((m) => ({ default: m.CreateOrderModal })),
  { ssr: false }
);

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
    customer: { id: string; name: string; phone: string };
    room: { name: string } | null;
  }[];
  todayDepartures: {
    id: string;
    checkIn: string;
    checkOut: string | null;
    status: string;
    pet: { id: string; name: string; species: string };
    customer: { id: string; name: string; phone: string };
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

const ORDER_TYPE_INFO: Record<string, { label: string; icon: React.ElementType }> = {
  sale: { label: "מוצרים", icon: Package },
  appointment: { label: "תור", icon: Calendar },
  boarding: { label: "פנסיון", icon: Hotel },
};

const ORDER_STATUS_BADGE: Record<string, string> = {
  draft: "badge-neutral",
  confirmed: "badge-brand",
  completed: "badge-success",
  canceled: "badge-danger",
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: "טיוטה",
  confirmed: "מאושר",
  completed: "הושלם",
  canceled: "בוטל",
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
    <div className="stat-card group">
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: `${color}15` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {href && (
          <ArrowLeft className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
        )}
      </div>
      <div className="space-y-0.5">
        <div className="text-2xl font-bold text-petra-text">{value}</div>
        <div className="text-sm font-medium text-petra-text">{title}</div>
        {subtitle && <div className="text-xs text-petra-muted">{subtitle}</div>}
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
        <div className="text-xs text-petra-muted mt-0.5">{appointment.service?.name ?? appointment.notes ?? "תור"}</div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-xs font-medium text-petra-text">{appointment.startTime}</div>
        <div className="text-xs text-petra-muted">{dayStr}</div>
      </div>
    </div>
  );
}

function RevenueChart({
  data,
  target,
  topService,
}: {
  data: { month: string; amount: number }[];
  target: number;
  topService: { name: string; count: number } | null;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-petra-text">הכנסות</h2>
          {topService && (
            <span className="badge-brand text-[10px]">
              שירות מוביל: {topService.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-petra-muted">
          <div className="w-2 h-2 rounded-full bg-brand-500" />
          הכנסות
          <div className="w-4 border-t border-dashed border-slate-400 mx-1" />
          יעד
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#64748B" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}k`}
            width={50}
            mirror
          />
          <Tooltip
            formatter={(value: number | undefined) => [formatCurrency(value || 0), "הכנסות"]}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #E2E8F0",
              fontSize: 13,
              direction: "rtl",
            }}
          />
          <ReferenceLine
            y={target}
            stroke="#94A3B8"
            strokeDasharray="6 4"
            label={{
              value: `יעד ${formatCurrency(target)}`,
              position: "insideTopRight",
              fontSize: 11,
              fill: "#94A3B8",
            }}
          />
          <Bar dataKey="amount" fill="#F97316" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
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
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 bg-slate-100 rounded mb-2 animate-pulse" />
          <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="h-10 w-32 bg-slate-100 rounded-xl animate-pulse" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
  const allFocusTasks = [...overdueTasks, ...todayTasks];
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
            <p className="text-[11px] text-petra-muted">
              {overdueTasks.length > 0 && (
                <span className="text-red-500 font-medium">{overdueTasks.length} באיחור</span>
              )}
              {overdueTasks.length > 0 && todayTasks.length > 0 && " · "}
              {todayTasks.length > 0 && `${todayTasks.length} להיום`}
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
        {allFocusTasks.slice(0, 6).map((task) => {
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
      </div>
    </div>
  );
}

// ─── Urgent Leads Alert Component ────────────────────────────────────────────

function UrgentLeadsAlert({ leads }: { leads: DashboardStats["urgentLeads"] }) {
  if (!leads || leads.length === 0) return null;

  return (
    <div className="card overflow-hidden" style={{ borderTop: "3px solid #EF4444" }}>
      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 bg-red-50/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-100">
            <PhoneCall className="w-4 h-4 text-red-600 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-petra-text">לידים דחופים לטיפול</h2>
            <p className="text-[11px] text-petra-muted">
              <span className="text-red-600 font-medium">{leads.length} לידים</span> ממתינים לפולואפ
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
        {leads.map((lead) => {
          const timeStr = lead.nextFollowUpAt
            ? new Date(lead.nextFollowUpAt).toLocaleString("he-IL", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit"
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
                  עבר זמן: {timeStr}
                </span>

                <Link
                  href={`/leads?id=${lead.id}`}
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
          const waLink = `https://web.whatsapp.com/send?phone=${toWhatsAppPhone(debtor.phone)}&text=${encodeURIComponent(waMsg)}`;
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

  if (!appointments || appointments.length === 0) return null;

  const withPhone = appointments.filter((a) => a.customerPhone);

  function buildMsg(a: DashboardStats["tomorrowAppointments"][0]) {
    return encodeURIComponent(
      `שלום ${a.customerName}! 😊\nתזכורת לתור מחר בשעה ${a.startTime}${a.petName ? ` עם ${a.petName}` : ""} לשירות ${a.serviceName}.\nנתראה! 🐾`
    );
  }

  function sendOne(a: DashboardStats["tomorrowAppointments"][0]) {
    const phone = toWhatsAppPhone(a.customerPhone);
    window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${buildMsg(a)}`, "_blank");
    setSent((prev) => new Set([...prev, a.id]));
  }

  function sendAll() {
    withPhone.forEach((a, i) => {
      setTimeout(() => {
        const phone = toWhatsAppPhone(a.customerPhone);
        window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${buildMsg(a)}`, "_blank");
        setSent((prev) => new Set([...prev, a.id]));
      }, i * 600);
    });
  }

  return (
    <div className="card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-petra-text">תזכורות למחר</h2>
            <p className="text-xs text-petra-muted">{appointments.length} תורים מתוכננים</p>
          </div>
        </div>
        {withPhone.length > 1 && (
          <button
            onClick={sendAll}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <MessageCircle className="w-3.5 h-3.5 text-green-600" />
            שלח הכל ({withPhone.length})
          </button>
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
              {a.customerPhone ? (
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
              )}
            </div>
          );
        })}
      </div>
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
          const waLink = `https://web.whatsapp.com/send?phone=${toWhatsAppPhone(b.customerPhone)}&text=${encodeURIComponent(waMsg)}`;

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
          const waLink = `https://web.whatsapp.com/send?phone=${toWhatsAppPhone(v.customerPhone)}&text=${encodeURIComponent(waMsg)}`;
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
                <Link href={`/customers/${v.customerId}`} className="text-sm font-medium text-petra-text hover:text-brand-600 truncate block">
                  {v.petName} <span className="font-normal text-petra-muted">({v.customerName})</span>
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
        window.open(`https://web.whatsapp.com/send?phone=${toWhatsAppPhone(c.phone)}&text=${text}`, "_blank");
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
          const waLink = `https://web.whatsapp.com/send?phone=${toWhatsAppPhone(c.phone)}&text=${encodeURIComponent(waMsg)}`;
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
                  {pet.customer.name}
                  {" · "}
                  {pet.age + 1} שנ׳
                  {pet.daysUntil > 0 && ` · בעוד ${pet.daysUntil} ימים`}
                </p>
              </div>
              {pet.customer.phone && (
                <a
                  href={`https://web.whatsapp.com/send?phone=${toWhatsAppPhone(pet.customer.phone)}&text=${encodeURIComponent(greetingLines)}`}
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
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    source: "",
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          email: data.email || null,
          address: data.address || null,
          notes: data.notes || null,
          source: data.source || null,
          tags: "[]",
        }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setForm({ name: "", phone: "", email: "", address: "", notes: "", source: "" });
      onCreated();
    },
  });

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
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="שם הלקוח"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">טלפון *</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="050-0000000"
              />
            </div>
            <div>
              <label className="label">אימייל</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
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
          <div>
            <label className="label">הערות</label>
            <textarea
              className="input"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!form.name || !form.phone || mutation.isPending}
            onClick={() => mutation.mutate(form)}
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
                type="date"
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
        await navigator.clipboard.writeText(data.url);
        setIntakeCopied(true);
        setTimeout(() => setIntakeCopied(false), 3000);
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
  });

  const filteredAppointments =
    serviceFilter === "all"
      ? data.upcomingAppointments
      : data.upcomingAppointments.filter(
        (a) => a.service?.type === serviceFilter
      );

  return (
    <div className="space-y-6">
      {/* Greeting Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
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
        <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={() => setShowNewCustomer(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              לקוח חדש
            </button>
            <Link
              href="/scheduler"
              className="btn-secondary flex items-center gap-2"
            >
              <CalendarClock className="w-4 h-4" />
              קביעת תור ידני
            </Link>
            <button
              onClick={() => setShowNewOrder(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              הזמנה חדשה
            </button>
            <button
              onClick={handleCopyIntakeForm}
              disabled={intakeLoading}
              className={cn(
                "btn-secondary flex items-center gap-2 transition-colors",
                intakeCopied && "bg-green-50 text-green-700 border-green-300"
              )}
              title="יצירת טופס קליטה והעתקת קישור"
            >
              {intakeCopied ? (
                <>
                  <ClipboardCheck className="w-4 h-4" />
                  הועתק!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  טופס קליטה למערכת
                </>
              )}
            </button>
            <button
              onClick={() => {
                const slug = user?.businessSlug || user?.businessId || "demo-business-001";
                const url = `${window.location.origin}/book/${slug}`;
                navigator.clipboard.writeText(url).then(() => {
                  toast.success("קישור הזמנת תורים הועתק!", { description: url });
                }).catch(() => toast.error("לא הצלחנו להעתיק"));
              }}
              className="btn-secondary flex items-center gap-2"
              title="העתק קישור הזמנת תורים אונליין"
            >
              <Copy className="w-4 h-4" />
              <span className="hidden sm:inline">תורים אונליין</span>
            </button>
          </div>
      </div>

      {/* Setup Checklist — shown to users who haven't completed setup yet */}
      <SetupChecklist />

      {/* Welcome modal — shown once to new team members (non-owners) */}
      <TeamWelcomeModal />

      {/* Onboarding Wizard card — shown when business has no customers and no appointments */}
      {data.totalCustomers === 0 && data.todayAppointments === 0 && (
        <div
          className="card p-6 flex items-center gap-4 animate-slide-up"
          style={{
            background: "linear-gradient(135deg, rgba(249,115,22,0.05) 0%, rgba(251,146,60,0.03) 100%)",
            borderColor: "rgba(249,115,22,0.18)",
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl"
            style={{ background: "linear-gradient(135deg, #F97316, #FB923C)" }}
          >
            🐾
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-petra-text text-base">מוכנים להתחיל?</h3>
            <p className="text-sm text-petra-muted mt-0.5">
              הגדר את העסק שלך ב-2 דקות — הוסף שירות ראשון, לקוח ראשון, וסיימת!
            </p>
          </div>
          <button
            onClick={() => setShowOnboardingWizard(true)}
            className="btn-primary flex items-center gap-2 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            התחל הגדרה
          </button>
        </div>
      )}

      {/* Onboarding Wizard modal */}
      {showOnboardingWizard && (
        <OnboardingWizardModal onClose={() => setShowOnboardingWizard(false)} />
      )}

      {/* Daily Focus — Today's & Overdue Tasks */}
      <DailyFocusSection
        todayTasks={data.todayTasks || []}
        overdueTasks={data.overdueTasks || []}
        onComplete={handleCompleteTask}
      />

      {/* Urgent Leads Alert */}
      <UrgentLeadsAlert leads={data.urgentLeads || []} />

      {/* Top Debtors Widget */}
      <TopDebtorsWidget debtors={data.topDebtors || []} />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(data.todayRevenue ?? 0) > 0 && (
          <StatCard
            title="הכנסות היום"
            value={formatCurrency(data.todayRevenue)}
            icon={TrendingUp}
            color="#22C55E"
            href="/payments"
          />
        )}
        <StatCard
          title="הזמנות פעילות"
          value={data.activeOrders}
          icon={ShoppingCart}
          color="#F97316"
        />
        <StatCard
          title="תשלומים ממתינים"
          value={data.pendingPayments}
          subtitle={formatCurrency(data.pendingPaymentsAmount)}
          icon={CreditCard}
          color="#F59E0B"
        />
        <StatCard
          title="תורים היום"
          value={data.todayAppointments}
          icon={Calendar}
          color="#3B82F6"
          href="/calendar"
        />
        <StatCard
          title="לידים פתוחים"
          value={data.openLeads}
          icon={Target}
          color="#8B5CF6"
          href="/leads"
        />
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
                      href={`https://web.whatsapp.com/send?phone=${toWhatsAppPhone(s.customer?.phone ?? "")}&text=${encodeURIComponent(`שלום ${s.customer?.name}! מזכירים לך שהיום הגעה של ${s.pet?.name} לפנסיון 🐾`)}`}
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
                      href={`https://web.whatsapp.com/send?phone=${toWhatsAppPhone(s.customer?.phone ?? "")}&text=${encodeURIComponent(`שלום ${s.customer?.name}! כלב שלך ${s.pet?.name} מחכה לפיקאפ היום מהפנסיון 🐾`)}`}
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
        <RevenueChart
          data={data.revenueByMonth}
          target={data.revenueTarget}
          topService={data.topService}
        />

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
            {SERVICE_TYPE_TABS.map((tab) => (
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
                  <div
                    key={order.id}
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
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-petra-text">פעילות אחרונה</h2>
            <span className="text-[11px] text-petra-muted">24 שעות אחרונות</span>
          </div>
          <ActivityFeed activities={activityData?.activities || []} />
        </div>
      </div>

      {/* Tomorrow Reminders */}
      <TomorrowReminders appointments={data.tomorrowAppointments ?? []} />

      {/* Birthday Widget */}
      <BirthdayWidget />

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
                  <span className="badge-neutral text-[10px]">{task.category}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
