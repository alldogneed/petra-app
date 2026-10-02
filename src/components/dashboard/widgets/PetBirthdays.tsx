"use client";
import Link from "next/link";
import { MessageCircle, Cake } from "lucide-react";
import { toWhatsAppPhone } from "@/lib/utils";
import { DashboardStats } from "@/components/dashboard/dashboard-shared";


// ─── Pet Birthdays Widget ─────────────────────────────────────────────────────

export function PetBirthdaysWidget({ birthdays }: { birthdays: DashboardStats["upcomingBirthdays"] }) {
  if (!birthdays || birthdays.length === 0) return null;

  return (
    <div className="card overflow-hidden" style={{ borderTop: "3px solid #EC4899" }}>
      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 bg-pink-50/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-pink-100">
            <Cake className="w-4 h-4 text-pink-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-petra-text">ימי הולדת השבוע</h2>
            <p className="text-[11px] text-petra-muted">
              <span className="text-pink-600 font-medium">{birthdays.length} חיות</span>{" "}
              חוגגות ב-7 הימים הקרובים
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-50">
        {birthdays.map((pet) => {
          const isToday = pet.daysUntil === 0;
          const greetingLines = [
            `🎂 יום הולדת שמח ל${pet.name}!`,
            `${pet.name} חוגג/ת ${pet.age + 1} שנים`,
            pet.breed ? `(${pet.breed})` : "",
            "",
            `מאחלים לכם ול${pet.name} המון שנות אושר ובריאות! 🐾`,
          ].filter(Boolean).join("\n");

          return (
            <div key={pet.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition-colors">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${isToday ? "bg-pink-100" : "bg-slate-100"}`}>
                {isToday ? "🎂" : "🐾"}
              </div>
              <Link href={pet.customer?.id ? `/customers/${pet.customer.id}` : "/customers"} className="flex-1 min-w-0 hover:text-brand-600">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-petra-text">{pet.name}</span>
                  {pet.breed && <span className="text-xs text-petra-muted">({pet.breed})</span>}
                  {isToday && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 text-pink-700">
                      היום!
                    </span>
                  )}
                </div>
                <p className="text-xs text-petra-muted">
                  {pet.customer?.name ?? ""}
                  {" · "}
                  {pet.age + 1} שנ׳
                  {pet.daysUntil > 0 && ` · בעוד ${pet.daysUntil} ימים`}
                </p>
              </Link>
              {pet.customer?.phone && (
                <a
                  href={`https://wa.me/${toWhatsAppPhone(pet.customer?.phone ?? "")}?text=${encodeURIComponent(greetingLines)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                  title="שלח ברכת יום הולדת"
                >
                  <MessageCircle className="w-3 h-3" />
                  ברכה
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
