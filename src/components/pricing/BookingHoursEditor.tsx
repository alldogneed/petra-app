"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DAY_NAMES_HE,
  formatWeeklyHours,
  hoursFromBusiness,
  type BookingHours,
  type BusinessDayRule,
} from "@/lib/booking-hours";

/**
 * Per-service online-booking hours inside the price-list item form.
 * value null = the item follows the business hours (default).
 */
export function BookingHoursEditor({
  value,
  onChange,
}: {
  value: BookingHours | null;
  onChange: (next: BookingHours | null) => void;
}) {
  const { data: businessRules = [] } = useQuery<BusinessDayRule[]>({
    queryKey: ["booking-availability-rules"],
    queryFn: () =>
      fetch("/api/booking/availability").then((r) => (r.ok ? r.json() : [])),
    staleTime: 60_000,
  });

  const custom = value !== null;
  const businessSummary = businessRules.length ? formatWeeklyHours(hoursFromBusiness(businessRules)) : "";

  const setDay = (dow: number, patch: Partial<BookingHours[number]>) => {
    if (!value) return;
    onChange(value.map((d) => (d.dayOfWeek === dow ? { ...d, ...patch } : d)));
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-petra-text flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-brand-500" />
        שעות זמינות לשירות זה
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "flex-1 rounded-lg border px-3 py-2 text-xs text-right transition-colors",
            !custom ? "border-brand-500 bg-brand-50 text-brand-700" : "border-petra-border bg-white text-petra-text"
          )}
        >
          לפי שעות העסק
        </button>
        <button
          type="button"
          onClick={() => onChange(value ?? hoursFromBusiness(businessRules))}
          className={cn(
            "flex-1 rounded-lg border px-3 py-2 text-xs text-right transition-colors",
            custom ? "border-brand-500 bg-brand-50 text-brand-700" : "border-petra-border bg-white text-petra-text"
          )}
        >
          שעות מיוחדות
        </button>
      </div>

      {!custom && businessSummary && (
        <p className="text-[11px] text-petra-muted">שעות העסק: {businessSummary}</p>
      )}

      {custom && value && (
        <>
          <p className="text-[11px] text-petra-muted">
            לקוחות שמזמינים את השירות הזה אונליין יראו רק את השעות האלה (גם אם הן רחבות משעות העסק). חסימות, הפסקות ותורים קיימים עדיין נחסמים.
          </p>
          <div className="space-y-1.5">
            {value.map((d) => (
              <div key={d.dayOfWeek} className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 w-16 flex-shrink-0 text-xs text-petra-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={d.isOpen}
                    onChange={(e) => setDay(d.dayOfWeek, { isOpen: e.target.checked })}
                    className="accent-brand-500"
                  />
                  {DAY_NAMES_HE[d.dayOfWeek]}
                </label>
                {d.isOpen ? (
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 flex-1 min-w-0" dir="ltr">
                    <input
                      type="time"
                      step={900}
                      value={d.openTime}
                      onChange={(e) => setDay(d.dayOfWeek, { openTime: e.target.value })}
                      className="input bg-white py-1 px-1.5 text-xs w-full min-w-0"
                      aria-label={`שעת פתיחה ${DAY_NAMES_HE[d.dayOfWeek]}`}
                    />
                    <span className="text-petra-muted text-xs">–</span>
                    <input
                      type="time"
                      step={900}
                      value={d.closeTime}
                      onChange={(e) => setDay(d.dayOfWeek, { closeTime: e.target.value })}
                      className="input bg-white py-1 px-1.5 text-xs w-full min-w-0"
                      aria-label={`שעת סיום ${DAY_NAMES_HE[d.dayOfWeek]}`}
                    />
                  </div>
                ) : (
                  <span className="text-xs text-petra-muted">סגור</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Client-side check before submit — mirrors normalizeBookingHours' rules. */
export function bookingHoursProblem(value: BookingHours | null): string | null {
  if (!value) return null;
  for (const d of value) {
    if (!d.isOpen) continue;
    if (!d.openTime || !d.closeTime) return `חסרה שעה ביום ${DAY_NAMES_HE[d.dayOfWeek]}`;
    if (d.openTime >= d.closeTime) return `ביום ${DAY_NAMES_HE[d.dayOfWeek]} שעת הסיום חייבת להיות אחרי שעת ההתחלה`;
  }
  if (!value.some((d) => d.isOpen)) return "בחרו לפחות יום אחד פתוח, או חזרו ל\"לפי שעות העסק\"";
  return null;
}
