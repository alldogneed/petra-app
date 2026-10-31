"use client";
import { PageTitle } from "@/components/ui/PageTitle";

import { TierGate } from "@/components/paywall/TierGate";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { DesktopBanner } from "@/components/ui/DesktopBanner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { canCancelOrder } from "@/lib/order-cancel";
import { PaymentRequestDialog } from "@/components/orders/PaymentRequestDialog";
import {
  ShoppingCart,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Package,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Search,
  CalendarRange,
  X,
  Eye,
  Trash2,
  Tag,
  AlertTriangle,
  RefreshCw,
  Download,
  Sheet,
  Printer,
  CreditCard,
} from "lucide-react";
import { cn, escapeHtml } from "@/lib/utils";
import { formatCurrency, formatDate, currencySymbol } from "@/lib/format";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { usePermissions } from "@/hooks/usePermissions";
const CreateOrderModal = dynamic(
  () => import("@/components/orders/CreateOrderModal").then((m) => ({ default: m.CreateOrderModal })),
  { ssr: false }
);

interface OrderLine {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
  priceListItemId?: string | null;
}

interface Order {
  id: string;
  customerId: string;
  status: string;
  orderType: string;
  subtotal: number;
  discountAmount: number;
  taxTotal: number;
  total: number;
  notes: string | null;
  createdAt: string;
  customer: { id: string; name: string; phone: string };
  lines: OrderLine[];
  payments: { id: string; amount: number; status: string }[];
}

const ORDER_STATUSES = [
  { id: "ALL", labelKey: "all" },
  { id: "active", labelKey: "active" },
  { id: "draft", labelKey: "draft" },
  { id: "confirmed", labelKey: "confirmed" },
  { id: "completed", labelKey: "completed" },
  { id: "cancelled", labelKey: "cancelled" },
];

// Labels: orders.ordersPage.statuses.<id>
const STATUS_INFO: Record<string, { badgeClass: string; icon: React.ElementType }> = {
  draft: {
    badgeClass: "badge bg-slate-100 text-slate-600",
    icon: Clock,
  },
  confirmed: {
    badgeClass: "badge bg-blue-50 text-blue-700 border border-blue-100",
    icon: CheckCircle2,
  },
  completed: {
    badgeClass: "badge bg-emerald-50 text-emerald-700 border border-emerald-100",
    icon: CheckCircle2,
  },
  cancelled: {
    badgeClass: "badge bg-red-50 text-red-600 border border-red-100",
    icon: XCircle,
  },
  canceled: {
    badgeClass: "badge bg-red-50 text-red-600 border border-red-100",
    icon: XCircle,
  },
};

type OrdersT = ReturnType<typeof useTranslations<"orders">>;

// Order types (legacy: sale, appointment; new: products, training, boarding,
// grooming, service_dog) — labels in orders.ordersPage.types.<id>
function orderTypeLabel(t: OrdersT, type: string) {
  return t.has(`ordersPage.types.${type}`) ? t(`ordersPage.types.${type}`) : type;
}

function orderStatusLabel(t: OrdersT, status: string) {
  return t.has(`ordersPage.statuses.${status}`) ? t(`ordersPage.statuses.${status}`) : status;
}

function shortId(id: string) { return id.slice(-8).toUpperCase(); }

// ── Cancel Confirm Dialog ─────────────────────────────────────────────────────

