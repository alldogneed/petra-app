"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  BarChart2,
  Dog,
  Shield,
  GraduationCap,
  Heart,
  Printer,
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  UserCheck,
  Calendar,
  RefreshCw,
  Download,
  MapPin,
  Plus,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { ServiceDogsTabs } from "@/components/service-dogs/ServiceDogsTabs";
import {
  SERVICE_DOG_PHASE_MAP, SERVICE_DOG_PHASE_COLORS,
  RECIPIENT_STATUSES, FUNDING_SOURCE_MAP,
  LOCATION_OPTIONS, LOCATION_MAP,
} from "@/lib/service-dogs";
import { TierGate } from "@/components/paywall/TierGate";

interface ServiceDogSummary {
  id: string;
  phase: string;
  trainingStatus: string;
  certificationDate: string | null;
  certificationExpiry: string | null;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  serviceType: string | null;
  isGovReportPending: boolean;
  currentLocation: string;
  medicalCompliance: { status: string; completedCount: number; totalProtocols: number; overdueCount: number; compliancePercent: number };
  pet: { name: string; breed: string | null };
  activePlacement: { recipientName: string; status: string } | null;
}

interface TrainingProgram {
  id: string;
  name: string;
  status: string;
  totalSessions: number | null;
  dog: { id: string; name: string } | null;
  sessions: { id: string; sessionDate: string; status: string }[];
}

