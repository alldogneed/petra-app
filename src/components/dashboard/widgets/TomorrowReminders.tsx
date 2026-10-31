"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePlan } from "@/hooks/usePlan";
import { toWhatsAppPhone } from "@/lib/utils";
import { DashboardStats } from "@/components/dashboard/dashboard-shared";
import { DashCard, DashCardHeader, DashLink, MiniButton, WaTextButton } from "@/components/dashboard/dash-ui";

// ─── Tomorrow Reminders Widget ───────────────────────────────────────────────

export function TomorrowReminders({
  appointments,
}: {
  appointments: DashboardStats["tomorrowAppointments"];
}) {
  const t = useTranslations("dashboard.tomorrowReminders");
  const [sent, setSent] = useState<Set<string>>(new Set());
  const { can } = usePlan();
  const canWhatsApp = can("whatsapp_reminders");

  if (!appointments || appointments.length === 0) return null;

  const withPhone = appointments.filter((a) => a.customerPhone);

  function buildMsg(a: DashboardStats["tomorrowAppointments"][0]) {
    return encodeURIComponent(
      `שלום ${a.customerName}! 😊\nתזכורת לתור מחר בשעה ${a.startTime}${a.petName ? ` עם ${a.petName}` : ""} לשירות ${a.serviceName}.\nנתראה! 🐾` // i18n-ok — WhatsApp reminder text sent to the customer
    );
  }

  function sendOne(a: DashboardStats["tomorrowAppointments"][0]) {
    const phone = toWhatsAppPhone(a.customerPhone);
    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${buildMsg(a)}`, "_blank");
    setSent((prev) => new Set([...prev, a.id]));
  }

  function sendAll() {
    withPhone.forEach((a, i) => {
      setTimeout(() => {
        const phone = toWhatsAppPhone(a.customerPhone);
        window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${buildMsg(a)}`, "_blank");
        setSent((prev) => new Set([...prev, a.id]));
      }, i * 600);
    });
  }

  return (
    <DashCard>
      <DashCardHeader
        title={canWhatsApp ? t("titleWhatsApp") : t("titlePlain")}
        subtitle={
          canWhatsApp
            ? t("subtitleWhatsApp", { count: appointments.length })
            : t("subtitlePlain", { count: appointments.length })
        }
        actions={
          canWhatsApp ? (
            withPhone.length > 1 ? (
              <MiniButton onClick={sendAll}>{t("sendAll", { count: withPhone.length })}</MiniButton>
            ) : undefined
          ) : (
            <DashLink href="/upgrade">{t("upgradeLink")}</DashLink>
          )
        }
      />

      {appointments.map((a) => {
        const hasSent = sent.has(a.id);
        const detail = [a.petName, a.serviceName].filter(Boolean).join(" · ");
        return (
          <div
            key={a.id}
            className="grid grid-cols-[48px_minmax(0,1fr)_auto] gap-3 items-center py-[11px] border-t border-slate-100"
          >
            <span className="text-sm font-semibold text-slate-900 tabular-nums">{a.startTime}</span>
            <Link
              href={`/customers/${a.customerId}`}
              className="flex flex-col gap-0.5 min-w-0 text-slate-900 hover:text-orange-600"
            >
              <span className="text-sm font-medium truncate">{a.customerName}</span>
              {detail && <span className="text-xs text-slate-500 truncate">{detail}</span>}
            </Link>
            {canWhatsApp ? (
              a.customerPhone ? (
                <WaTextButton onClick={() => sendOne(a)} title={hasSent ? t("resendTitle") : t("sendTitle")}>
                  {hasSent ? t("sent") : t("send")}
                </WaTextButton>
              ) : (
                <span className="text-xs text-slate-500 whitespace-nowrap">{t("noPhone")}</span>
              )
            ) : (
              <span className="text-xs text-slate-500 whitespace-nowrap tabular-nums [unicode-bidi:plaintext]">
                {a.customerPhone || t("noPhone")}
              </span>
            )}
          </div>
        );
      })}

      {!canWhatsApp && (
        <p className="m-0 pt-3 pb-1 text-xs text-slate-500">
          {t.rich("upgradeHint", {
            link: (c) => (
              <Link href="/upgrade" className="text-orange-600 hover:text-orange-700 hover:underline">
                {c}
              </Link>
            ),
          })}
        </p>
      )}
    </DashCard>
  );
}
