"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, CreditCard, ArrowLeft, MessageCircle } from "lucide-react";
import { formatCurrency, toWhatsAppPhone } from "@/lib/utils";
import { DashboardStats } from "@/components/dashboard/dashboard-shared";


// ─── Top Debtors Widget ───────────────────────────────────────────────────────

export function TopDebtorsWidget({ debtors }: { debtors: DashboardStats["topDebtors"] }) {
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  if (!debtors || debtors.length === 0) return null;

  return (
    <div className="card overflow-hidden" style={{ borderTop: "3px solid #F97316" }}>
      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 bg-orange-50/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-100">
            <CreditCard className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-petra-text">תשלומים פתוחים</h2>
            <p className="text-[11px] text-petra-muted">
              <span className="text-orange-600 font-medium">{debtors.length} לקוחות</span> עם חוב ממתין
            </p>
          </div>
        </div>
        <Link
          href="/orders?status=confirmed&payment=unpaid"
          className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1"
        >
          לכל ההזמנות
          <ArrowLeft className="w-3 h-3" />
        </Link>
      </div>

      <div className="divide-y divide-slate-50">
        {debtors.map((debtor) => {
          const waMsg = `שלום ${debtor.name}! 😊\nתזכורת לגבי תשלום ממתין בסך ${formatCurrency(debtor.total)}.\nנשמח לקבל את התשלום בהקדם 🙏`;
          const waLink = `https://wa.me/${toWhatsAppPhone(debtor.phone)}?text=${encodeURIComponent(waMsg)}`;
          const sent = sentIds.has(debtor.id);

          return (
            <div
              key={debtor.id}
              className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <Link href={`/customers/${debtor.id}`} className="text-sm font-medium text-petra-text hover:text-brand-600 truncate block">
                  {debtor.name}
                </Link>
              </div>
              <span className="text-sm font-bold text-orange-600 flex-shrink-0">
                {formatCurrency(debtor.total)}
              </span>
              {debtor.phone && (
                sent ? (
                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    נשלח
                  </span>
                ) : (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-green-600 hover:bg-green-50 border border-transparent hover:border-green-200 transition-colors flex-shrink-0"
                    title="שלח תזכורת בוואטסאפ"
                    onClick={() => setSentIds((prev) => new Set([...prev, debtor.id]))}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </a>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
