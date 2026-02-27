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
  Mail,
  ChevronLeft,
  Dog,
  Clock,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { RECIPIENT_STATUSES, RECIPIENT_STATUS_MAP, DISABILITY_TYPES, DISABILITY_TYPE_MAP, PLACEMENT_STATUS_MAP } from "@/lib/service-dogs";
import { toast } from "sonner";

interface Recipient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  idNumber: string | null;
  address: string | null;
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

export default function RecipientsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);

  const { data: recipients = [], isLoading } = useQuery<Recipient[]>({
    queryKey: ["service-recipients"],
    queryFn: () => fetch("/api/service-recipients").then((r) => r.json()),
  });

  const filtered = recipients.filter((r) => {
    const matchStatus = !statusFilter || r.status === statusFilter;
    const matchSearch =
      !search || r.name.includes(search) || (r.phone || "").includes(search);
    return matchStatus && matchSearch;
  });

  const statusCounts = RECIPIENT_STATUSES.reduce(
    (acc, s) => ({ ...acc, [s.id]: recipients.filter((r) => r.status === s.id).length }),
    {} as Record<string, number>
  );

  return (
    <div className="animate-fade-in space-y-4">
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
            {recipients.length} זכאים במערכת ·{" "}
            {recipients.filter((r) => r.status === "WAITLIST").length} ברשימת המתנה ·{" "}
            {recipients.filter((r) => r.status === "ACTIVE").length} פעילים
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          הוסף זכאי
        </button>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setStatusFilter("")}
          className={cn(
            "text-sm px-3 py-1.5 rounded-lg font-medium transition-colors",
            !statusFilter ? "bg-slate-800 text-white" : "text-petra-muted hover:bg-slate-50"
          )}
        >
          הכל ({recipients.length})
        </button>
        {RECIPIENT_STATUSES.map((s) => {
          const count = statusCounts[s.id] || 0;
          return (
            <button
              key={s.id}
              onClick={() => setStatusFilter(statusFilter === s.id ? "" : s.id)}
              className={cn(
                "text-sm px-3 py-1.5 rounded-lg font-medium border transition-all",
                statusFilter === s.id
                  ? "bg-brand-50 text-brand-600 border-brand-200 shadow-sm"
                  : "text-petra-muted hover:bg-slate-50 border-transparent",
                count === 0 && "opacity-40"
              )}
            >
              {s.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted" />
        <input
          type="text"
          placeholder="חיפוש לפי שם או טלפון..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pr-10 w-full"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="card animate-pulse h-64" />
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <UserCheck className="empty-state-icon" />
          <p className="text-petra-muted">אין זכאים</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-slate-50/50">
                <th className="table-header-cell">שם</th>
                <th className="table-header-cell">סוג לקות</th>
                <th className="table-header-cell">סטטוס</th>
                <th className="table-header-cell">כלב משובץ</th>
                <th className="table-header-cell">טלפון</th>
                <th className="table-header-cell">תאריך רשימה</th>
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
                  <tr key={recipient.id} className="border-b hover:bg-slate-50/40 transition-colors">
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
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusInfo?.color)}>
                        {statusInfo?.label || recipient.status}
                      </span>
                    </td>
                    <td className="table-cell">
                      {activePlacement ? (
                        <Link
                          href={`/service-dogs/${activePlacement.serviceDog.id}`}
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
                        <a href={`tel:${recipient.phone}`} className="flex items-center gap-1 text-sm hover:text-brand-500">
                          <Phone className="w-3.5 h-3.5" />
                          {recipient.phone}
                        </a>
                      ) : (
                        <span className="text-petra-muted text-sm">—</span>
                      )}
                    </td>
                    <td className="table-cell text-petra-muted text-sm">
                      {recipient.waitlistDate ? (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(recipient.waitlistDate)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="table-cell">
                      <button
                        onClick={() => setSelectedRecipient(recipient)}
                        className="text-sm text-brand-500 hover:text-brand-600 font-medium"
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

      {showAddModal && <AddRecipientModal onClose={() => setShowAddModal(false)} />}
      {selectedRecipient && (
        <RecipientDetailModal
          recipient={selectedRecipient}
          onClose={() => setSelectedRecipient(null)}
        />
      )}
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
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input w-full" placeholder="שם ומשפחה" />
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
              {createMutation.isPending ? "יוצר..." : "הוסף זכאי"}
            </button>
            <button onClick={onClose} className="btn-secondary flex-1">ביטול</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Recipient Detail Modal ───

function RecipientDetailModal({ recipient, onClose }: { recipient: Recipient; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{recipient.name}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          {/* Status */}
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-petra-muted">סטטוס</span>
            <span className={cn("text-sm px-2.5 py-1 rounded-full font-medium", RECIPIENT_STATUS_MAP[recipient.status]?.color)}>
              {RECIPIENT_STATUS_MAP[recipient.status]?.label || recipient.status}
            </span>
          </div>

          {/* Details */}
          {[
            { label: "סוג לקות", value: DISABILITY_TYPE_MAP[recipient.disabilityType || ""] || null },
            { label: "תעודת זהות", value: recipient.idNumber },
            { label: "טלפון", value: recipient.phone },
            { label: "אימייל", value: recipient.email },
            { label: "כתובת", value: recipient.address },
            { label: "תאריך רשימה", value: recipient.waitlistDate ? formatDate(recipient.waitlistDate) : null },
          ]
            .filter((f) => f.value)
            .map((f) => (
              <div key={f.label} className="flex justify-between py-1.5 border-b last:border-0">
                <span className="text-sm text-petra-muted">{f.label}</span>
                <span className="text-sm font-medium">{f.value}</span>
              </div>
            ))}

          {/* Placements */}
          {recipient.placements && recipient.placements.length > 0 && (
            <div className="pt-2">
              <p className="text-sm font-semibold mb-2">שיבוצים</p>
              {recipient.placements.map((p) => (
                <Link
                  key={p.id}
                  href={`/service-dogs/${p.serviceDog.id}`}
                  onClick={onClose}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <Dog className="w-4 h-4 text-petra-muted" />
                    {p.serviceDog.pet.name}
                  </span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", PLACEMENT_STATUS_MAP[p.status]?.color || "bg-slate-100 text-slate-600")}>
                    {PLACEMENT_STATUS_MAP[p.status]?.label || p.status}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {recipient.notes && (
            <div className="pt-2 border-t">
              <p className="text-xs text-petra-muted mb-1">הערות</p>
              <p className="text-sm">{recipient.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
