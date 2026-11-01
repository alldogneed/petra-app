"use client";
import Link from "next/link";
import { PageTitle } from "@/components/ui/PageTitle";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { TierGate } from "@/components/paywall/TierGate";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import {
  Receipt,
  Plus,
  ExternalLink,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  CreditCard,
  X,
  Search,
  AlertTriangle,
} from "lucide-react";
import { cn, fetchJSON } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { INVOICE_DOCUMENT_TYPES, INVOICE_STATUSES, VAT_RATE } from "@/lib/constants";
import { isVatExempt } from "@/lib/legal-entity";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { usePermissions } from "@/hooks/usePermissions";

// ─── Types ───────────────────────────────────────────────────────────────────

interface InvoiceDocument {
  id: string;
  docType: number;
  docTypeName: string;
  amount: number;
  subtotal: number | null;
  taxTotal: number | null;
  currency: string;
  status: string;
  documentNumber: string | null;
  documentUrl: string | null;
  providerDocId: string | null;
  providerName: string;
  notes: string | null;
  failureReason: string | null;
  originalInvoiceId: string | null;
  createdAt: string;
  customerId: string | null;
  customer: { name: string } | null;
  payment: { amount: number; method: string } | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

// ─── Status helpers ──────────────────────────────────────────────────────────

function getStatusBadge(status: string) {
  const s = INVOICE_STATUSES.find((s) => s.id === status);
  const label = s?.label ?? status;
  const colorMap: Record<string, string> = {
    draft: "badge-neutral",
    pending: "badge-warning",
    issued: "badge-success",
    failed: "badge-danger",
    cancelled: "badge-neutral",
  };
  return <span className={cn("badge text-xs", colorMap[status] ?? "badge-neutral")}>{label}</span>;
}

function getStatusIcon(status: string) {
  switch (status) {
    case "draft": return <FileText className="w-4 h-4 text-slate-400" />;
    case "pending": return <Clock className="w-4 h-4 text-amber-500" />;
    case "issued": return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    case "failed": return <XCircle className="w-4 h-4 text-red-500" />;
    case "cancelled": return <XCircle className="w-4 h-4 text-slate-400" />;
    default: return <FileText className="w-4 h-4 text-slate-400" />;
  }
}

// ─── Summary Cards ──────────────────────────────────────────────────────────

function SummaryCards({ documents }: { documents: InvoiceDocument[] }) {
  const t = useTranslations("finance.invoicesPage");
  const { locale, currency } = useBusinessLocale();
  const issued = documents.filter((d) => d.status === "issued");
  const thisMonth = issued.filter((d) => {
    const date = new Date(d.createdAt);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const drafts = documents.filter((d) => d.status === "draft");
  const failed = documents.filter((d) => d.status === "failed");

  const cards = [
    { label: t("summary.issued"), value: String(issued.length), icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: t("summary.monthTotal"), value: formatCurrency(thisMonth.reduce((s, d) => s + d.amount, 0), { locale, currency }), icon: Receipt, color: "text-brand-600", bg: "bg-brand-50" },
    { label: t("summary.drafts"), value: String(drafts.length), icon: FileText, color: "text-slate-600", bg: "bg-slate-50" },
    { label: t("summary.failed"), value: String(failed.length), icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="stat-card">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", card.bg)}>
                <Icon className={cn("w-5 h-5", card.color)} />
              </div>
              <div>
                <p className="text-xs text-petra-muted">{card.label}</p>
                <p className="text-lg font-bold text-petra-text">{card.value}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Create Invoice Modal ───────────────────────────────────────────────────

function CreateInvoiceModal({
  onClose,
  onSuccess,
  vatExempt,
  vatRate,
}: {
  onClose: () => void;
  onSuccess: () => void;
  vatExempt: boolean;
  vatRate: number;
}) {
  const t = useTranslations("finance.invoicesPage");
  const tc = useTranslations("common");
  const { locale, currency } = useBusinessLocale();
  const [customerId, setCustomerId] = useState("");
  // עוסק פטור may not issue tax invoices — receipts only
  const availableDocTypes = vatExempt
    ? INVOICE_DOCUMENT_TYPES.filter((dt) => dt.id === 400 || dt.id === 330)
    : INVOICE_DOCUMENT_TYPES;
  const [docType, setDocType] = useState(vatExempt ? 400 : 320);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([{ description: "", quantity: 1, unitPrice: 0 }]);
  const [search, setSearch] = useState("");

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["customers-search", search],
    queryFn: () => fetchJSON<Customer[]>(`/api/customers?search=${encodeURIComponent(search)}&limit=20`),
    enabled: search.length > 0,
  });

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch("/api/invoicing/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || t("errors.create"));
        }
        return r.json();
      }),
    onSuccess,
  });

