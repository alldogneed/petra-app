"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { usePermissions } from "@/hooks/usePermissions";
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
  Copy,
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
  Award,
  FileText as FileTextIcon,
  Paperclip,
  Loader2,
  Clock3,
  Download,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { formatDate as formatDateL, currencySymbol } from "@/lib/format";
import {
  ADULT_TREATMENTS, PUPPY_TREATMENTS, getCellStatus, formatPlannedDisplay,
  getEmptyAdultPlan, getEmptyPuppyPlan,
  type VaccinePlan, type VaccinePlanEntry,
} from "@/lib/vaccine-plan";
import {
  SERVICE_DOG_PHASES,
  SERVICE_DOG_PHASE_MAP,
  SERVICE_DOG_PHASE_COLORS,
  SERVICE_DOG_TYPES,
  ADI_SKILL_CATEGORIES,
  ADI_SKILL_MAP,
  MEDICAL_PROTOCOL_CATEGORIES,
  MEDICAL_PROTOCOL_MAP,
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
  INSURANCE_PROVIDERS,
  CLAIM_STATUSES,
  CLAIM_STATUS_MAP,
  CLAIM_OPEN_STATUSES,
  LOCATION_OPTIONS,
  LOCATION_MAP,
} from "@/lib/service-dogs";
import { toast } from "sonner";
import { TierGate } from "@/components/paywall/TierGate";
import { PetraLoader } from "@/components/ui/PetraLoader";

type DetailT = ReturnType<typeof useTranslations<"serviceDogs.serviceDogsDetailPage">>;

/** Same output as the old utils.formatDate for a he-IL business. */
function useFormatDay() {
  const { locale } = useBusinessLocale();
  return (d: Date | string) => formatDateL(d, { locale, style: "long" });
}

// ─── Types ───

