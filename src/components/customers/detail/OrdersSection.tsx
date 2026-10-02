"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Link2, Plus, ShoppingCart } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { ORDER_STATUS_INFO, ORDER_TYPE_LABELS } from "./constants";
import { formatDayDate, type OrderInfo } from "./types";

const PAYABLE_STATUSES = ["draft", "confirmed", "partially_paid"];

export function OrdersSection({
  orders,
  total,
  canSeeFinance,
  canWritePayments,
  onNewOrder,
}: {
  orders: OrderInfo[];
  /** Real count (summary.counts.orders) — the card GET carries the latest 20. */
  total: number;
  canSeeFinance: boolean;
  canWritePayments: boolean;
  onNewOrder: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div id="orders" className="card p-5 scroll-mt-32">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-petra-muted" />
          הזמנות ({total})
        </h2>
        <button onClick={onNewOrder} className="btn-ghost text-xs">
          <Plus className="w-3.5 h-3.5" />
          הזמנה חדשה
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state py-6">
          <div className="empty-state-icon">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <p className="text-sm text-petra-muted mb-3">אין הזמנות עדיין</p>
          <button onClick={onNewOrder} className="btn-primary text-sm">
            <ShoppingCart className="w-4 h-4" />
            צור הזמנה ראשונה
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const isExpanded = expandedId === order.id;
            const statusInfo = ORDER_STATUS_INFO[order.status] || { label: order.status, color: "badge-neutral" };
            const showPayLink = canWritePayments && PAYABLE_STATUSES.includes(order.status);
            return (
              <div key={order.id} className="rounded-xl border border-slate-100 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors text-right"
                  aria-expanded={isExpanded}
                >
                  <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="w-4 h-4 text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-petra-text">
                      {canSeeFinance ? formatCurrency(order.total) : ORDER_TYPE_LABELS[order.orderType] || order.orderType}
                      <span className="text-xs text-petra-muted mr-1">· {order.lines.length} פריטים</span>
                    </div>
                    <div className="text-xs text-petra-muted">
                      {canSeeFinance && <>{ORDER_TYPE_LABELS[order.orderType] || order.orderType} · </>}
                      {formatDayDate(order.createdAt)}
                    </div>
                  </div>
                  <span className={cn("badge text-[10px]", statusInfo.color)}>{statusInfo.label}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-petra-muted flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-petra-muted flex-shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-3">
                    <Link href={`/orders/${order.id}`} className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 hover:underline w-fit">
                      פתח הזמנה ←
                    </Link>
                    {order.orderType === "boarding" && order.startAt && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-1.5 text-amber-800">
                          <span className="font-semibold">צ׳ק אין:</span>
                          <span>{new Date(order.startAt).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jerusalem" })}</span>
                        </div>
                        {order.endAt && (
                          <>
                            <span className="text-amber-400">→</span>
                            <div className="flex items-center gap-1.5 text-amber-800">
                              <span className="font-semibold">צ׳ק אאוט:</span>
                              <span>{new Date(order.endAt).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jerusalem" })}</span>
                            </div>
                            <span className="text-amber-500 font-medium ms-auto">
                              {Math.round((new Date(order.endAt).getTime() - new Date(order.startAt).getTime()) / (1000 * 60 * 60 * 24))} לילות
                            </span>
                          </>
                        )}
                      </div>
                    )}
                    {(order.orderType === "training" || order.orderType === "appointment") && order.startAt && (
                      <div className="flex flex-wrap items-center gap-2 text-xs bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-blue-800">
                        <span className="font-semibold">תאריך ושעה:</span>
                        <span>{new Date(order.startAt).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Jerusalem" })}</span>
                        <span>{new Date(order.startAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" })}</span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      {order.lines.map((line) => (
                        <div key={line.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-petra-text min-w-0 break-words">{line.name}</span>
                          {canSeeFinance ? (
                            <div className="flex items-center gap-3 text-petra-muted flex-shrink-0">
                              <span className="text-xs">{line.quantity} × {formatCurrency(line.unitPrice)}</span>
                              <span className="font-medium text-petra-text w-16 text-right">{formatCurrency(line.lineSubtotal ?? line.lineTotal)}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-petra-muted flex-shrink-0">× {line.quantity}</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {canSeeFinance && (
                      <div className="border-t border-slate-200 pt-2 space-y-1">
                        {order.discountAmount > 0 && (
                          <div className="flex justify-between text-xs text-emerald-600">
                            <span>הנחה</span>
                            <span dir="ltr">−{formatCurrency(order.discountAmount)}</span>
                          </div>
                        )}
                        {order.taxTotal > 0 && (
                          <div className="flex justify-between text-xs text-petra-muted">
                            <span>מע&quot;מ</span>
                            <span dir="ltr">{formatCurrency(order.taxTotal)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-bold text-petra-text">
                          <span>סה&quot;כ</span>
                          <span dir="ltr">{formatCurrency(order.total)}</span>
                        </div>
                      </div>
                    )}

                    {showPayLink && (
                      // Sent from the order page so the request stays linked to THIS order
                      <Link
                        href={`/orders/${order.id}`}
                        className="flex items-center gap-2 p-2.5 bg-brand-50 border border-brand-100 rounded-xl w-full text-start hover:bg-brand-100 transition-colors"
                      >
                        <Link2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                        <span className="text-xs text-brand-700 flex-1 font-medium">שלח בקשת תשלום</span>
                      </Link>
                    )}

                    {order.notes && (
                      <div className="text-xs text-petra-muted">
                        <span className="font-medium">הערות:</span> {order.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {total > orders.length && (
            <p className="text-xs text-petra-muted text-center pt-1">מוצגות {orders.length} ההזמנות האחרונות מתוך {total}</p>
          )}
        </div>
      )}
    </div>
  );
}
