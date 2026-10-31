"use client";
import { PageTitle } from "@/components/ui/PageTitle";

import { TierGate } from "@/components/paywall/TierGate";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { DesktopBanner } from "@/components/ui/DesktopBanner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  CreditCard,
  Plus,
  X,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Banknote,
  FileText,
  Loader2,
  MessageCircle,
  Trash2,
  Search,
  Download,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { cn, fetchJSON, toWhatsAppPhone } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { formatCurrency as formatCurrencyL, formatDate as formatDateL, currencySymbol } from "@/lib/format";
import { toast } from "sonner";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { usePermissions } from "@/hooks/usePermissions";

interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
  isDeposit: boolean;
  invoiceNumber: string | null;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  orderId: string | null;
  order: { id: string } | null;
  customer: { id: string; name: string; phone: string };
  appointment: { service: { name: string } | null } | null;
  boardingStay: { pet: { name: string }; room: { name: string } } | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

const PAYMENT_STATUSES = [
  { id: "ALL" },
  { id: "pending" },
  { id: "paid" },
  { id: "canceled" },
];

const DATE_PERIODS = [
  { id: "ALL" },
  { id: "today" },
  { id: "week" },
  { id: "month" },
];

function isInPeriod(dateStr: string, period: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "today") return date >= startOfDay;
  if (period === "week") {
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    return date >= startOfWeek;
  }
  if (period === "month") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return date >= startOfMonth;
  }
  return true;
}

const STATUS_INFO: Record<string, { id: string; color: string; icon: React.ElementType }> = {
  pending: { id: "pending", color: "#F59E0B", icon: Clock },
  paid: { id: "paid", color: "#22C55E", icon: CheckCircle2 },
  canceled: { id: "canceled", color: "#EF4444", icon: XCircle },
};

const METHOD_IDS = ["cash", "credit_card", "bank_transfer", "bit", "paybox", "check"];