function ServiceDogsReportsPageContent() {
  const { data: dogs = [], isLoading: dogsLoading } = useQuery<ServiceDogSummary[]>({
    queryKey: ["service-dogs"],
    queryFn: () => fetch("/api/service-dogs").then((r) => r.ok ? r.json() : []),
    staleTime: 60_000,
  });

  const { data: programs = [], isLoading: programsLoading } = useQuery<TrainingProgram[]>({
    queryKey: ["training-programs-sd"],
    queryFn: () => fetch("/api/training-programs?trainingType=SERVICE_DOG").then((r) => r.ok ? r.json().then((d: unknown) => Array.isArray(d) ? d : (d as { programs?: TrainingProgram[] }).programs ?? []) : []),
    staleTime: 60_000,
  });

  const { data: recipients = [] } = useQuery<{ id: string; name: string; status: string; fundingSource: string | null; disabilityType: string | null }[]>({
    queryKey: ["service-recipients"],
    queryFn: () => fetch("/api/service-recipients").then((r) => r.ok ? r.json() : []),
    staleTime: 60_000,
  });

  const isLoading = dogsLoading || programsLoading;

  // ── Computed stats ──────────────────────────────────────────────────────────
  const totalDogs = dogs.length;
  const byPhase = dogs.reduce((acc, d) => {
    acc[d.phase] = (acc[d.phase] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const certified = dogs.filter((d) => d.phase === "CERTIFIED");
  const inTraining = dogs.filter((d) => ["IN_TRAINING", "ADVANCED_TRAINING"].includes(d.phase));
  const placed = dogs.filter((d) => d.activePlacement?.status === "ACTIVE");

  const now = new Date();

  // Upcoming renewals (next 90 days)
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const upcomingRenewals: Array<{ dogId: string; dogName: string; label: string; expiry: Date; urgency: "overdue" | "soon" | "ok" }> = [];
  dogs.forEach((dog) => {
    const checks = [
      { label: "תוקף רישיון", date: dog.licenseExpiry ? new Date(dog.licenseExpiry) : null },
      { label: "תוקף הסמכה", date: dog.certificationExpiry ? new Date(dog.certificationExpiry) : null },
    ];
    checks.forEach(({ label, date }) => {
      if (!date) return;
      if (date <= in90Days) {
        upcomingRenewals.push({
          dogId: dog.id,
          dogName: dog.pet.name,
          label,
          expiry: date,
          urgency: date < now ? "overdue" : date < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) ? "soon" : "ok",
        });
      }
    });
  });
  upcomingRenewals.sort((a, b) => a.expiry.getTime() - b.expiry.getTime());

  // Recipients by funding source
  const byFunding = recipients.reduce((acc, r) => {
    const key = r.fundingSource || "UNKNOWN";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Recipients pipeline counts
  const recipientsByStage = RECIPIENT_STATUSES.map((s) => ({
    ...s,
    count: recipients.filter((r) => r.status === s.id).length,
  }));

  return (
    <div className="animate-fade-in space-y-6">
      <ServiceDogsTabs />
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 text-sm text-petra-muted mb-1">
            <Link href="/service-dogs" className="hover:text-foreground">כלבי שירות</Link>
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>דוחות פנימיים</span>
          </div>
          <h1 className="page-title flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-brand-500" />
            דוחות פנימיים — כלבי שירות
          </h1>
          <p className="text-sm text-petra-muted mt-1">סיכום תפעולי · אימונים · שיבוצים</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/service-dogs/export/government"
            download
            className="btn-primary flex items-center gap-2 text-sm px-3 py-2"
            title="דיווח ממשלתי — פורמט משרד החקלאות"
          >
            <Download className="w-4 h-4" />
            דיווח ממשלתי
          </a>
          <a
            href="/api/service-dogs/export"
            download
            className="btn-outline flex items-center gap-2 text-sm px-3 py-2"
          >
            <Download className="w-4 h-4" />
            ייצוא כלבים לאקסל
          </a>
          <a
            href="/api/service-recipients/export"
            download
            className="btn-outline flex items-center gap-2 text-sm px-3 py-2"
          >
            <Download className="w-4 h-4" />
            ייצוא זכאים לאקסל
          </a>
          <a
            href="/api/service-dogs/export/care"
            download
            className="btn-outline flex items-center gap-2 text-sm px-3 py-2"
            title="גיליון 1: האכלות | גיליון 2: תרופות — כלבי שירות בלבד"
          >
            <Download className="w-4 h-4" />
            האכלות ותרופות
          </a>
          <button
            onClick={() => {
              const certRows = certified.map((dog) => `<tr><td>${dog.pet.name}</td><td>${dog.pet.breed || "—"}</td><td>${dog.certificationDate ? new Date(dog.certificationDate).toLocaleDateString("he-IL") : "—"}</td><td>${dog.activePlacement ? `משובץ — ${dog.activePlacement.recipientName}` : "ללא שיבוץ"}</td></tr>`).join("");
              const phaseRows = Object.entries(byPhase).map(([phase, count]) => `<tr><td>${phase}</td><td>${count}</td></tr>`).join("");
              const win = window.open("", "_blank");
              if (!win) return;
              win.document.write(`<html dir="rtl"><head><title>דוחות פנימיים — כלבי שירות</title>
                <style>body{font-family:Arial,sans-serif;padding:32px;direction:rtl}h1{font-size:20px;margin-bottom:4px}h2{font-size:15px;margin:24px 0 10px;border-bottom:2px solid #eee;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px}th,td{border:1px solid #ddd;padding:7px 10px;text-align:right}th{background:#f5f5f5;font-weight:600}tr:nth-child(even){background:#fafafa}.stat{display:inline-block;margin:0 8px 8px 0;padding:6px 14px;border:1px solid #ddd;border-radius:8px;font-size:13px}footer{margin-top:24px;font-size:11px;color:#888;border-top:1px solid #eee;padding-top:8px}</style>
              </head><body>
                <h1>דוחות פנימיים — כלבי שירות</h1>
                <p style="color:#888;font-size:12px">הופק: ${new Date().toLocaleDateString("he-IL")}</p>
                <div>
                  <span class="stat">סה"כ כלבים: <strong>${totalDogs}</strong></span>
                  <span class="stat">מוסמכים: <strong>${certified.length}</strong></span>
                  <span class="stat">באימון: <strong>${inTraining.length}</strong></span>
                  <span class="stat">משובצים: <strong>${placed.length}</strong></span>
                </div>
                <h2>כלבים מוסמכים (${certified.length})</h2>
                <table><thead><tr><th>שם</th><th>גזע</th><th>תאריך הסמכה</th><th>שיבוץ</th></tr></thead><tbody>${certRows}</tbody></table>
                <h2>כלבים לפי שלב</h2>
                <table><thead><tr><th>שלב</th><th>כמות</th></tr></thead><tbody>${phaseRows}</tbody></table>
                <footer>הופק ממערכת Petra · ${new Date().toLocaleDateString("he-IL")}</footer>
              </body></html>`);
              win.document.close();
              win.print();
            }}
            className="btn-secondary flex items-center gap-2 text-sm px-3 py-2 print:hidden"
          >
            <Printer className="w-4 h-4" />
            הדפס דוח
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map((i) => <div key={i} className="card h-24 animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* ── Location Distribution ────────────────────────────────────── */}
          {(() => {
            const byLocation = LOCATION_OPTIONS.map((l) => ({
              ...l,
              count: dogs.filter((d) => (d.currentLocation || "TRAINER") === l.id).length,
            }));
            const awayDogs = dogs.filter((d) => d.currentLocation && d.currentLocation !== "TRAINER");
            return (
              <div className="card p-5">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-500" />
                  מיקום כלבים
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {byLocation.map((l) => (
                    <div key={l.id} className="rounded-xl p-3 text-center border" style={{ backgroundColor: l.color.bg, borderColor: l.color.border }}>
                      <div className="text-2xl font-bold" style={{ color: l.color.text }}>{l.count}</div>
                      <div className="text-xs mt-1" style={{ color: l.color.text }}>{l.label}</div>
                    </div>
                  ))}
                </div>
                {awayDogs.length > 0 && (
                  <div className="divide-y max-h-48 overflow-y-auto">
                    {awayDogs.map((dog) => {
                      const loc = dog.currentLocation || "TRAINER";
                      const locInfo = LOCATION_MAP[loc];
                      const phaseInfo = SERVICE_DOG_PHASE_MAP[dog.phase];
                      return (
                        <Link
                          key={dog.id}
                          href={`/service-dogs/${dog.id}`}
                          className="flex items-center justify-between py-2.5 hover:bg-slate-50 px-1 rounded transition-colors"
                        >
                          <span className="text-sm font-medium">{dog.pet.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-petra-muted">{phaseInfo?.label || dog.phase}</span>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-medium border"
                              style={{ backgroundColor: locInfo?.color.bg, color: locInfo?.color.text, borderColor: locInfo?.color.border }}
                            >
                              {locInfo?.label || loc}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Summary Stats ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-4 text-center">
              <Dog className="w-6 h-6 mx-auto text-brand-500 mb-2" />
              <div className="text-3xl font-bold">{totalDogs}</div>
              <div className="text-xs text-petra-muted mt-1">סה״כ כלבים</div>
            </div>
            <div className="card p-4 text-center">
              <Shield className="w-6 h-6 mx-auto text-emerald-500 mb-2" />
              <div className="text-3xl font-bold text-emerald-600">{certified.length}</div>
              <div className="text-xs text-petra-muted mt-1">מוסמכים</div>
            </div>
            <div className="card p-4 text-center">
              <GraduationCap className="w-6 h-6 mx-auto text-blue-500 mb-2" />
              <div className="text-3xl font-bold text-blue-600">{inTraining.length}</div>
              <div className="text-xs text-petra-muted mt-1">באימון</div>
            </div>
            <div className="card p-4 text-center">
              <Activity className="w-6 h-6 mx-auto text-purple-500 mb-2" />
              <div className="text-3xl font-bold text-purple-600">{placed.length}</div>
              <div className="text-xs text-petra-muted mt-1">שיבוצים פעילים</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Phase Distribution ─────────────────────────────────────── */}
            <div className="card p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Dog className="w-4 h-4 text-brand-500" />
                התפלגות לפי שלב
              </h2>
              <div className="space-y-2">
                {Object.entries(byPhase).map(([phase, count]) => {
                  const info = SERVICE_DOG_PHASE_MAP[phase];
                  const colors = SERVICE_DOG_PHASE_COLORS[phase];
                  const pct = totalDogs > 0 ? Math.round((count / totalDogs) * 100) : 0;
                  return (
                    <div key={phase}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm" style={{ color: colors?.text }}>{info?.label || phase}</span>
                        <span className="text-sm font-bold">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: colors?.text || "#94A3B8" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Certified Dogs Detail ─────────────────────────────────── */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  כלבים מוסמכים ({certified.length})
                </h2>
                <button
                  onClick={() => {
                    const rows = certified.map((dog) => `
                      <tr>
                        <td>${dog.pet.name}</td>
                        <td>${dog.pet.breed || "—"}</td>
                        <td>${dog.certificationDate ? new Date(dog.certificationDate).toLocaleDateString("he-IL") : "—"}</td>
                        <td>${dog.activePlacement ? `משובץ — ${dog.activePlacement.recipientName}` : "ללא שיבוץ"}</td>
                        <td>${dog.licenseNumber || "—"}</td>
                      </tr>`).join("");
                    const win = window.open("", "_blank");
                    if (!win) return;
                    win.document.write(`<html dir="rtl"><head><title>כלבים מוסמכים</title>
                      <style>body{font-family:Arial,sans-serif;padding:32px;direction:rtl}h2{font-size:18px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ddd;padding:8px 10px;text-align:right}th{background:#f5f5f5;font-weight:600}tr:nth-child(even){background:#fafafa}footer{margin-top:24px;font-size:11px;color:#888;border-top:1px solid #eee;padding-top:8px}</style>
                    </head><body>
                      <h2>כלבים מוסמכים (${certified.length})</h2>
                      <table><thead><tr><th>שם הכלב</th><th>גזע</th><th>תאריך הסמכה</th><th>שיבוץ</th><th>מספר רישיון</th></tr></thead>
                      <tbody>${rows}</tbody></table>
                      <footer>הופק ממערכת Petra · ${new Date().toLocaleDateString("he-IL")}</footer>
                    </body></html>`);
                    win.document.close();
                    win.print();
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors print:hidden"
                >
                  <Printer className="w-3.5 h-3.5" />
                  הדפס
                </button>
              </div>
              {certified.length === 0 ? (
                <p className="text-sm text-petra-muted">אין כלבים מוסמכים עדיין</p>
              ) : (
                <div className="divide-y max-h-64 overflow-y-auto">
                  {certified.map((dog) => (
                    <Link
                      key={dog.id}
                      href={`/service-dogs/${dog.id}`}
                      className="flex items-center justify-between py-2.5 hover:bg-slate-50 px-1 rounded transition-colors group"
                    >
                      <div>
                        <p className="text-sm font-medium">{dog.pet.name}</p>
                        <p className="text-xs text-petra-muted mt-0.5">
                          {dog.certificationDate ? `הוסמך ${formatDate(dog.certificationDate)}` : "ללא תאריך הסמכה"}
                        </p>
                      </div>
                      <div className="text-left">
                        {dog.activePlacement ? (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                            משובץ — {dog.activePlacement.recipientName}
                          </span>
                        ) : (
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">ללא שיבוץ</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Upcoming Renewals ────────────────────────────────────── */}
          {upcomingRenewals.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-500" />
                חידושים קרובים — 90 יום
                <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  {upcomingRenewals.length} פריטים
                </span>
              </h2>
              <div className="divide-y max-h-64 overflow-y-auto">
                {upcomingRenewals.map((r, i) => (
                  <Link
                    key={i}
                    href={`/service-dogs/${r.dogId}`}
                    className="flex items-center justify-between py-2.5 hover:bg-slate-50 px-1 rounded transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{r.dogName}</p>
                      <p className="text-xs text-petra-muted">{r.label}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        r.urgency === "overdue" ? "bg-red-100 text-red-700"
                          : r.urgency === "soon" ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                      )}>
                        {r.urgency === "overdue" ? "פג תוקף" : formatDate(r.expiry.toISOString())}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── Recipients Summary ────────────────────────────────────── */}
          {recipients.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pipeline */}
              <div className="card p-5">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-brand-500" />
                  פיפליין זכאים ({recipients.length})
                </h2>
                <div className="space-y-2">
                  {recipientsByStage.filter((s) => s.count > 0).map((stage) => {
                    const pct = recipients.length > 0 ? Math.round((stage.count / recipients.length) * 100) : 0;
                    return (
                      <div key={stage.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", stage.color)}>{stage.label}</span>
                          <span className="text-sm font-bold">{stage.count}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* By funding source */}
              <div className="card p-5">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-brand-500" />
                  לפי מקור מימון
                </h2>
                <div className="space-y-3">
                  {Object.entries(byFunding).map(([source, count]) => {
                    const pct = recipients.length > 0 ? Math.round((count / recipients.length) * 100) : 0;
                    return (
                      <div key={source}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">{FUNDING_SOURCE_MAP[source] || "לא ידוע"}</span>
                          <span className="text-sm font-bold">{count} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ServiceDogsReportsPage() {
  return (
    <TierGate
      feature="service_dogs"
      title="מודול כלבי שירות"
      description="ניהול כלבי שירות, זכאים, שיבוצים ותעודות הסמכה — זמין במנוי Service Dog בלבד."
      upgradeTier="service_dog"
    >
      <ServiceDogsReportsPageContent />
    </TierGate>
  );
}
