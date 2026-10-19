"use client";
import { useState } from "react";
import Link from "next/link";
import { formatCurrency, toWhatsAppPhone } from "@/lib/utils";
import { DashboardStats } from "@/components/dashboard/dashboard-shared";
import { DashCard, DashCardHeader, DashLink, DashRow, WaIconButton, SentMark } from "@/components/dashboard/dash-ui";


// ─── Top Debtors Widget ───────────────────────────────────────────────────────

export function TopDebtorsWidget({
  debtors,
  debtorsCount,
  debtTotal,
}: {
  debtors: DashboardStats["topDebtors"];
  /** All customers who owe money (the list shows the top 5). */
  debtorsCount: number;
  debtTotal: number | null;
}) {
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  if (!debtors || debtors.length === 0) return null;

  return (
    <DashCard>
      <DashCardHeader
        title="תשלומים פתוחים"
        subtitle={`${Math.max(debtorsCount, debtors.length)} ${Math.max(debtorsCount, debtors.length) === 1 ? "לקוח" : "לקוחות"} עם חוב${debtTotal != null && debtTotal > 0 ? ` · ${formatCurrency(debtTotal)}` : ""}`}
        actions={<DashLink href="/customers?balance=debt">לכל החייבים</DashLink>}
      />
      {debtors.map((debtor) => {
        const waMsg = `שלום ${debtor.name}! 😊\nתזכורת לגבי תשלום ממתין בסך ${formatCurrency(debtor.total)}.\nנשמח לקבל את התשלום בהקדם 🙏`;
        const waLink = `https://api.whatsapp.com/send?phone=${toWhatsAppPhone(debtor.phone)}&text=${encodeURIComponent(waMsg)}`;
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
