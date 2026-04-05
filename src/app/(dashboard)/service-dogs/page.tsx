"use client";
import { PageTitle } from "@/components/ui/PageTitle";

import { TierGate } from "@/components/paywall/TierGate";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/providers/auth-provider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Shield,
  Dog,
  CheckCircle2,
  AlertTriangle,
  Activity,
  ChevronLeft,
  Clock,
  Heart,
  UserCheck,
  CreditCard,
  ArrowLeft,
  Plus,
  X,
  GraduationCap,
  Star,
  Syringe,
  Dumbbell,
  FileWarning,
  ChevronDown,
  ChevronUp,
  Bell,
  Check,
  Archive,
  RotateCcw,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { ServiceDogsTabs } from "@/components/service-dogs/ServiceDogsTabs";
import {
  SERVICE_DOG_PHASE_MAP,
  SERVICE_DOG_PHASE_COLORS,
  COMPLIANCE_EVENT_MAP,
  DISABILITY_TYPES,
  RECIPIENT_STATUSES,
  RECIPIENT_STATUS_MAP,
  FUNDING_SOURCE_MAP,
} from "@/lib/service-dogs";
import { toast } from "sonner";

interface ServiceDogSummary {
  id: string;
  phase: string;
  trainingTotalHours: number;
  trainingTargetHours: number;
  trainingStatus: string;
  isGovReportPending: boolean;
  idCardIsActive: boolean;
  pet: { id: string; name: string; breed: string | null };
  medicalCompliance: {
    totalProtocols: number;
    completedCount: number;
    overdueCount: number;
    compliancePercent: number;
    status: "green" | "amber" | "red";
  };
  activePlacement: { id: string; recipientName: string; status: string } | null;
}

interface ComplianceEvent {
  id: string;
  eventType: string;
  eventDescription: string;
  notificationRequired: boolean;
  notificationDue: string | null;
  notificationStatus: string;
  eventAt: string;
}

