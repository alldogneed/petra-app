"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toWhatsAppPhone } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
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
  const t = useTranslations("dashboard.topDebtors");
  const { locale, currency } = useBusinessLocale();
  const money = (n: number) => formatCurrency(n, { locale, currency });
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  if (!debtors || debtors.length === 0) return null;
  const debtorCount = Math.max(debtorsCount, debtors.length);

  return (
    <DashCard>
      <DashCardHeader
        title={t("title")}
        subtitle={`${debtorCount === 1 ? t("subtitleOne", { count: debtorCount }) : t("subtitleOther", { count: debtorCount })}${debtTotal != null && debtTotal > 0 ? ` · ${money(debtTotal)}` : ""}`}
        actions={<DashLink href="/customers?balance=debt">{t("allDebtors")}</DashLink>}
      />
      {debtors.map((debtor) => {
        const waMsg = `שלום ${debtor.name}! 😊\nתזכורת לגבי תשלום ממתין בסך ${money(debtor.total)}.\nנשמח לקבל את התשלום בהקדם 🙏`; // i18n-ok — WhatsApp reminder text sent to the customer
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
              {money(debtor.total)}
            </span>
            {debtor.phone && (
              sent ? (
                <SentMark />
              ) : (
                <WaIconButton
                  href={waLink}
                  title={t("sendTitle")}
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
