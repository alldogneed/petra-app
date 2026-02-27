"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  Plus,
  X,
  ChevronLeft,
  Dog,
  UserCheck,
  Calendar,
  ArrowLeft,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import {
  PLACEMENT_STATUS_MAP,
  SERVICE_DOG_PLACEMENT_STATUSES,
  SERVICE_DOG_PHASE_MAP,
  DISABILITY_TYPE_MAP,
} from "@/lib/service-dogs";
import { toast } from "sonner";

interface Placement {
  id: string;
  status: string;
  placementDate: string | null;
  trialStartDate: string | null;
  trialEndDate: string | null;
  nextCheckInAt: string | null;
  notes: string | null;
  serviceDog: {
    id: string;
    phase: string;
    pet: { name: string; breed: string | null };
  };
  recipient: {
    id: string;
    name: string;
    phone: string | null;
    disabilityType: string | null;
  };
}

interface ServiceDogOption {
  id: string;
  phase: string;
  pet: { name: string; breed: string | null };
}

interface RecipientOption {
  id: string;
  name: string;
  disabilityType: string | null;
  status: string;
}

export default function PlacementsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: placements = [], isLoading } = useQuery<Placement[]>({
    queryKey: ["service-placements"],
    queryFn: () => fetch("/api/service-placements").then((r) => r.json()),
  });

  const { data: dogs = [] } = useQuery<ServiceDogOption[]>({
    queryKey: ["service-dogs"],
    queryFn: () => fetch("/api/service-dogs").then((r) => r.json()),
  });

  const { data: recipients = [] } = useQuery<RecipientOption[]>({
    queryKey: ["service-recipients"],
    queryFn: () => fetch("/api/service-recipients").then((r) => r.json()),
  });

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
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
      toast.success("סטטוס שיבוץ עודכן");
    },
    onError: () => toast.error("שגיאה בעדכון סטטוס"),
  });

  const filtered = statusFilter
    ? placements.filter((p) => p.status === statusFilter)
    : placements;

  const statusCounts = SERVICE_DOG_PLACEMENT_STATUSES.reduce(
    (acc, s) => ({ ...acc, [s.id]: placements.filter((p) => p.status === s.id).length }),
    {} as Record<string, number>
  );

  // Active placements (kanban-like view)
  const activePlacements = placements.filter((p) => p.status === "ACTIVE");
  const trialPlacements = placements.filter((p) => p.status === "TRIAL");

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/service-dogs" className="hover:text-foreground">כלבי שירות</Link>
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>שיבוצים</span>
          </div>
          <h1 className="page-title flex items-center gap-2">
            <Activity className="w-6 h-6 text-brand-500" />
            ניהול שיבוצים
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activePlacements.length} שיבוצים פעילים · {trialPlacements.length} בתקופת ניסיון
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          שיבוץ חדש
        </button>
      </div>

      {/* Active Placements Highlight */}
      {activePlacements.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            שיבוצים פעילים ({activePlacements.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activePlacements.map((p) => (
              <div key={p.id} className="card p-4 border-emerald-200 bg-emerald-50">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Link
                      href={`/service-dogs/${p.serviceDog.id}`}
                      className="font-bold text-base hover:text-brand-600 flex items-center gap-1.5"
                    >
                      <Dog className="w-4 h-4 text-emerald-600" />
                      {p.serviceDog.pet.name}
                    </Link>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      {SERVICE_DOG_PHASE_MAP[p.serviceDog.phase]?.label}
                    </p>
                  </div>
                  <ArrowLeft className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium">{p.recipient.name}</p>
                    {p.recipient.disabilityType && (
                      <p className="text-xs text-muted-foreground">
                        {DISABILITY_TYPE_MAP[p.recipient.disabilityType]}
                      </p>
                    )}
                  </div>
                </div>
                {p.nextCheckInAt && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
                    <Calendar className="w-3.5 h-3.5" />
                    בדיקת מעקב: {formatDate(p.nextCheckInAt)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setStatusFilter("")}
          className={cn(
            "text-sm px-3 py-1.5 rounded-lg font-medium transition-colors",
            !statusFilter ? "bg-slate-800 text-white" : "text-muted-foreground hover:bg-muted/60"
          )}
        >
          הכל ({placements.length})
        </button>
        {SERVICE_DOG_PLACEMENT_STATUSES.map((s) => {
          const count = statusCounts[s.id] || 0;
          if (count === 0) return null;
          return (
            <button
              key={s.id}
              onClick={() => setStatusFilter(statusFilter === s.id ? "" : s.id)}
              className={cn(
                "text-sm px-3 py-1.5 rounded-lg border transition-all",
                statusFilter === s.id
                  ? "bg-brand-50 text-brand-600 border-brand-200 shadow-sm font-medium"
                  : "text-muted-foreground hover:bg-muted/50 border-transparent"
              )}
            >
              {PLACEMENT_STATUS_MAP[s.id]?.label || s.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="card animate-pulse h-64" />
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Activity className="empty-state-icon" />
          <p className="text-muted-foreground">אין שיבוצים</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="table-header-cell">כלב</th>
                <th className="table-header-cell">מקבל</th>
                <th className="table-header-cell">סטטוס</th>
                <th className="table-header-cell">תאריך שיבוץ</th>
                <th className="table-header-cell">סיום ניסיון</th>
                <th className="table-header-cell">בדיקה הבאה</th>
                <th className="table-header-cell">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((placement) => {
                const statusInfo = PLACEMENT_STATUS_MAP[placement.status];
                return (
                  <tr key={placement.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="table-cell">
                      <Link
                        href={`/service-dogs/${placement.serviceDog.id}`}
                        className="font-medium hover:text-brand-500 flex items-center gap-1.5"
                      >
                        <Dog className="w-3.5 h-3.5 text-muted-foreground" />
                        {placement.serviceDog.pet.name}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {SERVICE_DOG_PHASE_MAP[placement.serviceDog.phase]?.label}
                      </p>
                    </td>
                    <td className="table-cell">
                      <div className="font-medium text-sm">{placement.recipient.name}</div>
                      {placement.recipient.disabilityType && (
                        <div className="text-xs text-muted-foreground">
                          {DISABILITY_TYPE_MAP[placement.recipient.disabilityType]}
                        </div>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusInfo?.color)}>
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
                      <div className="flex items-center gap-1.5">
                        {placement.status === "PENDING" && (
                          <button
                            onClick={() => statusChangeMutation.mutate({ id: placement.id, status: "TRIAL" })}
                            disabled={statusChangeMutation.isPending}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            התחל ניסיון
                          </button>
                        )}
                        {placement.status === "TRIAL" && (
                          <button
                            onClick={() => statusChangeMutation.mutate({ id: placement.id, status: "ACTIVE" })}
                            disabled={statusChangeMutation.isPending}
                            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                          >
                            אשר שיבוץ ✓
                          </button>
                        )}
                        {["PENDING", "TRIAL", "ACTIVE"].includes(placement.status) && (
                          <button
                            onClick={() =>
                              confirm("האם לסיים את השיבוץ?") &&
                              statusChangeMutation.mutate({ id: placement.id, status: "TERMINATED" })
                            }
                            disabled={statusChangeMutation.isPending}
                            className="text-xs text-red-500 hover:text-red-600"
                          >
                            סיים
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

      {showAddModal && (
        <AddPlacementModal
          dogs={dogs}
          recipients={recipients}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

// ─── Add Placement Modal ───

function AddPlacementModal({
  dogs,
  recipients,
  onClose,
}: {
  dogs: ServiceDogOption[];
  recipients: RecipientOption[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [serviceDogId, setServiceDogId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [placementDate, setPlacementDate] = useState(new Date().toISOString().split("T")[0]);
  const [trialEndDate, setTrialEndDate] = useState("");
  const [notes, setNotes] = useState("");

  const certifiedDogs = dogs.filter((d) => d.phase === "CERTIFIED");

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
      toast.success("שיבוץ נוצר בהצלחה");
      onClose();
    },
    onError: () => toast.error("שגיאה ביצירת שיבוץ"),
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">שיבוץ חדש</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">כלב שירות *</label>
            <select value={serviceDogId} onChange={(e) => setServiceDogId(e.target.value)} className="input w-full">
              <option value="">בחר כלב...</option>
              {certifiedDogs.length === 0 && (
                <option disabled>אין כלבים מוסמכים</option>
              )}
              {certifiedDogs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.pet.name} — {SERVICE_DOG_PHASE_MAP[d.phase]?.label}
                </option>
              ))}
              {dogs.filter((d) => d.phase !== "CERTIFIED").length > 0 && (
                <>
                  <option disabled>── שאר הכלבים ──</option>
                  {dogs.filter((d) => d.phase !== "CERTIFIED").map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.pet.name} — {SERVICE_DOG_PHASE_MAP[d.phase]?.label}
                    </option>
                  ))}
                </>
              )}
            </select>
            {certifiedDogs.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                מומלץ לשבץ רק כלבים מוסמכים
              </p>
            )}
          </div>

          <div>
            <label className="label">מקבל *</label>
            <select value={recipientId} onChange={(e) => setRecipientId(e.target.value)} className="input w-full">
              <option value="">בחר מקבל...</option>
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.disabilityType ? ` — ${DISABILITY_TYPE_MAP[r.disabilityType]}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תאריך שיבוץ</label>
              <input type="date" value={placementDate} onChange={(e) => setPlacementDate(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="label">סיום תקופת ניסיון</label>
              <input type="date" value={trialEndDate} onChange={(e) => setTrialEndDate(e.target.value)} className="input w-full" />
            </div>
          </div>

          <div>
            <label className="label">הערות</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input w-full" rows={2} />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() =>
                createMutation.mutate({
                  serviceDogId,
                  recipientId,
                  placementDate,
                  trialEndDate: trialEndDate || null,
                  notes: notes || null,
                })
              }
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
