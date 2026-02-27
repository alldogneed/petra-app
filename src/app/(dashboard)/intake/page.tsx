"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  User,
  Phone,
  PawPrint,
  Copy,
  Send,
  X,
  Eye,
  Plus,
  MessageCircle,
  Search,
} from "lucide-react";
import { cn, fetchJSON, formatRelativeTime, toWhatsAppPhone } from "@/lib/utils";
import { toast } from "sonner";

interface IntakeForm {
  id: string;
  status: string; // DRAFT | SENT | OPENED | SUBMITTED | EXPIRED
  phoneE164: string | null;
  createdAt: string;
  submittedAt: string | null;
  openedAt: string | null;
  expiresAt: string;
  customer: { id: string; name: string; phone: string } | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  pets: { id: string; name: string }[];
}

const STATUS_INFO: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  DRAFT: { label: "טיוטה", color: "#94A3B8", icon: ClipboardList },
  SENT: { label: "נשלח", color: "#3B82F6", icon: Send },
  OPENED: { label: "נפתח", color: "#F59E0B", icon: Eye },
  SUBMITTED: { label: "הוגש", color: "#22C55E", icon: CheckCircle2 },
  EXPIRED: { label: "פג תוקף", color: "#EF4444", icon: XCircle },
};

const FILTER_STATUSES = [
  { id: "ALL", label: "הכל" },
  { id: "SUBMITTED", label: "הוגשו" },
  { id: "SENT", label: "נשלחו" },
  { id: "OPENED", label: "נפתחו" },
  { id: "DRAFT", label: "טיוטות" },
  { id: "EXPIRED", label: "פגי תוקף" },
];

function buildIntakeLink(origin: string, tokenHint: string) {
  // The token is not stored (only the hash), so we can only show the form URL pattern
  return `${origin}/intake/${tokenHint}`;
}

