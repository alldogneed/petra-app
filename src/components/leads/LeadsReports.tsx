"use client";

import { useMemo, useState } from "react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown, Trophy, XCircle, Clock, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { LOST_REASON_CODES, LEAD_SOURCES } from "@/lib/constants";

interface Lead {
    id: string;
    name: string;
    source: string;
    stage: string;
    createdAt: string;
    lastContactedAt: string | null;
    wonAt: string | null;
    lostAt: string | null;
    lostReasonCode: string | null;
    lostReasonText: string | null;
    callLogs?: { id: string; createdAt: string }[];
}

interface LeadStage {
    id: string;
    name: string;
    color: string;
    isWon: boolean;
    isLost: boolean;
    sortOrder: number;
}

interface LeadsReportsProps {
    leads: Lead[];
    stages: LeadStage[];
}

const CHART_COLORS = ["#6366F1", "#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899"];

type DateRange = "30d" | "90d" | "180d" | "365d" | "all";

const DATE_RANGES: { id: DateRange; label: string }[] = [
    { id: "30d", label: "30 יום" },
    { id: "90d", label: "90 יום" },
    { id: "180d", label: "חצי שנה" },
    { id: "365d", label: "שנה" },
    { id: "all", label: "הכל" },
];

function getStartDate(range: DateRange): Date | null {
    if (range === "all") return null;
    const days = parseInt(range);
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
}

function kpiCard(label: string, value: string | number, sub: string, icon: React.ReactNode, color: string) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-petra-muted">{label}</span>
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", color)}>
                    {icon}
                </div>
            </div>
            <p className="text-2xl font-bold text-petra-text">{value}</p>
            <p className="text-xs text-petra-muted">{sub}</p>
        </div>
    );
}

