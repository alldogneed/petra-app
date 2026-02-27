"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Loader2, Save, CheckCircle } from "lucide-react";

interface AvailabilityRule {
  id?: string;
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

export default function AdminAvailabilityPage() {
  const qc = useQueryClient();
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery<{ rules: AvailabilityRule[] }>({
    queryKey: ["admin", "availability"],
    queryFn: () => fetch("/api/admin/availability").then((r) => r.json()),
  });

  useEffect(() => {
    if (data?.rules) {
      // Ensure all 7 days exist, sorted
      const byDay = new Map(data.rules.map((r) => [r.dayOfWeek, r]));
      const full = Array.from({ length: 7 }, (_, i) =>
        byDay.get(i) ?? {
          dayOfWeek: i,
          isOpen: false,
          openTime: "09:00",
          closeTime: "18:00",
        }
      );
      setRules(full);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (rules: AvailabilityRule[]) =>
      fetch("/api/admin/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "availability"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  function updateRule(idx: number, changes: Partial<AvailabilityRule>) {
    setRules((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...changes };
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#06B6D4" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">שעות פעילות</h1>
        <p className="text-sm mt-1" style={{ color: "#64748B" }}>
          הגדר אילו ימים ושעות העסק פתוח לקבלת הזמנות אונליין
        </p>
      </div>

      {/* Rules table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
        {rules.map((rule, idx) => (
          <div
            key={rule.dayOfWeek}
            className="px-5 py-4 flex items-center gap-4"
            style={{
              borderBottom: idx < rules.length - 1 ? "1px solid #1E1E2E" : undefined,
            }}
          >
            {/* Day name */}
            <div className="w-16 text-sm font-medium text-white flex-shrink-0">
              {DAY_NAMES[rule.dayOfWeek]}
            </div>

            {/* Toggle */}
            <button
              onClick={() => updateRule(idx, { isOpen: !rule.isOpen })}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                rule.isOpen ? "bg-cyan-500" : "bg-slate-700"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                  rule.isOpen ? "left-6" : "left-1"
                }`}
              />
            </button>

            {/* Time pickers */}
            {rule.isOpen ? (
              <div className="flex items-center gap-2 flex-1">
                <select
                  value={rule.openTime}
                  onChange={(e) => updateRule(idx, { openTime: e.target.value })}
                  className="text-sm rounded-lg px-2 py-1.5 focus:outline-none"
                  style={{
                    background: "#0A0A0F",
                    border: "1px solid #1E1E2E",
                    color: "#E2E8F0",
                  }}
                  dir="ltr"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <span className="text-sm" style={{ color: "#64748B" }}>
                  עד
                </span>
                <select
                  value={rule.closeTime}
                  onChange={(e) => updateRule(idx, { closeTime: e.target.value })}
                  className="text-sm rounded-lg px-2 py-1.5 focus:outline-none"
                  style={{
                    background: "#0A0A0F",
                    border: "1px solid #1E1E2E",
                    color: "#E2E8F0",
                  }}
                  dir="ltr"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex-1 text-sm" style={{ color: "#475569" }}>
                סגור
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => mutation.mutate(rules)}
          disabled={mutation.isPending || saved}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-60"
          style={{
            background: saved ? "rgba(16,185,129,0.15)" : "rgba(6,182,212,0.15)",
            color: saved ? "#10B981" : "#06B6D4",
            border: `1px solid ${saved ? "rgba(16,185,129,0.2)" : "rgba(6,182,212,0.2)"}`,
          }}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              שומר...
            </>
          ) : saved ? (
            <>
              <CheckCircle className="w-4 h-4" />
              נשמר בהצלחה!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              שמור שינויים
            </>
          )}
        </button>

        {mutation.isError && (
          <p className="text-sm" style={{ color: "#EF4444" }}>
            שגיאה בשמירה. נסה שוב.
          </p>
        )}
      </div>

      {/* Info note */}
      <div
        className="rounded-xl px-4 py-3 text-xs flex items-start gap-2"
        style={{ background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.1)", color: "#64748B" }}
      >
        <Clock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-cyan-600" />
        <span>
          שעות אלו קובעות מתי לקוחות יכולים לבצע הזמנות אונליין. לחסימת תאריכים ספציפיים, השתמש במנהל החסימות.
        </span>
      </div>
    </div>
  );
}
