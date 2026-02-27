"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Dog,
  Plus,
  X,
  Search,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SERVICE_DOG_PHASES,
  SERVICE_DOG_PHASE_MAP,
  SERVICE_DOG_PHASE_COLORS,
  SERVICE_DOG_TYPES,
} from "@/lib/service-dogs";
import { toast } from "sonner";

interface ServiceDogCard {
  id: string;
  phase: string;
  serviceType: string | null;
  trainingTotalHours: number;
  trainingTargetHours: number;
  trainingStatus: string;
  isGovReportPending: boolean;
  pet: { id: string; name: string; breed: string | null; species: string };
  medicalCompliance: {
    completedCount: number;
    totalProtocols: number;
    overdueCount: number;
    compliancePercent: number;
    status: "green" | "amber" | "red";
  };
  activePlacement: { id: string; recipientName: string; status: string } | null;
}

const TRAINING_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NOT_STARTED: { label: "טרם החל", color: "bg-slate-100 text-slate-600" },
  IN_PROGRESS: { label: "בתהליך", color: "bg-blue-100 text-blue-700" },
  PENDING_CERT: { label: "ממתין להסמכה", color: "bg-amber-100 text-amber-700" },
  CERTIFIED: { label: "הוסמך", color: "bg-emerald-100 text-emerald-700" },
  FAILED: { label: "לא עבר", color: "bg-red-100 text-red-600" },
};

