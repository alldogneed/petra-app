"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
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
} from "lucide-react";
import { cn, formatCurrency, formatDate, toWhatsAppPhone } from "@/lib/utils";
import { toast } from "sonner";
import { CreateOrderModal } from "@/components/orders/CreateOrderModal";

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
  sale: "מכירה",
  appointment: "תור",
  boarding: "פנסיון",
};

function fmt(n: number) { return `₪${n.toFixed(2)}`; }

function shortId(id: string) { return id.slice(-8).toUpperCase(); }

// ── Cancel Confirm Dialog ─────────────────────────────────────────────────────

function CancelDialog({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const qc = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/orders/${orderId}`, { method: "DELETE" }).then((r) => r.json()),
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

export default function OrdersPage() {
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
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

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["orders", queryParams],
    queryFn: () =>
      fetch(`/api/orders${queryParams ? `?${queryParams}` : ""}`).then((r) => r.json()),
    staleTime: 30_000,
  });

  // Client-side customer name filter
  const filteredOrders = useMemo(() => {
    if (!customerSearch.trim()) return orders;
    const q = customerSearch.toLowerCase();
    return orders.filter((o) => o.customer.name.toLowerCase().includes(q));
  }, [orders, customerSearch]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
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

  const hasActiveFilters = customerSearch || fromDate || toDate || activeStatus !== "ALL";

  function clearFilters() {
    setCustomerSearch("");
    setFromDate("");
    setToDate("");
    setActiveStatus("ALL");
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">הזמנות</h1>
          <p className="text-sm text-petra-muted mt-0.5">ניהול הזמנות וחשבוניות</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNewOrder(true)}>
          <Plus className="w-4 h-4" />
          הזמנה חדשה
        </button>
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
                                window.open(`https://wa.me/${waPhone}?text=${msg}`, "_blank");
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
                  <th className="table-header-cell">תאריך יצירה</th>
                  <th className="table-header-cell">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-petra-border">
                {filteredOrders.map((order) => {
                  const statusInfo = STATUS_INFO[order.status] ?? STATUS_INFO.draft;
                  const StatusIcon = statusInfo.icon;
                  const isCancellable = order.status === "draft" || order.status === "confirmed";

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
