"use client";
import Link from "next/link";
import { Clock, ArrowLeft, CalendarClock, PhoneCall } from "lucide-react";
import { DashboardStats } from "@/components/dashboard/dashboard-shared";


// ─── Urgent Leads Alert Component ────────────────────────────────────────────

export function TodayFollowUpsWidget({ leads }: { leads: DashboardStats["urgentLeads"] }) {
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
        <Link href="/leads?view=followup" className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1">
          למעקבים
          <ArrowLeft className="w-3 h-3" />
        </Link>
      </div>
      <div className="divide-y divide-slate-50">
        {todayLeads.map((lead) => (
          <div key={lead.id} className="px-5 py-3 flex items-center gap-3 transition-colors hover:bg-slate-50/50">
            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
            <Link href={`/leads?lead=${lead.id}`} className="flex-1 min-w-0 hover:text-brand-600">
              <div className="text-sm font-medium text-petra-text truncate">{lead.name}</div>
              {lead.customer?.name && (
                <div className="text-[11px] text-petra-muted truncate">לקוח: {lead.customer.name}</div>
              )}
            </Link>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                מעקב היום
              </span>
              <Link
                href={`/leads?lead=${lead.id}`}
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

export function UrgentLeadsAlert({ leads }: { leads: DashboardStats["urgentLeads"] }) {
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

              <Link href={`/leads?lead=${lead.id}`} className="flex-1 min-w-0 hover:text-brand-600">
                <div className="text-sm font-medium text-petra-text truncate">
                  {lead.name}
                </div>
                {lead.customer?.name && (
                  <div className="text-[11px] text-petra-muted truncate">
                    לקוח: {lead.customer.name}
                  </div>
                )}
              </Link>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-100 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  עבר: {timeStr}
                </span>

                <Link
                  href={`/leads?lead=${lead.id}`}
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
