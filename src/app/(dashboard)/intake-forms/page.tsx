"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  ClipboardList,
  Copy,
  Check,
  RefreshCw,
  Plus,
  X,
  Search,
  ExternalLink,
  MessageCircle,
  Eye,
  Trash2,
} from "lucide-react";
import { cn, toWhatsAppPhone, copyToClipboard } from "@/lib/utils";
import { BoardingTabs } from "@/components/boarding/BoardingTabs";
import { TierGate } from "@/components/paywall/TierGate";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "טיוטה",
  SENT: "נשלח",
  OPENED: "נפתח",
  SUBMITTED: "הוגש",
  EXPIRED: "פג תוקף",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "badge-neutral",
  SENT: "badge-warning",
  OPENED: "bg-blue-100 text-blue-700 border border-blue-200",
  SUBMITTED: "badge-success",
  EXPIRED: "badge-danger",
};

interface IntakeForm {
  id: string;
  status: string;
  phoneE164: string | null;
  expiresAt: string;
  openedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    phone: string;
  } | null;
}

// ─── View responses modal ────────────────────────────────────────────────────

const SUBMISSION_SECTION_LABELS: Record<string, string> = {
  dog: "פרטי הכלב",
  health: "בריאות",
  behavior: "התנהגות",
};

const SUBMISSION_FIELD_LABELS: Record<string, string> = {
  // dog
  customerName: "שם הלקוח",
  customerPhone: "טלפון הלקוח",
  name: "שם הכלב",
  breed: "גזע",
  gender: "מין",
  weight: "משקל",
  birthDate: "תאריך לידה",
  // health
  allergies: "אלרגיות",
  medicalConditions: "מצבים רפואיים",
  surgeriesHistory: "היסטוריית ניתוחים",
  activityLimitations: "מגבלות פעילות",
  vetName: "וטרינר מטפל",
  vetPhone: "טלפון וטרינר",
  neuteredSpayed: "מעוקר/מסורס",
  originInfo: "מקור הכלב",
  timeWithOwner: "זמן אצל הבעלים",
  foodNotes: "הערות האכלה",
  // behavior
  dogAggression: "תוקפנות כלפי כלבים",
  humanAggression: "תוקפנות כלפי אנשים",
  leashReactivity: "ריאקטיביות ברצועה",
  leashPulling: "משיכה ברצועה",
  jumping: "קפיצות",
  separationAnxiety: "חרדת נטישה",
  excessiveBarking: "נביחות יתר",
  destruction: "הרס חפצים",
  resourceGuarding: "שמירת משאבים",
  fears: "פחדים",
  badWithKids: "קושי עם ילדים",
  houseSoiling: "עשיית צרכים בבית",
  biteHistory: "היסטוריית נשיכות",
  biteDetails: "פרטי נשיכות",
  triggers: "טריגרים",
  customIssues: "בעיות נוספות",
  priorTraining: "אילוף קודם",
  priorTrainingDetails: "פרטי אילוף קודם",
};

function formatSubmissionValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "כן" : "לא";
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

interface IntakeFormDetail {
  id: string;
  status: string;
  phoneE164: string | null;
  submittedAt: string | null;
  submissionJson: string | null;
  customer: { id: string; name: string; phone: string } | null;
}

