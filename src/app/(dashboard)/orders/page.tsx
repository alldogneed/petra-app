"use client";

import { TierGate } from "@/components/paywall/TierGate";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { cn, formatCurrency, formatDate, toWhatsAppPhone } from "@/lib/utils";
import { toast } from "sonner";
import dynamic from "next/dynamic";
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
  { id: "ALL", label: "כל הסטטוסים" },
  { id: "draft", label: "טיוטות" },
  { id: "confirmed", label: "מאושרות" },
  { id: "completed", label: "הושלמו" },
  { id: "cancelled", label: "בוטלו" },
];

const STATUS_INFO: Record<string, { label: string; badgeClass: string; icon: React.ElementType }> = {
  draft: {
    label: "טיוטה",
    badgeClass: "badge bg-slate-100 text-slate-600",
    icon: Clock,
  },
  confirmed: {
    label: "מאושרת",
    badgeClass: "badge bg-blue-50 text-blue-700 border border-blue-100",
    icon: CheckCircle2,
  },
  completed: {
    label: "הושלמה",
    badgeClass: "badge bg-emerald-50 text-emerald-700 border border-emerald-100",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "בוטלה",
    badgeClass: "badge bg-red-50 text-red-600 border border-red-100",
    icon: XCircle,
  },
  canceled: {
    label: "בוטלה",
    badgeClass: "badge bg-red-50 text-red-600 border border-red-100",
    icon: XCircle,
  },
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  // Legacy types (backward compat)
  sale: "מוצרים",
  appointment: "תור",
  // New types
  products: "מוצרים",
  training: "אילוף",
  boarding: "פנסיון",
  grooming: "טיפוח",
  service_dog: "כלבי שירות",
};

function fmt(n: number) { return `₪${n.toFixed(2)}`; }

function shortId(id: string) { return id.slice(-8).toUpperCase(); }

// ── Cancel Confirm Dialog ─────────────────────────────────────────────────────

