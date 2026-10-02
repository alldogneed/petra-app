"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { DashCard, DashCardHeader, DashLink } from "@/components/dashboard/dash-ui";

/**
 * Monthly revenue bars (design "Petra Dashboard"): plain-div bar chart — the last
 * month is solid orange, earlier months light orange, hover darkens a bar and shows
 * a dark tooltip; a dashed slate line marks the monthly target.
 */
export default function RevenueChart({
  data,
  target,
  topService,
  reportsHref,
}: {
  data: { month: string; amount: number }[];
  target: number;
  topService: { name: string; count: number } | null;
  /** Shown as a "לדוחות" link when the viewer may open the reports page. */
  reportsHref?: string;
}) {
  const [hover, setHover] = useState(-1);
  const total = data.reduce((s, d) => s + d.amount, 0);
  const max = Math.max(target || 0, ...data.map((d) => d.amount), 0) * 1.12 || 1;
  const last = data.length - 1;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;

  return (
    <DashCard>
      <DashCardHeader
        title="הכנסות אחרונות"
        titleExtra={reportsHref ? <DashLink href={reportsHref}>לדוחות</DashLink> : undefined}
        subtitle={
          <>
            סה״כ {formatCurrency(total)}
            {topService && (
              <>
                {" · "}שירות מוביל: <span className="text-slate-900 font-medium">{topService.name}</span>
              </>
            )}
          </>
        }
        actions={
          <div className="flex items-center gap-3.5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-[2px] bg-[#F97316]" />
              הכנסות
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 border-t-[1.5px] border-dashed border-[#94A3B8]" />
              יעד
            </span>
          </div>
        }
      />

      <div role="img" aria-label={`גרף הכנסות חודשי. סה"כ ${formatCurrency(total)} בתקופה הנבחרת`}>
        <div className="relative h-[200px] mt-4 border-b border-slate-200" onMouseLeave={() => setHover(-1)}>
          {target > 0 && (
            <div
              className="absolute inset-x-0 border-t-[1.5px] border-dashed border-[#94A3B8] z-[1] pointer-events-none"
              style={{ bottom: pct(target) }}
            >
              <span className="absolute -top-[18px] left-0 text-[11px] text-slate-500 bg-white px-1 tabular-nums">
                יעד {formatCurrency(target)}
              </span>
            </div>
          )}
          <div className="absolute inset-0 flex items-end gap-2 sm:gap-4 px-1">
            {data.map((d, i) => {
              const h = pct(d.amount);
              const fill = hover === i ? "#EA580C" : i === last ? "#F97316" : "#FDBA74";
              return (
                <div
                  key={`${d.month}-${i}`}
                  onMouseEnter={() => setHover(i)}
                  className="flex-1 min-w-0 h-full flex flex-col justify-end items-center relative"
                >
                  {hover === i && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap tabular-nums z-[2]"
                      style={{ bottom: `calc(${h} + 8px)` }}
                    >
                      {d.month} · {formatCurrency(d.amount)}
                    </div>
                  )}
                  <div
                    className="w-full max-w-[40px] rounded-t-[6px] transition-colors duration-150"
                    style={{ height: h, background: fill }}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2 sm:gap-4 px-1 pt-2 pb-2.5">
          {data.map((d, i) => (
            <span key={`${d.month}-${i}`} className="flex-1 min-w-0 text-center text-xs text-slate-500 truncate">
              {d.month}
            </span>
          ))}
        </div>
      </div>
    </DashCard>
  );
}
