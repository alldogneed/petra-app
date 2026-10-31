"use client";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { fetchJSON, toWhatsAppPhone } from "@/lib/utils";
import { DashCard, DashCardHeader, DashLink, MiniButton, SentMark, WaIconButton } from "@/components/dashboard/dash-ui";

// ─── Vaccination Alerts Widget ────────────────────────────────────────────────

export interface VaccinationItem {
  healthId: string;
  petId: string;
  petName: string;
  species: string;
  breed: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vaccineType: "rabies" | "dhpp" | "deworming";
  vaccineLabel: string;
  lastDate: string | null;
  validUntil: string | null;
  daysUntil: number;
  isExpired: boolean;
  isUnknown: boolean;
}

export function VaccinationAlertWidget() {
  const t = useTranslations("dashboard.vaccinations");
  const { locale } = useBusinessLocale();
  const queryClient = useQueryClient();
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [taskedIds, setTaskedIds] = useState<Set<string>>(new Set());
  const { data } = useQuery<{ vaccinations: VaccinationItem[]; total: number }>({
    queryKey: ["pet-vaccinations"],
    queryFn: () => fetchJSON("/api/pets/vaccinations?days=30"),
  });

  const createTaskMutation = useMutation({
    mutationFn: (payload: { title: string; category: string; priority: string; dueDate: string }) =>
      fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("createTaskError")); return d; }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  if (!data || data.total === 0) return null;

  return (
    <DashCard>
      <DashCardHeader
        title={t("title")}
        subtitle={t("subtitle", { count: data.total })}
        actions={<DashLink href="/vaccinations">{t("allLink")}</DashLink>}
      />

      {data.vaccinations.map((v) => {
        const expiry = v.validUntil ? new Date(v.validUntil) : null;
        const expiryStr = expiry && !isNaN(expiry.getTime()) ? expiry.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) : "";
        const waMsg = `שלום ${v.customerName}! 💉\nחיסון ${v.vaccineLabel} של ${v.petName} ${v.isExpired ? "פג תוקפו" : `עומד לפוג בתאריך ${expiryStr}`}.\nנא לדאוג לחידוש החיסון בהקדם. 🐾`; // i18n-ok — WhatsApp reminder text sent to the customer
        const waLink = `https://api.whatsapp.com/send?phone=${toWhatsAppPhone(v.customerPhone)}&text=${encodeURIComponent(waMsg)}`;
        const sent = sentIds.has(v.petId);

        return (
          <div key={v.petId} className="flex items-center gap-2 py-[11px] border-t border-slate-100">
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <Link
                href={v.customerId ? `/customers/${v.customerId}` : "/customers"}
                className="text-sm font-medium text-slate-900 hover:text-orange-600 truncate"
              >
                {v.petName}
                {v.customerName && <span className="font-normal text-slate-500"> · {v.customerName}</span>}
              </Link>
              <span className={v.isExpired ? "text-xs text-red-700" : "text-xs text-amber-700"}>
                {v.isExpired ? t("expired", { date: expiryStr }) : t("expiresIn", { count: v.daysUntil, date: expiryStr })}
              </span>
            </div>

            {taskedIds.has(v.petId) ? (
              <span className="text-xs font-medium text-violet-600 whitespace-nowrap flex-shrink-0">{t("taskCreated")}</span>
            ) : (
              <MiniButton
                title={t("createTaskTitle")}
                onClick={() => {
                  const dueDate = new Date();
                  dueDate.setDate(dueDate.getDate() + 1);
                  createTaskMutation.mutate({
                    title: t("taskTitle", { pet: v.petName, customer: v.customerName }),
                    category: "HEALTH",
                    priority: v.isExpired ? "URGENT" : "HIGH",
                    dueDate: dueDate.toISOString().slice(0, 10),
                  });
                  setTaskedIds((prev) => new Set([...prev, v.petId]));
                }}
              >
                {t("task")}
              </MiniButton>
            )}
            {v.customerPhone &&
              (sent ? (
                <SentMark />
              ) : (
                <WaIconButton
                  href={waLink}
                  title={t("sendTitle")}
                  onClick={() => setSentIds((prev) => new Set([...prev, v.petId]))}
                />
              ))}
          </div>
        );
      })}
    </DashCard>
  );
}
