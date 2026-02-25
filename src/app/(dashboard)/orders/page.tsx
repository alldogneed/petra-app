"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  DollarSign,
  Banknote,
  MessageCircle,
} from "lucide-react";
import { cn, formatCurrency, formatDate, toWhatsAppPhone } from "@/lib/utils";
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
  { id: "ALL", label: "הכל" },
  { id: "draft", label: "טיוטה" },
  { id: "confirmed", label: "מאושרת" },
  { id: "completed", label: "הושלמה" },
  { id: "canceled", label: "בוטלה" },
];

const STATUS_INFO: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: "טיוטה", color: "#94A3B8", icon: FileText },
  confirmed: { label: "מאושרת", color: "#3B82F6", icon: CheckCircle2 },
  completed: { label: "הושלמה", color: "#22C55E", icon: CheckCircle2 },
  canceled: { label: "בוטלה", color: "#EF4444", icon: XCircle },
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  sale: "מכירה",
  appointment: "תור",
  boarding: "פנסיון",
};

function fmt(n: number) { return `₪${n.toFixed(2)}`; }

export default function OrdersPage() {
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["orders", activeStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeStatus !== "ALL") params.set("status", activeStatus);
      return fetch(`/api/orders?${params}`).then((r) => r.json());
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  // Summary stats
  const completedTotal = orders
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + o.total, 0);
  const pendingTotal = orders
    .filter((o) => o.status === "draft" || o.status === "confirmed")
    .reduce((sum, o) => sum + o.total, 0);
  const confirmedCount = orders.filter((o) => o.status === "confirmed").length;
  const avgOrder = orders.length > 0
    ? orders.reduce((sum, o) => sum + o.total, 0) / orders.length
    : 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="page-title">הזמנות</h1>
        <p className="text-sm text-petra-muted">{orders.length} הזמנות</p>
        <button className="btn-primary" onClick={() => setShowNewOrder(true)}>
          <Plus className="w-4 h-4" />
          הזמנה חדשה
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <span className="text-xs text-petra-muted">הושלם</span>
          </div>
          <span className="text-lg font-bold text-petra-text">{formatCurrency(completedTotal)}</span>
          <span className="text-[10px] text-petra-muted block mt-0.5">
            {orders.filter((o) => o.status === "completed").length} הזמנות
          </span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-xs text-petra-muted">ממתין</span>
          </div>
          <span className="text-lg font-bold text-petra-text">{formatCurrency(pendingTotal)}</span>
          <span className="text-[10px] text-petra-muted block mt-0.5">
            {orders.filter((o) => o.status === "draft" || o.status === "confirmed").length} הזמנות
          </span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Package className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-xs text-petra-muted">מאושרות</span>
          </div>
          <span className="text-lg font-bold text-petra-text">{confirmedCount}</span>
          <span className="text-[10px] text-petra-muted block mt-0.5">הזמנות פעילות</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <Banknote className="w-4 h-4 text-brand-500" />
            </div>
            <span className="text-xs text-petra-muted">ממוצע</span>
          </div>
          <span className="text-lg font-bold text-petra-text">{formatCurrency(avgOrder)}</span>
          <span className="text-[10px] text-petra-muted block mt-0.5">להזמנה</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-6">
        {ORDER_STATUSES.map((s) => (
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

      {/* Orders Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card p-4 animate-pulse h-16" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <ShoppingCart className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין הזמנות</h3>
          <p className="text-sm text-petra-muted mb-4">צור הזמנה חדשה כדי להתחיל</p>
          <button className="btn-primary" onClick={() => setShowNewOrder(true)}>
            <Plus className="w-4 h-4" />
            הזמנה חדשה
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-petra-border">
                  <th className="table-header-cell">לקוח</th>
                  <th className="table-header-cell">סוג</th>
                  <th className="table-header-cell">פריטים</th>
                  <th className="table-header-cell">סה״כ</th>
                  <th className="table-header-cell">סטטוס</th>
                  <th className="table-header-cell">תאריך</th>
                  <th className="table-header-cell">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const statusInfo = STATUS_INFO[order.status] || STATUS_INFO.draft;
                  const StatusIcon = statusInfo.icon;
                  const isExpanded = expandedId === order.id;
                  const paidAmount = order.payments
                    .filter((p) => p.status === "paid")
                    .reduce((sum, p) => sum + p.amount, 0);

                  return (
                    <tr key={order.id} className="group">
                      <td colSpan={7} className="p-0">
                        {/* Main row */}
                        <div
                          className={cn(
                            "grid grid-cols-[1fr_80px_60px_90px_100px_90px_100px] items-center cursor-pointer hover:bg-slate-50 transition-colors",
                            isExpanded && "bg-slate-50"
                          )}
                          onClick={() => setExpandedId(isExpanded ? null : order.id)}
                        >
                          <div className="table-cell">
                            <p className="text-sm font-medium text-petra-text">{order.customer.name}</p>
                            <p className="text-[10px] text-petra-muted">{order.customer.phone}</p>
                          </div>
                          <div className="table-cell">
                            <span className="badge-neutral text-[10px]">
                              {ORDER_TYPE_LABELS[order.orderType] || order.orderType}
                            </span>
                          </div>
                          <div className="table-cell">
                            <span className="text-xs text-petra-muted">{order.lines.length}</span>
                          </div>
                          <div className="table-cell">
                            <span className="text-sm font-semibold text-petra-text">
                              {formatCurrency(order.total)}
                            </span>
                          </div>
                          <div className="table-cell">
                            <span
                              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{ background: `${statusInfo.color}15`, color: statusInfo.color }}
                            >
                              <StatusIcon className="w-3 h-3" />
                              {statusInfo.label}
                            </span>
                          </div>
                          <div className="table-cell">
                            <span className="text-xs text-petra-muted">{formatDate(order.createdAt)}</span>
                          </div>
                          <div className="table-cell">
                            <div className="flex items-center gap-1">
                              {isExpanded
                                ? <ChevronUp className="w-4 h-4 text-petra-muted" />
                                : <ChevronDown className="w-4 h-4 text-petra-muted" />
                              }
                            </div>
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 bg-slate-50 border-t border-petra-border animate-fade-in">
                            {/* Lines */}
                            <div className="bg-white rounded-xl border border-petra-border overflow-hidden mb-3">
                              {order.lines.map((line) => (
                                <div
                                  key={line.id}
                                  className="flex items-center gap-2 px-3 py-2 border-b border-petra-border last:border-0"
                                >
                                  <span className="flex-1 text-sm text-petra-text">{line.name}</span>
                                  <span className="text-xs text-petra-muted flex-shrink-0">
                                    {line.quantity} × {fmt(line.unitPrice)}
                                  </span>
                                  <span className="text-sm font-medium text-petra-text flex-shrink-0 w-20 text-left">
                                    {fmt(line.lineTotal)}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Totals */}
                            <div className="bg-white rounded-xl border border-petra-border p-3 space-y-1 mb-3">
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
                                  <span>כולל מע&quot;מ</span>
                                  <span dir="ltr">{fmt(order.taxTotal)}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-base font-bold text-petra-text border-t border-petra-border pt-1.5 mt-1.5">
                                <span>סה&quot;כ</span>
                                <span dir="ltr">{fmt(order.total)}</span>
                              </div>
                              {paidAmount > 0 && (
                                <div className="flex justify-between text-sm text-emerald-600 pt-1">
                                  <span>שולם</span>
                                  <span dir="ltr">{fmt(paidAmount)}</span>
                                </div>
                              )}
                              {paidAmount > 0 && paidAmount < order.total && (
                                <div className="flex justify-between text-sm text-amber-600">
                                  <span>יתרה</span>
                                  <span dir="ltr">{fmt(order.total - paidAmount)}</span>
                                </div>
                              )}
                            </div>

                            {/* Notes */}
                            {order.notes && (
                              <p className="text-xs text-petra-muted bg-white rounded-xl border border-petra-border p-3 mb-3">
                                {order.notes}
                              </p>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2">
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
                                        ? `\nכולל מע"מ: ${fmt(order.taxTotal)}`
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
                              {(order.status === "draft" || order.status === "confirmed") && (
                                <button
                                  className="btn-danger text-xs py-1.5 px-3"
                                  onClick={(e) => { e.stopPropagation(); statusMutation.mutate({ id: order.id, status: "canceled" }); }}
                                  disabled={statusMutation.isPending}
                                >
                                  <XCircle className="w-3 h-3" />
                                  בטל
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      <CreateOrderModal
        isOpen={showNewOrder}
        onClose={() => setShowNewOrder(false)}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          setShowNewOrder(false);
        }}
      />
    </div>
  );
}
