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
  ChevronUp,
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
  GraduationCap,
  UtensilsCrossed,
  Pill,
  Trash2,
  Pencil,
  Stethoscope,
  Flag,
  Trophy,
  BadgeCheck,
  ShieldCheck,
  Banknote,
  Package,
  Tag,
  Building,
  Check,
  Upload,
  ImageIcon,
  FileText as FileTextIcon,
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
  TRAINING_MILESTONES,
  MILESTONE_MAP,
  EVALUATION_TYPES,
  EVALUATION_CRITERIA,
  EVALUATION_TYPE_MAP,
  VEST_SIZES,
  VEST_TYPES,
  VEST_CONDITIONS,
  INSURANCE_COVERAGE_TYPES,
  CLAIM_STATUSES,
  CLAIM_STATUS_MAP,
} from "@/lib/service-dogs";
import { toast } from "sonner";

// ─── Types ───

interface PetHealth {
  neuteredSpayed: boolean;
  allergies: string | null;
  medicalConditions: string | null;
  surgeriesHistory: string | null;
  activityLimitations: string | null;
  vetName: string | null;
  vetPhone: string | null;
  rabiesLastDate: string | null;
  rabiesValidUntil: string | null;
  dhppLastDate: string | null;
  dhppPuppy1Date: string | null;
  dhppPuppy2Date: string | null;
  dhppPuppy3Date: string | null;
  bordatellaDate: string | null;
  parkWormDate: string | null;
  dewormingLastDate: string | null;
  fleaTickType: string | null;
  fleaTickDate: string | null;
  fleaTickExpiryDate: string | null;
  originInfo: string | null;
  timeWithOwner: string | null;
}

interface PetBehavior {
  dogAggression: boolean;
  humanAggression: boolean;
  leashReactivity: boolean;
  leashPulling: boolean;
  jumping: boolean;
  separationAnxiety: boolean;
  excessiveBarking: boolean;
  destruction: boolean;
  resourceGuarding: boolean;
  fears: boolean;
  badWithKids: boolean;
  houseSoiling: boolean;
  biteHistory: boolean;
  biteDetails: string | null;
  triggers: string | null;
  priorTraining: boolean;
  priorTrainingDetails: string | null;
  customIssues: string | null;
}

