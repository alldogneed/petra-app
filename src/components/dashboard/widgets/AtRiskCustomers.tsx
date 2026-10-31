"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { toWhatsAppPhone } from "@/lib/utils";
import { DashboardStats } from "@/components/dashboard/dashboard-shared";
import { DashCard, DashCardHeader, DashLink, SentMark, WaIconButton, WaTextButton } from "@/components/dashboard/dash-ui";

// ─── At-Risk Customers Widget ─────────────────────────────────────────────────

export function AtRiskCustomersWidget({ customers }: { customers: DashboardStats["atRiskCustomers"] }) {
  const t = useTranslations("dashboard.atRiskCustomers");
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);

  if (!customers || customers.length === 0) return null;

  function buildMsg(c: DashboardStats["atRiskCustomers"][0]) {
    return `שלום ${c.name}! 🐾\nזמן רב לא ראינו אתכם, מתגעגעים!\nהאם תרצו לקבוע תור? נשמח לראות אתכם שוב 😊`; // i18n-ok — WhatsApp text sent to the customer (Phase 3: business-language template)
  }

  function handleBulkSend() {
    setBulkSending(true);
    const withPhone = customers.filter((c) => c.phone);
    withPhone.forEach((c, i) => {
      setTimeout(() => {
        const text = encodeURIComponent(buildMsg(c));
        window.open(`https://api.whatsapp.com/send?phone=${toWhatsAppPhone(c.phone)}&text=${text}`, "_blank");
        setSentIds((prev) => new Set([...prev, c.id]));
        if (i === withPhone.length - 1) setBulkSending(false);
      }, i * 700);
    });
  }

  return (
    <DashCard>
      <DashCardHeader
        title={t("title")}
        subtitle={t("subtitle", { count: customers.length })}
        actions={
          <>
            <WaTextButton
              onClick={handleBulkSend}
              disabled={bulkSending || customers.filter((c) => c.phone).length === 0}
              title={t("sendAllTitle")}
            >
              {t("sendAll")}
            </WaTextButton>
            <DashLink href="/customers">{t("allCustomers")}</DashLink>
          </>
        }
      />

      {customers.map((c) => {
        const sent = sentIds.has(c.id);
        const waLink = `https://api.whatsapp.com/send?phone=${toWhatsAppPhone(c.phone)}&text=${encodeURIComponent(buildMsg(c))}`;
        const urgency = c.daysSinceVisit >= 120 ? "text-red-700" : "text-[#C2410C]";

        return (
          <div key={c.id} className="flex items-center gap-3 py-[11px] border-t border-slate-100">
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <Link
                href={`/customers/${c.id}`}
                className="text-sm font-medium text-slate-900 hover:text-orange-600 truncate"
              >
                {c.name}
              </Link>
              <span className="text-xs text-slate-500 truncate">
                <span className={urgency}>{t("notVisited", { days: c.daysSinceVisit })}</span>
                {" · "}
                {t("totalVisits", { count: c.totalVisits })}
              </span>
            </div>
            {c.phone &&
              (sent ? (
                <SentMark />
              ) : (
                <WaIconButton
                  href={waLink}
                  title={t("sendOneTitle")}
                  onClick={() => setSentIds((prev) => new Set([...prev, c.id]))}
                />
              ))}
          </div>
        );
      })}
    </DashCard>
  );
}