export default function ServiceDogsListPage() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState(searchParams.get("phase") || "");
  const [showAddModal, setShowAddModal] = useState(false);
  const [phaseDropdownId, setPhaseDropdownId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: dogs = [], isLoading } = useQuery<ServiceDogCard[]>({
    queryKey: ["service-dogs"],
    queryFn: () => fetch("/api/service-dogs").then((r) => r.json()),
  });

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
      setPhaseDropdownId(null);
      toast.success("שלב עודכן בהצלחה");
    },
    onError: () => toast.error("שגיאה בעדכון השלב"),
  });

  const filteredDogs = dogs.filter((d) => {
    const matchSearch =
      !search ||
      d.pet.name.includes(search) ||
      (d.pet.breed || "").includes(search);
    const matchPhase = !phaseFilter || d.phase === phaseFilter;
    return matchSearch && matchPhase;
  });

  const phaseCounts = SERVICE_DOG_PHASES.reduce(
    (acc, p) => ({ ...acc, [p.id]: dogs.filter((d) => d.phase === p.id).length }),
    {} as Record<string, number>
  );

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 text-sm text-petra-muted mb-1">
            <Link href="/service-dogs" className="hover:text-foreground transition-colors">
              כלבי שירות
            </Link>
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>כלבים</span>
          </div>
          <h1 className="page-title flex items-center gap-2">
            <Dog className="w-6 h-6 text-brand-500" />
            ניהול כלבים
          </h1>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          הוסף כלב שירות
        </button>
      </div>

      {/* Phase Filter */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          onClick={() => setPhaseFilter("")}
          className={cn(
            "text-sm px-3 py-1.5 rounded-lg font-medium transition-colors",
            !phaseFilter
              ? "bg-slate-800 text-white"
              : "text-petra-muted hover:bg-slate-50"
          )}
        >
          הכל ({dogs.length})
        </button>
        {SERVICE_DOG_PHASES.map((p) => {
          const colors = SERVICE_DOG_PHASE_COLORS[p.id];
          const count = phaseCounts[p.id] || 0;
          if (count === 0) return null;
          return (
            <button
              key={p.id}
              onClick={() => setPhaseFilter(phaseFilter === p.id ? "" : p.id)}
              className={cn(
                "text-sm px-3 py-1.5 rounded-lg font-medium border transition-all",
                phaseFilter === p.id
                  ? "shadow-sm"
                  : "hover:shadow-sm opacity-70 hover:opacity-100"
              )}
              style={{
                backgroundColor: phaseFilter === p.id ? colors?.bg : "white",
                color: colors?.text,
                borderColor: phaseFilter === p.id ? colors?.border : "#E2E8F0",
              }}
            >
              {p.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted" />
        <input
          type="text"
          placeholder="חיפוש לפי שם או גזע..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pr-10 w-full"
        />
      </div>

      {/* Dogs Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-52" />
          ))}
        </div>
      ) : filteredDogs.length === 0 ? (
        <div className="empty-state">
          <Dog className="empty-state-icon" />
          <p className="text-petra-muted">
            {phaseFilter || search ? "לא נמצאו כלבים התואמים לחיפוש" : "אין כלבי שירות"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDogs.map((dog) => {
            const phaseInfo = SERVICE_DOG_PHASE_MAP[dog.phase];
            const phaseColors = SERVICE_DOG_PHASE_COLORS[dog.phase];
            const hoursPercent =
              dog.trainingTargetHours > 0
                ? Math.min(100, Math.round((dog.trainingTotalHours / dog.trainingTargetHours) * 100))
                : 0;
            const mc = dog.medicalCompliance;
            const trainingStatusInfo = TRAINING_STATUS_LABELS[dog.trainingStatus];

            return (
              <div
                key={dog.id}
                className="card p-0 overflow-hidden hover:shadow-md transition-all"
              >
                {/* Card Header */}
                <div
                  className="px-4 py-3 border-b"
                  style={{ backgroundColor: phaseColors?.bg || "#F8FAFC" }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base leading-tight">{dog.pet.name}</h3>
                      <p className="text-xs text-petra-muted mt-0.5">
                        {dog.pet.breed || dog.pet.species}
                      </p>
                    </div>
                    {/* Phase change dropdown */}
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() =>
                          setPhaseDropdownId(phaseDropdownId === dog.id ? null : dog.id)
                        }
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-all hover:shadow-sm"
                        style={{
                          backgroundColor: "white",
                          color: phaseColors?.text,
                          borderColor: phaseColors?.border,
                        }}
                      >
                        {phaseInfo?.label || dog.phase}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {phaseDropdownId === dog.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setPhaseDropdownId(null)}
                          />
                          <div className="absolute z-20 top-full mt-1 left-0 bg-white rounded-xl shadow-lg border py-1 min-w-[160px]">
                            {SERVICE_DOG_PHASES.map((p) => (
                              <button
                                key={p.id}
                                onClick={() =>
                                  phaseChangeMutation.mutate({ id: dog.id, phase: p.id })
                                }
                                disabled={p.id === dog.phase || phaseChangeMutation.isPending}
                                className={cn(
                                  "w-full text-right px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors",
                                  p.id === dog.phase && "opacity-40 cursor-default"
                                )}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Alert badges */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {dog.isGovReportPending && (
                      <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                        <AlertTriangle className="w-3 h-3" /> דיווח ממתין
                      </span>
                    )}
                    {dog.trainingStatus === "PENDING_CERT" && (
                      <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                        <CheckCircle2 className="w-3 h-3" /> מוכן להסמכה
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="px-4 py-3 space-y-3">
                  {/* Training progress */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-petra-muted flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        שעות אימון
                      </span>
                      <span className="font-medium">
                        {dog.trainingTotalHours.toFixed(0)}/{dog.trainingTargetHours}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          hoursPercent >= 100
                            ? "bg-emerald-500"
                            : hoursPercent >= 50
                            ? "bg-blue-500"
                            : "bg-amber-500"
                        )}
                        style={{ width: `${hoursPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-petra-muted">{hoursPercent}%</span>
                      <span
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded-full",
                          trainingStatusInfo?.color || "bg-slate-100 text-slate-600"
                        )}
                      >
                        {trainingStatusInfo?.label || dog.trainingStatus}
                      </span>
                    </div>
                  </div>

                  {/* Medical compliance */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-petra-muted flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      משמעת רפואית
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-block w-2.5 h-2.5 rounded-full",
                          mc.status === "green"
                            ? "bg-emerald-500"
                            : mc.status === "amber"
                            ? "bg-amber-500"
                            : "bg-red-500"
                        )}
                      />
                      <span
                        className={cn(
                          "font-medium",
                          mc.status === "green"
                            ? "text-emerald-700"
                            : mc.status === "amber"
                            ? "text-amber-700"
                            : "text-red-700"
                        )}
                      >
                        {mc.compliancePercent}%
                      </span>
                      {mc.overdueCount > 0 && (
                        <span className="text-red-500">({mc.overdueCount} באיחור)</span>
                      )}
                    </div>
                  </div>

                  {/* Recipient */}
                  {dog.activePlacement && (
                    <div className="text-xs text-petra-muted flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      מקבל: {dog.activePlacement.recipientName}
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="px-4 py-2.5 border-t bg-slate-50/40">
                  <Link
                    href={`/service-dogs/${dog.id}`}
                    className="text-sm text-brand-500 hover:text-brand-600 font-medium flex items-center justify-center gap-1 w-full"
                  >
                    צפה בפרופיל
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && <AddDogModal dogs={dogs} onClose={() => setShowAddModal(false)} />}
    </div>
  );
}

// ─── Add Dog Modal ───

function AddDogModal({ dogs, onClose }: { dogs: ServiceDogCard[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [petSearch, setPetSearch] = useState("");
  const [selectedPetId, setSelectedPetId] = useState("");
  const [selectedPetName, setSelectedPetName] = useState("");
  const [phase, setPhase] = useState("SELECTION");
  const [serviceType, setServiceType] = useState("");
  const [notes, setNotes] = useState("");

  const existingPetIds = new Set(dogs.map((d) => d.pet.id));

  const { data: customers = [] } = useQuery<
    Array<{ id: string; name: string; pets: Array<{ id: string; name: string; breed: string | null; species: string }> }>
  >({
    queryKey: ["customers-pet-search", petSearch],
    queryFn: () =>
      fetch(`/api/customers?enhanced=1&search=${encodeURIComponent(petSearch)}`).then((r) =>
        r.json()
      ),
    enabled: petSearch.length >= 1,
  });

  const availablePets = customers.flatMap((c) =>
    (c.pets || [])
      .filter((p) => !existingPetIds.has(p.id))
      .map((p) => ({ ...p, customerName: c.name }))
  );

  const createMutation = useMutation({
    mutationFn: (data: { petId: string; phase: string; serviceType: string; notes: string }) =>
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
      toast.success("פרופיל כלב שירות נוצר בהצלחה");
      onClose();
    },
    onError: () => toast.error("שגיאה ביצירת פרופיל"),
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">הוסף כלב שירות חדש</h2>
          <button onClick={onClose} className="btn-ghost p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Pet search */}
          <div>
            <label className="label">חיפוש כלב (לפי שם לקוח) *</label>
            <input
              type="text"
              value={petSearch}
              onChange={(e) => {
                setPetSearch(e.target.value);
                setSelectedPetId("");
                setSelectedPetName("");
              }}
              placeholder="הקלד שם לקוח..."
              className="input w-full"
            />
            {availablePets.length > 0 && !selectedPetId && (
              <div className="mt-2 max-h-40 overflow-y-auto border rounded-xl shadow-sm">
                {availablePets.map((pet) => (
                  <button
                    key={pet.id}
                    onClick={() => {
                      setSelectedPetId(pet.id);
                      setSelectedPetName(`${pet.name} (${pet.breed || pet.species}) — ${pet.customerName}`);
                    }}
                    className="w-full text-right px-3 py-2.5 text-sm hover:bg-slate-50 transition-colors border-b last:border-b-0"
                  >
                    <span className="font-medium">{pet.name}</span>
                    <span className="text-petra-muted"> · {pet.breed || pet.species} · {pet.customerName}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedPetId && (
              <div className="mt-2 flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <span className="text-sm text-emerald-700 font-medium">{selectedPetName}</span>
                <button
                  onClick={() => { setSelectedPetId(""); setSelectedPetName(""); }}
                  className="text-emerald-600 hover:text-emerald-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Phase */}
          <div>
            <label className="label">שלב התחלתי</label>
            <select value={phase} onChange={(e) => setPhase(e.target.value)} className="input w-full">
              {SERVICE_DOG_PHASES.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Service type */}
          <div>
            <label className="label">סוג שירות</label>
            <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="input w-full">
              <option value="">לא נבחר</option>
              {SERVICE_DOG_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="label">הערות</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input w-full" rows={2} />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => createMutation.mutate({ petId: selectedPetId, phase, serviceType, notes })}
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