interface PetMedication {
  id: string;
  medName: string;
  dosage: string | null;
  frequency: string | null;
  times: string | null;
  instructions: string | null;
  startDate: string | null;
  endDate: string | null;
}

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
  // New fields
  pedigreeNumber: string | null;
  purchasePrice: number | null;
  purchaseSource: string | null;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  maintenanceNotes: string | null;
  yardGroup: string | null;
  feedingInstructions: string | null;
  dogPhoto: string | null;
  createdAt: string;
  pet: {
    id: string;
    name: string;
    breed: string | null;
    species: string;
    gender: string | null;
    birthDate: string | null;
    weight: number | null;
    microchip: string | null;
    foodBrand: string | null;
    foodGramsPerDay: number | null;
    foodFrequency: string | null;
    foodNotes: string | null;
    medicalNotes: string | null;
    health: PetHealth | null;
    behavior: PetBehavior | null;
    medications: PetMedication[];
  };
  medicalProtocols: MedicalProtocol[];
  trainingLogs: TrainingLog[];
  complianceEvents: ComplianceEvent[];
  placements: PlacementItem[];
  idCards: IDCard[];
  documents: unknown[];
  trainingTests: unknown[];
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
  const [activeTab, setActiveTab] = useState<"training" | "medical" | "compliance" | "placements" | "idcard" | "dogfile" | "documents" | "tests" | "insurance" | "equipment">("dogfile");
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
        <Dog className="w-12 h-12 mx-auto text-petra-muted/40 mb-3" />
        <p className="text-petra-muted">כלב לא נמצא</p>
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
    { id: "dogfile" as const, label: "תיק כלב", icon: Stethoscope },
    { id: "medical" as const, label: "פרוטוקולים רפואיים", icon: Heart },
    { id: "training" as const, label: "יומן אימונים", icon: Clock },
    { id: "tests" as const, label: "מבחני הכשרה", icon: GraduationCap, badge: Array.isArray(dog.trainingTests) ? (dog.trainingTests as unknown[]).length : 0 },
    { id: "placements" as const, label: "שיבוצים", icon: Activity },
    { id: "insurance" as const, label: "ביטוח", icon: ShieldCheck },
    { id: "equipment" as const, label: "ציוד", icon: Package },
    { id: "documents" as const, label: "מסמכים", icon: FileText, badge: Array.isArray(dog.documents) ? (dog.documents as unknown[]).length : 0 },
    { id: "idcard" as const, label: "תעודת הסמכה", icon: CreditCard },
  ];

  return (
    <div className="animate-fade-in space-y-5">
      {/* Breadcrumb + Back */}
      <div className="flex items-center gap-2 text-sm text-petra-muted">
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
                <p className="text-petra-muted text-sm mt-0.5">
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
                          <p className="text-xs text-petra-muted px-3 py-1.5 border-b">שנה שלב</p>
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
                    <span className="text-xs text-petra-muted">
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
                <span className="text-xs text-petra-muted">סוג שירות</span>
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
                <span className="text-sm font-normal text-petra-muted">/{tp.targetHours}</span>
              </div>
              <div className="text-xs text-petra-muted mt-0.5">שעות אימון</div>
              <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    tp.percentComplete >= 100 ? "bg-emerald-500" : tp.percentComplete >= 50 ? "bg-blue-500" : "bg-amber-500"
                  )}
                  style={{ width: `${tp.percentComplete}%` }}
                />
              </div>
              <div className="text-xs text-petra-muted mt-1">{tp.percentComplete}%</div>
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
              <div className="text-xs text-petra-muted mt-0.5">משמעת רפואית</div>
              <div className="text-xs mt-1.5">
                <span className="text-emerald-600">{mc.completedCount} ✓</span>
                {mc.overdueCount > 0 && <span className="text-red-600 mr-2">{mc.overdueCount} ✗</span>}
              </div>
            </div>

            {/* Time */}
            <div className="text-center">
              <div className="text-2xl font-bold">
                {tp.monthsElapsed}
                <span className="text-sm font-normal text-petra-muted">/{tp.targetMonths}</span>
              </div>
              <div className="text-xs text-petra-muted mt-0.5">חודשי אימון</div>
              {dog.trainingStartDate && (
                <div className="text-xs text-petra-muted mt-1.5">
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
              <div className="text-xs text-petra-muted mt-0.5">
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
                  : "border-transparent text-petra-muted hover:text-foreground"
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
        {activeTab === "tests" && <TrainingTestsTab dog={dog} dogId={dogId} />}
        {activeTab === "insurance" && <InsuranceTab dogId={dogId} />}
        {activeTab === "equipment" && <EquipmentTab dogId={dogId} />}
        {activeTab === "documents" && <DocumentsTab dog={dog} dogId={dogId} />}
        {activeTab === "idcard" && <IDCardTab dog={dog} dogId={dogId} />}
        {activeTab === "dogfile" && <DogFileTab dog={dog} dogId={dogId} />}
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

// ─── Milestone Stepper ───

interface MilestoneRecord {
  id: string;
  milestoneKey: string;
  achievedAt: string | null;
  notes: string | null;
}

function MilestonesStepper({ dogId }: { dogId: string }) {
  const queryClient = useQueryClient();

  const { data: milestones = [] } = useQuery<MilestoneRecord[]>({
    queryKey: ["sd-milestones", dogId],
    queryFn: () => fetch(`/api/service-dogs/${dogId}/milestones`).then((r) => r.json()),
  });

  const patchMutation = useMutation({
    mutationFn: ({ milestoneKey, achievedAt }: { milestoneKey: string; achievedAt: string | null }) =>
      fetch(`/api/service-dogs/${dogId}/milestones`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneKey, achievedAt }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sd-milestones", dogId] });
      toast.success("אבן דרך עודכנה");
    },
    onError: () => toast.error("שגיאה בעדכון אבן דרך"),
  });

  const achievedKeys = new Set(milestones.filter((m) => m.achievedAt).map((m) => m.milestoneKey));

  const icons = [Flag, GraduationCap, Trophy, BadgeCheck];

  return (
    <div className="card p-5">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Flag className="w-4 h-4 text-brand-500" />
        אבני דרך
      </h3>
      <div className="relative">
        {/* connector line */}
        <div className="absolute top-5 right-5 left-5 h-0.5 bg-slate-200 z-0" />
        <div className="flex justify-between relative z-10">
          {TRAINING_MILESTONES.map((m, i) => {
            const achieved = achievedKeys.has(m.key);
            const record = milestones.find((r) => r.milestoneKey === m.key);
            const Icon = icons[i] || Flag;
            return (
              <div key={m.key} className="flex flex-col items-center gap-2 flex-1">
                <button
                  onClick={() =>
                    patchMutation.mutate({
                      milestoneKey: m.key,
                      achievedAt: achieved ? null : new Date().toISOString(),
                    })
                  }
                  title={achieved ? "בטל אבן דרך" : "סמן כהושג"}
                  className={cn(
                    "w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all",
                    achieved
                      ? "bg-emerald-500 border-emerald-500 text-white shadow-md"
                      : "bg-white border-slate-300 text-slate-400 hover:border-brand-400"
                  )}
                >
                  {achieved ? <Check className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                </button>
                <div className="text-center max-w-[80px]">
                  <p className={cn("text-xs font-medium leading-tight", achieved ? "text-emerald-700" : "text-petra-muted")}>
                    {m.label}
                  </p>
                  {record?.achievedAt && (
                    <p className="text-[10px] text-emerald-600 mt-0.5">
                      {formatDate(record.achievedAt)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TrainingTab({ dog, dogId }: { dog: ServiceDogDetail; dogId: string }) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const tp = dog.trainingProgress;

  return (
    <div className="space-y-4">
      {/* Milestone Stepper */}
      <MilestonesStepper dogId={dogId} />

      {/* Link to training programs */}
      <a
        href="/training"
        className="flex items-center justify-between p-3 bg-brand-50 border border-brand-200 rounded-xl hover:bg-brand-100 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-brand-600" />
          <span className="text-sm font-medium text-brand-700">לניהול תוכניות אילוף מובנות</span>
          <span className="text-xs text-brand-500">מפגשים, יעדים, שיעורי בית</span>
        </div>
        <span className="text-brand-600 text-sm group-hover:translate-x-[-2px] transition-transform">← מעבר לאימונים</span>
      </a>

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
            <span className="text-petra-muted">השלמה</span>
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
          <div className="flex justify-between text-xs text-petra-muted mt-1.5">
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
            <p className="text-petra-muted">אין מפגשי אימון עדיין</p>
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
                          <Calendar className="w-4 h-4 text-petra-muted" />
                          {formatDate(log.sessionDate)}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-petra-muted">
                          <Clock className="w-3.5 h-3.5" />
                          {log.durationMinutes} דקות
                          {log.cumulativeHours !== null && (
                            <span className="text-blue-600 font-medium mr-1">
                              ({log.cumulativeHours.toFixed(1)} מצטבר)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-petra-muted mb-2">
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
                        <p className="text-sm text-petra-muted">{log.notes}</p>
                      )}
                    </div>

                    {log.rating !== null && (
                      <div className="flex gap-0.5 flex-shrink-0">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              "w-4 h-4",
                              i < log.rating! ? "fill-amber-400 text-amber-400" : "text-petra-muted/20"
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
                  : "bg-white text-petra-muted border-muted-foreground/20 hover:border-brand-300"
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
                    r <= rating ? "fill-amber-400 text-amber-400" : "text-petra-muted/25"
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

// Maps protocol keys to the corresponding health date field
const PROTOCOL_HEALTH_DATE_MAP: Record<string, keyof PetHealth> = {
  RABIES_PRIMARY: "rabiesLastDate",
  RABIES_BOOSTER: "rabiesLastDate",
  DHPP_PRIMARY: "dhppLastDate",
  DHPP: "dhppLastDate",
  DHPP_BOOSTER: "dhppLastDate",
  BORDETELLA: "bordatellaDate",
  DEWORMING: "dewormingLastDate",
  FLEA_TICK: "fleaTickDate",
};

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

  // Sync protocols from pet health record — marks completed + sets due dates
  const syncVaccinationsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/service-dogs/${dogId}/protocols/sync-health`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "שגיאה בסנכרון");
      }
      return res.json() as Promise<{ completed: number; dueDatesSet: number; total: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
      if (data.total === 0) {
        toast.info("אין שינויים — הפרוטוקולים כבר מעודכנים");
      } else {
        const parts = [];
        if (data.completed > 0) parts.push(`${data.completed} סומנו כבוצעו`);
        if (data.dueDatesSet > 0) parts.push(`${data.dueDatesSet} מועדים עודכנו`);
        toast.success(`סנכרון הושלם: ${parts.join(", ")}`);
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "שגיאה בסנכרון חיסונים");
    },
  });

  // Show sync banner if dog has any health data that could update protocols
  const hasSyncableHealth = !!(
    dog.pet.health?.rabiesLastDate ||
    dog.pet.health?.rabiesValidUntil ||
    dog.pet.health?.dhppLastDate ||
    dog.pet.health?.bordatellaDate ||
    dog.pet.health?.dewormingLastDate ||
    dog.pet.health?.fleaTickExpiryDate
  );
  const syncableCount = hasSyncableHealth ? 1 : 0; // keep banner logic working

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
      {/* Vaccination sync banner */}
      {syncableCount > 0 && (
        <div className="rounded-xl p-3 border border-blue-200 bg-blue-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Stethoscope className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span className="text-sm text-blue-800">
              נמצאו נתוני חיסונים בפרופיל הכלב — ניתן לסנכרן מועדים ולסמן פרוטוקולים שבוצעו אוטומטית
            </span>
          </div>
          <button
            className="btn-primary text-xs flex-shrink-0"
            disabled={syncVaccinationsMutation.isPending}
            onClick={() => syncVaccinationsMutation.mutate()}
          >
            {syncVaccinationsMutation.isPending ? "מסנכרן..." : "סנכרן חיסונים"}
          </button>
        </div>
      )}
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
          <div className="px-4 py-3 bg-slate-50/50 border-b">
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
                      <div className="flex gap-3 text-xs text-petra-muted mt-0.5">
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
          <h4 className="text-sm font-semibold text-petra-muted mb-2">היסטוריה</h4>
          <ComplianceEventGroup events={otherEvents} statusConfig={statusConfig} onMark={(id, status) => markMutation.mutate({ id, notificationStatus: status })} />
        </div>
      )}

      {dog.complianceEvents.length === 0 && (
        <div className="empty-state py-10">
          <AlertTriangle className="empty-state-icon" />
          <p className="text-petra-muted">אין אירועי משמעת</p>
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
              <p className="text-xs text-petra-muted">{event.eventDescription}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-petra-muted">
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const activePlacement = dog.placements.find((p) => ["ACTIVE", "TRIAL"].includes(p.status));

  const completeProcessMutation = useMutation({
    mutationFn: (placementId: string) =>
      fetch(`/api/service-placements/${placementId}/complete`, { method: "POST" }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail"] });
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
      queryClient.invalidateQueries({ queryKey: ["service-recipients"] });
      toast.success("תהליך הסתיים — הכלב והזכאי הועברו לארכיון");
      router.push("/service-dogs/dogs");
    },
    onError: () => toast.error("שגיאה בסיום התהליך"),
  });

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
                <p className="text-sm text-petra-muted mt-0.5">{activePlacement.recipient.phone}</p>
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

          {/* Complete Process Button */}
          <div className="mt-3 pt-3 border-t border-emerald-200">
            <button
              onClick={() => {
                if (confirm(`לסיים את תהליך ההכשרה והשיבוץ?\n\nהכלב ${dog.pet.name} והזכאי ${activePlacement.recipient.name} יועברו לארכיון ולא יופיעו עוד ברשימות הפעילות.`))
                  completeProcessMutation.mutate(activePlacement.id);
              }}
              disabled={completeProcessMutation.isPending}
              className="w-full text-sm text-red-600 hover:text-red-700 py-2 border border-dashed border-red-300 hover:border-red-400 rounded-xl transition-colors"
            >
              {completeProcessMutation.isPending ? "מעביר לארכיון..." : "✓ סיום תהליך הכשרה ושיבוץ → ארכיון"}
            </button>
          </div>
        </div>
      )}

      {dog.placements.length === 0 ? (
        <div className="empty-state py-10">
          <Activity className="empty-state-icon" />
          <p className="text-petra-muted">אין שיבוצים</p>
          <Link href="/service-dogs/placements" className="btn-primary mt-3 inline-flex text-sm">
            צור שיבוץ חדש
          </Link>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50/40">
            <h4 className="text-sm font-semibold">היסטוריית שיבוצים</h4>
          </div>
          <div className="divide-y">
            {dog.placements.map((placement) => {
              const sc = PLACEMENT_STATUS_MAP[placement.status];
              return (
                <div key={placement.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{placement.recipient.name}</p>
                    <div className="flex gap-3 text-xs text-petra-muted mt-0.5">
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

// ─── Training Tests Tab (ADI standards) ───

interface TrainingTest {
  id: string;
  date: string;
  examinerName: string;
  testType: string;
  categories: TestCategory[];
  overallResult: "PASS" | "FAIL" | "CONDITIONAL_PASS";
  notes: string;
}

interface TestCategory {
  id: string;
  categoryKey: string;
  result: "PASS" | "FAIL" | "NOT_TESTED";
  score: number | null;
  improvementPoints: string;
}

const ADI_TEST_CATEGORIES = [
  { key: "HEEL_ON_LEASH", label: "הליכה ברצועה" },
  { key: "HEEL_OFF_LEASH", label: "הליכה ללא רצועה" },
  { key: "SIT_STAY", label: "שב ושמור" },
  { key: "DOWN_STAY", label: "שכב ושמור" },
  { key: "COME_RECALL", label: "בוא — חזרה לקריאה" },
  { key: "STAND_FOR_EXAM", label: "עמד לבדיקה" },
  { key: "PUBLIC_ACCESS_1", label: "גישה לציבור: כניסה לבניין" },
  { key: "PUBLIC_ACCESS_2", label: "גישה לציבור: נסיעה בתחבורה" },
  { key: "PUBLIC_ACCESS_3", label: "גישה לציבור: מסעדה / קניון" },
  { key: "DISTRACTION_1", label: "הסחות: קולניות" },
  { key: "DISTRACTION_2", label: "הסחות: חזותיות" },
  { key: "TASK_SPECIFIC", label: "משימות ייחודיות לסוג הכלב" },
  { key: "HANDLER_CONTROL", label: "שליטת המטפל" },
  { key: "GREETING_STRANGERS", label: "ברכת זרים" },
  { key: "LEAVE_IT", label: "עזוב" },
  { key: "AGGRESSION_TEST", label: "בדיקת אגרסיביות" },
  { key: "SEPARATION", label: "בדיקת הפרדה מזמנית" },
  { key: "GROOMING_TOLERANCE", label: "סובלנות לטיפוח" },
];
const ADI_TEST_CATEGORY_MAP = Object.fromEntries(ADI_TEST_CATEGORIES.map((c) => [c.key, c.label]));

const TEST_TYPES = [
  { id: "INITIAL_EVAL", label: "הערכה ראשונית" },
  { id: "PROGRESS_TEST", label: "בחינת התקדמות" },
  { id: "PRE_CERT", label: "טרום הסמכה" },
  { id: "ADI_CERT", label: "בחינת הסמכה ADI" },
  { id: "ANNUAL_RETEST", label: "בחינה שנתית מחזורית" },
  { id: "OTHER", label: "אחר" },
];
const TEST_TYPE_MAP = Object.fromEntries(TEST_TYPES.map((t) => [t.id, t.label]));

const OVERALL_RESULT_MAP: Record<string, { label: string; color: string }> = {
  PASS: { label: "עבר ✓", color: "bg-emerald-100 text-emerald-700" },
  FAIL: { label: "נכשל ✗", color: "bg-red-100 text-red-600" },
  CONDITIONAL_PASS: { label: "עבר עם הערות", color: "bg-amber-100 text-amber-700" },
};

function TrainingTestsTab({ dog, dogId }: { dog: ServiceDogDetail; dogId: string }) {
  const queryClient = useQueryClient();
  const [showAddTest, setShowAddTest] = useState(false);
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);

  // All dogs for the selector in AddTestModal
  const { data: allDogs = [] } = useQuery<{ id: string; pet: { name: string } }[]>({
    queryKey: ["service-dogs"],
    queryFn: () => fetch("/api/service-dogs").then((r) => r.json()),
    staleTime: 60_000,
  });

  const tests: TrainingTest[] = Array.isArray(dog.trainingTests) ? (dog.trainingTests as TrainingTest[]) : [];

  const saveMutation = useMutation({
    mutationFn: ({ targetDogId, newTests }: { targetDogId: string; newTests: TrainingTest[] }) =>
      fetch(`/api/service-dogs/${targetDogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingTests: newTests }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", vars.targetDogId] });
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
      toast.success("מבחן נשמר");
      setShowAddTest(false);
    },
    onError: () => toast.error("שגיאה בשמירת מבחן"),
  });

  const deleteTest = (testId: string) => {
    if (!confirm("למחוק את המבחן?")) return;
    saveMutation.mutate({ targetDogId: dogId, newTests: tests.filter((t) => t.id !== testId) });
  };

  const passCount = tests.filter((t) => t.overallResult === "PASS" || t.overallResult === "CONDITIONAL_PASS").length;
  const failCount = tests.filter((t) => t.overallResult === "FAIL").length;

  return (
    <div className="space-y-4">
      {tests.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold">{tests.length}</p>
            <p className="text-xs text-petra-muted">מבחנים</p>
          </div>
          <div className="card p-3 text-center border-emerald-200 bg-emerald-50">
            <p className="text-2xl font-bold text-emerald-700">{passCount}</p>
            <p className="text-xs text-emerald-600">עברו</p>
          </div>
          <div className="card p-3 text-center border-red-200 bg-red-50">
            <p className="text-2xl font-bold text-red-700">{failCount}</p>
            <p className="text-xs text-red-600">נכשלו</p>
          </div>
        </div>
      )}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-brand-500" />
            מבחני הכשרה ADI ({tests.length})
          </h3>
        </div>
        <div className="space-y-3">
          {tests.map((test) => {
            const res = OVERALL_RESULT_MAP[test.overallResult];
            const isExpanded = expandedTestId === test.id;
            return (
              <div key={test.id} className="rounded-xl border overflow-hidden">
                <div
                  className="p-4 flex items-start justify-between cursor-pointer hover:bg-slate-50/40"
                  onClick={() => setExpandedTestId(isExpanded ? null : test.id)}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{TEST_TYPE_MAP[test.testType] || test.testType}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", res?.color)}>
                        {res?.label || test.overallResult}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-petra-muted">
                      {test.date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(test.date)}
                        </span>
                      )}
                      {test.examinerName && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {test.examinerName}
                        </span>
                      )}
                      <span>{test.categories?.length || 0} קטגוריות</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTest(test.id); }}
                      className="w-7 h-7 rounded flex items-center justify-center hover:bg-red-100 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t bg-slate-50/30 pt-3 space-y-3">
                    <div className="divide-y">
                      {(test.categories || []).map((cat) => (
                        <div key={cat.id} className="flex items-start justify-between py-1.5 gap-2">
                          <div className="flex items-start gap-2 flex-1">
                            <span className={cn("text-xs font-bold mt-0.5 shrink-0",
                              cat.result === "PASS" ? "text-emerald-600" :
                              cat.result === "FAIL" ? "text-red-600" : "text-stone-400")}>
                              {cat.result === "PASS" ? "✓" : cat.result === "FAIL" ? "✗" : "—"}
                            </span>
                            <div>
                              <p className="text-sm">{ADI_TEST_CATEGORY_MAP[cat.categoryKey] || cat.categoryKey}</p>
                              {cat.improvementPoints && (
                                <p className="text-xs text-amber-600 mt-0.5">{cat.improvementPoints}</p>
                              )}
                            </div>
                          </div>
                          {cat.score != null && (
                            <span className="text-xs font-mono bg-white border rounded px-1.5 py-0.5 shrink-0">{cat.score}/10</span>
                          )}
                        </div>
                      ))}
                    </div>
                    {test.notes && (
                      <div className="bg-white rounded-lg p-3 border">
                        <p className="text-xs text-petra-muted mb-1">הערות כלליות</p>
                        <p className="text-sm">{test.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <button
            onClick={() => setShowAddTest(true)}
            className="w-full text-sm text-brand-500 hover:text-brand-600 py-2.5 border border-dashed border-brand-200 hover:border-brand-300 rounded-xl transition-colors"
          >
            + הוסף מבחן הכשרה
          </button>
        </div>
      </div>

      {showAddTest && (
        <AddTrainingTestModal
          currentDogId={dogId}
          currentDogName={dog.pet.name}
          allDogs={allDogs}
          onSave={(test, targetDogId) => {
            if (targetDogId === dogId) {
              saveMutation.mutate({ targetDogId: dogId, newTests: [test, ...tests] });
            } else {
              // Save to different dog — fetch their existing tests first then append
              fetch(`/api/service-dogs/${targetDogId}`).then((r) => r.json()).then((d) => {
                const existing: TrainingTest[] = Array.isArray(d.trainingTests) ? (d.trainingTests as TrainingTest[]) : [];
                saveMutation.mutate({ targetDogId, newTests: [test, ...existing] });
              });
            }
          }}
          onClose={() => setShowAddTest(false)}
          isSaving={saveMutation.isPending}
        />
      )}
    </div>
  );
}

function AddTrainingTestModal({
  onSave, onClose, isSaving, currentDogId, currentDogName, allDogs,
}: {
  onSave: (test: TrainingTest, targetDogId: string) => void;
  onClose: () => void;
  isSaving: boolean;
  currentDogId: string;
  currentDogName: string;
  allDogs: { id: string; pet: { name: string } }[];
}) {
  const [selectedDogId, setSelectedDogId] = useState(currentDogId);
  const [testType, setTestType] = useState("PROGRESS_TEST");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [examinerName, setExaminerName] = useState("");
  const [overallResult, setOverallResult] = useState<"PASS" | "FAIL" | "CONDITIONAL_PASS">("PASS");
  const [notes, setNotes] = useState("");
  const [categories, setCategories] = useState<TestCategory[]>(
    ADI_TEST_CATEGORIES.map((c) => ({
      id: crypto.randomUUID(),
      categoryKey: c.key,
      result: "NOT_TESTED" as const,
      score: null,
      improvementPoints: "",
    }))
  );

  const updateCategory = (categoryKey: string, field: string, value: string | number | null) => {
    setCategories((prev) =>
      prev.map((c) => (c.categoryKey === categoryKey ? { ...c, [field]: value } : c))
    );
  };

  const handleSave = () => {
    onSave({
      id: crypto.randomUUID(),
      date,
      examinerName,
      testType,
      categories: categories.filter((c) => c.result !== "NOT_TESTED"),
      overallResult,
      notes,
    }, selectedDogId);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">הוספת מבחן הכשרה</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Dog selector */}
          <div className="bg-slate-50 rounded-xl p-3 border">
            <label className="label text-xs mb-1">כלב מקושר למבחן</label>
            <select
              value={selectedDogId}
              onChange={(e) => setSelectedDogId(e.target.value)}
              className="input w-full text-sm"
            >
              {allDogs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.pet.name}{d.id === currentDogId ? " (נוכחי)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">סוג מבחן</label>
              <select value={testType} onChange={(e) => setTestType(e.target.value)} className="input w-full">
                {TEST_TYPES.map((t) => (<option key={t.id} value={t.id}>{t.label}</option>))}
              </select>
            </div>
            <div>
              <label className="label">תאריך</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">שם הבוחן</label>
              <input value={examinerName} onChange={(e) => setExaminerName(e.target.value)} className="input w-full" placeholder="שם הבוחן / מעריך" />
            </div>
            <div>
              <label className="label">תוצאה כללית</label>
              <select value={overallResult} onChange={(e) => setOverallResult(e.target.value as "PASS" | "FAIL" | "CONDITIONAL_PASS")} className="input w-full">
                <option value="PASS">עבר ✓</option>
                <option value="CONDITIONAL_PASS">עבר עם הערות</option>
                <option value="FAIL">נכשל ✗</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label mb-2">קטגוריות מבחן ADI</label>
            <div className="border rounded-xl overflow-hidden">
              <div className="grid grid-cols-[2fr_80px_60px_1fr] gap-0 bg-slate-50 px-3 py-2 text-xs font-semibold text-petra-muted border-b">
                <span>קטגוריה</span>
                <span className="text-center">תוצאה</span>
                <span className="text-center">ניקוד</span>
                <span>נקודות לשיפור</span>
              </div>
              <div className="divide-y max-h-64 overflow-y-auto">
                {categories.map((cat) => (
                  <div key={cat.categoryKey} className="grid grid-cols-[2fr_80px_60px_1fr] gap-2 px-3 py-2 items-center">
                    <span className="text-sm">{ADI_TEST_CATEGORY_MAP[cat.categoryKey]}</span>
                    <select
                      value={cat.result}
                      onChange={(e) => updateCategory(cat.categoryKey, "result", e.target.value)}
                      className="text-xs border rounded px-1 py-1 bg-white"
                    >
                      <option value="NOT_TESTED">—</option>
                      <option value="PASS">עבר</option>
                      <option value="FAIL">נכשל</option>
                    </select>
                    <input
                      type="number" min="0" max="10"
                      value={cat.score ?? ""}
                      onChange={(e) => updateCategory(cat.categoryKey, "score", e.target.value ? Number(e.target.value) : null)}
                      className="text-xs border rounded px-1 py-1 w-full text-center"
                      placeholder="—"
                    />
                    <input
                      type="text"
                      value={cat.improvementPoints}
                      onChange={(e) => updateCategory(cat.categoryKey, "improvementPoints", e.target.value)}
                      className="text-xs border rounded px-1.5 py-1 w-full"
                      placeholder="הערות..."
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="label">הערות כלליות</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input w-full" rows={3} placeholder="סיכום המבחן, המלצות להמשך..." />
          </div>
        </div>
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <button onClick={handleSave} disabled={isSaving} className="btn-primary flex-1">
            {isSaving ? "שומר..." : "שמור מבחן"}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ─── Documents Tab ───

interface DogDocument {
  id: string;
  name: string;
  url: string;
  docType: string;
  uploadedAt: string;
}

const DOG_DOC_TYPES = [
  { id: "HEALTH_CERT", label: "תעודת בריאות" },
  { id: "VACCINATION", label: "תעודת חיסונים" },
  { id: "TRAINING_CERT", label: "תעודת אימון" },
  { id: "VET_REPORT", label: "דוח וטרינרי" },
  { id: "PEDIGREE", label: "פנקס" },
  { id: "ADI_CERT", label: "אישור ADI" },
  { id: "GOV_REPORT", label: "דיווח ממשלתי" },
  { id: "OTHER", label: "אחר" },
];
const DOG_DOC_TYPE_MAP = Object.fromEntries(DOG_DOC_TYPES.map((d) => [d.id, d.label]));

function DocumentsTab({ dog, dogId }: { dog: ServiceDogDetail; dogId: string }) {
  const queryClient = useQueryClient();
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docName, setDocName] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [docType, setDocType] = useState("OTHER");
  const [sourceMode, setSourceMode] = useState<"url" | "file">("url");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const documents: DogDocument[] = Array.isArray(dog.documents) ? (dog.documents as DogDocument[]) : [];

  const resetForm = () => {
    setShowAddDoc(false);
    setDocName("");
    setDocUrl("");
    setDocType("OTHER");
    setSourceMode("url");
    setSelectedFile(null);
  };

  const saveMutation = useMutation({
    mutationFn: (docs: DogDocument[]) =>
      fetch(`/api/service-dogs/${dogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents: docs }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      toast.success("מסמכים עודכנו");
      resetForm();
      setDocType("OTHER");
    },
    onError: () => toast.error("שגיאה בשמירת מסמך"),
  });

  const addDoc = async () => {
    if (!docName.trim()) return;
    if (sourceMode === "file") {
      if (!selectedFile) return;
      setIsUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", selectedFile);
        fd.append("name", docName.trim());
        fd.append("docType", docType);
        const res = await fetch(`/api/service-dogs/${dogId}/documents`, { method: "POST", body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error || "שגיאה בהעלאת הקובץ");
          return;
        }
        queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
        toast.success("מסמך הועלה בהצלחה");
        resetForm();
      } finally {
        setIsUploading(false);
      }
    } else {
      const newDoc: DogDocument = {
        id: crypto.randomUUID(),
        name: docName.trim(),
        url: docUrl.trim(),
        docType,
        uploadedAt: new Date().toISOString(),
      };
      saveMutation.mutate([newDoc, ...documents]);
    }
  };

  const deleteDoc = (docId: string) => {
    if (!confirm("למחוק את המסמך?")) return;
    saveMutation.mutate(documents.filter((d) => d.id !== docId));
  };

  const isBusy = saveMutation.isPending || isUploading;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4 text-brand-500" />
          מסמכים ({documents.length})
        </h3>
      </div>
      <div className="space-y-3">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl border bg-slate-50/50 group">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-brand-500" />
              </div>
              <div>
                <p className="text-sm font-medium">{doc.name}</p>
                <p className="text-xs text-petra-muted">
                  {DOG_DOC_TYPE_MAP[doc.docType] || doc.docType}
                  {doc.uploadedAt && ` · ${formatDate(doc.uploadedAt)}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {doc.url && (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded flex items-center justify-center hover:bg-brand-50 transition-colors"
                  title="פתח מסמך"
                >
                  <Eye className="w-4 h-4 text-brand-500" />
                </a>
              )}
              <button
                onClick={() => deleteDoc(doc.id)}
                className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded flex items-center justify-center hover:bg-red-100 transition-all"
                title="מחק"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>
        ))}

        {showAddDoc ? (
          <div className="p-4 rounded-xl border bg-slate-50/50 space-y-3">
            <div>
              <label className="label">שם המסמך *</label>
              <input value={docName} onChange={(e) => setDocName(e.target.value)} className="input w-full" placeholder="לדוג׳ תעודת בריאות 2025" />
            </div>
            <div>
              <label className="label">סוג מסמך</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input w-full">
                {DOG_DOC_TYPES.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </div>
            {/* Source mode toggle */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => { setSourceMode("url"); setSelectedFile(null); }}
                className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${sourceMode === "url" ? "bg-white shadow-sm font-medium" : "text-petra-muted hover:bg-white/60"}`}
              >
                קישור URL
              </button>
              <button
                type="button"
                onClick={() => { setSourceMode("file"); setDocUrl(""); }}
                className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${sourceMode === "file" ? "bg-white shadow-sm font-medium" : "text-petra-muted hover:bg-white/60"}`}
              >
                העלאת קובץ
              </button>
            </div>

            {sourceMode === "url" ? (
              <div>
                <label className="label">קישור למסמך (URL)</label>
                <input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} className="input w-full" placeholder="https://..." type="url" dir="ltr" />
                <p className="text-xs text-petra-muted mt-1">הדבק קישור ל-Google Drive, Dropbox, או כל קישור אחר</p>
              </div>
            ) : (
              <div>
                <label className="label">קובץ להעלאה</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="input w-full text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                />
                {selectedFile && (
                  <p className="text-xs text-petra-muted mt-1">{selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)</p>
                )}
                <p className="text-xs text-petra-muted mt-1">מקסימום 10MB — PDF, Word, תמונות</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={addDoc}
                disabled={!docName.trim() || isBusy || (sourceMode === "url" ? !docUrl.trim() : !selectedFile)}
                className="btn-primary flex-1 text-sm"
              >
                {isBusy ? "שומר..." : "הוסף מסמך"}
              </button>
              <button onClick={resetForm} className="btn-secondary flex-1 text-sm">ביטול</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddDoc(true)}
            className="w-full text-sm text-brand-500 hover:text-brand-600 py-2.5 border border-dashed border-brand-200 hover:border-brand-300 rounded-xl transition-colors"
          >
            + הוסף מסמך
          </button>
        )}
      </div>
    </div>
  );
}

// ─── ID Card Tab ───

function IDCardTab({ dog, dogId }: { dog: ServiceDogDetail; dogId: string }) {
  const queryClient = useQueryClient();
  const [viewingCard, setViewingCard] = useState<IDCard | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const generateMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/service-dogs/${dogId}/id-card`, { method: "POST" }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
      toast.success("תעודת הסמכה הונפקה");
    },
    onError: () => toast.error("שגיאה בהנפקת תעודה"),
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error("תמונה גדולה מדי (מקסימום 3MB)"); return; }
    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await fetch(`/api/service-dogs/${dogId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dogPhoto: reader.result }),
        });
        queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
        toast.success("תמונת הכלב עודכנה");
      } catch {
        toast.error("שגיאה בשמירת תמונה");
      } finally {
        setUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

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
      {/* Dog photo upload section */}
      <div className="card p-4 flex items-center gap-4">
        <div className="w-20 h-20 rounded-xl border-2 border-dashed border-petra-border overflow-hidden flex items-center justify-center bg-slate-50 shrink-0">
          {dog.dogPhoto ? (
            <img src={dog.dogPhoto} alt="תמונת כלב" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-8 h-8 text-petra-muted/40" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium mb-1">תמונת הכלב לתעודה</p>
          <p className="text-xs text-petra-muted mb-2">התמונה תוצג בתעודת ההסמכה</p>
          <label className="btn-secondary text-xs cursor-pointer flex items-center gap-1.5 w-fit">
            <Upload className="w-3.5 h-3.5" />
            {uploadingPhoto ? "מעלה..." : dog.dogPhoto ? "החלף תמונה" : "העלה תמונה"}
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
          </label>
        </div>
      </div>

      {dog.phase !== "CERTIFIED" && !activeCard && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-700">הכלב טרם הוסמך</p>
            <p className="text-sm text-amber-600 mt-0.5">
              ניתן להנפיק תעודת הסמכה רק לכלבים מוסמכים (שלב: מוסמך)
            </p>
          </div>
        </div>
      )}

      {!activeCard ? (
        <div className="card p-8 text-center">
          <CreditCard className="w-12 h-12 mx-auto text-petra-muted/40 mb-3" />
          <p className="text-petra-muted mb-4">אין תעודת הסמכה פעילה</p>
          {dog.phase === "CERTIFIED" && (
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="btn-primary inline-flex items-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              {generateMutation.isPending ? "מייצר..." : "הנפק תעודת הסמכה"}
            </button>
          )}
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-500" />
                תעודת הסמכה פעילה
              </h4>
              <p className="text-xs text-petra-muted mt-0.5">
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
                    { label: "זכאי", value: data.recipientName },
                    { label: "תאריך הסמכה", value: data.certificationDate ? formatDate(data.certificationDate) : null },
                  ]
                    .filter((f) => f.value)
                    .map((f) => (
                      <div key={f.label} className="flex justify-between py-1 border-b last:border-0">
                        <span className="text-petra-muted">{f.label}</span>
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

// ─── Dog File Tab ───

const BEHAVIOR_FLAGS: { key: keyof PetBehavior; label: string }[] = [
  { key: "dogAggression", label: "תוקפנות כלפי כלבים" },
  { key: "humanAggression", label: "תוקפנות כלפי בני אדם" },
  { key: "leashReactivity", label: "ריאקטיביות בשרשרת" },
  { key: "leashPulling", label: "משיכה בשרשרת" },
  { key: "jumping", label: "קפיצה על אנשים" },
  { key: "separationAnxiety", label: "חרדת נטישה" },
  { key: "excessiveBarking", label: "נביחות מוגזמות" },
  { key: "destruction", label: "הרס" },
  { key: "resourceGuarding", label: "שמירת משאבים" },
  { key: "fears", label: "פחדים" },
  { key: "badWithKids", label: "לא מתאים לילדים" },
  { key: "houseSoiling", label: "כלוך בבית" },
  { key: "biteHistory", label: "היסטוריית נשיכה" },
  { key: "priorTraining", label: "עבר אילוף בעבר" },
];

function DogFileTab({ dog, dogId }: { dog: ServiceDogDetail; dogId: string }) {
  const queryClient = useQueryClient();
  const pet = dog.pet;

  const [showHealthModal, setShowHealthModal] = useState(false);
  const [showBehaviorModal, setShowBehaviorModal] = useState(false);
  const [showFeedingModal, setShowFeedingModal] = useState(false);
  const [medModal, setMedModal] = useState<{ med: PetMedication | null } | null>(null);
  const [deletingMed, setDeletingMed] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });

  // ── Active behavior flags ──
  const behaviorFlags = BEHAVIOR_FLAGS.filter(({ key }) => {
    const v = pet.behavior?.[key];
    return typeof v === "boolean" && v;
  });
  const customIssues: string[] = (() => {
    try { return pet.behavior?.customIssues ? JSON.parse(pet.behavior.customIssues) : []; }
    catch { return []; }
  })();

  const toDate = (v: string | null) => v ? new Date(v).toLocaleDateString("he-IL") : null;

  const deleteMedMutation = useMutation({
    mutationFn: (medId: string) =>
      fetch(`/api/pets/${pet.id}/medications/${medId}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => { invalidate(); setDeletingMed(null); toast.success("תרופה הוסרה"); },
    onError: () => toast.error("שגיאה במחיקת תרופה"),
  });

  return (
    <div className="space-y-4">
      {/* Basic dog info */}
      <div className="card p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Dog className="w-4 h-4 text-brand-500" />
          פרטי כלב
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {/* Microchip first — most important ID */}
          {pet.microchip && (
            <div className="col-span-2 sm:col-span-1 bg-brand-50 rounded-lg p-2.5 border border-brand-200">
              <p className="text-xs text-brand-600 font-medium">מספר שבב</p>
              <p className="font-bold font-mono">{pet.microchip}</p>
            </div>
          )}
          {pet.birthDate && (
            <div>
              <p className="text-xs text-petra-muted">תאריך לידה</p>
              <p className="font-medium">{toDate(pet.birthDate)}</p>
            </div>
          )}
          {pet.weight && (
            <div>
              <p className="text-xs text-petra-muted">משקל</p>
              <p className="font-medium">{pet.weight} ק״ג</p>
            </div>
          )}
          {pet.health?.neuteredSpayed && (
            <div>
              <p className="text-xs text-petra-muted">מצב</p>
              <p className="font-medium">מסורס / עקור</p>
            </div>
          )}
          {pet.health?.vetName && (
            <div>
              <p className="text-xs text-petra-muted">וטרינר</p>
              <p className="font-medium">{pet.health.vetName}</p>
              {pet.health.vetPhone && <p className="text-xs text-petra-muted">{pet.health.vetPhone}</p>}
            </div>
          )}
          {pet.health?.originInfo && (
            <div>
              <p className="text-xs text-petra-muted">מקור הכלב</p>
              <p className="font-medium">{pet.health.originInfo}</p>
            </div>
          )}
        </div>

        {/* Service Dog — acquisition, license, maintenance */}
        <SDExtraInfoSection dog={dog} dogId={dogId} />
        {pet.medicalNotes && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-petra-muted mb-1">הערות רפואיות</p>
            <p className="text-sm">{pet.medicalNotes}</p>
          </div>
        )}
      </div>

      {/* Feeding */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4 text-amber-500" />
            האכלה
          </h3>
          <button
            className="btn-ghost flex items-center gap-1.5 text-sm"
            onClick={() => setShowFeedingModal(true)}
          >
            <Pencil className="w-3.5 h-3.5" />
            ערוך
          </button>
        </div>
        {pet.foodBrand || pet.foodGramsPerDay || pet.foodFrequency || pet.foodNotes ? (
          <div className="space-y-2 text-sm">
            {pet.foodBrand && (
              <div className="flex gap-2">
                <span className="text-petra-muted">מותג:</span>
                <span className="font-medium">{pet.foodBrand}</span>
              </div>
            )}
            <div className="flex gap-6">
              {pet.foodGramsPerDay && (
                <div className="flex gap-2">
                  <span className="text-petra-muted">כמות:</span>
                  <span className="font-medium">{pet.foodGramsPerDay} גרם/יום</span>
                </div>
              )}
              {pet.foodFrequency && (
                <div className="flex gap-2">
                  <span className="text-petra-muted">תדירות:</span>
                  <span>{pet.foodFrequency}</span>
                </div>
              )}
            </div>
            {pet.foodNotes && <p className="text-petra-muted text-xs">{pet.foodNotes}</p>}
          </div>
        ) : (
          <button
            className="w-full text-sm text-amber-400 hover:text-amber-600 py-2 border border-dashed border-amber-200 hover:border-amber-300 rounded-xl transition-colors"
            onClick={() => setShowFeedingModal(true)}
          >
            + הוסף פרטי האכלה
          </button>
        )}
      </div>

      {/* Medications */}
      <div className="card p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-3">
          <Pill className="w-4 h-4 text-red-500" />
          תרופות ({pet.medications.length})
        </h3>
        {pet.medications.length > 0 ? (
          <div className="space-y-2">
            {pet.medications.map((med) => (
              <div key={med.id} className="flex items-start justify-between p-3 bg-red-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium">{med.medName}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-petra-muted mt-0.5">
                    {med.dosage && <span>מינון: {med.dosage}</span>}
                    {med.frequency && <span>תדירות: {med.frequency}</span>}
                    {med.times && <span>שעות: {med.times}</span>}
                    {med.startDate && <span>מ-{toDate(med.startDate)}</span>}
                    {med.endDate && <span>עד {toDate(med.endDate)}</span>}
                  </div>
                  {med.instructions && <p className="text-xs text-petra-muted mt-0.5">{med.instructions}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white transition-colors"
                    onClick={() => setMedModal({ med })}
                  >
                    <Pencil className="w-3.5 h-3.5 text-brand-500" />
                  </button>
                  <button
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white transition-colors"
                    onClick={() => setDeletingMed(med.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
            <button
              className="w-full text-sm text-red-400 hover:text-red-600 py-2 border border-dashed border-red-200 hover:border-red-300 rounded-xl transition-colors"
              onClick={() => setMedModal({ med: null })}
            >
              + הוסף תרופה נוספת
            </button>
          </div>
        ) : (
          <button
            className="w-full text-sm text-red-400 hover:text-red-600 py-2 border border-dashed border-red-200 hover:border-red-300 rounded-xl transition-colors"
            onClick={() => setMedModal({ med: null })}
          >
            + הוסף תרופה
          </button>
        )}
      </div>

      {/* Health + Vaccinations */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Heart className="w-4 h-4 text-emerald-500" />
            בריאות וחיסונים
          </h3>
          <button
            className="btn-ghost flex items-center gap-1.5 text-sm"
            onClick={() => setShowHealthModal(true)}
          >
            <Pencil className="w-3.5 h-3.5" />
            ערוך
          </button>
        </div>
        {pet.health ? (
          <div className="space-y-4">
            {/* Medical info */}
            {(pet.health.allergies || pet.health.medicalConditions || pet.health.surgeriesHistory || pet.health.activityLimitations) && (
              <div>
                <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">מצב רפואי</p>
                <div className="space-y-1.5 text-sm">
                  {pet.health.allergies && (
                    <div className="flex gap-2">
                      <span className="text-petra-muted">אלרגיות:</span>
                      <span>{pet.health.allergies}</span>
                    </div>
                  )}
                  {pet.health.medicalConditions && (
                    <div className="flex gap-2">
                      <span className="text-petra-muted">מצבים רפואיים:</span>
                      <span>{pet.health.medicalConditions}</span>
                    </div>
                  )}
                  {pet.health.surgeriesHistory && (
                    <div className="flex gap-2">
                      <span className="text-petra-muted">ניתוחים:</span>
                      <span>{pet.health.surgeriesHistory}</span>
                    </div>
                  )}
                  {pet.health.activityLimitations && (
                    <div className="flex gap-2">
                      <span className="text-petra-muted">מגבלות:</span>
                      <span>{pet.health.activityLimitations}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Vaccinations */}
            <div>
              <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">חיסונים וטיפולים</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { label: "כלבת", date: pet.health.rabiesLastDate, until: pet.health.rabiesValidUntil },
                  { label: "משושה בוגר (DHPP)", date: pet.health.dhppLastDate, until: null },
                  { label: "שעלת מכלאות", date: pet.health.bordatellaDate, until: null },
                  { label: "תולעת הפארק", date: pet.health.parkWormDate, until: null },
                  { label: "תילוע", date: pet.health.dewormingLastDate, until: null },
                  ...(pet.health.fleaTickDate ? [{ label: pet.health.fleaTickType || "קרציות ופרעושים", date: pet.health.fleaTickDate, until: pet.health.fleaTickExpiryDate }] : []),
                ]
                  .filter((v) => v.date)
                  .map((v) => (
                    <div key={v.label} className="flex items-center justify-between p-2.5 bg-emerald-50 rounded-lg text-sm">
                      <span className="text-petra-text font-medium">{v.label}</span>
                      <div className="text-right">
                        <span className="text-petra-muted">{toDate(v.date)}</span>
                        {v.until && (
                          <p className="text-xs text-petra-muted">תוקף: {toDate(v.until)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                {[pet.health.rabiesLastDate, pet.health.dhppLastDate, pet.health.bordatellaDate, pet.health.parkWormDate, pet.health.dewormingLastDate, pet.health.fleaTickDate].every((d) => !d) && (
                  <p className="text-sm text-petra-muted col-span-2">אין חיסונים מתועדים</p>
                )}
              </div>
            </div>
            {/* Puppy vaccines */}
            {(pet.health.dhppPuppy1Date || pet.health.dhppPuppy2Date || pet.health.dhppPuppy3Date) && (
              <div>
                <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">משושה גורים</p>
                <div className="flex gap-3 text-sm">
                  {pet.health.dhppPuppy1Date && <span className="bg-blue-50 px-2 py-1 rounded-lg">מנה 1: {toDate(pet.health.dhppPuppy1Date)}</span>}
                  {pet.health.dhppPuppy2Date && <span className="bg-blue-50 px-2 py-1 rounded-lg">מנה 2: {toDate(pet.health.dhppPuppy2Date)}</span>}
                  {pet.health.dhppPuppy3Date && <span className="bg-blue-50 px-2 py-1 rounded-lg">מנה 3: {toDate(pet.health.dhppPuppy3Date)}</span>}
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            className="w-full text-sm text-emerald-400 hover:text-emerald-600 py-2 border border-dashed border-emerald-200 hover:border-emerald-300 rounded-xl transition-colors"
            onClick={() => setShowHealthModal(true)}
          >
            + הוסף מידע בריאות וחיסונים
          </button>
        )}
      </div>

      {/* Behavior */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            התנהגות
          </h3>
          <button
            className="btn-ghost flex items-center gap-1.5 text-sm"
            onClick={() => setShowBehaviorModal(true)}
          >
            <Pencil className="w-3.5 h-3.5" />
            ערוך
          </button>
        </div>
        {behaviorFlags.length > 0 || customIssues.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {behaviorFlags.map(({ key, label }) => (
                <span key={key} className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                  {label}
                </span>
              ))}
              {customIssues.map((issue, idx) => (
                <span key={idx} className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                  {issue}
                </span>
              ))}
            </div>
            {pet.behavior?.biteHistory && pet.behavior.biteDetails && (
              <div className="text-sm">
                <span className="text-petra-muted">פרטי נשיכה: </span>
                <span>{pet.behavior.biteDetails}</span>
              </div>
            )}
            {pet.behavior?.triggers && (
              <div className="text-sm">
                <span className="text-petra-muted">טריגרים: </span>
                <span>{pet.behavior.triggers}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-petra-muted">לא תועדו בעיות התנהגות</p>
        )}
      </div>

      {/* Modals */}
      {showHealthModal && (
        <SDHealthModal
          petId={pet.id}
          petName={pet.name}
          health={pet.health}
          dogId={dogId}
          onClose={() => setShowHealthModal(false)}
        />
      )}
      {showBehaviorModal && (
        <SDBehaviorModal
          petId={pet.id}
          petName={pet.name}
          behavior={pet.behavior}
          dogId={dogId}
          onClose={() => setShowBehaviorModal(false)}
        />
      )}
      {showFeedingModal && (
        <SDFeedingModal
          petId={pet.id}
          petName={pet.name}
          pet={pet}
          dogId={dogId}
          onClose={() => setShowFeedingModal(false)}
        />
      )}
      {medModal !== null && (
        <SDMedModal
          petId={pet.id}
          petName={pet.name}
          med={medModal.med}
          dogId={dogId}
          onClose={() => setMedModal(null)}
        />
      )}
      {deletingMed && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setDeletingMed(null)} />
          <div className="modal-content max-w-sm p-6">
            <p className="font-medium mb-4">למחוק תרופה זו?</p>
            <div className="flex gap-3">
              <button
                className="btn-primary flex-1 bg-red-600 hover:bg-red-700"
                disabled={deleteMedMutation.isPending}
                onClick={() => deleteMedMutation.mutate(deletingMed)}
              >
                {deleteMedMutation.isPending ? "מוחק..." : "מחק"}
              </button>
              <button className="btn-secondary" onClick={() => setDeletingMed(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SD Extra Info Section (acquisition / license / logistics) ───

function SDExtraInfoSection({ dog, dogId }: { dog: ServiceDogDetail; dogId: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    pedigreeNumber: dog.pedigreeNumber ?? "",
    purchasePrice: dog.purchasePrice != null ? String(dog.purchasePrice) : "",
    purchaseSource: dog.purchaseSource ?? "",
    licenseNumber: dog.licenseNumber ?? "",
    licenseExpiry: dog.licenseExpiry ? dog.licenseExpiry.split("T")[0] : "",
    maintenanceNotes: dog.maintenanceNotes ?? "",
    yardGroup: dog.yardGroup ?? "",
    feedingInstructions: dog.feedingInstructions ?? "",
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/service-dogs/${dogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedigreeNumber: form.pedigreeNumber || null,
          purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : null,
          purchaseSource: form.purchaseSource || null,
          licenseNumber: form.licenseNumber || null,
          licenseExpiry: form.licenseExpiry || null,
          maintenanceNotes: form.maintenanceNotes || null,
          yardGroup: form.yardGroup || null,
          feedingInstructions: form.feedingInstructions || null,
        }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      setEditing(false);
      toast.success("פרטים עודכנו");
    },
    onError: () => toast.error("שגיאה בשמירה"),
  });

  const hasData = dog.pedigreeNumber || dog.purchasePrice || dog.purchaseSource || dog.licenseNumber || dog.maintenanceNotes;

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-petra-muted flex items-center gap-1.5">
          <Building className="w-3.5 h-3.5" />
          מקור, רישוי ואחזקה
        </h4>
        <button className="btn-ghost text-xs flex items-center gap-1" onClick={() => setEditing(!editing)}>
          <Pencil className="w-3 h-3" />
          {editing ? "סגור" : "ערוך"}
        </button>
      </div>
      {editing ? (
        <div className="space-y-3 bg-slate-50 rounded-xl p-4 border">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">תעודת יוחסין</label>
              <input className="input w-full text-sm" value={form.pedigreeNumber} onChange={(e) => setForm((p) => ({ ...p, pedigreeNumber: e.target.value }))} placeholder="מספר תעודת יוחסין" />
            </div>
            <div>
              <label className="label text-xs">סכום קניה (₪)</label>
              <input type="number" className="input w-full text-sm" value={form.purchasePrice} onChange={(e) => setForm((p) => ({ ...p, purchasePrice: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="label text-xs">מקור קניה</label>
              <input className="input w-full text-sm" value={form.purchaseSource} onChange={(e) => setForm((p) => ({ ...p, purchaseSource: e.target.value }))} placeholder="שם המגדל / ארגון" />
            </div>
            <div>
              <label className="label text-xs">רשיון עירוני</label>
              <input className="input w-full text-sm" value={form.licenseNumber} onChange={(e) => setForm((p) => ({ ...p, licenseNumber: e.target.value }))} placeholder="מספר רשיון" />
            </div>
            <div>
              <label className="label text-xs">תוקף רשיון</label>
              <input type="date" className="input w-full text-sm" value={form.licenseExpiry} onChange={(e) => setForm((p) => ({ ...p, licenseExpiry: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs">קבוצת חצר</label>
              <input className="input w-full text-sm" value={form.yardGroup} onChange={(e) => setForm((p) => ({ ...p, yardGroup: e.target.value }))} placeholder="גורים / רטריברים / גדולים" />
            </div>
          </div>
          <div>
            <label className="label text-xs">הוראות האכלה מיוחדות</label>
            <textarea className="input w-full text-sm" rows={2} value={form.feedingInstructions} onChange={(e) => setForm((p) => ({ ...p, feedingInstructions: e.target.value }))} placeholder="הוראות האכלה ייחודיות לכלב שירות זה" />
          </div>
          <div>
            <label className="label text-xs">הערות אחזקה</label>
            <textarea className="input w-full text-sm" rows={2} value={form.maintenanceNotes} onChange={(e) => setForm((p) => ({ ...p, maintenanceNotes: e.target.value }))} placeholder="הערות תפעולי שוטף" />
          </div>
          <div className="flex gap-2 pt-1">
            <button className="btn-primary text-sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "שומר..." : "שמור"}
            </button>
            <button className="btn-secondary text-sm" onClick={() => setEditing(false)}>ביטול</button>
          </div>
        </div>
      ) : hasData ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {dog.pedigreeNumber && <div><p className="text-xs text-petra-muted">תעודת יוחסין</p><p className="font-medium font-mono text-xs">{dog.pedigreeNumber}</p></div>}
          {dog.purchasePrice && <div><p className="text-xs text-petra-muted">סכום קניה</p><p className="font-medium">{dog.purchasePrice.toLocaleString("he-IL")} ₪</p></div>}
          {dog.purchaseSource && <div><p className="text-xs text-petra-muted">מקור קניה</p><p className="font-medium">{dog.purchaseSource}</p></div>}
          {dog.licenseNumber && <div><p className="text-xs text-petra-muted">רשיון עירוני</p><p className="font-medium">{dog.licenseNumber}</p></div>}
          {dog.licenseExpiry && <div><p className="text-xs text-petra-muted">תוקף רשיון</p><p className="font-medium">{formatDate(dog.licenseExpiry)}</p></div>}
          {dog.yardGroup && <div><p className="text-xs text-petra-muted">קבוצת חצר</p><p className="font-medium">{dog.yardGroup}</p></div>}
          {dog.feedingInstructions && <div className="col-span-2"><p className="text-xs text-petra-muted">הוראות האכלה</p><p className="font-medium text-xs">{dog.feedingInstructions}</p></div>}
          {dog.maintenanceNotes && <div className="col-span-2"><p className="text-xs text-petra-muted">הערות אחזקה</p><p className="text-xs text-petra-muted">{dog.maintenanceNotes}</p></div>}
        </div>
      ) : (
        <button
          className="w-full text-sm text-petra-muted hover:text-foreground py-2 border border-dashed border-slate-200 hover:border-slate-300 rounded-xl transition-colors"
          onClick={() => setEditing(true)}
        >
          + הוסף פרטי מקור ורישוי
        </button>
      )}
    </div>
  );
}

// ─── Insurance Tab ───

interface InsuranceRecord {
  id: string;
  provider: string | null;
  policyNumber: string | null;
  premium: number | null;
  deductible: number | null;
  coverageType: string | null;
  startDate: string | null;
  renewalDate: string | null;
  isActive: boolean;
  notes: string | null;
  policyDocument: string | null;
  claims: ClaimRecord[];
}

interface ClaimRecord {
  id: string;
  incidentDate: string;
  description: string | null;
  amount: number | null;
  deductiblePaid: number | null;
  invoiceAttached: boolean;
  submittedAt: string | null;
  resolvedAt: string | null;
  status: string;
  notes: string | null;
}

function InsuranceTab({ dogId }: { dogId: string }) {
  const queryClient = useQueryClient();
  const [showAddInsurance, setShowAddInsurance] = useState(false);
  const [expandedInsId, setExpandedInsId] = useState<string | null>(null);
  const [showAddClaim, setShowAddClaim] = useState<string | null>(null); // insuranceId

  const { data: insurances = [], isLoading } = useQuery<InsuranceRecord[]>({
    queryKey: ["sd-insurance", dogId],
    queryFn: () => fetch(`/api/service-dogs/${dogId}/insurance`).then((r) => r.json()),
  });

  const addInsMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch(`/api/service-dogs/${dogId}/insurance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sd-insurance", dogId] });
      setShowAddInsurance(false);
      toast.success("פוליסה נוספה");
    },
    onError: () => toast.error("שגיאה בהוספת פוליסה"),
  });

  const addClaimMutation = useMutation({
    mutationFn: ({ insuranceId, data }: { insuranceId: string; data: Record<string, unknown> }) =>
      fetch(`/api/service-dogs/${dogId}/insurance/${insuranceId}/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sd-insurance", dogId] });
      setShowAddClaim(null);
      toast.success("תביעה נוספה");
    },
    onError: () => toast.error("שגיאה בהוספת תביעה"),
  });

  const updateClaimMutation = useMutation({
    mutationFn: ({ insuranceId, claimId, status }: { insuranceId: string; claimId: string; status: string }) =>
      fetch(`/api/service-dogs/${dogId}/insurance/${insuranceId}/claims/${claimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolvedAt: ["PAID","DENIED","WITHDRAWN"].includes(status) ? new Date().toISOString() : null }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sd-insurance", dogId] });
      toast.success("תביעה עודכנה");
    },
  });

  if (isLoading) return <div className="card h-40 animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-500" />
          ביטוח כלב שירות
        </h3>
        <button className="btn-primary text-sm flex items-center gap-1.5" onClick={() => setShowAddInsurance(!showAddInsurance)}>
          <Plus className="w-4 h-4" />
          הוסף פוליסה
        </button>
      </div>

      {showAddInsurance && (
        <AddInsuranceForm
          onSave={(data) => addInsMutation.mutate(data)}
          onCancel={() => setShowAddInsurance(false)}
          isSaving={addInsMutation.isPending}
        />
      )}

      {insurances.length === 0 && !showAddInsurance && (
        <div className="card p-10 text-center">
          <ShieldCheck className="w-12 h-12 mx-auto text-petra-muted/30 mb-3" />
          <p className="text-petra-muted">אין פוליסות ביטוח</p>
        </div>
      )}

      {insurances.map((ins) => {
        const isExpanded = expandedInsId === ins.id;
        const pendingClaims = ins.claims.filter((c) => c.status === "PENDING").length;
        const totalClaimed = ins.claims.reduce((s, c) => s + (c.amount ?? 0), 0);

        return (
          <div key={ins.id} className={cn("card p-0 overflow-hidden", !ins.isActive && "opacity-70")}>
            <div
              className="p-4 flex items-start justify-between gap-3 cursor-pointer hover:bg-slate-50/40"
              onClick={() => setExpandedInsId(isExpanded ? null : ins.id)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">{ins.provider || "ביטוח לא ידוע"}</p>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", ins.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                    {ins.isActive ? "פעיל" : "לא פעיל"}
                  </span>
                  {pendingClaims > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{pendingClaims} תביעות פתוחות</span>
                  )}
                </div>
                <div className="flex gap-4 text-xs text-petra-muted mt-1 flex-wrap">
                  {ins.policyNumber && <span>פוליסה: {ins.policyNumber}</span>}
                  {ins.premium && <span>פרמיה: ₪{ins.premium.toLocaleString("he-IL")}</span>}
                  {ins.renewalDate && <span>חידוש: {formatDate(ins.renewalDate)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {ins.claims.length > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-petra-muted">{ins.claims.length} תביעות</p>
                    <p className="text-xs font-medium">₪{totalClaimed.toLocaleString("he-IL")}</p>
                  </div>
                )}
                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>

            {isExpanded && (
              <div className="border-t px-4 pb-4 pt-3 bg-slate-50/30 space-y-3">
                {/* Insurance details */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  {ins.coverageType && <div><p className="text-xs text-petra-muted">סוג כיסוי</p><p className="font-medium">{INSURANCE_COVERAGE_TYPES.find((c) => c.id === ins.coverageType)?.label || ins.coverageType}</p></div>}
                  {ins.deductible && <div><p className="text-xs text-petra-muted">השתתפות עצמית</p><p className="font-medium">₪{ins.deductible.toLocaleString("he-IL")}</p></div>}
                  {ins.startDate && <div><p className="text-xs text-petra-muted">תחילת כיסוי</p><p className="font-medium">{formatDate(ins.startDate)}</p></div>}
                </div>

                {/* Policy document */}
                {ins.policyDocument && (
                  <a
                    href={ins.policyDocument}
                    download={`policy-${ins.policyNumber || ins.id}.pdf`}
                    className="inline-flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-600 mt-2"
                  >
                    <FileTextIcon className="w-3.5 h-3.5" />
                    הורד מסמך פוליסה
                  </a>
                )}

                {/* Claims */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-sm font-semibold">תביעות</h5>
                    <button className="text-xs text-brand-500 hover:text-brand-600" onClick={() => setShowAddClaim(ins.id)}>
                      + תביעה חדשה
                    </button>
                  </div>

                  {showAddClaim === ins.id && (
                    <AddClaimForm
                      onSave={(data) => addClaimMutation.mutate({ insuranceId: ins.id, data })}
                      onCancel={() => setShowAddClaim(null)}
                      isSaving={addClaimMutation.isPending}
                    />
                  )}

                  {ins.claims.length === 0 ? (
                    <p className="text-xs text-petra-muted">אין תביעות</p>
                  ) : (
                    <div className="space-y-2">
                      {ins.claims.map((claim) => {
                        const sc = CLAIM_STATUS_MAP[claim.status] || { label: claim.status, color: "bg-slate-100 text-slate-600" };
                        return (
                          <div key={claim.id} className="bg-white rounded-lg border p-3 flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", sc.color)}>{sc.label}</span>
                                <span className="text-xs text-petra-muted">{formatDate(claim.incidentDate)}</span>
                                {claim.invoiceAttached && <span className="text-xs text-emerald-600">✓ חשבונית</span>}
                              </div>
                              {claim.description && <p className="text-sm">{claim.description}</p>}
                              <div className="flex gap-3 text-xs text-petra-muted mt-0.5">
                                {claim.amount && <span>סכום: ₪{claim.amount.toLocaleString("he-IL")}</span>}
                                {claim.deductiblePaid && <span>ה״ע: ₪{claim.deductiblePaid.toLocaleString("he-IL")}</span>}
                                {claim.submittedAt && <span>הוגש: {formatDate(claim.submittedAt)}</span>}
                              </div>
                            </div>
                            {claim.status === "PENDING" && (
                              <div className="flex gap-1 shrink-0">
                                <button
                                  onClick={() => updateClaimMutation.mutate({ insuranceId: ins.id, claimId: claim.id, status: "PAID" })}
                                  className="text-xs text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded border border-emerald-200"
                                >שולם</button>
                                <button
                                  onClick={() => updateClaimMutation.mutate({ insuranceId: ins.id, claimId: claim.id, status: "DENIED" })}
                                  className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded border border-red-200"
                                >נדחה</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {ins.notes && <p className="text-xs text-petra-muted">{ins.notes}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AddInsuranceForm({ onSave, onCancel, isSaving }: { onSave: (d: Record<string, unknown>) => void; onCancel: () => void; isSaving: boolean }) {
  const [form, setForm] = useState({ provider: "", policyNumber: "", premium: "", deductible: "", coverageType: "", startDate: "", renewalDate: "", notes: "" });
  const [policyDocument, setPolicyDocument] = useState<string | null>(null);
  const [docName, setDocName] = useState<string | null>(null);
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("קובץ גדול מדי (מקסימום 5MB)"); return; }
    setDocName(file.name);
    const reader = new FileReader();
    reader.onload = () => setPolicyDocument(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="card p-4 border-2 border-blue-200 bg-blue-50/30 space-y-3">
      <h4 className="text-sm font-semibold">פוליסה חדשה</h4>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label text-xs">חברת ביטוח</label><input className="input w-full text-sm" value={form.provider} onChange={f("provider")} placeholder="שם חברת הביטוח" /></div>
        <div><label className="label text-xs">מספר פוליסה</label><input className="input w-full text-sm" value={form.policyNumber} onChange={f("policyNumber")} /></div>
        <div><label className="label text-xs">סוג כיסוי</label>
          <select className="input w-full text-sm" value={form.coverageType} onChange={f("coverageType")}>
            <option value="">בחר...</option>
            {INSURANCE_COVERAGE_TYPES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div><label className="label text-xs">פרמיה שנתית (₪)</label><input type="number" className="input w-full text-sm" value={form.premium} onChange={f("premium")} /></div>
        <div><label className="label text-xs">השתתפות עצמית (₪)</label><input type="number" className="input w-full text-sm" value={form.deductible} onChange={f("deductible")} /></div>
        <div><label className="label text-xs">תחילת כיסוי</label><input type="date" className="input w-full text-sm" value={form.startDate} onChange={f("startDate")} /></div>
        <div><label className="label text-xs">תאריך חידוש</label><input type="date" className="input w-full text-sm" value={form.renewalDate} onChange={f("renewalDate")} /></div>
      </div>
      <div><label className="label text-xs">הערות</label><textarea className="input w-full text-sm" rows={2} value={form.notes} onChange={f("notes")} /></div>
      {/* File upload */}
      <div>
        <label className="label text-xs">מסמך פוליסה (PDF / תמונה)</label>
        <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-blue-200 rounded-lg p-3 hover:border-blue-400 transition-colors">
          <Upload className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-sm text-blue-600 truncate">{docName || "לחץ להעלאת קובץ"}</span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFileChange} />
        </label>
        {policyDocument && (
          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
            <Check className="w-3 h-3" /> קובץ מוכן להעלאה: {docName}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <button className="btn-primary text-sm" onClick={() => onSave({ ...form, policyDocument })} disabled={!form.provider || isSaving}>{isSaving ? "שומר..." : "שמור"}</button>
        <button className="btn-secondary text-sm" onClick={onCancel}>ביטול</button>
      </div>
    </div>
  );
}

function AddClaimForm({ onSave, onCancel, isSaving }: { onSave: (d: Record<string, unknown>) => void; onCancel: () => void; isSaving: boolean }) {
  const [form, setForm] = useState({ incidentDate: new Date().toISOString().split("T")[0], description: "", amount: "", deductiblePaid: "", invoiceAttached: false, submittedAt: "", notes: "" });
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));
  return (
    <div className="bg-white border rounded-xl p-3 space-y-3 mb-2">
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label text-xs">תאריך אירוע</label><input type="date" className="input w-full text-sm" value={form.incidentDate} onChange={f("incidentDate")} /></div>
        <div><label className="label text-xs">סכום תביעה (₪)</label><input type="number" className="input w-full text-sm" value={form.amount} onChange={f("amount")} /></div>
        <div><label className="label text-xs">השתתפות עצמית (₪)</label><input type="number" className="input w-full text-sm" value={form.deductiblePaid} onChange={f("deductiblePaid")} /></div>
        <div><label className="label text-xs">תאריך הגשה</label><input type="date" className="input w-full text-sm" value={form.submittedAt} onChange={f("submittedAt")} /></div>
      </div>
      <div><label className="label text-xs">תיאור</label><textarea className="input w-full text-sm" rows={2} value={form.description} onChange={f("description")} /></div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={form.invoiceAttached} onChange={(e) => setForm((p) => ({ ...p, invoiceAttached: e.target.checked }))} />
        חשבונית מצורפת
      </label>
      <div className="flex gap-2">
        <button className="btn-primary text-xs" onClick={() => onSave(form)} disabled={!form.incidentDate || isSaving}>{isSaving ? "שומר..." : "הגש תביעה"}</button>
        <button className="btn-ghost text-xs" onClick={onCancel}>ביטול</button>
      </div>
    </div>
  );
}

// ─── Equipment Tab (Vests) ───

interface VestRecord {
  id: string;
  size: string | null;
  color: string | null;
  vestType: string | null;
  serialNumber: string | null;
  condition: string;
  isActive: boolean;
  assignedAt: string;
  notes: string | null;
}

function EquipmentTab({ dogId }: { dogId: string }) {
  const queryClient = useQueryClient();
  const [showAddVest, setShowAddVest] = useState(false);

  const { data: vests = [], isLoading } = useQuery<VestRecord[]>({
    queryKey: ["sd-vests", dogId],
    queryFn: () => fetch(`/api/service-dogs/${dogId}/vests`).then((r) => r.json()),
  });

  const addVestMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch(`/api/service-dogs/${dogId}/vests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sd-vests", dogId] });
      setShowAddVest(false);
      toast.success("וסט נוסף");
    },
    onError: () => toast.error("שגיאה בהוספת וסט"),
  });

  const retireVestMutation = useMutation({
    mutationFn: (vestId: string) =>
      fetch(`/api/service-dogs/${dogId}/vests/${vestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sd-vests", dogId] });
      toast.success("וסט יצא משימוש");
    },
  });

  const activeVests = vests.filter((v) => v.isActive);
  const retiredVests = vests.filter((v) => !v.isActive);

  if (isLoading) return <div className="card h-40 animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Package className="w-4 h-4 text-brand-500" />
          ציוד — אפודות
        </h3>
        <button className="btn-primary text-sm flex items-center gap-1.5" onClick={() => setShowAddVest(!showAddVest)}>
          <Plus className="w-4 h-4" />
          הוסף אפודה
        </button>
      </div>

      {showAddVest && <AddVestForm onSave={(d) => addVestMutation.mutate(d)} onCancel={() => setShowAddVest(false)} isSaving={addVestMutation.isPending} />}

      {activeVests.length === 0 && !showAddVest && (
        <div className="card p-10 text-center">
          <Package className="w-12 h-12 mx-auto text-petra-muted/30 mb-3" />
          <p className="text-petra-muted">אין אפודות פעילות</p>
        </div>
      )}

      {activeVests.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-2 bg-slate-50/50 border-b text-xs font-semibold text-petra-muted">פעילות</div>
          <div className="divide-y">
            {activeVests.map((vest) => {
              const cond = VEST_CONDITIONS.find((c) => c.id === vest.condition);
              const type = VEST_TYPES.find((t) => t.id === vest.vestType);
              return (
                <div key={vest.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center">
                      <Tag className="w-5 h-5 text-brand-500" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {type?.label || "אפודה"}
                        {vest.color && ` · ${vest.color}`}
                        {vest.size && ` · מידה ${vest.size}`}
                      </p>
                      <div className="flex gap-2 text-xs text-petra-muted mt-0.5">
                        {vest.serialNumber && <span>ס/נ: {vest.serialNumber}</span>}
                        <span>שובץ: {formatDate(vest.assignedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", cond?.color || "bg-slate-100 text-slate-600")}>
                      {cond?.label || vest.condition}
                    </span>
                    <button
                      onClick={() => { if (confirm("להוציא אפודה משימוש?")) retireVestMutation.mutate(vest.id); }}
                      className="text-xs text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded px-2 py-1 transition-colors"
                    >
                      יצא משימוש
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {retiredVests.length > 0 && (
        <details className="card p-4">
          <summary className="text-sm text-petra-muted cursor-pointer">ארכיון ({retiredVests.length})</summary>
          <div className="space-y-2 mt-3">
            {retiredVests.map((vest) => {
              const cond = VEST_CONDITIONS.find((c) => c.id === vest.condition);
              const type = VEST_TYPES.find((t) => t.id === vest.vestType);
              return (
                <div key={vest.id} className="flex items-center gap-3 text-sm opacity-60">
                  <Tag className="w-4 h-4 text-petra-muted" />
                  <span>{type?.label || "אפודה"} {vest.color} {vest.size && `(${vest.size})`}</span>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-full", cond?.color)}>{cond?.label}</span>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

function AddVestForm({ onSave, onCancel, isSaving }: { onSave: (d: Record<string, unknown>) => void; onCancel: () => void; isSaving: boolean }) {
  const [form, setForm] = useState({ size: "", color: "", vestType: "", serialNumber: "", condition: "GOOD", notes: "" });
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));
  return (
    <div className="card p-4 border-2 border-brand-200 bg-brand-50/30 space-y-3">
      <h4 className="text-sm font-semibold">אפודה חדשה</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div><label className="label text-xs">סוג</label>
          <select className="input w-full text-sm" value={form.vestType} onChange={f("vestType")}>
            <option value="">בחר...</option>
            {VEST_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div><label className="label text-xs">מידה</label>
          <select className="input w-full text-sm" value={form.size} onChange={f("size")}>
            <option value="">בחר...</option>
            {VEST_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div><label className="label text-xs">צבע</label><input className="input w-full text-sm" value={form.color} onChange={f("color")} placeholder="כתום / כחול / שחור" /></div>
        <div><label className="label text-xs">מצב</label>
          <select className="input w-full text-sm" value={form.condition} onChange={f("condition")}>
            {VEST_CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div><label className="label text-xs">מספר סידורי</label><input className="input w-full text-sm" value={form.serialNumber} onChange={f("serialNumber")} /></div>
      </div>
      <div><label className="label text-xs">הערות</label><textarea className="input w-full text-sm" rows={2} value={form.notes} onChange={f("notes")} /></div>
      <div className="flex gap-2">
        <button className="btn-primary text-sm" onClick={() => onSave(form)} disabled={isSaving}>{isSaving ? "שומר..." : "שמור"}</button>
        <button className="btn-secondary text-sm" onClick={onCancel}>ביטול</button>
      </div>
    </div>
  );
}

// ─── SD Health Modal ───

function SDHealthModal({
  petId, petName, health, dogId, onClose,
}: {
  petId: string; petName: string; health: PetHealth | null; dogId: string; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toDateInput = (v: string | null) => (v ? v.split("T")[0] : "");
  const h = health;
  const [form, setForm] = useState({
    rabiesLastDate: toDateInput(h?.rabiesLastDate ?? null),
    rabiesValidUntil: toDateInput(h?.rabiesValidUntil ?? null),
    dhppLastDate: toDateInput(h?.dhppLastDate ?? null),
    dhppPuppy1Date: toDateInput(h?.dhppPuppy1Date ?? null),
    dhppPuppy2Date: toDateInput(h?.dhppPuppy2Date ?? null),
    dhppPuppy3Date: toDateInput(h?.dhppPuppy3Date ?? null),
    bordatellaDate: toDateInput(h?.bordatellaDate ?? null),
    parkWormDate: toDateInput(h?.parkWormDate ?? null),
    dewormingLastDate: toDateInput(h?.dewormingLastDate ?? null),
    fleaTickType: h?.fleaTickType ?? "",
    fleaTickDate: toDateInput(h?.fleaTickDate ?? null),
    fleaTickExpiryDate: toDateInput(h?.fleaTickExpiryDate ?? null),
    allergies: h?.allergies ?? "",
    medicalConditions: h?.medicalConditions ?? "",
    surgeriesHistory: h?.surgeriesHistory ?? "",
    activityLimitations: h?.activityLimitations ?? "",
    vetName: h?.vetName ?? "",
    vetPhone: h?.vetPhone ?? "",
    neuteredSpayed: h?.neuteredSpayed ?? false,
    originInfo: h?.originInfo ?? "",
    timeWithOwner: h?.timeWithOwner ?? "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/pets/${petId}/health`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      onClose();
      toast.success("מידע בריאות עודכן");
    },
    onError: () => toast.error("שגיאה בעדכון מידע הבריאות"),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">בריאות — {petName}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-5">
          <div className="space-y-4">
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide">חיסונים וטיפולים</p>
            <div>
              <p className="text-xs font-medium mb-2">כלבת — אחת לשנה</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">תאריך חיסון</label><input className="input" type="date" value={form.rabiesLastDate} onChange={(e) => setForm({ ...form, rabiesLastDate: e.target.value })} /></div>
                <div><label className="label">תוקף עד</label><input className="input" type="date" value={form.rabiesValidUntil} onChange={(e) => setForm({ ...form, rabiesValidUntil: e.target.value })} /></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-2">משושה גורים — 3 מנות</p>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">מנה 1</label><input className="input" type="date" value={form.dhppPuppy1Date} onChange={(e) => setForm({ ...form, dhppPuppy1Date: e.target.value })} /></div>
                <div><label className="label">מנה 2</label><input className="input" type="date" value={form.dhppPuppy2Date} onChange={(e) => setForm({ ...form, dhppPuppy2Date: e.target.value })} /></div>
                <div><label className="label">מנה 3</label><input className="input" type="date" value={form.dhppPuppy3Date} onChange={(e) => setForm({ ...form, dhppPuppy3Date: e.target.value })} /></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-2">משושה בוגר (DHPP)</p>
              <div><label className="label">תאריך חיסון</label><input className="input" type="date" value={form.dhppLastDate} onChange={(e) => setForm({ ...form, dhppLastDate: e.target.value })} /></div>
            </div>
            <div>
              <p className="text-xs font-medium mb-2">שעלת מכלאות</p>
              <div><label className="label">תאריך קבלה</label><input className="input" type="date" value={form.bordatellaDate} onChange={(e) => setForm({ ...form, bordatellaDate: e.target.value })} /></div>
            </div>
            <div>
              <p className="text-xs font-medium mb-2">תולעת הפארק</p>
              <div><label className="label">תאריך טיפול</label><input className="input" type="date" value={form.parkWormDate} onChange={(e) => setForm({ ...form, parkWormDate: e.target.value })} /></div>
            </div>
            <div>
              <p className="text-xs font-medium mb-2">תילוע</p>
              <div><label className="label">תאריך תילוע</label><input className="input" type="date" value={form.dewormingLastDate} onChange={(e) => setForm({ ...form, dewormingLastDate: e.target.value })} /></div>
            </div>
            <div>
              <p className="text-xs font-medium mb-2">קרציות ופרעושים</p>
              <div className="space-y-2">
                <div><label className="label">סוג טיפול</label><input className="input" placeholder="Nexgard, Bravecto..." value={form.fleaTickType} onChange={(e) => setForm({ ...form, fleaTickType: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">תאריך טיפול</label><input className="input" type="date" value={form.fleaTickDate} onChange={(e) => setForm({ ...form, fleaTickDate: e.target.value })} /></div>
                  <div><label className="label">תוקף עד</label><input className="input" type="date" value={form.fleaTickExpiryDate} onChange={(e) => setForm({ ...form, fleaTickExpiryDate: e.target.value })} /></div>
                </div>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">מצב רפואי</p>
            <div className="space-y-3">
              <div><label className="label">אלרגיות</label><input className="input" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} /></div>
              <div><label className="label">מצבים רפואיים</label><textarea className="input min-h-[60px]" value={form.medicalConditions} onChange={(e) => setForm({ ...form, medicalConditions: e.target.value })} /></div>
              <div><label className="label">ניתוחים בעבר</label><input className="input" value={form.surgeriesHistory} onChange={(e) => setForm({ ...form, surgeriesHistory: e.target.value })} /></div>
              <div><label className="label">מגבלות פעילות</label><input className="input" value={form.activityLimitations} onChange={(e) => setForm({ ...form, activityLimitations: e.target.value })} /></div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">וטרינר</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">שם וטרינר</label><input className="input" value={form.vetName} onChange={(e) => setForm({ ...form, vetName: e.target.value })} /></div>
              <div><label className="label">טלפון וטרינר</label><input className="input" value={form.vetPhone} onChange={(e) => setForm({ ...form, vetPhone: e.target.value })} /></div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">כללי</p>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.neuteredSpayed} onChange={(e) => setForm({ ...form, neuteredSpayed: e.target.checked })} className="w-4 h-4 accent-brand-500" />
                <span className="text-sm">מסורס / עקור</span>
              </label>
              <div><label className="label">מקור</label><input className="input" value={form.originInfo} onChange={(e) => setForm({ ...form, originInfo: e.target.value })} placeholder="מאמץ, מגדל..." /></div>
              <div><label className="label">זמן עם הבעלים / מטפל</label><input className="input" value={form.timeWithOwner} onChange={(e) => setForm({ ...form, timeWithOwner: e.target.value })} /></div>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "שומר..." : "שמור שינויים"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ─── SD Behavior Modal ───

function SDBehaviorModal({
  petId, petName, behavior, dogId, onClose,
}: {
  petId: string; petName: string; behavior: PetBehavior | null; dogId: string; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [customInput, setCustomInput] = useState("");
  const [form, setForm] = useState({
    dogAggression: behavior?.dogAggression ?? false,
    humanAggression: behavior?.humanAggression ?? false,
    leashReactivity: behavior?.leashReactivity ?? false,
    leashPulling: behavior?.leashPulling ?? false,
    jumping: behavior?.jumping ?? false,
    separationAnxiety: behavior?.separationAnxiety ?? false,
    excessiveBarking: behavior?.excessiveBarking ?? false,
    destruction: behavior?.destruction ?? false,
    resourceGuarding: behavior?.resourceGuarding ?? false,
    fears: behavior?.fears ?? false,
    badWithKids: behavior?.badWithKids ?? false,
    houseSoiling: behavior?.houseSoiling ?? false,
    biteHistory: behavior?.biteHistory ?? false,
    priorTraining: behavior?.priorTraining ?? false,
    biteDetails: behavior?.biteDetails ?? "",
    triggers: behavior?.triggers ?? "",
    priorTrainingDetails: behavior?.priorTrainingDetails ?? "",
    customIssues: (() => {
      try { return behavior?.customIssues ? JSON.parse(behavior.customIssues) : []; }
      catch { return []; }
    })() as string[],
  });

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/pets/${petId}/behavior`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      onClose();
      toast.success("מידע התנהגות עודכן");
    },
    onError: () => toast.error("שגיאה בעדכון מידע ההתנהגות"),
  });

  const toggle = (key: string) => setForm((f) => ({ ...f, [key]: !f[key as keyof typeof f] }));

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">התנהגות — {petName}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">דגלי התנהגות</p>
            <div className="grid grid-cols-2 gap-y-2 gap-x-3">
              {BEHAVIOR_FLAGS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!form[key as keyof typeof form]} onChange={() => toggle(key)} className="w-4 h-4 accent-brand-500" />
                  <span className="text-xs">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {form.biteHistory && (
              <div><label className="label">פרטי נשיכה</label><textarea className="input min-h-[60px]" value={form.biteDetails} onChange={(e) => setForm({ ...form, biteDetails: e.target.value })} /></div>
            )}
            <div><label className="label">טריגרים</label><input className="input" value={form.triggers} onChange={(e) => setForm({ ...form, triggers: e.target.value })} placeholder="קולות חזקים, כלבים אחרים..." /></div>
            {form.priorTraining && (
              <div><label className="label">פרטי אילוף קודם</label><input className="input" value={form.priorTrainingDetails} onChange={(e) => setForm({ ...form, priorTrainingDetails: e.target.value })} /></div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">בעיות נוספות</p>
            {form.customIssues.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.customIssues.map((issue, idx) => (
                  <span key={idx} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                    {issue}
                    <button type="button" onClick={() => setForm((f) => ({ ...f, customIssues: f.customIssues.filter((_, i) => i !== idx) }))} className="hover:text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input className="input flex-1" value={customInput} onChange={(e) => setCustomInput(e.target.value)} placeholder="הוסף בעיה..." onKeyDown={(e) => { if (e.key === "Enter" && customInput.trim()) { setForm((f) => ({ ...f, customIssues: [...f.customIssues, customInput.trim()] })); setCustomInput(""); } }} />
              <button type="button" className="btn-secondary px-3" onClick={() => { if (customInput.trim()) { setForm((f) => ({ ...f, customIssues: [...f.customIssues, customInput.trim()] })); setCustomInput(""); } }}>
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "שומר..." : "שמור שינויים"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ─── SD Feeding Modal ───

function SDFeedingModal({
  petId, petName, pet, dogId, onClose,
}: {
  petId: string;
  petName: string;
  pet: ServiceDogDetail["pet"];
  dogId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    foodBrand: pet.foodBrand ?? "",
    foodGramsPerDay: pet.foodGramsPerDay?.toString() ?? "",
    foodFrequency: pet.foodFrequency ?? "",
    foodNotes: pet.foodNotes ?? "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/pets/${petId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodBrand: form.foodBrand || null,
          foodGramsPerDay: form.foodGramsPerDay ? parseFloat(form.foodGramsPerDay) : null,
          foodFrequency: form.foodFrequency || null,
          foodNotes: form.foodNotes || null,
        }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      onClose();
      toast.success("פרטי האכלה עודכנו");
    },
    onError: () => toast.error("שגיאה בעדכון פרטי האכלה"),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">האכלה — {petName}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div><label className="label">מותג אוכל</label><input className="input" value={form.foodBrand} onChange={(e) => setForm({ ...form, foodBrand: e.target.value })} /></div>
          <div><label className="label">כמות (גרם/יום)</label><input className="input" type="number" value={form.foodGramsPerDay} onChange={(e) => setForm({ ...form, foodGramsPerDay: e.target.value })} /></div>
          <div>
            <label className="label">תדירות האכלה</label>
            <select className="input" value={form.foodFrequency} onChange={(e) => setForm({ ...form, foodFrequency: e.target.value })}>
              <option value="">בחר...</option>
              <option value="פעם ביום">פעם ביום</option>
              <option value="פעמיים ביום">פעמיים ביום</option>
              <option value="3 פעמים ביום">3 פעמים ביום</option>
              <option value="4 פעמים ביום">4 פעמים ביום</option>
            </select>
          </div>
          <div><label className="label">הערות</label><textarea className="input min-h-[60px]" value={form.foodNotes} onChange={(e) => setForm({ ...form, foodNotes: e.target.value })} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "שומר..." : "שמור שינויים"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ─── SD Medication Modal ───

function SDMedModal({
  petId, petName, med, dogId, onClose,
}: {
  petId: string; petName: string; med: PetMedication | null; dogId: string; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    medName: med?.medName ?? "",
    dosage: med?.dosage ?? "",
    frequency: med?.frequency ?? "",
    times: med?.times ?? "",
    instructions: med?.instructions ?? "",
    startDate: med?.startDate ? med.startDate.split("T")[0] : "",
    endDate: med?.endDate ? med.endDate.split("T")[0] : "",
  });

  const mutation = useMutation({
    mutationFn: () => {
      const url = med
        ? `/api/pets/${petId}/medications/${med.id}`
        : `/api/pets/${petId}/medications`;
      return fetch(url, {
        method: med ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medName: form.medName.trim(),
          dosage: form.dosage || null,
          frequency: form.frequency || null,
          times: form.times || null,
          instructions: form.instructions || null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
        }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה"); return d; });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      onClose();
      toast.success(med ? "תרופה עודכנה" : "תרופה נוספה");
    },
    onError: () => toast.error("שגיאה בשמירת תרופה"),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{med ? "ערוך תרופה" : "הוסף תרופה"} — {petName}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div><label className="label">שם תרופה *</label><input className="input" value={form.medName} onChange={(e) => setForm({ ...form, medName: e.target.value })} /></div>
          <div><label className="label">מינון</label><input className="input" value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="1 כדור" /></div>
          <div><label className="label">תדירות</label><input className="input" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="פעמיים ביום" /></div>
          <div><label className="label">שעות מתן</label><input className="input" value={form.times} onChange={(e) => setForm({ ...form, times: e.target.value })} placeholder="07:00, 19:00" /></div>
          <div><label className="label">הוראות</label><input className="input" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">תאריך התחלה</label><input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label className="label">תאריך סיום</label><input className="input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={mutation.isPending || !form.medName.trim()} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "שומר..." : med ? "שמור שינויים" : "הוסף תרופה"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}