function ServiceDogsOverviewPageContent() {
  const perms = usePermissions();
  const { user } = useAuth();

  const { data: dogs = [] } = useQuery<ServiceDogSummary[]>({
    queryKey: ["service-dogs"],
    queryFn: () => fetch("/api/service-dogs").then((r) => {
      if (!r.ok) throw new Error("Failed");
      return r.json();
    }),
  });

  const { data: complianceEvents = [] } = useQuery<ComplianceEvent[]>({
    queryKey: ["service-compliance"],
    queryFn: () => fetch("/api/service-compliance").then((r) => {
      if (!r.ok) throw new Error("Failed");
      return r.json();
    }),
  });

  const { data: trainingPrograms = [] } = useQuery<{
    id: string;
    dog: { id: string; name: string };
    sessions: { id: string; sessionDate: string; summary: string | null; rating: number | null; sessionNumber: number | null; status: string }[];
    status: string;
  }[]>({
    queryKey: ["training-programs-service"],
    queryFn: () => fetch("/api/training-programs?trainingType=SERVICE_DOG&status=ACTIVE,PAUSED,COMPLETED").then((r) => {
      if (!r.ok) throw new Error("Failed");
      return r.json();
    }),
  });

  const { data: alertsData } = useQuery<{
    medical: { count: number; items: { id: string; dogId: string; dogName: string; label: string; dueDate: string | null; isOverdue: boolean }[] };
    training: { count: number; items: { id: string; dogId: string; dogName: string; lastSessionDate: string | null; daysSinceLastSession: number | null }[] };
    compliance: { count: number; items: { id: string; dogId: string; dogName: string; eventType: string; eventDescription: string; notificationDue: string | null; isOverdue: boolean }[] };
    total: number;
  }>({
    queryKey: ["sd-alerts"],
    queryFn: () => fetch("/api/service-dogs/alerts").then((r) => r.json()),
    refetchInterval: 5 * 60_000,
    staleTime: 3 * 60_000,
  });

  const { data: recipients = [] } = useQuery<{ id: string; name: string; status: string; fundingSource: string | null }[]>({
    queryKey: ["service-recipients"],
    queryFn: () => fetch("/api/service-recipients").then((r) => r.json()),
    enabled: perms.canSeeRecipientsSensitive,
  });

  // Training stats
  const allSessions = trainingPrograms.flatMap((p) =>
    p.sessions
      .filter((s) => s.status === "COMPLETED")
      .map((s) => ({ ...s, dogName: p.dog.name, dogId: p.dog.id, programId: p.id }))
  );
  const totalSessions = allSessions.length;
  const thisWeek = (() => {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return allSessions.filter((s) => new Date(s.sessionDate) >= weekAgo).length;
  })();
  const recentSessions = [...allSessions]
    .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())
    .slice(0, 8);

  // Stats
  const totalDogs = dogs.length;
  const inTraining = dogs.filter((d) =>
    ["IN_TRAINING", "ADVANCED_TRAINING", "TRAINING", "ADVANCED"].includes(d.phase)
  ).length;
  const certified = dogs.filter((d) => ["CERTIFIED", "PLACEMENT"].includes(d.phase)).length;
  const pendingCert = dogs.filter((d) => d.trainingStatus === "PENDING_CERT").length;
  const complianceAlerts = dogs.filter((d) => d.isGovReportPending).length;
  const activePlacements = dogs.filter((d) => d.activePlacement?.status === "ACTIVE").length;

  // Recipients stats
  const totalRecipients = recipients.length;
  const waitingForMatch = recipients.filter((r) => ["APPROVED", "WAITLIST"].includes(r.status)).length;
  const activeRecipients = recipients.filter((r) => r.status === "ACTIVE").length;

  // Dogs needing attention
  const dogsNeedingAttention = dogs.filter(
    (d) =>
      d.medicalCompliance.status === "red" ||
      d.isGovReportPending ||
      d.trainingStatus === "PENDING_CERT"
  );

  // Pending compliance events (last 10)
  const pendingEvents = complianceEvents
    .filter((e) => e.notificationStatus === "PENDING")
    .slice(0, 8);

  // Persistent dismissed state — survives page refresh, stored in localStorage for 7 days
  const { dismissedIds, dismiss, archive, restore, clearAll } = usePersistentDismissed(user?.businessId ?? null);
  const [showArchive, setShowArchive] = useState(false);

  const visibleDogs = dogsNeedingAttention.filter((d) => !dismissedIds.has(d.id));
  const visibleEvents = pendingEvents.filter((e) => !dismissedIds.has(e.id));

  return (
    <div className="animate-fade-in space-y-6">
      <ServiceDogsTabs />
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Shield className="w-6 h-6 text-brand-500" />
            כלבי שירות — סקירה כללית
          </h1>
          <p className="text-sm text-petra-muted mt-1">
            מרכז הכשרת כלבי שירות · ניהול מקצועי
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
        <StatCard label="סה״כ כלבים" value={totalDogs} icon={Dog} />
        <StatCard label="באימון" value={inTraining} icon={Clock} color="blue" />
        <StatCard label="מוסמכים" value={certified} icon={CheckCircle2} color="emerald" />
        <StatCard label="ממתינים להסמכה" value={pendingCert} icon={CheckCircle2} color="amber" />
        <StatCard label="התראות דיווח" value={complianceAlerts} icon={AlertTriangle} color={complianceAlerts > 0 ? "red" : "emerald"} />
        <StatCard label="שיבוצים פעילים" value={activePlacements} icon={Activity} color="purple" />
        <StatCard label="אימונים השבוע" value={thisWeek} icon={GraduationCap} color="brand" />
        <StatCard label="סה״כ זכאים" value={totalRecipients} icon={UserCheck} />
        <StatCard label="ממתינים לשיבוץ" value={waitingForMatch} icon={UserCheck} color="amber" />
        <StatCard label="זכאים פעילים" value={activeRecipients} icon={UserCheck} color="emerald" />
      </div>


      {/* ── Unified Alerts Widget ─────────────────────────────────────── */}
      {alertsData && alertsData.total > 0 && (
        <AlertsWidget alerts={alertsData} dismissedIds={dismissedIds} onDismiss={dismiss} />
      )}

      {/* Archive button — shown when there are dismissed items */}
      {archive.length > 0 && (
        <button
          type="button"
          onClick={() => setShowArchive(true)}
          className="flex items-center gap-2 text-xs text-petra-muted hover:text-brand-600 transition-colors"
        >
          <Archive className="w-3.5 h-3.5" />
          {archive.length} פריטים מסומנים — הצג ארכיון
        </button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recipients Pipeline Mini-board — hidden from staff */}
        {perms.canSeeRecipientsSensitive && recipients.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-brand-500" />
                פיפליין זכאים
              </h2>
              <Link href="/service-dogs/recipients" className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1">
                ניהול זכאים <ArrowLeft className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-4 overflow-x-auto">
              <div className="flex gap-2 min-w-max">
                {RECIPIENT_STATUSES.map((stage) => {
                  const count = recipients.filter((r) => r.status === stage.id).length;
                  if (count === 0 && stage.id === "CLOSED") return null;
                  return (
                    <Link
                      key={stage.id}
                      href={`/service-dogs/recipients`}
                      className="flex flex-col items-center gap-1 min-w-[68px] p-2 rounded-xl border hover:shadow-sm transition-all"
                      style={{ backgroundColor: stage.kanbanBg }}
                    >
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${stage.color}`}>
                        {stage.label}
                      </span>
                      <span className="text-xl font-bold text-petra-text">{count}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            {/* Funding source breakdown */}
            {(() => {
              const byFunding = recipients.reduce((acc, r) => {
                const key = r.fundingSource || "UNKNOWN";
                acc[key] = (acc[key] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
              return (
                <div className="px-5 pb-4 flex items-center gap-3 flex-wrap">
                  {Object.entries(byFunding).map(([source, count]) => (
                    <span key={source} className="text-xs text-petra-muted">
                      {FUNDING_SOURCE_MAP[source] || "לא ידוע"}: <strong>{count}</strong>
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Dogs Needing Attention */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              דורשים תשומת לב
              {visibleDogs.length > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs font-bold rounded-full px-2 py-0.5">
                  {visibleDogs.length}
                </span>
              )}
            </h2>
            <Link href="/service-dogs/dogs" className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1">
              כל הכלבים <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>

          {visibleDogs.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
              <p className="text-sm text-petra-muted">כל הכלבים תקינים</p>
            </div>
          ) : (
            <div className="divide-y">
              {visibleDogs.map((dog) => {
                const phaseInfo = SERVICE_DOG_PHASE_MAP[dog.phase];
                const phaseColors = SERVICE_DOG_PHASE_COLORS[dog.phase];
                return (
                  <div key={dog.id} className="flex items-center gap-2 px-4 py-3.5 hover:bg-slate-50 transition-colors group">
                    <button
                      type="button"
                      onClick={() => dismiss(dog.id, dog.pet.name, "dog")}
                      className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0 flex items-center justify-center hover:border-emerald-400 hover:bg-emerald-50 transition-all"
                      title="סמן כטופל"
                    />
                    <Link
                      href={`/service-dogs/${dog.id}`}
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: phaseColors?.bg || "#F1F5F9" }}
                      >
                        <Dog className="w-4 h-4" style={{ color: phaseColors?.text || "#475569" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{dog.pet.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-full border"
                            style={{
                              backgroundColor: phaseColors?.bg,
                              color: phaseColors?.text,
                              borderColor: phaseColors?.border,
                            }}
                          >
                            {phaseInfo?.label || dog.phase}
                          </span>
                          {dog.medicalCompliance.status === "red" && (
                            <span className="text-xs text-red-600">
                              {dog.medicalCompliance.overdueCount} פרוטוקולים באיחור
                            </span>
                          )}
                          {dog.trainingStatus === "PENDING_CERT" && (
                            <span className="text-xs text-blue-600 font-medium">מוכן להסמכה</span>
                          )}
                        </div>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-petra-muted group-hover:text-brand-500 transition-colors flex-shrink-0" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Recent Training Sessions */}
      {recentSessions.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-brand-500" />
              אימונים אחרונים
              <span className="bg-brand-100 text-brand-700 text-xs font-bold rounded-full px-2 py-0.5">
                {totalSessions} סה״כ
              </span>
            </h2>
            <Link href="/training" className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1">
              כל תהליכי האילוף <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y">
            {recentSessions.map((session) => (
              <Link
                key={session.id}
                href={`/service-dogs/${session.dogId}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="w-4 h-4 text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-petra-text">{session.dogName}</span>
                    <span className="text-xs text-petra-muted">אימון {session.sessionNumber}</span>
                    {session.rating && (
                      <span className="text-xs text-amber-500 flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-amber-400" />
                        {session.rating}
                      </span>
                    )}
                  </div>
                  {session.summary && (
                    <p className="text-xs text-petra-muted truncate mt-0.5">{session.summary}</p>
                  )}
                </div>
                <span className="text-xs text-petra-muted flex-shrink-0">{formatDate(session.sessionDate)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}


      {/* Phase Distribution */}
      {dogs.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold mb-4">התפלגות לפי שלב</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(
              dogs.reduce((acc, d) => {
                acc[d.phase] = (acc[d.phase] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([phase, count]) => {
              const phaseInfo = SERVICE_DOG_PHASE_MAP[phase];
              const phaseColors = SERVICE_DOG_PHASE_COLORS[phase];
              return (
                <Link
                  key={phase}
                  href={`/service-dogs/dogs?phase=${phase}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all hover:shadow-sm"
                  style={{
                    backgroundColor: phaseColors?.bg || "#F1F5F9",
                    borderColor: phaseColors?.border || "#CBD5E1",
                  }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{ color: phaseColors?.text || "#475569" }}
                  >
                    {phaseInfo?.label || phase}
                  </span>
                  <span
                    className="text-lg font-bold"
                    style={{ color: phaseColors?.text || "#475569" }}
                  >
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Archive modal */}
      {showArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowArchive(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="font-bold flex items-center gap-2">
                <Archive className="w-4 h-4 text-brand-500" />
                ארכיון פריטים מטופלים
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  נקה הכל
                </button>
                <button type="button" onClick={() => setShowArchive(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X className="w-4 h-4 text-petra-muted" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {archive.length === 0 ? (
                <p className="text-center text-petra-muted py-8 text-sm">אין פריטים בארכיון</p>
              ) : (
                <div className="divide-y">
                  {[...archive].reverse().map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{entry.label}</p>
                        <p className="text-xs text-petra-muted mt-0.5">
                          {entry.type === "dog" ? "כלב" : entry.type === "event" ? "דיווח" : "התראה"}
                          {" · "}
                          {new Date(entry.dismissedAt).toLocaleDateString("he-IL", { day: "numeric", month: "long" })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => restore(entry.id)}
                        className="text-xs text-brand-500 hover:text-brand-700 flex items-center gap-1 flex-shrink-0"
                        title="שחזר"
                      >
                        <RotateCcw className="w-3 h-3" />
                        שחזר
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t text-xs text-petra-muted">
              פריטים נשמרים ל-7 ימים ואז נמחקים אוטומטית
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color = "default",
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color?: "default" | "blue" | "emerald" | "amber" | "red" | "purple" | "brand";
}) {
  const colorMap = {
    default: { bg: "bg-slate-50", text: "text-slate-600", val: "text-slate-900" },
    blue: { bg: "bg-blue-50", text: "text-blue-600", val: "text-blue-700" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", val: "text-emerald-700" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", val: "text-amber-700" },
    red: { bg: "bg-red-50", text: "text-red-600", val: "text-red-700" },
    purple: { bg: "bg-purple-50", text: "text-purple-600", val: "text-purple-700" },
    brand: { bg: "bg-brand-50", text: "text-brand-600", val: "text-brand-700" },
  };
  const c = colorMap[color];

  return (
    <div className={cn("rounded-xl p-4 border", c.bg)}>
      <div className={cn("flex items-center gap-1.5 text-xs font-medium mb-2", c.text)}>
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className={cn("text-2xl font-bold", c.val)}>{value}</div>
    </div>
  );
}

// ─── Add Recipient Modal ────────────────────────────────────────────────────
function AddRecipientModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [address, setAddress] = useState("");
  const [disabilityType, setDisabilityType] = useState("");
  const [disabilityNotes, setDisabilityNotes] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch("/api/service-recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-recipients"] });
      toast.success("זכאי נוסף בהצלחה");
      onClose();
    },
    onError: () => toast.error("שגיאה בהוספת זכאי"),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-brand-500" />
            הוסף זכאי חדש
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">שם מלא *</label>
            <input type="text" className="input" placeholder="שם ומשפחה" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">טלפון</label>
              <input type="tel" className="input" placeholder="05x-xxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="label">אימייל</label>
              <input type="email" className="input" placeholder="mail@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תעודת זהות</label>
              <input type="text" className="input" placeholder="9 ספרות" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
            </div>
            <div>
              <label className="label">סוג לקות</label>
              <select className="input" value={disabilityType} onChange={(e) => setDisabilityType(e.target.value)}>
                <option value="">לא נבחר</option>
                {DISABILITY_TYPES.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">כתובת</label>
            <input type="text" className="input" placeholder="רחוב, עיר" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <label className="label">פירוט הלקות</label>
            <textarea className="input" rows={2} placeholder="מידע נוסף על הלקות..." value={disabilityNotes} onChange={(e) => setDisabilityNotes(e.target.value)} />
          </div>
          <div>
            <label className="label">הערות</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button
            className="btn-primary flex-1"
            disabled={!name.trim() || mutation.isPending}
            onClick={() => mutation.mutate({ name, phone, email, idNumber, address, disabilityType, disabilityNotes, notes })}
          >
            {mutation.isPending ? "שומר..." : "הוסף זכאי"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Service Dog Modal ──────────────────────────────────────────────────
function AddServiceDogModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [weight, setWeight] = useState("");
  const [microchip, setMicrochip] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [behaviorNotes, setBehaviorNotes] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch("/api/service-dogs/standalone-pet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-dogs"] });
      qc.invalidateQueries({ queryKey: ["training-programs-service"] });
      toast.success("כלב שירות נוסף בהצלחה");
      onClose();
    },
    onError: () => toast.error("שגיאה בהוספת כלב"),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
            <Dog className="w-5 h-5 text-brand-500" />
            הוסף כלב שירות
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3 rounded-xl bg-brand-50 border border-brand-100 text-xs text-brand-700 mb-4">
          כלב זה יופיע בתהליכי אילוף — כלבי שירות ובניהול כלבי שירות. לא ישויך ללקוח.
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">שם הכלב *</label>
            <input type="text" className="input" placeholder="שם הכלב" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">גזע</label>
              <input type="text" className="input" placeholder="גזע..." value={breed} onChange={(e) => setBreed(e.target.value)} />
            </div>
            <div>
              <label className="label">מין</label>
              <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">לא ידוע</option>
                <option value="male">זכר</option>
                <option value="female">נקבה</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תאריך לידה</label>
              <input type="date" lang="he" className="input" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
            <div>
              <label className="label">משקל (ק״ג)</label>
              <input type="number" className="input" placeholder="0.0" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">מיקרוצ׳יפ</label>
            <input type="text" className="input" placeholder="מספר שבב..." value={microchip} onChange={(e) => setMicrochip(e.target.value)} />
          </div>
          <div>
            <label className="label">סוג שירות</label>
            <input type="text" className="input" placeholder="כלב ניידות / פרכוסים / רגשי..." value={serviceType} onChange={(e) => setServiceType(e.target.value)} />
          </div>
          <div>
            <label className="label">הערות רפואיות</label>
            <textarea className="input" rows={2} value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} />
          </div>
          <div>
            <label className="label">הערות התנהגותיות</label>
            <textarea className="input" rows={2} value={behaviorNotes} onChange={(e) => setBehaviorNotes(e.target.value)} />
          </div>
          <div>
            <label className="label">הערות כלליות</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button
            className="btn-primary flex-1"
            disabled={!name.trim() || mutation.isPending}
            onClick={() => mutation.mutate({ name, breed, gender, birthDate, weight, microchip, medicalNotes, behaviorNotes, serviceType, notes })}
          >
            {mutation.isPending ? "שומר..." : "הוסף כלב שירות"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ALERTS WIDGET
// ═══════════════════════════════════════════════════════

// ─── Persistent dismissed alerts hook ────────────────────────────────────────

const DISMISSED_KEY_PREFIX = "sd-alerts-dismissed";
const TTL_DAYS = 7;

type DismissedEntry = {
  id: string;
  type: "dog" | "event" | "alert";
  label: string;
  dismissedAt: string; // ISO string
};

function usePersistentDismissed(businessId: string | null) {
  const [entries, setEntries] = useState<DismissedEntry[]>([]);
  const storageKey = businessId ? `${DISMISSED_KEY_PREFIX}-${businessId}` : DISMISSED_KEY_PREFIX;

  // Load from localStorage on mount (runs only client-side)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed: DismissedEntry[] = JSON.parse(raw);
      const cutoff = Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000;
      const filtered = parsed.filter((e) => new Date(e.dismissedAt).getTime() > cutoff);
      setEntries(filtered);
      // Prune expired entries
      if (filtered.length !== parsed.length) {
        localStorage.setItem(storageKey, JSON.stringify(filtered));
      }
    } catch { /* ignore */ }
  }, [storageKey]);

  const dismissedIds = useMemo(() => new Set(entries.map((e) => e.id)), [entries]);

  const dismiss = useCallback((id: string, label: string, type: DismissedEntry["type"]) => {
    setEntries((prev) => {
      if (prev.some((e) => e.id === id)) return prev;
      const next = [...prev, { id, label, type, dismissedAt: new Date().toISOString() }];
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const restore = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setEntries([]);
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  }, []);

  return { dismissedIds, dismiss, archive: entries, restore, clearAll };
}

// ─── Alerts data types ────────────────────────────────────────────────────────

type AlertsData = {
  medical: { count: number; items: { id: string; dogId: string; dogName: string; label: string; dueDate: string | null; isOverdue: boolean }[] };
  training: { count: number; items: { id: string; dogId: string; dogName: string; lastSessionDate: string | null; daysSinceLastSession: number | null }[] };
  compliance: { count: number; items: { id: string; dogId: string; dogName: string; eventType: string; eventDescription: string; notificationDue: string | null; isOverdue: boolean }[] };
  total: number;
};

function AlertsWidget({
  alerts,
  dismissedIds,
  onDismiss,
}: {
  alerts: AlertsData;
  dismissedIds: Set<string>;
  onDismiss: (id: string, label: string, type: "alert") => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    medical: true,
    training: true,
    compliance: true,
  });

  const toggle = (key: string) => setOpen((p) => ({ ...p, [key]: !p[key] }));
  const dismiss = (id: string, label: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDismiss(id, label, "alert");
  };

  const overdueCount =
    alerts.medical.items.filter((i) => i.isOverdue && !dismissedIds.has(i.id)).length;

  const activeTotal =
    alerts.medical.items.filter((i) => !dismissedIds.has(i.id)).length +
    alerts.training.items.filter((i) => !dismissedIds.has(i.id)).length;

  const sections = [
    {
      key: "medical",
      label: "חיסונים ופרוטוקולים רפואיים",
      icon: Syringe,
      color: "text-amber-600",
      bg: "bg-amber-50 border-amber-200",
      headerBg: "bg-amber-50",
      count: alerts.medical.count,
      items: alerts.medical.items.map((p) => ({
        id: p.id,
        dogId: p.dogId,
        dogName: p.dogName,
        isOverdue: p.isOverdue,
        sectionKey: "medical" as const,
        line1: p.label,
        line2: p.dueDate
          ? `${p.isOverdue ? "עבר תאריך: " : "יעד: "}${new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" }).format(new Date(p.dueDate))}`
          : "ללא תאריך יעד",
      })),
    },
    {
      key: "training",
      label: "אימונים — ללא מפגש בשבועיים",
      icon: Dumbbell,
      color: "text-blue-600",
      bg: "bg-blue-50 border-blue-200",
      headerBg: "bg-blue-50",
      count: alerts.training.count,
      items: alerts.training.items.map((t) => ({
        id: t.id,
        dogId: t.dogId,
        dogName: t.dogName,
        isOverdue: false,
        sectionKey: "training" as const,
        line1: t.daysSinceLastSession
          ? `${t.daysSinceLastSession} ימים ללא אימון`
          : "טרם בוצע אימון",
        line2: t.lastSessionDate
          ? `אימון אחרון: ${new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" }).format(new Date(t.lastSessionDate))}`
          : "אין אימון מתועד",
      })),
    },
  ].map((s) => ({ ...s, items: s.items.filter((i) => !dismissedIds.has(i.id)) }))
   .filter((s) => s.items.length > 0);

  return (
    <div className="card p-0 overflow-hidden border border-amber-200">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-l from-amber-50 to-orange-50 border-b border-amber-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
            <Bell className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="font-bold text-petra-text">מרכז התראות — כלבי שירות</h2>
            <p className="text-xs text-petra-muted mt-0.5">
              {activeTotal} התראות פעילות
              {overdueCount > 0 && (
                <span className="text-red-600 font-semibold mr-1">· {overdueCount} דחופות</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
              {overdueCount} דחוף
            </span>
          )}
          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {activeTotal} סה״כ
          </span>
        </div>
      </div>

      {/* Categories */}
      <div className="divide-y">
        {sections.map((section) => {
          const Icon = section.icon;
          const isOpen = open[section.key];
          return (
            <div key={section.key}>
              <button
                type="button"
                onClick={() => toggle(section.key)}
                className={cn(
                  "w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors text-right",
                  isOpen && "bg-slate-50/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", section.bg.split(" ")[0])}>
                    <Icon className={cn("w-4 h-4", section.color)} />
                  </div>
                  <span className="text-sm font-semibold">{section.label}</span>
                  <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded-full", section.bg)}>
                    {section.items.length}
                  </span>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-petra-muted flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-petra-muted flex-shrink-0" />
                )}
              </button>

              {isOpen && (
                <div className="px-5 pb-3 space-y-2">
                  {section.items.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-start gap-2 p-3 rounded-xl border transition-all",
                        item.isOverdue
                          ? "bg-red-50 border-red-200"
                          : "bg-white border-petra-border"
                      )}
                    >
                      <button
                        type="button"
                        onClick={(e) => dismiss(item.id, `${item.dogName} — ${item.line1}`, e)}
                        className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0 flex items-center justify-center hover:border-emerald-400 hover:bg-emerald-50 transition-all mt-0.5"
                        title="סמן כטופל"
                      />
                      <Link
                        href={`/service-dogs/${item.dogId}`}
                        className="flex items-start gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-petra-text">{item.dogName}</span>
                            {item.isOverdue && (
                              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">דחוף</span>
                            )}
                          </div>
                          <p className="text-xs text-petra-muted mt-0.5">{item.line1}</p>
                          <p className={cn("text-xs mt-0.5", item.isOverdue ? "text-red-600 font-medium" : "text-petra-muted")}>
                            {item.line2}
                          </p>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-petra-muted flex-shrink-0 mt-0.5" />
                      </Link>
                      {item.sectionKey === "training" && (
                        <Link
                          href={`/training?dogId=${item.dogId}&dogName=${encodeURIComponent(item.dogName)}`}
                          className="text-[10px] px-2 py-1 rounded-lg font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors flex items-center gap-1 flex-shrink-0 mt-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Plus className="w-3 h-3" />
                          תזמן
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ServiceDogsOverviewPage() {
  return (
    <>
      <PageTitle title="כלבי שירות" />
      <TierGate
      feature="service_dogs"
      title="מודול כלבי שירות"
      description="ניהול כלבי שירות, זכאים, שיבוצים ותעודות הסמכה. מעקב 120 שעות אימון לפי תקן ADI."
      upgradeTier="service_dog"
      ctaLabel="ניהול כלבי שירות, תעודות ומעקב 120 שעות זמין במסלול Service Dog — שדרג עכשיו"
    >
      <ServiceDogsOverviewPageContent />
    </TierGate>
    </>
  );
}