function ViewResponsesModal({
  formId,
  onClose,
}: {
  formId: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery<IntakeFormDetail>({
    queryKey: ["intakeForm", formId],
    queryFn: () =>
      fetch(`/api/intake/form/${formId}`).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
  });

  let submission: Record<string, unknown> | null = null;
  if (data?.submissionJson) {
    try {
      submission = JSON.parse(data.submissionJson);
    } catch {
      submission = null;
    }
  }

  const medications = Array.isArray(submission?.medications)
    ? (submission!.medications as Array<Record<string, unknown>>)
    : [];

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-petra-text">תשובות הטופס</h2>
            {data && (
              <p className="text-sm text-petra-muted mt-0.5">
                {data.customer?.name || data.phoneE164 || ""}
                {data.submittedAt &&
                  ` · הוגש ${new Date(data.submittedAt).toLocaleDateString("he-IL")}`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-petra-muted text-sm">טוען...</div>
        ) : isError ? (
          <div className="py-8 text-center text-red-500 text-sm">שגיאה בטעינת התשובות</div>
        ) : !submission ? (
          <div className="py-8 text-center text-petra-muted text-sm">
            לא נמצאו תשובות לטופס זה
          </div>
        ) : (
          <div className="space-y-5">
            {(["dog", "health", "behavior"] as const).map((sectionKey) => {
              const section = submission?.[sectionKey];
              if (!section || typeof section !== "object") return null;
              const entries = Object.entries(section as Record<string, unknown>).filter(
                ([, v]) => v !== null && v !== undefined && v !== ""
              );
              if (entries.length === 0) return null;
              return (
                <div key={sectionKey}>
                  <h3 className="text-sm font-bold text-petra-text mb-2 pb-1 border-b border-slate-100">
                    {SUBMISSION_SECTION_LABELS[sectionKey]}
                  </h3>
                  <dl className="space-y-1.5">
                    {entries.map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between gap-3 text-sm">
                        <dt className="text-petra-muted flex-shrink-0">
                          {SUBMISSION_FIELD_LABELS[key] || key}
                        </dt>
                        <dd
                          className={cn(
                            "text-left font-medium break-words",
                            value === true ? "text-amber-600" : "text-petra-text"
                          )}
                        >
                          {formatSubmissionValue(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}

            {medications.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-petra-text mb-2 pb-1 border-b border-slate-100">
                  תרופות
                </h3>
                <div className="space-y-2">
                  {medications.map((med, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-xl px-3 py-2 text-sm">
                      <p className="font-medium text-petra-text">
                        {formatSubmissionValue(med.medName)}
                      </p>
                      <p className="text-xs text-petra-muted mt-0.5">
                        {[med.dosage, med.frequency, med.instructions]
                          .filter(Boolean)
                          .map(String)
                          .join(" • ") || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6">
          <button className="btn-secondary w-full" onClick={onClose}>
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        copyToClipboard(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 transition-colors"
      title="העתק קישור"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-petra-muted" />
      )}
    </button>
  );
}

function NewIntakeModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [sent, setSent] = useState(false);
  const [intakeUrl, setIntakeUrl] = useState("");

  const { data: searchResults = [] } = useQuery<{ id: string; name: string; phone: string }[]>({
    queryKey: ["customerSearch", customerSearch],
    queryFn: () =>
      customerSearch.length >= 2
        ? fetch(`/api/search?q=${encodeURIComponent(customerSearch)}&type=customers`).then((r) => { if (!r.ok) throw new Error("Search failed"); return r.json(); }).then((d) => d.customers || [])
        : Promise.resolve([]),
    enabled: customerSearch.length >= 2,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/intake/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer?.id || null,
          phone: phone || selectedCustomer?.phone || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["intakeForms"] });
      setIntakeUrl(data.url);
      setSent(true);
    },
    onError: () => toast.error("שגיאה ביצירת טופס הרישום. נסה שוב."),
  });

  if (!isOpen) return null;

  const targetPhone = selectedCustomer?.phone || phone;

  if (sent && intakeUrl) {
    return (
      <div className="modal-overlay">
        <div className="modal-backdrop" onClick={onClose} />
        <div className="modal-content max-w-md mx-4 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-petra-text">טופס נוצר בהצלחה</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-xs text-petra-muted break-all mb-4 font-mono">
            {intakeUrl}
          </div>
          <div className="flex gap-2">
            <button
              className="btn-primary flex-1 gap-1.5"
              onClick={() => {
                const msg = `שלום! אנא מלא/י את טופס הקבלה לפני הביקור: ${intakeUrl}`;
                if (targetPhone) {
                  window.open(`https://wa.me/${toWhatsAppPhone(targetPhone)}?text=${encodeURIComponent(msg)}`, "_blank");
                }
              }}
            >
              <MessageCircle className="w-4 h-4" />
              שלח בוואטסאפ
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                copyToClipboard(intakeUrl);
              }}
            >
              <Copy className="w-4 h-4" />
            </button>
            <button className="btn-secondary" onClick={onClose}>סגור</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">יצירת טופס קבלה</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">חיפוש לקוח קיים</label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted" />
              <input
                className="input pr-9"
                placeholder="שם או טלפון..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                {searchResults.slice(0, 5).map((c) => (
                  <button
                    key={c.id}
                    className="w-full text-right px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
                    onClick={() => {
                      setSelectedCustomer(c);
                      setCustomerSearch("");
                    }}
                  >
                    <span className="text-petra-muted text-xs">{c.phone}</span>
                    <span className="font-medium text-petra-text">{c.name}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedCustomer && (
              <div className="mt-2 flex items-center justify-between bg-brand-50 border border-brand-200 rounded-xl px-3 py-2">
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-petra-muted hover:text-petra-text"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-medium text-petra-text">{selectedCustomer.name}</span>
              </div>
            )}
          </div>
          {!selectedCustomer && (
            <div>
              <label className="label">או מספר טלפון ישיר</label>
              <input
                className="input"
                placeholder="05X-XXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={(!selectedCustomer && !phone) || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "יוצר..." : "צור טופס"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

export default function IntakeFormsPage() {
  return (
    <TierGate
      feature="intake_forms"
      title="טפסי קליטה"
      description="שלח טפסי קליטה ללקוחות לפני ביקור ראשון — מידע רפואי, התנהגותי ועוד. שדרג כדי להפעיל."
    >
      <IntakeFormsContent />
    </TierGate>
  );
}

function IntakeFormsContent() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showNewModal, setShowNewModal] = useState(false);
  const [viewFormId, setViewFormId] = useState<string | null>(null);
  const [deleteForm, setDeleteForm] = useState<IntakeForm | null>(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/intake/form/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intakeForms"] });
      toast.success("הטופס נמחק");
      setDeleteForm(null);
    },
    onError: () => toast.error("שגיאה במחיקת הטופס"),
  });

  const { data: rawForms, isLoading } = useQuery({
    queryKey: ["intakeForms"],
    queryFn: () => fetch("/api/intake/list").then((r) => r.json()),
  });
  const forms: IntakeForm[] = Array.isArray(rawForms) ? rawForms : [];

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const filtered = statusFilter === "ALL"
    ? forms
    : forms.filter((f) => f.status === statusFilter);

  const statusCounts = forms.reduce<Record<string, number>>((acc, f) => {
    acc[f.status] = (acc[f.status] || 0) + 1;
    return acc;
  }, {});

  const FILTERS = [
    { value: "ALL", label: "הכל", count: forms.length },
    { value: "SENT", label: "נשלחו", count: statusCounts.SENT || 0 },
    { value: "OPENED", label: "נפתחו", count: statusCounts.OPENED || 0 },
    { value: "SUBMITTED", label: "הוגשו", count: statusCounts.SUBMITTED || 0 },
    { value: "EXPIRED", label: "פגי תוקף", count: statusCounts.EXPIRED || 0 },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <BoardingTabs />
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">טפסי קליטה</h1>
          <p className="text-sm text-petra-muted mt-1">
            ניהול טפסי קליטה שנשלחו ללקוחות
          </p>
        </div>
        <button
          className="btn-primary gap-1.5"
          onClick={() => setShowNewModal(true)}
        >
          <Plus className="w-4 h-4" />
          טופס חדש
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-sm font-medium transition-all border",
              statusFilter === f.value
                ? "bg-brand-500 text-white border-brand-500"
                : "bg-white text-petra-muted border-slate-200 hover:border-brand-300 hover:text-petra-text"
            )}
          >
            {f.label}
            {f.count > 0 && (
              <span className={cn(
                "mr-1.5 text-xs px-1.5 py-0.5 rounded-full",
                statusFilter === f.value ? "bg-white/20" : "bg-slate-100"
              )}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-petra-muted text-sm">טוען...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state py-12">
            <div className="empty-state-icon">
              <ClipboardList className="w-8 h-8" />
            </div>
            <p className="text-petra-muted text-sm mt-2">
              {statusFilter === "ALL" ? "אין טפסי קליטה עדיין" : "אין טפסים בסטטוס זה"}
            </p>
            <button
              className="btn-primary mt-4 text-sm"
              onClick={() => setShowNewModal(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              שלח טופס ראשון
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="table-header-cell">לקוח</th>
                  <th className="table-header-cell">סטטוס</th>
                  <th className="table-header-cell">נשלח</th>
                  <th className="table-header-cell">נפתח</th>
                  <th className="table-header-cell">הוגש</th>
                  <th className="table-header-cell">פג תוקף</th>
                  <th className="table-header-cell"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((form) => {
                  const isExpired = new Date(form.expiresAt) < new Date() && form.status !== "SUBMITTED";
                  const effectiveStatus = isExpired && form.status !== "SUBMITTED" ? "EXPIRED" : form.status;
                  // Build token URL — we only have the tokenHash, so we can't rebuild the public URL client-side
                  // Instead, provide a copy button for the admin-level resend flow

                  return (
                    <tr key={form.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="table-cell">
                        {form.customer ? (
                          <Link
                            href={`/customers/${form.customer.id}`}
                            className="font-medium text-petra-text hover:text-brand-500 transition-colors flex items-center gap-1"
                          >
                            {form.customer.name}
                            <ExternalLink className="w-3 h-3 text-petra-muted" />
                          </Link>
                        ) : (
                          <span className="text-petra-muted text-sm">
                            {form.phoneE164 || "—"}
                          </span>
                        )}
                        {form.customer && (
                          <p className="text-xs text-petra-muted mt-0.5">{form.customer.phone}</p>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className={cn("badge text-xs", STATUS_COLORS[effectiveStatus] || "badge-neutral")}>
                          {STATUS_LABELS[effectiveStatus] || effectiveStatus}
                        </span>
                      </td>
                      <td className="table-cell text-sm text-petra-muted">
                        {new Date(form.createdAt).toLocaleDateString("he-IL")}
                      </td>
                      <td className="table-cell text-sm text-petra-muted">
                        {form.openedAt
                          ? new Date(form.openedAt).toLocaleDateString("he-IL")
                          : "—"}
                      </td>
                      <td className="table-cell text-sm text-petra-muted">
                        {form.submittedAt ? (
                          <span className="text-emerald-600 font-medium">
                            {new Date(form.submittedAt).toLocaleDateString("he-IL")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="table-cell text-sm text-petra-muted">
                        <span className={cn(isExpired && form.status !== "SUBMITTED" && "text-red-500 font-medium")}>
                          {new Date(form.expiresAt).toLocaleDateString("he-IL")}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1 justify-end">
                          {effectiveStatus === "SUBMITTED" && (
                            <button
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200"
                              title="צפה בתשובות"
                              onClick={() => setViewFormId(form.id)}
                            >
                              <Eye className="w-3 h-3" />
                              צפה בתשובות
                            </button>
                          )}
                          {(() => {
                            // Resend works for both linked customers and phone-only forms
                            const resendPhone = form.customer?.phone || form.phoneE164;
                            if (!resendPhone || !["SENT", "OPENED", "EXPIRED"].includes(effectiveStatus)) return null;
                            return (
                              <button
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors border border-green-200"
                                title="שלח שוב"
                                onClick={() => {
                                  // Create a new intake for this customer / phone
                                  fetch("/api/intake/create", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      customerId: form.customer?.id || null,
                                      phone: resendPhone,
                                    }),
                                  })
                                    .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
                                    .then((data) => {
                                      queryClient.invalidateQueries({ queryKey: ["intakeForms"] });
                                      const msg = `שלום! אנא מלא/י את טופס הקבלה לפני הביקור: ${data.url}`;
                                      window.open(`https://wa.me/${toWhatsAppPhone(resendPhone)}?text=${encodeURIComponent(msg)}`, "_blank");
                                    })
                                    .catch(() => toast.error("שגיאה בשליחת הטופס מחדש"));
                                }}
                              >
                                <RefreshCw className="w-3 h-3" />
                                שלח שוב
                              </button>
                            );
                          })()}
                          <button
                            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 text-petra-muted hover:text-red-500 transition-colors"
                            title="מחק טופס"
                            onClick={() => setDeleteForm(form)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewIntakeModal isOpen={showNewModal} onClose={() => setShowNewModal(false)} />

      {viewFormId && (
        <ViewResponsesModal formId={viewFormId} onClose={() => setViewFormId(null)} />
      )}

      {/* ── Delete confirmation ── */}
      {deleteForm && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setDeleteForm(null)} />
          <div className="modal-content max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-petra-text">מחיקת טופס</h2>
                <p className="text-sm text-petra-muted">
                  {deleteForm.customer?.name || deleteForm.phoneE164 || "ללא נמען"}
                </p>
              </div>
            </div>
            <p className="text-sm text-petra-muted mb-5">
              האם למחוק את טופס הקליטה? פעולה זו בלתי הפיכה
              {deleteForm.status === "SUBMITTED" && " — כולל התשובות שהוגשו"}.
            </p>
            <div className="flex gap-3">
              <button
                className="btn-primary flex-1 !bg-red-500 hover:!bg-red-600"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteForm.id)}
              >
                <Trash2 className="w-4 h-4" />
                {deleteMutation.isPending ? "מוחק..." : "מחק"}
              </button>
              <button className="btn-secondary flex-1" onClick={() => setDeleteForm(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
