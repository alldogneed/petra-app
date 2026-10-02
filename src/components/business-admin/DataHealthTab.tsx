"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Info,
  Lightbulb,
} from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import {
  healthVerdict,
  type DataHealthCheck,
  type DataHealthReport,
  type DataHealthSeverity,
} from "@/lib/data-health";

const SEVERITY_META: Record<DataHealthSeverity, { label: string; badge: string; icon: typeof AlertTriangle; iconColor: string }> = {
  high: { label: "חמור", badge: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle, iconColor: "text-red-500" },
  medium: { label: "בינוני", badge: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertCircle, iconColor: "text-amber-500" },
  low: { label: "נמוך", badge: "bg-slate-50 text-slate-600 border-slate-200", icon: Info, iconColor: "text-slate-400" },
};

const TONE_COLOR = { good: "#10B981", fair: "#F59E0B", poor: "#EF4444" } as const;

async function fetchHealth(): Promise<DataHealthReport> {
  const res = await fetch("/api/business-admin/data-health");
  if (!res.ok) throw new Error("שגיאה בטעינת בריאות הנתונים");
  return res.json();
}

function ScoreRing({ score }: { score: number }) {
  const verdict = healthVerdict(score);
  const color = TONE_COLOR[verdict.tone];
  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-24 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#E2E8F0" strokeWidth="9" />
          <circle
            cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-900 leading-none">{score}</span>
          <span className="text-[10px] text-petra-muted mt-0.5">מתוך 100</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-petra-muted">ציון בריאות הנתונים</p>
        <p className="text-base font-bold" style={{ color }}>{verdict.label}</p>
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: DataHealthCheck }) {
  const [open, setOpen] = useState(false);
  const ok = check.count === 0;

  if (ok) {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
        <span className="text-sm text-slate-700 flex-1 min-w-0 truncate">{check.title}</span>
        <span className="text-xs font-medium text-emerald-600 flex-shrink-0">תקין ✓</span>
      </div>
    );
  }

  const meta = SEVERITY_META[check.severity];
  const Icon = meta.icon;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-slate-50 transition-colors"
        aria-expanded={open}
      >
        <Icon className={`w-5 h-5 flex-shrink-0 ${meta.iconColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800">{check.title}</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded border ${meta.badge}`}>{meta.label}</span>
          </div>
          <p className="text-xs text-petra-muted mt-0.5 line-clamp-2">{check.description}</p>
        </div>
        <span className="text-sm font-bold text-slate-900 bg-slate-100 rounded-full px-2.5 py-0.5 flex-shrink-0">
          {check.count.toLocaleString("he-IL")}
        </span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-start gap-2 text-xs text-slate-600 bg-blue-50 border border-blue-100 rounded-lg p-2.5">
            <Lightbulb className="w-4 h-4 text-blue-500 flex-shrink-0 mt-px" />
            <span>{check.fixHint}</span>
          </div>
          <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
            {check.items.map((item) => (
              <li key={`${check.key}-${item.id}`}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate">{item.label}</p>
                    {item.sublabel && <p className="text-xs text-petra-muted truncate">{item.sublabel}</p>}
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
          {check.count > check.items.length && (
            <p className="text-xs text-petra-muted">
              מוצגים {check.items.length} מתוך {check.count.toLocaleString("he-IL")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function DataHealthTab() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<DataHealthReport>({
    queryKey: ["ba-data-health"],
    queryFn: fetchHealth,
    staleTime: 60_000,
  });

  if (isLoading) return <PetraLoader />;

  if (isError || !data) {
    return (
      <div className="card p-6 text-center space-y-3">
        <p className="text-sm text-slate-600">לא הצלחנו לטעון את בדיקות הנתונים.</p>
        <button onClick={() => refetch()} className="btn-secondary text-sm">נסו שוב</button>
      </div>
    );
  }

  const failing = data.checks.filter((c) => c.count > 0);
  const passing = data.checks.filter((c) => c.count === 0);
  const generated = new Date(data.generatedAt).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="space-y-4">
      <div className="card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <ScoreRing score={data.score} />
        <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
          <p className="text-xs text-petra-muted">
            {failing.length ? `${failing.length} בדיקות דורשות טיפול` : "כל הבדיקות עברו"} · עודכן {generated}
          </p>
          <button
            onClick={() => refetch()}
            className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5"
            disabled={isFetching}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            בדוק שוב
          </button>
        </div>
      </div>

      {failing.length > 0 && (
        <div className="card p-0 overflow-hidden divide-y divide-slate-100">
          {failing.map((c) => <CheckRow key={c.key} check={c} />)}
        </div>
      )}

      {passing.length > 0 && (
        <div className="card p-0 overflow-hidden divide-y divide-slate-100">
          {passing.map((c) => <CheckRow key={c.key} check={c} />)}
        </div>
      )}
    </div>
  );
}
