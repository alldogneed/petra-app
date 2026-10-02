"use client";
import Link from "next/link";
import { PawPrint } from "lucide-react";
import { DashboardStats, STATUS_CONFIG, FILTER_TO_LABEL } from "@/components/dashboard/dashboard-shared";


export function AppointmentRow({
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
  const rawCategory = appointment.priceListItem?.category;
  const rawServiceType = appointment.service?.type;
  const typeLabel = rawCategory
    ? rawCategory
    : rawServiceType ? (FILTER_TO_LABEL[rawServiceType] ?? rawServiceType) : null;

  // Time-of-day band (בוקר/צהריים/אחה"צ/ערב) inferred from startTime "HH:MM"
  const hour = parseInt(appointment.startTime.split(":")[0] ?? "0", 10);
  const tod = hour < 12 ? "בוקר" : hour < 14 ? "צהריים" : hour < 17 ? "אחה\"צ" : "ערב";

  return (
    <Link
      href={`/calendar?date=${String(appointment.date).slice(0, 10)}&apt=${appointment.id}`}
      className="grid grid-cols-[52px_1fr_auto] sm:grid-cols-[60px_1fr_auto] items-center gap-3 sm:gap-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/40 px-1 rounded-lg transition-colors cursor-pointer"
    >
      {/* Time column */}
      <div className="text-petra-text">
        <div className="text-[13px] sm:text-sm font-bold leading-none">{appointment.startTime}</div>
        <div className="text-[11px] text-petra-muted font-medium mt-1">{tod}</div>
      </div>

      {/* Name + meta */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-petra-text truncate">
            {appointment.customer.name}
          </span>
          {appointment.pet && (
            <span className="text-xs text-petra-muted flex items-center gap-0.5 shrink-0">
              <PawPrint className="w-3 h-3" />
              {appointment.pet.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-petra-muted truncate">
            {itemName}
            {appointment.startTime && dayStr && <span className="text-slate-300 mx-1">·</span>}
            <span className="text-petra-muted">{dayStr}</span>
          </span>
          {typeLabel && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium shrink-0">
              {typeLabel}
            </span>
          )}
        </div>
      </div>

      {/* Status badge */}
      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full whitespace-nowrap shrink-0"
        style={{ background: status.bg, color: status.color }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.color }} />
        <StatusIcon className="w-3 h-3 hidden" />
        {status.label}
      </span>
    </Link>
  );
}
