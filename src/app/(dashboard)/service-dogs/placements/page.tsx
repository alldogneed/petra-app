"use client";

import React from "react";
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
  Search,
  CheckCircle2,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { ServiceDogsTabs } from "@/components/service-dogs/ServiceDogsTabs";
import {
  PLACEMENT_STATUS_MAP,
  SERVICE_DOG_PLACEMENT_STATUSES,
  SERVICE_DOG_PHASE_MAP,
  DISABILITY_TYPE_MAP,
  FUNDING_SOURCE_MAP,
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
    fundingSource: string | null;
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
      <ServiceDogsTabs />
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 text-sm text-petra-muted mb-1">
            <Link href="/service-dogs" className="hover:text-foreground">כלבי שירות</Link>
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>שיבוצים</span>
          </div>
          <h1 className="page-title flex items-center gap-2">
            <Activity className="w-6 h-6 text-brand-500" />
            ניהול שיבוצים
          </h1>
          <p className="text-sm text-petra-muted mt-1">
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
                      <p className="text-xs text-petra-muted">
                        {DISABILITY_TYPE_MAP[p.recipient.disabilityType]}
                      </p>
                    )}
                    {p.recipient.fundingSource && (
                      <p className="text-xs text-brand-500 font-medium">
                        {FUNDING_SOURCE_MAP[p.recipient.fundingSource] || p.recipient.fundingSource}
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
            !statusFilter ? "bg-slate-800 text-white" : "text-petra-muted hover:bg-slate-50"
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
                  : "text-petra-muted hover:bg-slate-50 border-transparent"
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
          <p className="text-petra-muted">אין שיבוצים</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-slate-50/50">
                <th className="table-header-cell">כלב</th>
                <th className="table-header-cell">זכאי</th>
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
                  <tr key={placement.id} className="border-b hover:bg-slate-50/40 transition-colors">
                    <td className="table-cell">
                      <Link
                        href={`/service-dogs/${placement.serviceDog.id}`}
                        className="font-medium hover:text-brand-500 flex items-center gap-1.5"
                      >
                        <Dog className="w-3.5 h-3.5 text-petra-muted" />
                        {placement.serviceDog.pet.name}
                      </Link>
                      <p className="text-xs text-petra-muted mt-0.5">
                        {SERVICE_DOG_PHASE_MAP[placement.serviceDog.phase]?.label}
                      </p>
                    </td>
                    <td className="table-cell">
                      <div className="font-medium text-sm">{placement.recipient.name}</div>
                      {placement.recipient.disabilityType && (
                        <div className="text-xs text-petra-muted">
                          {DISABILITY_TYPE_MAP[placement.recipient.disabilityType]}
                        </div>
                      )}
                      {placement.recipient.fundingSource && (
                        <div className="text-xs text-brand-500 font-medium">
                          {FUNDING_SOURCE_MAP[placement.recipient.fundingSource] || placement.recipient.fundingSource}
                        </div>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusInfo?.color)}>
                        {statusInfo?.label || placement.status}
                      </span>
                    </td>
                    <td className="table-cell text-petra-muted text-sm">
                      {placement.placementDate ? formatDate(placement.placementDate) : "—"}
                    </td>
                    <td className="table-cell text-petra-muted text-sm">
                      {placement.trialEndDate ? formatDate(placement.trialEndDate) : "—"}
                    </td>
                    <td className="table-cell text-petra-muted text-sm">
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

// ─── Searchable Select Component ───

function SearchableSelect({
  label,
  placeholder,
  items,
  selectedId,
  onSelect,
  renderItem,
  renderSelected,
}: {
  label: string;
  placeholder: string;
  items: { id: string; [key: string]: unknown }[];
  selectedId: string;
  onSelect: (id: string) => void;
  renderItem: (item: { id: string; [key: string]: unknown }) => React.ReactNode;
  renderSelected: (item: { id: string; [key: string]: unknown }) => string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = items.filter((item) => {
    const text = renderSelected(item).toLowerCase();
    return text.includes(search.toLowerCase());
  });

  const selected = items.find((i) => i.id === selectedId);

  return (
    <div className="relative">
      <label className="label">{label}</label>
      {selected && !open ? (
        <div
          className="input w-full flex items-center justify-between cursor-pointer"
          onClick={() => { setOpen(true); setSearch(""); }}
        >
          <span className="text-sm">{renderSelected(selected)}</span>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(""); }}
              className="text-petra-muted hover:text-red-500 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted" />
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="input w-full pr-10"
            placeholder={placeholder}
          />
        </div>
      )}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-3 text-sm text-petra-muted text-center">אין תוצאות</div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full text-right px-3 py-2.5 text-sm hover:bg-slate-50 transition-colors border-b last:border-0"
                onMouseDown={() => { onSelect(item.id); setOpen(false); setSearch(""); }}
              >
                {renderItem(item)}
              </button>
            ))
          )}
        </div>
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
      <div className="modal-content max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">שיבוץ חדש</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <SearchableSelect
            label="כלב שירות *"
            placeholder="חפש לפי שם כלב..."
            items={dogs as unknown as { id: string; [key: string]: unknown }[]}
            selectedId={serviceDogId}
            onSelect={setServiceDogId}
            renderSelected={(item) => {
              const d = item as unknown as ServiceDogOption;
              return `${d.pet.name} — ${SERVICE_DOG_PHASE_MAP[d.phase]?.label || d.phase}`;
            }}
            renderItem={(item) => {
              const d = item as unknown as ServiceDogOption;
              return (
                <div>
                  <span className="font-medium">{d.pet.name}</span>
                  <span className="text-petra-muted mr-2 text-xs">
                    {SERVICE_DOG_PHASE_MAP[d.phase]?.label}
                    {d.pet.breed ? ` · ${d.pet.breed}` : ""}
                    {d.phase !== "CERTIFIED" ? " ⚠️" : ""}
                  </span>
                </div>
              );
            }}
          />

          <SearchableSelect
            label="זכאי *"
            placeholder="חפש לפי שם זכאי..."
            items={recipients as unknown as { id: string; [key: string]: unknown }[]}
            selectedId={recipientId}
            onSelect={setRecipientId}
            renderSelected={(item) => {
              const r = item as unknown as RecipientOption;
              return r.disabilityType
                ? `${r.name} — ${DISABILITY_TYPE_MAP[r.disabilityType]}`
                : r.name;
            }}
            renderItem={(item) => {
              const r = item as unknown as RecipientOption;
              return (
                <div>
                  <span className="font-medium">{r.name}</span>
                  {r.disabilityType && (
                    <span className="text-petra-muted mr-2 text-xs">{DISABILITY_TYPE_MAP[r.disabilityType]}</span>
                  )}
                </div>
              );
            }}
          />

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
