"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Shield,
  Plus,
  X,
  Dog,
  Heart,
  Clock,
  AlertTriangle,
  CreditCard,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Send,
  Eye,
  QrCode,
  UserCheck,
  Activity,
  Search,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import {
  SERVICE_DOG_PHASES,
  SERVICE_DOG_PHASE_MAP,
  SERVICE_DOG_PHASE_COLORS,
  SERVICE_DOG_TRAINING_STATUSES,
  TRAINING_STATUS_MAP,
  SERVICE_DOG_PLACEMENT_STATUSES,
  PLACEMENT_STATUS_MAP,
  RECIPIENT_STATUSES,
  RECIPIENT_STATUS_MAP,
  DISABILITY_TYPES,
  DISABILITY_TYPE_MAP,
  SERVICE_DOG_TYPES,
  ADI_SKILL_CATEGORIES,
  COMPLIANCE_EVENT_MAP,
  MEDICAL_PROTOCOL_CATEGORIES,
} from "@/lib/service-dogs";

// ─── Types ───

interface ServiceDogProfile {
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
  notes: string | null;
  createdAt: string;
  pet: { id: string; name: string; breed: string | null; species: string };
  medicalCompliance: {
    totalProtocols: number;
    completedCount: number;
    pendingCount: number;
    overdueCount: number;
    compliancePercent: number;
    status: "green" | "amber" | "red";
  };
  activePlacement: { id: string; recipientName: string; status: string } | null;
}

interface ServiceDogDetail extends ServiceDogProfile {
  medicalProtocols: MedicalProtocol[];
  trainingLogs: TrainingLog[];
  complianceEvents: ComplianceEvent[];
  placements: Array<{
    id: string;
    status: string;
    recipient: { id: string; name: string };
  }>;
  idCards: Array<{ id: string; qrToken: string; qrPayload: string; isActive: boolean }>;
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
  notificationSentAt: string | null;
  notificationStatus: string;
  eventAt: string;
}

interface Recipient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  idNumber: string | null;
  disabilityType: string | null;
  status: string;
  waitlistDate: string | null;
  notes: string | null;
  placements: Array<{
    id: string;
    status: string;
    serviceDog: { id: string; pet: { name: string } };
  }>;
}

interface Placement {
  id: string;
  status: string;
  placementDate: string | null;
  trialStartDate: string | null;
  trialEndDate: string | null;
  nextCheckInAt: string | null;
  notes: string | null;
  serviceDog: { id: string; pet: { name: string; breed: string | null } };
  recipient: { id: string; name: string };
}

interface IDCard {
  id: string;
  serviceDogId: string;
  qrToken: string;
  qrPayload: string;
  cardDataJson: string;
  isActive: boolean;
  expiresAt: string | null;
  generatedAt: string;
  serviceDog?: { pet: { name: string } };
}

// ─── Main Page ───

