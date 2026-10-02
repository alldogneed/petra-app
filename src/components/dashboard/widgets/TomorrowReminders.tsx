"use client";
import { useState } from "react";
import Link from "next/link";
import { MessageCircle, Zap } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import { cn, toWhatsAppPhone } from "@/lib/utils";
import { DashboardStats } from "@/components/dashboard/dashboard-shared";


// ─── Tomorrow Reminders Widget ───────────────────────────────────────────────

export function TomorrowReminders({
  appointments,
}: {
  appointments: DashboardStats["tomorrowAppointments"];
}) {
  const [sent, setSent] = useState<Set<string>>(new Set());
  const { can } = usePlan();
  const canWhatsApp = can("whatsapp_reminders");

  if (!appointments || appointments.length === 0) return null;

  const withPhone = appointments.filter((a) => a.customerPhone);

  function buildMsg(a: DashboardStats["tomorrowAppointments"][0]) {
    return encodeURIComponent(
      `שלום ${a.customerName}! 😊\nתזכורת לתור מחר בשעה ${a.startTime}${a.petName ? ` עם ${a.petName}` : ""} לשירות ${a.serviceName}.\nנתראה! 🐾`
    );
  }

  function sendOne(a: DashboardStats["tomorrowAppointments"][0]) {
    const phone = toWhatsAppPhone(a.customerPhone);
    window.open(`https://wa.me/${phone}?text=${buildMsg(a)}`, "_blank");
    setSent((prev) => new Set([...prev, a.id]));
  }

  function sendAll() {
    withPhone.forEach((a, i) => {
      setTimeout(() => {
        const phone = toWhatsAppPhone(a.customerPhone);
        window.open(`https://wa.me/${phone}?text=${buildMsg(a)}`, "_blank");
        setSent((prev) => new Set([...prev, a.id]));
      }, i * 600);
    });
  }

  return (
    <div className="card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", canWhatsApp ? "bg-green-50" : "bg-amber-50")}>
            <MessageCircle className={cn("w-4 h-4", canWhatsApp ? "text-green-600" : "text-amber-600")} />
          </div>
          <div>
            <h2 className="text-base font-bold text-petra-text">{canWhatsApp ? "תזכורות למחר" : "תורים מחר"}</h2>
            <p className="text-xs text-petra-muted">
              {canWhatsApp ? `${appointments.length} תורים מתוכננים` : `${appointments.length} תורים — זכור ליצור קשר עם הלקוחות`}
            </p>
          </div>
        </div>
        {canWhatsApp && withPhone.length > 1 && (
          <button
            onClick={sendAll}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <MessageCircle className="w-3.5 h-3.5 text-green-600" />
            שלח הכל ({withPhone.length})
          </button>
        )}
        {!canWhatsApp && (
          <Link href="/upgrade" className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1 flex-shrink-0">
            <Zap className="w-3 h-3" />
            שדרג לשליחת WhatsApp
          </Link>
        )}
      </div>

      <div className="space-y-2">
        {appointments.map((a) => {
          const hasSent = sent.has(a.id);
          return (
            <div
              key={a.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-colors",
                hasSent ? "bg-green-50" : "bg-slate-50 hover:bg-slate-100"
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-petra-border flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-[10px] text-petra-muted leading-none">מחר</span>
                <span className="text-sm font-bold text-petra-text leading-tight">{a.startTime}</span>
              </div>
              <Link href={`/customers/${a.customerId}`} className="flex-1 min-w-0 hover:text-brand-600">
                <p className="text-sm font-semibold text-petra-text truncate">{a.customerName}</p>
                <p className="text-xs text-petra-muted truncate">
                  {a.petName ? `${a.petName} • ` : ""}{a.serviceName}
                </p>
              </Link>
              {canWhatsApp ? (
                a.customerPhone ? (
                  <button
                    onClick={() => sendOne(a)}
                    className={cn(
                      "flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
                      hasSent
                        ? "bg-green-100 text-green-700 cursor-default"
                        : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                    )}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {hasSent ? "נשלח ✓" : "שלח"}
                  </button>
                ) : (
                  <span className="text-[10px] text-petra-muted">אין טלפון</span>
                )
              ) : (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 flex-shrink-0">
                  📞 {a.customerPhone || "אין טלפון"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {!canWhatsApp && (
        <p className="mt-3 text-[11px] text-petra-muted text-center">
          שדרג ל<Link href="/upgrade" className="text-brand-500 hover:underline">פרו</Link> כדי לשלוח תזכורות WhatsApp אוטומטיות
        </p>
      )}
    </div>
  );
}
