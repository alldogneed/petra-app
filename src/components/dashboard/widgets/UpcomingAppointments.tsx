"use client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DashboardStats, STATUS_CONFIG } from "@/components/dashboard/dashboard-shared";
import { StatusDot } from "@/components/dashboard/dash-ui";

/** Design status colours (text + dot). Other statuses fall back to STATUS_CONFIG's label in slate. */
const APPT_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  scheduled: { label: "מתוכנן", color: "#1D4ED8", dot: "#3B82F6" },
  completed: { label: "הושלם", color: "#047857", dot: "#10B981" },
  canceled: { label: "בוטל", color: "#B91C1C", dot: "#EF4444" },
  no_show: { label: "לא הגיע", color: "#B45309", dot: "#F59E0B" },
};


export function AppointmentRow({
  appointment,
}: {
  appointment: DashboardStats["upcomingAppointments"][0];
}) {
  const status = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.scheduled;
  const date = new Date(appointment.date);
  const dayStr = date.toLocaleDateString("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  // Determine display name and type label.
  // Notes composed by the orders service may embed a raw English training
  // subtype — e.g. "אילוף (private)" — because CreateOrderModal sends
  // trainingSubType "private" while TRAINING_SUBTYPE_LABELS only maps
  // "individual". Map known raw tokens to Hebrew for display (also covers
  // appointments already stored with the raw token).
  const RAW_SUBTYPE_LABELS: Record<string, string> = {
    private: "פרטי",
    individual: "פרטי",
    group: "קבוצתי",
    boarding: "פנסיון",
    package: "חבילה",
  };
  const rawItemName = appointment.priceListItem?.name ?? appointment.service?.name ?? appointment.notes ?? "תור";
  const itemName = rawItemName.replace(
    /\((private|individual|group|boarding|package)\)/g,
    (_m, key: string) => `(${RAW_SUBTYPE_LABELS[key]})`
  );
  // Time-of-day band (בוקר/צהריים/אחה"צ/ערב) inferred from startTime "HH:MM"
  const hour = parseInt(appointment.startTime.split(":")[0] ?? "0", 10);
  const tod = hour < 12 ? "בוקר" : hour < 14 ? "צהריים" : hour < 17 ? "אחה\"צ" : "ערב";

  const design = APPT_STATUS[appointment.status];
  const canceled = appointment.status === "canceled";

  return (
    <Link
      href={`/calendar?date=${String(appointment.date).slice(0, 10)}&apt=${appointment.id}`}
      className={cn(
        "grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3.5 py-[11px] px-2 -mx-2 border-t border-slate-100 rounded-lg text-slate-900 hover:bg-slate-50 transition-colors",
        canceled && "opacity-60"
      )}
    >
      {/* Time column */}
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold tabular-nums">{appointment.startTime}</span>
        <span className="text-[11px] text-slate-500">{tod}</span>
      </div>

      {/* Name + meta */}
      <div className="min-w-0 flex flex-col gap-0.5">
        <span className="text-sm font-semibold truncate">
          {appointment.customer.name}
          {appointment.pet && <span className="font-normal text-slate-500"> · {appointment.pet.name}</span>}
        </span>
        <span className="text-[13px] text-slate-500 truncate">
          {itemName}
          {dayStr && ` · ${dayStr}`}
        </span>
      </div>

      {/* Status */}
      {design ? (
        <StatusDot label={design.label} color={design.color} dot={design.dot} />
      ) : (
        <span className="text-xs font-medium text-slate-500 whitespace-nowrap">{status.label}</span>
      )}
    </Link>
  );
}