interface PetHealth {
  neuteredSpayed: boolean;
  neuteredSpayedDate: string | null;
  allergies: string | null;
  medicalConditions: string | null;
  surgeriesHistory: string | null;
  activityLimitations: string | null;
  vetName: string | null;
  vetPhone: string | null;
  rabiesLastDate: string | null;
  rabiesValidUntil: string | null;
  dhppLastDate: string | null;
  dhppValidUntil: string | null;
  dhppPuppy1Date: string | null;
  dhppPuppy2Date: string | null;
  dhppPuppy3Date: string | null;
  bordatellaDate: string | null;
  bordatellaValidUntil: string | null;
  rabiesHistory: { date: string; validUntil: string | null; recordedAt: string }[] | null;
  dhppHistory: { date: string; validUntil: string | null; recordedAt: string }[] | null;
  bordatellaHistory: { date: string; validUntil: string | null; recordedAt: string }[] | null;
  parkWormDate: string | null;
  parkWormValidUntil: string | null;
  dewormingLastDate: string | null;
  dewormingValidUntil: string | null;
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

interface FeedingEntry {
  id: string;
  date: string;
  foodBrand: string;
  foodType?: string;
  foodGramsPerDay?: number;
  foodFrequency?: string;
  dogWeightKg?: number;
  foodNotes?: string;
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
  currentLocation: string;
  intakeDate: string | null;
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
    color: string | null;
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
  feedingHistory: FeedingEntry[];
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
  certifiedAt: string | null;
  trialStartDate: string | null;
  trialEndDate: string | null;
  nextCheckInAt: string | null;
  notes: string | null;
  recipient: { id: string; name: string; phone: string | null; disabilityType: string | null; meetings?: unknown[] };
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

function ServiceDogProfilePageContent() {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const formatDate = useFormatDay();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dogId = params.id as string;

  const VALID_TABS = ["training", "medical", "compliance", "placements", "idcard", "dogfile", "documents", "tests", "insurance", "equipment", "vaccinations"] as const;
  type TabId = typeof VALID_TABS[number];
  const tabParam = searchParams.get("tab") as TabId | null;
  const initialTab: TabId = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "dogfile";

  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const perms = usePermissions();
  const [showPhaseDropdown, setShowPhaseDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const queryClient = useQueryClient();

  const { data: dog, isLoading, isError } = useQuery<ServiceDogDetail>({
    queryKey: ["service-dog-detail", dogId],
    queryFn: () => fetch(`/api/service-dogs/${dogId}`).then((r) => {
      if (!r.ok) throw new Error("Not found");
      return r.json();
    }),
  });

  const { data: bizData } = useQuery<{ sdSettings: { trackHours?: boolean; defaultTargetHours?: number; allowManualCert?: boolean } | null }>({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const sdSettings = {
    trackHours: bizData?.sdSettings?.trackHours ?? true,
    defaultTargetHours: bizData?.sdSettings?.defaultTargetHours ?? 120,
    allowManualCert: bizData?.sdSettings?.allowManualCert ?? true,
  };

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
      toast.success(t("header.toastPhaseUpdated"));
    },
    onError: () => toast.error(t("header.errorPhaseUpdate")),
  });

  const deleteDogMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/service-dogs/${dogId}`, { method: "DELETE" }).then(async (r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json() as Promise<{ pendingApproval?: boolean }>;
      }),
    onSuccess: (data) => {
      setConfirmDelete(false);
      // Managers without CRITICAL_DELETE get 202 { pendingApproval: true } — nothing was deleted yet
      if (data?.pendingApproval) {
        toast.success(t("header.toastSentForApproval"));
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
      toast.success(t("header.toastDogDeleted"));
      router.push("/service-dogs/dogs");
    },
    onError: () => toast.error(t("header.errorDogDelete")),
  });

  const locationChangeMutation = useMutation({
    mutationFn: (currentLocation: string) =>
      fetch(`/api/service-dogs/${dogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentLocation }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
      setShowLocationDropdown(false);
      toast.success(t("header.toastLocationUpdated"));
    },
    onError: () => toast.error(t("header.errorLocationUpdate")),
  });

  if (isLoading) {
    return <PetraLoader />;
  }

  if (isError || !dog) {
    return (
      <div className="text-center py-20">
        <Dog className="w-12 h-12 mx-auto text-petra-muted/40 mb-3" />
        <p className="text-petra-muted">{t("header.notFound")}</p>
        <Link href="/service-dogs/dogs" className="btn-primary mt-4 inline-flex">
          {t("header.backToList")}
        </Link>
      </div>
    );
  }

  const activePlacement = dog.placements?.find((p) => p.status === "ACTIVE");
  const phaseInfo = SERVICE_DOG_PHASE_MAP[dog.phase];
  const phaseColors = SERVICE_DOG_PHASE_COLORS[dog.phase];
  const tp = dog.trainingProgress;
  const mc = dog.medicalCompliance;

  const tabs = [
    { id: "dogfile" as const, label: t("tabs.dogfile"), icon: Stethoscope },
    { id: "vaccinations" as const, label: t("shared.vaccinesTreatments"), icon: Pill },
    { id: "placements" as const, label: t("tabs.placements"), icon: Activity },
    { id: "training" as const, label: t("tabs.training"), icon: Clock },
    { id: "tests" as const, label: t("tabs.tests"), icon: GraduationCap, badge: Array.isArray(dog.trainingTests) ? (dog.trainingTests as unknown[]).length : 0 },
    { id: "documents" as const, label: t("shared.documents"), icon: FileText, badge: Array.isArray(dog.documents) ? (dog.documents as unknown[]).length : 0 },
    { id: "insurance" as const, label: t("shared.insurance"), icon: ShieldCheck },
    { id: "equipment" as const, label: t("tabs.equipment"), icon: Package },
    { id: "medical" as const, label: t("tabs.medical"), icon: Heart },
    { id: "compliance" as const, label: t("tabs.compliance"), icon: Flag },
    { id: "idcard" as const, label: t("tabs.idcard"), icon: CreditCard },
  ].filter((tab) => perms.serviceDogProfileTabs[tab.id]);
  // A tab the owner switched off for this member (or a ?tab= deep link to it) falls back
  // to the first visible one; with every tab off only the dog header is left.
  const currentTab: TabId | null = tabs.some((tab) => tab.id === activeTab) ? activeTab : tabs[0]?.id ?? null;

  return (
    <div className="animate-fade-in space-y-5">
      {/* Breadcrumb + Back */}
      <div className="flex items-center gap-2 text-sm text-petra-muted">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowRight className="w-4 h-4 ltr:-scale-x-100" />
          {t("header.back")}
        </button>
        <span>·</span>
        <Link href="/service-dogs" className="hover:text-foreground">{t("header.breadcrumbServiceDogs")}</Link>
        <span>·</span>
        <Link href="/service-dogs/dogs" className="hover:text-foreground">{t("header.breadcrumbDogs")}</Link>
        <span>·</span>
        <span className="text-foreground font-medium">{dog.pet.name}</span>
      </div>

      {/* Profile Header */}
      <div className="card p-0">
        {/* Phase color bar */}
        <div className="h-1.5 rounded-t-xl" style={{ background: phaseColors?.text || "#64748B" }} />

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
                  {(dog.pet.gender === "male" || dog.pet.gender === "זכר" /* i18n-ok */) ? t("header.genderMale") : (dog.pet.gender === "female" || dog.pet.gender === "נקבה" /* i18n-ok */) ? t("header.genderFemale") : null}
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
                        <div className="absolute z-20 top-full mt-1 start-0 bg-white rounded-xl shadow-xl border py-1 min-w-[170px] max-h-64 overflow-y-auto">
                          <p className="text-xs text-petra-muted px-3 py-1.5 border-b">{t("header.changePhase")}</p>
                          {SERVICE_DOG_PHASES.map((p) => {
                            const pc = SERVICE_DOG_PHASE_COLORS[p.id];
                            return (
                              <button
                                key={p.id}
                                onClick={() => phaseChangeMutation.mutate(p.id)}
                                disabled={p.id === dog.phase || phaseChangeMutation.isPending}
                                className={cn(
                                  "w-full text-start px-3 py-2 text-sm hover:bg-muted/40 transition-colors flex items-center gap-2",
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

                  {/* Location dropdown */}
                  {(() => {
                    const loc = dog.currentLocation || "TRAINER";
                    const locInfo = LOCATION_MAP[loc];
                    return (
                      <div className="relative">
                        <button
                          onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                          className="flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border font-medium transition-all hover:shadow-sm"
                          style={{
                            backgroundColor: locInfo?.color.bg,
                            color: locInfo?.color.text,
                            borderColor: locInfo?.color.border,
                          }}
                        >
                          <MapPin className="w-3 h-3" />
                          {locInfo?.label || loc}
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        {showLocationDropdown && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowLocationDropdown(false)} />
                            <div className="absolute z-20 top-full mt-1 start-0 bg-white rounded-xl shadow-xl border py-1 min-w-[160px]">
                              <p className="text-xs text-petra-muted px-3 py-1.5 border-b">{t("header.currentLocation")}</p>
                              {LOCATION_OPTIONS.map((l) => (
                                <button
                                  key={l.id}
                                  onClick={() => locationChangeMutation.mutate(l.id)}
                                  disabled={l.id === loc || locationChangeMutation.isPending}
                                  className={cn(
                                    "w-full text-start px-3 py-2 text-sm hover:bg-muted/40 transition-colors flex items-center gap-2",
                                    l.id === loc && "opacity-40 cursor-default"
                                  )}
                                >
                                  <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: l.color.text }}
                                  />
                                  {l.label}
                                  {l.id === loc && " ✓"}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* Jump to the recipient this dog is placed with (mirrors the dog link on the recipient card) */}
                  {activePlacement && (
                    <Link
                      href={`/service-dogs/recipients/${activePlacement.recipient.id}`}
                      className="flex items-center gap-1.5 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full hover:bg-emerald-100 transition-colors"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>{activePlacement.recipient.name}</span>
                      <ArrowRight className="w-3.5 h-3.5 ltr:-scale-x-100" />
                    </Link>
                  )}
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
                      {t("header.govReportRequired")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Service type badge + delete */}
            <div className="flex flex-col items-end gap-2">
              {dog.serviceType && (
                <div className="text-start">
                  <span className="text-xs text-petra-muted">{t("header.serviceType")}</span>
                  <p className="text-sm font-semibold mt-0.5">
                    {SERVICE_DOG_TYPES.find((tx) => tx.id.toLowerCase() === (dog.serviceType || "").toLowerCase())?.label || dog.serviceType}
                  </p>
                </div>
              )}
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t("header.deleteDog")}
              </button>
            </div>
          </div>

          {/* Stats Strip */}
          <div className={cn("grid gap-3 mt-5 pt-5 border-t", sdSettings.trackHours ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")}>
            {/* Training hours — shown only when trackHours is on */}
            {sdSettings.trackHours && (
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {tp.totalHours.toFixed(0)}
                <span className="text-sm font-normal text-petra-muted">/{tp.targetHours}</span>
              </div>
              <div className="text-xs text-petra-muted mt-0.5">{t("shared.trainingHours")}</div>
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
            )}

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
              <div className="text-xs text-petra-muted mt-0.5">{t("header.medicalCompliance")}</div>
              <div className="text-xs mt-1.5">
                <span className="text-emerald-600">{mc.completedCount} ✓</span>
                {mc.overdueCount > 0 && <span className="text-red-600 ms-2">{mc.overdueCount} ✗</span>}
              </div>
            </div>

            {/* Time */}
            <div className="text-center">
              <div className="text-2xl font-bold">
                {tp.monthsElapsed}
                <span className="text-sm font-normal text-petra-muted">/{tp.targetMonths}</span>
              </div>
              <div className="text-xs text-petra-muted mt-0.5">{t("header.trainingMonths")}</div>
              {dog.trainingStartDate && (
                <div className="text-xs text-petra-muted mt-1.5">
                  {t("header.started")} {formatDate(dog.trainingStartDate)}
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
                {tp.isReadyForCertification ? t("shared.readyForCert") : dog.phase === "CERTIFIED" ? t("header.certified") : t("header.inTraining")}
              </div>
              {dog.certificationDate && (
                <div className="text-xs text-emerald-600 mt-1.5 font-medium">
                  {t("header.certifiedOn")} {formatDate(dog.certificationDate)}
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
                currentTab === tab.id
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
        {currentTab === null && (
          <p className="text-sm text-petra-muted text-center py-10">
            {t("header.noTabAccess")}
          </p>
        )}
        {currentTab === "training" && <TrainingTab dog={dog} dogId={dogId} />}
        {currentTab === "medical" && <MedicalTab dog={dog} dogId={dogId} />}
        {currentTab === "compliance" && <ComplianceTab dog={dog} dogId={dogId} />}
        {currentTab === "placements" && <PlacementsTab dog={dog} />}
        {currentTab === "tests" && <TrainingTestsTab dog={dog} dogId={dogId} />}
        {currentTab === "insurance" && <InsuranceTab dogId={dogId} />}
        {currentTab === "equipment" && <EquipmentTab dogId={dogId} />}
        {currentTab === "documents" && <DocumentsTab dog={dog} dogId={dogId} />}
        {currentTab === "idcard" && <IDCardTab dog={dog} dogId={dogId} allowManualCert={sdSettings.allowManualCert} trackHours={sdSettings.trackHours} />}
        {currentTab === "dogfile" && <DogFileTab dog={dog} dogId={dogId} />}
        {currentTab === "vaccinations" && <VaccinationsTab dog={dog} dogId={dogId} />}
      </div>

      {/* Notes — תיק כלב only */}
      {currentTab === "dogfile" && dog.notes && (
        <div className="card p-4 border-s-4 border-s-amber-400 bg-amber-50">
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-amber-700 mb-1">{t("shared.notes")}</p>
              <p className="text-sm text-amber-900">{dog.notes}</p>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(false)}>
          <div className="modal-content max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">{t("header.deleteDogTitle")}</h3>
            <p className="text-sm text-petra-muted mb-4">
              {t("header.deleteConfirmPrefix")} <strong>{dog.pet.name}</strong>{t("header.deleteConfirmSuffix")}
            </p>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>
                {tc("actions.cancel")}
              </button>
              <button
                className="btn-primary bg-red-600 hover:bg-red-700 border-red-600"
                onClick={() => deleteDogMutation.mutate()}
                disabled={deleteDogMutation.isPending}
              >
                {deleteDogMutation.isPending ? tc("progress.deleting") : tc("actions.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ServiceDogProfilePage() {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  return (
    <TierGate
      feature="service_dogs"
      title={t("header.tierGateTitle")}
      description={t("header.tierGateDescription")}
      upgradeTier="service_dog"
    >
      <ServiceDogProfilePageContent />
    </TierGate>
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
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const formatDate = useFormatDay();
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
      toast.success(t("milestones.toastUpdated"));
    },
    onError: () => toast.error(t("milestones.errorUpdate")),
  });

  const achievedKeys = new Set(milestones.filter((m) => m.achievedAt).map((m) => m.milestoneKey));

  const icons = [Flag, GraduationCap, Trophy, BadgeCheck];

  return (
    <div className="card p-5">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Flag className="w-4 h-4 text-brand-500" />
        {t("milestones.title")}
      </h3>
      <div className="relative">
        {/* connector line */}
        <div className="absolute top-5 start-5 end-5 h-0.5 bg-slate-200 z-0" />
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
                  title={achieved ? t("milestones.unmark") : t("milestones.markAchieved")}
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
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
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
          <span className="text-sm font-medium text-brand-700">{t("training.structuredProgramsCta")}</span>
          <span className="text-xs text-brand-500">{t("training.structuredProgramsHint")}</span>
        </div>
        <span className="text-brand-600 text-sm group-hover:translate-x-[-2px] ltr:group-hover:translate-x-[2px] transition-transform">{t("training.goToTraining")}</span>
      </a>

      {/* ADI Progress */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            {t("training.adiProgress")}
          </h3>
          {tp.isReadyForCertification && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              <CheckCircle2 className="w-4 h-4" />
              {t("shared.readyForCert")}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-blue-50 rounded-xl">
            <div className="text-xl font-bold text-blue-700">{tp.totalHours.toFixed(1)}</div>
            <div className="text-xs text-blue-600 mt-0.5">{t("training.hoursDone")}</div>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-xl">
            <div className="text-xl font-bold text-slate-700">{tp.targetHours}</div>
            <div className="text-xs text-slate-600 mt-0.5">{t("training.hoursTarget")}</div>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-xl">
            <div className="text-xl font-bold text-slate-700">{tp.monthsElapsed}/{tp.targetMonths}</div>
            <div className="text-xs text-slate-600 mt-0.5">{t("training.months")}</div>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-xl">
            <div className="text-xl font-bold text-slate-700">{tp.hoursRemaining.toFixed(1)}</div>
            <div className="text-xs text-slate-600 mt-0.5">{t("training.hoursLeft")}</div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-petra-muted">{t("training.completion")}</span>
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
            <span>{t("training.zeroHours")}</span>
            <span>{tp.targetHours} {t("training.hours")}</span>
          </div>
        </div>
      </div>

      {/* Training logs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{t("training.sessionsTitle")}{dog.trainingLogs.length})</h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {t("training.addSession")}
          </button>
        </div>

        {showAddForm && (
          <TrainingLogForm
            dogId={dogId}
            onDone={() => {
              setShowAddForm(false);
              queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
              queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
            }}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {dog.trainingLogs.length === 0 ? (
          <div className="empty-state py-10">
            <Clock className="empty-state-icon" />
            <p className="text-petra-muted">{t("training.noSessions")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dog.trainingLogs.map((log) => {
              const skills: string[] = (() => {
                try { return JSON.parse(log.skillCategories) || []; } catch { return []; }
              })();
              return (
                <TrainingLogRow
                  key={log.id}
                  log={log}
                  skills={skills}
                  dogId={dogId}
                  onMutated={() => {
                    queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
                    queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Training Log Row (display + inline edit) ───

function TrainingLogRow({
  log, skills, dogId, onMutated,
}: {
  log: TrainingLog;
  skills: string[];
  dogId: string;
  onMutated: () => void;
}) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const formatDate = useFormatDay();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copying, setCopying] = useState(false);

  if (editing) {
    return (
      <TrainingLogForm
        dogId={dogId}
        log={log}
        onDone={() => { setEditing(false); onMutated(); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const handleDelete = async () => {
    if (!confirm(t("training.confirmDeleteSession"))) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/service-dogs/${dogId}/training/${log.id}`, { method: "DELETE" });
      if (r.ok) { onMutated(); toast.success(t("training.toastSessionDeleted")); }
      else toast.error(t("training.errorSessionDelete"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="card p-3 hover:shadow-sm transition-shadow group">
      {/* Main row: date · duration · trainer · location */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <span className="flex items-center gap-1 font-medium">
              <Calendar className="w-3.5 h-3.5 text-petra-muted shrink-0" />
              {formatDate(log.sessionDate)}
            </span>
            <span className="flex items-center gap-1 text-petra-muted">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              {log.durationMinutes} {t("training.minutes")}
              {log.cumulativeHours !== null && (
                <span className="text-blue-600 font-medium">({log.cumulativeHours.toFixed(1)} {t("training.cumulative")}</span>
              )}
            </span>
            {log.trainerName && (
              <span className="flex items-center gap-1 text-petra-muted">
                <User className="w-3.5 h-3.5 shrink-0" />
                {log.trainerName}
              </span>
            )}
            {log.location && (
              <span className="flex items-center gap-1 text-petra-muted">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {log.location}
              </span>
            )}
            {/* Skills inline */}
            {skills.length > 0 && skills.map((skillId) => {
              const skill = ADI_SKILL_MAP[skillId] ? { label: ADI_SKILL_MAP[skillId] } : undefined;
              return (
                <span key={skillId} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {skill?.label || skillId}
                </span>
              );
            })}
          </div>
          {log.notes && <p className="text-xs text-petra-muted mt-1">{log.notes}</p>}
        </div>

        {/* Rating + actions */}
        <div className="flex items-center gap-1 shrink-0">
          {log.rating !== null && (
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={cn("w-3.5 h-3.5", i < log.rating! ? "fill-amber-400 text-amber-400" : "text-petra-muted/20")} />
              ))}
            </div>
          )}
          <button
            onClick={() => setCopying(true)}
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded hover:bg-indigo-50 transition-all"
            title={t("training.copyToOtherDog")}
          >
            <Copy className="w-3.5 h-3.5 text-indigo-500" />
          </button>
          <button
            onClick={() => setEditing(true)}
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded hover:bg-brand-50 transition-all"
            title={t("training.editSession")}
          >
            <Pencil className="w-3.5 h-3.5 text-brand-500" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 transition-all disabled:opacity-40"
            title={t("training.deleteSession")}
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>

      {copying && (
        <CopyLogToDogModal
          log={log}
          skills={skills}
          currentDogId={dogId}
          onClose={() => setCopying(false)}
          onDone={() => { setCopying(false); onMutated(); }}
        />
      )}
    </div>
  );
}

// ─── Copy a training log to another service dog ───

function CopyLogToDogModal({
  log, skills, currentDogId, onClose, onDone,
}: {
  log: TrainingLog;
  skills: string[];
  currentDogId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const formatDate = useFormatDay();
  const [targetDogId, setTargetDogId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: allDogs = [] } = useQuery<{ id: string; pet: { name: string } | null }[]>({
    queryKey: ["service-dogs"],
    queryFn: () => fetch("/api/service-dogs").then((r) => r.json()),
    staleTime: 60_000,
  });
  const otherDogs = allDogs.filter((d) => d.id !== currentDogId);

  const handleCopy = async () => {
    if (!targetDogId) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/service-dogs/${targetDogId}/training`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionDate: log.sessionDate,
          durationMinutes: log.durationMinutes,
          trainerName: log.trainerName,
          location: log.location,
          skillCategories: skills,
          status: log.status,
          notes: log.notes,
          rating: log.rating,
        }),
      });
      if (r.ok) {
        toast.success(t("training.toastCopied"));
        onDone();
      } else {
        toast.error(t("training.errorCopy"));
      }
    } catch {
      toast.error(t("training.errorCopy"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-petra-text">{t("training.copyToOtherDog")}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-petra-muted mb-3">
          {t("training.copyFrom")}{formatDate(log.sessionDate)} · {log.durationMinutes} {t("training.copyWillCopy")}
        </p>
        <label className="label">{t("training.chooseTargetDog")}</label>
        <select className="input mb-4" value={targetDogId} onChange={(e) => setTargetDogId(e.target.value)}>
          <option value="">{t("training.chooseDogOption")}</option>
          {otherDogs.map((d) => (
            <option key={d.id} value={d.id}>{d.pet?.name ?? t("training.noName")}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={!targetDogId || saving} onClick={handleCopy}>
            <Copy className="w-4 h-4" />
            {saving ? t("training.copying") : t("training.copySession")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Training Log Form (add + edit) ───

function TrainingLogForm({
  dogId, log, onDone, onCancel,
}: {
  dogId: string;
  log?: TrainingLog;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const [sessionDate, setSessionDate] = useState(log ? log.sessionDate.split("T")[0] : new Date().toISOString().split("T")[0]);
  const [durationMinutes, setDurationMinutes] = useState(log?.durationMinutes ?? 60);
  const [trainerName, setTrainerName] = useState(log?.trainerName ?? "");
  const [location, setLocation] = useState(log?.location ?? "");
  const [notes, setNotes] = useState(log?.notes ?? "");
  const [rating, setRating] = useState<number>(log?.rating ?? 0);
  const [selectedSkills, setSelectedSkills] = useState<string[]>(() => {
    if (!log) return [];
    try { return JSON.parse(log.skillCategories) || []; } catch { return []; }
  });

  const isEdit = !!log;

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      const url = isEdit
        ? `/api/service-dogs/${dogId}/training/${log!.id}`
        : `/api/service-dogs/${dogId}/training`;
      return fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("shared.error")); return d; });
    },
    onSuccess: () => {
      toast.success(isEdit ? t("training.toastSessionUpdated") : t("training.toastSessionAdded"));
      onDone();
    },
    onError: () => toast.error(isEdit ? t("training.errorSessionUpdate") : t("training.errorSessionAdd")),
  });

  const handleSave = () => mutation.mutate({
    sessionDate,
    durationMinutes,
    trainerName: trainerName || null,
    location: location || null,
    skillCategories: selectedSkills,
    notes: notes || null,
    rating: rating > 0 ? rating : null,
  });

  return (
    <div className="card p-4 mb-2 border-2 border-brand-200 bg-brand-50/30">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Plus className="w-4 h-4 text-brand-500" />
        {isEdit ? t("training.editSessionTitle") : t("training.newSessionTitle")}
      </h4>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="label">{t("training.dateRequired")}</label>
          <input type="date" lang={cfg.lang} value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} className="input w-full" />
        </div>
        <div>
          <label className="label">{t("training.durationRequired")}</label>
          <input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="input w-full" min={1} />
        </div>
        <div>
          <label className="label">{t("training.trainer")}</label>
          <input type="text" value={trainerName} onChange={(e) => setTrainerName(e.target.value)} className="input w-full" placeholder={t("training.trainerPlaceholder")} />
        </div>
        <div>
          <label className="label">{t("training.location")}</label>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="input w-full" placeholder={t("training.locationPlaceholder")} />
        </div>
      </div>

      <div className="mb-3">
        <label className="label">{t("training.skillsTrained")}</label>
        <div className="flex flex-wrap gap-1.5">
          {ADI_SKILL_CATEGORIES.map((skill) => (
            <button
              key={skill.id}
              type="button"
              onClick={() =>
                setSelectedSkills((prev) =>
                  prev.includes(skill.id) ? prev.filter((s) => s !== skill.id) : [...prev, skill.id]
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
          <label className="label">{t("training.sessionRating")}</label>
          <div className="flex gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((r) => (
              <button key={r} type="button" onClick={() => setRating(r === rating ? 0 : r)} className="transition-transform hover:scale-110">
                <Star className={cn("w-6 h-6 transition-colors", r <= rating ? "fill-amber-400 text-amber-400" : "text-petra-muted/25")} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">{t("shared.notes")}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input w-full" rows={2} placeholder={t("training.notesPlaceholder")} />
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={!sessionDate || !durationMinutes || mutation.isPending} className="btn-primary">
          {mutation.isPending ? tc("progress.saving") : isEdit ? t("shared.saveChanges") : t("training.saveSession")}
        </button>
        <button onClick={onCancel} className="btn-secondary">{tc("actions.cancel")}</button>
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
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const formatDate = useFormatDay();
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
      toast.success(t("medical.toastProtocolUpdated"));
    },
    onError: () => toast.error(t("medical.errorProtocolUpdate")),
  });

  // Sync protocols from pet health record — marks completed + sets due dates
  const syncVaccinationsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/service-dogs/${dogId}/protocols/sync-health`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("medical.errorSync"));
      }
      return res.json() as Promise<{ completed: number; dueDatesSet: number; total: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
      if (data.total === 0) {
        toast.info(t("medical.noChanges"));
      } else {
        const parts = [];
        if (data.completed > 0) parts.push(t("medical.markedDone", { count: data.completed }));
        if (data.dueDatesSet > 0) parts.push(t("medical.dueDatesUpdated", { count: data.dueDatesSet }));
        toast.success(t("medical.syncDone", { parts: parts.join(", ") }));
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || t("medical.errorVaccineSync"));
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
    COMPLETED: { label: t("medical.status.COMPLETED"), className: "bg-emerald-100 text-emerald-700", icon: "✓" },
    PENDING: { label: t("medical.status.PENDING"), className: "bg-slate-100 text-slate-600", icon: "○" },
    OVERDUE: { label: t("medical.status.OVERDUE"), className: "bg-red-100 text-red-600", icon: "!" },
    WAIVED: { label: t("medical.status.WAIVED"), className: "bg-amber-100 text-amber-700", icon: "—" },
  };

  return (
    <div className="space-y-4">
      {/* Vaccination sync banner */}
      {syncableCount > 0 && (
        <div className="rounded-xl p-3 border border-blue-200 bg-blue-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Stethoscope className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span className="text-sm text-blue-800">
              {t("medical.syncBanner")}
            </span>
          </div>
          <button
            className="btn-primary text-xs flex-shrink-0"
            disabled={syncVaccinationsMutation.isPending}
            onClick={() => syncVaccinationsMutation.mutate()}
          >
            {syncVaccinationsMutation.isPending ? t("medical.syncing") : t("medical.syncVaccines")}
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
            {mc.completedCount} {t("medical.outOf")} {mc.totalProtocols} {t("medical.protocolsCompleted")}
          </p>
          <div className="flex gap-3 text-sm mt-0.5">
            {mc.overdueCount > 0 && (
              <span className="text-red-600 font-medium">{mc.overdueCount} {t("medical.overdueCount")}</span>
            )}
            {mc.pendingCount > 0 && (
              <span className="text-slate-600">{mc.pendingCount} {t("medical.pendingCount")}</span>
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
                        {MEDICAL_PROTOCOL_MAP[protocol.protocolKey]?.label ?? protocol.protocolLabel}
                      </p>
                      <div className="flex gap-3 text-xs text-petra-muted mt-0.5">
                        {protocol.dueDate && (
                          <span className={cn(isOverdue && "text-red-500 font-medium")}>
                            {t("medical.due")} {formatDate(protocol.dueDate)}
                          </span>
                        )}
                        {protocol.completedDate && (
                          <span className="text-emerald-600">{t("medical.done")} {formatDate(protocol.completedDate)}</span>
                        )}
                        {protocol.expiryDate && (
                          <span>{t("medical.expires")} {formatDate(protocol.expiryDate)}</span>
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
                        {t("medical.markDone")}
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
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
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
      toast.success(t("shared.toastStatusUpdated"));
    },
    onError: () => toast.error(t("shared.errorUpdate")),
  });

  const now = new Date();
  const pendingEvents = dog.complianceEvents.filter((e) => e.notificationStatus === "PENDING");
  const overdueEvents = pendingEvents.filter(
    (e) => e.notificationDue && new Date(e.notificationDue) < now
  );
  const otherEvents = dog.complianceEvents.filter((e) => e.notificationStatus !== "PENDING");

  const statusConfig: Record<string, { label: string; className: string }> = {
    PENDING: { label: t("compliance.status.PENDING"), className: "bg-amber-100 text-amber-700" },
    SENT: { label: t("compliance.status.SENT"), className: "bg-emerald-100 text-emerald-700" },
    WAIVED: { label: t("compliance.status.WAIVED"), className: "bg-slate-100 text-slate-600" },
    NOT_REQUIRED: { label: t("compliance.status.NOT_REQUIRED"), className: "bg-slate-100 text-slate-500" },
    FAILED: { label: t("compliance.status.FAILED"), className: "bg-red-100 text-red-600" },
  };

  return (
    <div className="space-y-4">
      {/* Gov report banner */}
      {dog.isGovReportPending && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700">{t("compliance.govReportRequired")}</p>
            <p className="text-sm text-red-600 mt-0.5">
              {t("compliance.reportWithin48h")}
            </p>
          </div>
        </div>
      )}

      {/* Overdue section */}
      {overdueEvents.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-red-600 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            {t("compliance.overdueTitle")}{overdueEvents.length})
          </h4>
          <ComplianceEventGroup events={overdueEvents} statusConfig={statusConfig} onMark={(id, status) => markMutation.mutate({ id, notificationStatus: status })} isOverdue />
        </div>
      )}

      {/* Pending section */}
      {pendingEvents.filter((e) => !overdueEvents.includes(e)).length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-amber-600 mb-2">
            {t("compliance.pendingTitle")}{pendingEvents.filter((e) => !overdueEvents.includes(e)).length})
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
          <h4 className="text-sm font-semibold text-petra-muted mb-2">{t("compliance.history")}</h4>
          <ComplianceEventGroup events={otherEvents} statusConfig={statusConfig} onMark={(id, status) => markMutation.mutate({ id, notificationStatus: status })} />
        </div>
      )}

      {dog.complianceEvents.length === 0 && (
        <div className="empty-state py-10">
          <AlertTriangle className="empty-state-icon" />
          <p className="text-petra-muted">{t("compliance.noEvents")}</p>
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
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const formatDate = useFormatDay();
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
                    {t("compliance.mandatoryReport")}
                  </span>
                )}
              </div>
              <p className="text-xs text-petra-muted">{event.eventDescription}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-petra-muted">
                <span>{formatDate(event.eventAt)}</span>
                {event.notificationDue && (
                  <span className={cn(isOverdue ? "text-red-600 font-medium" : "text-amber-600")}>
                    {t("compliance.deadline")} {formatDate(event.notificationDue)}
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
                    {t("compliance.sent")}
                  </button>
                  <button
                    onClick={() => onMark(event.id, "WAIVED")}
                    className="btn-ghost text-xs py-1 px-2"
                  >
                    {t("compliance.waive")}
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
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const formatDate = useFormatDay();
  const router = useRouter();
  const queryClient = useQueryClient();
  const perms = usePermissions();
  const activePlacement = dog.placements.find((p) => p.status === "ACTIVE");
  const [showAddModal, setShowAddModal] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [placementDate, setPlacementDate] = useState(new Date().toISOString().split("T")[0]);
  const [certifiedAt, setCertifiedAt] = useState("");
  const [trialEndDate, setTrialEndDate] = useState("");

  const { data: recipients = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["service-recipients-list"],
    queryFn: () => fetch("/api/service-recipients").then((r) => r.json()),
    enabled: showAddModal,
    select: (data) => Array.isArray(data) ? data : (data as { recipients?: { id: string; name: string }[] }).recipients ?? [],
  });

  const createPlacementMutation = useMutation({
    mutationFn: () =>
      fetch("/api/service-placements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceDogId: dog.id, recipientId, placementDate, certifiedAt: certifiedAt || null, trialEndDate: trialEndDate || null }),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail"] });
      queryClient.invalidateQueries({ queryKey: ["service-placements"] });
      toast.success(t("placements.toastCreated"));
      setShowAddModal(false);
      setRecipientId("");
      setTrialEndDate("");
    },
    onError: () => toast.error(t("placements.errorCreate")),
  });

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
      toast.success(t("placements.toastProcessDone"));
      router.push("/service-dogs/dogs");
    },
    onError: () => toast.error(t("placements.errorProcessDone")),
  });

  return (
    <div className="space-y-4">
      {activePlacement && (
        <div className="card p-4 border-2 border-emerald-300 bg-emerald-50">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <p className="font-semibold text-emerald-800">{t("placements.activePlacement")}</p>
              </div>
              <p className="text-lg font-bold">{activePlacement.recipient.name}</p>
              {perms.canSeeRecipientsSensitive && activePlacement.recipient.phone && (
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
                <p className="text-xs text-emerald-600">{t("placements.placementDate")}</p>
                <p className="text-sm font-medium">{formatDate(activePlacement.placementDate)}</p>
              </div>
            )}
            {activePlacement.certifiedAt && (
              <div>
                <p className="text-xs text-emerald-600">{t("shared.certificationDate")}</p>
                <p className="text-sm font-medium">{formatDate(activePlacement.certifiedAt)}</p>
              </div>
            )}
            {activePlacement.trialEndDate && (
              <div>
                <p className="text-xs text-emerald-600">{t("placements.trialEnd")}</p>
                <p className="text-sm font-medium">{formatDate(activePlacement.trialEndDate)}</p>
              </div>
            )}
            {activePlacement.nextCheckInAt && (
              <div>
                <p className="text-xs text-emerald-600">{t("placements.followUp")}</p>
                <p className="text-sm font-medium">{formatDate(activePlacement.nextCheckInAt)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-emerald-600">{t("placements.recipientMeetings")}</p>
              <p className="text-sm font-bold">{Array.isArray(activePlacement.recipient.meetings) ? activePlacement.recipient.meetings.length : 0}</p>
            </div>
          </div>

          {/* Complete Process Button */}
          <div className="mt-3 pt-3 border-t border-emerald-200">
            <button
              onClick={() => {
                if (confirm(t("placements.confirmComplete", { dogName: dog.pet.name, recipientName: activePlacement.recipient.name })))
                  completeProcessMutation.mutate(activePlacement.id);
              }}
              disabled={completeProcessMutation.isPending}
              className="w-full text-sm text-red-600 hover:text-red-700 py-2 border border-dashed border-red-300 hover:border-red-400 rounded-xl transition-colors"
            >
              {completeProcessMutation.isPending ? t("placements.archiving") : t("placements.completeProcess")}
            </button>
          </div>
        </div>
      )}

      {dog.placements.length === 0 ? (
        <div className="empty-state py-10">
          <Activity className="empty-state-icon" />
          <p className="text-petra-muted">{t("placements.noPlacements")}</p>
          <button onClick={() => setShowAddModal(true)} className="btn-primary mt-3 inline-flex text-sm">
            {t("placements.createNew")}
          </button>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50/40 flex items-center justify-between">
            <h4 className="text-sm font-semibold">{t("placements.history")}</h4>
            <button onClick={() => setShowAddModal(true)} className="btn-secondary text-xs flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> {t("placements.add")}
            </button>
          </div>
          <div className="divide-y">
            {dog.placements.map((placement) => {
              const sc = PLACEMENT_STATUS_MAP[placement.status];
              return (
                <div key={placement.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{placement.recipient.name}</p>
                    <div className="flex gap-3 text-xs text-petra-muted mt-0.5">
                      {placement.placementDate && <span>{t("placements.placed")} {formatDate(placement.placementDate)}</span>}
                      {placement.certifiedAt && <span>{t("placements.certified")} {formatDate(placement.certifiedAt)}</span>}
                      {placement.trialEndDate && <span>{t("shared.until")} {formatDate(placement.trialEndDate)}</span>}
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

      {/* Inline Add Placement Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-backdrop" />
          <div className="modal-content max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">{t("placements.newPlacementTitle")} {dog.pet.name}</h2>
              <button onClick={() => setShowAddModal(false)} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">{t("placements.recipientRequired")}</label>
                <select
                  className="input w-full"
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                >
                  <option value="">{t("placements.chooseRecipient")}</option>
                  {recipients.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t("placements.placementDate")}</label>
                  <input type="date" lang={cfg.lang} value={placementDate} onChange={(e) => setPlacementDate(e.target.value)} className="input w-full" />
                </div>
                <div>
                  <label className="label">{t("shared.certificationDate")}</label>
                  <input type="date" lang={cfg.lang} value={certifiedAt} onChange={(e) => setCertifiedAt(e.target.value)} className="input w-full" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => createPlacementMutation.mutate()}
                  disabled={!recipientId || createPlacementMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createPlacementMutation.isPending ? t("shared.creating") : t("placements.create")}
                </button>
                <button onClick={() => setShowAddModal(false)} className="btn-secondary">{tc("actions.cancel")}</button>
              </div>
            </div>
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
  testItems?: TestItem[]; // Simba-specific test items
  overallResult: "PASS" | "FAIL" | "CONDITIONAL_PASS";
  notes: string;
  fileUrl?: string;
  fileName?: string;
  nextRenewalDate?: string; // for ANNUAL_RETEST
}

interface TestCategory {
  id: string;
  categoryKey: string;
  result: "PASS" | "FAIL" | "NOT_TESTED";
  score: number | null;
  improvementPoints: string;
}

interface TestItem {
  taskId: string;
  passed: boolean;
  notes: string;
}

const ADI_TEST_CATEGORIES = [
  { key: "HEEL_ON_LEASH", labelKey: "tests.adiCategories.HEEL_ON_LEASH" },
  { key: "HEEL_OFF_LEASH", labelKey: "tests.adiCategories.HEEL_OFF_LEASH" },
  { key: "SIT_STAY", labelKey: "tests.adiCategories.SIT_STAY" },
  { key: "DOWN_STAY", labelKey: "tests.adiCategories.DOWN_STAY" },
  { key: "COME_RECALL", labelKey: "tests.adiCategories.COME_RECALL" },
  { key: "STAND_FOR_EXAM", labelKey: "tests.adiCategories.STAND_FOR_EXAM" },
  { key: "PUBLIC_ACCESS_1", labelKey: "tests.adiCategories.PUBLIC_ACCESS_1" },
  { key: "PUBLIC_ACCESS_2", labelKey: "tests.adiCategories.PUBLIC_ACCESS_2" },
  { key: "PUBLIC_ACCESS_3", labelKey: "tests.adiCategories.PUBLIC_ACCESS_3" },
  { key: "DISTRACTION_1", labelKey: "tests.adiCategories.DISTRACTION_1" },
  { key: "DISTRACTION_2", labelKey: "tests.adiCategories.DISTRACTION_2" },
  { key: "TASK_SPECIFIC", labelKey: "tests.adiCategories.TASK_SPECIFIC" },
  { key: "HANDLER_CONTROL", labelKey: "tests.adiCategories.HANDLER_CONTROL" },
  { key: "GREETING_STRANGERS", labelKey: "tests.adiCategories.GREETING_STRANGERS" },
  { key: "LEAVE_IT", labelKey: "tests.adiCategories.LEAVE_IT" },
  { key: "AGGRESSION_TEST", labelKey: "tests.adiCategories.AGGRESSION_TEST" },
  { key: "SEPARATION", labelKey: "tests.adiCategories.SEPARATION" },
  { key: "GROOMING_TOLERANCE", labelKey: "tests.adiCategories.GROOMING_TOLERANCE" },
];
const ADI_TEST_CATEGORY_MAP = Object.fromEntries(ADI_TEST_CATEGORIES.map((c) => [c.key, c.labelKey]));

const TEST_TYPES = [
  { id: "SIMBA_COMBINED", labelKey: "tests.types.SIMBA_COMBINED" },
  { id: "SIMBA_PUBLIC_SPACE", labelKey: "tests.types.SIMBA_PUBLIC_SPACE" },
  { id: "INITIAL_EVAL", labelKey: "tests.types.INITIAL_EVAL" },
  { id: "PROGRESS_TEST", labelKey: "tests.types.PROGRESS_TEST" },
  { id: "PRE_CERT", labelKey: "tests.types.PRE_CERT" },
  { id: "ADI_CERT", labelKey: "tests.types.ADI_CERT" },
  { id: "ANNUAL_RETEST", labelKey: "tests.types.ANNUAL_RETEST" },
  { id: "OTHER", labelKey: "tests.types.OTHER" },
];
// Labels for test types that can no longer be created but may exist on old records
const LEGACY_TEST_TYPE_LABELS: Record<string, string> = {
  SIMBA_FUNCTIONAL_TASKS: "tests.types.SIMBA_FUNCTIONAL_TASKS",
};
const TEST_TYPE_MAP: Record<string, string> = {
  ...LEGACY_TEST_TYPE_LABELS,
  ...Object.fromEntries(TEST_TYPES.map((tx) => [tx.id, tx.labelKey])),
};

// ─── Simba Public Space Fitness Test tasks ────────────────────────────────────
const SIMBA_PUBLIC_SPACE_TASKS = [
  { id: "PS_01", labelKey: "tests.simbaTasks.PS_01" },
  { id: "PS_02", labelKey: "tests.simbaTasks.PS_02" },
  { id: "PS_03", labelKey: "tests.simbaTasks.PS_03" },
  { id: "PS_04", labelKey: "tests.simbaTasks.PS_04" },
  { id: "PS_05", labelKey: "tests.simbaTasks.PS_05" },
  { id: "PS_06", labelKey: "tests.simbaTasks.PS_06" },
  { id: "PS_07", labelKey: "tests.simbaTasks.PS_07" },
  { id: "PS_08", labelKey: "tests.simbaTasks.PS_08" },
  { id: "PS_09", labelKey: "tests.simbaTasks.PS_09" },
  { id: "PS_10", labelKey: "tests.simbaTasks.PS_10" },
  { id: "PS_11", labelKey: "tests.simbaTasks.PS_11" },
  { id: "PS_12", labelKey: "tests.simbaTasks.PS_12" },
  { id: "PS_13", labelKey: "tests.simbaTasks.PS_13" },
  { id: "PS_14", labelKey: "tests.simbaTasks.PS_14" },
  { id: "PS_15", labelKey: "tests.simbaTasks.PS_15" },
  { id: "PS_16", labelKey: "tests.simbaTasks.PS_16" },
];

const SIMBA_PUBLIC_SPACE_REQUIREMENTS = [
  { id: "PS_R1", labelKey: "tests.simbaTasks.PS_R1" },
  { id: "PS_R2", labelKey: "tests.simbaTasks.PS_R2" },
  { id: "PS_R3", labelKey: "tests.simbaTasks.PS_R3" },
];

// ─── Simba Functional Task Test items ────────────────────────────────────────
const SIMBA_FUNCTIONAL_TASKS = [
  { id: "FT_01", labelKey: "tests.simbaTasks.FT_01" },
  { id: "FT_02", labelKey: "tests.simbaTasks.FT_02" },
  { id: "FT_03", labelKey: "tests.simbaTasks.FT_03" },
  { id: "FT_04", labelKey: "tests.simbaTasks.FT_04" },
  { id: "FT_05", labelKey: "tests.simbaTasks.FT_05" },
  { id: "FT_06", labelKey: "tests.simbaTasks.FT_06" },
  { id: "FT_07", labelKey: "tests.simbaTasks.FT_07" },
  { id: "FT_08", labelKey: "tests.simbaTasks.FT_08" },
  { id: "FT_09", labelKey: "tests.simbaTasks.FT_09" },
  { id: "FT_10", labelKey: "tests.simbaTasks.FT_10" },
  { id: "FT_11", labelKey: "tests.simbaTasks.FT_11" },
  { id: "FT_12", labelKey: "tests.simbaTasks.FT_12" },
  { id: "FT_13", labelKey: "tests.simbaTasks.FT_13" },
  { id: "FT_14", labelKey: "tests.simbaTasks.FT_14" },
  { id: "FT_15", labelKey: "tests.simbaTasks.FT_15" },
  { id: "FT_16", labelKey: "tests.simbaTasks.FT_16" },
  { id: "FT_17", labelKey: "tests.simbaTasks.FT_17" },
  { id: "FT_18", labelKey: "tests.simbaTasks.FT_18" },
  { id: "FT_19", labelKey: "tests.simbaTasks.FT_19" },
  { id: "FT_20", labelKey: "tests.simbaTasks.FT_20" },
  { id: "FT_21", labelKey: "tests.simbaTasks.FT_21" },
  { id: "FT_22", labelKey: "tests.simbaTasks.FT_22" },
  { id: "FT_23", labelKey: "tests.simbaTasks.FT_23" },
  { id: "FT_24", labelKey: "tests.simbaTasks.FT_24" },
  { id: "FT_25", labelKey: "tests.simbaTasks.FT_25" },
];
const SIMBA_FUNCTIONAL_PASS_THRESHOLD = 3;

const SIMBA_TASK_MAP_PUBLIC = Object.fromEntries(
  [...SIMBA_PUBLIC_SPACE_TASKS, ...SIMBA_PUBLIC_SPACE_REQUIREMENTS].map((tx) => [tx.id, tx.labelKey])
);
const SIMBA_TASK_MAP_FUNCTIONAL = Object.fromEntries(SIMBA_FUNCTIONAL_TASKS.map((tx) => [tx.id, tx.labelKey]));
const SIMBA_TASK_MAP_COMBINED = { ...SIMBA_TASK_MAP_PUBLIC, ...SIMBA_TASK_MAP_FUNCTIONAL };

const OVERALL_RESULT_MAP: Record<string, { labelKey: string; color: string }> = {
  PASS: { labelKey: "tests.results.PASS", color: "bg-emerald-100 text-emerald-700" },
  FAIL: { labelKey: "tests.results.FAIL", color: "bg-red-100 text-red-600" },
  CONDITIONAL_PASS: { labelKey: "tests.results.CONDITIONAL_PASS", color: "bg-amber-100 text-amber-700" },
};

function TrainingTestsTab({ dog, dogId }: { dog: ServiceDogDetail; dogId: string }) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const formatDate = useFormatDay();
  const queryClient = useQueryClient();
  const [showAddTest, setShowAddTest] = useState(false);
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
  const [editingTest, setEditingTest] = useState<TrainingTest | null>(null);

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
      toast.success(t("tests.toastSaved"));
      setShowAddTest(false);
    },
    onError: () => toast.error(t("tests.errorSave")),
  });

  const deleteTest = (testId: string) => {
    if (!confirm(t("tests.confirmDelete"))) return;
    saveMutation.mutate({ targetDogId: dogId, newTests: tests.filter((tx) => tx.id !== testId) });
  };

  const passCount = tests.filter((tx) => tx.overallResult === "PASS" || tx.overallResult === "CONDITIONAL_PASS").length;
  const failCount = tests.filter((tx) => tx.overallResult === "FAIL").length;

  const today = new Date();
  const overdueRenewals = tests.filter(
    (tx) => tx.testType === "ANNUAL_RETEST" && tx.nextRenewalDate && new Date(tx.nextRenewalDate) < today
  );
  const upcomingRenewals = tests.filter(
    (tx) => tx.testType === "ANNUAL_RETEST" && tx.nextRenewalDate &&
      new Date(tx.nextRenewalDate) >= today &&
      new Date(tx.nextRenewalDate) < new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  );

  return (
    <div className="space-y-4">
      {overdueRenewals.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2">
          <span className="text-red-500 text-sm mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-red-700">{t("tests.annualExpired")}</p>
            <p className="text-xs text-red-600">
              {overdueRenewals.map((tx) => `${formatDate(tx.nextRenewalDate!)} (${formatDate(tx.date)})`).join(" · ")}
            </p>
          </div>
        </div>
      )}
      {upcomingRenewals.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2">
          <span className="text-amber-500 text-sm mt-0.5">🔔</span>
          <div>
            <p className="text-sm font-semibold text-amber-700">{t("tests.annualUpcoming")}</p>
            <p className="text-xs text-amber-600">
              {upcomingRenewals.map((tx) => t("tests.renewalOn", { date: formatDate(tx.nextRenewalDate!) })).join(" · ")}
            </p>
          </div>
        </div>
      )}
      {tests.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold">{tests.length}</p>
            <p className="text-xs text-petra-muted">{t("tests.statTests")}</p>
          </div>
          <div className="card p-3 text-center border-emerald-200 bg-emerald-50">
            <p className="text-2xl font-bold text-emerald-700">{passCount}</p>
            <p className="text-xs text-emerald-600">{t("tests.statPassed")}</p>
          </div>
          <div className="card p-3 text-center border-red-200 bg-red-50">
            <p className="text-2xl font-bold text-red-700">{failCount}</p>
            <p className="text-xs text-red-600">{t("tests.statFailed")}</p>
          </div>
        </div>
      )}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-brand-500" />
            {t("tests.listTitle")}{tests.length})
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
                      <span className="font-semibold text-sm">{TEST_TYPE_MAP[test.testType] ? t(TEST_TYPE_MAP[test.testType]) : test.testType}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", res?.color)}>
                        {res ? t(res.labelKey) : test.overallResult}
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
                      {(test.testType === "SIMBA_PUBLIC_SPACE" || test.testType === "SIMBA_FUNCTIONAL_TASKS" || test.testType === "SIMBA_COMBINED") ? (
                        <span>
                          {(test.testItems || []).filter((i) => i.passed).length}/
                          {test.testType === "SIMBA_PUBLIC_SPACE" ? SIMBA_PUBLIC_SPACE_TASKS.length
                            : test.testType === "SIMBA_FUNCTIONAL_TASKS" ? SIMBA_FUNCTIONAL_TASKS.length
                            : SIMBA_PUBLIC_SPACE_TASKS.length + SIMBA_FUNCTIONAL_TASKS.length} {t("tests.tasksPassed")}
                        </span>
                      ) : (
                        <span>{test.categories?.length || 0} {t("tests.categoriesCount")}</span>
                      )}
                      {test.testType === "ANNUAL_RETEST" && test.nextRenewalDate && (
                        <span className={cn(
                          "flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full",
                          new Date(test.nextRenewalDate) < new Date()
                            ? "bg-red-100 text-red-600"
                            : new Date(test.nextRenewalDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-500"
                        )}>
                          {t("shared.renewalColon")} {formatDate(test.nextRenewalDate)}
                        </span>
                      )}
                      {test.fileUrl && (
                        <a href={test.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-xs text-brand-500 hover:underline" title={t("tests.openFile")} onClick={(e) => e.stopPropagation()}>
                          <FileText className="w-3 h-3" /> {t("tests.file")}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingTest(test); }}
                      className="w-7 h-7 rounded flex items-center justify-center hover:bg-slate-100 transition-all"
                      title={t("tests.editDateType")}
                    >
                      <Pencil className="w-3.5 h-3.5 text-petra-muted" />
                    </button>
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
                    {/* Simba test items display */}
                    {(test.testType === "SIMBA_PUBLIC_SPACE" || test.testType === "SIMBA_FUNCTIONAL_TASKS" || test.testType === "SIMBA_COMBINED") && test.testItems && (
                      <div className="space-y-3">
                        {test.testType === "SIMBA_COMBINED" && (
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("tests.publicSpace")}</p>
                        )}
                        <div className="divide-y">
                          {test.testItems
                            .filter((item) => test.testType === "SIMBA_FUNCTIONAL_TASKS"
                              ? true
                              : test.testType === "SIMBA_COMBINED"
                                ? !item.taskId.startsWith("FT_")
                                : true)
                            .map((item) => {
                              const taskMap = test.testType === "SIMBA_FUNCTIONAL_TASKS"
                                ? SIMBA_TASK_MAP_FUNCTIONAL
                                : test.testType === "SIMBA_COMBINED"
                                  ? SIMBA_TASK_MAP_COMBINED
                                  : SIMBA_TASK_MAP_PUBLIC;
                              const label = taskMap[item.taskId] ? t(taskMap[item.taskId]) : item.taskId;
                              const isReq = item.taskId.startsWith("PS_R");
                              return (
                                <div key={item.taskId} className={cn(
                                  "flex items-start gap-2 py-1.5",
                                  isReq && "bg-orange-50/40"
                                )}>
                                  <span className={cn("text-xs font-bold mt-0.5 shrink-0",
                                    item.passed ? "text-emerald-600" : "text-red-400")}>
                                    {item.passed ? "✓" : "✗"}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm">{label}</p>
                                    {item.notes && <p className="text-xs text-amber-600 mt-0.5">{item.notes}</p>}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                        {test.testType === "SIMBA_COMBINED" && (
                          <>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-1">{t("tests.functionalTasks")}</p>
                            <div className="divide-y">
                              {test.testItems.filter((item) => item.taskId.startsWith("FT_")).map((item) => (
                                <div key={item.taskId} className="flex items-start gap-2 py-1.5">
                                  <span className={cn("text-xs font-bold mt-0.5 shrink-0",
                                    item.passed ? "text-emerald-600" : "text-red-400")}>
                                    {item.passed ? "✓" : "✗"}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm">{SIMBA_TASK_MAP_FUNCTIONAL[item.taskId] ? t(SIMBA_TASK_MAP_FUNCTIONAL[item.taskId]) : item.taskId}</p>
                                    {item.notes && <p className="text-xs text-amber-600 mt-0.5">{item.notes}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {/* ADI categories display */}
                    {test.testType !== "SIMBA_PUBLIC_SPACE" && test.testType !== "SIMBA_FUNCTIONAL_TASKS" && (
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
                                <p className="text-sm">{ADI_TEST_CATEGORY_MAP[cat.categoryKey] ? t(ADI_TEST_CATEGORY_MAP[cat.categoryKey]) : cat.categoryKey}</p>
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
                    )}
                    {test.notes && (
                      <div className="bg-white rounded-lg p-3 border">
                        <p className="text-xs text-petra-muted mb-1">{t("tests.generalNotes")}</p>
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
            {t("tests.addTest")}
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

      {editingTest && (
        <EditTrainingTestModal
          test={editingTest}
          onSave={(updated) => {
            saveMutation.mutate({
              targetDogId: dogId,
              newTests: tests.map((tx) => (tx.id === updated.id ? updated : tx)),
            });
            setEditingTest(null);
          }}
          onClose={() => setEditingTest(null)}
          isSaving={saveMutation.isPending}
        />
      )}
    </div>
  );
}

// ─── Edit Training Test Modal (date + test type only) ───

function EditTrainingTestModal({
  test, onSave, onClose, isSaving,
}: {
  test: TrainingTest;
  onSave: (updated: TrainingTest) => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const [date, setDate] = useState(test.date ? test.date.split("T")[0] : "");
  const [testType, setTestType] = useState(test.testType);

  // Offer the current type even if it's a legacy one no longer creatable
  const typeOptions = TEST_TYPES.some((tx) => tx.id === test.testType)
    ? TEST_TYPES
    : [{ id: test.testType, labelKey: TEST_TYPE_MAP[test.testType] as string | undefined }, ...TEST_TYPES];

  const handleSave = () => {
    const updated: TrainingTest = { ...test, date, testType };
    // Switching to the annual retest type — make sure a renewal date exists
    if (testType === "ANNUAL_RETEST" && !updated.nextRenewalDate && date) {
      const d = new Date(date);
      d.setFullYear(d.getFullYear() + 1);
      updated.nextRenewalDate = d.toISOString().split("T")[0];
    }
    onSave(updated);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{t("tests.editTitle")}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">{t("tests.testType")}</label>
            <select value={testType} onChange={(e) => setTestType(e.target.value)} className="input w-full">
              {typeOptions.map((tx) => (<option key={tx.id} value={tx.id}>{tx.labelKey ? t(tx.labelKey) : tx.id}</option>))}
            </select>
          </div>
          <div>
            <label className="label">{t("tests.date")}</label>
            <input type="date" lang={cfg.lang} value={date} onChange={(e) => setDate(e.target.value)} className="input w-full" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={isSaving} onClick={handleSave}>
            {isSaving ? tc("progress.saving") : tc("actions.save")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
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
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const [selectedDogId, setSelectedDogId] = useState(currentDogId);
  const [testType, setTestType] = useState("SIMBA_COMBINED");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [examinerName, setExaminerName] = useState("");
  const [overallResult, setOverallResult] = useState<"PASS" | "FAIL" | "CONDITIONAL_PASS">("PASS");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [nextRenewalDate, setNextRenewalDate] = useState("");

  // ADI categories state
  const [categories, setCategories] = useState<TestCategory[]>(
    ADI_TEST_CATEGORIES.map((c) => ({
      id: crypto.randomUUID(),
      categoryKey: c.key,
      result: "NOT_TESTED" as const,
      score: null,
      improvementPoints: "",
    }))
  );

  // Simba test items state
  const [testItems, setTestItems] = useState<TestItem[]>([]);

  // Initialize testItems when testType changes to a Simba type
  const initSimbaItems = (type: string) => {
    if (type === "SIMBA_PUBLIC_SPACE") {
      setTestItems([
        ...SIMBA_PUBLIC_SPACE_TASKS.map((tx) => ({ taskId: tx.id, passed: false, notes: "" })),
        ...SIMBA_PUBLIC_SPACE_REQUIREMENTS.map((tx) => ({ taskId: tx.id, passed: false, notes: "" })),
      ]);
    } else if (type === "SIMBA_FUNCTIONAL_TASKS") {
      setTestItems(SIMBA_FUNCTIONAL_TASKS.map((tx) => ({ taskId: tx.id, passed: false, notes: "" })));
    } else if (type === "SIMBA_COMBINED") {
      setTestItems([
        ...SIMBA_PUBLIC_SPACE_TASKS.map((tx) => ({ taskId: tx.id, passed: false, notes: "" })),
        ...SIMBA_PUBLIC_SPACE_REQUIREMENTS.map((tx) => ({ taskId: tx.id, passed: false, notes: "" })),
        ...SIMBA_FUNCTIONAL_TASKS.map((tx) => ({ taskId: tx.id, passed: false, notes: "" })),
      ]);
    }
  };

  // On mount, initialize Simba items for default type
  useState(() => { initSimbaItems(testType); });

  const handleTestTypeChange = (type: string) => {
    setTestType(type);
    initSimbaItems(type);
    if (type === "ANNUAL_RETEST") {
      const d = new Date(date);
      d.setFullYear(d.getFullYear() + 1);
      setNextRenewalDate(d.toISOString().split("T")[0]);
    } else {
      setNextRenewalDate("");
    }
  };

  const toggleItem = (taskId: string) => {
    setTestItems((prev) => prev.map((i) => i.taskId === taskId ? { ...i, passed: !i.passed } : i));
  };

  const updateItemNotes = (taskId: string, notes: string) => {
    setTestItems((prev) => prev.map((i) => i.taskId === taskId ? { ...i, notes } : i));
  };

  const updateCategory = (categoryKey: string, field: string, value: string | number | null) => {
    setCategories((prev) =>
      prev.map((c) => (c.categoryKey === categoryKey ? { ...c, [field]: value } : c))
    );
  };

  const isSimbaTest = testType === "SIMBA_PUBLIC_SPACE" || testType === "SIMBA_FUNCTIONAL_TASKS" || testType === "SIMBA_COMBINED";

  // Auto-compute pass/fail indicator for Simba tests
  const simbaPassedCount = testItems.filter((i) => i.passed).length;
  const simbaAutoResult: "PASS" | "FAIL" = testType === "SIMBA_FUNCTIONAL_TASKS"
    ? (simbaPassedCount >= SIMBA_FUNCTIONAL_PASS_THRESHOLD ? "PASS" : "FAIL")
    : (testType === "SIMBA_PUBLIC_SPACE" || testType === "SIMBA_COMBINED"
        ? (testItems.filter((i) => i.taskId.startsWith("PS_R")).every((i) => i.passed) &&
           testItems.filter((i) => i.taskId.startsWith("PS_0")).every((i) => i.passed) ? "PASS" : "FAIL")
        : "PASS");

  const handleSave = async () => {
    let fileUrl: string | undefined;
    let fileName: string | undefined;
    if (selectedFile) {
      setIsUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", selectedFile);
        const res = await fetch(`/api/service-dogs/${selectedDogId}/upload`, { method: "POST", body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error || t("shared.errorFileUpload"));
          return;
        }
        const doc = await res.json();
        fileUrl = doc.url;
        fileName = selectedFile.name;
      } finally {
        setIsUploading(false);
      }
    }
    onSave({
      id: crypto.randomUUID(),
      date,
      examinerName,
      testType,
      categories: isSimbaTest ? [] : categories.filter((c) => c.result !== "NOT_TESTED"),
      testItems: isSimbaTest ? testItems : undefined,
      overallResult,
      notes,
      ...(fileUrl && { fileUrl, fileName }),
      ...(nextRenewalDate && { nextRenewalDate }),
    }, selectedDogId);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{t("tests.addTitle")}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Dog selector */}
          <div className="bg-slate-50 rounded-xl p-3 border">
            <label className="label text-xs mb-1">{t("tests.linkedDog")}</label>
            <select
              value={selectedDogId}
              onChange={(e) => setSelectedDogId(e.target.value)}
              className="input w-full text-sm"
            >
              {allDogs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.pet.name}{d.id === currentDogId ? t("tests.current") : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("tests.testType")}</label>
              <select value={testType} onChange={(e) => handleTestTypeChange(e.target.value)} className="input w-full">
                {TEST_TYPES.map((tx) => (<option key={tx.id} value={tx.id}>{t(tx.labelKey)}</option>))}
              </select>
            </div>
            <div>
              <label className="label">{t("tests.date")}</label>
              <input type="date" lang={cfg.lang} value={date} onChange={(e) => setDate(e.target.value)} className="input w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("tests.examinerName")}</label>
              <input value={examinerName} onChange={(e) => setExaminerName(e.target.value)} className="input w-full" placeholder={t("tests.examinerPlaceholder")} />
            </div>
            <div>
              <label className="label">{t("tests.overallResult")}</label>
              <select value={overallResult} onChange={(e) => setOverallResult(e.target.value as "PASS" | "FAIL" | "CONDITIONAL_PASS")} className="input w-full">
                <option value="PASS">{t("tests.results.PASS")}</option>
                <option value="CONDITIONAL_PASS">{t("tests.results.CONDITIONAL_PASS")}</option>
                <option value="FAIL">{t("tests.results.FAIL")}</option>
              </select>
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className="label">{t("tests.uploadFileOptional")}</label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 flex items-center gap-3">
              <input
                type="file"
                id="test-file-upload"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <label htmlFor="test-file-upload" className="btn-secondary text-xs cursor-pointer px-3 py-1.5 shrink-0">
                {t("tests.chooseFile")}
              </label>
              <span className="text-xs text-petra-muted truncate flex-1">
                {selectedFile ? selectedFile.name : t("tests.fileHint")}
              </span>
              {selectedFile && (
                <button type="button" onClick={() => setSelectedFile(null)} className="text-xs text-red-500 hover:text-red-600 shrink-0">
                  {t("tests.remove")}
                </button>
              )}
            </div>
          </div>
          {isSimbaTest && (
            <div className={cn(
              "text-center text-xs font-medium py-1.5 rounded-lg",
              simbaAutoResult === "PASS" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"
            )}>
              {testType === "SIMBA_FUNCTIONAL_TASKS"
                ? t("tests.autoCalcFunctional", { passed: simbaPassedCount, total: SIMBA_FUNCTIONAL_TASKS.length, result: simbaAutoResult === "PASS" ? t("tests.pass") : t("tests.fail"), threshold: SIMBA_FUNCTIONAL_PASS_THRESHOLD })
                : testType === "SIMBA_COMBINED"
                  ? t("tests.autoCalcCombined", { passed: simbaPassedCount, total: SIMBA_PUBLIC_SPACE_TASKS.length + SIMBA_FUNCTIONAL_TASKS.length, result: simbaAutoResult === "PASS" ? t("tests.pass") : t("tests.fail") })
                  : t("tests.autoCalc", { result: simbaAutoResult === "PASS" ? t("tests.pass") : t("tests.fail") })
              }
            </div>
          )}

          {/* Simba Public Space tasks */}
          {testType === "SIMBA_PUBLIC_SPACE" && (
            <div>
              <label className="label mb-2">
                {t("tests.testTasks")}
                <span className="text-xs text-petra-muted font-normal ms-2">({testItems.filter((i) => i.taskId.startsWith("PS_0")).filter((i) => i.passed).length}/{SIMBA_PUBLIC_SPACE_TASKS.length} {t("tests.passedParen")}</span>
              </label>
              <div className="border rounded-xl overflow-hidden">
                <div className="divide-y max-h-72 overflow-y-auto">
                  {SIMBA_PUBLIC_SPACE_TASKS.map((task) => {
                    const item = testItems.find((i) => i.taskId === task.id);
                    return (
                      <div key={task.id} className={cn("flex items-center gap-3 px-3 py-2", item?.passed && "bg-emerald-50")}>
                        <button
                          type="button"
                          onClick={() => toggleItem(task.id)}
                          className={cn(
                            "w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all",
                            item?.passed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 bg-white"
                          )}
                        >
                          {item?.passed && <Check className="w-3 h-3" />}
                        </button>
                        <span className="text-sm flex-1">{t(task.labelKey)}</span>
                        <input
                          type="text"
                          value={item?.notes ?? ""}
                          onChange={(e) => updateItemNotes(task.id, e.target.value)}
                          className="text-xs border rounded px-1.5 py-0.5 w-32 flex-shrink-0"
                          placeholder={t("tests.notesPlaceholder")}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3">
                <label className="label mb-2 text-orange-700">{t("tests.additionalRequirements")}</label>
                <div className="border border-orange-200 rounded-xl overflow-hidden bg-orange-50">
                  {SIMBA_PUBLIC_SPACE_REQUIREMENTS.map((req) => {
                    const item = testItems.find((i) => i.taskId === req.id);
                    return (
                      <div key={req.id} className={cn("flex items-center gap-3 px-3 py-2 border-b border-orange-100 last:border-b-0", item?.passed && "bg-emerald-50")}>
                        <button
                          type="button"
                          onClick={() => toggleItem(req.id)}
                          className={cn(
                            "w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all",
                            item?.passed ? "bg-emerald-500 border-emerald-500 text-white" : "border-orange-300 bg-white"
                          )}
                        >
                          {item?.passed && <Check className="w-3 h-3" />}
                        </button>
                        <span className="text-sm flex-1 text-orange-800">{t(req.labelKey)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Simba Functional Tasks */}
          {testType === "SIMBA_FUNCTIONAL_TASKS" && (
            <div>
              <label className="label mb-1">
                {t("tests.functionalTasks")}
                <span className="text-xs text-petra-muted font-normal ms-2">{t("tests.requiredPrefix")} {SIMBA_FUNCTIONAL_PASS_THRESHOLD} {t("tests.requiredToPass")}</span>
              </label>
              <div className="border rounded-xl overflow-hidden">
                <div className="divide-y max-h-72 overflow-y-auto">
                  {SIMBA_FUNCTIONAL_TASKS.map((task) => {
                    const item = testItems.find((i) => i.taskId === task.id);
                    return (
                      <div key={task.id} className={cn("flex items-center gap-3 px-3 py-2", item?.passed && "bg-emerald-50")}>
                        <button
                          type="button"
                          onClick={() => toggleItem(task.id)}
                          className={cn(
                            "w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all",
                            item?.passed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 bg-white"
                          )}
                        >
                          {item?.passed && <Check className="w-3 h-3" />}
                        </button>
                        <span className="text-sm flex-1">{t(task.labelKey)}</span>
                        <input
                          type="text"
                          value={item?.notes ?? ""}
                          onChange={(e) => updateItemNotes(task.id, e.target.value)}
                          className="text-xs border rounded px-1.5 py-0.5 w-32 flex-shrink-0"
                          placeholder={t("tests.notesPlaceholder")}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Simba Combined — Public Space + Functional */}
          {testType === "SIMBA_COMBINED" && (
            <div className="space-y-4">
              <div>
                <label className="label mb-2">
                  {t("tests.publicSpaceAlt")}
                  <span className="text-xs text-petra-muted font-normal ms-2">({testItems.filter((i) => i.taskId.startsWith("PS_0") && i.passed).length}/{SIMBA_PUBLIC_SPACE_TASKS.length} {t("tests.passedParen")}</span>
                </label>
                <div className="border rounded-xl overflow-hidden">
                  <div className="divide-y max-h-60 overflow-y-auto">
                    {SIMBA_PUBLIC_SPACE_TASKS.map((task) => {
                      const item = testItems.find((i) => i.taskId === task.id);
                      return (
                        <div key={task.id} className={cn("flex items-center gap-3 px-3 py-2", item?.passed && "bg-emerald-50")}>
                          <button type="button" onClick={() => toggleItem(task.id)} className={cn("w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all", item?.passed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 bg-white")}>
                            {item?.passed && <Check className="w-3 h-3" />}
                          </button>
                          <span className="text-sm flex-1">{t(task.labelKey)}</span>
                          <input type="text" value={item?.notes ?? ""} onChange={(e) => updateItemNotes(task.id, e.target.value)} className="text-xs border rounded px-1.5 py-0.5 w-32 flex-shrink-0" placeholder={t("tests.notesPlaceholder")} />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-2">
                  <label className="label mb-1 text-orange-700 text-xs">{t("tests.additionalRequirements")}</label>
                  <div className="border border-orange-200 rounded-xl overflow-hidden bg-orange-50">
                    {SIMBA_PUBLIC_SPACE_REQUIREMENTS.map((req) => {
                      const item = testItems.find((i) => i.taskId === req.id);
                      return (
                        <div key={req.id} className={cn("flex items-center gap-3 px-3 py-2 border-b border-orange-100 last:border-b-0", item?.passed && "bg-emerald-50")}>
                          <button type="button" onClick={() => toggleItem(req.id)} className={cn("w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all", item?.passed ? "bg-emerald-500 border-emerald-500 text-white" : "border-orange-300 bg-white")}>
                            {item?.passed && <Check className="w-3 h-3" />}
                          </button>
                          <span className="text-sm flex-1 text-orange-800">{t(req.labelKey)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div>
                <label className="label mb-1">
                  {t("tests.functionalTasks")}
                  <span className="text-xs text-petra-muted font-normal ms-2">{t("tests.requiredPrefix")} {SIMBA_FUNCTIONAL_PASS_THRESHOLD} {t("tests.requiredMin")}</span>
                </label>
                <div className="border rounded-xl overflow-hidden">
                  <div className="divide-y max-h-60 overflow-y-auto">
                    {SIMBA_FUNCTIONAL_TASKS.map((task) => {
                      const item = testItems.find((i) => i.taskId === task.id);
                      return (
                        <div key={task.id} className={cn("flex items-center gap-3 px-3 py-2", item?.passed && "bg-emerald-50")}>
                          <button type="button" onClick={() => toggleItem(task.id)} className={cn("w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all", item?.passed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 bg-white")}>
                            {item?.passed && <Check className="w-3 h-3" />}
                          </button>
                          <span className="text-sm flex-1">{t(task.labelKey)}</span>
                          <input type="text" value={item?.notes ?? ""} onChange={(e) => updateItemNotes(task.id, e.target.value)} className="text-xs border rounded px-1.5 py-0.5 w-32 flex-shrink-0" placeholder={t("tests.notesPlaceholder")} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Annual exam renewal date */}
          {testType === "ANNUAL_RETEST" && (
            <div>
              <label className="label">{t("tests.renewalDateNextYear")}</label>
              <input
                type="date" lang={cfg.lang}
                value={nextRenewalDate}
                onChange={(e) => setNextRenewalDate(e.target.value)}
                className="input w-full"
              />
              <p className="text-xs text-petra-muted mt-1">{t("tests.renewalAlertHint")}</p>
            </div>
          )}

          {/* ADI categories — only for non-Simba test types */}
          {!isSimbaTest && (
            <div>
              <label className="label mb-2">{t("tests.adiCategoriesTitle")}</label>
              <div className="border rounded-xl overflow-hidden">
                <div className="grid grid-cols-[2fr_80px_60px_1fr] gap-0 bg-slate-50 px-3 py-2 text-xs font-semibold text-petra-muted border-b">
                  <span>{t("tests.colCategory")}</span>
                  <span className="text-center">{t("tests.colResult")}</span>
                  <span className="text-center">{t("tests.colScore")}</span>
                  <span>{t("tests.colImprovement")}</span>
                </div>
                <div className="divide-y max-h-64 overflow-y-auto">
                  {categories.map((cat) => (
                    <div key={cat.categoryKey} className="grid grid-cols-[2fr_80px_60px_1fr] gap-2 px-3 py-2 items-center">
                      <span className="text-sm">{ADI_TEST_CATEGORY_MAP[cat.categoryKey] && t(ADI_TEST_CATEGORY_MAP[cat.categoryKey])}</span>
                      <select
                        value={cat.result}
                        onChange={(e) => updateCategory(cat.categoryKey, "result", e.target.value)}
                        className="text-xs border rounded px-1 py-1 bg-white"
                      >
                        <option value="NOT_TESTED">—</option>
                        <option value="PASS">{t("tests.pass")}</option>
                        <option value="FAIL">{t("tests.fail")}</option>
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
                        placeholder={t("tests.notesPlaceholder")}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="label">{t("tests.generalNotes")}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input w-full" rows={3} placeholder={t("tests.summaryPlaceholder")} />
          </div>
        </div>
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <button onClick={handleSave} disabled={isSaving || isUploading} className="btn-primary flex-1">
            {isUploading ? t("shared.uploadingFile") : isSaving ? tc("progress.saving") : t("tests.saveTest")}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">{tc("actions.cancel")}</button>
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
  fileName?: string;
  fileSize?: number;
  isFile?: boolean;
}

const DOG_DOC_TYPES = [
  { id: "HEALTH_CERT", labelKey: "documents.types.HEALTH_CERT" },
  { id: "ANTIBODIES", labelKey: "documents.types.ANTIBODIES" },
  { id: "LICENSE", labelKey: "documents.types.LICENSE" },
  { id: "VACCINATION", labelKey: "documents.types.VACCINATION" },
  { id: "VET_REPORT", labelKey: "documents.types.VET_REPORT" },
  { id: "PURCHASE_INVOICE", labelKey: "documents.types.PURCHASE_INVOICE" },
  { id: "VISIT_INVOICE", labelKey: "documents.types.VISIT_INVOICE" },
  { id: "OTHER", labelKey: "documents.types.OTHER" },
];
const DOG_DOC_TYPE_MAP = Object.fromEntries(DOG_DOC_TYPES.map((d) => [d.id, d.labelKey]));

function DocumentsTab({ dog, dogId }: { dog: ServiceDogDetail; dogId: string }) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const formatDate = useFormatDay();
  const queryClient = useQueryClient();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DogDocument | null>(null);

  // Exclude training-test file attachments — they belong only in the tests tab
  const documents: DogDocument[] = (Array.isArray(dog.documents) ? (dog.documents as DogDocument[]) : [])
    .filter((d) => d.docType !== "TRAINING_CERT");

  const deleteMutation = useMutation({
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
      toast.success(t("shared.toastDocDeleted"));
    },
    onError: () => toast.error(t("shared.errorDocDelete")),
  });

  const deleteDoc = (docId: string) => {
    if (!confirm(t("documents.confirmDelete"))) return;
    deleteMutation.mutate(documents.filter((d) => d.id !== docId));
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4 text-brand-500" />
          {t("documents.title")}{documents.length})
        </h3>
        <button
          onClick={() => setShowUploadModal(true)}
          className="btn-primary flex items-center gap-1.5 text-sm"
        >
          <Upload className="w-4 h-4" />
          {t("documents.upload")}
        </button>
      </div>

      {/* Grouped by category */}
      {DOG_DOC_TYPES.map((dt) => {
        const docs = documents.filter((d) => d.docType === dt.id);
        if (docs.length === 0) return null;
        return (
          <div key={dt.id} className="mb-5">
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">{t(dt.labelKey)}</p>
            <div className="space-y-2">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl border bg-slate-50/50 group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-brand-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{doc.name}</p>
                      <p className="text-xs text-petra-muted">
                        {doc.fileName && `${doc.fileName} · `}
                        {doc.uploadedAt && formatDate(doc.uploadedAt)}
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
                        title={t("documents.open")}
                      >
                        <ExternalLink className="w-4 h-4 text-brand-500" />
                      </a>
                    )}
                    <button
                      onClick={() => setEditingDoc(doc)}
                      className="w-8 h-8 rounded flex items-center justify-center hover:bg-slate-100 transition-colors"
                      title={t("documents.editNameType")}
                    >
                      <Pencil className="w-4 h-4 text-petra-muted" />
                    </button>
                    <button
                      onClick={() => deleteDoc(doc.id)}
                      className="w-8 h-8 rounded flex items-center justify-center hover:bg-red-100 transition-colors"
                      title={tc("actions.delete")}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* "אחר" / uncategorized — docs with unknown type */}
      {documents.filter((d) => !DOG_DOC_TYPES.find((dt) => dt.id === d.docType)).length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">{t("documents.types.OTHER")}</p>
          <div className="space-y-2">
            {documents.filter((d) => !DOG_DOC_TYPES.find((dt) => dt.id === d.docType)).map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl border bg-slate-50/50 group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-brand-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{doc.name}</p>
                    <p className="text-xs text-petra-muted">
                      {doc.fileName && `${doc.fileName} · `}
                      {doc.uploadedAt && formatDate(doc.uploadedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noreferrer"
                      className="w-8 h-8 rounded flex items-center justify-center hover:bg-brand-50 transition-colors" title={t("documents.open")}>
                      <ExternalLink className="w-4 h-4 text-brand-500" />
                    </a>
                  )}
                  <button onClick={() => setEditingDoc(doc)}
                    className="w-8 h-8 rounded flex items-center justify-center hover:bg-slate-100 transition-colors" title={t("documents.editNameType")}>
                    <Pencil className="w-4 h-4 text-petra-muted" />
                  </button>
                  <button onClick={() => deleteDoc(doc.id)}
                    className="w-8 h-8 rounded flex items-center justify-center hover:bg-red-100 transition-colors" title={tc("actions.delete")}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {documents.length === 0 && (
        <div className="text-center py-8">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-petra-muted">{t("documents.empty")}</p>
        </div>
      )}

      {editingDoc && (
        <EditDogDocModal
          dogId={dogId}
          doc={editingDoc}
          onClose={() => setEditingDoc(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
            setEditingDoc(null);
            toast.success(t("documents.toastUpdated"));
          }}
        />
      )}

      {showUploadModal && (
        <UploadDogDocModal
          dogId={dogId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
            setShowUploadModal(false);
            toast.success(t("documents.toastUploaded"));
          }}
          onClose={() => setShowUploadModal(false)}
        />
      )}
    </div>
  );
}

// ─── Edit Dog Document (name + type) ───

function EditDogDocModal({
  dogId, doc, onClose, onSaved,
}: {
  dogId: string;
  doc: DogDocument;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const [name, setName] = useState(doc.name);
  // Unknown legacy types are shown as "אחר" until the user picks one
  const [docType, setDocType] = useState(DOG_DOC_TYPES.some((d) => d.id === doc.docType) ? doc.docType : "OTHER");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/service-dogs/${dogId}/documents`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: doc.id, name: name.trim(), docType }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || t("documents.errorUpdate"));
      return data;
    },
    onSuccess: onSaved,
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Pencil className="w-5 h-5 text-brand-500" />
            {t("documents.editTitle")}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label text-xs">{t("documents.name")}</label>
            <input className="input w-full" value={name} maxLength={255} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label text-xs">{t("documents.type")}</label>
            <select className="input w-full" value={docType} onChange={(e) => setDocType(e.target.value)}>
              {DOG_DOC_TYPES.map((d) => <option key={d.id} value={d.id}>{t(d.labelKey)}</option>)}
            </select>
          </div>
          {doc.fileName && <p className="text-xs text-petra-muted">{t("documents.fileLabel")} {doc.fileName} {t("documents.fileUnchanged")}</p>}
        </div>
        <div className="flex gap-2 mt-5">
          <button
            className="btn-primary flex-1"
            onClick={() => saveMutation.mutate()}
            disabled={!name.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending ? tc("progress.saving") : tc("actions.save")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Upload Dog Document Modal ───

function UploadDogDocModal({
  dogId, onSuccess, onClose,
}: {
  dogId: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const [name, setName] = useState("");
  const [docType, setDocType] = useState("OTHER");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file || !name.trim()) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("name", name.trim());
      fd.set("docType", docType);
      const res = await fetch(`/api/service-dogs/${dogId}/documents`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("documents.errorUpload"));
      }
      onSuccess();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("shared.errorFileUpload"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{t("documents.uploadTitle")}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">{t("documents.nameRequired")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input w-full" placeholder={t("documents.namePlaceholder")} />
          </div>
          <div>
            <label className="label">{t("documents.type")}</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input w-full">
              {DOG_DOC_TYPES.map((d) => (
                <option key={d.id} value={d.id}>{t(d.labelKey)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t("documents.fileRequired")}</label>
            <div
              onClick={() => fileRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors",
                file ? "border-brand-300 bg-brand-50" : "border-slate-200 hover:border-brand-300 hover:bg-brand-50/50"
              )}
            >
              <input ref={fileRef} type="file" className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.xls,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file ? (
                <div className="space-y-1">
                  <FileText className="w-6 h-6 text-brand-500 mx-auto" />
                  <p className="text-sm font-medium text-brand-600">{file.name}</p>
                  <p className="text-xs text-petra-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="w-6 h-6 text-petra-muted mx-auto" />
                  <p className="text-sm text-petra-muted">{t("documents.clickToChoose")}</p>
                  <p className="text-xs text-petra-muted">{t("documents.upTo10mb")}</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleUpload}
              disabled={!file || !name.trim() || uploading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t("shared.uploading")}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {t("documents.uploadButton")}
                </>
              )}
            </button>
            <button onClick={onClose} className="btn-secondary flex-1">{tc("actions.cancel")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ID Card Tab ───

function IDCardTab({ dog, dogId, allowManualCert, trackHours }: { dog: ServiceDogDetail; dogId: string; allowManualCert: boolean; trackHours: boolean }) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const formatDate = useFormatDay();
  const queryClient = useQueryClient();
  const [viewingCard, setViewingCard] = useState<IDCard | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [certForm, setCertForm] = useState({
    certificationDate: dog.certificationDate ? new Date(dog.certificationDate).toISOString().split("T")[0] : "",
    certificationExpiry: dog.certificationExpiry ? new Date(dog.certificationExpiry).toISOString().split("T")[0] : "",
    certifyingBody: dog.certifyingBody ?? "",
    registrationNumber: dog.registrationNumber ?? "",
  });

  const certMutation = useMutation({
    mutationFn: (data: typeof certForm) =>
      fetch(`/api/service-dogs/${dogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certificationDate: data.certificationDate || null,
          certificationExpiry: data.certificationExpiry || null,
          certifyingBody: data.certifyingBody || null,
          registrationNumber: data.registrationNumber || null,
        }),
      }).then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      toast.success(t("idCard.toastCertUpdated"));
    },
    onError: () => toast.error(t("shared.errorSave")),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/service-dogs/${dogId}/id-card`, { method: "POST" }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
      toast.success(t("idCard.toastCardIssued"));
    },
    onError: () => toast.error(t("idCard.errorIssue")),
  });

  const manualCertMutation = useMutation({
    mutationFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      // Set phase to CERTIFIED
      await fetch(`/api/service-dogs/${dogId}/phase`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "CERTIFIED" }),
      });
      // Set certificationDate to today if not already set
      if (!certForm.certificationDate) {
        await fetch(`/api/service-dogs/${dogId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ certificationDate: today }),
        });
        setCertForm((f) => ({ ...f, certificationDate: today }));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
      toast.success(t("idCard.toastCertified"));
    },
    onError: () => toast.error(t("idCard.errorCertify")),
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error(t("idCard.photoTooLarge")); return; }
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
        toast.success(t("idCard.toastPhotoUpdated"));
      } catch {
        toast.error(t("idCard.errorPhotoSave"));
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
      toast.error(t("idCard.errorLoadCard"));
    }
  };

  const activeCard = dog.idCards[0];

  return (
    <div className="space-y-4">
      {/* Dog photo upload section */}
      <div className="card p-4 flex items-center gap-4">
        <div className="w-20 h-20 rounded-xl border-2 border-dashed border-petra-border overflow-hidden flex items-center justify-center bg-slate-50 shrink-0">
          {dog.dogPhoto ? (
            <img src={dog.dogPhoto} alt={t("idCard.dogPhotoAlt")} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-8 h-8 text-petra-muted/40" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium mb-1">{t("idCard.photoForCard")}</p>
          <p className="text-xs text-petra-muted mb-2">{t("idCard.photoHint")}</p>
          <label className="btn-secondary text-xs cursor-pointer flex items-center gap-1.5 w-fit">
            <Upload className="w-3.5 h-3.5" />
            {uploadingPhoto ? t("shared.uploading") : dog.dogPhoto ? t("idCard.replacePhoto") : t("idCard.uploadPhoto")}
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
          </label>
        </div>
      </div>

      {/* Certification details form */}
      <div className="card p-5">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-emerald-500" />
          {t("idCard.certDetails")}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">{t("shared.certificationDate")}</label>
            <input
              type="date" lang={cfg.lang}
              className="input"
              value={certForm.certificationDate}
              onChange={(e) => setCertForm({ ...certForm, certificationDate: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t("idCard.certExpiry")}</label>
            <input
              type="date" lang={cfg.lang}
              className="input"
              value={certForm.certificationExpiry}
              onChange={(e) => setCertForm({ ...certForm, certificationExpiry: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t("idCard.certifyingBody")}</label>
            <input
              type="text"
              className="input"
              placeholder={t("idCard.certifyingBodyPlaceholder")}
              value={certForm.certifyingBody}
              onChange={(e) => setCertForm({ ...certForm, certifyingBody: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t("idCard.registrationNumber")}</label>
            <input
              type="text"
              className="input"
              placeholder={t("idCard.registrationPlaceholder")}
              value={certForm.registrationNumber}
              onChange={(e) => setCertForm({ ...certForm, registrationNumber: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t("shared.microchip")}</label>
            <div className="input bg-slate-50 text-petra-muted flex items-center gap-2">
              {dog.pet.microchip ? (
                <span className="font-mono">{dog.pet.microchip}</span>
              ) : (
                <span className="text-petra-muted/60 text-sm">{t("idCard.microchipMissing")}</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => certMutation.mutate(certForm)}
          disabled={certMutation.isPending}
          className="btn-primary mt-4 text-sm"
        >
          {certMutation.isPending ? tc("progress.saving") : t("idCard.saveCertDetails")}
        </button>
      </div>

      {dog.phase !== "CERTIFIED" && !activeCard && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-700">{t("idCard.notCertified")}</p>
            {allowManualCert ? (
              <>
                <p className="text-sm text-amber-600 mt-0.5">
                  {trackHours
                    ? t("idCard.manualHint")
                    : t("idCard.ownerDiscretion")}
                </p>
                <button
                  onClick={() => {
                    if (window.confirm(t("idCard.confirmManual", { name: dog.pet.name }))) {
                      manualCertMutation.mutate();
                    }
                  }}
                  disabled={manualCertMutation.isPending}
                  className="mt-3 btn-primary text-sm inline-flex items-center gap-2"
                >
                  {manualCertMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                  {t("idCard.certifyManually")}
                </button>
              </>
            ) : (
              <p className="text-sm text-amber-600 mt-0.5">
                {t("idCard.onlyCertifiedCanIssue")}
              </p>
            )}
          </div>
        </div>
      )}

      {!activeCard ? (
        <div className="card p-8 text-center">
          <CreditCard className="w-12 h-12 mx-auto text-petra-muted/40 mb-3" />
          <p className="text-petra-muted mb-4">{t("idCard.noActiveCard")}</p>
          {dog.phase === "CERTIFIED" && (
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="btn-primary inline-flex items-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              {generateMutation.isPending ? t("idCard.generating") : t("idCard.issueCard")}
            </button>
          )}
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-500" />
                {t("idCard.activeCard")}
              </h4>
              <p className="text-xs text-petra-muted mt-0.5">
                {t("idCard.issued")} {formatDate(activeCard.generatedAt)}
                {activeCard.expiresAt && t("idCard.expiresSuffix", { date: formatDate(activeCard.expiresAt) })}
              </p>
            </div>
            <span className="badge-success">{t("shared.active")}</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchCard}
              className="btn-secondary flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              {t("idCard.viewCard")}
            </button>
            <button
              onClick={fetchCard}
              className="btn-ghost flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              {t("idCard.print")}
            </button>
          </div>
        </div>
      )}

      {/* Card viewer modal */}
      {viewingCard && (
        <div className="modal-overlay" onClick={() => setViewingCard(null)}>
          <div className="modal-backdrop" />
          <div className="modal-content max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{t("idCard.serviceDogCard")}</h2>
              <button onClick={() => setViewingCard(null)} className="btn-ghost p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {viewingCard.qrPayload && (
              <div className="flex justify-center mb-4 p-4 bg-white border rounded-xl">
                <img
                  src={viewingCard.qrPayload}
                  alt={t("idCard.qrAlt")}
                  className="w-48 h-48"
                />
              </div>
            )}

            {(() => {
              const data = JSON.parse(viewingCard.cardDataJson || "{}");
              return (
                <div className="space-y-2 text-sm">
                  {[
                    { label: t("idCard.fieldDogName"), value: data.dogName },
                    { label: t("shared.breed"), value: data.breed },
                    { label: t("shared.microchip"), value: data.microchip },
                    { label: t("idCard.registrationNumber"), value: data.registrationNumber },
                    { label: t("idCard.certifyingBody"), value: data.certifyingBody },
                    { label: t("idCard.fieldRecipient"), value: data.recipientName },
                    { label: t("shared.certificationDate"), value: data.certificationDate ? formatDate(data.certificationDate) : null },
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
              {t("idCard.printCard")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dog File Tab ───

const BEHAVIOR_FLAGS: { key: keyof PetBehavior; labelKey: string }[] = [
  { key: "dogAggression", labelKey: "dogFile.behaviorFlags.dogAggression" },
  { key: "humanAggression", labelKey: "dogFile.behaviorFlags.humanAggression" },
  { key: "leashReactivity", labelKey: "dogFile.behaviorFlags.leashReactivity" },
  { key: "leashPulling", labelKey: "dogFile.behaviorFlags.leashPulling" },
  { key: "jumping", labelKey: "dogFile.behaviorFlags.jumping" },
  { key: "separationAnxiety", labelKey: "dogFile.behaviorFlags.separationAnxiety" },
  { key: "excessiveBarking", labelKey: "dogFile.behaviorFlags.excessiveBarking" },
  { key: "destruction", labelKey: "dogFile.behaviorFlags.destruction" },
  { key: "resourceGuarding", labelKey: "dogFile.behaviorFlags.resourceGuarding" },
  { key: "fears", labelKey: "dogFile.behaviorFlags.fears" },
  { key: "badWithKids", labelKey: "dogFile.behaviorFlags.badWithKids" },
  { key: "houseSoiling", labelKey: "dogFile.behaviorFlags.houseSoiling" },
  { key: "biteHistory", labelKey: "dogFile.behaviorFlags.biteHistory" },
  { key: "priorTraining", labelKey: "dogFile.behaviorFlags.priorTraining" },
];

function DogFileTab({ dog, dogId }: { dog: ServiceDogDetail; dogId: string }) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const { locale } = useBusinessLocale();
  const formatDate = useFormatDay();
  const queryClient = useQueryClient();
  const pet = dog.pet;

  const [showHealthModal, setShowHealthModal] = useState(false);
  const [showBehaviorModal, setShowBehaviorModal] = useState(false);
  const [showFeedingModal, setShowFeedingModal] = useState(false);
  const [medModal, setMedModal] = useState<{ med: PetMedication | null } | null>(null);
  const [deletingMed, setDeletingMed] = useState<string | null>(null);
  const [editingMicrochip, setEditingMicrochip] = useState(false);
  const [microchipInput, setMicrochipInput] = useState(pet.microchip ?? "");
  const [showEditPetModal, setShowEditPetModal] = useState(false);
  const [renewingVaccine, setRenewingVaccine] = useState<{ type: "rabies" | "dhpp" | "bordetella"; label: string } | null>(null);
  const [renewingTreatment, setRenewingTreatment] = useState<{ type: "parkWorm" | "deworming" | "fleaTick"; label: string } | null>(null);
  const [expandedVaccineHistory, setExpandedVaccineHistory] = useState<string | null>(null);
  const [editingHours, setEditingHours] = useState(false);
  const [hoursInput, setHoursInput] = useState(String(dog.trainingTotalHours ?? 0));
  const [targetHoursInput, setTargetHoursInput] = useState(String(dog.trainingTargetHours ?? 120));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });

  const saveMicrochipMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/pets/${pet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ microchip: microchipInput || null }),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => { invalidate(); setEditingMicrochip(false); toast.success(t("dogFile.toastMicrochipUpdated")); },
    onError: () => toast.error(t("dogFile.errorMicrochip")),
  });

  const saveHoursMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/service-dogs/${dogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingTotalHours: Number(hoursInput) || 0, trainingTargetHours: Number(targetHoursInput) || null }),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => { invalidate(); setEditingHours(false); toast.success(t("dogFile.toastHoursUpdated")); },
    onError: () => toast.error(t("dogFile.errorHours")),
  });

  // ── Active behavior flags ──
  const behaviorFlags = BEHAVIOR_FLAGS.filter(({ key }) => {
    const v = pet.behavior?.[key];
    return typeof v === "boolean" && v;
  });
  const customIssues: string[] = (() => {
    try { return pet.behavior?.customIssues ? JSON.parse(pet.behavior.customIssues) : []; }
    catch { return []; }
  })();

  const toDate = (v: string | null) => v ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(v)) : null;

  const deleteMedMutation = useMutation({
    mutationFn: (medId: string) =>
      fetch(`/api/pets/${pet.id}/medications/${medId}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => { invalidate(); setDeletingMed(null); toast.success(t("dogFile.toastMedRemoved")); },
    onError: () => toast.error(t("dogFile.errorMedDelete")),
  });

  return (
    <div className="space-y-4">
      {/* Basic dog info */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Dog className="w-4 h-4 text-brand-500" />
            {t("dogFile.dogDetails")}
          </h3>
          <button onClick={() => setShowEditPetModal(true)} className="btn-ghost flex items-center gap-1 text-xs text-petra-muted hover:text-foreground">
            <Pencil className="w-3 h-3" /> {t("shared.editShort")}
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {/* Microchip */}
          <div className="col-span-2 sm:col-span-1 bg-brand-50 rounded-lg p-2.5 border border-brand-200">
            <p className="text-xs text-brand-600 font-medium mb-1">{t("shared.microchip")}</p>
            <p className="font-bold font-mono">{pet.microchip || <span className="text-petra-muted font-normal">{t("shared.notEntered")}</span>}</p>
          </div>
          {pet.birthDate ? (
            <div>
              <p className="text-xs text-petra-muted">{t("shared.birthDate")}</p>
              <p className="font-medium">{toDate(pet.birthDate)}</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-petra-muted">{t("shared.birthDate")}</p>
              <p className="text-petra-muted text-xs">{t("shared.notEntered")}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-petra-muted">{t("shared.intakeDate")}</p>
            <p className="font-medium">{dog.intakeDate ? formatDate(dog.intakeDate) : <span className="text-petra-muted text-xs">{t("shared.notEntered")}</span>}</p>
          </div>
          <div>
            <p className="text-xs text-petra-muted">{t("shared.color")}</p>
            <p className="font-medium">{pet.color || <span className="text-petra-muted text-xs">{t("shared.notEntered")}</span>}</p>
          </div>
          <div>
            <p className="text-xs text-petra-muted">{t("shared.sex")}</p>
            <p className="font-medium">{(pet.gender === "male" || pet.gender === "זכר" /* i18n-ok */) ? t("shared.male") : (pet.gender === "female" || pet.gender === "נקבה" /* i18n-ok */) ? t("shared.female") : <span className="text-petra-muted text-xs">{t("shared.notEntered")}</span>}</p>
          </div>
          <div>
            <p className="text-xs text-petra-muted">{t("shared.breed")}</p>
            <p className="font-medium">{pet.breed || <span className="text-petra-muted text-xs">{t("shared.notEntered")}</span>}</p>
          </div>
          {pet.health?.neuteredSpayed !== undefined && (
            <div>
              <p className="text-xs text-petra-muted">{t("dogFile.neuterStatus")}</p>
              <p className="font-medium">{pet.health.neuteredSpayed ? t("shared.neutered") : t("dogFile.notNeutered")}</p>
            </div>
          )}
          {pet.health?.vetName && (
            <div>
              <p className="text-xs text-petra-muted">{t("shared.vet")}</p>
              <p className="font-medium">{pet.health.vetName}</p>
              {pet.health.vetPhone && <p className="text-xs text-petra-muted">{pet.health.vetPhone}</p>}
            </div>
          )}
          {pet.health?.originInfo && (
            <div>
              <p className="text-xs text-petra-muted">{t("dogFile.dogOrigin")}</p>
              <p className="font-medium">{pet.health.originInfo}</p>
            </div>
          )}
          {dog.certificationDate && (
            <div>
              <p className="text-xs text-petra-muted">{t("shared.certificationDate")}</p>
              <p className="font-medium">{formatDate(dog.certificationDate)}</p>
            </div>
          )}
        </div>
        {showEditPetModal && (
          <EditPetModal pet={pet} petId={pet.id} dogId={dogId} certificationDate={dog.certificationDate} initialNotes={dog.notes} initialIntakeDate={dog.intakeDate} onClose={() => setShowEditPetModal(false)} onSaved={invalidate} />
        )}

        {/* Training hours — manual edit */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide">{t("shared.trainingHours")}</p>
            {!editingHours && (
              <button onClick={() => { setHoursInput(String(dog.trainingTotalHours ?? 0)); setTargetHoursInput(String(dog.trainingTargetHours ?? 120)); setEditingHours(true); }} className="btn-ghost flex items-center gap-1 text-xs">
                <Pencil className="w-3 h-3" /> {t("shared.editShort")}
              </button>
            )}
          </div>
          {editingHours ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label text-xs">{t("dogFile.hoursDone")}</label>
                  <input type="number" min={0} step={0.5} value={hoursInput} onChange={(e) => setHoursInput(e.target.value)} className="input text-sm" />
                </div>
                <div>
                  <label className="label text-xs">{t("dogFile.hoursTarget")}</label>
                  <input type="number" min={0} step={10} value={targetHoursInput} onChange={(e) => setTargetHoursInput(e.target.value)} className="input text-sm" placeholder={t("dogFile.noTarget")} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => saveHoursMutation.mutate()} disabled={saveHoursMutation.isPending} className="btn-primary text-xs py-1.5">{tc("actions.save")}</button>
                <button onClick={() => setEditingHours(false)} className="btn-secondary text-xs py-1.5">{tc("actions.cancel")}</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 text-sm">
              <span className="font-bold text-lg">{dog.trainingTotalHours.toFixed(0)}</span>
              {dog.trainingTargetHours ? (
                <span className="text-petra-muted">/ {dog.trainingTargetHours} {t("dogFile.targetHours")}</span>
              ) : (
                <span className="text-petra-muted">{t("dogFile.hoursNoTarget")}</span>
              )}
            </div>
          )}
        </div>

        {/* Service Dog — acquisition, license, maintenance */}
        <SDExtraInfoSection dog={dog} dogId={dogId} />
        {pet.medicalNotes && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-petra-muted mb-1">{t("dogFile.medicalNotes")}</p>
            <p className="text-sm">{pet.medicalNotes}</p>
          </div>
        )}
      </div>

      {/* Feeding */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4 text-amber-500" />
            {t("dogFile.feeding")}
          </h3>
          <button
            className="btn-ghost flex items-center gap-1.5 text-sm"
            onClick={() => setShowFeedingModal(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            {t("dogFile.update")}
          </button>
        </div>
        {(() => {
          const history = (Array.isArray(dog.feedingHistory) ? dog.feedingHistory : []) as FeedingEntry[];
          if (history.length > 0) {
            return (
              <div className="space-y-2">
                {history.map((entry, idx) => (
                  <div key={entry.id} className={`flex items-center justify-between p-3 rounded-xl border group ${idx === 0 ? "bg-amber-50/50 border-amber-200" : "bg-slate-50/50"}`}>
                    {/* Single line, ordered: date · brand+type · amount · frequency · dog weight · notes */}
                    <div className="flex items-center gap-x-3 gap-y-0.5 text-sm flex-wrap flex-1 min-w-0">
                      {idx === 0 && <span className="text-[10px] font-semibold bg-amber-500 text-white px-1.5 py-0.5 rounded shrink-0">{t("dogFile.latest")}</span>}
                      {entry.date && <span className="text-xs text-slate-400 shrink-0">{formatDate(entry.date)}</span>}
                      <span className="font-medium">{entry.foodBrand}{entry.foodType ? ` — ${entry.foodType}` : ""}</span>
                      {entry.foodGramsPerDay && <span className="text-xs text-petra-muted">{t("dogFile.amount")} {entry.foodGramsPerDay} {t("dogFile.gramsPerDay")}</span>}
                      {entry.foodFrequency && <span className="text-xs text-petra-muted">{t("dogFile.frequency")} {entry.foodFrequency}</span>}
                      {entry.dogWeightKg && <span className="text-xs text-petra-muted">{t("dogFile.dogWeight")} {entry.dogWeightKg} {t("dogFile.kg")}</span>}
                      {entry.foodNotes && <span className="text-xs text-petra-muted truncate">{entry.foodNotes}</span>}
                    </div>
                    <button
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded hover:bg-red-100 transition-all shrink-0"
                      title={t("dogFile.deleteEntry")}
                      onClick={async () => {
                        if (!confirm(t("dogFile.confirmDeleteEntry"))) return;
                        const newHistory = history.filter((e) => e.id !== entry.id);
                        const r = await fetch(`/api/service-dogs/${dog.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ feedingHistory: newHistory }),
                        });
                        if (r.ok) queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dog.id] });
                        else toast.error(t("dogFile.errorDeleteFeeding"));
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            );
          }
          if (pet.foodBrand || pet.foodGramsPerDay || pet.foodFrequency || pet.foodNotes) {
            return (
              <div className="space-y-2 text-sm">
                {pet.foodBrand && (
                  <div className="flex gap-2">
                    <span className="text-petra-muted">{t("dogFile.brand")}</span>
                    <span className="font-medium">{pet.foodBrand}</span>
                  </div>
                )}
                <div className="flex gap-6">
                  {pet.foodGramsPerDay && (
                    <div className="flex gap-2">
                      <span className="text-petra-muted">{t("dogFile.amount")}</span>
                      <span className="font-medium">{pet.foodGramsPerDay} {t("dogFile.gramsPerDay")}</span>
                    </div>
                  )}
                  {pet.foodFrequency && (
                    <div className="flex gap-2">
                      <span className="text-petra-muted">{t("dogFile.frequency")}</span>
                      <span>{pet.foodFrequency}</span>
                    </div>
                  )}
                </div>
                {pet.foodNotes && <p className="text-petra-muted text-xs">{pet.foodNotes}</p>}
              </div>
            );
          }
          return (
            <button
              className="w-full text-sm text-amber-400 hover:text-amber-600 py-2 border border-dashed border-amber-200 hover:border-amber-300 rounded-xl transition-colors"
              onClick={() => setShowFeedingModal(true)}
            >
              {t("dogFile.addFeeding")}
            </button>
          );
        })()}
      </div>

      {/* Medications */}
      <div className="card p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-3">
          <Pill className="w-4 h-4 text-red-500" />
          {t("dogFile.medicationsTitle")}{pet.medications.length})
        </h3>
        {pet.medications.length > 0 ? (
          <div className="space-y-2">
            {pet.medications.map((med) => (
              <div key={med.id} className="flex items-start justify-between p-3 bg-red-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium">{med.medName}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-petra-muted mt-0.5">
                    {med.dosage && <span>{t("dogFile.dosage")} {med.dosage}</span>}
                    {med.frequency && <span>{t("dogFile.frequency")} {med.frequency}</span>}
                    {med.times && <span>{t("dogFile.times")} {med.times}</span>}
                    {med.startDate && <span>{t("dogFile.from")}{toDate(med.startDate)}</span>}
                    {med.endDate && <span>{t("shared.until")} {toDate(med.endDate)}</span>}
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
              {t("dogFile.addAnotherMed")}
            </button>
          </div>
        ) : (
          <button
            className="w-full text-sm text-red-400 hover:text-red-600 py-2 border border-dashed border-red-200 hover:border-red-300 rounded-xl transition-colors"
            onClick={() => setMedModal({ med: null })}
          >
            {t("dogFile.addMed")}
          </button>
        )}
      </div>

      {/* Health + Vaccinations */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Heart className="w-4 h-4 text-emerald-500" />
            {t("dogFile.healthVaccines")}
          </h3>
          <button
            className="btn-ghost flex items-center gap-1.5 text-sm"
            onClick={() => setShowHealthModal(true)}
          >
            <Pencil className="w-3.5 h-3.5" />
            {t("shared.editShort")}
          </button>
        </div>
        {pet.health ? (
          <div className="space-y-4">
            {/* Medical info */}
            {(pet.health.allergies || pet.health.medicalConditions || pet.health.surgeriesHistory || pet.health.activityLimitations) && (
              <div>
                <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">{t("shared.medicalCondition")}</p>
                <div className="space-y-1.5 text-sm">
                  {pet.health.allergies && (
                    <div className="flex gap-2">
                      <span className="text-petra-muted">{t("dogFile.allergies")}</span>
                      <span>{pet.health.allergies}</span>
                    </div>
                  )}
                  {pet.health.medicalConditions && (
                    <div className="flex gap-2">
                      <span className="text-petra-muted">{t("dogFile.conditions")}</span>
                      <span>{pet.health.medicalConditions}</span>
                    </div>
                  )}
                  {pet.health.surgeriesHistory && (
                    <div className="flex gap-2">
                      <span className="text-petra-muted">{t("dogFile.surgeries")}</span>
                      <span>{pet.health.surgeriesHistory}</span>
                    </div>
                  )}
                  {pet.health.activityLimitations && (
                    <div className="flex gap-2">
                      <span className="text-petra-muted">{t("dogFile.limitations")}</span>
                      <span>{pet.health.activityLimitations}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Vaccinations */}
            <div>
              <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">{t("shared.vaccinesTreatments")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(() => {
                  const now = new Date();
                  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                  const getStatus = (until: string | null | undefined) => {
                    if (!until) return "ok";
                    const d = new Date(until);
                    if (d < now) return "expired";
                    if (d < soon) return "expiring";
                    return "ok";
                  };
                  const statusStyle = { ok: "bg-emerald-50", expiring: "bg-amber-50 border border-amber-200", expired: "bg-red-50 border border-red-200" };
                  const untilStyle = { ok: "text-petra-muted", expiring: "text-amber-600 font-medium", expired: "text-red-600 font-medium" };
                  const renewableVaccines: { label: string; date: string | null; until: string | null | undefined; vaccineType: "rabies" | "dhpp" | "bordetella"; history: typeof pet.health.dhppHistory }[] = [
                    { label: t("shared.rabies"), date: pet.health.rabiesLastDate, until: pet.health.rabiesValidUntil, vaccineType: "rabies", history: pet.health.rabiesHistory },
                    { label: t("shared.dhppAdult"), date: pet.health.dhppLastDate, until: pet.health.dhppValidUntil, vaccineType: "dhpp", history: pet.health.dhppHistory },
                    { label: t("shared.kennelCough"), date: pet.health.bordatellaDate, until: pet.health.bordatellaValidUntil, vaccineType: "bordetella", history: pet.health.bordatellaHistory },
                  ];
                  const treatmentItems: { type: "parkWorm" | "deworming" | "fleaTick"; label: string; date: string | null; until: string | null | undefined }[] = [
                    { type: "parkWorm", label: t("shared.parkWorm"), date: pet.health.parkWormDate, until: pet.health.parkWormValidUntil },
                    { type: "deworming", label: t("shared.deworming"), date: pet.health.dewormingLastDate, until: pet.health.dewormingValidUntil },
                    ...(pet.health.fleaTickDate ? [{ type: "fleaTick" as const, label: pet.health.fleaTickType || t("shared.fleaTick"), date: pet.health.fleaTickDate, until: pet.health.fleaTickExpiryDate }] : []),
                  ];
                  return [
                    ...renewableVaccines
                      .filter((v) => v.date)
                      .map((v) => {
                        const st = getStatus(v.until);
                        const historyItems = Array.isArray(v.history) ? v.history : [];
                        const historyKey = v.vaccineType;
                        return (
                          <div key={v.label} className={`rounded-lg text-sm ${statusStyle[st]}`}>
                            <div className="flex items-center justify-between p-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-petra-text font-medium">{v.label}</span>
                                {(st === "expired" || st === "expiring") && (
                                  <button
                                    onClick={() => setRenewingVaccine({ type: v.vaccineType, label: v.label })}
                                    className="text-xs px-2 py-0.5 bg-white border border-current rounded-full font-medium text-amber-600 hover:bg-amber-50 transition-colors"
                                  >
                                    {t("dogFile.renewVaccine")}
                                  </button>
                                )}
                              </div>
                              <div className="text-start">
                                <span className="text-petra-muted">{toDate(v.date)}</span>
                                {v.until && (
                                  <p className={`text-xs ${untilStyle[st]}`}>
                                    {st === "expired" ? t("dogFile.expiredPrefix") : st === "expiring" ? t("dogFile.validUntilPrefix") : t("dogFile.validPrefix")}{toDate(v.until)}
                                  </p>
                                )}
                              </div>
                            </div>
                            {historyItems.length > 0 && (
                              <div className="px-2.5 pb-2">
                                <button
                                  onClick={() => setExpandedVaccineHistory(expandedVaccineHistory === historyKey ? null : historyKey)}
                                  className="text-xs text-petra-muted hover:text-petra-text flex items-center gap-1 transition-colors"
                                >
                                  {expandedVaccineHistory === historyKey ? "▲" : "▼"} {t("dogFile.historyCount")}{historyItems.length})
                                </button>
                                {expandedVaccineHistory === historyKey && (
                                  <div className="mt-1.5 space-y-1 border-t pt-1.5">
                                    {[...historyItems].reverse().map((h, i) => (
                                      <div key={i} className="flex justify-between text-xs text-petra-muted bg-white/60 rounded px-2 py-1">
                                        <span>{t("dogFile.vaccinatedOn")} {toDate(h.date)}</span>
                                        {h.validUntil && <span>{t("dogFile.valid")} {toDate(h.validUntil)}</span>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }),
                    ...treatmentItems
                      .filter((v) => v.date)
                      .map((v) => {
                        const st = getStatus(v.until);
                        return (
                          <div key={v.label} className={`rounded-lg text-sm ${statusStyle[st]}`}>
                            <div className="flex items-center justify-between p-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-petra-text font-medium">{v.label}</span>
                                <button
                                  onClick={() => setRenewingTreatment({ type: v.type, label: v.label })}
                                  className="text-xs px-2 py-0.5 bg-white border border-slate-300 rounded-full font-medium text-petra-muted hover:bg-slate-50 transition-colors"
                                >
                                  {t("dogFile.renewTreatment")}
                                </button>
                              </div>
                              <div className="text-start">
                                <span className="text-petra-muted">{toDate(v.date)}</span>
                                {v.until && (
                                  <p className={`text-xs ${untilStyle[st]}`}>
                                    {st === "expired" ? t("dogFile.expiredPrefix") : st === "expiring" ? t("dogFile.validUntilPrefix") : t("dogFile.validPrefix")}{toDate(v.until)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }),
                  ];
                })()}
                {[pet.health.rabiesLastDate, pet.health.dhppLastDate, pet.health.bordatellaDate, pet.health.parkWormDate, pet.health.dewormingLastDate, pet.health.fleaTickDate].every((d) => !d) && (
                  <p className="text-sm text-petra-muted col-span-2">{t("dogFile.noVaccines")}</p>
                )}
              </div>
            </div>
            {/* Puppy vaccines */}
            {(pet.health.dhppPuppy1Date || pet.health.dhppPuppy2Date || pet.health.dhppPuppy3Date) && (
              <div>
                <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">{t("dogFile.dhppPuppy")}</p>
                <div className="flex gap-3 text-sm">
                  {pet.health.dhppPuppy1Date && <span className="bg-blue-50 px-2 py-1 rounded-lg">{t("dogFile.dose1")} {toDate(pet.health.dhppPuppy1Date)}</span>}
                  {pet.health.dhppPuppy2Date && <span className="bg-blue-50 px-2 py-1 rounded-lg">{t("dogFile.dose2")} {toDate(pet.health.dhppPuppy2Date)}</span>}
                  {pet.health.dhppPuppy3Date && <span className="bg-blue-50 px-2 py-1 rounded-lg">{t("dogFile.dose3")} {toDate(pet.health.dhppPuppy3Date)}</span>}
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            className="w-full text-sm text-emerald-400 hover:text-emerald-600 py-2 border border-dashed border-emerald-200 hover:border-emerald-300 rounded-xl transition-colors"
            onClick={() => setShowHealthModal(true)}
          >
            {t("dogFile.addHealth")}
          </button>
        )}
      </div>

      {/* Behavior */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            {t("dogFile.behavior")}
          </h3>
          <button
            className="btn-ghost flex items-center gap-1.5 text-sm"
            onClick={() => setShowBehaviorModal(true)}
          >
            <Pencil className="w-3.5 h-3.5" />
            {t("shared.editShort")}
          </button>
        </div>
        {behaviorFlags.length > 0 || customIssues.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {behaviorFlags.map(({ key, labelKey }) => (
                <span key={key} className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                  {t(labelKey)}
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
                <span className="text-petra-muted">{t("dogFile.biteDetails")} </span>
                <span>{pet.behavior.biteDetails}</span>
              </div>
            )}
            {pet.behavior?.triggers && (
              <div className="text-sm">
                <span className="text-petra-muted">{t("dogFile.triggers")} </span>
                <span>{pet.behavior.triggers}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-petra-muted">{t("dogFile.noBehaviorIssues")}</p>
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
          dog={dog}
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
          <div className="modal-content max-w-sm mx-4 p-6">
            <p className="font-medium mb-4">{t("dogFile.confirmDeleteMed")}</p>
            <div className="flex gap-3">
              <button
                className="btn-primary flex-1 bg-red-600 hover:bg-red-700"
                disabled={deleteMedMutation.isPending}
                onClick={() => deleteMedMutation.mutate(deletingMed)}
              >
                {deleteMedMutation.isPending ? tc("progress.deleting") : tc("actions.delete")}
              </button>
              <button className="btn-secondary" onClick={() => setDeletingMed(null)}>{tc("actions.cancel")}</button>
            </div>
          </div>
        </div>
      )}
      {renewingVaccine && (
        <VaccineRenewalModal
          petId={pet.id}
          dogId={dogId}
          vaccineType={renewingVaccine.type}
          vaccineLabel={renewingVaccine.label}
          onClose={() => setRenewingVaccine(null)}
        />
      )}
      {renewingTreatment && (
        <TreatmentRenewalModal
          petId={pet.id}
          dogId={dogId}
          treatmentType={renewingTreatment.type}
          treatmentLabel={renewingTreatment.label}
          onClose={() => setRenewingTreatment(null)}
          onSaved={invalidate}
        />
      )}
    </div>
  );
}

// ─── Edit Pet Details Modal ───

function EditPetModal({
  pet,
  petId,
  dogId,
  certificationDate: initialCertDate,
  initialNotes,
  initialIntakeDate,
  onClose,
  onSaved,
}: {
  pet: ServiceDogDetail["pet"];
  petId: string;
  dogId: string;
  certificationDate: string | null;
  initialNotes: string | null;
  initialIntakeDate: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const [name, setName] = useState(pet.name);
  const [breed, setBreed] = useState(pet.breed ?? "");
  const [gender, setGender] = useState(pet.gender ?? "");
  const [birthDate, setBirthDate] = useState(
    pet.birthDate ? new Date(pet.birthDate).toISOString().slice(0, 10) : ""
  );
  const [color, setColor] = useState(pet.color ?? "");
  const [microchip, setMicrochip] = useState(pet.microchip ?? "");
  const [neuteredSpayed, setNeuteredSpayed] = useState(pet.health?.neuteredSpayed ?? false);
  const [neuteredSpayedDate, setNeuteredSpayedDate] = useState(
    pet.health?.neuteredSpayedDate ? new Date(pet.health.neuteredSpayedDate).toISOString().slice(0, 10) : ""
  );
  const [certificationDate, setCertificationDate] = useState(
    initialCertDate ? new Date(initialCertDate).toISOString().slice(0, 10) : ""
  );
  const [intakeDate, setIntakeDate] = useState(
    initialIntakeDate ? new Date(initialIntakeDate).toISOString().slice(0, 10) : ""
  );
  const [notes, setNotes] = useState(initialNotes ?? "");

  const saveMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/api/pets/${petId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          breed: breed.trim() || null,
          gender: gender || null,
          birthDate: birthDate || null,
          color: color.trim() || null,
          microchip: microchip.trim() || null,
          neuteredSpayed,
          neuteredSpayedDate: neuteredSpayed ? (neuteredSpayedDate || null) : null,
        }),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); });
      await fetch(`/api/service-dogs/${dogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificationDate: certificationDate || null, intakeDate: intakeDate || null, notes: notes.trim() || null }),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); });
    },
    onSuccess: () => {
      onSaved();
      onClose();
      toast.success(t("editPet.toastUpdated"));
    },
    onError: () => toast.error(t("editPet.errorUpdate")),
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Dog className="w-5 h-5 text-brand-500" />
            {t("editPet.title")}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label text-xs">{t("editPet.nameRequired")}</label>
            <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">{t("shared.breed")}</label>
            <input className="input w-full" value={breed} onChange={(e) => setBreed(e.target.value)} placeholder={t("editPet.breedPlaceholder")} />
          </div>
          <div>
            <label className="label text-xs">{t("shared.sex")}</label>
            <select className="input w-full" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">{t("editPet.notSet")}</option>
              <option value="male">{t("shared.male")}</option>
              <option value="female">{t("shared.female")}</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">{t("shared.birthDate")}</label>
            <input type="date" lang={cfg.lang} className="input w-full" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">{t("editPet.dogColor")}</label>
            <input className="input w-full" value={color} onChange={(e) => setColor(e.target.value)} placeholder={t("editPet.colorPlaceholder")} />
          </div>
          <div>
            <label className="label text-xs">{t("shared.microchip")}</label>
            <input className="input w-full font-mono" value={microchip} onChange={(e) => setMicrochip(e.target.value)} placeholder={t("editPet.microchipPlaceholder")} />
          </div>
          <div>
            <label className="label text-xs">{t("shared.certificationDate")}</label>
            <input type="date" lang={cfg.lang} className="input w-full" value={certificationDate} onChange={(e) => setCertificationDate(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">{t("shared.intakeDate")}</label>
            <input type="date" lang={cfg.lang} className="input w-full" value={intakeDate} onChange={(e) => setIntakeDate(e.target.value)} />
          </div>
          <div className="col-span-2 flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="neutered-edit"
              checked={neuteredSpayed}
              onChange={(e) => setNeuteredSpayed(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            <label htmlFor="neutered-edit" className="text-sm cursor-pointer">{t("shared.neutered")}</label>
          </div>
          {neuteredSpayed && (
            <div className="col-span-2">
              <label className="label">{t("shared.neuterDate")}</label>
              <input type="date" lang={cfg.lang} className="input w-full" value={neuteredSpayedDate} onChange={(e) => setNeuteredSpayedDate(e.target.value)} />
            </div>
          )}
          <div className="col-span-2">
            <label className="label text-xs">{t("shared.notes")}</label>
            <textarea
              className="input w-full"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("editPet.notesPlaceholder")}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            className="btn-primary flex-1"
            onClick={() => saveMutation.mutate()}
            disabled={!name.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending ? tc("progress.saving") : t("shared.saveChanges")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Month + year (licence validity) ───

// MONTH_KEYS is declared once, with the vaccinations tab further down.

/** "יולי 2027" — read in UTC: the value is stored as the 1st of the month at 00:00Z. */
function formatMonthYear(t: DetailT, iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${t(`months.${MONTH_KEYS[d.getUTCMonth()]}`)} ${d.getUTCFullYear()}`;
}

/**
 * Month + year selector producing "YYYY-MM" (or "" when cleared). Two selects
 * rather than <input type="month">, which Safari renders as plain text.
 */
function MonthYearPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const [y, m] = value ? value.split("-") : ["", ""];
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 14 }, (_, i) => thisYear - 3 + i);
  const emit = (ny: string, nm: string) => onChange(ny && nm ? `${ny}-${nm}` : "");
  return (
    <div className="flex gap-2">
      <select className="input flex-1 text-sm" value={m} onChange={(e) => emit(y || String(thisYear), e.target.value)} aria-label={t("shared.month")}>
        <option value="">{t("shared.month")}</option>
        {MONTH_KEYS.map((mk) => t(`months.${mk}`)).map((name, i) => (
          <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>
        ))}
      </select>
      <select className="input w-24 text-sm" value={y} onChange={(e) => emit(e.target.value, m || "01")} aria-label={t("shared.year")}>
        <option value="">{t("shared.year")}</option>
        {years.map((yr) => <option key={yr} value={String(yr)}>{yr}</option>)}
      </select>
      {value && (
        <button type="button" className="btn-ghost px-2 text-xs text-petra-muted" onClick={() => onChange("")} title={t("extraInfo.clear")}>
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── SD Extra Info Section (acquisition / license / logistics) ───

function SDExtraInfoSection({ dog, dogId }: { dog: ServiceDogDetail; dogId: string }) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const { locale, currency } = useBusinessLocale();
  const cur = currencySymbol({ locale, currency });
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    pedigreeNumber: dog.pedigreeNumber ?? "",
    purchasePrice: dog.purchasePrice != null ? String(dog.purchasePrice) : "",
    purchaseSource: dog.purchaseSource ?? "",
    licenseNumber: dog.licenseNumber ?? "",
    licenseExpiry: dog.licenseExpiry ? dog.licenseExpiry.slice(0, 7) : "", // "YYYY-MM"
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
      toast.success(t("extraInfo.toastUpdated"));
    },
    onError: () => toast.error(t("shared.errorSave")),
  });

  const hasData = dog.pedigreeNumber || dog.purchasePrice || dog.purchaseSource || dog.licenseNumber || dog.maintenanceNotes;

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-petra-muted flex items-center gap-1.5">
          <Building className="w-3.5 h-3.5" />
          {t("extraInfo.title")}
        </h4>
        <button className="btn-ghost text-xs flex items-center gap-1" onClick={() => setEditing(!editing)}>
          <Pencil className="w-3 h-3" />
          {editing ? tc("actions.close") : t("shared.editShort")}
        </button>
      </div>
      {editing ? (
        <div className="space-y-3 bg-slate-50 rounded-xl p-4 border">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">{t("extraInfo.pedigree")}</label>
              <input className="input w-full text-sm" value={form.pedigreeNumber} onChange={(e) => setForm((p) => ({ ...p, pedigreeNumber: e.target.value }))} placeholder={t("extraInfo.pedigreePlaceholder")} />
            </div>
            <div>
              <label className="label text-xs">{t("extraInfo.purchasePriceCurrency", { currency: cur })}</label>
              <input type="number" className="input w-full text-sm" value={form.purchasePrice} onChange={(e) => setForm((p) => ({ ...p, purchasePrice: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="label text-xs">{t("extraInfo.purchaseSource")}</label>
              <input className="input w-full text-sm" value={form.purchaseSource} onChange={(e) => setForm((p) => ({ ...p, purchaseSource: e.target.value }))} placeholder={t("extraInfo.purchaseSourcePlaceholder")} />
            </div>
            <div>
              <label className="label text-xs">{t("extraInfo.cityLicense")}</label>
              <input className="input w-full text-sm" value={form.licenseNumber} onChange={(e) => setForm((p) => ({ ...p, licenseNumber: e.target.value }))} placeholder={t("extraInfo.licenseNumberPlaceholder")} />
            </div>
            <div>
              <label className="label text-xs">{t("extraInfo.licenseExpiry")}</label>
              <MonthYearPicker value={form.licenseExpiry} onChange={(v) => setForm((p) => ({ ...p, licenseExpiry: v }))} />
            </div>
            <div>
              <label className="label text-xs">{t("extraInfo.yardGroup")}</label>
              <input className="input w-full text-sm" value={form.yardGroup} onChange={(e) => setForm((p) => ({ ...p, yardGroup: e.target.value }))} placeholder={t("extraInfo.yardGroupPlaceholder")} />
            </div>
          </div>
          <div>
            <label className="label text-xs">{t("extraInfo.specialFeeding")}</label>
            <textarea className="input w-full text-sm" rows={2} value={form.feedingInstructions} onChange={(e) => setForm((p) => ({ ...p, feedingInstructions: e.target.value }))} placeholder={t("extraInfo.specialFeedingPlaceholder")} />
          </div>
          <div>
            <label className="label text-xs">{t("extraInfo.careNotes")}</label>
            <textarea className="input w-full text-sm" rows={2} value={form.maintenanceNotes} onChange={(e) => setForm((p) => ({ ...p, maintenanceNotes: e.target.value }))} placeholder={t("extraInfo.careNotesPlaceholder")} />
          </div>
          <div className="flex gap-2 pt-1">
            <button className="btn-primary text-sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? tc("progress.saving") : tc("actions.save")}
            </button>
            <button className="btn-secondary text-sm" onClick={() => setEditing(false)}>{tc("actions.cancel")}</button>
          </div>
        </div>
      ) : hasData ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {dog.pedigreeNumber && <div><p className="text-xs text-petra-muted">{t("extraInfo.pedigree")}</p><p className="font-medium font-mono text-xs">{dog.pedigreeNumber}</p></div>}
          {dog.purchasePrice && <div><p className="text-xs text-petra-muted">{t("extraInfo.purchasePrice")}</p><p className="font-medium">{dog.purchasePrice.toLocaleString(locale)} {cur}</p></div>}
          {dog.purchaseSource && <div><p className="text-xs text-petra-muted">{t("extraInfo.purchaseSource")}</p><p className="font-medium">{dog.purchaseSource}</p></div>}
          {dog.licenseNumber && <div><p className="text-xs text-petra-muted">{t("extraInfo.cityLicense")}</p><p className="font-medium">{dog.licenseNumber}</p></div>}
          {dog.licenseExpiry && <div><p className="text-xs text-petra-muted">{t("extraInfo.licenseExpiry")}</p><p className="font-medium">{formatMonthYear(t, dog.licenseExpiry)}</p></div>}
          {dog.yardGroup && <div><p className="text-xs text-petra-muted">{t("extraInfo.yardGroup")}</p><p className="font-medium">{dog.yardGroup}</p></div>}
          {dog.feedingInstructions && <div className="col-span-2"><p className="text-xs text-petra-muted">{t("extraInfo.feedingInstructions")}</p><p className="font-medium text-xs">{dog.feedingInstructions}</p></div>}
          {dog.maintenanceNotes && <div className="col-span-2"><p className="text-xs text-petra-muted">{t("extraInfo.careNotes")}</p><p className="text-xs text-petra-muted">{dog.maintenanceNotes}</p></div>}
        </div>
      ) : (
        <button
          className="w-full text-sm text-petra-muted hover:text-foreground py-2 border border-dashed border-slate-200 hover:border-slate-300 rounded-xl transition-colors"
          onClick={() => setEditing(true)}
        >
          {t("extraInfo.addDetails")}
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

interface ClaimDocument {
  name: string;
  type: "invoice" | "visit_summary" | "other";
  data: string; // base64
  uploadedAt: string;
}

interface NoteEntry {
  text: string;
  createdAt: string;
}

interface ClaimRecord {
  id: string;
  incidentDate: string;
  description: string | null;
  amount: number | null;
  deductiblePaid: number | null;
  reimbursedAmount: number | null;
  vetName: string | null;
  claimNumber: string | null;
  invoiceAttached: boolean;
  visitSummaryAttached: boolean;
  documents: ClaimDocument[] | null;
  submittedAt: string | null;
  resolvedAt: string | null;
  followUpAt: string | null;
  status: string;
  notes: string | null;
}

// Notes stored as JSON array [{text, createdAt}]; falls back to plain text for legacy records
function parseNoteLog(raw: string | null): NoteEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as NoteEntry[];
    return [{ text: raw, createdAt: new Date(0).toISOString() }];
  } catch {
    return [{ text: raw, createdAt: new Date(0).toISOString() }];
  }
}
function stringifyNoteLog(entries: NoteEntry[]): string {
  return JSON.stringify(entries);
}

// ─── Claim Card (expanded tracking panel) ───
function ClaimCard({
  claim,
  insuranceId,
  providerName,
  dogId,
  onUpdated,
}: {
  claim: ClaimRecord;
  insuranceId: string;
  providerName: string;
  dogId: string;
  onUpdated: () => void;
}) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const { locale, cfg, currency } = useBusinessLocale();
  const cur = currencySymbol({ locale, currency });
  const formatDate = useFormatDay();
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [showAddNote, setShowAddNote] = useState(false);
  const [editForm, setEditForm] = useState({
    incidentDate: claim.incidentDate?.split("T")[0] ?? "",
    claimNumber: claim.claimNumber ?? "",
    vetName: claim.vetName ?? "",
    amount: claim.amount?.toString() ?? "",
    deductiblePaid: claim.deductiblePaid?.toString() ?? "",
    reimbursedAmount: claim.reimbursedAmount?.toString() ?? "",
    submittedAt: claim.submittedAt?.split("T")[0] ?? "",
    followUpAt: claim.followUpAt?.split("T")[0] ?? "",
    description: claim.description ?? "",
  });

  const sc = CLAIM_STATUS_MAP[claim.status] ?? { label: claim.status, color: "bg-slate-100 text-slate-600" };
  const noteLog = parseNoteLog(claim.notes);
  const isOpen = (CLAIM_OPEN_STATUSES as readonly string[]).includes(claim.status);
  const today = new Date().toISOString().split("T")[0];
  const followUpOverdue = claim.followUpAt && claim.followUpAt.split("T")[0] < today;

  const patchClaim = async (patch: Record<string, unknown>) => {
    const r = await fetch(`/api/service-dogs/${dogId}/insurance/${insuranceId}/claims/${claim.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || t("insurance.errorClaimUpdateThe"));
    }
    onUpdated();
  };

  const handleStatusChange = (status: string) => {
    const isClosed = ["PAID", "DENIED", "WITHDRAWN"].includes(status);
    patchClaim({
      status,
      resolvedAt: isClosed ? new Date().toISOString() : null,
      submittedAt: status === "SUBMITTED" && !claim.submittedAt ? new Date().toISOString() : undefined,
    }).then(() => toast.success(t("shared.toastStatusUpdated"))).catch(() => toast.error(t("insurance.errorStatusUpdate")));
  };

  const handleSaveEdit = () => {
    patchClaim({
      incidentDate: editForm.incidentDate || undefined,
      claimNumber: editForm.claimNumber || null,
      vetName: editForm.vetName || null,
      amount: editForm.amount ? parseFloat(editForm.amount) : null,
      deductiblePaid: editForm.deductiblePaid ? parseFloat(editForm.deductiblePaid) : null,
      reimbursedAmount: editForm.reimbursedAmount ? parseFloat(editForm.reimbursedAmount) : null,
      submittedAt: editForm.submittedAt || null,
      followUpAt: editForm.followUpAt || null,
      description: editForm.description || null,
    }).then(() => { toast.success(t("insurance.toastClaimUpdated")); setEditMode(false); }).catch(() => toast.error(t("insurance.errorClaimUpdate")));
  };

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;
    const updated: NoteEntry[] = [...noteLog, { text: newNoteText.trim(), createdAt: new Date().toISOString() }];
    patchClaim({ notes: stringifyNoteLog(updated) }).then(() => {
      toast.success(t("insurance.toastNoteAdded"));
      setNewNoteText("");
      setShowAddNote(false);
    }).catch(() => toast.error(t("insurance.errorNoteAdd")));
  };

  const handleDeleteNote = (idx: number) => {
    const updated = noteLog.filter((_, i) => i !== idx);
    patchClaim({ notes: stringifyNoteLog(updated) }).then(() => toast.success(t("insurance.toastNoteDeleted"))).catch(() => toast.error(t("insurance.errorNoteDelete")));
  };

  const handleUploadDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error(t("shared.fileTooLarge5")); return; }
    const name = file.name.toLowerCase();
    const docType: ClaimDocument["type"] =
      name.includes("חשבונית" /* i18n-ok */) || name.includes("invoice") ? "invoice"
      : name.includes("סיכום" /* i18n-ok */) || name.includes("summary") ? "visit_summary"
      : "other";
    const reader = new FileReader();
    reader.onload = () => {
      const existingDocs: ClaimDocument[] = Array.isArray(claim.documents) ? claim.documents : [];
      patchClaim({
        documents: [...existingDocs, { name: file.name, type: docType, data: reader.result as string, uploadedAt: new Date().toISOString() }],
        invoiceAttached: docType === "invoice" ? true : claim.invoiceAttached,
        visitSummaryAttached: docType === "visit_summary" ? true : claim.visitSummaryAttached,
      }).then(() => toast.success(t("insurance.toastDocUploaded"))).catch(() => toast.error(t("insurance.errorDocUpload")));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleDeleteDoc = (docIdx: number) => {
    const existingDocs: ClaimDocument[] = Array.isArray(claim.documents) ? claim.documents : [];
    const updated = existingDocs.filter((_, i) => i !== docIdx);
    patchClaim({
      documents: updated,
      invoiceAttached: updated.some((d) => d.type === "invoice"),
      visitSummaryAttached: updated.some((d) => d.type === "visit_summary"),
    }).then(() => toast.success(t("shared.toastDocDeleted"))).catch(() => toast.error(t("shared.errorDocDelete")));
  };

  // Status pipeline: which next statuses are valid from current
  const STATUS_TRANSITIONS: Record<string, string[]> = {
    PENDING:   ["SUBMITTED", "DENIED", "WITHDRAWN"],
    SUBMITTED: ["IN_REVIEW", "PAID", "DENIED", "WITHDRAWN"],
    IN_REVIEW: ["PAID", "DENIED", "WITHDRAWN"],
    PAID: [], DENIED: [], WITHDRAWN: [],
  };
  const nextStatuses = STATUS_TRANSITIONS[claim.status] ?? [];

  return (
    <div className={cn("bg-white rounded-xl border overflow-hidden transition-shadow", expanded && "shadow-md ring-1 ring-blue-100")}>
      {/* Header row */}
      <div
        className="p-3.5 flex items-start gap-3 cursor-pointer hover:bg-slate-50/60 select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold shrink-0", sc.color)}>{sc.label}</span>
            {claim.claimNumber && <span className="text-xs font-mono font-medium text-petra-text">#{claim.claimNumber}</span>}
            <span className="text-xs text-petra-muted">{providerName}</span>
          </div>
          <p className="text-sm font-medium truncate">{claim.description || t("insurance.noDescription")}</p>
          <div className="flex gap-3 text-xs text-petra-muted mt-0.5 flex-wrap">
            <span>{t("insurance.incident")} {formatDate(claim.incidentDate)}</span>
            {claim.vetName && <span>{t("insurance.vetColon")} {claim.vetName}</span>}
            {claim.amount && <span>{cur}{claim.amount.toLocaleString(locale)}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {claim.followUpAt && (
            <span className={cn("text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1", followUpOverdue ? "bg-red-100 text-red-600 font-semibold" : "bg-blue-50 text-blue-600")}>
              <Clock3 className="w-3 h-3" />
              {formatDate(claim.followUpAt)}
            </span>
          )}
          {(claim.documents?.length ?? 0) > 0 && (
            <span className="text-xs text-petra-muted flex items-center gap-0.5">
              <Paperclip className="w-3 h-3" />{claim.documents!.length}
            </span>
          )}
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 mt-1" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 mt-1" />}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t bg-slate-50/40 divide-y divide-slate-100">

          {/* Status pipeline */}
          {isOpen && nextStatuses.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-petra-muted mb-2">{t("insurance.statusUpdate")}</p>
              <div className="flex gap-2 flex-wrap">
                {nextStatuses.map((s) => {
                  const st = CLAIM_STATUS_MAP[s] ?? { label: s, color: "bg-slate-100 text-slate-600" };
                  const isFinal = ["PAID","DENIED","WITHDRAWN"].includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors",
                        isFinal && s === "PAID" ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        : isFinal ? "border-red-200 text-red-600 hover:bg-red-50"
                        : "border-blue-200 text-blue-700 hover:bg-blue-50"
                      )}
                    >
                      → {st.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Details / edit */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-petra-muted">{t("insurance.claimDetails")}</p>
              {!editMode && (
                <button onClick={() => setEditMode(true)} className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> {tc("actions.edit")}
                </button>
              )}
            </div>
            {editMode ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label text-xs">{t("insurance.incidentDate")}</label><input type="date" lang={cfg.lang} className="input w-full text-xs" value={editForm.incidentDate} onChange={(e) => setEditForm((p) => ({ ...p, incidentDate: e.target.value }))} /></div>
                  <div><label className="label text-xs">{t("insurance.claimNumber")}</label><input className="input w-full text-xs" value={editForm.claimNumber} onChange={(e) => setEditForm((p) => ({ ...p, claimNumber: e.target.value }))} /></div>
                  <div><label className="label text-xs">{t("shared.vet")}</label><input className="input w-full text-xs" value={editForm.vetName} onChange={(e) => setEditForm((p) => ({ ...p, vetName: e.target.value }))} /></div>
                  <div><label className="label text-xs">{t("insurance.claimAmountCurrency", { currency: cur })}</label><input type="number" className="input w-full text-xs" value={editForm.amount} onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))} /></div>
                  <div><label className="label text-xs">{t("insurance.deductibleCurrency", { currency: cur })}</label><input type="number" className="input w-full text-xs" value={editForm.deductiblePaid} onChange={(e) => setEditForm((p) => ({ ...p, deductiblePaid: e.target.value }))} /></div>
                  <div><label className="label text-xs">{t("insurance.reimbursedCurrency", { currency: cur })}</label><input type="number" className="input w-full text-xs" value={editForm.reimbursedAmount} onChange={(e) => setEditForm((p) => ({ ...p, reimbursedAmount: e.target.value }))} /></div>
                  <div><label className="label text-xs">{t("insurance.submittedDate")}</label><input type="date" lang={cfg.lang} className="input w-full text-xs" value={editForm.submittedAt} onChange={(e) => setEditForm((p) => ({ ...p, submittedAt: e.target.value }))} /></div>
                  <div><label className="label text-xs">{t("insurance.followUpDate")}</label><input type="date" lang={cfg.lang} className="input w-full text-xs" value={editForm.followUpAt} onChange={(e) => setEditForm((p) => ({ ...p, followUpAt: e.target.value }))} /></div>
                </div>
                <div><label className="label text-xs">{t("insurance.incidentDescription")}</label><textarea className="input w-full text-xs" rows={2} value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} /></div>
                <div className="flex gap-2">
                  <button className="btn-primary text-xs" onClick={handleSaveEdit}>{t("shared.saveChanges")}</button>
                  <button className="btn-ghost text-xs" onClick={() => setEditMode(false)}>{tc("actions.cancel")}</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                {claim.incidentDate && <div><span className="text-petra-muted">{t("insurance.incidentDateColon")} </span>{formatDate(claim.incidentDate)}</div>}
                {claim.vetName && <div><span className="text-petra-muted">{t("insurance.vetColon")} </span>{claim.vetName}</div>}
                {claim.claimNumber && <div><span className="text-petra-muted">{t("insurance.numberColon")} </span>#{claim.claimNumber}</div>}
                {claim.amount && <div><span className="text-petra-muted">{t("insurance.claimColon")} </span>{cur}{claim.amount.toLocaleString(locale)}</div>}
                {claim.deductiblePaid && <div><span className="text-petra-muted">{t("insurance.deductibleShort")} </span>{cur}{claim.deductiblePaid.toLocaleString(locale)}</div>}
                {claim.reimbursedAmount && <div className="text-emerald-600 font-semibold"><span className="font-normal text-petra-muted">{t("insurance.reimbursedColon")} </span>{cur}{claim.reimbursedAmount.toLocaleString(locale)}</div>}
                {claim.submittedAt && <div><span className="text-petra-muted">{t("insurance.submittedColon")} </span>{formatDate(claim.submittedAt)}</div>}
                {claim.resolvedAt && <div><span className="text-petra-muted">{t("insurance.closedColon")} </span>{formatDate(claim.resolvedAt)}</div>}
                {claim.followUpAt && (
                  <div className={cn("col-span-2 font-medium", followUpOverdue ? "text-red-600" : "text-blue-600")}>
                    {t("insurance.followUpColon")} {formatDate(claim.followUpAt)}{followUpOverdue ? t("insurance.overdueSuffix") : ""}
                  </div>
                )}
                {claim.description && <div className="col-span-full text-petra-muted mt-0.5">{claim.description}</div>}
              </div>
            )}
          </div>

          {/* Notes / activity log */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-petra-muted">{t("insurance.updatesLog")}</p>
              {!showAddNote && (
                <button onClick={() => setShowAddNote(true)} className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> {t("shared.addUpdate")}
                </button>
              )}
            </div>
            {showAddNote && (
              <div className="mb-3 flex gap-2 items-start">
                <textarea
                  className="input flex-1 text-xs resize-none"
                  rows={2}
                  placeholder={t("insurance.notePlaceholder")}
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  autoFocus
                />
                <div className="flex flex-col gap-1 shrink-0">
                  <button className="btn-primary text-xs px-2 py-1" onClick={handleAddNote} disabled={!newNoteText.trim()}>{tc("actions.add")}</button>
                  <button className="btn-ghost text-xs px-2 py-1" onClick={() => { setShowAddNote(false); setNewNoteText(""); }}>{tc("actions.cancel")}</button>
                </div>
              </div>
            )}
            {noteLog.length === 0 ? (
              <p className="text-xs text-petra-muted">{t("insurance.noUpdates")}</p>
            ) : (
              <div className="space-y-2">
                {[...noteLog].reverse().map((entry, ri) => {
                  const idx = noteLog.length - 1 - ri;
                  const entryDate = entry.createdAt && new Date(entry.createdAt).getFullYear() > 2000
                    ? new Date(entry.createdAt).toLocaleString(locale, { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })
                    : "";
                  return (
                    <div key={idx} className="flex items-start gap-2 group">
                      <div className="flex-1 bg-white rounded-lg border px-3 py-2">
                        {entryDate && <p className="text-[10px] text-petra-muted mb-0.5">{entryDate}</p>}
                        <p className="text-xs text-petra-text whitespace-pre-wrap">{entry.text}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteNote(idx)}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-400 mt-1 shrink-0"
                        title={t("insurance.deleteUpdate")}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Documents */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-petra-muted">
                {t("shared.documents")} {(claim.documents?.length ?? 0) > 0 && `(${claim.documents!.length})`}
              </p>
              <label className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1 cursor-pointer">
                <Upload className="w-3 h-3" /> {t("insurance.addDocument")}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleUploadDoc} />
              </label>
            </div>
            {(claim.documents?.length ?? 0) === 0 ? (
              <p className="text-xs text-petra-muted">{t("insurance.noDocuments")}</p>
            ) : (
              <div className="space-y-1.5">
                {(claim.documents as ClaimDocument[]).map((doc, di) => (
                  <div key={di} className="flex items-center gap-2 group bg-white rounded-lg border px-3 py-2">
                    <FileTextIcon className="w-4 h-4 text-blue-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{doc.name}</p>
                      <p className="text-[10px] text-petra-muted">
                        {doc.type === "invoice" ? t("shared.invoice") : doc.type === "visit_summary" ? t("shared.visitSummary") : t("insurance.docGeneric")}
                        {doc.uploadedAt ? ` · ${new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(doc.uploadedAt))}` : ""}
                      </p>
                    </div>
                    <a href={doc.data} download={doc.name} className="text-xs text-brand-500 hover:text-brand-700 shrink-0" title={t("insurance.download")}>
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => handleDeleteDoc(di)}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-400 shrink-0"
                      title={t("insurance.deleteDocument")}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InsuranceTab({ dogId }: { dogId: string }) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const { locale, currency } = useBusinessLocale();
  const cur = currencySymbol({ locale, currency });
  const formatDate = useFormatDay();
  const queryClient = useQueryClient();
  const [showAddInsurance, setShowAddInsurance] = useState(false);
  const [expandedInsId, setExpandedInsId] = useState<string | null>(null);
  const [showAddClaim, setShowAddClaim] = useState<string | null>(null);
  const [claimStatusFilter, setClaimStatusFilter] = useState<"open" | "closed">("open");
  const [editingInsurance, setEditingInsurance] = useState<InsuranceRecord | null>(null);

  const { data: insurances = [], isLoading } = useQuery<InsuranceRecord[]>({
    queryKey: ["sd-insurance", dogId],
    queryFn: () => fetch(`/api/service-dogs/${dogId}/insurance`).then((r) => r.json()),
  });

  const refreshIns = () => queryClient.invalidateQueries({ queryKey: ["sd-insurance", dogId] });

  const addInsMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch(`/api/service-dogs/${dogId}/insurance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      refreshIns();
      setShowAddInsurance(false);
      toast.success(t("insurance.toastPolicyAdded"));
    },
    onError: () => toast.error(t("insurance.errorPolicyAdd")),
  });

  const updateInsMutation = useMutation({
    mutationFn: ({ insuranceId, data }: { insuranceId: string; data: Record<string, unknown> }) =>
      fetch(`/api/service-dogs/${dogId}/insurance/${insuranceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => { refreshIns(); setEditingInsurance(null); toast.success(t("insurance.toastPolicyUpdated")); },
    onError: () => toast.error(t("insurance.errorPolicyUpdate")),
  });

  const deleteInsMutation = useMutation({
    mutationFn: (insuranceId: string) =>
      fetch(`/api/service-dogs/${dogId}/insurance/${insuranceId}`, { method: "DELETE" })
        .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => { refreshIns(); toast.success(t("insurance.toastPolicyDeleted")); },
    onError: () => toast.error(t("insurance.errorPolicyDelete")),
  });

  const addClaimMutation = useMutation({
    mutationFn: ({ insuranceId, data }: { insuranceId: string; data: Record<string, unknown> }) =>
      fetch(`/api/service-dogs/${dogId}/insurance/${insuranceId}/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      refreshIns();
      setShowAddClaim(null);
      toast.success(t("insurance.toastClaimAdded"));
    },
    onError: () => toast.error(t("insurance.errorClaimAdd")),
  });

  if (isLoading) return <PetraLoader />;

  // Flatten all claims with insurance context
  const allClaims = insurances.flatMap((ins) =>
    ins.claims.map((c) => ({ ...c, insuranceId: ins.id, providerName: ins.provider || t("shared.insurance") }))
  );
  const openClaims = allClaims
    .filter((c) => (CLAIM_OPEN_STATUSES as readonly string[]).includes(c.status))
    .sort((a, b) => {
      // Sort: overdue followUp first, then by incidentDate desc
      const today = new Date().toISOString().split("T")[0];
      const aOverdue = a.followUpAt && a.followUpAt.split("T")[0] < today;
      const bOverdue = b.followUpAt && b.followUpAt.split("T")[0] < today;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      return new Date(b.incidentDate).getTime() - new Date(a.incidentDate).getTime();
    });
  const closedClaims = allClaims.filter((c) => !(CLAIM_OPEN_STATUSES as readonly string[]).includes(c.status))
    .sort((a, b) => new Date(b.incidentDate).getTime() - new Date(a.incidentDate).getTime());

  const displayedClaims = claimStatusFilter === "open" ? openClaims : closedClaims;

  return (
    <div className="space-y-5">
      {/* ── Active claims tracking panel ── */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-slate-100">
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <FileTextIcon className="w-4 h-4 text-blue-500" />
            {t("insurance.claimsTracking")}
            {openClaims.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {openClaims.length} {t("insurance.openCount")}
              </span>
            )}
          </h3>
          {/* Status filter */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setClaimStatusFilter("open")}
              className={cn("px-3 py-1 rounded-md font-medium transition-colors", claimStatusFilter === "open" ? "bg-white shadow-sm text-petra-text" : "text-petra-muted hover:text-petra-text")}
            >
              {t("shared.activePlural")} {openClaims.length > 0 && `(${openClaims.length})`}
            </button>
            <button
              onClick={() => setClaimStatusFilter("closed")}
              className={cn("px-3 py-1 rounded-md font-medium transition-colors", claimStatusFilter === "closed" ? "bg-white shadow-sm text-petra-text" : "text-petra-muted hover:text-petra-text")}
            >
              {t("insurance.closedFilter")} {closedClaims.length > 0 && `(${closedClaims.length})`}
            </button>
          </div>
        </div>

        <div className="p-3 space-y-2">
          {displayedClaims.length === 0 ? (
            <div className="py-8 text-center">
              <FileTextIcon className="w-8 h-8 mx-auto text-slate-200 mb-2" />
              <p className="text-sm text-petra-muted">
                {claimStatusFilter === "open" ? t("insurance.noActiveClaims") : t("insurance.noClosedClaims")}
              </p>
            </div>
          ) : (
            displayedClaims.map((c) => (
              <ClaimCard
                key={c.id}
                claim={c}
                insuranceId={c.insuranceId}
                providerName={c.providerName}
                dogId={dogId}
                onUpdated={refreshIns}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Insurance policies ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <ShieldCheck className="w-4 h-4 text-blue-500" />
            {t("insurance.policies")}
          </h3>
          <button className="btn-primary text-sm flex items-center gap-1.5" onClick={() => setShowAddInsurance(!showAddInsurance)}>
            <Plus className="w-4 h-4" />
            {t("insurance.addPolicy")}
          </button>
        </div>

        {showAddInsurance && (
          <AddInsuranceForm
            dogId={dogId}
            onSave={(data) => addInsMutation.mutate(data)}
            onCancel={() => setShowAddInsurance(false)}
            isSaving={addInsMutation.isPending}
          />
        )}

        {insurances.length === 0 && !showAddInsurance && (
          <div className="card p-8 text-center">
            <ShieldCheck className="w-10 h-10 mx-auto text-petra-muted/30 mb-2" />
            <p className="text-petra-muted text-sm">{t("insurance.noPolicies")}</p>
          </div>
        )}

        {insurances.map((ins) => {
          const isExpanded = expandedInsId === ins.id;
          const openCount = ins.claims.filter((c) => (CLAIM_OPEN_STATUSES as readonly string[]).includes(c.status)).length;
          const totalClaimed = ins.claims.reduce((s, c) => s + (c.amount ?? 0), 0);

          return (
            <div key={ins.id} className={cn("card p-0 overflow-hidden", !ins.isActive && "opacity-70")}>
              <div
                className="p-4 flex items-start justify-between gap-3 cursor-pointer hover:bg-slate-50/40"
                onClick={() => setExpandedInsId(isExpanded ? null : ins.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{ins.provider || t("insurance.unknownInsurer")}</p>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", ins.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                      {ins.isActive ? t("shared.active") : t("insurance.inactive")}
                    </span>
                    {openCount > 0 && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{openCount} {t("insurance.openClaims")}</span>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs text-petra-muted mt-1 flex-wrap">
                    {ins.policyNumber && <span>{t("insurance.policyColon")} {ins.policyNumber}</span>}
                    {ins.premium && <span>{t("insurance.premium", { currency: cur })}{ins.premium.toLocaleString(locale)}</span>}
                    {ins.renewalDate && <span>{t("shared.renewalColon")} {formatDate(ins.renewalDate)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ins.claims.length > 0 && (
                    <div className="text-end">
                      <p className="text-xs text-petra-muted">{ins.claims.length} {t("insurance.claimsCount")}</p>
                      <p className="text-xs font-medium">{cur}{totalClaimed.toLocaleString(locale)}</p>
                    </div>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t px-4 pb-4 pt-3 bg-slate-50/30 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                    {ins.coverageType && <div><p className="text-xs text-petra-muted">{t("insurance.coverageType")}</p><p className="font-medium">{INSURANCE_COVERAGE_TYPES.find((c) => c.id === ins.coverageType)?.label || ins.coverageType}</p></div>}
                    {ins.deductible && <div><p className="text-xs text-petra-muted">{t("insurance.deductible")}</p><p className="font-medium">{cur}{ins.deductible.toLocaleString(locale)}</p></div>}
                    {ins.startDate && <div><p className="text-xs text-petra-muted">{t("insurance.coverageStart")}</p><p className="font-medium">{formatDate(ins.startDate)}</p></div>}
                  </div>
                  {ins.policyDocument && (
                    <a href={ins.policyDocument} download={`policy-${ins.policyNumber || ins.id}.pdf`} className="inline-flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-600">
                      <FileTextIcon className="w-3.5 h-3.5" /> {t("insurance.downloadPolicy")}
                    </a>
                  )}
                  {ins.notes && <p className="text-xs text-petra-muted">{ins.notes}</p>}
                  <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                    <button
                      className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1"
                      onClick={(e) => { e.stopPropagation(); setShowAddClaim(ins.id); }}
                    >
                      <Plus className="w-3.5 h-3.5" /> {t("insurance.newClaimOnPolicy")}
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingInsurance(ins); }}
                        className="flex items-center gap-1 text-xs text-petra-muted hover:text-brand-600 transition-colors"
                        title={t("insurance.editPolicy")}
                      >
                        <Pencil className="w-3.5 h-3.5" /> {tc("actions.edit")}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(t("insurance.confirmDeletePolicy", { provider: ins.provider || t("insurance.unknownInsurer") }))) {
                            deleteInsMutation.mutate(ins.id);
                          }
                        }}
                        disabled={deleteInsMutation.isPending}
                        className="flex items-center gap-1 text-xs text-petra-muted hover:text-red-500 transition-colors"
                        title={t("insurance.deletePolicy")}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> {t("insurance.delete")}
                      </button>
                    </div>
                    {showAddClaim === ins.id && (
                      <div className="w-full mt-2">
                        <AddClaimForm
                          onSave={(data) => addClaimMutation.mutate({ insuranceId: ins.id, data })}
                          onCancel={() => setShowAddClaim(null)}
                          isSaving={addClaimMutation.isPending}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editingInsurance && (
        <EditInsuranceModal
          dogId={dogId}
          insurance={editingInsurance}
          onClose={() => setEditingInsurance(null)}
          onSave={(data) => updateInsMutation.mutate({ insuranceId: editingInsurance.id, data })}
          isSaving={updateInsMutation.isPending}
        />
      )}
    </div>
  );
}

function EditInsuranceModal({
  dogId,
  insurance,
  onClose,
  onSave,
  isSaving,
}: {
  dogId: string;
  insurance: InsuranceRecord;
  onClose: () => void;
  onSave: (d: Record<string, unknown>) => void;
  isSaving: boolean;
}) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  // New file picked in this modal (null = keep the existing document)
  const [newDocUrl, setNewDocUrl] = useState<string | null>(null);
  const [newDocName, setNewDocName] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingDoc(true);
    try {
      const up = await uploadPolicyFile(t, dogId, file);
      setNewDocUrl(up.url);
      setNewDocName(up.fileName);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("shared.errorFileUpload"));
    } finally {
      setUploadingDoc(false);
    }
  };
  const [form, setForm] = useState({
    provider: insurance.provider ?? "",
    policyNumber: insurance.policyNumber ?? "",
    startDate: insurance.startDate ? insurance.startDate.slice(0, 10) : "",
    renewalDate: insurance.renewalDate ? insurance.renewalDate.slice(0, 10) : "",
    notes: insurance.notes ?? "",
    isActive: insurance.isActive,
  });
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{t("insurance.editPolicy")}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">{t("insurance.insurer")}</label>
              <input className="input w-full text-sm" list="insurance-providers-edit" value={form.provider} onChange={f("provider")} />
              <datalist id="insurance-providers-edit">
                {INSURANCE_PROVIDERS.map((n) => <option key={n} value={n} />)}
              </datalist>
            </div>
            <div><label className="label text-xs">{t("insurance.policyNumber")} <span className="text-petra-muted font-normal">{t("shared.optional")}</span></label><input className="input w-full text-sm" value={form.policyNumber} onChange={f("policyNumber")} /></div>
            <div><label className="label text-xs">{t("insurance.policyStart")} <span className="text-petra-muted font-normal">{t("shared.optional")}</span></label><input type="date" lang={cfg.lang} className="input w-full text-sm" value={form.startDate} onChange={f("startDate")} /></div>
            <div><label className="label text-xs">{t("insurance.policyEnd")} <span className="text-petra-muted font-normal">{t("shared.optional")}</span></label><input type="date" lang={cfg.lang} className="input w-full text-sm" value={form.renewalDate} onChange={f("renewalDate")} /></div>
            <div className="flex items-center gap-2 pt-4">
              <input
                type="checkbox"
                id="ins-active"
                checked={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="w-4 h-4"
              />
              <label htmlFor="ins-active" className="text-sm">{t("insurance.activePolicy")}</label>
            </div>
          </div>
          <div><label className="label text-xs">{t("shared.notes")}</label><textarea className="input w-full text-sm" rows={2} value={form.notes} onChange={f("notes")} /></div>
          {/* Policy file — attach one, or replace the current one on renewal */}
          <div>
            <label className="label text-xs">{t("insurance.policyDocMax")}</label>
            {insurance.policyDocument && !newDocUrl && (
              <p className="text-xs text-petra-muted mb-1.5 flex items-center gap-1">
                <FileTextIcon className="w-3 h-3" /> {t("insurance.replaceDocHint")}
              </p>
            )}
            <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-blue-200 rounded-lg p-3 hover:border-blue-400 transition-colors">
              <Upload className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-sm text-blue-600 truncate">
                {uploadingDoc ? t("shared.uploading") : newDocName || (insurance.policyDocument ? t("insurance.replaceFile") : t("shared.clickToUpload"))}
              </span>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFileChange} disabled={uploadingDoc} />
            </label>
            {newDocUrl && !uploadingDoc && (
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> {t("insurance.uploadedWillSave")} {newDocName}
              </p>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              className="btn-primary text-sm flex-1"
              onClick={() => onSave(newDocUrl ? { ...form, policyDocument: newDocUrl } : form)}
              disabled={isSaving || uploadingDoc}
            >
              {isSaving ? tc("progress.saving") : t("shared.saveChanges")}
            </button>
            <button className="btn-secondary text-sm flex-1" onClick={onClose}>{tc("actions.cancel")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Vercel rejects request bodies over 4.5MB before our route runs, with a
// non-JSON 413 — so cap below it and translate that case into a clear message.
const POLICY_FILE_MAX_BYTES = 4 * 1024 * 1024;

async function uploadPolicyFile(t: DetailT, dogId: string, file: File): Promise<{ url: string; fileName: string }> {
  if (file.size > POLICY_FILE_MAX_BYTES) {
    throw new Error(t("insurance.fileTooLargeSize", { size: (file.size / 1024 / 1024).toFixed(1) }));
  }
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`/api/service-dogs/${dogId}/upload`, { method: "POST", body: formData });
  if (res.status === 413) throw new Error(t("insurance.fileTooLarge4"));
  let data: { url?: string; fileName?: string; error?: string } = {};
  try { data = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok || !data.url) throw new Error(data.error || t("insurance.errorUploadRetry"));
  return { url: data.url, fileName: data.fileName || file.name };
}

function AddInsuranceForm({ dogId, onSave, onCancel, isSaving }: { dogId: string; onSave: (d: Record<string, unknown>) => void; onCancel: () => void; isSaving: boolean }) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const [form, setForm] = useState({ provider: "", policyNumber: "", startDate: "", renewalDate: "", notes: "" });
  const [policyDocument, setPolicyDocument] = useState<string | null>(null);
  const [docName, setDocName] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));

  // Upload straight to Blob storage and keep only the URL — the field is stored
  // as a plain string, and a raw base64 data URL for even a small PDF is far
  // longer than that column can hold (that was silently failing every save).
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file after an error
    if (!file) return;
    setUploadingDoc(true);
    try {
      const up = await uploadPolicyFile(t, dogId, file);
      setPolicyDocument(up.url);
      setDocName(up.fileName);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("shared.errorFileUpload"));
      setPolicyDocument(null);
      setDocName(null);
    } finally {
      setUploadingDoc(false);
    }
  };

  return (
    <div className="card p-4 border-2 border-blue-200 bg-blue-50/30 space-y-3">
      <h4 className="text-sm font-semibold">{t("insurance.newPolicy")}</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label text-xs">{t("insurance.insurer")}</label>
          <input className="input w-full text-sm" list="insurance-providers" value={form.provider} onChange={f("provider")} placeholder={t("insurance.insurerPlaceholder")} />
          <datalist id="insurance-providers">
            {INSURANCE_PROVIDERS.map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>
        <div><label className="label text-xs">{t("insurance.policyNumber")} <span className="text-petra-muted font-normal">{t("shared.optional")}</span></label><input className="input w-full text-sm" value={form.policyNumber} onChange={f("policyNumber")} /></div>
        <div><label className="label text-xs">{t("insurance.policyStart")} <span className="text-petra-muted font-normal">{t("shared.optional")}</span></label><input type="date" lang={cfg.lang} className="input w-full text-sm" value={form.startDate} onChange={f("startDate")} /></div>
        <div><label className="label text-xs">{t("insurance.policyEnd")} <span className="text-petra-muted font-normal">{t("shared.optional")}</span></label><input type="date" lang={cfg.lang} className="input w-full text-sm" value={form.renewalDate} onChange={f("renewalDate")} /></div>
      </div>
      <div><label className="label text-xs">{t("shared.notes")}</label><textarea className="input w-full text-sm" rows={2} value={form.notes} onChange={f("notes")} /></div>
      {/* File upload */}
      <div>
        <label className="label text-xs">{t("insurance.policyDoc")}</label>
        <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-blue-200 rounded-lg p-3 hover:border-blue-400 transition-colors">
          <Upload className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-sm text-blue-600 truncate">{uploadingDoc ? t("shared.uploading") : (docName || t("shared.clickToUpload"))}</span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFileChange} disabled={uploadingDoc} />
        </label>
        {policyDocument && !uploadingDoc && (
          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
            <Check className="w-3 h-3" /> {t("insurance.fileUploaded")} {docName}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <button className="btn-primary text-sm" onClick={() => onSave({ ...form, policyDocument })} disabled={!form.provider || isSaving || uploadingDoc}>{isSaving ? tc("progress.saving") : tc("actions.save")}</button>
        <button className="btn-secondary text-sm" onClick={onCancel}>{tc("actions.cancel")}</button>
      </div>
    </div>
  );
}

function AddClaimForm({ onSave, onCancel, isSaving }: { onSave: (d: Record<string, unknown>) => void; onCancel: () => void; isSaving: boolean }) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const { locale, cfg, currency } = useBusinessLocale();
  const cur = currencySymbol({ locale, currency });
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ incidentDate: today, description: "", amount: "", deductiblePaid: "", vetName: "", claimNumber: "", submittedAt: "", followUpAt: "", status: "PENDING" });
  const [documents, setDocuments] = useState<ClaimDocument[]>([]);
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleDocUpload = (docType: ClaimDocument["type"]) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error(t("shared.fileTooLarge5")); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setDocuments((prev) => [...prev.filter((d) => d.type !== docType), { name: file.name, type: docType, data: reader.result as string, uploadedAt: new Date().toISOString() }]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const invoiceDoc = documents.find((d) => d.type === "invoice");
  const summaryDoc = documents.find((d) => d.type === "visit_summary");

  return (
    <div className="bg-white border-2 border-blue-100 rounded-xl p-4 space-y-3">
      <h4 className="text-sm font-semibold text-blue-700 flex items-center gap-1.5">
        <FileTextIcon className="w-4 h-4" /> {t("insurance.newClaim")}
      </h4>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label text-xs">{t("insurance.incidentDateRequired")}</label><input type="date" lang={cfg.lang} className="input w-full text-sm" value={form.incidentDate} onChange={f("incidentDate")} /></div>
        <div><label className="label text-xs">{t("shared.status")}</label>
          <select className="input w-full text-sm" value={form.status} onChange={f("status")}>
            {CLAIM_STATUSES.filter((s) => (CLAIM_OPEN_STATUSES as readonly string[]).includes(s.id)).map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div><label className="label text-xs">{t("insurance.claimNumber")}</label><input className="input w-full text-sm" value={form.claimNumber} onChange={f("claimNumber")} placeholder={t("insurance.claimNumberPlaceholder")} /></div>
        <div><label className="label text-xs">{t("shared.vet")}</label><input className="input w-full text-sm" value={form.vetName} onChange={f("vetName")} /></div>
        <div><label className="label text-xs">{t("insurance.claimAmountCurrency", { currency: cur })}</label><input type="number" className="input w-full text-sm" value={form.amount} onChange={f("amount")} /></div>
        <div><label className="label text-xs">{t("insurance.deductibleCurrency", { currency: cur })}</label><input type="number" className="input w-full text-sm" value={form.deductiblePaid} onChange={f("deductiblePaid")} /></div>
        <div><label className="label text-xs">{t("insurance.submittedDate")}</label><input type="date" lang={cfg.lang} className="input w-full text-sm" value={form.submittedAt} onChange={f("submittedAt")} /></div>
        <div><label className="label text-xs">{t("insurance.followUpDate")}</label><input type="date" lang={cfg.lang} className="input w-full text-sm" value={form.followUpAt} onChange={f("followUpAt")} /></div>
      </div>
      <div><label className="label text-xs">{t("insurance.incidentDescription")}</label><textarea className="input w-full text-sm" rows={2} value={form.description} onChange={f("description")} /></div>
      {/* Document uploads */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-petra-muted">{t("insurance.documentsOptional")}</p>
        <div className="grid grid-cols-2 gap-2">
          <label className={cn("flex items-center gap-1.5 cursor-pointer border rounded-lg px-2.5 py-2 text-xs transition-colors", invoiceDoc ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-dashed border-slate-300 hover:border-brand-300 text-petra-muted")}>
            {invoiceDoc ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Upload className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate">{invoiceDoc ? invoiceDoc.name : t("shared.invoice")}</span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleDocUpload("invoice")} />
          </label>
          <label className={cn("flex items-center gap-1.5 cursor-pointer border rounded-lg px-2.5 py-2 text-xs transition-colors", summaryDoc ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-dashed border-slate-300 hover:border-brand-300 text-petra-muted")}>
            {summaryDoc ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Upload className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate">{summaryDoc ? summaryDoc.name : t("shared.visitSummary")}</span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleDocUpload("visit_summary")} />
          </label>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          className="btn-primary text-sm"
          onClick={() => onSave({ ...form, documents, invoiceAttached: !!invoiceDoc, visitSummaryAttached: !!summaryDoc, followUpAt: form.followUpAt || null })}
          disabled={!form.incidentDate || isSaving}
        >{isSaving ? tc("progress.saving") : t("insurance.openClaim")}</button>
        <button className="btn-ghost text-sm" onClick={onCancel}>{tc("actions.cancel")}</button>
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
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const formatDate = useFormatDay();
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
      toast.success(t("equipment.toastVestAdded"));
    },
    onError: () => toast.error(t("equipment.errorVestAdd")),
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
      toast.success(t("equipment.toastVestRetired"));
    },
  });

  const activeVests = vests.filter((v) => v.isActive);
  const retiredVests = vests.filter((v) => !v.isActive);

  if (isLoading) return <PetraLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Package className="w-4 h-4 text-brand-500" />
          {t("equipment.title")}
        </h3>
        <button className="btn-primary text-sm flex items-center gap-1.5" onClick={() => setShowAddVest(!showAddVest)}>
          <Plus className="w-4 h-4" />
          {t("equipment.addVest")}
        </button>
      </div>

      {showAddVest && <AddVestForm onSave={(d) => addVestMutation.mutate(d)} onCancel={() => setShowAddVest(false)} isSaving={addVestMutation.isPending} />}

      {activeVests.length === 0 && !showAddVest && (
        <div className="card p-10 text-center">
          <Package className="w-12 h-12 mx-auto text-petra-muted/30 mb-3" />
          <p className="text-petra-muted">{t("equipment.noActive")}</p>
        </div>
      )}

      {activeVests.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-2 bg-slate-50/50 border-b text-xs font-semibold text-petra-muted">{t("shared.activePlural")}</div>
          <div className="divide-y">
            {activeVests.map((vest) => {
              const cond = VEST_CONDITIONS.find((c) => c.id === vest.condition);
              const type = VEST_TYPES.find((tx) => tx.id === vest.vestType);
              return (
                <div key={vest.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center">
                      <Tag className="w-5 h-5 text-brand-500" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {type?.label || t("equipment.vestFallback")}
                        {vest.color && ` · ${vest.color}`}
                        {vest.size && t("equipment.sizeSuffix", { size: vest.size })}
                      </p>
                      <div className="flex gap-2 text-xs text-petra-muted mt-0.5">
                        {vest.serialNumber && <span>{t("equipment.serialShort")} {vest.serialNumber}</span>}
                        <span>{t("equipment.assigned")} {formatDate(vest.assignedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", cond?.color || "bg-slate-100 text-slate-600")}>
                      {cond?.label || vest.condition}
                    </span>
                    <button
                      onClick={() => { if (confirm(t("equipment.confirmRetire"))) retireVestMutation.mutate(vest.id); }}
                      className="text-xs text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded px-2 py-1 transition-colors"
                    >
                      {t("equipment.retire")}
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
          <summary className="text-sm text-petra-muted cursor-pointer">{t("equipment.archive")}{retiredVests.length})</summary>
          <div className="space-y-2 mt-3">
            {retiredVests.map((vest) => {
              const cond = VEST_CONDITIONS.find((c) => c.id === vest.condition);
              const type = VEST_TYPES.find((tx) => tx.id === vest.vestType);
              return (
                <div key={vest.id} className="flex items-center gap-3 text-sm opacity-60">
                  <Tag className="w-4 h-4 text-petra-muted" />
                  <span>{type?.label || t("equipment.vestFallback")} {vest.color} {vest.size && `(${vest.size})`}</span>
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
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const [form, setForm] = useState({ size: "", color: "", vestType: "", serialNumber: "", condition: "GOOD", notes: "" });
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));
  return (
    <div className="card p-4 border-2 border-brand-200 bg-brand-50/30 space-y-3">
      <h4 className="text-sm font-semibold">{t("equipment.newVest")}</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div><label className="label text-xs">{t("shared.type")}</label>
          <select className="input w-full text-sm" value={form.vestType} onChange={f("vestType")}>
            <option value="">{t("shared.choose")}</option>
            {VEST_TYPES.map((tx) => <option key={tx.id} value={tx.id}>{tx.label}</option>)}
          </select>
        </div>
        <div><label className="label text-xs">{t("equipment.size")}</label>
          <select className="input w-full text-sm" value={form.size} onChange={f("size")}>
            <option value="">{t("shared.choose")}</option>
            {VEST_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div><label className="label text-xs">{t("shared.color")}</label><input className="input w-full text-sm" value={form.color} onChange={f("color")} placeholder={t("equipment.colorPlaceholder")} /></div>
        <div><label className="label text-xs">{t("equipment.condition")}</label>
          <select className="input w-full text-sm" value={form.condition} onChange={f("condition")}>
            {VEST_CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div><label className="label text-xs">{t("equipment.serialNumber")}</label><input className="input w-full text-sm" value={form.serialNumber} onChange={f("serialNumber")} /></div>
      </div>
      <div><label className="label text-xs">{t("shared.notes")}</label><textarea className="input w-full text-sm" rows={2} value={form.notes} onChange={f("notes")} /></div>
      <div className="flex gap-2">
        <button className="btn-primary text-sm" onClick={() => onSave(form)} disabled={isSaving}>{isSaving ? tc("progress.saving") : tc("actions.save")}</button>
        <button className="btn-secondary text-sm" onClick={onCancel}>{tc("actions.cancel")}</button>
      </div>
    </div>
  );
}

// ─── Vaccine Renewal Modal ───

function VaccineRenewalModal({
  petId, dogId, vaccineType, vaccineLabel, onClose,
}: {
  petId: string; dogId: string; vaccineType: "rabies" | "dhpp" | "bordetella"; vaccineLabel: string; onClose: () => void;
}) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const queryClient = useQueryClient();
  const [newDate, setNewDate] = useState("");
  const [newValidUntil, setNewValidUntil] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/pets/${petId}/health/renew-vaccine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaccineType, newDate, newValidUntil: newValidUntil || undefined }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("shared.error")); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      toast.success(t("renewal.toastVaccineUpdated", { label: vaccineLabel }));
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || t("renewal.errorVaccine")),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{t("renewal.vaccineTitle")} {vaccineLabel}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">{t("renewal.newVaccineDate")}</label>
            <input type="date" lang={cfg.lang} className="input" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("shared.validUntil")}</label>
            <input type="date" lang={cfg.lang} className="input" value={newValidUntil} onChange={(e) => setNewValidUntil(e.target.value)} />
          </div>
          <p className="text-xs text-petra-muted bg-slate-50 rounded-lg p-2.5">
            {t("renewal.historyNote")}
          </p>
        </div>
        <div className="flex gap-3 mt-5">
          <button
            className="btn-primary flex-1"
            disabled={!newDate || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? tc("progress.saving") : t("renewal.saveVaccine")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Treatment Renewal Modal ───

const TREATMENT_DATE_FIELD: Record<string, { dateField: string; validUntilField: string }> = {
  parkWorm:  { dateField: "parkWormDate",      validUntilField: "parkWormValidUntil" },
  deworming: { dateField: "dewormingLastDate",  validUntilField: "dewormingValidUntil" },
  fleaTick:  { dateField: "fleaTickDate",       validUntilField: "fleaTickExpiryDate" },
};

function TreatmentRenewalModal({
  petId, dogId, treatmentType, treatmentLabel, onClose, onSaved,
}: {
  petId: string; dogId: string; treatmentType: "parkWorm" | "deworming" | "fleaTick"; treatmentLabel: string; onClose: () => void; onSaved: () => void;
}) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const [newDate, setNewDate] = useState("");
  const [newValidUntil, setNewValidUntil] = useState("");
  const fields = TREATMENT_DATE_FIELD[treatmentType];

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/pets/${petId}/health`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [fields.dateField]: newDate,
          [fields.validUntilField]: newValidUntil || null,
        }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("shared.error")); return d; }),
    onSuccess: () => {
      onSaved();
      toast.success(t("renewal.toastTreatmentUpdated", { label: treatmentLabel }));
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || t("renewal.errorTreatment")),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{t("renewal.treatmentTitle")} {treatmentLabel}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">{t("renewal.newTreatmentDate")}</label>
            <input type="date" lang={cfg.lang} className="input" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("shared.validUntil")}</label>
            <input type="date" lang={cfg.lang} className="input" value={newValidUntil} onChange={(e) => setNewValidUntil(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button className="btn-primary flex-1" disabled={!newDate || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? tc("progress.saving") : t("renewal.saveTreatment")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
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
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const queryClient = useQueryClient();
  const toDateInput = (v: string | null) => (v ? v.split("T")[0] : "");
  const h = health;
  const [form, setForm] = useState({
    rabiesLastDate: toDateInput(h?.rabiesLastDate ?? null),
    rabiesValidUntil: toDateInput(h?.rabiesValidUntil ?? null),
    dhppLastDate: toDateInput(h?.dhppLastDate ?? null),
    dhppValidUntil: toDateInput(h?.dhppValidUntil ?? null),
    dhppPuppy1Date: toDateInput(h?.dhppPuppy1Date ?? null),
    dhppPuppy2Date: toDateInput(h?.dhppPuppy2Date ?? null),
    dhppPuppy3Date: toDateInput(h?.dhppPuppy3Date ?? null),
    bordatellaDate: toDateInput(h?.bordatellaDate ?? null),
    bordatellaValidUntil: toDateInput(h?.bordatellaValidUntil ?? null),
    parkWormDate: toDateInput(h?.parkWormDate ?? null),
    parkWormValidUntil: toDateInput(h?.parkWormValidUntil ?? null),
    dewormingLastDate: toDateInput(h?.dewormingLastDate ?? null),
    dewormingValidUntil: toDateInput(h?.dewormingValidUntil ?? null),
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
    neuteredSpayedDate: toDateInput(h?.neuteredSpayedDate ?? null),
    originInfo: h?.originInfo ?? "",
    timeWithOwner: h?.timeWithOwner ?? "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/pets/${petId}/health`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("shared.error")); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      onClose();
      toast.success(t("health.toastUpdated"));
    },
    onError: () => toast.error(t("health.errorUpdate")),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{t("health.title")} {petName}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-5">
          <div className="space-y-4">
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide">{t("shared.vaccinesTreatments")}</p>
            <div>
              <p className="text-xs font-medium mb-2">{t("health.rabiesYearly")}</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t("health.vaccineDate")}</label><input className="input" type="date" lang={cfg.lang} value={form.rabiesLastDate} onChange={(e) => setForm({ ...form, rabiesLastDate: e.target.value })} /></div>
                <div><label className="label">{t("shared.validUntil")}</label><input className="input" type="date" lang={cfg.lang} value={form.rabiesValidUntil} onChange={(e) => setForm({ ...form, rabiesValidUntil: e.target.value })} /></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-2">{t("health.dhppPuppy3")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><label className="label">{t("health.dose1")}</label><input className="input" type="date" lang={cfg.lang} value={form.dhppPuppy1Date} onChange={(e) => setForm({ ...form, dhppPuppy1Date: e.target.value })} /></div>
                <div><label className="label">{t("health.dose2")}</label><input className="input" type="date" lang={cfg.lang} value={form.dhppPuppy2Date} onChange={(e) => setForm({ ...form, dhppPuppy2Date: e.target.value })} /></div>
                <div><label className="label">{t("health.dose3")}</label><input className="input" type="date" lang={cfg.lang} value={form.dhppPuppy3Date} onChange={(e) => setForm({ ...form, dhppPuppy3Date: e.target.value })} /></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-2">{t("shared.dhppAdult")}</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t("health.vaccineDate")}</label><input className="input" type="date" lang={cfg.lang} value={form.dhppLastDate} onChange={(e) => setForm({ ...form, dhppLastDate: e.target.value })} /></div>
                <div><label className="label">{t("shared.validUntil")}</label><input className="input" type="date" lang={cfg.lang} value={form.dhppValidUntil} onChange={(e) => setForm({ ...form, dhppValidUntil: e.target.value })} /></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-2">{t("shared.kennelCough")}</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t("health.receivedDate")}</label><input className="input" type="date" lang={cfg.lang} value={form.bordatellaDate} onChange={(e) => setForm({ ...form, bordatellaDate: e.target.value })} /></div>
                <div><label className="label">{t("shared.validUntil")}</label><input className="input" type="date" lang={cfg.lang} value={form.bordatellaValidUntil} onChange={(e) => setForm({ ...form, bordatellaValidUntil: e.target.value })} /></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-2">{t("shared.parkWorm")}</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t("health.treatmentDate")}</label><input className="input" type="date" lang={cfg.lang} value={form.parkWormDate} onChange={(e) => setForm({ ...form, parkWormDate: e.target.value })} /></div>
                <div><label className="label">{t("shared.validUntil")}</label><input className="input" type="date" lang={cfg.lang} value={(form as unknown as Record<string, string>).parkWormValidUntil ?? ""} onChange={(e) => setForm({ ...form, parkWormValidUntil: e.target.value })} /></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-2">{t("shared.deworming")}</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t("health.dewormingDate")}</label><input className="input" type="date" lang={cfg.lang} value={form.dewormingLastDate} onChange={(e) => setForm({ ...form, dewormingLastDate: e.target.value })} /></div>
                <div><label className="label">{t("shared.validUntil")}</label><input className="input" type="date" lang={cfg.lang} value={(form as unknown as Record<string, string>).dewormingValidUntil ?? ""} onChange={(e) => setForm({ ...form, dewormingValidUntil: e.target.value })} /></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-2">{t("shared.fleaTick")}</p>
              <div className="space-y-2">
                <div><label className="label">{t("health.treatmentType")}</label><input className="input" placeholder="Nexgard, Bravecto..." value={form.fleaTickType} onChange={(e) => setForm({ ...form, fleaTickType: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">{t("health.treatmentDate")}</label><input className="input" type="date" lang={cfg.lang} value={form.fleaTickDate} onChange={(e) => setForm({ ...form, fleaTickDate: e.target.value })} /></div>
                  <div><label className="label">{t("shared.validUntil")}</label><input className="input" type="date" lang={cfg.lang} value={form.fleaTickExpiryDate} onChange={(e) => setForm({ ...form, fleaTickExpiryDate: e.target.value })} /></div>
                </div>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">{t("shared.medicalCondition")}</p>
            <div className="space-y-3">
              <div><label className="label">{t("health.allergies")}</label><input className="input" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} /></div>
              <div><label className="label">{t("health.conditions")}</label><textarea className="input min-h-[60px]" value={form.medicalConditions} onChange={(e) => setForm({ ...form, medicalConditions: e.target.value })} /></div>
              <div><label className="label">{t("health.pastSurgeries")}</label><input className="input" value={form.surgeriesHistory} onChange={(e) => setForm({ ...form, surgeriesHistory: e.target.value })} /></div>
              <div><label className="label">{t("health.activityLimits")}</label><input className="input" value={form.activityLimitations} onChange={(e) => setForm({ ...form, activityLimitations: e.target.value })} /></div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">{t("shared.vet")}</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">{t("health.vetName")}</label><input className="input" value={form.vetName} onChange={(e) => setForm({ ...form, vetName: e.target.value })} /></div>
              <div><label className="label">{t("health.vetPhone")}</label><input className="input" value={form.vetPhone} onChange={(e) => setForm({ ...form, vetPhone: e.target.value })} /></div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">{t("health.general")}</p>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.neuteredSpayed} onChange={(e) => setForm({ ...form, neuteredSpayed: e.target.checked })} className="w-4 h-4 accent-brand-500" />
                <span className="text-sm">{t("shared.neutered")}</span>
              </label>
              {form.neuteredSpayed && (
                <div>
                  <label className="label">{t("shared.neuterDate")}</label>
                  <input type="date" lang={cfg.lang} className="input" value={form.neuteredSpayedDate} onChange={(e) => setForm({ ...form, neuteredSpayedDate: e.target.value })} />
                </div>
              )}
              <div><label className="label">{t("health.origin")}</label><input className="input" value={form.originInfo} onChange={(e) => setForm({ ...form, originInfo: e.target.value })} placeholder={t("health.originPlaceholder")} /></div>
              <div><label className="label">{t("health.timeWithOwner")}</label><input className="input" value={form.timeWithOwner} onChange={(e) => setForm({ ...form, timeWithOwner: e.target.value })} /></div>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? tc("progress.saving") : t("shared.saveChanges")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
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
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
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
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("shared.error")); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      onClose();
      toast.success(t("behavior.toastUpdated"));
    },
    onError: () => toast.error(t("behavior.errorUpdate")),
  });

  const toggle = (key: string) => setForm((f) => ({ ...f, [key]: !f[key as keyof typeof f] }));

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{t("behavior.title")} {petName}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">{t("behavior.flags")}</p>
            <div className="grid grid-cols-2 gap-y-2 gap-x-3">
              {BEHAVIOR_FLAGS.map(({ key, labelKey }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!form[key as keyof typeof form]} onChange={() => toggle(key)} className="w-4 h-4 accent-brand-500" />
                  <span className="text-xs">{t(labelKey)}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {form.biteHistory && (
              <div><label className="label">{t("behavior.biteDetails")}</label><textarea className="input min-h-[60px]" value={form.biteDetails} onChange={(e) => setForm({ ...form, biteDetails: e.target.value })} /></div>
            )}
            <div><label className="label">{t("behavior.triggers")}</label><input className="input" value={form.triggers} onChange={(e) => setForm({ ...form, triggers: e.target.value })} placeholder={t("behavior.triggersPlaceholder")} /></div>
            {form.priorTraining && (
              <div><label className="label">{t("behavior.priorTraining")}</label><input className="input" value={form.priorTrainingDetails} onChange={(e) => setForm({ ...form, priorTrainingDetails: e.target.value })} /></div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">{t("behavior.otherIssues")}</p>
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
              <input className="input flex-1" value={customInput} onChange={(e) => setCustomInput(e.target.value)} placeholder={t("behavior.addIssuePlaceholder")} onKeyDown={(e) => { if (e.key === "Enter" && customInput.trim()) { setForm((f) => ({ ...f, customIssues: [...f.customIssues, customInput.trim()] })); setCustomInput(""); } }} />
              <button type="button" className="btn-secondary px-3" onClick={() => { if (customInput.trim()) { setForm((f) => ({ ...f, customIssues: [...f.customIssues, customInput.trim()] })); setCustomInput(""); } }}>
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? tc("progress.saving") : t("shared.saveChanges")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── SD Feeding Modal ───

function SDFeedingModal({
  petId, petName, pet, dogId, dog, onClose,
}: {
  petId: string;
  petName: string;
  pet: ServiceDogDetail["pet"];
  dogId: string;
  dog: ServiceDogDetail;
  onClose: () => void;
}) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const existingHistory = (Array.isArray(dog.feedingHistory) ? dog.feedingHistory : []) as FeedingEntry[];
  const latest = existingHistory[0];
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    foodBrand: latest?.foodBrand ?? pet.foodBrand ?? "",
    foodType: latest?.foodType ?? "",
    foodGramsPerDay: (latest?.foodGramsPerDay ?? pet.foodGramsPerDay)?.toString() ?? "",
    foodFrequency: latest?.foodFrequency ?? pet.foodFrequency ?? "",
    dogWeightKg: (latest?.dogWeightKg ?? pet.weight)?.toString() ?? "",
    foodNotes: latest?.foodNotes ?? pet.foodNotes ?? "",
    date: today,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const newEntry: FeedingEntry = {
        id: crypto.randomUUID(),
        date: form.date || today,
        foodBrand: form.foodBrand.trim(),
        ...(form.foodType.trim() && { foodType: form.foodType.trim() }),
        ...(form.foodGramsPerDay && { foodGramsPerDay: parseFloat(form.foodGramsPerDay) }),
        ...(form.foodFrequency && { foodFrequency: form.foodFrequency }),
        ...(form.dogWeightKg && { dogWeightKg: parseFloat(form.dogWeightKg) }),
        ...(form.foodNotes.trim() && { foodNotes: form.foodNotes.trim() }),
      };
      const newHistory = [newEntry, ...existingHistory];

      const [r1] = await Promise.all([
        fetch(`/api/service-dogs/${dogId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedingHistory: newHistory }),
        }),
        fetch(`/api/pets/${petId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            foodBrand: form.foodBrand || null,
            foodGramsPerDay: form.foodGramsPerDay ? parseFloat(form.foodGramsPerDay) : null,
            foodFrequency: form.foodFrequency || null,
            foodNotes: form.foodNotes || null,
            ...(form.dogWeightKg && { weight: parseFloat(form.dogWeightKg) }),
          }),
        }),
      ]);
      const d1 = await r1.json();
      if (!r1.ok) throw new Error(d1.error || t("shared.error"));
      return d1;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      onClose();
      toast.success(t("feeding.toastAdded"));
    },
    onError: () => toast.error(t("feeding.errorSave")),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{t("feeding.title")} {petName}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div><label className="label">{t("feeding.updateDate")}</label><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div><label className="label">{t("feeding.foodBrand")}</label><input className="input" placeholder={t("feeding.brandPlaceholder")} value={form.foodBrand} onChange={(e) => setForm({ ...form, foodBrand: e.target.value })} /></div>
          <div><label className="label">{t("shared.type")}</label><input className="input" placeholder={t("feeding.typePlaceholder")} value={form.foodType} onChange={(e) => setForm({ ...form, foodType: e.target.value })} /></div>
          <div><label className="label">{t("feeding.amountPerDay")}</label><input className="input" type="number" value={form.foodGramsPerDay} onChange={(e) => setForm({ ...form, foodGramsPerDay: e.target.value })} /></div>
          <div>
            <label className="label">{t("feeding.frequency")}</label>
            <select className="input" value={form.foodFrequency} onChange={(e) => setForm({ ...form, foodFrequency: e.target.value })}>
              <option value="">{t("shared.choose")}</option>
              <option value="פעם ביום" /* i18n-ok */>{t("feeding.freq1")}</option>
              <option value="פעמיים ביום" /* i18n-ok */>{t("feeding.freq2")}</option>
              <option value="3 פעמים ביום" /* i18n-ok */>{t("feeding.freq3")}</option>
              <option value="4 פעמים ביום" /* i18n-ok */>{t("feeding.freq4")}</option>
            </select>
          </div>
          <div><label className="label">{t("feeding.dogWeightKg")}</label><input className="input" type="number" min={0} step={0.1} placeholder="0.0" value={form.dogWeightKg} onChange={(e) => setForm({ ...form, dogWeightKg: e.target.value })} /></div>
          <div><label className="label">{t("shared.notes")}</label><textarea className="input min-h-[60px]" value={form.foodNotes} onChange={(e) => setForm({ ...form, foodNotes: e.target.value })} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={mutation.isPending || !form.foodBrand.trim()} onClick={() => mutation.mutate()}>
            {mutation.isPending ? tc("progress.saving") : t("shared.addUpdate")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
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
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
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
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("shared.error")); return d; });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      onClose();
      toast.success(med ? t("med.toastUpdated") : t("med.toastAdded"));
    },
    onError: () => toast.error(t("med.errorSave")),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{med ? t("med.editTitle") : t("med.addTitle")} — {petName}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div><label className="label">{t("med.nameRequired")}</label><input className="input" value={form.medName} onChange={(e) => setForm({ ...form, medName: e.target.value })} /></div>
          <div><label className="label">{t("med.dosage")}</label><input className="input" value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder={t("med.dosagePlaceholder")} /></div>
          <div><label className="label">{t("med.frequency")}</label><input className="input" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder={t("med.frequencyPlaceholder")} /></div>
          <div><label className="label">{t("med.times")}</label><input className="input" value={form.times} onChange={(e) => setForm({ ...form, times: e.target.value })} placeholder="07:00, 19:00" /></div>
          <div><label className="label">{t("med.instructions")}</label><input className="input" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">{t("med.startDate")}</label><input className="input" type="date" lang={cfg.lang} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label className="label">{t("med.endDate")}</label><input className="input" type="date" lang={cfg.lang} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={mutation.isPending || !form.medName.trim()} onClick={() => mutation.mutate()}>
            {mutation.isPending ? tc("progress.saving") : med ? t("shared.saveChanges") : t("med.addTitle")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Vaccinations Tab ───

const MONTH_KEYS = ["m01", "m02", "m03", "m04", "m05", "m06", "m07", "m08", "m09", "m10", "m11", "m12"] as const;
const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 1 + i);

function HebrewMonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  // value format: "YYYY-MM" or ""
  const [y, m] = value ? value.split("-") : ["", ""];
  const year = y ? Number(y) : "";
  const month = m ? Number(m) : "";
  const update = (newY: string | number, newM: string | number) => {
    if (newY && newM) onChange(`${newY}-${String(newM).padStart(2, "0")}`);
    else onChange("");
  };
  return (
    <div className="flex gap-1 justify-center">
      <select
        value={month}
        onChange={e => update(year || new Date().getFullYear(), e.target.value)}
        className="input text-xs py-1 h-8 w-24"
      >
        <option value="">{t("shared.month")}</option>
        {MONTH_KEYS.map((mk) => t(`months.${mk}`)).map((name, idx) => (
          <option key={idx + 1} value={idx + 1}>{name}</option>
        ))}
      </select>
      <select
        value={year}
        onChange={e => update(e.target.value, month || 1)}
        className="input text-xs py-1 h-8 w-20"
      >
        <option value="">{t("shared.year")}</option>
        {YEARS.map(yr => <option key={yr} value={yr}>{yr}</option>)}
      </select>
    </div>
  );
}

function HebrewDatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  // value format: "YYYY-MM-DD" or ""
  const [y, m, d] = value ? value.split("-") : ["", "", ""];
  const year = y ? Number(y) : "";
  const month = m ? Number(m) : "";
  const day = d ? Number(d) : "";
  const daysInMonth = (month && year) ? new Date(Number(year), Number(month), 0).getDate() : 31;
  const update = (newY: string | number, newM: string | number, newD: string | number) => {
    if (newY && newM && newD) onChange(`${newY}-${String(newM).padStart(2, "0")}-${String(newD).padStart(2, "0")}`);
    else onChange("");
  };
  return (
    <div className="flex gap-1 justify-center flex-wrap">
      <select value={day} onChange={e => update(year || new Date().getFullYear(), month || 1, e.target.value)}
        className="input text-xs py-1 h-8 w-14">
        <option value="">{t("vaccinations.day")}</option>
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <select value={month} onChange={e => update(year || new Date().getFullYear(), e.target.value, day || 1)}
        className="input text-xs py-1 h-8 w-24">
        <option value="">{t("shared.month")}</option>
        {MONTH_KEYS.map((mk) => t(`months.${mk}`)).map((name, idx) => (
          <option key={idx + 1} value={idx + 1}>{name}</option>
        ))}
      </select>
      <select value={year} onChange={e => update(e.target.value, month || 1, day || 1)}
        className="input text-xs py-1 h-8 w-20">
        <option value="">{t("shared.year")}</option>
        {YEARS.map(yr => <option key={yr} value={yr}>{yr}</option>)}
      </select>
    </div>
  );
}

function VaccinationsTab({ dog, dogId }: { dog: ServiceDogDetail; dogId: string }) {
  const t = useTranslations("serviceDogs.serviceDogsDetailPage");
  const tc = useTranslations("common");
  const { locale, cfg } = useBusinessLocale();
  const formatDate = useFormatDay();
  const queryClient = useQueryClient();
  // Classify by birth date: < 12 months = puppy. Fallback to phase if no birth date.
  const isPuppy = (() => {
    const bd = dog.pet.birthDate;
    if (!bd) return dog.phase === "PUPPY";
    const ageMonths = (Date.now() - new Date(bd).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    return ageMonths < 12;
  })();
  const planType = isPuppy ? "puppies" : "adults";
  const treatments = isPuppy ? PUPPY_TREATMENTS : ADULT_TREATMENTS;

  const [markingOpen, setMarkingOpen] = useState<string | null>(null); // "key-idx"
  const [markDate, setMarkDate] = useState("");
  const [setupYear, setSetupYear] = useState(new Date().getFullYear());

  // Edit mode: draft of planned dates per treatment key → array of values
  const [isEditing, setIsEditing] = useState(false);
  const [editDrafts, setEditDrafts] = useState<Record<string, string[]>>({});

  const { data: vaccinePlan, isLoading } = useQuery<VaccinePlan>({
    queryKey: ["vaccine-plan", dogId],
    queryFn: () => fetch(`/api/service-dogs/${dogId}/vaccine-plan`).then(r => r.json()),
  });

  // When a dog has BOTH plans (e.g., ADVANCED_TRAINING dogs migrated to adult central schedule),
  // show the adult plan as primary and puppy plan below as historical archive.
  const hasBothPlans = !!(vaccinePlan?.adults) && !!(vaccinePlan?.puppies);
  // effectiveIsPuppy: if dog has both plans, always treat adult as the active plan
  const effectiveIsPuppy = hasBothPlans ? false : isPuppy;
  const effectivePlanType = effectiveIsPuppy ? "puppies" : "adults";
  const effectiveTreatments = effectiveIsPuppy ? PUPPY_TREATMENTS : ADULT_TREATMENTS;

  const savePlanMutation = useMutation({
    mutationFn: (plan: VaccinePlan) =>
      fetch(`/api/service-dogs/${dogId}/vaccine-plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaccinePlan: plan, planType: effectivePlanType }),
      }).then(r => { if (!r.ok) throw new Error(t("shared.error")); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaccine-plan", dogId] });
      queryClient.invalidateQueries({ queryKey: ["service-dogs-vaccinations"] });
      setIsEditing(false);
      toast.success(t("vaccinations.toastPlanSaved"));
    },
    onError: () => toast.error(t("vaccinations.errorPlanSave")),
  });

  const markDoneMutation = useMutation({
    mutationFn: ({ treatmentKey, index, doneDate }: { treatmentKey: string; index: number; doneDate: string | null }) =>
      fetch(`/api/service-dogs/${dogId}/vaccine-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType: effectivePlanType, treatmentKey, index, doneDate }),
      }).then(r => { if (!r.ok) throw new Error(t("shared.error")); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaccine-plan", dogId] });
      queryClient.invalidateQueries({ queryKey: ["service-dogs-vaccinations"] });
      setMarkingOpen(null);
      setMarkDate("");
      toast.success(t("vaccinations.toastTreatmentUpdated"));
    },
    onError: () => toast.error(t("shared.errorUpdate")),
  });

  const notVaccinatedMutation = useMutation({
    mutationFn: ({ treatmentKey, index, notVaccinated }: { treatmentKey: string; index: number; notVaccinated: boolean }) =>
      fetch(`/api/service-dogs/${dogId}/vaccine-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType: effectivePlanType, treatmentKey, index, notVaccinated }),
      }).then(r => { if (!r.ok) throw new Error(t("shared.error")); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaccine-plan", dogId] });
      queryClient.invalidateQueries({ queryKey: ["service-dogs-vaccinations"] });
      toast.success(t("shared.toastStatusUpdated"));
    },
    onError: () => toast.error(t("shared.errorUpdate")),
  });

  const cellBg: Record<string, string> = {
    done: "bg-green-50 text-green-700 border-green-200",
    overdue: "bg-red-50 text-red-600 border-red-200",
    soon: "bg-amber-50 text-amber-700 border-amber-200",
    upcoming: "bg-sky-50 text-sky-700 border-sky-100",
    unknown: "bg-slate-50 text-slate-400 border-slate-200",
    not_vaccinated: "bg-orange-50 text-orange-700 border-orange-200",
  };

  // Enter edit mode: initialize drafts from current planned dates
  const enterEditMode = (currentSection: Record<string, Array<{ planned: string | null; done: string | null }>>) => {
    const drafts: Record<string, string[]> = {};
    effectiveTreatments.forEach(tx => {
      drafts[tx.key] = Array.from({ length: tx.doses }, (_, i) => {
        const planned = currentSection[tx.key]?.[i]?.planned ?? "";
        // Adults: "YYYY-MM" → input[type=month] value is "YYYY-MM" ✓
        // Puppies: ISO date → input[type=date] value is "YYYY-MM-DD" ✓
        return planned;
      });
    });
    setEditDrafts(drafts);
    setIsEditing(true);
  };

  // Build updated plan from drafts, preserving existing done dates
  const buildPlanFromDrafts = (currentSection: Record<string, Array<{ planned: string | null; done: string | null }>>): VaccinePlan => {
    const updatedSection: Record<string, Array<{ planned: string | null; done: string | null }>> = {};
    effectiveTreatments.forEach(tx => {
      updatedSection[tx.key] = Array.from({ length: tx.doses }, (_, i) => ({
        planned: editDrafts[tx.key]?.[i] || null,
        done: currentSection[tx.key]?.[i]?.done ?? null,
      }));
    });
    if (effectiveIsPuppy) {
      return { ...vaccinePlan, puppies: updatedSection as VaccinePlan["puppies"] };
    } else {
      const year = (vaccinePlan?.adults?.year) ?? setupYear;
      return { ...vaccinePlan, adults: { year, ...updatedSection } as VaccinePlan["adults"] };
    }
  };

  if (isLoading) {
    return <PetraLoader />;
  }

  const section = vaccinePlan?.[effectivePlanType];
  const hasPlan = !!section;

  // ── No plan yet: setup screen ──
  if (!hasPlan) {
    return (
      <div className="card p-8 text-center space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center mx-auto">
          <Pill className="w-6 h-6 text-sky-500" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">{t("vaccinations.noPlan")}</h3>
          <p className="text-petra-muted text-sm mt-1">
            {effectiveIsPuppy
              ? t("vaccinations.createPuppyPlanHint")
              : t("vaccinations.createAnnualPlanHint")}
          </p>
        </div>
        {!effectiveIsPuppy && (
          <div className="flex items-center justify-center gap-3">
            <label className="text-sm font-medium">{t("vaccinations.yearColon")}</label>
            <input
              type="number"
              value={setupYear}
              onChange={e => setSetupYear(Number(e.target.value))}
              className="input w-24 text-center"
              min={2020}
              max={2035}
            />
          </div>
        )}
        <button
          className="btn-primary mx-auto"
          disabled={savePlanMutation.isPending}
          onClick={() => {
            const emptySection = effectiveIsPuppy ? getEmptyPuppyPlan() : getEmptyAdultPlan(setupYear);
            const newPlan: VaccinePlan = effectiveIsPuppy
              ? { ...vaccinePlan, puppies: emptySection as VaccinePlan["puppies"] }
              : { ...vaccinePlan, adults: emptySection as VaccinePlan["adults"] };
            // Enter edit mode immediately after creating
            const emptyEntries = emptySection as Record<string, Array<{ planned: string | null; done: string | null }>>;
            const drafts: Record<string, string[]> = {};
            treatments.forEach(tx => { drafts[tx.key] = Array(tx.doses).fill(""); });
            setEditDrafts(drafts);
            savePlanMutation.mutate(newPlan, {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["vaccine-plan", dogId] });
                queryClient.invalidateQueries({ queryKey: ["service-dogs-vaccinations"] });
                setIsEditing(true);
                toast.success(t("vaccinations.toastPlanCreated"));
              },
            });
          }}
        >
          {savePlanMutation.isPending ? t("shared.creating") : t("vaccinations.createPlan")}
        </button>
      </div>
    );
  }

  // ── Has plan ──
  const entries = section as Record<string, Array<{ planned: string | null; done: string | null }>>;

  // Count status
  let overdueCount = 0, soonCount = 0;
  effectiveTreatments.forEach(tx => {
    entries[tx.key]?.forEach(e => {
      const s = getCellStatus(e);
      if (s === "overdue") overdueCount++;
      if (s === "soon") soonCount++;
    });
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                disabled={savePlanMutation.isPending}
                onClick={() => savePlanMutation.mutate(buildPlanFromDrafts(entries))}
              >
                <Check className="w-3.5 h-3.5" />
                {savePlanMutation.isPending ? tc("progress.saving") : t("vaccinations.savePlan")}
              </button>
              <button
                className="btn-secondary text-xs py-1.5 px-3"
                onClick={() => setIsEditing(false)}
              >
                {tc("actions.cancel")}
              </button>
            </>
          ) : (
            <>
              <button
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                onClick={() => enterEditMode(entries)}
              >
                <Pencil className="w-3.5 h-3.5" />
                {t("vaccinations.editPlan")}
              </button>
              <Link
                href="/service-dogs/vaccinations"
                className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
              >
                {t("vaccinations.centralManagement")}
                <ExternalLink className="w-3 h-3" />
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Pill className="w-4 h-4 text-petra-muted" />
          <span className="font-semibold text-sm">
            {effectiveIsPuppy ? t("vaccinations.puppyTitle") : t("vaccinations.annualTitle", { yearSuffix: vaccinePlan?.adults?.year ? ` — ${vaccinePlan.adults.year}` : "" })}
          </span>
        </div>
      </div>

      {/* Edit mode banner */}
      {isEditing && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-50 border border-sky-200 text-sm">
          <Pencil className="w-4 h-4 text-sky-500 flex-shrink-0" />
          <span className="text-sky-800">
            {effectiveIsPuppy ? t("vaccinations.editPuppyHint") : t("vaccinations.editAnnualHint")}
          </span>
        </div>
      )}

      {/* Warning banner */}
      {!isEditing && (overdueCount > 0 || soonCount > 0) && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span className="text-amber-800">
            {overdueCount > 0 && t("vaccinations.expiredCount", { count: overdueCount })}
            {overdueCount > 0 && soonCount > 0 && " · "}
            {soonCount > 0 && t("vaccinations.expiringCount", { count: soonCount })}
          </span>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-auto p-0">
        <table className="w-full text-sm" dir={cfg.dir}>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-start p-3 font-semibold text-petra-text w-32">{t("vaccinations.colTreatment")}</th>
              {effectiveTreatments.map(tx =>
                Array.from({ length: tx.doses }, (_, i) => (
                  <th key={`${tx.key}-${i}`} className="text-center p-3 font-semibold text-petra-text min-w-[120px]">
                    {tx.doses === 1 ? tx.label : `${tx.label} ${i + 1}`}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {/* Planned dates row — view or edit */}
            <tr className={cn("border-b", isEditing ? "bg-sky-50/40" : "bg-slate-50/30")}>
              <td className="p-3 text-xs font-medium text-petra-muted">
                {isEditing ? t("vaccinations.plannedDateEdit") : t("vaccinations.plannedDate")}
              </td>
              {effectiveTreatments.map(tx =>
                Array.from({ length: tx.doses }, (_, i) => {
                  const entry = entries[tx.key]?.[i] ?? null;
                  if (isEditing) {
                    const draftVal = editDrafts[tx.key]?.[i] ?? "";
                    const setDraft = (v: string) => {
                      setEditDrafts(prev => {
                        const next = { ...prev };
                        if (!next[tx.key]) next[tx.key] = Array(tx.doses).fill("");
                        next[tx.key] = [...next[tx.key]];
                        next[tx.key][i] = v;
                        return next;
                      });
                    };
                    return (
                      <td key={`${tx.key}-${i}-edit`} className="p-2 text-center">
                        {effectiveIsPuppy
                          ? <HebrewDatePicker value={draftVal} onChange={setDraft} />
                          : <HebrewMonthPicker value={draftVal} onChange={setDraft} />
                        }
                      </td>
                    );
                  }
                  return (
                    <td key={`${tx.key}-${i}-planned`} className="p-2 text-center text-xs text-petra-muted">
                      {entry?.planned ? formatPlannedDisplay(entry.planned) : <span className="text-slate-300">—</span>}
                    </td>
                  );
                })
              )}
            </tr>

            {/* Status row — only in view mode */}
            {!isEditing && (
              <tr className="border-b border-slate-50">
                <td className="p-3 font-medium text-petra-text text-xs">{t("shared.status")}</td>
                {effectiveTreatments.map(tx =>
                  Array.from({ length: tx.doses }, (_, i) => {
                    const entry = entries[tx.key]?.[i] ?? null;
                    const status = getCellStatus(entry);
                    const markKey = `${tx.key}-${i}`;
                    const isMarking = markingOpen === markKey;

                    return (
                      <td key={`${tx.key}-${i}`} className="p-2 text-center relative">
                        {isMarking && <div className="h-8" />}
                        {isMarking && (
                          <div className="absolute bottom-full end-1/2 -translate-x-1/2 ltr:translate-x-1/2 mb-2 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-3 flex flex-col gap-2 min-w-[180px]">
                            <input
                              type="date" lang={cfg.lang}
                              value={markDate}
                              onChange={e => setMarkDate(e.target.value)}
                              className="input text-xs py-0.5 h-8"
                              autoFocus
                            />
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  if (!markDate) return;
                                  markDoneMutation.mutate({ treatmentKey: tx.key, index: i, doneDate: markDate });
                                }}
                                className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-green-500 text-white text-xs hover:bg-green-600"
                              >
                                <Check className="w-3 h-3" /> {t("vaccinations.confirm")}
                              </button>
                              <button
                                onClick={() => { setMarkingOpen(null); setMarkDate(""); }}
                                className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-slate-100 text-slate-600 text-xs hover:bg-slate-200"
                              >
                                <X className="w-3 h-3" /> {tc("actions.cancel")}
                              </button>
                            </div>
                          </div>
                        )}
                        {!isMarking && (
                          <>
                            <div className={cn(
                              "rounded-lg px-2 py-1 text-xs font-medium border inline-block min-w-[90px] mb-1",
                              cellBg[status]
                            )}>
                              {status === "done" && entry?.done
                                ? `✓ ${new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(entry.done))}`
                                : status === "overdue" ? t("vaccinations.statusExpired")
                                : status === "not_vaccinated" ? t("vaccinations.notVaccinated")
                                : status === "soon" && entry?.planned ? formatPlannedDisplay(entry.planned)
                                : status === "upcoming" && entry?.planned ? formatPlannedDisplay(entry.planned)
                                : t("vaccinations.unknown")}
                            </div>
                            {status !== "done" && status !== "not_vaccinated" && (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => { setMarkingOpen(markKey); setMarkDate(""); }}
                                  className="text-[11px] text-orange-500 hover:text-orange-600 font-medium"
                                >
                                  {t("vaccinations.done")}
                                </button>
                                <span className="text-slate-300 text-[10px]">|</span>
                                <button
                                  onClick={() => notVaccinatedMutation.mutate({ treatmentKey: tx.key, index: i, notVaccinated: true })}
                                  className="text-[11px] text-slate-400 hover:text-orange-600 font-medium"
                                >
                                  {t("vaccinations.notVaccinated")}
                                </button>
                              </div>
                            )}
                            {status === "not_vaccinated" && (
                              <div>
                                <button
                                  onClick={() => notVaccinatedMutation.mutate({ treatmentKey: tx.key, index: i, notVaccinated: false })}
                                  className="text-[11px] text-slate-400 hover:text-red-500 font-medium"
                                >
                                  {t("vaccinations.undo")}
                                </button>
                              </div>
                            )}
                            {status === "done" && entry?.done && (
                              <div>
                                <button
                                  onClick={() => markDoneMutation.mutate({ treatmentKey: tx.key, index: i, doneDate: null })}
                                  className="text-[11px] text-slate-400 hover:text-red-500 font-medium"
                                >
                                  {t("vaccinations.undo")}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Historical Puppy Plan (shown below when dog has both plans) ── */}
      {hasBothPlans && vaccinePlan?.puppies && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-xs font-medium text-petra-muted px-2 py-1 bg-slate-50 rounded-full border border-slate-100">
              {t("vaccinations.puppyArchive")}
            </span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>
          <div className="card overflow-auto p-0 opacity-75">
            <table className="w-full text-sm" dir={cfg.dir}>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-start p-3 font-semibold text-petra-muted w-32 text-xs">{t("vaccinations.colTreatment")}</th>
                  {PUPPY_TREATMENTS.map(tx =>
                    Array.from({ length: tx.doses }, (_, i) => (
                      <th key={`puppy-${tx.key}-${i}`} className="text-center p-3 font-semibold text-petra-muted min-w-[100px] text-xs">
                        {tx.doses === 1 ? tx.label : `${tx.label} ${i + 1}`}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-50 bg-slate-50/30">
                  <td className="p-3 text-xs font-medium text-petra-muted">{t("vaccinations.plannedDate")}</td>
                  {PUPPY_TREATMENTS.map(tx =>
                    Array.from({ length: tx.doses }, (_, i) => {
                      const puppySec = vaccinePlan.puppies as Record<string, Array<{ planned: string | null; done: string | null }>>;
                      const entry = puppySec[tx.key]?.[i] ?? null;
                      return (
                        <td key={`puppy-${tx.key}-${i}-p`} className="p-2 text-center text-xs text-petra-muted">
                          {entry?.planned ? formatPlannedDisplay(entry.planned) : <span className="text-slate-300">—</span>}
                        </td>
                      );
                    })
                  )}
                </tr>
                <tr className="border-b border-slate-50">
                  <td className="p-3 font-medium text-petra-text text-xs">{t("shared.status")}</td>
                  {PUPPY_TREATMENTS.map(tx =>
                    Array.from({ length: tx.doses }, (_, i) => {
                      const puppySec = vaccinePlan.puppies as Record<string, Array<{ planned: string | null; done: string | null }>>;
                      const entry = puppySec[tx.key]?.[i] ?? null;
                      const status = getCellStatus(entry);
                      return (
                        <td key={`puppy-${tx.key}-${i}-s`} className="p-2 text-center">
                          {entry?.done ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg border bg-green-50 text-green-700 border-green-200">
                              ✓ {formatDate(entry.done)}
                            </span>
                          ) : entry?.planned ? (
                            <span className={cn(
                              "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg border",
                              status === "overdue" ? "bg-red-50 text-red-600 border-red-200" :
                              status === "soon" ? "bg-amber-50 text-amber-700 border-amber-200" :
                              "bg-slate-50 text-slate-400 border-slate-200"
                            )}>
                              {t("vaccinations.undo")}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      );
                    })
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
