"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, CheckCircle2, Clock, XCircle, ShoppingCart,
  Trash2, User, FileText, Calendar, Tag,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useState } from "react";

interface OrderLine {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
  taxMode: string;
  priceListItemId: string | null;
}

interface Order {
  id: string;
  status: string;
  orderType: string;
  startAt: string | null;
  endAt: string | null;
  subtotal: number;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  taxTotal: number;
  total: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; phone: string; email: string | null };
  lines: OrderLine[];
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:     { label: "טיוטה",  color: "bg-slate-100 text-slate-600 border-transparent",    icon: Clock },
  confirmed: { label: "מאושר", color: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: CheckCircle2 },
  cancelled: { label: "בוטל",  color: "bg-red-50 text-red-600 border-red-100",             icon: XCircle },
};

const ORDER_TYPE_MAP: Record<string, string> = {
  sale: "🛒 מכירה", appointment: "📅 תור", boarding: "🏠 פנסיון",
};

const UNIT_LABEL: Record<string, string> = {
  per_session: "לפגישה", per_day: "ליום", per_night: "ללילה",
  per_hour: "לשעה", per_item: "ליחידה", fixed: "קבוע",
};

function fmt(n: number) { return `₪${n.toFixed(2)}`; }

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const orderId = params.id as string;
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data: order, isLoading } = useQuery<Order>({
    queryKey: ["order", orderId],
    queryFn: () => fetch(`/api/orders/${orderId}`).then((r) => r.json()),
    staleTime: 30_000,
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order", orderId] }),
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/orders/${orderId}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      router.push("/orders");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-slate-100 rounded-lg" />
        <div className="h-32 bg-slate-100 rounded-2xl" />
        <div className="h-64 bg-slate-100 rounded-2xl" />
      </div>
    );
  }

  if (!order || (order as { error?: string }).error) {
    return (
      <div className="py-20 text-center">
        <p className="text-petra-muted">הזמנה לא נמצאה</p>
        <Link href="/orders" className="text-brand-600 text-sm hover:underline mt-2 inline-block">חזרה לרשימה</Link>
      </div>
    );
  }

  const s = STATUS_MAP[order.status] ?? STATUS_MAP.draft;
  const StatusIcon = s.icon;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/orders" className="text-petra-muted hover:text-brand-600 transition-colors">הזמנות</Link>
        <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="text-petra-text font-medium">#{orderId.slice(-8).toUpperCase()}</span>
      </div>

      {/* Header card */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="w-5 h-5 text-brand-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-petra-text">
                  הזמנה #{orderId.slice(-8).toUpperCase()}
                </h1>
                <span className={cn("inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border", s.color)}>
                  <StatusIcon className="w-3 h-3" />
                  {s.label}
                </span>
                <span className="text-xs text-petra-muted bg-slate-100 px-2 py-1 rounded-lg">
                  {ORDER_TYPE_MAP[order.orderType] ?? order.orderType}
                </span>
              </div>
              <p className="text-sm text-petra-muted mt-0.5">
                נוצר {formatDate(order.createdAt)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-shrink-0">
            {order.status === "draft" && (
              <>
                <button
                  onClick={() => confirmMutation.mutate()}
                  disabled={confirmMutation.isPending || order.lines.length === 0}
                  className="btn-primary text-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  אשר הזמנה
                </button>
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="btn-secondary text-sm text-red-500 hover:bg-red-50 hover:border-red-200"
                >
                  <Trash2 className="w-4 h-4" />
                  ביטול
                </button>
              </>
            )}
            {order.status === "confirmed" && (
              <button
                onClick={() => setConfirmCancel(true)}
                className="btn-secondary text-sm text-red-500 hover:bg-red-50 hover:border-red-200"
              >
                <XCircle className="w-4 h-4" />
                בטל הזמנה
              </button>
            )}
          </div>
        </div>

        {/* Customer + dates */}
        <div className="mt-4 pt-4 border-t border-petra-border grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-petra-muted mb-1 flex items-center gap-1">
              <User className="w-3 h-3" /> לקוח
            </p>
            <Link
              href={`/customers/${order.customer.id}`}
              className="text-sm font-semibold text-brand-600 hover:underline"
            >
              {order.customer.name}
            </Link>
            <p className="text-xs text-petra-muted" dir="ltr">{order.customer.phone}</p>
          </div>
          {order.startAt && (
            <div>
              <p className="text-xs text-petra-muted mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> תאריך התחלה
              </p>
              <p className="text-sm font-medium text-petra-text">
                {new Date(order.startAt).toLocaleString("he-IL", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
          )}
          {order.endAt && (
            <div>
              <p className="text-xs text-petra-muted mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> תאריך סיום
              </p>
              <p className="text-sm font-medium text-petra-text">
                {new Date(order.endAt).toLocaleString("he-IL", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
          )}
          {order.notes && (
            <div>
              <p className="text-xs text-petra-muted mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3" /> הערות
              </p>
              <p className="text-sm text-petra-text">{order.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Lines table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-petra-border bg-slate-50/60">
          <h2 className="font-semibold text-petra-text text-sm flex items-center gap-2">
            <Tag className="w-4 h-4 text-brand-500" />
            פריטי הזמנה
            <span className="text-xs font-normal text-petra-muted bg-slate-100 px-1.5 py-0.5 rounded-md">{order.lines.length}</span>
          </h2>
        </div>

        {order.lines.length === 0 ? (
          <div className="py-10 text-center text-sm text-petra-muted">אין פריטים בהזמנה</div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-petra-border">
                  <th className="table-header-cell">שם</th>
                  <th className="table-header-cell hidden sm:table-cell">יחידה</th>
                  <th className="table-header-cell">כמות</th>
                  <th className="table-header-cell">מחיר יחידה</th>
                  <th className="table-header-cell hidden md:table-cell">מע&quot;מ</th>
                  <th className="table-header-cell">סה&quot;כ שורה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-petra-border">
                {order.lines.map((line) => (
                  <tr key={line.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="table-cell font-medium text-petra-text">{line.name}</td>
                    <td className="table-cell hidden sm:table-cell text-xs text-petra-muted">
                      {UNIT_LABEL[line.unit] ?? line.unit}
                    </td>
                    <td className="table-cell text-petra-text">{line.quantity}</td>
                    <td className="table-cell text-petra-text" dir="ltr">{fmt(line.unitPrice)}</td>
                    <td className="table-cell hidden md:table-cell text-petra-muted text-xs" dir="ltr">
                      {line.taxMode === "exempt" ? "פטור" : fmt(line.lineTax)}
                    </td>
                    <td className="table-cell font-bold text-petra-text" dir="ltr">{fmt(line.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals footer */}
            <div className="border-t border-petra-border px-5 py-4 space-y-1.5 bg-slate-50/40">
              <div className="flex justify-between text-sm text-petra-muted">
                <span>סכום ביניים</span>
                <span dir="ltr">{fmt(order.subtotal)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>
                    הנחה {order.discountType === "percent" ? `(${order.discountValue}%)` : "(קבועה)"}
                  </span>
                  <span dir="ltr">−{fmt(order.discountAmount)}</span>
                </div>
              )}
              {order.taxTotal > 0 && (
                <div className="flex justify-between text-sm text-petra-muted">
                  <span>מע&quot;מ</span>
                  <span dir="ltr">{fmt(order.taxTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-petra-text border-t border-petra-border pt-2 mt-2">
                <span>סה&quot;כ לתשלום</span>
                <span dir="ltr" className="text-brand-600">{fmt(order.total)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Cancel confirm dialog */}
      {confirmCancel && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setConfirmCancel(false)} />
          <div className="modal-content max-w-sm mx-4 p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
              <XCircle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-petra-text mb-1">לבטל את ההזמנה?</h3>
            <p className="text-sm text-petra-muted mb-4">פעולה זו לא ניתנת לביטול.</p>
            <div className="flex gap-3">
              <button
                onClick={() => { cancelMutation.mutate(); setConfirmCancel(false); }}
                disabled={cancelMutation.isPending}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
              >
                {cancelMutation.isPending ? "מבטל..." : "כן, בטל"}
              </button>
              <button onClick={() => setConfirmCancel(false)} className="btn-secondary flex-1">
                חזרה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
