"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  BarChart2,
  Dog,
  Shield,
  GraduationCap,
  Heart,
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { ServiceDogsTabs } from "@/components/service-dogs/ServiceDogsTabs";
import { SERVICE_DOG_PHASE_MAP, SERVICE_DOG_PHASE_COLORS } from "@/lib/service-dogs";

interface ServiceDogSummary {
  id: string;
  phase: string;
  trainingStatus: string;
  certificationDate: string | null;
  serviceType: string | null;
  isGovReportPending: boolean;
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

export default function ServiceDogsReportsPage() {
  const { data: dogs = [], isLoading: dogsLoading } = useQuery<ServiceDogSummary[]>({
    queryKey: ["service-dogs"],
    queryFn: () => fetch("/api/service-dogs").then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: programs = [], isLoading: programsLoading } = useQuery<TrainingProgram[]>({
    queryKey: ["training-programs-sd"],
    queryFn: () => fetch("/api/training-programs?trainingType=SERVICE_DOG").then((r) => r.json()).then((d) => Array.isArray(d) ? d : d.programs ?? []),
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

  const medicalRedDogs = dogs.filter((d) => d.medicalCompliance.status === "red");
  const medicalAmberDogs = dogs.filter((d) => d.medicalCompliance.status === "amber");

  const avgCompliance = totalDogs > 0
    ? Math.round(dogs.reduce((sum, d) => sum + d.medicalCompliance.compliancePercent, 0) / totalDogs)
    : 0;

  const activePrograms = programs.filter((p) => p.status === "ACTIVE");
  const now = new Date();
  const ago14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const stalePrograms = activePrograms.filter((p) => {
    const lastDone = p.sessions.filter((s) => s.status === "COMPLETED").sort((a, b) =>
      new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()
    )[0];
    return !lastDone || new Date(lastDone.sessionDate) < ago14;
  });

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
          <p className="text-sm text-petra-muted mt-1">סיכום תפעולי · ציות רפואי · אימונים · שיבוצים</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map((i) => <div key={i} className="card h-24 animate-pulse" />)}
        </div>
      ) : (
        <>
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

            {/* ── Medical Compliance ─────────────────────────────────────── */}
            <div className="card p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-500" />
                ציות רפואי
              </h2>
              <div className="flex items-center gap-4 mb-4">
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-4",
                  avgCompliance >= 80 ? "border-emerald-400 text-emerald-700 bg-emerald-50"
                    : avgCompliance >= 60 ? "border-amber-400 text-amber-700 bg-amber-50"
                    : "border-red-400 text-red-700 bg-red-50"
                )}>
                  {avgCompliance}%
                </div>
                <div>
                  <p className="font-semibold">ציות ממוצע</p>
                  <p className="text-xs text-petra-muted mt-0.5">מכלל הפרוטוקולים הרפואיים</p>
                </div>
              </div>
              <div className="space-y-2">
                {medicalRedDogs.length > 0 && (
                  <div className="flex items-center justify-between p-2.5 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="text-sm text-red-700">פרוטוקולים באיחור</span>
                    </div>
                    <span className="font-bold text-red-600">{medicalRedDogs.length} כלבים</span>
                  </div>
                )}
                {medicalAmberDogs.length > 0 && (
                  <div className="flex items-center justify-between p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className="text-sm text-amber-700">פרוטוקולים ממתינים</span>
                    </div>
                    <span className="font-bold text-amber-600">{medicalAmberDogs.length} כלבים</span>
                  </div>
                )}
                {medicalRedDogs.length === 0 && medicalAmberDogs.length === 0 && (
                  <div className="flex items-center gap-2 p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm text-emerald-700">כל הפרוטוקולים תקינים</span>
                  </div>
                )}
              </div>
              {/* Per-dog breakdown */}
              <div className="mt-4 divide-y max-h-48 overflow-y-auto">
                {dogs.map((dog) => (
                  <Link
                    key={dog.id}
                    href={`/service-dogs/${dog.id}?tab=medical`}
                    className="flex items-center justify-between py-2 hover:bg-slate-50 px-1 rounded transition-colors"
                  >
                    <span className="text-sm">{dog.pet.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-petra-muted">
                        {dog.medicalCompliance.completedCount}/{dog.medicalCompliance.totalProtocols}
                      </span>
                      <span className={cn(
                        "text-xs font-bold px-1.5 py-0.5 rounded-full",
                        dog.medicalCompliance.status === "green" ? "bg-emerald-100 text-emerald-700"
                          : dog.medicalCompliance.status === "amber" ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      )}>
                        {dog.medicalCompliance.compliancePercent}%
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* ── Training Progress ─────────────────────────────────────── */}
            <div className="card p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-brand-500" />
                התקדמות אימונים
              </h2>
              {activePrograms.length === 0 ? (
                <p className="text-sm text-petra-muted">אין תוכניות אימון פעילות</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {activePrograms.map((prog) => {
                    const completedSessions = prog.sessions.filter((s) => s.status === "COMPLETED").length;
                    const totalSessions = prog.totalSessions ?? 0;
                    const pct = totalSessions > 0
                      ? Math.min(100, Math.round((completedSessions / totalSessions) * 100))
                      : 0;
                    const isStale = stalePrograms.some((s) => s.id === prog.id);
                    return (
                      <div key={prog.id} className={cn("p-3 rounded-xl border", isStale ? "border-amber-200 bg-amber-50" : "border-petra-border bg-slate-50/40")}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">
                            {prog.dog?.name || prog.name}
                          </span>
                          <span className="text-xs text-petra-muted">{completedSessions} / {totalSessions || "—"} מפגשים</span>
                        </div>
                        <div className="h-2 bg-white border rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-brand-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {isStale && (
                          <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> ללא אימון ב-14 ימים האחרונים
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Certified Dogs Detail ─────────────────────────────────── */}
            <div className="card p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-500" />
                כלבים מוסמכים ({certified.length})
              </h2>
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
        </>
      )}
    </div>
  );
}
