"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import {
  UserCheck,
  Plus,
  X,
  Search,
  Phone,
  ChevronLeft,
  Dog,
  ChevronRight,
  LayoutGrid,
  LayoutList,
  ArrowRight,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { ServiceDogsTabs } from "@/components/service-dogs/ServiceDogsTabs";
import {
  RECIPIENT_STATUSES,
  RECIPIENT_STATUS_MAP,
  DISABILITY_TYPES,
  DISABILITY_TYPE_MAP,
  PLACEMENT_STATUS_MAP,
  RECIPIENT_FUNDING_SOURCES,
  FUNDING_SOURCE_MAP,
} from "@/lib/service-dogs";
import { toast } from "sonner";

interface Recipient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  idNumber: string | null;
  address: string | null;
  disabilityType: string | null;
  fundingSource: string | null;
  status: string;
  waitlistDate: string | null;
  notes: string | null;
  placements: Array<{
    id: string;
    status: string;
    serviceDog: { id: string; pet: { name: string } };
  }>;
}

const PIPELINE_STAGES: string[] = RECIPIENT_STATUSES.map((s) => s.id as string);

export default function RecipientsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const queryClient = useQueryClient();

  const { data: recipients = [], isLoading } = useQuery<Recipient[]>({
    queryKey: ["service-recipients"],
    queryFn: () => fetch("/api/service-recipients").then((r) => r.json()),
  });

  const advanceMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/service-recipients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["service-recipients"] }),
    onError: () => toast.error("שגיאה בעדכון סטטוס"),
  });

  const filtered = recipients.filter((r) => {
    const matchStatus = !statusFilter || r.status === statusFilter;
    const matchSearch = !search || r.name.includes(search) || (r.phone || "").includes(search);
    return matchStatus && matchSearch;
  });

  const statusCounts = RECIPIENT_STATUSES.reduce(
    (acc, s) => ({ ...acc, [s.id]: recipients.filter((r) => r.status === s.id).length }),
    {} as Record<string, number>
  );

  const getNextStage = (currentStatus: string) => {
    const idx = PIPELINE_STAGES.indexOf(currentStatus);
    return idx >= 0 && idx < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[idx + 1] : null;
  };

  return (
    <div className="animate-fade-in space-y-4">
      <ServiceDogsTabs />

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 text-sm text-petra-muted mb-1">
            <Link href="/service-dogs" className="hover:text-foreground">כלבי שירות</Link>
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>זכאים</span>
          </div>
          <h1 className="page-title flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-brand-500" />
            ניהול זכאים
          </h1>
          <p className="text-sm text-petra-muted mt-1">
            {recipients.length} זכאים ·{" "}
            {recipients.filter((r) => r.status === "WAITLIST").length} ברשימת המתנה ·{" "}
            {recipients.filter((r) => r.status === "ACTIVE").length} פעילים
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setView("kanban")}
              className={cn("p-1.5 rounded transition-colors", view === "kanban" ? "bg-white shadow-sm text-brand-600" : "text-petra-muted hover:text-foreground")}
              title="תצוגת קנבן"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView("table")}
              className={cn("p-1.5 rounded transition-colors", view === "table" ? "bg-white shadow-sm text-brand-600" : "text-petra-muted hover:text-foreground")}
              title="תצוגת טבלה"
            >
              <LayoutList className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            הוסף זכאי
          </button>
        </div>
      </div>

      {/* Search + status filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted" />
          <input
            type="text"
            placeholder="חיפוש לפי שם או טלפון..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pr-10 w-56"
          />
        </div>
        {view === "table" && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setStatusFilter("")}
              className={cn("text-sm px-3 py-1.5 rounded-lg font-medium transition-colors", !statusFilter ? "bg-slate-800 text-white" : "text-petra-muted hover:bg-slate-50")}
            >
              הכל ({recipients.length})
            </button>
            {RECIPIENT_STATUSES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStatusFilter(statusFilter === s.id ? "" : s.id)}
                className={cn(
                  "text-sm px-3 py-1.5 rounded-lg font-medium border transition-all",
                  statusFilter === s.id ? "bg-brand-50 text-brand-600 border-brand-200 shadow-sm" : "text-petra-muted hover:bg-slate-50 border-transparent",
                  (statusCounts[s.id] || 0) === 0 && "opacity-40"
                )}
              >
                {s.label} ({statusCounts[s.id] || 0})
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="card animate-pulse h-64" />
      ) : view === "kanban" ? (
        /* ─── Kanban Board ─── */
        <div className="overflow-x-auto pb-4 -mx-1 px-1">
          <div className="flex gap-3 min-w-max">
            {RECIPIENT_STATUSES.map((stage) => {
              const stageRecipients = filtered.filter((r) => r.status === stage.id);
              return (
                <div key={stage.id} className="w-60 flex-shrink-0">
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", stage.color)}>
                      {stage.label}
                    </span>
                    <span className="text-xs text-petra-muted font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                      {stageRecipients.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2 min-h-28 bg-slate-50/70 rounded-xl p-2">
                    {stageRecipients.map((r) => {
                      const nextStage = getNextStage(r.status);
                      const nextStageInfo = nextStage ? RECIPIENT_STATUS_MAP[nextStage] : null;
                      const activePlacement = r.placements?.find((p) =>
                        ["ACTIVE", "TRIAL"].includes(p.status)
                      );
                      return (
                        <div
                          key={r.id}
                          className="bg-white border rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <Link href={`/service-dogs/recipients/${r.id}`} className="block">
                            <p className="font-semibold text-sm leading-tight">{r.name}</p>
                            {r.disabilityType && (
                              <p className="text-xs text-petra-muted mt-0.5">
                                {DISABILITY_TYPE_MAP[r.disabilityType] || r.disabilityType}
                              </p>
                            )}
                            {r.fundingSource && (
                              <p className="text-xs text-brand-500 font-medium mt-1">
                                {FUNDING_SOURCE_MAP[r.fundingSource] || r.fundingSource}
                              </p>
                            )}
                            {activePlacement && (
                              <div className="flex items-center gap-1 mt-1.5 text-xs text-emerald-600">
                                <Dog className="w-3 h-3" />
                                {activePlacement.serviceDog.pet.name}
                              </div>
                            )}
                            {r.phone && (
                              <p className="text-xs text-petra-muted mt-1 flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {r.phone}
                              </p>
                            )}
                          </Link>
                          {nextStageInfo && (
                            <button
                              onClick={() => advanceMutation.mutate({ id: r.id, status: nextStage! })}
                              disabled={advanceMutation.isPending}
                              className="w-full mt-2 text-xs flex items-center justify-center gap-1 text-petra-muted hover:text-brand-600 hover:bg-brand-50 py-1 rounded-lg transition-colors border border-transparent hover:border-brand-200"
                            >
                              <ArrowRight className="w-3 h-3 rotate-180" />
                              העבר ל{nextStageInfo.label}
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {stageRecipients.length === 0 && (
                      <div className="border border-dashed border-slate-200 rounded-xl p-4 text-center text-xs text-petra-muted">
                        אין זכאים
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <UserCheck className="empty-state-icon" />
          <p className="text-petra-muted">אין זכאים</p>
        </div>
      ) : (
        /* ─── Table View ─── */
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-slate-50/50">
                <th className="table-header-cell">שם</th>
                <th className="table-header-cell">סוג לקות</th>
                <th className="table-header-cell">מקור מימון</th>
                <th className="table-header-cell">סטטוס</th>
                <th className="table-header-cell">כלב משובץ</th>
                <th className="table-header-cell">טלפון</th>
                <th className="table-header-cell">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((recipient) => {
                const statusInfo = RECIPIENT_STATUS_MAP[recipient.status];
                const activePlacement = recipient.placements?.find((p) =>
                  ["ACTIVE", "TRIAL"].includes(p.status)
                );
                return (
                  <tr
                    key={recipient.id}
                    className="border-b hover:bg-slate-50/40 transition-colors cursor-pointer"
                    onClick={() => (window.location.href = `/service-dogs/recipients/${recipient.id}`)}
                  >
                    <td className="table-cell">
                      <div className="font-medium">{recipient.name}</div>
                      {recipient.idNumber && (
                        <div className="text-xs text-petra-muted font-mono">ת.ז. {recipient.idNumber}</div>
                      )}
                    </td>
                    <td className="table-cell">
                      {DISABILITY_TYPE_MAP[recipient.disabilityType || ""] || (
                        <span className="text-petra-muted">—</span>
                      )}
                    </td>
                    <td className="table-cell">
                      {recipient.fundingSource ? (
                        <span className="text-sm">{FUNDING_SOURCE_MAP[recipient.fundingSource] || recipient.fundingSource}</span>
                      ) : (
                        <span className="text-petra-muted">—</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusInfo?.color)}>
                        {statusInfo?.label || recipient.status}
                      </span>
                    </td>
                    <td className="table-cell">
                      {activePlacement ? (
                        <Link
                          href={`/service-dogs/${activePlacement.serviceDog.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 text-sm text-brand-500 hover:text-brand-600"
                        >
                          <Dog className="w-3.5 h-3.5" />
                          {activePlacement.serviceDog.pet.name}
                        </Link>
                      ) : (
                        <span className="text-petra-muted text-sm">—</span>
                      )}
                    </td>
                    <td className="table-cell">
                      {recipient.phone ? (
                        <a
                          href={`tel:${recipient.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-sm hover:text-brand-500"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          {recipient.phone}
                        </a>
                      ) : (
                        <span className="text-petra-muted text-sm">—</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <Link
                        href={`/service-dogs/recipients/${recipient.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-sm text-brand-500 hover:text-brand-600 font-medium"
                      >
                        פרופיל
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
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
  const [fundingSource, setFundingSource] = useState("");
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
      toast.success("זכאי נוסף בהצלחה");
      onClose();
    },
    onError: () => toast.error("שגיאה בהוספת זכאי"),
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">הוסף זכאי חדש</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">שם מלא *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              placeholder="שם ומשפחה"
            />
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
              <label className="label">תעודת זהות</label>
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
            <label className="label">מקור מימון</label>
            <select value={fundingSource} onChange={(e) => setFundingSource(e.target.value)} className="input w-full">
              <option value="">לא נבחר</option>
              {RECIPIENT_FUNDING_SOURCES.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
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
              onClick={() =>
                createMutation.mutate({ name, phone, email, idNumber, address, disabilityType, fundingSource, notes })
              }
              disabled={!name || createMutation.isPending}
              className="btn-primary flex-1"
            >
              {createMutation.isPending ? "יוצר..." : "הוסף זכאי"}
            </button>
            <button onClick={onClose} className="btn-secondary flex-1">ביטול</button>
          </div>
        </div>
      </div>
    </div>
  );
}