function CancelDialog({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const qc = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/orders/${orderId}`, { method: "DELETE" }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה בביטול"); return d; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("ההזמנה בוטלה בהצלחה");
      onClose();
    },
    onError: () => toast.error("שגיאה בביטול ההזמנה"),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="text-base font-bold text-petra-text mb-1">לבטל את ההזמנה?</h3>
        <p className="text-sm text-petra-muted mb-4">פעולה זו לא ניתנת לביטול.</p>
        <div className="flex gap-3">
          <button
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-60"
          >
            {cancelMutation.isPending ? "מבטל..." : "כן, בטל"}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">
            חזרה
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function OrdersPageContent() {
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [fromDate, setFromDate] = useState(getTodayStr);
  const [toDate, setToDate] = useState("");
  const queryClient = useQueryClient();

  // Build server-side query params (status + date range only)
  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (activeStatus !== "ALL") p.set("status", activeStatus);
    if (fromDate) p.set("from", fromDate);
    if (toDate) p.set("to", toDate);
    return p.toString();
  }, [activeStatus, fromDate, toDate]);

  const { data: orders = [], isLoading, isFetching: isOrdersFetching } = useQuery<Order[]>({
    queryKey: ["orders", queryParams],
    queryFn: () =>
      fetch(`/api/orders${queryParams ? `?${queryParams}` : ""}`).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch orders");
        return r.json();
      }),
    staleTime: 30_000,
  });

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
    return result;
  }, [orders, customerSearch, paymentFilter]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה בעדכון"); return d; }),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (status === "completed") toast.success("ההזמנה סומנה כהושלמה");
      else if (status === "confirmed") toast.success("ההזמנה אושרה");
      else toast.success("הסטטוס עודכן");
    },
    onError: () => toast.error("שגיאה בעדכון הסטטוס. נסה שוב."),
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
    const STATUS_LABEL: Record<string, string> = {
      draft: "טיוטה", confirmed: "מאושרת", completed: "הושלמה",
      cancelled: "בוטלה", canceled: "בוטלה",
    };
    const TYPE_LABEL: Record<string, string> = {
      sale: "מוצרים", products: "מוצרים", appointment: "תור",
      training: "אילוף", boarding: "פנסיון", grooming: "טיפוח", service_dog: "כלבי שירות",
    };
    const today = new Date().toLocaleDateString("he-IL");
    const rows = filteredOrders.map((o) => {
      const paid = o.payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
      const remaining = Math.max(0, o.total - paid);
      return `
        <tr>
          <td>#${o.id.slice(-8).toUpperCase()}</td>
          <td>${o.customer.name}<br/><small>${o.customer.phone}</small></td>
          <td>${TYPE_LABEL[o.orderType] ?? o.orderType}</td>
          <td>${STATUS_LABEL[o.status] ?? o.status}</td>
          <td style="text-align:left">₪${o.total.toFixed(2)}</td>
          <td style="text-align:left;color:${paid >= o.total ? "#059669" : paid > 0 ? "#d97706" : "#dc2626"}">
            ${paid >= o.total ? "שולם" : paid > 0 ? `₪${paid.toFixed(2)}` : "טרם שולם"}
          </td>
          <td style="text-align:left${remaining > 0 ? ";color:#dc2626;font-weight:600" : ""}">
            ${remaining > 0.01 ? `₪${remaining.toFixed(2)}` : "—"}
          </td>
          <td>${formatDate(o.createdAt)}</td>
        </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<title>הזמנות – פטרה</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Heebo', Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 24px; direction: rtl; }
  h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  .meta { font-size: 11px; color: #64748b; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; font-size: 11px; font-weight: 700; padding: 7px 10px; text-align: right; border-bottom: 2px solid #e2e8f0; }
  td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  small { color: #94a3b8; font-size: 10px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>דוח הזמנות</h1>
<p class="meta">הופק: ${today} · סה"כ: ${filteredOrders.length} הזמנות</p>
<table>
  <thead>
    <tr>
      <th>מס' הזמנה</th>
      <th>לקוח</th>
      <th>סוג</th>
      <th>סטטוס</th>
      <th>סה"כ</th>
      <th>שולם</th>
      <th>יתרה</th>
      <th>תאריך</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) { toast.error("חסום חלון קופץ — אפשר פופ-אפים בדפדפן"); return; }
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
    <div className="space-y-6 animate-fade-in">
      <FinanceTabs />
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="flex items-center gap-2">
          <h1 className="page-title">הזמנות</h1>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["orders"] })}
            title="רענן נתונים"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-petra-muted hover:text-petra-text hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isOrdersFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              className="btn-secondary gap-1.5"
              onClick={() => setShowExportMenu((v) => !v)}
              title="ייצוא"
            >
              <Download className="w-4 h-4" />
              ייצוא
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showExportMenu && (
              <div className="absolute left-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-petra-border z-50 overflow-hidden animate-fade-in">
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-petra-text hover:bg-slate-50 transition-colors"
                  onClick={exportExcel}
                >
                  <Sheet className="w-4 h-4 text-emerald-600" />
                  ייצוא לאקסל
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-petra-text hover:bg-slate-50 transition-colors border-t border-petra-border"
                  onClick={exportPDF}
                >
                  <Printer className="w-4 h-4 text-red-500" />
                  ייצוא ל-PDF
                </button>
              </div>
            )}
          </div>

          <button className="btn-primary" onClick={() => setShowNewOrder(true)}>
            <Plus className="w-4 h-4" />
            הזמנה חדשה
          </button>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-petra-muted uppercase tracking-wider">סה&quot;כ הזמנות</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-slate-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-petra-text">{isLoading ? "—" : stats.total}</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-petra-muted uppercase tracking-wider">טיוטות</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-slate-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-petra-text">{isLoading ? "—" : stats.drafts}</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-petra-muted uppercase tracking-wider">פעילות</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Package className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-600">{isLoading ? "—" : stats.confirmed}</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-petra-muted uppercase tracking-wider">הושלמו</span>
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
          <div className="flex-shrink-0">
            <p className="text-xs font-medium text-petra-muted mb-1.5">סטטוס</p>
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
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Payment status filter */}
          <div className="flex-shrink-0">
            <p className="text-xs font-medium text-petra-muted mb-1.5">סטטוס תשלום</p>
            <div className="flex gap-1.5">
              {[
                { id: "ALL", label: "הכל" },
                { id: "paid", label: "שולם" },
                { id: "unpaid", label: "טרם שולם" },
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
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Customer search */}
          <div className="flex-1 min-w-[180px]">
            <p className="text-xs font-medium text-petra-muted mb-1.5">חיפוש לקוח</p>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                className="input pr-8 text-sm py-2"
                placeholder="שם לקוח..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Date range */}
          <div className="flex gap-2 items-end">
            <div>
              <p className="text-xs font-medium text-petra-muted mb-1.5 flex items-center gap-1">
                <CalendarRange className="w-3 h-3" />
                מתאריך
              </p>
              <input
                type="date"
                className="input text-sm py-2"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs font-medium text-petra-muted mb-1.5">עד תאריך</p>
              <input
                type="date"
                className="input text-sm py-2"
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
                נקה
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="card p-6 space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-xl" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="card">
          <div className="empty-state py-20">
            <div className="empty-state-icon">
              <ShoppingCart className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-petra-text font-semibold mb-1">אין הזמנות</p>
            <p className="text-sm text-petra-muted mb-4">
              {hasActiveFilters
                ? "לא נמצאו הזמנות התואמות את הסינון"
                : "עדיין לא נוצרה אף הזמנה"}
            </p>
            {!hasActiveFilters && (
              <button className="btn-primary text-sm" onClick={() => setShowNewOrder(true)}>
                <Plus className="w-4 h-4" />
                הזמנה חדשה
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
              const isCancellable = order.status === "draft" || order.status === "confirmed";

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
                          {formatCurrency(order.total)}
                        </span>
                        <span className={statusInfo.badgeClass}>
                          <StatusIcon className="w-3 h-3 mr-0.5" />
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-petra-muted">
                      <div className="flex items-center gap-2">
                        <span className="badge-neutral text-[10px]">
                          {ORDER_TYPE_LABELS[order.orderType] ?? order.orderType}
                        </span>
                        <span>{order.lines.length} פריטים</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>{formatDate(order.createdAt)}</span>
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
                            <span className="text-sm font-medium text-petra-text flex-shrink-0 w-20 text-right">
                              {fmt(line.lineTotal)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Totals */}
                      <div className="bg-white rounded-xl border border-petra-border p-3 space-y-1.5">
                        <div className="flex justify-between text-sm text-petra-muted">
                          <span>סכום ביניים</span>
                          <span dir="ltr">{fmt(order.subtotal)}</span>
                        </div>
                        {order.discountAmount > 0 && (
                          <div className="flex justify-between text-sm text-emerald-600">
                            <span>הנחה</span>
                            <span dir="ltr">−{fmt(order.discountAmount)}</span>
                          </div>
                        )}
                        {order.taxTotal > 0 && (
                          <div className="flex justify-between text-sm text-petra-muted">
                            <span>מע&quot;מ</span>
                            <span dir="ltr">{fmt(order.taxTotal)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-bold text-petra-text border-t border-petra-border pt-1.5 mt-1">
                          <span>סה&quot;כ לתשלום</span>
                          <span dir="ltr" className="text-brand-600">{fmt(order.total)}</span>
                        </div>
                        {paidAmount > 0 && (
                          <div className="flex justify-between text-xs text-emerald-600 pt-1">
                            <span>שולם</span>
                            <span dir="ltr">{fmt(paidAmount)}</span>
                          </div>
                        )}
                        {paidAmount > 0 && paidAmount < order.total && (
                          <div className="flex justify-between text-xs text-amber-600">
                            <span>יתרה</span>
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
                          צפה בפרטים
                        </Link>
                        {order.status === "draft" && (
                          <button
                            className="btn-primary text-xs py-1.5 px-3"
                            onClick={(e) => { e.stopPropagation(); statusMutation.mutate({ id: order.id, status: "confirmed" }); }}
                            disabled={statusMutation.isPending}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            אשר הזמנה
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
                              סמן כהושלמה
                            </button>
                            <button
                              className="text-xs py-1.5 px-3 rounded-xl font-medium text-white flex items-center gap-1.5 transition-all hover:opacity-90"
                              style={{ background: "#25D366" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const lineItems = order.lines
                                  .map((l) => `• ${l.name} x${l.quantity} - ${fmt(l.lineTotal)}`)
                                  .join("\n");
                                const discountLine = order.discountAmount > 0
                                  ? `\nהנחה: -${fmt(order.discountAmount)}`
                                  : "";
                                const taxLine = order.taxTotal > 0
                                  ? `\nמע"מ: ${fmt(order.taxTotal)}`
                                  : "";
                                const msg = encodeURIComponent(
                                  `שלום ${order.customer.name},\nהנה פירוט ההזמנה שלך:\n${lineItems}${discountLine}${taxLine}\n\nסה"כ לתשלום: ${fmt(order.total)}`
                                );
                                const waPhone = toWhatsAppPhone(order.customer.phone);
                                window.open(`https://web.whatsapp.com/send?phone=${waPhone}&text=${msg}`, "_blank");
                              }}
                            >
                              <MessageCircle className="w-3 h-3" />
                              שלח בקשת תשלום
                            </button>
                          </>
                        )}
                        {isCancellable && (
                          <button
                            className="btn-danger text-xs py-1.5 px-3"
                            onClick={(e) => { e.stopPropagation(); setCancelOrderId(order.id); }}
                          >
                            <XCircle className="w-3 h-3" />
                            בטל
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
                  <th className="table-header-cell">מס&apos; הזמנה</th>
                  <th className="table-header-cell">לקוח</th>
                  <th className="table-header-cell hidden lg:table-cell">סוג</th>
                  <th className="table-header-cell">סטטוס</th>
                  <th className="table-header-cell">סה&quot;כ לתשלום</th>
                  <th className="table-header-cell">תשלום</th>
                  <th className="table-header-cell">תאריך יצירה</th>
                  <th className="table-header-cell">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-petra-border">
                {filteredOrders.map((order) => {
                  const statusInfo = STATUS_INFO[order.status] ?? STATUS_INFO.draft;
                  const StatusIcon = statusInfo.icon;
                  const isCancellable = order.status === "draft" || order.status === "confirmed";

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
                          {ORDER_TYPE_LABELS[order.orderType] ?? order.orderType}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="table-cell">
                        <span className={cn(statusInfo.badgeClass, "inline-flex items-center gap-1")}>
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="table-cell">
                        <span className="text-sm font-semibold text-petra-text" dir="ltr">
                          {formatCurrency(order.total)}
                        </span>
                      </td>

                      {/* Payment status */}
                      <td className="table-cell">
                        {paidAmountDesk >= order.total ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <CheckCircle2 className="w-3 h-3" />
                            שולם
                          </span>
                        ) : paidAmountDesk > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium bg-amber-50 text-amber-700 border border-amber-100">
                              שולם חלקית
                            </span>
                            <span className="text-[11px] text-petra-muted" dir="ltr">
                              {formatCurrency(paidAmountDesk)} / {formatCurrency(order.total)}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium bg-red-50 text-red-600 border border-red-100">
                            טרם שולם
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="table-cell text-sm text-petra-muted">
                        {formatDate(order.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/orders/${order.id}`}
                            className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            צפה בפרטים
                          </Link>
                          {isCancellable && (
                            <button
                              onClick={() => setCancelOrderId(order.id)}
                              className="p-1.5 rounded-lg text-petra-muted hover:text-red-500 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100"
                              title="בטל הזמנה"
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
            מציג {filteredOrders.length} הזמנות
            {filteredOrders.length !== orders.length && ` (מתוך ${orders.length})`}
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

      {cancelOrderId && (
        <CancelDialog
          orderId={cancelOrderId}
          onClose={() => setCancelOrderId(null)}
        />
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <TierGate
      feature="orders"
      title="ניהול הזמנות"
      description="צור ונהל הזמנות עם פריטי שורה, הנחות ותחשיב מע׳׳מ אוטומטי."
    >
      <OrdersPageContent />
    </TierGate>
  );
}
