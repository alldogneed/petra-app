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
  const queryClient = useQueryClient();

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
                          {form.customer && ["SENT", "OPENED", "EXPIRED"].includes(effectiveStatus) && (
                            <button
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors border border-green-200"
                              title="שלח שוב"
                              onClick={() => {
                                // Create a new intake for this customer
                                fetch("/api/intake/create", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    customerId: form.customer!.id,
                                    phone: form.customer!.phone,
                                  }),
                                })
                                  .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
                                  .then((data) => {
                                    queryClient.invalidateQueries({ queryKey: ["intakeForms"] });
                                    const msg = `שלום! אנא מלא/י את טופס הקבלה לפני הביקור: ${data.url}`;
                                    window.open(`https://wa.me/${toWhatsAppPhone(form.customer!.phone)}?text=${encodeURIComponent(msg)}`, "_blank");
                                  })
                                  .catch(() => toast.error("שגיאה בשליחת הטופס מחדש"));
                              }}
                            >
                              <RefreshCw className="w-3 h-3" />
                              שלח שוב
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
      </div>

      <NewIntakeModal isOpen={showNewModal} onClose={() => setShowNewModal(false)} />
    </div>
  );
}