function CancelDialog({ orderId, orderStatus, onClose }: { orderId: string; orderStatus?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const t = useTranslations("orders");
  const tc = useTranslations("common");

  const isDelete = orderStatus === "draft" || orderStatus === "cancelled";

  const cancelMutation = useMutation({
    mutationFn: () => {
      // Draft and cancelled orders can be deleted; confirmed orders are cancelled via PATCH
      if (isDelete) {
        return fetch(`/api/orders/${orderId}`, { method: "DELETE" }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("ordersPage.cancelDialog.deleteError")); return d; });
      }
      return fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("ordersPage.cancelDialog.cancelError")); return d; });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(isDelete ? t("ordersPage.cancelDialog.deleted") : t("ordersPage.cancelDialog.cancelled"));
      onClose();
    },
    onError: () => toast.error(isDelete ? t("ordersPage.cancelDialog.deleteFailed") : t("ordersPage.cancelDialog.cancelFailed")),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="text-base font-bold text-petra-text mb-1">
          {isDelete ? t("ordersPage.cancelDialog.deleteTitle") : t("ordersPage.cancelDialog.cancelTitle")}
        </h3>
        <p className="text-sm text-petra-muted mb-4">{t("ordersPage.cancelDialog.irreversible")}</p>
        <div className="flex gap-3">
          <button
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-60"
          >
            {cancelMutation.isPending ? (isDelete ? tc("progress.deleting") : t("ordersPage.cancelDialog.cancelling")) : (isDelete ? t("ordersPage.cancelDialog.confirmDelete") : t("ordersPage.cancelDialog.confirmCancel"))}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">
            {t("ordersPage.cancelDialog.back")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getTodayStr() { return toDateStr(new Date()); }
function get30DaysAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return toDateStr(d);
}