export default function IntakePage() {
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newCustomerId, setNewCustomerId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const queryClient = useQueryClient();

  const { data: forms = [], isLoading } = useQuery<IntakeForm[]>({
    queryKey: ["intake-forms"],
    queryFn: () => fetchJSON<IntakeForm[]>("/api/intake/list"),
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers-for-intake"],
    queryFn: () => fetchJSON<Customer[]>("/api/customers"),
    enabled: showNewModal,
  });

  const filtered = forms.filter((f) => {
    const matchStatus = activeStatus === "ALL" || f.status === activeStatus;
    const matchSearch = !searchQuery ||
      (f.customer?.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (f.customer?.phone.includes(searchQuery)) ||
      (f.phoneE164?.includes(searchQuery));
    return matchStatus && matchSearch;
  });

  async function createIntakeForm() {
    if (!newPhone && !newCustomerId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/intake/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: newPhone || undefined,
          customerId: newCustomerId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "שגיאה ביצירת הטופס");
        return;
      }
      setCreatedLink(data.url || data.link || null);
      queryClient.invalidateQueries({ queryKey: ["intake-forms"] });
      toast.success("טופס נוצר בהצלחה");
    } catch {
      toast.error("שגיאה ביצירת הטופס");
    } finally {
      setCreating(false);
    }
  }

  function copyLink(link: string) {
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  const submittedCount = forms.filter((f) => f.status === "SUBMITTED").length;
  const pendingCount = forms.filter((f) => f.status === "SENT" || f.status === "OPENED").length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="page-title">טפסי קליטה</h1>
          <p className="text-sm text-petra-muted mt-0.5">
            {forms.length} טפסים • {submittedCount} הוגשו • {pendingCount} ממתינים
          </p>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => { setShowNewModal(true); setCreatedLink(null); setNewPhone(""); setNewCustomerId(""); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          טופס חדש
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5 items-center">
        <div className="flex gap-1.5">
          {FILTER_STATUSES.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveStatus(s.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                activeStatus === s.id
                  ? "bg-brand-500 text-white"
                  : "bg-slate-100 text-petra-muted hover:bg-slate-200"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="חיפוש לפי שם / טלפון"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pr-9 py-1.5 text-xs w-48"
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="card p-5 animate-pulse h-20" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <ClipboardList className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין טפסי קליטה</h3>
          <p className="text-sm text-petra-muted mb-4">צור טופס קליטה ושלח ללקוח</p>
          <button onClick={() => setShowNewModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            טופס חדש
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((form) => {
            const info = STATUS_INFO[form.status] || STATUS_INFO.DRAFT;
            const StatusIcon = info.icon;
            const isExpired = new Date(form.expiresAt) < new Date();

            return (
              <div key={form.id} className="card p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${info.color}15` }}
                  >
                    <StatusIcon className="w-5 h-5" style={{ color: info.color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      {form.customer ? (
                        <Link
                          href={`/customers/${form.customer.id}`}
                          className="text-sm font-semibold text-petra-text hover:text-brand-500 transition-colors flex items-center gap-1"
                        >
                          <User className="w-3.5 h-3.5" />
                          {form.customer.name}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-petra-muted flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          לקוח חדש
                        </span>
                      )}
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${info.color}15`, color: info.color }}
                      >
                        {info.label}
                      </span>
                      {isExpired && form.status !== "SUBMITTED" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-500 font-medium">
                          פג תוקף
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-petra-muted">
                      {form.customer?.phone && (
                        <span className="flex items-center gap-1" dir="ltr">
                          <Phone className="w-3 h-3" />
                          {form.customer.phone}
                        </span>
                      )}
                      {form.phoneE164 && !form.customer && (
                        <span className="flex items-center gap-1" dir="ltr">
                          <Phone className="w-3 h-3" />
                          {form.phoneE164}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        נוצר {formatRelativeTime(form.createdAt)}
                      </span>
                      {form.submittedAt && (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" />
                          הוגש {formatRelativeTime(form.submittedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {form.customer?.phone && form.status !== "SUBMITTED" && !isExpired && (
                      <button
                        onClick={() => {
                          // The real link requires the token which isn't returned by the list API
                          // We just open WA with a message asking them to check the link
                          const waMsg = encodeURIComponent(
                            `שלום ${form.customer?.name || ""}! אנא מלא את טופס הקליטה שנשלח אליך 🐾`
                          );
                          window.open(`https://wa.me/${toWhatsAppPhone(form.customer!.phone)}?text=${waMsg}`, "_blank");
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                        title="שלח תזכורת WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Intake Form Modal */}
      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal-backdrop" />
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-petra-text flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-brand-500" />
                טופס קליטה חדש
              </h3>
              <button onClick={() => setShowNewModal(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {createdLink ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-emerald-700 mb-1">הקישור נוצר!</p>
                  <p className="text-xs text-emerald-600 break-all">{createdLink}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyLink(createdLink)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-100 text-sm font-medium hover:bg-slate-200 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedLink ? "הועתק!" : "העתק קישור"}
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`מלא את טופס הקליטה שלנו: ${createdLink}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors border border-green-200"
                  >
                    <MessageCircle className="w-4 h-4" />
                    שלח WhatsApp
                  </a>
                </div>
                <button
                  onClick={() => { setCreatedLink(null); setNewPhone(""); setNewCustomerId(""); }}
                  className="w-full text-xs text-petra-muted hover:text-petra-text py-2"
                >
                  צור טופס נוסף
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-petra-muted">
                  צור קישור אישי לטופס קליטה ושלח ללקוח
                </p>

                <div>
                  <label className="label">לקוח קיים (אופציונלי)</label>
                  <select
                    className="input w-full"
                    value={newCustomerId}
                    onChange={(e) => {
                      setNewCustomerId(e.target.value);
                      if (e.target.value) {
                        const c = customers.find((c) => c.id === e.target.value);
                        if (c) setNewPhone(c.phone);
                      }
                    }}
                  >
                    <option value="">— בחר לקוח —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">או מספר טלפון</label>
                  <input
                    type="tel"
                    className="input w-full"
                    dir="ltr"
                    placeholder="050-0000000"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 flex gap-2">
                  <button
                    onClick={() => setShowNewModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 text-sm font-medium hover:bg-slate-200 transition-colors"
                  >
                    ביטול
                  </button>
                  <button
                    onClick={createIntakeForm}
                    disabled={creating || (!newPhone && !newCustomerId)}
                    className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors"
                  >
                    {creating ? "יוצר..." : "צור טופס"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
