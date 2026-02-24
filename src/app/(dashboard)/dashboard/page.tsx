"use client";

import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { formatCurrency, fetchJSON } from "@/lib/utils";

interface DashboardStats {
  totalCustomers: number;
  totalPets: number;
  todayAppointments: number;
  monthRevenue: number;
  pendingPayments: number;
  recentTasks: {
    id: string;
    title: string;
    category: string;
    priority: string;
    status: string;
  }[];
  openLeads: number;
  upcomingAppointments: {
    id: string;
    date: string;
    startTime: string;
    status: string;
    service: { id: string; name: string; color: string | null };
    customer: { name: string };
    pet: { name: string; species: string } | null;
  }[];
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  scheduled: { label: "מתוכנן", color: "#3B82F6", bg: "#EFF6FF", icon: Clock },
  completed: {
    label: "הושלם",
    color: "#10B981",
    bg: "#ECFDF5",
    icon: CheckCircle2,
  },
  canceled: { label: "בוטל", color: "#EF4444", bg: "#FEF2F2", icon: AlertCircle },
  no_show: { label: "לא הגיע", color: "#F59E0B", bg: "#FFFBEB", icon: AlertCircle },
};

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
        <div className="text-xs text-petra-muted mt-0.5">{appointment.service.name}</div>
      </div>

      <div className="text-left flex-shrink-0">
        <div className="text-xs font-medium text-petra-text">{appointment.startTime}</div>
        <div className="text-xs text-petra-muted">{dayStr}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard"],
    queryFn: () => fetchJSON("/api/dashboard"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="w-11 h-11 bg-slate-100 rounded-xl mb-4" />
              <div className="h-7 w-16 bg-slate-100 rounded mb-2" />
              <div className="h-4 w-24 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="לקוחות"
          value={data.totalCustomers}
          subtitle={`${data.totalPets} חיות מחמד`}
          icon={Users}
          color="#3B82F6"
          href="/customers"
        />
        <StatCard
          title="תורים היום"
          value={data.todayAppointments}
          icon={Calendar}
          color="#F97316"
          href="/calendar"
        />
        <StatCard
          title="הכנסות החודש"
          value={formatCurrency(data.monthRevenue)}
          subtitle={`${data.pendingPayments} ממתינים`}
          icon={CreditCard}
          color="#10B981"
        />
        <StatCard
          title="לידים פתוחים"
          value={data.openLeads}
          icon={Target}
          color="#8B5CF6"
          href="/leads"
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Appointments */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-petra-text">תורים קרובים</h2>
            <Link
              href="/calendar"
              className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1"
            >
              הצג הכל
              <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>

          {data.upcomingAppointments.length === 0 ? (
            <div className="empty-state py-8">
              <div className="empty-state-icon">
                <Calendar className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-petra-muted">אין תורים קרובים</p>
            </div>
          ) : (
            <div>
              {data.upcomingAppointments.map((apt) => (
                <AppointmentRow key={apt.id} appointment={apt} />
              ))}
            </div>
          )}
        </div>

        {/* Recent Tasks */}
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
              {data.recentTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{
                    background: task.priority === "HIGH" ? "#EF4444" : task.priority === "MEDIUM" ? "#F59E0B" : "#94A3B8"
                  }} />
                  <span className="text-sm text-petra-text flex-1 truncate">{task.title}</span>
                  <span className="badge-neutral text-[10px]">{task.category}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