function OrdersPageContent() {
  const { canExportData } = usePermissions();
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const { locale, currency, cfg } = useBusinessLocale();
  const sym = currencySymbol({ locale, currency });
  const fmt = (n: number) => `${sym}${n.toFixed(2)}`;
  const money = (n: number) => formatCurrency(n, { locale, currency });
  const fmtDate = (d: string) => formatDate(d, { locale });
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancelOrder, setCancelOrder] = useState<{ id: string; status: string } | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [fromDate, setFromDate] = useState(get30DaysAgoStr);
  const [toDate, setToDate] = useState("");
  const [sortField, setSortField] = useState<"createdAt" | "total" | "customer">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Deep link from the dashboard: /orders?status=confirmed&payment=unpaid.
  // Dashboard counts are all-time, so a deep link drops the default 30-day window.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const payment = params.get("payment");
    if (status && ORDER_STATUSES.some((s) => s.id === status)) setActiveStatus(status);
    if (payment === "paid" || payment === "unpaid") setPaymentFilter(payment);
    if (status || payment) setFromDate("");
  }, []);

  function toggleSort(field: "createdAt" | "total" | "customer") {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  }
  const queryClient = useQueryClient();

  // Build server-side query params (status + date range only)
  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (activeStatus !== "ALL") p.set("status", activeStatus);
    if (fromDate) p.set("from", fromDate);
    if (toDate) p.set("to", toDate);
    return p.toString();
  }, [activeStatus, fromDate, toDate]);

  const { data: orders = [], isLoading, isError: isOrdersError, isFetching: isOrdersFetching } = useQuery<Order[]>({
    queryKey: ["orders", queryParams],
    queryFn: () =>
      fetch(`/api/orders${queryParams ? `?${queryParams}` : ""}`).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch orders");
        return r.json();
      }),
    staleTime: 30_000,
  });


  const [paymentRequestOrder, setPaymentRequestOrder] = useState<Order | null>(null);

  // Client-side filters: customer name + payment status
  const filteredOrders = useMemo(() => {
    let result = orders;
    if (customerSearch.trim()) {
      const q = customerSearch.toLowerCase();
      result = result.filter((o) => o.customer.name.toLowerCase().includes(q));
    }
    if (paymentFilter !== "ALL") {
      result = result.filter((o) => {
        const paid = o.payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
        if (paymentFilter === "paid") return paid >= o.total;
        if (paymentFilter === "unpaid") return paid < o.total;
        return true;
      });
    }
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === "createdAt") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortField === "total") cmp = a.total - b.total;
      else if (sortField === "customer") cmp = a.customer.name.localeCompare(b.customer.name, cfg.lang);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [orders, customerSearch, paymentFilter, sortField, sortDir]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("ordersPage.toasts.updateError")); return d; }),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (status === "completed") toast.success(t("ordersPage.toasts.markedCompleted"));
      else if (status === "confirmed") toast.success(t("ordersPage.toasts.confirmed"));
      else toast.success(t("ordersPage.toasts.statusUpdated"));
    },
    onError: () => toast.error(t("ordersPage.toasts.statusUpdateFailed")),
  });

  // Stats (based on full unfiltered list)
  const stats = useMemo(() => ({
    total: orders.length,
    drafts: orders.filter((o) => o.status === "draft").length,
    confirmed: orders.filter((o) => o.status === "confirmed").length,
    completed: orders.filter((o) => o.status === "completed").length,
  }), [orders]);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExportMenu]);

  function exportExcel() {
    const p = new URLSearchParams();
    if (activeStatus !== "ALL") p.set("status", activeStatus);
    if (fromDate) p.set("from", fromDate);
    if (toDate) p.set("to", toDate);
    window.location.href = `/api/orders/export?${p.toString()}`;
    setShowExportMenu(false);
  }

  function exportPDF() {
    setShowExportMenu(false);
    const origin = window.location.origin;
    const today = new Date().toLocaleDateString(locale);
    const rows = filteredOrders.map((o) => {
      const paid = o.payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
      const remaining = Math.max(0, o.total - paid);
      return `
        <tr>
          <td>#${o.id.slice(-8).toUpperCase()}</td>
          <td>${escapeHtml(o.customer.name)}<br/><small>${escapeHtml(o.customer.phone)}</small></td>
          <td>${orderTypeLabel(t, o.orderType)}</td>
          <td>${orderStatusLabel(t, o.status)}</td>
          <td style="text-align:end">${sym}${o.total.toFixed(2)}</td>
          <td style="text-align:end;color:${paid >= o.total ? "#059669" : paid > 0 ? "#d97706" : "#dc2626"}">
            ${paid >= o.total ? t("ordersPage.print.colPaid") : paid > 0 ? `${sym}${paid.toFixed(2)}` : t("ordersPage.paymentFilters.unpaid")}
          </td>
          <td style="text-align:end${remaining > 0 ? ";color:#dc2626;font-weight:600" : ""}">
            ${remaining > 0.01 ? `${sym}${remaining.toFixed(2)}` : "—"}
          </td>
          <td>${fmtDate(o.createdAt)}</td>
        </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html dir="${cfg.dir}" lang="${cfg.lang}">
<head>
<meta charset="UTF-8">
<title>${t("ordersPage.print.docTitle")}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Heebo', Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 24px; direction: ${cfg.dir}; }
  h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  .meta { font-size: 11px; color: #64748b; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; font-size: 11px; font-weight: 700; padding: 7px 10px; text-align: start; border-bottom: 2px solid #e2e8f0; }
  td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  small { color: #94a3b8; font-size: 10px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e2e8f0;">
  <img src="${origin}/petra-logo.png" alt="Petra" style="width:36px;height:36px;object-fit:contain;border-radius:6px;" />
  <div>
    <h1 style="margin:0">${t("ordersPage.print.heading")}</h1>
    <p class="meta" style="margin:2px 0 0 0">${t("ordersPage.print.meta", { date: today, count: filteredOrders.length })}</p>
  </div>
</div>
<table>
              <caption className="sr-only">${t("ordersPage.print.caption")}</caption>
  <thead>
    <tr>
      <th>${t("ordersPage.print.colOrderNumber")}</th>
      <th>${t("ordersPage.print.colClient")}</th>
      <th>${t("ordersPage.print.colType")}</th>
      <th>${t("ordersPage.print.colStatus")}</th>
      <th>${t("ordersPage.print.colTotal")}</th>
      <th>${t("ordersPage.print.colPaid")}</th>
      <th>${t("ordersPage.print.colBalance")}</th>
      <th>${t("ordersPage.print.colDate")}</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) { toast.error(t("ordersPage.toasts.popupBlocked")); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  }

  const hasActiveFilters = customerSearch || fromDate || toDate || activeStatus !== "ALL" || paymentFilter !== "ALL";

  function clearFilters() {
    setCustomerSearch("");
    setFromDate(getTodayStr());
    setToDate("");
    setActiveStatus("ALL");
    setPaymentFilter("ALL");
  }

  return (
    // overflow-x-clip: a too-wide child must scroll inside its own box, never
    // widen the page — a wide element here zoomed the whole mobile viewport out.
    <div className="space-y-6 animate-fade-in max-w-full overflow-x-clip">
      {paymentRequestOrder && <PaymentRequestDialog order={paymentRequestOrder} onClose={() => setPaymentRequestOrder(null)} />}
      <DesktopBanner />
      <FinanceTabs />
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="flex items-center gap-2">
          <h1 className="page-title">{t("ordersPage.header.title")}</h1>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["orders"] })}
            title={t("ordersPage.header.refresh")}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-petra-muted hover:text-petra-text hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isOrdersFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          {canExportData && (
          <div className="relative" ref={exportMenuRef}>
            <button
              className="btn-secondary gap-1.5"
              onClick={() => setShowExportMenu((v) => !v)}
              title={t("ordersPage.header.export")}
            >
              <Download className="w-4 h-4" />
              {t("ordersPage.header.export")}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showExportMenu && (
              <div className="absolute end-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-petra-border z-50 overflow-hidden animate-fade-in">
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-petra-text hover:bg-slate-50 transition-colors"
                  onClick={exportExcel}
                >
                  <Sheet className="w-4 h-4 text-emerald-600" />
                  {t("ordersPage.header.exportExcel")}
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-petra-text hover:bg-slate-50 transition-colors border-t border-petra-border"
                  onClick={exportPDF}
                >
                  <Printer className="w-4 h-4 text-red-500" />
                  {t("ordersPage.header.exportPdf")}
                </button>
              </div>
            )}
          </div>
          )}

          <button className="btn-primary" onClick={() => setShowNewOrder(true)}>
            <Plus className="w-4 h-4" />
            {t("ordersPage.header.newOrder")}
          </button>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-petra-muted uppercase tracking-wider">{t("ordersPage.stats.total")}</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-slate-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-petra-text">{isLoading ? "—" : stats.total}</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-petra-muted uppercase tracking-wider">{t("ordersPage.stats.drafts")}</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-slate-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-petra-text">{isLoading ? "—" : stats.drafts}</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-petra-muted uppercase tracking-wider">{t("ordersPage.stats.active")}</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Package className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-600">{isLoading ? "—" : stats.confirmed}</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-petra-muted uppercase tracking-wider">{t("ordersPage.stats.completed")}</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <FileText className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{isLoading ? "—" : stats.completed}</p>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Status tabs */}
          <div className="min-w-0 max-w-full">
            <p className="text-xs font-medium text-petra-muted mb-1.5">{t("ordersPage.filters.status")}</p>
            <div className="flex gap-1.5 flex-wrap">
              {ORDER_STATUSES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveStatus(s.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                    activeStatus === s.id
                      ? "bg-brand-500 text-white border-brand-500"
                      : "bg-white text-petra-muted border-petra-border hover:border-slate-300 hover:text-petra-text"
                  )}
                >
                  {t(`ordersPage.statusFilters.${s.labelKey}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Payment status filter */}
          <div className="min-w-0 max-w-full">
            <p className="text-xs font-medium text-petra-muted mb-1.5">{t("ordersPage.filters.paymentStatus")}</p>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { id: "ALL", labelKey: "all" },
                { id: "paid", labelKey: "paid" },
                { id: "unpaid", labelKey: "unpaid" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setPaymentFilter(f.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                    paymentFilter === f.id
                      ? f.id === "paid"
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : f.id === "unpaid"
                        ? "bg-red-500 text-white border-red-500"
                        : "bg-brand-500 text-white border-brand-500"
                      : "bg-white text-petra-muted border-petra-border hover:border-slate-300 hover:text-petra-text"
                  )}
                >
                  {t(`ordersPage.paymentFilters.${f.labelKey}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Customer search */}
          <div className="flex-1 min-w-[180px]">
            <p className="text-xs font-medium text-petra-muted mb-1.5">{t("ordersPage.filters.clientSearch")}</p>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                className="input ps-8 text-sm py-2"
                placeholder={t("ordersPage.filters.clientSearchPlaceholder")}
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Date presets */}
          <div className="flex gap-1.5 items-center flex-wrap">
            {[
              { labelKey: "today", fn: () => { setFromDate(getTodayStr()); setToDate(getTodayStr()); } },
              { labelKey: "week", fn: () => { const d = new Date(); const day = d.getDay(); const start = new Date(d); start.setDate(d.getDate() - day); setFromDate(toDateStr(start)); setToDate(getTodayStr()); } },
              { labelKey: "month", fn: () => { const d = new Date(); setFromDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`); setToDate(getTodayStr()); } },
              { labelKey: "all", fn: () => { setFromDate(""); setToDate(""); } },
            ].map(({ labelKey, fn }) => (
              <button key={labelKey} onClick={fn} className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-petra-muted hover:text-petra-text transition-colors">
                {t(`ordersPage.datePresets.${labelKey}`)}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <p className="text-xs font-medium text-petra-muted mb-1.5 flex items-center gap-1">
                <CalendarRange className="w-3 h-3" />
                {t("ordersPage.filters.fromDate")}
              </p>
              <input
                type="date" lang={cfg.lang}
                className="input text-sm py-2 w-[8.5rem] max-w-full"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs font-medium text-petra-muted mb-1.5">{t("ordersPage.filters.toDate")}</p>
              <input
                type="date" lang={cfg.lang}
                className="input text-sm py-2 w-[8.5rem] max-w-full"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="btn-ghost text-xs py-2 px-2.5 mb-0.5"
              >
                <X className="w-3.5 h-3.5" />
                {t("ordersPage.filters.clear")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      {isLoading ? (
        <PetraLoader />
      ) : isOrdersError ? (
        <div className="card">
          <div className="empty-state py-20">
            <div className="empty-state-icon">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
            <p className="text-petra-text font-semibold mb-1">{t("ordersPage.states.loadError")}</p>
            <p className="text-sm text-petra-muted mb-4">{t("ordersPage.states.loadErrorHint")}</p>
            <button className="btn-secondary text-sm" onClick={() => window.location.reload()}>
              {t("ordersPage.states.reload")}
            </button>
          </div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="card">
          <div className="empty-state py-20">
            <div className="empty-state-icon">
              <ShoppingCart className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-petra-text font-semibold mb-1">{t("ordersPage.states.empty")}</p>
            <p className="text-sm text-petra-muted mb-4">
              {hasActiveFilters
                ? t("ordersPage.states.emptyFiltered")
                : t("ordersPage.states.emptyNone")}
            </p>
            {hasActiveFilters ? (
              <button className="btn-secondary text-sm" onClick={clearFilters}>
                {t("ordersPage.states.showAll")}
              </button>
            ) : (
              <button className="btn-primary text-sm" onClick={() => setShowNewOrder(true)}>
                <Plus className="w-4 h-4" />
                {t("ordersPage.header.newOrder")}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* ── Mobile cards ── */}
          <div className="md:hidden divide-y divide-petra-border">
            {filteredOrders.map((order) => {
              const statusInfo = STATUS_INFO[order.status] ?? STATUS_INFO.draft;
              const StatusIcon = statusInfo.icon;
              const isExpanded = expandedId === order.id;
              const paidAmount = order.payments
                .filter((p) => p.status === "paid")
                .reduce((sum, p) => sum + p.amount, 0);
              const isCancellable = canCancelOrder(order.status, order.payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0));

              return (
                <div key={order.id}>
                  <div
                    className={cn(
                      "p-4 cursor-pointer hover:bg-slate-50 transition-colors",
                      isExpanded && "bg-slate-50"
                    )}
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-mono text-petra-muted mb-0.5">#{shortId(order.id)}</p>
                        <p className="text-sm font-medium text-petra-text">{order.customer.name}</p>
                        <p className="text-xs text-petra-muted">{order.customer.phone}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-sm font-semibold text-petra-text">
                          {money(order.total)}
                        </span>
                        <span className={statusInfo.badgeClass}>
                          <StatusIcon className="w-3 h-3 ms-0.5" />
                          {orderStatusLabel(t, STATUS_INFO[order.status] ? order.status : "draft")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-petra-muted">
                      <div className="flex items-center gap-2">
                        <span className="badge-neutral text-[10px]">
                          {orderTypeLabel(t, order.orderType)}
                        </span>
                        <span>{t("ordersPage.card.items", { count: order.lines.length })}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>{fmtDate(order.createdAt)}</span>
                        {isExpanded
                          ? <ChevronUp className="w-3.5 h-3.5" />
                          : <ChevronDown className="w-3.5 h-3.5" />
                        }
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 bg-slate-50 border-t border-petra-border animate-fade-in space-y-3">
                      {/* Line items */}
                      <div className="bg-white rounded-xl border border-petra-border overflow-hidden">
                        {order.lines.map((line) => (
                          <div
                            key={line.id}
                            className="flex items-center gap-2 px-3 py-2 border-b border-petra-border last:border-0"
                          >
                            <span className="flex-1 text-sm text-petra-text">{line.name}</span>
                            <span className="text-xs text-petra-muted flex-shrink-0">
                              {line.quantity} × {fmt(line.unitPrice)}
                            </span>
                            <span className="text-sm font-medium text-petra-text flex-shrink-0 w-20 text-start">
                              {fmt(line.lineTotal)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Totals */}
                      <div className="bg-white rounded-xl border border-petra-border p-3 space-y-1.5">
                        <div className="flex justify-between text-sm text-petra-muted">
                          <span>{t("ordersPage.card.subtotal")}</span>
                          <span dir="ltr">{fmt(order.subtotal)}</span>
                        </div>
                        {order.discountAmount > 0 && (
                          <div className="flex justify-between text-sm text-emerald-600">
                            <span>{t("ordersPage.card.discount")}</span>
                            <span dir="ltr">−{fmt(order.discountAmount)}</span>
                          </div>
                        )}
                        {order.taxTotal > 0 && (
                          <div className="flex justify-between text-sm text-petra-muted">
                            <span>{t("ordersPage.card.vat")}</span>
                            <span dir="ltr">{fmt(order.taxTotal)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-bold text-petra-text border-t border-petra-border pt-1.5 mt-1">
                          <span>{t("ordersPage.card.totalDue")}</span>
                          <span dir="ltr" className="text-brand-600">{fmt(order.total)}</span>
                        </div>
                        {paidAmount > 0 && (
                          <div className="flex justify-between text-xs text-emerald-600 pt-1">
                            <span>{t("ordersPage.card.paid")}</span>
                            <span dir="ltr">{fmt(paidAmount)}</span>
                          </div>
                        )}
                        {paidAmount > 0 && paidAmount < order.total && (
                          <div className="flex justify-between text-xs text-amber-600">
                            <span>{t("ordersPage.card.balance")}</span>
                            <span dir="ltr">{fmt(order.total - paidAmount)}</span>
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      {order.notes && (
                        <p className="text-xs text-petra-muted bg-white rounded-xl border border-petra-border p-3">
                          {order.notes}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap">
                        <Link
                          href={`/orders/${order.id}`}
                          className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {t("ordersPage.actions.viewDetails")}
                        </Link>
                        {paidAmount < order.total && order.status !== "cancelled" && (
                          <Link
                            href={`/orders/${order.id}?pay=1`}
                            className="btn-primary text-xs py-1.5 px-3 gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            {t("ordersPage.actions.recordPayment")}
                          </Link>
                        )}
                        {order.status === "draft" && (
                          <button
                            className="btn-primary text-xs py-1.5 px-3"
                            onClick={(e) => { e.stopPropagation(); statusMutation.mutate({ id: order.id, status: "confirmed" }); }}
                            disabled={statusMutation.isPending}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {t("ordersPage.actions.confirmOrder")}
                          </button>
                        )}
                        {order.status === "confirmed" && (
                          <>
                            <button
                              className="btn-primary text-xs py-1.5 px-3"
                              onClick={(e) => { e.stopPropagation(); statusMutation.mutate({ id: order.id, status: "completed" }); }}
                              disabled={statusMutation.isPending}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {t("ordersPage.actions.markCompleted")}
                            </button>
                            <button
                              className="text-xs py-1.5 px-3 rounded-xl font-medium text-white flex items-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-60"
                              style={{ background: "#25D366" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPaymentRequestOrder(order);
                              }}
                            >
                              <MessageCircle className="w-3 h-3" />
                              {t("ordersPage.actions.sendPaymentRequest")}
                            </button>
                          </>
                        )}
                        {isCancellable && (
                          <button
                            className="btn-danger text-xs py-1.5 px-3"
                            onClick={(e) => { e.stopPropagation(); setCancelOrder({ id: order.id, status: order.status }); }}
                          >
                            <XCircle className="w-3 h-3" />
                            {t("ordersPage.actions.cancel")}
                          </button>
                        )}
                        {order.status === "cancelled" && (
                          <button
                            className="btn-danger text-xs py-1.5 px-3"
                            onClick={(e) => { e.stopPropagation(); setCancelOrder({ id: order.id, status: order.status }); }}
                          >
                            <Trash2 className="w-3 h-3" />
                            {tc("actions.delete")}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Desktop table ── */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-petra-border bg-slate-50/60">
                  <th scope="col" className="table-header-cell">{t("ordersPage.table.orderNumber")}</th>
                  <th scope="col" className="table-header-cell cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort("customer")}>
                    <span className="flex items-center gap-1">
                      {t("ordersPage.table.client")}
                      {sortField === "customer" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3 text-petra-primary" /> : <ChevronDown className="w-3 h-3 text-petra-primary" />) : <ChevronDown className="w-3 h-3 text-slate-300" />}
                    </span>
                  </th>
                  <th scope="col" className="table-header-cell hidden lg:table-cell">{t("ordersPage.table.type")}</th>
                  <th scope="col" className="table-header-cell">{t("ordersPage.table.status")}</th>
                  <th scope="col" className="table-header-cell cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort("total")}>
                    <span className="flex items-center gap-1">
                      {t("ordersPage.table.totalDue")}
                      {sortField === "total" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3 text-petra-primary" /> : <ChevronDown className="w-3 h-3 text-petra-primary" />) : <ChevronDown className="w-3 h-3 text-slate-300" />}
                    </span>
                  </th>
                  <th scope="col" className="table-header-cell">{t("ordersPage.table.payment")}</th>
                  <th scope="col" className="table-header-cell cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort("createdAt")}>
                    <span className="flex items-center gap-1">
                      {t("ordersPage.table.createdAt")}
                      {sortField === "createdAt" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3 text-petra-primary" /> : <ChevronDown className="w-3 h-3 text-petra-primary" />) : <ChevronDown className="w-3 h-3 text-slate-300" />}
                    </span>
                  </th>
                  <th scope="col" className="table-header-cell">{t("ordersPage.table.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-petra-border">
                {filteredOrders.map((order) => {
                  const statusInfo = STATUS_INFO[order.status] ?? STATUS_INFO.draft;
                  const StatusIcon = statusInfo.icon;
                  const isCancellable = canCancelOrder(order.status, order.payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0));

                  const paidAmountDesk = order.payments
                    .filter((p) => p.status === "paid")
                    .reduce((sum, p) => sum + p.amount, 0);

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Order number */}
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                            <Tag className="w-3.5 h-3.5 text-brand-500" />
                          </div>
                          <span className="font-mono text-sm font-semibold text-petra-text">
                            #{shortId(order.id)}
                          </span>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="table-cell">
                        <Link
                          href={`/customers/${order.customer.id}`}
                          className="text-sm font-medium text-brand-600 hover:underline block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {order.customer.name}
                        </Link>
                        <p className="text-xs text-petra-muted" dir="ltr">{order.customer.phone}</p>
                      </td>

                      {/* Type */}
                      <td className="table-cell hidden lg:table-cell">
                        <span className="badge-neutral text-xs">
                          {orderTypeLabel(t, order.orderType)}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="table-cell">
                        <span className={cn(statusInfo.badgeClass, "inline-flex items-center gap-1")}>
                          <StatusIcon className="w-3 h-3" />
                          {orderStatusLabel(t, STATUS_INFO[order.status] ? order.status : "draft")}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="table-cell">
                        <span className="text-sm font-semibold text-petra-text" dir="ltr">
                          {money(order.total)}
                        </span>
                      </td>

                      {/* Payment status */}
                      <td className="table-cell">
                        {paidAmountDesk >= order.total ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <CheckCircle2 className="w-3 h-3" />
                            {t("ordersPage.table.paid")}
                          </span>
                        ) : paidAmountDesk > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium bg-amber-50 text-amber-700 border border-amber-100">
                              {t("ordersPage.table.partiallyPaid")}
                            </span>
                            <span className="text-[11px] text-petra-muted" dir="ltr">
                              {money(paidAmountDesk)} / {money(order.total)}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium bg-red-50 text-red-600 border border-red-100">
                            {t("ordersPage.table.unpaid")}
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="table-cell text-sm text-petra-muted">
                        {fmtDate(order.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/orders/${order.id}`}
                            className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {t("ordersPage.actions.viewDetails")}
                          </Link>
                          {paidAmountDesk < order.total && order.status !== "cancelled" && (
                            <Link
                              href={`/orders/${order.id}?pay=1`}
                              className="btn-primary text-xs py-1.5 px-3 gap-1.5"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              {t("ordersPage.actions.recordPayment")}
                            </Link>
                          )}
                          {order.status === "draft" && (
                            <button
                              className="btn-primary text-xs py-1.5 px-3 gap-1.5"
                              onClick={() => statusMutation.mutate({ id: order.id, status: "confirmed" })}
                              disabled={statusMutation.isPending}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {t("ordersPage.actions.confirmOrder")}
                            </button>
                          )}
                          {order.status === "confirmed" && (
                            <>
                              <button
                                className="btn-primary text-xs py-1.5 px-3 gap-1.5"
                                onClick={() => statusMutation.mutate({ id: order.id, status: "completed" })}
                                disabled={statusMutation.isPending}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {t("ordersPage.actions.completed")}
                              </button>
                              <button
                                className="text-xs py-1.5 px-3 rounded-xl font-medium text-white flex items-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-60"
                                style={{ background: "#25D366" }}
                                onClick={() => setPaymentRequestOrder(order)}
                                title={t("ordersPage.actions.sendPaymentRequestWhatsApp")}
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                {t("ordersPage.actions.sendPaymentRequest")}
                              </button>
                            </>
                          )}
                          {isCancellable && (
                            <button
                              onClick={() => setCancelOrder({ id: order.id, status: order.status })}
                              className="p-1.5 rounded-lg text-petra-muted hover:text-red-500 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100"
                              title={t("ordersPage.actions.cancelOrder")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {order.status === "cancelled" && (
                            <button
                              onClick={() => setCancelOrder({ id: order.id, status: order.status })}
                              className="p-1.5 rounded-lg text-petra-muted hover:text-red-500 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100"
                              title={t("ordersPage.actions.deleteOrder")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

          {/* Count footer */}
          <div className="px-5 py-3 border-t border-petra-border bg-slate-50/40 text-xs text-petra-muted">
            {t("ordersPage.footer.showing", { count: filteredOrders.length })}
            {filteredOrders.length !== orders.length && t("ordersPage.footer.ofTotal", { total: orders.length })}
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <CreateOrderModal
        isOpen={showNewOrder}
        onClose={() => setShowNewOrder(false)}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          setShowNewOrder(false);
        }}
      />

      {cancelOrder && (
        <CancelDialog
          orderId={cancelOrder.id}
          orderStatus={cancelOrder.status}
          onClose={() => setCancelOrder(null)}
        />
      )}
    </div>
  );
}

export default function OrdersPage() {
  const t = useTranslations("orders");
  return (
    <>
      <PageTitle title={t("ordersPage.pageTitle")} />
      <TierGate
      feature="orders"
      title={t("ordersPage.tierGate.title")}
      description={t("ordersPage.tierGate.description")}
    >
      <OrdersPageContent />
    </TierGate>
    </>
  );
}