  const addLine = () => setLines([...lines, { description: "", quantity: 1, unitPrice: 0 }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: string, value: string | number) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: value };
    setLines(updated);
  };

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const vat = Math.round(subtotal * vatRate * 100) / 100;
  const total = subtotal + vat;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-petra-text">{t("newInvoice")}</h2>
            <p className="text-sm text-petra-muted mt-0.5">{t("create.subtitle")}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Customer Search */}
          <div>
            <label className="label">{t("create.customerLabel")}</label>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted" />
              <input
                className="input ps-10"
                placeholder={t("create.customerSearch")}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCustomerId(""); }}
              />
            </div>
            {customers && customers.length > 0 && !customerId && (
              <div className="mt-1 border rounded-xl max-h-40 overflow-y-auto bg-white shadow-lg">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    className="w-full text-start px-3 py-2 hover:bg-slate-50 text-sm"
                    onClick={() => { setCustomerId(c.id); setSearch(c.name); }}
                  >
                    {c.name} · {c.phone}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Document Type */}
          <div>
            <label className="label">{t("create.docType")}</label>
            <select className="input" value={docType} onChange={(e) => setDocType(Number(e.target.value))}>
              {availableDocTypes.map((dt) => (
                <option key={dt.id} value={dt.id}>{dt.label}</option>
              ))}
            </select>
            {vatExempt && (
              <p className="text-xs text-petra-muted mt-1">{t("create.vatExemptNote")}</p>
            )}
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">{t("create.lines")}</label>
              <button className="text-xs text-brand-500 hover:text-brand-600 font-medium" onClick={addLine}>{t("create.addLine")}</button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_32px] sm:grid-cols-[1fr_80px_100px_32px] gap-2 items-center">
                  <input
                    className="input text-sm col-span-3 sm:col-span-1"
                    placeholder={t("create.description")}
                    value={line.description}
                    onChange={(e) => updateLine(i, "description", e.target.value)}
                  />
                  <input
                    className="input text-sm text-center"
                    type="number"
                    min={1}
                    placeholder={t("create.quantity")}
                    value={line.quantity}
                    onChange={(e) => updateLine(i, "quantity", Number(e.target.value))}
                  />
                  <input
                    className="input text-sm"
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder={t("create.price")}
                    value={line.unitPrice || ""}
                    onChange={(e) => updateLine(i, "unitPrice", Number(e.target.value))}
                  />
                  {lines.length > 1 && (
                    <button
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400 hover:text-red-500"
                      onClick={() => removeLine(i)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-petra-muted">
              <span>{t("create.subtotal")}</span>
              <span>{formatCurrency(subtotal, { locale, currency })}</span>
            </div>
            <div className="flex justify-between text-petra-muted">
              <span>{vatExempt ? t("create.vatExemptLine") : t("create.vatLine", { rate: Math.round(vatRate * 100) })}</span>
              <span>{formatCurrency(vat, { locale, currency })}</span>
            </div>
            <div className="flex justify-between font-bold text-petra-text">
              <span>{t("create.total")}</span>
              <span>{formatCurrency(total, { locale, currency })}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">{t("create.notes")}</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={!customerId || subtotal <= 0 || mutation.isPending}
            onClick={() => mutation.mutate({ customerId, docType, lines, notes })}
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {mutation.isPending ? t("create.creating") : t("create.createDraft")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

function InvoicesPageContent() {
  const t = useTranslations("finance.invoicesPage");
  const { locale, currency } = useBusinessLocale();
  const queryClient = useQueryClient();
  const { canWritePayments } = usePermissions();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [docTypeFilter, setDocTypeFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: "credit" | "delete"; doc: InvoiceDocument } | null>(null);

  // Business settings — legal entity type drives VAT display + allowed doc types
  const { data: settings } = useQuery<{ legalEntityType: string | null; vatEnabled?: boolean; vatRate?: number }>({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });
  const vatExempt = isVatExempt(settings?.legalEntityType);
  const vatFree = vatExempt || settings?.vatEnabled === false;
  const effectiveVatRate = vatFree ? 0 : settings?.vatRate ?? VAT_RATE;

  const { data: documents = [], isLoading } = useQuery<InvoiceDocument[]>({
    queryKey: ["invoicing-documents", statusFilter, docTypeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (docTypeFilter !== "all") params.set("docType", docTypeFilter);
      return fetchJSON<InvoiceDocument[]>(`/api/invoicing/documents?${params}`);
    },
  });

  const issueMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      fetch("/api/invoicing/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || t("errors.issue"));
        }
        return r.json();
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoicing-documents"] }),
    onError: (err: Error) => toast.error(err.message || t("errors.issueInvoice")),
  });

  const creditNoteMutation = useMutation({
    mutationFn: (originalInvoiceId: string) =>
      fetch("/api/invoicing/credit-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalInvoiceId }),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || t("errors.credit"));
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoicing-documents"] });
      setConfirmAction(null);
      toast.success(t("toasts.creditCreated"));
    },
    onError: (err: Error) => toast.error(err.message || t("errors.credit")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/invoicing/documents/${id}`, { method: "DELETE" }).then(async (r) => {
        if (!r.ok) throw new Error(t("errors.delete"));
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoicing-documents"] });
      setConfirmAction(null);
      toast.success(t("toasts.draftDeleted"));
    },
    onError: () => toast.error(t("errors.deleteDoc")),
  });

  // Status filter tabs
  const statusTabs = [
    { id: "all", label: t("filters.all") },
    ...INVOICE_STATUSES.map((s) => ({ id: s.id, label: s.label })),
  ];

  // Doc type sub-filter
  const docTypeTabs = [
    { id: "all", label: t("filters.all") },
    ...INVOICE_DOCUMENT_TYPES.map((dt) => ({ id: String(dt.id), label: dt.label })),
  ];

  return (
    <div>
      <FinanceTabs />
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">{t("title")}</h1>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          {t("newInvoice")}
        </button>
      </div>

      {!isLoading && <SummaryCards documents={documents} />}

      {/* Status Filter Tabs */}
      <div className="flex gap-1 mb-3 p-1 bg-slate-100 rounded-xl overflow-x-auto scrollbar-hide">
        {statusTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              statusFilter === tab.id ? "bg-white text-petra-text shadow-sm" : "text-petra-muted hover:text-petra-text"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Doc Type Sub-filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {docTypeTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setDocTypeFilter(tab.id)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
              docTypeFilter === tab.id
                ? "bg-brand-50 border-brand-200 text-brand-700"
                : "bg-white border-slate-200 text-petra-muted hover:border-slate-300"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <PetraLoader />
      ) : documents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Receipt className="w-8 h-8" />
          </div>
          <p className="text-petra-muted text-sm mt-3">{t("empty")}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t("table.caption")}</caption>
              <thead>
                <tr className="border-b border-slate-100">
                  <th scope="col" className="table-header-cell">#</th>
                  <th scope="col" className="table-header-cell">{t("table.type")}</th>
                  <th scope="col" className="table-header-cell">{t("table.customer")}</th>
                  <th scope="col" className="table-header-cell">{t("table.amount")}</th>
                  <th scope="col" className="table-header-cell">{t("table.status")}</th>
                  <th scope="col" className="table-header-cell">{t("table.date")}</th>
                  <th scope="col" className="table-header-cell">{t("table.docNumber")}</th>
                  <th scope="col" className="table-header-cell">{t("table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(doc.status)}
                        <span className="text-xs text-petra-muted font-mono">{doc.id.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs font-medium">{doc.docTypeName}</span>
                    </td>
                    <td className="table-cell font-medium">
                      {doc.customer?.name && doc.customerId ? (
                        <Link
                          href={`/customers/${doc.customerId}`}
                          className="hover:text-brand-600 hover:underline transition-colors"
                        >
                          {doc.customer.name}
                        </Link>
                      ) : (
                        doc.customer?.name ?? "—"
                      )}
                    </td>
                    <td className="table-cell">
                      <span className={cn("font-semibold", doc.amount < 0 ? "text-red-600" : "text-petra-text")}>
                        {formatCurrency(Math.abs(doc.amount), { locale, currency })}
                      </span>
                      {doc.amount < 0 && <span className="text-xs text-red-500 ms-1">{t("table.creditTag")}</span>}
                    </td>
                    <td className="table-cell">{getStatusBadge(doc.status)}</td>
                    <td className="table-cell text-petra-muted text-xs">{formatDate(doc.createdAt, { locale, style: "long" })}</td>
                    <td className="table-cell">
                      {doc.documentNumber ? (
                        <span className="font-mono text-xs">{doc.documentNumber}</span>
                      ) : (
                        <span className="text-xs text-petra-muted">—</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        {/* View on provider */}
                        {doc.documentUrl && (
                          <a
                            href={doc.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-petra-muted hover:text-brand-500 transition-colors"
                            title={t("actions.view")}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {/* Issue draft / re-issue failed */}
                        {canWritePayments && (doc.status === "draft" || doc.status === "failed") && (
                          <button
                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-petra-muted hover:text-emerald-600 transition-colors"
                            onClick={() => issueMutation.mutate(doc.id)}
                            disabled={issueMutation.isPending}
                            title={doc.status === "failed" ? t("actions.retry") : t("actions.issue")}
                          >
                            {issueMutation.isPending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : doc.status === "failed" ? (
                              <RefreshCw className="w-3.5 h-3.5" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        {/* Create credit note */}
                        {canWritePayments && doc.status === "issued" && doc.docType !== 330 && !doc.originalInvoiceId && (
                          <button
                            className="p-1.5 rounded-lg hover:bg-red-50 text-petra-muted hover:text-red-500 transition-colors"
                            onClick={() => setConfirmAction({ type: "credit", doc })}
                            disabled={creditNoteMutation.isPending}
                            title={t("actions.createCredit")}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete draft */}
                        {doc.status === "draft" && (
                          <button
                            className="p-1.5 rounded-lg hover:bg-red-50 text-petra-muted hover:text-red-500 transition-colors"
                            onClick={() => setConfirmAction({ type: "delete", doc })}
                            disabled={deleteMutation.isPending}
                            title={t("actions.deleteDraft")}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Error message */}
                      {doc.failureReason && doc.status === "failed" && (
                        <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={doc.failureReason}>
                          {doc.failureReason}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm credit-note / delete-draft dialog */}
      {confirmAction && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setConfirmAction(null)} />
          <div className="modal-content max-w-sm mx-4 p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-petra-text mb-1">
              {confirmAction.type === "credit" ? t("confirm.creditTitle") : t("confirm.deleteTitle")}
            </h3>
            <p className="text-sm text-petra-muted mb-4">
              {confirmAction.type === "credit"
                ? t("confirm.creditBody", {
                    name: confirmAction.doc.customer?.name ?? t("confirm.documentFallback"),
                    amount: formatCurrency(Math.abs(confirmAction.doc.amount), { locale, currency }),
                  })
                : t("confirm.irreversible")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() =>
                  confirmAction.type === "credit"
                    ? creditNoteMutation.mutate(confirmAction.doc.id)
                    : deleteMutation.mutate(confirmAction.doc.id)
                }
                disabled={creditNoteMutation.isPending || deleteMutation.isPending}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {creditNoteMutation.isPending || deleteMutation.isPending
                  ? t("confirm.working")
                  : confirmAction.type === "credit"
                    ? t("confirm.confirmCredit")
                    : t("confirm.confirmDelete")}
              </button>
              <button onClick={() => setConfirmAction(null)} className="btn-secondary flex-1">
                {t("confirm.back")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateInvoiceModal
          vatExempt={vatExempt}
          vatRate={effectiveVatRate}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ["invoicing-documents"] });
          }}
        />
      )}
    </div>
  );
}

export default function InvoicesPage() {
  const t = useTranslations("finance.invoicesPage");
  return (
    <>
      <PageTitle title={t("title")} />
      <TierGate
      feature="invoicing"
      title={t("tierGate.title")}
      description={t("tierGate.description")}
      upgradeTier="pro"
    >
      <InvoicesPageContent />
    </TierGate>
    </>
  );
}