export default function ServiceDogsPage() {
  const [activeTab, setActiveTab] = useState<"dogs" | "recipients" | "placements" | "compliance" | "cards">("dogs");

  const { data: dogs = [] } = useQuery<ServiceDogProfile[]>({
    queryKey: ["service-dogs"],
    queryFn: () => fetch("/api/service-dogs").then((r) => r.json()),
  });

  const { data: recipients = [] } = useQuery<Recipient[]>({
    queryKey: ["service-recipients"],
    queryFn: () => fetch("/api/service-recipients").then((r) => r.json()),
  });

  const { data: placements = [] } = useQuery<Placement[]>({
    queryKey: ["service-placements"],
    queryFn: () => fetch("/api/service-placements").then((r) => r.json()),
  });

  const { data: complianceEvents = [] } = useQuery<ComplianceEvent[]>({
    queryKey: ["service-compliance"],
    queryFn: () => fetch("/api/service-compliance").then((r) => r.json()),
  });

  // Summary stats
  const activeDogs = dogs.filter((d) =>
    ["IN_TRAINING", "ADVANCED_TRAINING", "CERTIFIED"].includes(d.phase)
  ).length;
  const readyForCert = dogs.filter((d) => d.trainingStatus === "PENDING_CERT").length;
  const complianceAlerts = dogs.filter((d) => d.isGovReportPending).length;
  const activePlacements = placements.filter((p) => p.status === "ACTIVE").length;

  const pendingCompliance = complianceEvents.filter(
    (e) => e.notificationStatus === "PENDING"
  ).length;

  const tabs = [
    { id: "dogs" as const, label: "כלבים", icon: Dog },
    { id: "recipients" as const, label: "מקבלים", icon: UserCheck },
    { id: "placements" as const, label: "שיבוצים", icon: Activity },
    { id: "compliance" as const, label: "ציות", icon: AlertTriangle, badge: pendingCompliance },
    { id: "cards" as const, label: "תעודות", icon: CreditCard },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Shield className="w-6 h-6 text-brand-500" />
            כלבי שירות
          </h1>
          <p className="text-sm text-muted-foreground mt-1">ניהול כלבי שירות, מקבלים, שיבוצים וציות</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Dog className="w-4 h-4" />
            כלבי שירות פעילים
          </div>
          <div className="text-2xl font-bold">{activeDogs}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <CheckCircle2 className="w-4 h-4" />
            מוכנים להסמכה
          </div>
          <div className="text-2xl font-bold text-blue-600">{readyForCert}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <AlertTriangle className="w-4 h-4" />
            התראות ציות
          </div>
          <div className={cn("text-2xl font-bold", complianceAlerts > 0 ? "text-red-600" : "text-emerald-600")}>
            {complianceAlerts}
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Activity className="w-4 h-4" />
            שיבוצים פעילים
          </div>
          <div className="text-2xl font-bold">{activePlacements}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b overflow-x-auto">
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
                <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "dogs" && <DogsTab dogs={dogs} />}
      {activeTab === "recipients" && <RecipientsTab recipients={recipients} />}
      {activeTab === "placements" && <PlacementsTab placements={placements} dogs={dogs} recipients={recipients} />}
      {activeTab === "compliance" && <ComplianceTab events={complianceEvents} />}
      {activeTab === "cards" && <CardsTab dogs={dogs} />}
    </div>
  );
}

// ─── Dogs Tab ───

