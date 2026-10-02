"use client";
import Link from "next/link";
import { toWhatsAppPhone } from "@/lib/utils";
import { DashboardStats } from "@/components/dashboard/dashboard-shared";
import { DashCard, DashCardHeader, WaTextButton } from "@/components/dashboard/dash-ui";

// ─── Pet Birthdays Widget ─────────────────────────────────────────────────────

export function PetBirthdaysWidget({ birthdays }: { birthdays: DashboardStats["upcomingBirthdays"] }) {
  if (!birthdays || birthdays.length === 0) return null;

  return (
    <DashCard>
      <DashCardHeader
        title="ימי הולדת השבוע"
        subtitle={`${birthdays.length} חיות חוגגות ב-7 הימים הקרובים`}
      />

      {birthdays.map((pet) => {
        const isToday = pet.daysUntil === 0;
        const greetingLines = [
          `🎂 יום הולדת שמח ל${pet.name}!`,
          `${pet.name} חוגג/ת ${pet.age + 1} שנים`,
          pet.breed ? `(${pet.breed})` : "",
          "",
          `מאחלים לכם ול${pet.name} המון שנות אושר ובריאות! 🐾`,
        ].filter(Boolean).join("\n");
        const meta = [pet.customer?.name ?? "", `${pet.age + 1} שנ׳`].filter(Boolean).join(" · ");

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
                  <span className="text-pink-600 font-semibold">היום</span>
                ) : (
                  `בעוד ${pet.daysUntil} ימים`
                )}
              </span>
            </Link>
            {pet.customer?.phone && (
              <WaTextButton
                href={`https://wa.me/${toWhatsAppPhone(pet.customer?.phone ?? "")}?text=${encodeURIComponent(greetingLines)}`}
                title="שלח ברכת יום הולדת"
              >
                ברכה
              </WaTextButton>
            )}
          </div>
        );
      })}
    </DashCard>
  );
}
