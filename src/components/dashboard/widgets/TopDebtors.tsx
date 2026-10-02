"use client";
import { useState } from "react";
import Link from "next/link";
import { formatCurrency, toWhatsAppPhone } from "@/lib/utils";
import { DashboardStats } from "@/components/dashboard/dashboard-shared";
import { DashCard, DashCardHeader, DashLink, DashRow, WaIconButton, SentMark } from "@/components/dashboard/dash-ui";


// ─── Top Debtors Widget ───────────────────────────────────────────────────────

export function TopDebtorsWidget({ debtors }: { debtors: DashboardStats["topDebtors"] }) {
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  if (!debtors || debtors.length === 0) return null;

  return (
    <DashCard>
      <DashCardHeader
        title="תשלומים פתוחים"
        subtitle={`${debtors.length} ${debtors.length === 1 ? "לקוח" : "לקוחות"} עם חוב ממתין`}
        actions={<DashLink href="/orders?status=confirmed&payment=unpaid">לכל ההזמנות</DashLink>}
      />
      {debtors.map((debtor) => {
        const waMsg = `שלום ${debtor.name}! 😊\nתזכורת לגבי תשלום ממתין בסך ${formatCurrency(debtor.total)}.\nנשמח לקבל את התשלום בהקדם 🙏`;
        const waLink = `https://wa.me/${toWhatsAppPhone(debtor.phone)}?text=${encodeURIComponent(waMsg)}`;
        const sent = sentIds.has(debtor.id);

        return (
          <DashRow key={debtor.id}>
            <Link
              href={`/customers/${debtor.id}`}
              className="flex-1 min-w-0 truncate text-sm font-medium text-slate-900 hover:text-orange-600 transition-colors"
            >
              {debtor.name}
            </Link>
            <span className="text-sm font-semibold text-slate-900 tabular-nums flex-shrink-0">
              {formatCurrency(debtor.total)}
            </span>
            {debtor.phone && (
              sent ? (
                <SentMark />
              ) : (
                <WaIconButton
                  href={waLink}
                  title="שלח תזכורת בוואטסאפ"
                  onClick={() => setSentIds((prev) => new Set([...prev, debtor.id]))}
                />
              )
            )}
          </DashRow>
        );
      })}
    </DashCard>
  );
}