export function LeadsReports({ leads, stages }: LeadsReportsProps) {
    const [range, setRange] = useState<DateRange>("all");

    const wonStage = stages.find(s => s.isWon);
    const lostStage = stages.find(s => s.isLost);
    const activeStages = stages.filter(s => !s.isWon && !s.isLost).sort((a, b) => a.sortOrder - b.sortOrder);

    const startDate = getStartDate(range);

    const filteredLeads = useMemo(() =>
        startDate
            ? leads.filter(l => new Date(l.createdAt) >= startDate)
            : leads,
        [leads, startDate]
    );

    // ── KPI calculations ────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const total = filteredLeads.length;
        const won = filteredLeads.filter(l => wonStage && l.stage === wonStage.id).length;
        const lost = filteredLeads.filter(l => lostStage && l.stage === lostStage.id).length;
        const active = total - won - lost;
        const conversionRate = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0;
        const lostRate = (won + lost) > 0 ? Math.round((lost / (won + lost)) * 100) : 0;

        // Average days to close (won leads only)
        const wonLeads = filteredLeads.filter(l => wonStage && l.stage === wonStage.id && l.wonAt);
        const avgDaysToClose = wonLeads.length > 0
            ? Math.round(wonLeads.reduce((sum, l) => {
                const diff = (new Date(l.wonAt!).getTime() - new Date(l.createdAt).getTime()) / (1000 * 60 * 60 * 24);
                return sum + diff;
            }, 0) / wonLeads.length)
            : null;

        // Average call logs per lead
        const avgCallLogs = total > 0
            ? (filteredLeads.reduce((sum, l) => sum + (l.callLogs?.length ?? 0), 0) / total).toFixed(1)
            : "0";

        return { total, won, lost, active, conversionRate, lostRate, avgDaysToClose, avgCallLogs };
    }, [filteredLeads, wonStage, lostStage]);

    // ── Monthly trend (created + won per month) ──────────────────────────
    const monthlyTrend = useMemo(() => {
        const map: Record<string, { month: string; created: number; won: number; lost: number }> = {};
        const fmt = (d: string) => {
            const dt = new Date(d);
            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
        };
        const labelFmt = (key: string) => {
            const [y, m] = key.split("-");
            const months = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];
            return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
        };

        filteredLeads.forEach(l => {
            const key = fmt(l.createdAt);
            if (!map[key]) map[key] = { month: labelFmt(key), created: 0, won: 0, lost: 0 };
            map[key].created++;
            if (wonStage && l.stage === wonStage.id && l.wonAt) {
                const wKey = fmt(l.wonAt);
                if (!map[wKey]) map[wKey] = { month: labelFmt(wKey), created: 0, won: 0, lost: 0 };
                map[wKey].won++;
            }
            if (lostStage && l.stage === lostStage.id && l.lostAt) {
                const lKey = fmt(l.lostAt);
                if (!map[lKey]) map[lKey] = { month: labelFmt(lKey), created: 0, won: 0, lost: 0 };
                map[lKey].lost++;
            }
        });

        return Object.entries(map)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, v]) => v);
    }, [filteredLeads, wonStage, lostStage]);

    // ── Funnel data (stage breakdown) ────────────────────────────────────
    const funnelData = useMemo(() => {
        const allOrderedStages = [
            ...activeStages,
            ...(wonStage ? [wonStage] : []),
            ...(lostStage ? [lostStage] : []),
        ];
        return allOrderedStages.map(s => ({
            name: s.name,
            count: filteredLeads.filter(l => l.stage === s.id).length,
            color: s.color,
        })).filter(s => s.count > 0);
    }, [filteredLeads, activeStages, wonStage, lostStage]);

    // ── Source breakdown ─────────────────────────────────────────────────
    const sourceData = useMemo(() => {
        const map: Record<string, { total: number; won: number }> = {};
        filteredLeads.forEach(l => {
            if (!map[l.source]) map[l.source] = { total: 0, won: 0 };
            map[l.source].total++;
            if (wonStage && l.stage === wonStage.id) map[l.source].won++;
        });
        return Object.entries(map)
            .map(([id, v]) => ({
                name: LEAD_SOURCES.find(s => s.id === id)?.label ?? id,
                total: v.total,
                won: v.won,
                rate: v.total > 0 ? Math.round((v.won / v.total) * 100) : 0,
            }))
            .sort((a, b) => b.total - a.total);
    }, [filteredLeads, wonStage]);

    // ── Lost reasons breakdown ────────────────────────────────────────────
    const lostReasonData = useMemo(() => {
        const map: Record<string, number> = {};
        filteredLeads
            .filter(l => lostStage && l.stage === lostStage.id)
            .forEach(l => {
                const key = l.lostReasonCode
                    ? (LOST_REASON_CODES.find(r => r.id === l.lostReasonCode)?.label ?? l.lostReasonCode)
                    : (l.lostReasonText ?? "ללא סיבה");
                map[key] = (map[key] || 0) + 1;
            });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredLeads, lostStage]);

    // ── Stage transition log (simplified funnel bar) ─────────────────────
    const stageProgressData = useMemo(() => {
        return activeStages.map((s, idx) => {
            const atStage = filteredLeads.filter(l => l.stage === s.id).length;
            const passedThrough = filteredLeads.filter(l => {
                // estimate: leads in later stages + won + this stage
                const stageIndex = activeStages.findIndex(st => st.id === l.stage);
                const wonOrLost = (wonStage && l.stage === wonStage.id) || (lostStage && l.stage === lostStage.id);
                return stageIndex > idx || wonOrLost;
            }).length;
            return {
                stage: s.name,
                color: s.color,
                active: atStage,
                passed: passedThrough,
                total: atStage + passedThrough,
            };
        });
    }, [filteredLeads, activeStages, wonStage, lostStage]);

    const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
                <p className="font-semibold text-petra-text mb-1">{label}</p>
                {payload.map((p, i) => (
                    <p key={i} style={{ color: p.color }} className="text-xs">
                        {p.name}: <span className="font-bold">{p.value}</span>
                    </p>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Date range filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                {DATE_RANGES.map(r => (
                    <button
                        key={r.id}
                        onClick={() => setRange(r.id)}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                            range === r.id ? "bg-brand-500 text-white" : "bg-slate-100 text-petra-muted hover:bg-slate-200"
                        )}
                    >
                        {r.label}
                    </button>
                ))}
                <span className="text-xs text-petra-muted mr-2">
                    ({filteredLeads.length} לידים)
                </span>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {kpiCard("סה\"כ לידים", kpis.total, "בתקופה הנבחרת",
                    <Users className="w-4 h-4 text-brand-600" />, "bg-brand-50")}
                {kpiCard("שיעור סגירה", `${kpis.conversionRate}%`, `${kpis.won} נסגרו מתוך ${kpis.won + kpis.lost}`,
                    <Trophy className="w-4 h-4 text-green-600" />, "bg-green-50")}
                {kpiCard("שיעור אובדן", `${kpis.lostRate}%`, `${kpis.lost} לידים אבדו`,
                    <XCircle className="w-4 h-4 text-red-500" />, "bg-red-50")}
                {kpis.avgDaysToClose !== null
                    ? kpiCard("זמן סגירה ממוצע", `${kpis.avgDaysToClose} ימים`, "מיצירת ליד עד סגירה",
                        <Clock className="w-4 h-4 text-amber-500" />, "bg-amber-50")
                    : kpiCard("בתהליך פעיל", kpis.active, "לידים פתוחים",
                        <Target className="w-4 h-4 text-violet-500" />, "bg-violet-50")}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Monthly Trend Chart */}
                {monthlyTrend.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <h3 className="font-semibold text-petra-text text-sm mb-4 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-brand-500" />
                            מגמה חודשית — לידים ונסגרים
                        </h3>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={monthlyTrend} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="created" name="נוצרו" fill="#6366F1" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="won" name="נסגרו" fill="#22C55E" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="lost" name="אבדו" fill="#EF4444" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Conversion Rate Over Time */}
                {monthlyTrend.length > 1 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <h3 className="font-semibold text-petra-text text-sm mb-4 flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-green-500" />
                            נפח לידים לאורך זמן
                        </h3>
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={monthlyTrend} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Line type="monotone" dataKey="created" name="נוצרו" stroke="#6366F1" strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="won" name="נסגרו" stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Stage Funnel */}
                {stageProgressData.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <h3 className="font-semibold text-petra-text text-sm mb-4 flex items-center gap-2">
                            <Target className="w-4 h-4 text-violet-500" />
                             משפך מכירות — לידים לפי שלב
                        </h3>
                        <div className="space-y-2">
                            {funnelData.map((s) => {
                                const max = Math.max(...funnelData.map(x => x.count), 1);
                                const pct = Math.round((s.count / max) * 100);
                                return (
                                    <div key={s.name} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-medium text-petra-text">{s.name}</span>
                                            <span className="font-bold text-petra-text">{s.count}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-5">
                                            <div
                                                className="h-5 rounded-full flex items-center justify-end px-2 transition-all"
                                                style={{ width: `${Math.max(pct, s.count > 0 ? 8 : 0)}%`, backgroundColor: s.color }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Stage transition log */}
                        {stageProgressData.some(s => s.passed > 0) && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <p className="text-xs font-semibold text-petra-muted mb-2">מעברים בין שלבים (מצטבר)</p>
                                <div className="space-y-1.5">
                                    {stageProgressData.map((s, i) => {
                                        const convPct = s.total > 0 ? Math.round((s.passed / s.total) * 100) : 0;
                                        return (
                                            <div key={i} className="flex items-center gap-2 text-xs">
                                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                                                <span className="text-petra-muted w-24 truncate">{s.stage}</span>
                                                <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                                                    <div
                                                        className="h-1.5 rounded-full"
                                                        style={{ width: `${convPct}%`, backgroundColor: s.color }}
                                                    />
                                                </div>
                                                <span className="text-petra-muted w-12 text-left">{convPct}% עברו</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Source Breakdown */}
                {sourceData.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <h3 className="font-semibold text-petra-text text-sm mb-4">פילוח לפי מקור</h3>
                        <div className="space-y-3">
                            {sourceData.map((s, i) => (
                                <div key={s.name} className="flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                    <span className="text-sm text-petra-text w-24 truncate">{s.name}</span>
                                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                                        <div
                                            className="h-2 rounded-full"
                                            style={{
                                                width: `${Math.round((s.total / filteredLeads.length) * 100)}%`,
                                                backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                                            }}
                                        />
                                    </div>
                                    <span className="text-xs font-bold text-petra-text w-6 text-left">{s.total}</span>
                                    <span className={cn(
                                        "text-xs font-semibold px-1.5 py-0.5 rounded-full w-12 text-center",
                                        s.rate >= 50 ? "bg-green-100 text-green-700" : s.rate >= 25 ? "bg-amber-100 text-amber-700" : "bg-red-50 text-red-600"
                                    )}>
                                        {s.rate}% ✓
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Lost Reasons */}
                {lostReasonData.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-5 col-span-1 lg:col-span-2">
                        <h3 className="font-semibold text-petra-text text-sm mb-4 flex items-center gap-2">
                            <XCircle className="w-4 h-4 text-red-500" />
                            סיבות אובדן לידים
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <ResponsiveContainer width="100%" height={180}>
                                <PieChart>
                                    <Pie
                                        data={lostReasonData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={75}
                                        paddingAngle={3}
                                        dataKey="value"
                                    >
                                        {lostReasonData.map((_, i) => (
                                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => [`${value} לידים`, ""]} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="space-y-2 flex flex-col justify-center">
                                {lostReasonData.map((r, i) => (
                                    <div key={r.name} className="flex items-center gap-2 text-sm">
                                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                        <span className="text-petra-text flex-1 truncate">{r.name}</span>
                                        <span className="font-bold text-petra-text">{r.value}</span>
                                        <span className="text-xs text-petra-muted">
                                            ({Math.round((r.value / kpis.lost) * 100)}%)
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Summary insight */}
            <div className="bg-gradient-to-l from-brand-50 to-violet-50 rounded-xl border border-brand-100 p-4">
                <h3 className="font-semibold text-petra-text text-sm mb-2">תובנות מרכזיות</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                    {kpis.conversionRate > 0 && (
                        <p>• שיעור המרה של <strong className="text-petra-text">{kpis.conversionRate}%</strong> — {kpis.conversionRate >= 50 ? "מעל ממוצע, מצוין!" : "יש מקום לשיפור"}</p>
                    )}
                    {kpis.avgDaysToClose !== null && (
                        <p>• ממוצע <strong className="text-petra-text">{kpis.avgDaysToClose} ימים</strong> לסגירת עסקה</p>
                    )}
                    {sourceData[0] && (
                        <p>• מקור מוביל: <strong className="text-petra-text">{sourceData[0].name}</strong> ({sourceData[0].total} לידים, {sourceData[0].rate}% המרה)</p>
                    )}
                    {lostReasonData[0] && (
                        <p>• סיבת אובדן נפוצה: <strong className="text-petra-text">{lostReasonData[0].name}</strong> ({lostReasonData[0].value} מקרים)</p>
                    )}
                    {kpis.active > 0 && (
                        <p>• <strong className="text-petra-text">{kpis.active} לידים</strong> פעילים בצינור המכירות</p>
                    )}
                    <p>• {kpis.avgCallLogs} שיחות תועדו בממוצע לליד</p>
                </div>
            </div>
        </div>
    );
}