function DogsTab({ dogs }: { dogs: ServiceDogProfile[] }) {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [phaseDropdownId, setPhaseDropdownId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredDogs = dogs.filter((d) =>
    d.pet.name.includes(search) || (d.pet.breed || "").includes(search)
  );

  const phaseChangeMutation = useMutation({
    mutationFn: ({ id, phase }: { id: string; phase: string }) =>
      fetch(`/api/service-dogs/${id}/phase`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
      queryClient.invalidateQueries({ queryKey: ["service-compliance"] });
      setPhaseDropdownId(null);
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="חיפוש כלב..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pr-10 w-full"
          />
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          הוסף כלב שירות
        </button>
      </div>

      {filteredDogs.length === 0 ? (
        <div className="empty-state">
          <Dog className="empty-state-icon" />
          <p className="text-muted-foreground">אין כלבי שירות</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="table-header-cell">שם הכלב</th>
                <th className="table-header-cell">גזע</th>
                <th className="table-header-cell">שלב</th>
                <th className="table-header-cell">שעות אימון</th>
                <th className="table-header-cell">ציות רפואי</th>
                <th className="table-header-cell">מקבל</th>
                <th className="table-header-cell">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filteredDogs.map((dog) => {
                const phaseInfo = SERVICE_DOG_PHASE_MAP[dog.phase];
                const phaseColors = SERVICE_DOG_PHASE_COLORS[dog.phase];
                const hoursPercent = dog.trainingTargetHours > 0
                  ? Math.min(100, Math.round((dog.trainingTotalHours / dog.trainingTargetHours) * 100))
                  : 0;
                const mc = dog.medicalCompliance;

                return (
                  <tr key={dog.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="table-cell font-medium">
                      <button
                        onClick={() => setSelectedDogId(dog.id)}
                        className="hover:text-brand-500 transition-colors text-right"
                      >
                        {dog.pet.name}
                      </button>
                    </td>
                    <td className="table-cell text-muted-foreground">{dog.pet.breed || "—"}</td>
                    <td className="table-cell">
                      <div className="relative">
                        <button
                          onClick={() => setPhaseDropdownId(phaseDropdownId === dog.id ? null : dog.id)}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border"
                          style={{
                            backgroundColor: phaseColors?.bg,
                            color: phaseColors?.text,
                            borderColor: phaseColors?.border,
                          }}
                        >
                          {phaseInfo?.label || dog.phase}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {phaseDropdownId === dog.id && (
                          <div className="absolute z-20 top-full mt-1 right-0 bg-white rounded-lg shadow-lg border py-1 min-w-[160px]">
                            {SERVICE_DOG_PHASES.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => phaseChangeMutation.mutate({ id: dog.id, phase: p.id })}
                                disabled={p.id === dog.phase}
                                className={cn(
                                  "w-full text-right px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors",
                                  p.id === dog.phase && "opacity-50 cursor-default"
                                )}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              hoursPercent >= 100 ? "bg-emerald-500" : hoursPercent >= 50 ? "bg-amber-500" : "bg-red-500"
                            )}
                            style={{ width: `${hoursPercent}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {dog.trainingTotalHours.toFixed(1)}/{dog.trainingTargetHours}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span
                        className={cn(
                          "inline-block w-3 h-3 rounded-full",
                          mc.status === "green" ? "bg-emerald-500" : mc.status === "amber" ? "bg-amber-500" : "bg-red-500"
                        )}
                        title={`${mc.compliancePercent}% — ${mc.completedCount}/${mc.totalProtocols}`}
                      />
                    </td>
                    <td className="table-cell text-muted-foreground text-sm">
                      {dog.activePlacement?.recipientName || "—"}
                    </td>
                    <td className="table-cell">
                      <button
                        onClick={() => setSelectedDogId(dog.id)}
                        className="text-brand-500 hover:text-brand-600 text-sm"
                      >
                        פרטים
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && <AddDogModal onClose={() => setShowAddModal(false)} />}
      {selectedDogId && <DogDetailModal dogId={selectedDogId} onClose={() => setSelectedDogId(null)} />}
    </div>
  );
}

// ─── Add Dog Modal ───

function AddDogModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [petSearch, setPetSearch] = useState("");

  const { data: pets = [] } = useQuery<Array<{ id: string; name: string; breed: string | null; species: string; customerId: string; customer?: { name: string }; serviceDogProfile?: unknown }>>({
    queryKey: ["pets-for-service-dog", petSearch],
    queryFn: () =>
      fetch(`/api/customers?search=${encodeURIComponent(petSearch)}`).then(async (r) => {
        const customers = await r.json();
        const allPets: Array<{ id: string; name: string; breed: string | null; species: string; customerId: string; customer?: { name: string }; serviceDogProfile?: unknown }> = [];
        for (const c of customers) {
          for (const p of (c.pets || [])) {
            allPets.push({ ...p, customer: { name: c.name } });
          }
        }
        return allPets;
      }),
    enabled: petSearch.length >= 1,
  });

  const availablePets = pets.filter((p) => !p.serviceDogProfile);

  const [selectedPetId, setSelectedPetId] = useState("");
  const [phase, setPhase] = useState("SELECTION");
  const [serviceType, setServiceType] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: { petId: string; phase: string; serviceType: string }) =>
      fetch("/api/service-dogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
      onClose();
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">הוסף כלב שירות</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">חיפוש כלב (לפי שם לקוח)</label>
            <input
              type="text"
              value={petSearch}
              onChange={(e) => setPetSearch(e.target.value)}
              placeholder="הקלד שם לקוח..."
              className="input w-full"
            />
            {availablePets.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg">
                {availablePets.map((pet) => (
                  <button
                    key={pet.id}
                    onClick={() => setSelectedPetId(pet.id)}
                    className={cn(
                      "w-full text-right px-3 py-2 text-sm hover:bg-muted/50 transition-colors border-b last:border-b-0",
                      selectedPetId === pet.id && "bg-brand-50 text-brand-600"
                    )}
                  >
                    {pet.name} ({pet.breed || pet.species}) — {pet.customer?.name}
                  </button>
                ))}
              </div>
            )}
            {selectedPetId && (
              <p className="mt-1 text-sm text-emerald-600">
                נבחר: {pets.find((p) => p.id === selectedPetId)?.name}
              </p>
            )}
          </div>

          <div>
            <label className="label">שלב התחלתי</label>
            <select value={phase} onChange={(e) => setPhase(e.target.value)} className="input w-full">
              {SERVICE_DOG_PHASES.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">סוג שירות</label>
            <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="input w-full">
              <option value="">לא נבחר</option>
              {SERVICE_DOG_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => createMutation.mutate({ petId: selectedPetId, phase, serviceType })}
              disabled={!selectedPetId || createMutation.isPending}
              className="btn-primary flex-1"
            >
              {createMutation.isPending ? "יוצר..." : "צור פרופיל"}
            </button>
            <button onClick={onClose} className="btn-secondary flex-1">ביטול</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dog Detail Modal ───

function DogDetailModal({ dogId, onClose }: { dogId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<"medical" | "training" | "compliance">("medical");
  const [showTrainingForm, setShowTrainingForm] = useState(false);

  const { data: dog } = useQuery<ServiceDogDetail>({
    queryKey: ["service-dog-detail", dogId],
    queryFn: () => fetch(`/api/service-dogs/${dogId}`).then((r) => r.json()),
  });

  const markProtocolMutation = useMutation({
    mutationFn: ({ protocolId }: { protocolId: string }) =>
      fetch(`/api/service-dogs/${dogId}/medical`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocolId, status: "COMPLETED", completedDate: new Date().toISOString() }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
    },
  });

  if (!dog) return null;

  const subTabs = [
    { id: "medical" as const, label: "מדיקל", icon: Heart },
    { id: "training" as const, label: "אימונים", icon: Clock },
    { id: "compliance" as const, label: "ציות", icon: AlertTriangle },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">{dog.pet.name}</h2>
            <p className="text-sm text-muted-foreground">{dog.pet.breed || dog.pet.species} • {SERVICE_DOG_PHASE_MAP[dog.phase]?.label}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1 mb-4 border-b">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                  subTab === tab.id
                    ? "border-brand-500 text-brand-600"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Medical sub-tab */}
        {subTab === "medical" && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-3 p-3 rounded-lg bg-muted/30">
              <span className={cn(
                "inline-block w-3 h-3 rounded-full",
                dog.medicalCompliance.status === "green" ? "bg-emerald-500" :
                dog.medicalCompliance.status === "amber" ? "bg-amber-500" : "bg-red-500"
              )} />
              <span className="text-sm font-medium">
                {dog.medicalCompliance.compliancePercent}% ציות — {dog.medicalCompliance.completedCount}/{dog.medicalCompliance.totalProtocols} בוצע
              </span>
              {dog.medicalCompliance.overdueCount > 0 && (
                <span className="text-xs text-red-600 font-medium">
                  ({dog.medicalCompliance.overdueCount} באיחור)
                </span>
              )}
            </div>

            {dog.medicalProtocols.map((protocol) => (
              <div key={protocol.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">{protocol.protocolLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {MEDICAL_PROTOCOL_CATEGORIES.find((c) => c.id === protocol.category)?.label || protocol.category}
                    {protocol.dueDate && ` • יעד: ${formatDate(protocol.dueDate)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {protocol.status === "COMPLETED" ? (
                    <span className="badge-success text-xs">בוצע</span>
                  ) : protocol.status === "OVERDUE" ? (
                    <span className="badge-danger text-xs">באיחור</span>
                  ) : (
                    <button
                      onClick={() => markProtocolMutation.mutate({ protocolId: protocol.id })}
                      disabled={markProtocolMutation.isPending}
                      className="btn-primary text-xs py-1 px-2"
                    >
                      סמן כבוצע
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Training sub-tab */}
        {subTab === "training" && (
          <div>
            {/* Progress */}
            {dog.trainingProgress && (
              <div className="mb-4 p-4 rounded-lg bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">התקדמות ADI</span>
                  <span className="text-sm text-muted-foreground">
                    {dog.trainingProgress.totalHours.toFixed(1)} / {dog.trainingProgress.targetHours} שעות
                  </span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden mb-2">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      dog.trainingProgress.percentComplete >= 100 ? "bg-emerald-500" :
                      dog.trainingProgress.percentComplete >= 50 ? "bg-blue-500" : "bg-amber-500"
                    )}
                    style={{ width: `${dog.trainingProgress.percentComplete}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{dog.trainingProgress.monthsElapsed} חודשים עברו מתוך {dog.trainingProgress.targetMonths}</span>
                  <span>{dog.trainingProgress.percentComplete}%</span>
                </div>
                {dog.trainingProgress.isReadyForCertification && (
                  <div className="mt-2 text-sm text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    מוכן להסמכה!
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">מפגשי אימון</span>
              <button onClick={() => setShowTrainingForm(!showTrainingForm)} className="btn-primary text-xs py-1 px-2 flex items-center gap-1">
                <Plus className="w-3 h-3" />
                הוסף מפגש
              </button>
            </div>

            {showTrainingForm && (
              <AddTrainingForm
                dogId={dogId}
                onDone={() => {
                  setShowTrainingForm(false);
                  queryClient.invalidateQueries({ queryKey: ["service-dog-detail", dogId] });
                  queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
                }}
              />
            )}

            <div className="space-y-2">
              {dog.trainingLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{formatDate(log.sessionDate)}</span>
                    <span className="text-xs text-muted-foreground">{log.durationMinutes} דקות</span>
                  </div>
                  {log.trainerName && <p className="text-xs text-muted-foreground">מאמן: {log.trainerName}</p>}
                  {log.notes && <p className="text-xs text-muted-foreground mt-1">{log.notes}</p>}
                  {log.rating && (
                    <div className="mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={cn("text-sm", i < log.rating! ? "text-amber-400" : "text-muted-foreground/30")}>★</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {dog.trainingLogs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">אין מפגשי אימון</p>
              )}
            </div>
          </div>
        )}

        {/* Compliance sub-tab */}
        {subTab === "compliance" && (
          <div className="space-y-2">
            {dog.complianceEvents.map((event) => (
              <div key={event.id} className="p-3 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {COMPLIANCE_EVENT_MAP[event.eventType]?.label || event.eventType}
                  </span>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    event.notificationStatus === "PENDING" ? "bg-red-100 text-red-600" :
                    event.notificationStatus === "SENT" ? "bg-emerald-100 text-emerald-700" :
                    "bg-slate-100 text-slate-600"
                  )}>
                    {event.notificationStatus === "PENDING" ? "ממתין" :
                     event.notificationStatus === "SENT" ? "נשלח" :
                     event.notificationStatus === "NOT_REQUIRED" ? "לא נדרש" : event.notificationStatus}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{event.eventDescription}</p>
                <p className="text-xs text-muted-foreground">{formatDate(event.eventAt)}</p>
                {event.notificationDue && event.notificationStatus === "PENDING" && (
                  <p className="text-xs text-red-500 mt-1">
                    דד-ליין: {formatDate(event.notificationDue)}
                  </p>
                )}
              </div>
            ))}
            {dog.complianceEvents.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">אין אירועי ציות</p>
            )}
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
  const [rating, setRating] = useState<number | null>(null);
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
    onSuccess: () => onDone(),
  });

  return (
    <div className="p-4 rounded-lg border bg-muted/20 mb-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">תאריך</label>
          <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} className="input w-full" />
        </div>
        <div>
          <label className="label">משך (דקות)</label>
          <input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="input w-full" min={1} />
        </div>
        <div>
          <label className="label">מאמן</label>
          <input type="text" value={trainerName} onChange={(e) => setTrainerName(e.target.value)} className="input w-full" />
        </div>
        <div>
          <label className="label">מיקום</label>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="input w-full" />
        </div>
      </div>

      <div>
        <label className="label">כישורים</label>
        <div className="flex flex-wrap gap-1.5">
          {ADI_SKILL_CATEGORIES.map((skill) => (
            <button
              key={skill.id}
              onClick={() => setSelectedSkills((prev) =>
                prev.includes(skill.id) ? prev.filter((s) => s !== skill.id) : [...prev, skill.id]
              )}
              className={cn(
                "text-xs px-2 py-1 rounded-full border transition-colors",
                selectedSkills.includes(skill.id)
                  ? "bg-brand-50 text-brand-600 border-brand-200"
                  : "bg-white text-muted-foreground hover:bg-muted/50"
              )}
            >
              {skill.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">דירוג</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              onClick={() => setRating(r)}
              className={cn("text-xl", r <= (rating || 0) ? "text-amber-400" : "text-muted-foreground/30")}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">הערות</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input w-full" rows={2} />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => createMutation.mutate({
            sessionDate,
            durationMinutes,
            trainerName,
            location,
            skillCategories: selectedSkills,
            notes,
            rating,
          })}
          disabled={createMutation.isPending}
          className="btn-primary text-sm"
        >
          {createMutation.isPending ? "שומר..." : "שמור מפגש"}
        </button>
        <button onClick={onDone} className="btn-secondary text-sm">ביטול</button>
      </div>
    </div>
  );
}

// ─── Recipients Tab ───

function RecipientsTab({ recipients }: { recipients: Recipient[] }) {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = statusFilter
    ? recipients.filter((r) => r.status === statusFilter)
    : recipients;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button onClick={() => setStatusFilter("")} className={cn("text-sm px-3 py-1.5 rounded-lg", !statusFilter ? "bg-brand-50 text-brand-600" : "text-muted-foreground hover:bg-muted/50")}>הכל</button>
          {RECIPIENT_STATUSES.map((s) => (
            <button key={s.id} onClick={() => setStatusFilter(s.id)} className={cn("text-sm px-3 py-1.5 rounded-lg", statusFilter === s.id ? "bg-brand-50 text-brand-600" : "text-muted-foreground hover:bg-muted/50")}>
              {s.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          הוסף מקבל
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <UserCheck className="empty-state-icon" />
          <p className="text-muted-foreground">אין מקבלים</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="table-header-cell">שם</th>
                <th className="table-header-cell">טלפון</th>
                <th className="table-header-cell">סוג לקות</th>
                <th className="table-header-cell">סטטוס</th>
                <th className="table-header-cell">כלב משובץ</th>
                <th className="table-header-cell">תאריך רשימה</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((recipient) => {
                const statusInfo = RECIPIENT_STATUS_MAP[recipient.status];
                const activePlacement = recipient.placements?.find((p) => ["ACTIVE", "TRIAL"].includes(p.status));
                return (
                  <tr key={recipient.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="table-cell font-medium">{recipient.name}</td>
                    <td className="table-cell text-muted-foreground">{recipient.phone || "—"}</td>
                    <td className="table-cell text-muted-foreground">{DISABILITY_TYPE_MAP[recipient.disabilityType || ""] || "—"}</td>
                    <td className="table-cell">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", statusInfo?.color)}>
                        {statusInfo?.label || recipient.status}
                      </span>
                    </td>
                    <td className="table-cell text-muted-foreground">{activePlacement?.serviceDog.pet.name || "—"}</td>
                    <td className="table-cell text-muted-foreground text-sm">
                      {recipient.waitlistDate ? formatDate(recipient.waitlistDate) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && <AddRecipientModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}

// ─── Add Recipient Modal ───

function AddRecipientModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [address, setAddress] = useState("");
  const [disabilityType, setDisabilityType] = useState("");
  const [notes, setNotes] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch("/api/service-recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-recipients"] });
      onClose();
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">הוסף מקבל</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">שם *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">טלפון</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="label">אימייל</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">ת.ז.</label>
              <input type="text" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="label">סוג לקות</label>
              <select value={disabilityType} onChange={(e) => setDisabilityType(e.target.value)} className="input w-full">
                <option value="">לא נבחר</option>
                {DISABILITY_TYPES.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">כתובת</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="label">הערות</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input w-full" rows={2} />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => createMutation.mutate({ name, phone, email, idNumber, address, disabilityType, notes })}
              disabled={!name || createMutation.isPending}
              className="btn-primary flex-1"
            >
              {createMutation.isPending ? "יוצר..." : "הוסף מקבל"}
            </button>
            <button onClick={onClose} className="btn-secondary flex-1">ביטול</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Placements Tab ───

function PlacementsTab({ placements, dogs, recipients }: { placements: Placement[]; dogs: ServiceDogProfile[]; recipients: Recipient[] }) {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);

  const statusChangeMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/service-placements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-placements"] });
      queryClient.invalidateQueries({ queryKey: ["service-recipients"] });
      queryClient.invalidateQueries({ queryKey: ["service-compliance"] });
    },
  });

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          שיבוץ חדש
        </button>
      </div>

      {placements.length === 0 ? (
        <div className="empty-state">
          <Activity className="empty-state-icon" />
          <p className="text-muted-foreground">אין שיבוצים</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="table-header-cell">כלב</th>
                <th className="table-header-cell">מקבל</th>
                <th className="table-header-cell">סטטוס</th>
                <th className="table-header-cell">תאריך שיבוץ</th>
                <th className="table-header-cell">ניסיון עד</th>
                <th className="table-header-cell">בדיקה הבאה</th>
                <th className="table-header-cell">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {placements.map((placement) => {
                const statusInfo = PLACEMENT_STATUS_MAP[placement.status];
                return (
                  <tr key={placement.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="table-cell font-medium">{placement.serviceDog.pet.name}</td>
                    <td className="table-cell">{placement.recipient.name}</td>
                    <td className="table-cell">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", statusInfo?.color)}>
                        {statusInfo?.label || placement.status}
                      </span>
                    </td>
                    <td className="table-cell text-muted-foreground text-sm">
                      {placement.placementDate ? formatDate(placement.placementDate) : "—"}
                    </td>
                    <td className="table-cell text-muted-foreground text-sm">
                      {placement.trialEndDate ? formatDate(placement.trialEndDate) : "—"}
                    </td>
                    <td className="table-cell text-muted-foreground text-sm">
                      {placement.nextCheckInAt ? formatDate(placement.nextCheckInAt) : "—"}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        {placement.status === "PENDING" && (
                          <button
                            onClick={() => statusChangeMutation.mutate({ id: placement.id, status: "TRIAL" })}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            התחל ניסיון
                          </button>
                        )}
                        {placement.status === "TRIAL" && (
                          <button
                            onClick={() => statusChangeMutation.mutate({ id: placement.id, status: "ACTIVE" })}
                            className="text-xs text-emerald-600 hover:text-emerald-700"
                          >
                            אשר שיבוץ
                          </button>
                        )}
                        {["PENDING", "TRIAL", "ACTIVE"].includes(placement.status) && (
                          <button
                            onClick={() => statusChangeMutation.mutate({ id: placement.id, status: "TERMINATED" })}
                            className="text-xs text-red-600 hover:text-red-700 mr-2"
                          >
                            סיום
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && <AddPlacementModal dogs={dogs} recipients={recipients} onClose={() => setShowAddModal(false)} />}
    </div>
  );
}

// ─── Add Placement Modal ───

function AddPlacementModal({ dogs, recipients, onClose }: { dogs: ServiceDogProfile[]; recipients: Recipient[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [serviceDogId, setServiceDogId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [placementDate, setPlacementDate] = useState(new Date().toISOString().split("T")[0]);
  const [trialEndDate, setTrialEndDate] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch("/api/service-placements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-placements"] });
      queryClient.invalidateQueries({ queryKey: ["service-recipients"] });
      queryClient.invalidateQueries({ queryKey: ["service-compliance"] });
      onClose();
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">שיבוץ חדש</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">כלב שירות</label>
            <select value={serviceDogId} onChange={(e) => setServiceDogId(e.target.value)} className="input w-full">
              <option value="">בחר כלב...</option>
              {dogs.map((d) => (
                <option key={d.id} value={d.id}>{d.pet.name} — {SERVICE_DOG_PHASE_MAP[d.phase]?.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">מקבל</label>
            <select value={recipientId} onChange={(e) => setRecipientId(e.target.value)} className="input w-full">
              <option value="">בחר מקבל...</option>
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>{r.name}{r.disabilityType ? ` — ${DISABILITY_TYPE_MAP[r.disabilityType]}` : ""}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תאריך שיבוץ</label>
              <input type="date" value={placementDate} onChange={(e) => setPlacementDate(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="label">סיום ניסיון</label>
              <input type="date" value={trialEndDate} onChange={(e) => setTrialEndDate(e.target.value)} className="input w-full" />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => createMutation.mutate({
                serviceDogId,
                recipientId,
                placementDate,
                trialEndDate: trialEndDate || null,
              })}
              disabled={!serviceDogId || !recipientId || createMutation.isPending}
              className="btn-primary flex-1"
            >
              {createMutation.isPending ? "יוצר..." : "צור שיבוץ"}
            </button>
            <button onClick={onClose} className="btn-secondary flex-1">ביטול</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Compliance Tab ───

function ComplianceTab({ events }: { events: ComplianceEvent[] }) {
  const queryClient = useQueryClient();

  const now = new Date();
  const overdue = events.filter((e) => e.notificationStatus === "PENDING" && e.notificationDue && new Date(e.notificationDue) < now);
  const pending = events.filter((e) => e.notificationStatus === "PENDING" && (!e.notificationDue || new Date(e.notificationDue) >= now));
  const sent = events.filter((e) => e.notificationStatus === "SENT");
  const other = events.filter((e) => !["PENDING", "SENT"].includes(e.notificationStatus));

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
      queryClient.invalidateQueries({ queryKey: ["service-compliance"] });
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
    },
  });

  const renderGroup = (title: string, items: ComplianceEvent[], color: string) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className={cn("text-sm font-bold mb-2", color)}>{title} ({items.length})</h3>
        <div className="space-y-2">
          {items.map((event) => (
            <div key={event.id} className="p-3 rounded-lg border flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {COMPLIANCE_EVENT_MAP[event.eventType]?.label || event.eventType}
                </p>
                <p className="text-xs text-muted-foreground">{event.eventDescription}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(event.eventAt)}
                  {event.notificationDue && ` • דד-ליין: ${formatDate(event.notificationDue)}`}
                </p>
              </div>
              {event.notificationStatus === "PENDING" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => markMutation.mutate({ id: event.id, notificationStatus: "SENT" })}
                    className="btn-primary text-xs py-1 px-2 flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" />
                    סמן כנשלח
                  </button>
                  <button
                    onClick={() => markMutation.mutate({ id: event.id, notificationStatus: "WAIVED" })}
                    className="btn-ghost text-xs py-1 px-2"
                  >
                    ויתור
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {events.length === 0 ? (
        <div className="empty-state">
          <AlertTriangle className="empty-state-icon" />
          <p className="text-muted-foreground">אין אירועי ציות</p>
        </div>
      ) : (
        <>
          {renderGroup("באיחור", overdue, "text-red-600")}
          {renderGroup("ממתינים (בתוך 48 שעות)", pending, "text-amber-600")}
          {renderGroup("נשלחו", sent, "text-emerald-600")}
          {renderGroup("אחר", other, "text-muted-foreground")}
        </>
      )}
    </div>
  );
}

// ─── Cards Tab ───

function CardsTab({ dogs }: { dogs: ServiceDogProfile[] }) {
  const queryClient = useQueryClient();
  const [selectedCard, setSelectedCard] = useState<IDCard | null>(null);

  const dogsWithCards = dogs.filter((d) => d.idCardIsActive);
  const dogsWithoutCards = dogs.filter((d) => !d.idCardIsActive && d.phase === "CERTIFIED");

  const generateMutation = useMutation({
    mutationFn: (dogId: string) =>
      fetch(`/api/service-dogs/${dogId}/id-card`, {
        method: "POST",
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
    },
  });

  const fetchCard = async (dogId: string) => {
    const res = await fetch(`/api/service-dogs/${dogId}/id-card`);
    if (res.ok) {
      const card = await res.json();
      setSelectedCard(card);
    }
  };

  return (
    <div>
      {dogsWithoutCards.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold mb-2">כלבים מוסמכים ללא תעודה</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {dogsWithoutCards.map((dog) => (
              <div key={dog.id} className="card-hover p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{dog.pet.name}</p>
                  <p className="text-xs text-muted-foreground">{dog.pet.breed || dog.pet.species}</p>
                </div>
                <button
                  onClick={() => generateMutation.mutate(dog.id)}
                  disabled={generateMutation.isPending}
                  className="btn-primary text-xs py-1 px-3 flex items-center gap-1"
                >
                  <QrCode className="w-3 h-3" />
                  הנפק תעודה
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 className="text-sm font-bold mb-2">תעודות פעילות</h3>
      {dogsWithCards.length === 0 ? (
        <div className="empty-state">
          <CreditCard className="empty-state-icon" />
          <p className="text-muted-foreground">אין תעודות פעילות</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {dogsWithCards.map((dog) => (
            <div key={dog.id} className="card-hover p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">{dog.pet.name}</p>
                <span className="badge-success text-xs">פעיל</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{dog.pet.breed || dog.pet.species}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchCard(dog.id)}
                  className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  צפה
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Card Modal */}
      {selectedCard && (
        <div className="modal-overlay" onClick={() => setSelectedCard(null)}>
          <div className="modal-backdrop" />
          <div className="modal-content max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">תעודת כלב שירות</h2>
              <button onClick={() => setSelectedCard(null)} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>

            {selectedCard.qrPayload && (
              <div className="mb-4">
                <img src={selectedCard.qrPayload} alt="QR Code" className="mx-auto w-48 h-48" />
              </div>
            )}

            {(() => {
              const data = JSON.parse(selectedCard.cardDataJson || "{}");
              return (
                <div className="text-right space-y-1 text-sm">
                  <p><strong>כלב:</strong> {data.dogName}</p>
                  <p><strong>גזע:</strong> {data.breed || "—"}</p>
                  {data.registrationNumber && <p><strong>מספר רישום:</strong> {data.registrationNumber}</p>}
                  {data.certifyingBody && <p><strong>גוף מסמיך:</strong> {data.certifyingBody}</p>}
                  {data.recipientName && <p><strong>מקבל:</strong> {data.recipientName}</p>}
                  {data.certificationDate && <p><strong>תאריך הסמכה:</strong> {formatDate(data.certificationDate)}</p>}
                </div>
              );
            })()}

            <div className="mt-4">
              <button onClick={() => window.print()} className="btn-primary w-full">הדפס</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
