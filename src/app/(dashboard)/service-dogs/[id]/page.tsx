"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Dog,
  Heart,
  Clock,
  AlertTriangle,
  CreditCard,
  Plus,
  X,
  CheckCircle2,
  ChevronDown,
  Eye,
  Activity,
  Shield,
  Calendar,
  MapPin,
  User,
  Star,
  QrCode,
  Printer,
  FileText,
  TrendingUp,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import {
  SERVICE_DOG_PHASES,
  SERVICE_DOG_PHASE_MAP,
  SERVICE_DOG_PHASE_COLORS,
  SERVICE_DOG_TYPES,
  ADI_SKILL_CATEGORIES,
  MEDICAL_PROTOCOL_CATEGORIES,
  COMPLIANCE_EVENT_MAP,
  PLACEMENT_STATUS_MAP,
} from "@/lib/service-dogs";
import { toast } from "sonner";

// ─── Types ───

interface ServiceDogDetail {
  id: string;
  petId: string;
  phase: string;
  serviceType: string | null;
  trainingTotalHours: number;
  trainingTargetHours: number;
  trainingTargetMonths: number;
  trainingStatus: string;
  trainingStartDate: string | null;
  isGovReportPending: boolean;
  idCardIsActive: boolean;
  registrationNumber: string | null;
  certifyingBody: string | null;
  certificationDate: string | null;
  certificationExpiry: string | null;
  notes: string | null;
  createdAt: string;
  pet: { id: string; name: string; breed: string | null; species: string; gender: string | null };
  medicalProtocols: MedicalProtocol[];
  trainingLogs: TrainingLog[];
  complianceEvents: ComplianceEvent[];
  placements: PlacementItem[];
  idCards: IDCard[];
  medicalCompliance: {
    totalProtocols: number;
    completedCount: number;
    pendingCount: number;
    overdueCount: number;
    compliancePercent: number;
    status: "green" | "amber" | "red";
  };
  trainingProgress: {
    totalHours: number;
    targetHours: number;
    percentComplete: number;
    monthsElapsed: number;
    targetMonths: number;
    monthsRemaining: number;
    hoursRemaining: number;
    isReadyForCertification: boolean;
  };
}

interface MedicalProtocol {
  id: string;
  phase: string;
  protocolKey: string;
  protocolLabel: string;
  category: string;
  status: string;
  dueDate: string | null;
  completedDate: string | null;
  expiryDate: string | null;
  notes: string | null;
}

