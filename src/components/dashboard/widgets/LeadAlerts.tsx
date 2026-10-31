"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { DashboardStats } from "@/components/dashboard/dashboard-shared";
import { DashCard, DashCardHeader, DashLink, DashRow, MiniButton } from "@/components/dashboard/dash-ui";


// ─── Urgent Leads Alert Component ────────────────────────────────────────────

type Lead = DashboardStats["urgentLeads"][0];

function LeadRow({ lead, meta, metaClass }: { lead: Lead; meta: string; metaClass: string }) {
  const t = useTranslations("dashboard.leadAlerts");
  return (
    <DashRow>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <Link
          href={`/leads?lead=${lead.id}`}
          className="text-sm font-medium text-slate-900 truncate hover:text-orange-600 transition-colors"
        >
          {lead.name}
        </Link>
        <span className="text-xs truncate">
          <span className={metaClass}>{meta}</span>
          {lead.customer?.name && <span className="text-slate-500">{t("row.customer", { name: lead.customer.name })}</span>}
        </span>
      </div>
      <MiniButton href={`/leads?lead=${lead.id}`} title={t("row.handleTitle")}>
        {t("row.handle")}
      </MiniButton>
    </DashRow>
  );
}

export function TodayFollowUpsWidget({ leads }: { leads: DashboardStats["urgentLeads"] }) {
  const t = useTranslations("dashboard.leadAlerts");
  const todayLeads = leads.filter((l) => {
    if (!l.nextFollowUpAt) return false;
    const d = new Date(l.nextFollowUpAt);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  });

  if (todayLeads.length === 0) return null;

  return (
    <DashCard>
      <DashCardHeader
        title={t("today.title")}
        subtitle={
          todayLeads.length === 1
            ? t("today.subtitleOne", { count: todayLeads.length })
            : t("today.subtitleOther", { count: todayLeads.length })
        }
        actions={<DashLink href="/leads?view=followup">{t("today.link")}</DashLink>}
      />
      {todayLeads.map((lead) => (
        <LeadRow key={lead.id} lead={lead} meta={t("today.meta")} metaClass="text-blue-700" />
      ))}
    </DashCard>
  );
}

export function UrgentLeadsAlert({ leads }: { leads: DashboardStats["urgentLeads"] }) {
  const t = useTranslations("dashboard.leadAlerts");
  const { locale } = useBusinessLocale();
  const overdueLeads = leads.filter((l) => {
    if (!l.nextFollowUpAt) return false;
    const d = new Date(l.nextFollowUpAt);
    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    return !isToday && d < now;
  });

  if (overdueLeads.length === 0) return null;

  return (
    <DashCard>
      <DashCardHeader
        title={t("overdue.title")}
        subtitle={
          overdueLeads.length === 1
            ? t("overdue.subtitleOne", { count: overdueLeads.length })
            : t("overdue.subtitleOther", { count: overdueLeads.length })
        }
        actions={<DashLink href="/leads">{t("overdue.link")}</DashLink>}
      />
      {overdueLeads.map((lead) => {
        const timeStr = lead.nextFollowUpAt
          ? new Date(lead.nextFollowUpAt).toLocaleString(locale, {
            day: "2-digit",
            month: "2-digit",
          })
          : "";
        return <LeadRow key={lead.id} lead={lead} meta={t("overdue.meta", { time: timeStr })} metaClass="text-red-700" />;
      })}
    </DashCard>
  );
}
