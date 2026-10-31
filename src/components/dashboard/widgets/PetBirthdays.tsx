"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toWhatsAppPhone } from "@/lib/utils";
import { DashboardStats } from "@/components/dashboard/dashboard-shared";
import { DashCard, DashCardHeader, WaTextButton } from "@/components/dashboard/dash-ui";

// ─── Pet Birthdays Widget ─────────────────────────────────────────────────────

export function PetBirthdaysWidget({ birthdays }: { birthdays: DashboardStats["upcomingBirthdays"] }) {
  const t = useTranslations("dashboard.petBirthdays");
  if (!birthdays || birthdays.length === 0) return null;

  return (
    <DashCard>
      <DashCardHeader
        title={t("title")}
        subtitle={t("subtitle", { count: birthdays.length })}
      />

      {birthdays.map((pet) => {
        const isToday = pet.daysUntil === 0;
        const greetingLines = [
          `🎂 יום הולדת שמח ל${pet.name}!`, // i18n-ok — WhatsApp greeting text sent to the customer
          `${pet.name} חוגג/ת ${pet.age + 1} שנים`, // i18n-ok — WhatsApp greeting text sent to the customer
          pet.breed ? `(${pet.breed})` : "",
          "",
          `מאחלים לכם ול${pet.name} המון שנות אושר ובריאות! 🐾`, // i18n-ok — WhatsApp greeting text sent to the customer
        ].filter(Boolean).join("\n");
        const meta = [pet.customer?.name ?? "", t("years", { count: pet.age + 1 })].filter(Boolean).join(" · ");

        return (
          <div key={pet.id} className="flex items-center gap-3 py-[11px] border-t border-slate-100">
            <Link
              href={pet.customer?.id ? `/customers/${pet.customer.id}` : "/customers"}
              className="flex-1 min-w-0 flex flex-col gap-0.5 text-slate-900 hover:text-orange-600"
            >
              <span className="text-sm font-medium truncate">
                {pet.name}
                {pet.breed && <span className="font-normal text-xs text-slate-500"> ({pet.breed})</span>}
              </span>
              <span className="text-xs text-slate-500 truncate">
                {meta} ·{" "}
                {isToday ? (
                  <span className="text-pink-600 font-semibold">{t("today")}</span>
                ) : (
                  t("inDays", { count: pet.daysUntil })
                )}
              </span>
            </Link>
            {pet.customer?.phone && (
              <WaTextButton
                href={`https://api.whatsapp.com/send?phone=${toWhatsAppPhone(pet.customer?.phone ?? "")}&text=${encodeURIComponent(greetingLines)}`}
                title={t("sendTitle")}
              >
                {t("send")}
              </WaTextButton>
            )}
          </div>
        );
      })}
    </DashCard>
  );
}
