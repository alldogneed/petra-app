"use client";

import { Bell, Clock, X, Calendar } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  status: string;
  customer: { name: string };
  pet: { name: string };
  service?: { name: string; color: string } | null;
}

interface DashboardData {
  upcomingAppointments: Appointment[];
  todayAppointments: number;
}

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isTomorrow(dateStr: string) {
  const d = new Date(dateStr);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate()
  );
}

function getDateLabel(dateStr: string) {
  if (isToday(dateStr)) return "היום";
  if (isTomorrow(dateStr)) return "מחר";
  const d = new Date(dateStr);
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard");
      if (!r.ok) return { upcomingAppointments: [], todayAppointments: 0 };
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const upcoming = data?.upcomingAppointments ?? [];
  const todayCount = upcoming.filter((a) => isToday(a.date)).length;
  const badgeCount = upcoming.length;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Group by date label
  const grouped: Record<string, Appointment[]> = {};
  for (const appt of upcoming) {
    const label = getDateLabel(appt.date);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(appt);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all duration-150"
        aria-label="התראות"
      >
        <Bell className="w-[18px] h-[18px]" />
        {badgeCount > 0 && (
          <span
            className="absolute top-1 left-1 min-w-[16px] h-4 px-0.5 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white"
            style={{ background: "#F97316", lineHeight: 1 }}
          >
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 top-11 w-80 rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50"
          style={{ background: "#fff" }}
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div>
              <p className="text-[14px] font-semibold text-slate-800">התראות</p>
              {todayCount > 0 && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {todayCount} תורים היום
                </p>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[400px] overflow-y-auto">
            {upcoming.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Calendar className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">אין תורים קרובים</p>
              </div>
            ) : (
              Object.entries(grouped).map(([label, appts]) => (
                <div key={label}>
                  {/* Date group header */}
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      {label}
                    </span>
                  </div>
                  {appts.map((appt) => (
                    <div
                      key={appt.id}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 cursor-default"
                    >
                      {/* Color dot / service indicator */}
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{
                          background: appt.service?.color ?? "#F97316",
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-slate-800 truncate">
                          {appt.customer.name}
                          {appt.pet && (
                            <span className="text-slate-400 font-normal">
                              {" "}· {appt.pet.name}
                            </span>
                          )}
                        </p>
                        {appt.service && (
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {appt.service.name}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="text-[11px] text-slate-400">
                            {appt.startTime}
                            {appt.endTime ? ` – ${appt.endTime}` : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {upcoming.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
              <a
                href="/calendar"
                className="text-[12px] font-medium text-orange-500 hover:text-orange-600 transition-colors"
                onClick={() => setOpen(false)}
              >
                פתח יומן ←
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
