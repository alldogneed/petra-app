"use client";
import { useState } from "react";
import Link from "next/link";
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
    <DashCard>
      <DashCardHeader
        title={canWhatsApp ? "תזכורות למחר" : "תורים מחר"}
        subtitle={
          canWhatsApp
            ? `${appointments.length} תורים מתוכננים`
            : `${appointments.length} תורים — זכור ליצור קשר עם הלקוחות`
        }
        actions={
          canWhatsApp ? (
            withPhone.length > 1 ? (
              <MiniButton onClick={sendAll}>שלח הכל ({withPhone.length})</MiniButton>
            ) : undefined
          ) : (
            <DashLink href="/upgrade">שדרג לשליחת WhatsApp</DashLink>
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
                <WaTextButton onClick={() => sendOne(a)} title={hasSent ? "שלח שוב" : "שלח תזכורת בוואטסאפ"}>
                  {hasSent ? "נשלח ✓" : "שלח"}
                </WaTextButton>
              ) : (
                <span className="text-xs text-slate-500 whitespace-nowrap">אין טלפון</span>
              )
            ) : (
              <span className="text-xs text-slate-500 whitespace-nowrap tabular-nums [unicode-bidi:plaintext]">
                {a.customerPhone || "אין טלפון"}
              </span>
            )}
          </div>
        );
      })}

      {!canWhatsApp && (
        <p className="m-0 pt-3 pb-1 text-xs text-slate-500">
          שדרג ל
          <Link href="/upgrade" className="text-orange-600 hover:text-orange-700 hover:underline">
            פרו
          </Link>{" "}
          כדי לשלוח תזכורות WhatsApp אוטומטיות
        </p>
      )}
    </DashCard>
  );
}