interface TrainingLog {
  id: string;
  sessionDate: string;
  durationMinutes: number;
  trainerName: string | null;
  location: string | null;
  skillCategories: string;
  status: string;
  notes: string | null;
  rating: number | null;
  cumulativeHours: number | null;
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

interface PlacementItem {
  id: string;
  status: string;
  placementDate: string | null;
  trialStartDate: string | null;
  trialEndDate: string | null;
  nextCheckInAt: string | null;
  notes: string | null;
  recipient: { id: string; name: string; phone: string | null; disabilityType: string | null };
}

interface IDCard {
  id: string;
  qrToken: string;
  qrPayload: string;
  cardDataJson: string;
  isActive: boolean;
  expiresAt: string | null;
  generatedAt: string;
}

// ─── Main Page ───

export default function ServiceDogProfilePage() {
  const params = useParams();
  const router = useRouter();
  const dogId = params.id as string;
  const [activeTab, setActiveTab] = useState<"training" | "medical" | "compliance" | "placements" | "idcard">("training");
  const [showPhaseDropdown, setShowPhaseDropdown] = useState(false);
  const queryClient = useQueryClient();

  const { data: dog, isLoading, isError } = useQuery<ServiceDogDetail>({
    queryKey: ["service-dog-detail", dogId],
    queryFn: () => fetch(`/api/service-dogs/${dogId}`).then((r) => {
      if (!r.ok) throw new Error("Not found");
      return r.json();
    }),
  });

  const phaseChangeMutation = useMutation({
    mutationFn: (phase: string) =>
      fetch(`/api/service-dogs/${dogId}/phase`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
      setShowPhaseDropdown(false);
      toast.success("שלב עודכן");
    },
    onError: () => toast.error("שגיאה בעדכון שלב"),
  });

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-4">
        <div className="h-32 card animate-pulse" />
        <div className="h-64 card animate-pulse" />
      </div>
    );
  }

  if (isError || !dog) {
    return (
      <div className="text-center py-20">
        <Dog className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">כלב לא נמצא</p>
        <Link href="/service-dogs/dogs" className="btn-primary mt-4 inline-flex">
          חזרה לרשימה
        </Link>
      </div>
    );
  }

  const phaseInfo = SERVICE_DOG_PHASE_MAP[dog.phase];
  const phaseColors = SERVICE_DOG_PHASE_COLORS[dog.phase];
  const tp = dog.trainingProgress;
  const mc = dog.medicalCompliance;

  const tabs = [
    { id: "training" as const, label: "יומן אימונים", icon: Clock },
    { id: "medical" as const, label: "פרוטוקולים רפואיים", icon: Heart },
    { id: "compliance" as const, label: "ציות ודיווח", icon: AlertTriangle, badge: dog.isGovReportPending ? 1 : 0 },
    { id: "placements" as const, label: "שיבוצים", icon: Activity },
    { id: "idcard" as const, label: "תעודת זהות", icon: CreditCard },
  ];

  return (
    <div className="animate-fade-in space-y-5">
      {/* Breadcrumb + Back */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          חזרה
        </button>
        <span>·</span>
        <Link href="/service-dogs" className="hover:text-foreground">כלבי שירות</Link>
        <span>·</span>
        <Link href="/service-dogs/dogs" className="hover:text-foreground">כלבים</Link>
        <span>·</span>
        <span className="text-foreground font-medium">{dog.pet.name}</span>
      </div>

      {/* Profile Header */}
      <div className="card p-0 overflow-hidden">
        {/* Phase color bar */}
        <div className="h-1.5" style={{ background: phaseColors?.text || "#64748B" }} />

        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            {/* Dog avatar + info */}
            <div className="flex items-start gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: phaseColors?.bg || "#F1F5F9" }}
              >
                <Dog className="w-8 h-8" style={{ color: phaseColors?.text || "#475569" }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold leading-tight">{dog.pet.name}</h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  {dog.pet.breed || dog.pet.species}
                  {dog.pet.gender && ` · ${dog.pet.gender === "male" ? "זכר" : "נקבה"}`}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {/* Phase dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowPhaseDropdown(!showPhaseDropdown)}
                      className="flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border font-medium transition-all hover:shadow-sm"
                      style={{
                        backgroundColor: phaseColors?.bg,
                        color: phaseColors?.text,
                        borderColor: phaseColors?.border,
                      }}
                    >
                      {phaseInfo?.label || dog.phase}
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    {showPhaseDropdown && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowPhaseDropdown(false)} />
                        <div className="absolute z-20 top-full mt-1 right-0 bg-white rounded-xl shadow-xl border py-1 min-w-[170px]">
                          <p className="text-xs text-muted-foreground px-3 py-1.5 border-b">שנה שלב</p>
                          {SERVICE_DOG_PHASES.map((p) => {
                            const pc = SERVICE_DOG_PHASE_COLORS[p.id];
                            return (
                              <button
                                key={p.id}
                                onClick={() => phaseChangeMutation.mutate(p.id)}
                                disabled={p.id === dog.phase || phaseChangeMutation.isPending}
                                className={cn(
                                  "w-full text-right px-3 py-2 text-sm hover:bg-muted/40 transition-colors flex items-center gap-2",
                                  p.id === dog.phase && "opacity-40 cursor-default"
                                )}
                              >
                                <span
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: pc?.text }}
                                />
                                {p.label}
                                {p.id === dog.phase && " ✓"}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {dog.registrationNumber && (
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full font-mono">
                      #{dog.registrationNumber}
                    </span>
                  )}
                  {dog.certifyingBody && (
                    <span className="text-xs text-muted-foreground">
                      {dog.certifyingBody}
                    </span>
                  )}
                  {dog.isGovReportPending && (
                    <span className="flex items-center gap-1 text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium animate-pulse">
                      <AlertTriangle className="w-3 h-3" />
                      דיווח ממשלתי נדרש
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Service type badge */}
            {dog.serviceType && (
              <div className="text-right">
                <span className="text-xs text-muted-foreground">סוג שירות</span>
                <p className="text-sm font-semibold mt-0.5">
                  {SERVICE_DOG_TYPES.find((t) => t.id === dog.serviceType)?.label || dog.serviceType}
                </p>
              </div>
            )}
          </div>

          {/* Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t">
            {/* Training hours */}
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {tp.totalHours.toFixed(0)}
                <span className="text-sm font-normal text-muted-foreground">/{tp.targetHours}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">שעות אימון</div>
              <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    tp.percentComplete >= 100 ? "bg-emerald-500" : tp.percentComplete >= 50 ? "bg-blue-500" : "bg-amber-500"
                  )}
                  style={{ width: `${tp.percentComplete}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">{tp.percentComplete}%</div>
            </div>

            {/* Medical compliance */}
            <div className="text-center">
              <div
                className={cn(
                  "text-2xl font-bold",
                  mc.status === "green" ? "text-emerald-600" : mc.status === "amber" ? "text-amber-600" : "text-red-600"
                )}
              >
                {mc.compliancePercent}%
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">משמעת רפואית</div>
              <div className="text-xs mt-1.5">
                <span className="text-emerald-600">{mc.completedCount} ✓</span>
                {mc.overdueCount > 0 && <span className="text-red-600 mr-2">{mc.overdueCount} ✗</span>}
              </div>
            </div>

            {/* Time */}
            <div className="text-center">
              <div className="text-2xl font-bold">
                {tp.monthsElapsed}
                <span className="text-sm font-normal text-muted-foreground">/{tp.targetMonths}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">חודשי אימון</div>
              {dog.trainingStartDate && (
                <div className="text-xs text-muted-foreground mt-1.5">
                  התחיל {formatDate(dog.trainingStartDate)}
                </div>
              )}
            </div>

            {/* Status */}
            <div className="text-center">
              <div className="text-2xl font-bold">
                {tp.isReadyForCertification ? (
                  <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
                ) : dog.phase === "CERTIFIED" ? (
                  <Shield className="w-7 h-7 text-emerald-500 mx-auto" />
                ) : (
                  <TrendingUp className="w-7 h-7 text-blue-400 mx-auto" />
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {tp.isReadyForCertification ? "מוכן להסמכה!" : dog.phase === "CERTIFIED" ? "מוסמך" : "באימון"}
              </div>
              {dog.certificationDate && (
                <div className="text-xs text-emerald-600 mt-1.5 font-medium">
                  הוסמך {formatDate(dog.certificationDate)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === "training" && <TrainingTab dog={dog} dogId={dogId} />}
        {activeTab === "medical" && <MedicalTab dog={dog} dogId={dogId} />}
        {activeTab === "compliance" && <ComplianceTab dog={dog} dogId={dogId} />}
        {activeTab === "placements" && <PlacementsTab dog={dog} />}
        {activeTab === "idcard" && <IDCardTab dog={dog} dogId={dogId} />}
      </div>

      {/* Notes */}
      {dog.notes && (
        <div className="card p-4 border-r-4 border-r-amber-400 bg-amber-50">
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-amber-700 mb-1">הערות</p>
              <p className="text-sm text-amber-900">{dog.notes}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Training Tab ───

function TrainingTab({ dog, dogId }: { dog: ServiceDogDetail; dogId: string }) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const tp = dog.trainingProgress;

  return (
    <div className="space-y-4">
      {/* ADI Progress */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            התקדמות ADI
          </h3>
          {tp.isReadyForCertification && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              <CheckCircle2 className="w-4 h-4" />
              מוכן להסמכה!
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-blue-50 rounded-xl">
            <div className="text-xl font-bold text-blue-700">{tp.totalHours.toFixed(1)}</div>
            <div className="text-xs text-blue-600 mt-0.5">שעות בוצעו</div>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-xl">
            <div className="text-xl font-bold text-slate-700">{tp.targetHours}</div>
            <div className="text-xs text-slate-600 mt-0.5">יעד שעות</div>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-xl">
            <div className="text-xl font-bold text-slate-700">{tp.monthsElapsed}/{tp.targetMonths}</div>
            <div className="text-xs text-slate-600 mt-0.5">חודשים</div>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-xl">
            <div className="text-xl font-bold text-slate-700">{tp.hoursRemaining.toFixed(1)}</div>
            <div className="text-xs text-slate-600 mt-0.5">שעות נותרו</div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">השלמה</span>
            <span className="font-semibold">{tp.percentComplete}%</span>
          </div>
          <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                tp.percentComplete >= 100
                  ? "bg-emerald-500"
                  : tp.percentComplete >= 75
                  ? "bg-blue-500"
                  : tp.percentComplete >= 50
                  ? "bg-amber-500"
                  : "bg-orange-500"
              )}
              style={{ width: `${tp.percentComplete}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
            <span>0 שעות</span>
            <span>{tp.targetHours} שעות</span>
          </div>
        </div>
      </div>

      {/* Training logs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">מפגשי אימון ({dog.trainingLogs.length})</h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            הוסף מפגש
          </button>
        </div>

        {showAddForm && (
          <AddTrainingForm
            dogId={dogId}
            onDone={() => {
              setShowAddForm(false);
              queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
              queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
            }}
          />
        )}

        {dog.trainingLogs.length === 0 ? (
          <div className="empty-state py-10">
            <Clock className="empty-state-icon" />
            <p className="text-muted-foreground">אין מפגשי אימון עדיין</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dog.trainingLogs.map((log) => {
              const skills: string[] = (() => {
                try { return JSON.parse(log.skillCategories) || []; } catch { return []; }
              })();
              return (
                <div key={log.id} className="card p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {formatDate(log.sessionDate)}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          {log.durationMinutes} דקות
                          {log.cumulativeHours !== null && (
                            <span className="text-blue-600 font-medium mr-1">
                              ({log.cumulativeHours.toFixed(1)} מצטבר)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                        {log.trainerName && (
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {log.trainerName}
                          </span>
                        )}
                        {log.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {log.location}
                          </span>
                        )}
                      </div>

                      {skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {skills.map((skillId) => {
                            const skill = ADI_SKILL_CATEGORIES.find((s) => s.id === skillId);
                            return (
                              <span
                                key={skillId}
                                className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full"
                              >
                                {skill?.label || skillId}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {log.notes && (
                        <p className="text-sm text-muted-foreground">{log.notes}</p>
                      )}
                    </div>

                    {log.rating !== null && (
                      <div className="flex gap-0.5 flex-shrink-0">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              "w-4 h-4",
                              i < log.rating! ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add Training Form ───

function AddTrainingForm({ dogId, onDone }: { dogId: string; onDone: () => void }) {
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [trainerName, setTrainerName] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch(`/api/service-dogs/${dogId}/training`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      toast.success("מפגש אימון נוסף");
      onDone();
    },
    onError: () => toast.error("שגיאה בהוספת מפגש"),
  });

  return (
    <div className="card p-4 mb-4 border-2 border-brand-200 bg-brand-50/30">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Plus className="w-4 h-4 text-brand-500" />
        מפגש אימון חדש
      </h4>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="label">תאריך *</label>
          <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} className="input w-full" />
        </div>
        <div>
          <label className="label">משך (דקות) *</label>
          <input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="input w-full" min={1} />
        </div>
        <div>
          <label className="label">מאמן</label>
          <input type="text" value={trainerName} onChange={(e) => setTrainerName(e.target.value)} className="input w-full" placeholder="שם המאמן" />
        </div>
        <div>
          <label className="label">מיקום</label>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="input w-full" placeholder="מיקום האימון" />
        </div>
      </div>

      <div className="mb-3">
        <label className="label">כישורים שאומנו</label>
        <div className="flex flex-wrap gap-1.5">
          {ADI_SKILL_CATEGORIES.map((skill) => (
            <button
              key={skill.id}
              type="button"
              onClick={() =>
                setSelectedSkills((prev) =>
                  prev.includes(skill.id)
                    ? prev.filter((s) => s !== skill.id)
                    : [...prev, skill.id]
                )
              }
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-all",
                selectedSkills.includes(skill.id)
                  ? "bg-brand-500 text-white border-brand-500 shadow-sm"
                  : "bg-white text-muted-foreground border-muted-foreground/20 hover:border-brand-300"
              )}
            >
              {skill.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="label">דירוג מפגש</label>
          <div className="flex gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRating(r === rating ? 0 : r)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={cn(
                    "w-6 h-6 transition-colors",
                    r <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/25"
                  )}
                />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">הערות</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input w-full"
            rows={2}
            placeholder="הערות לגבי המפגש..."
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() =>
            createMutation.mutate({
              sessionDate,
              durationMinutes,
              trainerName: trainerName || null,
              location: location || null,
              skillCategories: selectedSkills,
              notes: notes || null,
              rating: rating > 0 ? rating : null,
            })
          }
          disabled={!sessionDate || !durationMinutes || createMutation.isPending}
          className="btn-primary"
        >
          {createMutation.isPending ? "שומר..." : "שמור מפגש"}
        </button>
        <button onClick={onDone} className="btn-secondary">ביטול</button>
      </div>
    </div>
  );
}

// ─── Medical Tab ───

function MedicalTab({ dog, dogId }: { dog: ServiceDogDetail; dogId: string }) {
  const queryClient = useQueryClient();
  const mc = dog.medicalCompliance;

  const markProtocolMutation = useMutation({
    mutationFn: ({ protocolId, status }: { protocolId: string; status: string }) =>
      fetch(`/api/service-dogs/${dogId}/medical`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocolId,
          status,
          completedDate: status === "COMPLETED" ? new Date().toISOString() : undefined,
        }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
      toast.success("פרוטוקול עודכן");
    },
    onError: () => toast.error("שגיאה בעדכון פרוטוקול"),
  });

  // Group protocols by category
  const grouped = MEDICAL_PROTOCOL_CATEGORIES.reduce((acc, cat) => {
    const protocols = dog.medicalProtocols.filter((p) => p.category === cat.id);
    if (protocols.length > 0) acc[cat.id] = { label: cat.label, protocols };
    return acc;
  }, {} as Record<string, { label: string; protocols: MedicalProtocol[] }>);

  const statusConfig = {
    COMPLETED: { label: "בוצע", className: "bg-emerald-100 text-emerald-700", icon: "✓" },
    PENDING: { label: "ממתין", className: "bg-slate-100 text-slate-600", icon: "○" },
    OVERDUE: { label: "באיחור", className: "bg-red-100 text-red-600", icon: "!" },
    WAIVED: { label: "ויתור", className: "bg-amber-100 text-amber-700", icon: "—" },
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div
        className={cn(
          "rounded-xl p-4 border flex items-center gap-4",
          mc.status === "green"
            ? "bg-emerald-50 border-emerald-200"
            : mc.status === "amber"
            ? "bg-amber-50 border-amber-200"
            : "bg-red-50 border-red-200"
        )}
      >
        <div
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-xl font-bold",
            mc.status === "green"
              ? "bg-emerald-500 text-white"
              : mc.status === "amber"
              ? "bg-amber-500 text-white"
              : "bg-red-500 text-white"
          )}
        >
          {mc.compliancePercent}%
        </div>
        <div>
          <p className="font-semibold">
            {mc.completedCount} מתוך {mc.totalProtocols} פרוטוקולים הושלמו
          </p>
          <div className="flex gap-3 text-sm mt-0.5">
            {mc.overdueCount > 0 && (
              <span className="text-red-600 font-medium">{mc.overdueCount} באיחור</span>
            )}
            {mc.pendingCount > 0 && (
              <span className="text-slate-600">{mc.pendingCount} ממתינים</span>
            )}
          </div>
        </div>
      </div>

      {/* Protocols by category */}
      {Object.entries(grouped).map(([catId, { label, protocols }]) => (
        <div key={catId} className="card p-0 overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b">
            <h4 className="font-semibold text-sm">{label}</h4>
          </div>
          <div className="divide-y">
            {protocols.map((protocol) => {
              const sc = statusConfig[protocol.status as keyof typeof statusConfig] || statusConfig.PENDING;
              const isOverdue = protocol.status === "OVERDUE";
              const isDone = protocol.status === "COMPLETED" || protocol.status === "WAIVED";

              return (
                <div
                  key={protocol.id}
                  className={cn(
                    "px-4 py-3 flex items-center justify-between gap-3",
                    isOverdue && "bg-red-50"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                        sc.className
                      )}
                    >
                      {sc.icon}
                    </div>
                    <div className="min-w-0">
                      <p className={cn("text-sm font-medium", isOverdue && "text-red-700")}>
                        {protocol.protocolLabel}
                      </p>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                        {protocol.dueDate && (
                          <span className={cn(isOverdue && "text-red-500 font-medium")}>
                            יעד: {formatDate(protocol.dueDate)}
                          </span>
                        )}
                        {protocol.completedDate && (
                          <span className="text-emerald-600">בוצע: {formatDate(protocol.completedDate)}</span>
                        )}
                        {protocol.expiryDate && (
                          <span>פג: {formatDate(protocol.expiryDate)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", sc.className)}>
                      {sc.label}
                    </span>
                    {!isDone && (
                      <button
                        onClick={() =>
                          markProtocolMutation.mutate({ protocolId: protocol.id, status: "COMPLETED" })
                        }
                        disabled={markProtocolMutation.isPending}
                        className="btn-primary text-xs py-1 px-2.5"
                      >
                        סמן כבוצע
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Compliance Tab ───

function ComplianceTab({ dog, dogId }: { dog: ServiceDogDetail; dogId: string }) {
  const queryClient = useQueryClient();

  const markMutation = useMutation({
    mutationFn: ({ id, notificationStatus }: { id: string; notificationStatus: string }) =>
      fetch(`/api/service-compliance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationStatus }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
      queryClient.invalidateQueries({ queryKey: ["service-compliance"] });
      toast.success("סטטוס עודכן");
    },
    onError: () => toast.error("שגיאה בעדכון"),
  });

  const now = new Date();
  const pendingEvents = dog.complianceEvents.filter((e) => e.notificationStatus === "PENDING");
  const overdueEvents = pendingEvents.filter(
    (e) => e.notificationDue && new Date(e.notificationDue) < now
  );
  const otherEvents = dog.complianceEvents.filter((e) => e.notificationStatus !== "PENDING");

  const statusConfig: Record<string, { label: string; className: string }> = {
    PENDING: { label: "ממתין לשליחה", className: "bg-amber-100 text-amber-700" },
    SENT: { label: "נשלח", className: "bg-emerald-100 text-emerald-700" },
    WAIVED: { label: "ויתור", className: "bg-slate-100 text-slate-600" },
    NOT_REQUIRED: { label: "לא נדרש", className: "bg-slate-100 text-slate-500" },
    FAILED: { label: "נכשל", className: "bg-red-100 text-red-600" },
  };

  return (
    <div className="space-y-4">
      {/* Gov report banner */}
      {dog.isGovReportPending && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700">נדרש דיווח ממשלתי</p>
            <p className="text-sm text-red-600 mt-0.5">
              ישנם אירועים שדורשים דיווח לרשות הרלוונטית בתוך 48 שעות
            </p>
          </div>
        </div>
      )}

      {/* Overdue section */}
      {overdueEvents.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-red-600 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            באיחור ({overdueEvents.length})
          </h4>
          <ComplianceEventGroup events={overdueEvents} statusConfig={statusConfig} onMark={(id, status) => markMutation.mutate({ id, notificationStatus: status })} isOverdue />
        </div>
      )}

      {/* Pending section */}
      {pendingEvents.filter((e) => !overdueEvents.includes(e)).length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-amber-600 mb-2">
            ממתינים לשליחה ({pendingEvents.filter((e) => !overdueEvents.includes(e)).length})
          </h4>
          <ComplianceEventGroup
            events={pendingEvents.filter((e) => !overdueEvents.includes(e))}
            statusConfig={statusConfig}
            onMark={(id, status) => markMutation.mutate({ id, notificationStatus: status })}
          />
        </div>
      )}

      {/* History */}
      {otherEvents.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-2">היסטוריה</h4>
          <ComplianceEventGroup events={otherEvents} statusConfig={statusConfig} onMark={(id, status) => markMutation.mutate({ id, notificationStatus: status })} />
        </div>
      )}

      {dog.complianceEvents.length === 0 && (
        <div className="empty-state py-10">
          <AlertTriangle className="empty-state-icon" />
          <p className="text-muted-foreground">אין אירועי ציות</p>
        </div>
      )}
    </div>
  );
}

function ComplianceEventGroup({
  events,
  statusConfig,
  onMark,
  isOverdue = false,
}: {
  events: ComplianceEvent[];
  statusConfig: Record<string, { label: string; className: string }>;
  onMark: (id: string, notificationStatus: string) => void;
  isOverdue?: boolean;
}) {
  return (
    <div className="space-y-2">
      {events.map((event) => {
        const sc = statusConfig[event.notificationStatus] || statusConfig.PENDING;
        return (
          <div
            key={event.id}
            className={cn(
              "card p-4 flex items-start justify-between gap-3",
              isOverdue && "border-red-200 bg-red-50"
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-sm">
                  {COMPLIANCE_EVENT_MAP[event.eventType]?.label || event.eventType}
                </p>
                {event.notificationRequired && (
                  <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                    דיווח חובה
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{event.eventDescription}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>{formatDate(event.eventAt)}</span>
                {event.notificationDue && (
                  <span className={cn(isOverdue ? "text-red-600 font-medium" : "text-amber-600")}>
                    · דד-ליין: {formatDate(event.notificationDue)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={cn("text-xs px-2 py-0.5 rounded-full", sc.className)}>
                {sc.label}
              </span>
              {event.notificationStatus === "PENDING" && (
                <div className="flex gap-1">
                  <button
                    onClick={() => onMark(event.id, "SENT")}
                    className="btn-primary text-xs py-1 px-2"
                  >
                    נשלח ✓
                  </button>
                  <button
                    onClick={() => onMark(event.id, "WAIVED")}
                    className="btn-ghost text-xs py-1 px-2"
                  >
                    ויתור
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Placements Tab ───

function PlacementsTab({ dog }: { dog: ServiceDogDetail }) {
  const activePlacement = dog.placements.find((p) => ["ACTIVE", "TRIAL"].includes(p.status));

  return (
    <div className="space-y-4">
      {activePlacement && (
        <div className="card p-4 border-2 border-emerald-300 bg-emerald-50">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <p className="font-semibold text-emerald-800">שיבוץ פעיל</p>
              </div>
              <p className="text-lg font-bold">{activePlacement.recipient.name}</p>
              {activePlacement.recipient.phone && (
                <p className="text-sm text-muted-foreground mt-0.5">{activePlacement.recipient.phone}</p>
              )}
            </div>
            <span
              className={cn(
                "text-sm px-3 py-1 rounded-full font-medium",
                PLACEMENT_STATUS_MAP[activePlacement.status]?.color
              )}
            >
              {PLACEMENT_STATUS_MAP[activePlacement.status]?.label || activePlacement.status}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-emerald-200">
            {activePlacement.placementDate && (
              <div>
                <p className="text-xs text-emerald-600">תאריך שיבוץ</p>
                <p className="text-sm font-medium">{formatDate(activePlacement.placementDate)}</p>
              </div>
            )}
            {activePlacement.trialEndDate && (
              <div>
                <p className="text-xs text-emerald-600">סיום ניסיון</p>
                <p className="text-sm font-medium">{formatDate(activePlacement.trialEndDate)}</p>
              </div>
            )}
            {activePlacement.nextCheckInAt && (
              <div>
                <p className="text-xs text-emerald-600">בדיקת מעקב</p>
                <p className="text-sm font-medium">{formatDate(activePlacement.nextCheckInAt)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {dog.placements.length === 0 ? (
        <div className="empty-state py-10">
          <Activity className="empty-state-icon" />
          <p className="text-muted-foreground">אין שיבוצים</p>
          <Link href="/service-dogs/placements" className="btn-primary mt-3 inline-flex text-sm">
            צור שיבוץ חדש
          </Link>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/20">
            <h4 className="text-sm font-semibold">היסטוריית שיבוצים</h4>
          </div>
          <div className="divide-y">
            {dog.placements.map((placement) => {
              const sc = PLACEMENT_STATUS_MAP[placement.status];
              return (
                <div key={placement.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{placement.recipient.name}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                      {placement.placementDate && <span>{formatDate(placement.placementDate)}</span>}
                      {placement.trialEndDate && <span>עד {formatDate(placement.trialEndDate)}</span>}
                    </div>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", sc?.color)}>
                    {sc?.label || placement.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ID Card Tab ───

function IDCardTab({ dog, dogId }: { dog: ServiceDogDetail; dogId: string }) {
  const queryClient = useQueryClient();
  const [viewingCard, setViewingCard] = useState<IDCard | null>(null);

  const generateMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/service-dogs/${dogId}/id-card`, { method: "POST" }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
      toast.success("תעודת זהות הונפקה");
    },
    onError: () => toast.error("שגיאה בהנפקת תעודה"),
  });

  const fetchCard = async () => {
    try {
      const res = await fetch(`/api/service-dogs/${dogId}/id-card`);
      if (res.ok) {
        const card = await res.json();
        setViewingCard(card);
      }
    } catch {
      toast.error("שגיאה בטעינת התעודה");
    }
  };

  const activeCard = dog.idCards[0];

  return (
    <div className="space-y-4">
      {dog.phase !== "CERTIFIED" && !activeCard && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-700">הכלב טרם הוסמך</p>
            <p className="text-sm text-amber-600 mt-0.5">
              ניתן להנפיק תעודת זהות רק לכלבים מוסמכים (שלב: מוסמך)
            </p>
          </div>
        </div>
      )}

      {!activeCard ? (
        <div className="card p-8 text-center">
          <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground mb-4">אין תעודת זהות פעילה</p>
          {dog.phase === "CERTIFIED" && (
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="btn-primary inline-flex items-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              {generateMutation.isPending ? "מייצר..." : "הנפק תעודת זהות"}
            </button>
          )}
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-500" />
                תעודת זהות פעילה
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                הונפקה: {formatDate(activeCard.generatedAt)}
                {activeCard.expiresAt && ` · פגה: ${formatDate(activeCard.expiresAt)}`}
              </p>
            </div>
            <span className="badge-success">פעיל</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchCard}
              className="btn-secondary flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              צפה בתעודה
            </button>
            <button
              onClick={fetchCard}
              className="btn-ghost flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              הדפס
            </button>
          </div>
        </div>
      )}

      {/* Card viewer modal */}
      {viewingCard && (
        <div className="modal-overlay" onClick={() => setViewingCard(null)}>
          <div className="modal-backdrop" />
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">תעודת כלב שירות</h2>
              <button onClick={() => setViewingCard(null)} className="btn-ghost p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {viewingCard.qrPayload && (
              <div className="flex justify-center mb-4 p-4 bg-white border rounded-xl">
                <img
                  src={viewingCard.qrPayload}
                  alt="QR Code תעודת כלב שירות"
                  className="w-48 h-48"
                />
              </div>
            )}

            {(() => {
              const data = JSON.parse(viewingCard.cardDataJson || "{}");
              return (
                <div className="space-y-2 text-sm">
                  {[
                    { label: "שם הכלב", value: data.dogName },
                    { label: "גזע", value: data.breed },
                    { label: "מספר רישום", value: data.registrationNumber },
                    { label: "גוף מסמיך", value: data.certifyingBody },
                    { label: "מקבל", value: data.recipientName },
                    { label: "תאריך הסמכה", value: data.certificationDate ? formatDate(data.certificationDate) : null },
                  ]
                    .filter((f) => f.value)
                    .map((f) => (
                      <div key={f.label} className="flex justify-between py-1 border-b last:border-0">
                        <span className="text-muted-foreground">{f.label}</span>
                        <span className="font-medium">{f.value}</span>
                      </div>
                    ))}
                </div>
              );
            })()}

            <button
              onClick={() => window.print()}
              className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              הדפס תעודה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