function PaymentsPageContent() {
  const t = useTranslations("payments.paymentsPage");
  const tc = useTranslations("common");
  const { locale, currency } = useBusinessLocale();
  const formatCurrency = (amount: number) => formatCurrencyL(amount, { locale, currency });
  const formatDate = (d: Date | string) => formatDateL(d, { locale, style: "long" });
  const methodLabel = (m: string) => (t.has(`methods.${m}`) ? t(`methods.${m}`) : m);
  const { canExportData, canWritePayments } = usePermissions();
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [activePeriod, setActivePeriod] = useState("ALL");
  const [showNewPayment, setShowNewPayment] = useState(false);
  const [issuingPaymentId, setIssuingPaymentId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sentReminders, setSentReminders] = useState<Set<string>>(new Set());
  const [isSendingAll, setIsSendingAll] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const queryClient = useQueryClient();

  // Deep link from the dashboard revenue card: /payments?status=paid&period=month
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const period = params.get("period");
    if (status && PAYMENT_STATUSES.some((s) => s.id === status)) setActiveStatus(status);
    if (period && DATE_PERIODS.some((p) => p.id === period)) setActivePeriod(period);
  }, []);

  const { data: payments = [], isLoading, isError, isFetching: paymentsFetching, refetch: refetchPayments } = useQuery<Payment[]>({
    queryKey: ["payments", activeStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeStatus !== "ALL") params.set("status", activeStatus);
      return fetchJSON(`/api/payments?${params}`);
    },
  });

  // Auto-refresh every 30 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    }, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, queryClient]);

  // Fetch ALL payments for summary stats (unfiltered)
  const { data: allPayments = [] } = useQuery<Payment[]>({
    queryKey: ["payments", "ALL"],
    queryFn: () => fetchJSON("/api/payments"),
  });

  // Check if invoicing is configured
  const { data: invoicingSettings } = useQuery<{ status: string } | null>({
    queryKey: ["invoicing-settings"],
    queryFn: () => fetchJSON("/api/invoicing/settings"),
  });
  const invoicingConfigured = invoicingSettings?.status === "active";

  const markPaidMutation = useMutation({
    mutationFn: (paymentId: string) =>
      fetchJSON(`/api/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setMarkingPaidId(null);
      toast.success(t("toasts.markedPaid"));
    },
    onError: () => {
      setMarkingPaidId(null);
      toast.error(t("toasts.markPaidError"));
    },
  });

  const cancelPaymentMutation = useMutation({
    mutationFn: (paymentId: string) =>
      fetchJSON(`/api/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "canceled" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success(t("toasts.canceled"));
    },
    onError: () => toast.error(t("toasts.cancelError")),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: string) =>
      fetchJSON(`/api/payments/${paymentId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setConfirmDeleteId(null);
      toast.success(t("toasts.deleted"));
    },
    onError: () => {
      setConfirmDeleteId(null);
      toast.error(t("toasts.deleteError"));
    },
  });

  const issueMutation = useMutation({
    mutationFn: (paymentId: string) =>
      fetch("/api/invoicing/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      }).then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || t("toasts.issueFailed"));
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setIssuingPaymentId(null);
      toast.success(t("toasts.issued"));
    },
    onError: (err: Error) => {
      setIssuingPaymentId(null);
      toast.error(err.message || t("toasts.issueError"));
    },
  });

  // Filter payments by customer name search and date period
  const filteredPayments = payments.filter((p) => {
    if (searchQuery.trim() && !p.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (activePeriod !== "ALL" && !isInPeriod(p.createdAt, activePeriod)) return false;
    return true;
  });

  // Summary stats from unfiltered data
  const totalPaid = allPayments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const totalPending = allPayments
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);
  const paidCount = allPayments.filter((p) => p.status === "paid").length;
  const pendingCount = allPayments.filter((p) => p.status === "pending").length;

  // Payment aging buckets (for pending payments only)
  const agingBuckets = useMemo(() => {
    const now = Date.now();
    const pending = allPayments.filter((p) => p.status === "pending");
    const buckets = [
      { id: "d0to30", days: [0, 30], count: 0, total: 0, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
      { id: "d31to60", days: [31, 60], count: 0, total: 0, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
      { id: "d60plus", days: [61, Infinity], count: 0, total: 0, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
    ];
    for (const p of pending) {
      const ageDays = Math.floor((now - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      for (const b of buckets) {
        if (ageDays >= b.days[0] && ageDays <= b.days[1]) {
          b.count++;
          b.total += p.amount;
          break;
        }
      }
    }
    return { buckets, totalPendingCount: pending.length };
  }, [allPayments]);

  function buildReminderText(payment: Payment) {
    const association = payment.appointment?.service?.name
      || (payment.boardingStay ? `פנסיון — ${payment.boardingStay.pet.name}` : ""); // i18n-ok — WhatsApp text sent to the client
    return `שלום ${payment.customer?.name ?? "לקוח"}! 😊\nתזכורת לגבי תשלום ממתין בסך ${formatCurrency(payment.amount)}${association ? ` עבור ${association}` : ""}.\nנשמח לקבל את התשלום בהקדם 🙏`; // i18n-ok — WhatsApp text sent to the client
  }

  async function sendAllReminders() {
    const pending = allPayments.filter(
      (p) => p.status === "pending" && p.customer?.phone
    );
    if (!pending.length) {
      toast.error(t("toasts.noPendingToSend"));
      return;
    }
    setIsSendingAll(true);
    // Mobile browsers block every popup after the first — count only windows
    // that really opened and stop at the first blocked one.
    let opened = 0;
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      const url = `https://api.whatsapp.com/send?phone=${toWhatsAppPhone(p.customer?.phone)}&text=${encodeURIComponent(buildReminderText(p))}`;
      const win = window.open(url, "_blank");
      if (!win) break;
      opened++;
      setSentReminders((prev) => new Set([...prev, p.id]));
      if (i < pending.length - 1) {
        await new Promise((res) => setTimeout(res, 700));
      }
    }
    setIsSendingAll(false);
    const blocked = pending.length - opened;
    if (blocked === 0) {
      toast.success(t("toasts.remindersSent", { count: opened }));
    } else if (opened === 0) {
      toast.error(t("toasts.popupBlocked"));
    } else {
      toast.warning(t("toasts.remindersPartial", { opened, total: pending.length, blocked }));
    }
  }

  function exportCSV() {
    const rows = [
      [t("csv.date"), t("csv.client"), t("csv.amount"), t("csv.method"), t("csv.status"), t("csv.service"), t("csv.order"), t("csv.invoiceNumber")],
      ...filteredPayments.map((p) => [
        formatDate(p.createdAt),
        p.customer?.name ?? "",
        p.amount.toString(),
        methodLabel(p.method),
        STATUS_INFO[p.status] ? t(`statuses.${p.status}`) : p.status,
        p.appointment?.service?.name || (p.boardingStay ? t("csv.boardingService", { pet: p.boardingStay.pet.name }) : ""),
        p.orderId ? `#${p.orderId.slice(-8).toUpperCase()}` : "",
        p.invoiceNumber || "",
      ]),
    ];
    const csvContent = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = t("csv.fileName", { date: new Date().toISOString().slice(0, 10) });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  return (
    <div>
      <DesktopBanner />
      <FinanceTabs />
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="page-title">{t("title")}</h1>
        <p className="text-sm text-petra-muted">
          {searchQuery.trim() ? t("header.countFiltered", { filtered: filteredPayments.length, total: payments.length }) : t("header.count", { count: payments.length })}
        </p>
        {canWritePayments && (
        <button className="btn-primary" onClick={() => setShowNewPayment(true)}>
          <Plus className="w-4 h-4" />
          {t("header.newPayment")}
        </button>
        )}
        {pendingCount > 0 && (
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={sendAllReminders}
            disabled={isSendingAll}
            title={t("header.sendAllTitle", { count: pendingCount })}
          >
            <MessageCircle className="w-4 h-4 text-green-600" />
            {isSendingAll ? t("header.sending") : t("header.sendAll", { count: pendingCount })}
          </button>
        )}
        {canExportData && (
        <button
          className="btn-secondary"
          onClick={exportCSV}
          disabled={filteredPayments.length === 0}
          title={t("header.exportTitle")}
        >
          <Download className="w-4 h-4" />
          {t("header.exportCsv")}
        </button>
        )}
        {/* Refresh controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchPayments()}
            disabled={paymentsFetching}
            title={t("header.refreshNow")}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-petra-muted hover:text-petra-text transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", paymentsFetching && "animate-spin")} />
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? t("header.autoRefreshTurnOff") : t("header.autoRefreshTurnOn")}
            className={cn(
              "flex items-center gap-1.5 px-3 h-8 rounded-lg border text-xs font-medium transition-all",
              autoRefresh
                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                : "bg-white border-slate-200 text-petra-muted hover:text-petra-text"
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
            {autoRefresh ? t("header.autoRefreshActive") : t("header.autoRefresh")}
          </button>
        </div>

        <div className="relative ms-auto">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted pointer-events-none" />
          <input
            type="text"
            placeholder={t("header.searchPlaceholder")}
            className="input ps-9 pe-3 text-sm w-44 sm:w-56"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute end-2 top-1/2 -translate-y-1/2 text-petra-muted hover:text-petra-text"
              onClick={() => setSearchQuery("")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <span className="text-xs text-petra-muted">{t("statuses.paid")}</span>
          </div>
          <span className="text-lg font-bold text-petra-text">{formatCurrency(totalPaid)}</span>
          <span className="text-[10px] text-petra-muted block mt-0.5">{t("summary.paymentsCount", { count: paidCount })}</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-xs text-petra-muted">{t("statuses.pending")}</span>
          </div>
          <span className="text-lg font-bold text-petra-text">{formatCurrency(totalPending)}</span>
          <span className="text-[10px] text-petra-muted block mt-0.5">{t("summary.paymentsCount", { count: pendingCount })}</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-xs text-petra-muted">{t("summary.total")}</span>
          </div>
          <span className="text-lg font-bold text-petra-text">{formatCurrency(totalPaid + totalPending)}</span>
          <span className="text-[10px] text-petra-muted block mt-0.5">{t("summary.paymentsCount", { count: payments.length })}</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <Banknote className="w-4 h-4 text-brand-500" />
            </div>
            <span className="text-xs text-petra-muted">{t("summary.average")}</span>
          </div>
          <span className="text-lg font-bold text-petra-text">
            {payments.length > 0 ? formatCurrency((totalPaid + totalPending) / payments.length) : `${currencySymbol({ locale, currency })}0`}
          </span>
          <span className="text-[10px] text-petra-muted block mt-0.5">{t("summary.perPayment")}</span>
        </div>
      </div>

      {/* Debt Aging Breakdown */}
      {agingBuckets.totalPendingCount > 0 && (
        <div className="card p-4 mb-5 border-s-4 border-amber-400">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-petra-text">{t("aging.title")}</h3>
            <span className="text-xs text-petra-muted">{t("aging.pendingCount", { count: agingBuckets.totalPendingCount })}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {agingBuckets.buckets.map((b) => (
              <div key={b.id} className={`rounded-xl p-3 border ${b.bg} ${b.border}`}>
                <p className={`text-xs font-semibold ${b.color} mb-1`}>{t(`aging.buckets.${b.id}`)}</p>
                <p className={`text-base font-bold ${b.color}`}>{formatCurrency(b.total)}</p>
                <p className={`text-[11px] ${b.color} opacity-70`}>{t("summary.paymentsCount", { count: b.count })}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-1.5">
          {PAYMENT_STATUSES.map((s) => (
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
              {t(`statuses.${s.id}`)}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {DATE_PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePeriod(p.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                activePeriod === p.id
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 text-petra-muted hover:bg-slate-200"
              )}
            >
              {t(`periods.${p.id}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Payments Table */}
      {isLoading ? (
        <PetraLoader />
      ) : isError ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <XCircle className="w-6 h-6 text-red-400" />
          </div>
          <h3 className="text-base font-semibold text-petra-text mb-1">{t("states.loadError")}</h3>
          <p className="text-sm text-petra-muted">{t("states.tryRefresh")}</p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <CreditCard className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-petra-text mb-1">
            {searchQuery.trim() ? t("states.noResults") : t("states.empty")}
          </h3>
          <p className="text-sm text-petra-muted mb-4">
            {searchQuery.trim() ? t("states.tryOtherSearch") : t("states.emptyHint")}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-petra-border">
            {filteredPayments.map((payment) => {
              const statusInfo = STATUS_INFO[payment.status] || STATUS_INFO.pending;
              const StatusIcon = statusInfo.icon;
              const association = payment.appointment
                ? t("row.appointment", { service: payment.appointment.service?.name ?? t("row.noService") })
                : payment.boardingStay
                ? t("row.boarding", { pet: payment.boardingStay.pet.name })
                : null;
              return (
                <div key={payment.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/customers/${payment.customer.id}`}
                        className="text-sm font-medium text-petra-text hover:text-brand-600 transition-colors"
                      >
                        {payment.customer?.name ?? ""}
                      </Link>
                      <p className="text-xs text-petra-muted">{payment.customer?.phone}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold text-petra-text">
                        {formatCurrency(payment.amount)}
                        {payment.isDeposit && (
                          <span className="badge-warning text-[9px] ms-1">{t("row.deposit")}</span>
                        )}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: `${statusInfo.color}15`, color: statusInfo.color }}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {t(`statuses.${statusInfo.id}`)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-xs text-petra-muted">
                    <span>{methodLabel(payment.method)}</span>
                    <span>{formatDate(payment.createdAt)}</span>
                  </div>
                  {association && (
                    <p className="text-xs text-petra-muted mt-0.5">{association}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    {payment.status === "pending" && canWritePayments && (
                      <button
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg transition-colors"
                        disabled={markingPaidId === payment.id}
                        onClick={() => {
                          setMarkingPaidId(payment.id);
                          markPaidMutation.mutate(payment.id);
                        }}
                      >
                        {markingPaidId === payment.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        {t("row.markPaid")}
                      </button>
                    )}
                    {payment.invoiceNumber ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <FileText className="w-3 h-3" />
                        {payment.invoiceNumber}
                      </span>
                    ) : payment.status === "paid" && invoicingConfigured && canWritePayments ? (
                      <button
                        className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1"
                        disabled={issuingPaymentId === payment.id}
                        onClick={() => {
                          setIssuingPaymentId(payment.id);
                          issueMutation.mutate(payment.id);
                        }}
                      >
                        {issuingPaymentId === payment.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <FileText className="w-3 h-3" />
                        )}
                        {t("row.issueDocument")}
                      </button>
                    ) : null}
                    {payment.status === "paid" && payment.customer?.phone && (
                      <a
                        href={`https://api.whatsapp.com/send?phone=${toWhatsAppPhone(payment.customer?.phone)}&text=${encodeURIComponent(`שלום ${payment.customer?.name ?? ""}!\nקיבלנו את תשלומך בסך ${formatCurrency(payment.amount)} - תודה רבה! 🙏`) /* i18n-ok — WhatsApp text sent to the client */}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                        title={t("row.sendReceiptTitle")}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        {t("row.receipt")}
                      </a>
                    )}
                    {payment.status === "pending" && payment.customer?.phone && (
                      sentReminders.has(payment.id) ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {t("row.sent")}
                        </span>
                      ) : (
                        <a
                          href={`https://api.whatsapp.com/send?phone=${toWhatsAppPhone(payment.customer?.phone)}&text=${encodeURIComponent(buildReminderText(payment))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                          title={t("row.sendReminderTitle")}
                          onClick={() => setSentReminders((prev) => new Set([...prev, payment.id]))}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          {t("row.reminder")}
                        </a>
                      )
                    )}
                    {payment.status === "pending" && canWritePayments && (
                      <button
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                        onClick={() => {
                          if (window.confirm(t("row.cancelConfirm", { name: payment.customer?.name ?? t("row.theClient"), amount: formatCurrency(payment.amount) }))) {
                            cancelPaymentMutation.mutate(payment.id);
                          }
                        }}
                        disabled={cancelPaymentMutation.isPending}
                      >
                        <XCircle className="w-3 h-3" />
                        {t("row.cancel")}
                      </button>
                    )}
                    {canWritePayments && (confirmDeleteId === payment.id ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <button
                          className="text-red-600 font-medium hover:underline"
                          onClick={() => deletePaymentMutation.mutate(payment.id)}
                          disabled={deletePaymentMutation.isPending}
                        >
                          {deletePaymentMutation.isPending ? tc("progress.deleting") : tc("actions.delete")}
                        </button>
                        <button
                          className="text-petra-muted hover:underline"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          {tc("actions.cancel")}
                        </button>
                      </span>
                    ) : (
                      <button
                        className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-600 px-1 py-1 rounded transition-colors"
                        onClick={() => setConfirmDeleteId(payment.id)}
                        title={t("row.deletePaymentTitle")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Desktop table */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full">
              <caption className="sr-only">{t("table.caption")}</caption>
              <thead>
                <tr className="border-b border-petra-border">
                  <th scope="col" className="table-header-cell">{t("table.client")}</th>
                  <th scope="col" className="table-header-cell">{t("table.amount")}</th>
                  <th scope="col" className="table-header-cell">{t("table.method")}</th>
                  <th scope="col" className="table-header-cell">{t("table.association")}</th>
                  <th scope="col" className="table-header-cell">{t("table.status")}</th>
                  <th scope="col" className="table-header-cell">{t("table.document")}</th>
                  <th scope="col" className="table-header-cell">{t("table.date")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => {
                  const statusInfo = STATUS_INFO[payment.status] || STATUS_INFO.pending;
                  const StatusIcon = statusInfo.icon;
                  const serviceInfo = payment.appointment
                    ? t("row.appointment", { service: payment.appointment.service?.name ?? t("row.noService") })
                    : payment.boardingStay
                    ? t("row.boarding", { pet: payment.boardingStay.pet.name })
                    : null;

                  return (
                    <tr
                      key={payment.id}
                      className="border-b border-petra-border last:border-0 hover:bg-slate-50 transition-colors"
                    >
                      <td className="table-cell">
                        <div>
                          <Link
                            href={`/customers/${payment.customer.id}`}
                            className="text-sm font-medium text-petra-text hover:text-brand-600 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {payment.customer?.name ?? ""}
                          </Link>
                          <p className="text-[10px] text-petra-muted">
                            {payment.customer?.phone}
                          </p>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="text-sm font-semibold text-petra-text">
                          {formatCurrency(payment.amount)}
                        </span>
                        {payment.isDeposit && (
                          <span className="badge-warning text-[9px] ms-1">{t("row.deposit")}</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className="text-sm text-petra-text">
                          {methodLabel(payment.method)}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="space-y-0.5">
                          {payment.order && (
                            <Link
                              href={`/orders/${payment.order.id}`}
                              className="text-xs font-medium text-brand-600 hover:underline block"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {t("row.order", { id: payment.order.id.slice(-8).toUpperCase() })}
                            </Link>
                          )}
                          {serviceInfo && (
                            <span className="text-xs text-petra-muted">{serviceInfo}</span>
                          )}
                          {!payment.order && !serviceInfo && (
                            <span className="text-xs text-petra-muted">—</span>
                          )}
                        </div>
                      </td>
                      <td className="table-cell">
                        <span
                          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            background: `${statusInfo.color}15`,
                            color: statusInfo.color,
                          }}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {t(`statuses.${statusInfo.id}`)}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2 flex-wrap">
                          {payment.status === "pending" && canWritePayments && (
                            <button
                              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg transition-colors"
                              disabled={markingPaidId === payment.id}
                              onClick={() => {
                                setMarkingPaidId(payment.id);
                                markPaidMutation.mutate(payment.id);
                              }}
                            >
                              {markingPaidId === payment.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3" />
                              )}
                              {t("row.markPaid")}
                            </button>
                          )}
                          {payment.invoiceNumber ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                              <FileText className="w-3 h-3" />
                              {payment.invoiceNumber}
                            </span>
                          ) : payment.status === "paid" && invoicingConfigured && canWritePayments ? (
                            <button
                              className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1"
                              disabled={issuingPaymentId === payment.id}
                              onClick={() => {
                                setIssuingPaymentId(payment.id);
                                issueMutation.mutate(payment.id);
                              }}
                            >
                              {issuingPaymentId === payment.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <FileText className="w-3 h-3" />
                              )}
                              {t("row.issueDocument")}
                            </button>
                          ) : payment.status !== "pending" ? (
                            <span className="text-xs text-petra-muted">—</span>
                          ) : null}
                          {payment.status === "paid" && payment.customer?.phone && (
                            <a
                              href={`https://api.whatsapp.com/send?phone=${toWhatsAppPhone(payment.customer?.phone)}&text=${encodeURIComponent(`שלום ${payment.customer?.name ?? ""}!\nקיבלנו את תשלומך בסך ${formatCurrency(payment.amount)} - תודה רבה! 🙏`) /* i18n-ok — WhatsApp text sent to the client */}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                              title={t("row.sendReceiptTitle")}
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {payment.status === "pending" && payment.customer?.phone && (
                            sentReminders.has(payment.id) ? (
                              <span className="w-7 h-7 flex items-center justify-center text-emerald-600" title={t("row.reminderSentTitle")}>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <a
                                href={`https://api.whatsapp.com/send?phone=${toWhatsAppPhone(payment.customer?.phone)}&text=${encodeURIComponent(buildReminderText(payment))}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                                title={t("row.sendReminderTitle")}
                                onClick={() => setSentReminders((prev) => new Set([...prev, payment.id]))}
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            )
                          )}
                          {payment.status === "pending" && canWritePayments && (
                            <button
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              onClick={() => {
                          if (window.confirm(t("row.cancelConfirm", { name: payment.customer?.name ?? t("row.theClient"), amount: formatCurrency(payment.amount) }))) {
                            cancelPaymentMutation.mutate(payment.id);
                          }
                        }}
                              disabled={cancelPaymentMutation.isPending}
                              title={t("row.cancelPaymentTitle")}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canWritePayments && (confirmDeleteId === payment.id ? (
                            <span className="flex items-center gap-1 text-xs">
                              <button
                                className="text-red-600 font-medium hover:underline"
                                onClick={() => deletePaymentMutation.mutate(payment.id)}
                                disabled={deletePaymentMutation.isPending}
                              >
                                {deletePaymentMutation.isPending ? "..." : tc("actions.delete")}
                              </button>
                              <button
                                className="text-petra-muted hover:underline"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                {t("row.no")}
                              </button>
                            </span>
                          ) : (
                            <button
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-red-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                              onClick={() => setConfirmDeleteId(payment.id)}
                              title={t("row.deletePaymentTitle")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="text-xs text-petra-muted">
                          {formatDate(payment.createdAt)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Payment Modal */}
      {showNewPayment && (
        <NewPaymentModal
          onClose={() => setShowNewPayment(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["payments"] });
            setShowNewPayment(false);
          }}
        />
      )}
    </div>
  );
}

// --- New Payment Modal ---
function NewPaymentModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations("payments.paymentsPage");
  const tc = useTranslations("common");
  const { locale, currency } = useBusinessLocale();
  const [form, setForm] = useState({
    customerId: "",
    amount: "",
    method: "cash",
    status: "paid",
    notes: "",
  });
  const [customerSearch, setCustomerSearch] = useState("");

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers-for-payment"],
    queryFn: () => fetchJSON("/api/customers?full=1"),
  });

  const filteredCustomers = customers.filter((c) => {
    const q = customerSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(customerSearch);
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          amount: parseFloat(data.amount),
        }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      toast.success(t("modal.created"));
      onSuccess();
    },
    onError: () => toast.error(t("modal.createError")),
  });

  const selectedCustomer = customers.find((c) => c.id === form.customerId);

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text">{t("modal.title")}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Customer Selection */}
          <div>
            <label className="label">{t("modal.client")}</label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-petra-text">
                    {selectedCustomer.name}
                  </p>
                  <p className="text-[10px] text-petra-muted">
                    {selectedCustomer.phone}
                  </p>
                </div>
                <button
                  onClick={() => setForm({ ...form, customerId: "" })}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  {t("modal.change")}
                </button>
              </div>
            ) : (
              <div>
                <input
                  className="input mb-2"
                  placeholder={t("modal.searchClient")}
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
                {customerSearch && (
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-petra-border">
                    {filteredCustomers.length === 0 ? (
                      <p className="text-xs text-petra-muted p-2">{t("modal.noClients")}</p>
                    ) : (
                      filteredCustomers.slice(0, 5).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setForm({ ...form, customerId: c.id });
                            setCustomerSearch("");
                          }}
                          className="w-full text-start p-2 hover:bg-slate-50 text-sm"
                        >
                          {c.name} - {c.phone}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="label">{t("modal.amount", { currencySymbol: currencySymbol({ locale, currency }) })}</label>
            <input
              type="number"
              className="input"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0"
              min="0"
              step="0.01"
            />
          </div>

          {/* Method & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("modal.method")}</label>
              <select
                className="input"
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
              >
                {METHOD_IDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`methods.${k}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t("modal.status")}</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="paid">{t("statuses.paid")}</option>
                <option value="pending">{t("statuses.pending")}</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">{t("modal.notes")}</label>
            <textarea
              className="input"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!form.customerId || !form.amount || createMutation.isPending}
            onClick={() => createMutation.mutate(form)}
          >
            <Plus className="w-4 h-4" />
            {createMutation.isPending ? tc("progress.saving") : t("modal.create")}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            {tc("actions.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  const t = useTranslations("payments.paymentsPage");
  return (
    <>
      <PageTitle title={t("title")} />
      <TierGate
      feature="payments"
      title={t("tierTitle")}
      description={t("tierDescription")}
    >
      <PaymentsPageContent />
    </TierGate>
    </>
  );
}
