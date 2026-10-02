"use client";

import { useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, MessageCircle, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { cn, fetchJSON, getStatusColor, getStatusLabel } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { waLink } from "./customer-actions";
import { appointmentServiceName, formatDayDate, type CustomerAppointment, type CustomerDetail, type PagedAppointments } from "./types";

type Scope = "upcoming" | "past";
const PAGE_SIZE = 20;

export function AppointmentsSection({
  customer,
  canSendMessages,
  canRemind,
  onNewAppointment,
}: {
  customer: CustomerDetail;
  canSendMessages: boolean;
  /** Plan has whatsapp_reminders AND the user may send messages. */
  canRemind: boolean;
  onNewAppointment: () => void;
}) {
  const customerId = customer.id;
  const queryClient = useQueryClient();
  const counts = customer.summary?.counts;
  const upcomingCount = counts?.upcomingAppointments ?? 0;
  const [scope, setScope] = useState<Scope>(() => (upcomingCount > 0 ? "upcoming" : "past"));
  const nextId = customer.summary?.nextAppointment?.id ?? null;

  const query = useInfiniteQuery<PagedAppointments>({
    queryKey: ["customer", customerId, "appointments", scope],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ scope, take: String(PAGE_SIZE) });
      if (pageParam) qs.set("cursor", String(pageParam));
      return fetchJSON<PagedAppointments>(`/api/customers/${customerId}/appointments?${qs}`);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });
  const appointments = query.data?.pages.flatMap((p) => p.appointments) ?? [];
  const pastCount = query.data && scope === "past" ? query.data.pages[0]?.total ?? 0 : Math.max(0, (counts?.appointments ?? 0) - upcomingCount);

  const [busyId, setBusyId] = useState<string | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["customer", customerId] });

  const remindMutation = useMutation({
    mutationFn: (aptId: string) => fetchJSON(`/api/appointments/${aptId}/remind`, { method: "POST" }),
    onSuccess: () => toast.success("תזכורת WhatsApp נשלחה"),
    onError: (err: Error) => toast.error(err.message || "שגיאה בשליחת תזכורת"),
    onSettled: () => setBusyId(null),
  });
  const completeMutation = useMutation({
    mutationFn: (aptId: string) =>
      fetchJSON(`/api/appointments/${aptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("התור סומן כהושלם");
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה בעדכון התור"),
    onSettled: () => setBusyId(null),
  });

  const hasPhone = !!customer.phone?.trim();

  const followUpLink = (apt: CustomerAppointment) => {
    const serviceName = appointmentServiceName(apt, "הטיפול");
    const petPart = apt.pet ? ` של ${apt.pet.name}` : "";
    const msg = `שלום ${customer.name} 😊\n\nרציתי לבדוק איך ${apt.pet ? apt.pet.name : "הכלב"} מרגיש/ת אחרי ${serviceName}${petPart}.\n\nאם יש שאלות אנחנו כאן תמיד 🐾`;
    return waLink(customer.phone, msg);
  };

  return (
    <div id="appointments" className="card p-5 scroll-mt-32">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-base font-bold text-petra-text">תורים ({counts?.appointments ?? 0})</h2>
        <div className="flex items-center gap-2">
          <button className="btn-primary text-xs py-1.5 px-3" onClick={onNewAppointment}>
            <Plus className="w-3.5 h-3.5" />
            קבע תור
          </button>
          <Link href="/calendar" className="btn-ghost text-xs">
            <ExternalLink className="w-3.5 h-3.5" />
            יומן
          </Link>
        </div>
      </div>

      <div className="flex gap-1 p-1 mb-3 rounded-xl bg-slate-100 w-fit" role="tablist">
        {([
          ["upcoming", `קרובים (${upcomingCount})`],
          ["past", `היסטוריה (${pastCount})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={scope === key}
            onClick={() => setScope(key)}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
              scope === key ? "bg-white text-petra-text shadow-sm" : "text-petra-muted hover:text-petra-text"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <PetraLoader variant="inline" className="py-4" />
      ) : query.isError ? (
        <p className="text-sm text-red-500 py-4 text-center">שגיאה בטעינת התורים</p>
      ) : appointments.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-sm text-petra-muted">{scope === "upcoming" ? "אין תורים עתידיים" : "אין היסטוריית תורים"}</p>
          {scope === "upcoming" && (
            <button className="btn-ghost text-xs mt-2 mx-auto" onClick={onNewAppointment}>
              <Plus className="w-3.5 h-3.5" />
              קבע תור
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {appointments.map((apt) => {
            const isNext = apt.id === nextId;
            return (
              <div
                key={apt.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl transition-colors",
                  isNext ? "bg-brand-50/70 ring-1 ring-brand-200" : "hover:bg-slate-50"
                )}
              >
                <Link
                  href={`/calendar?date=${String(apt.date).slice(0, 10)}&apt=${apt.id}`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                  title="פתח ועריכת תור ביומן"
                >
                  <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ background: apt.service?.color || "#F97316" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-petra-text truncate flex items-center gap-1.5">
                      {appointmentServiceName(apt)}
                      {isNext && <span className="badge-brand text-[10px] flex-shrink-0">התור הבא</span>}
                    </div>
                    <div className="text-xs text-petra-muted truncate">
                      {formatDayDate(apt.date)} · {apt.startTime}
                      {apt.pet ? ` · ${apt.pet.name}` : ""}
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={cn("badge text-[10px]", getStatusColor(apt.status))}>{getStatusLabel(apt.status)}</span>
                  {apt.status === "scheduled" && hasPhone && canRemind && (
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-green-50 hover:bg-green-100 text-green-600 transition-colors disabled:opacity-50"
                      title="שלח תזכורת WhatsApp"
                      aria-label="שלח תזכורת WhatsApp"
                      disabled={busyId === apt.id}
                      onClick={() => { setBusyId(apt.id); remindMutation.mutate(apt.id); }}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {apt.status === "completed" && hasPhone && canSendMessages && (
                    <a
                      href={followUpLink(apt)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                      title="שלח מעקב WhatsApp"
                      aria-label="שלח מעקב WhatsApp"
                    >
                      <Send className="w-3 h-3" />
                    </a>
                  )}
                  {apt.status === "scheduled" && (
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors disabled:opacity-50"
                      title="סמן כהושלם"
                      aria-label="סמן כהושלם"
                      disabled={busyId === apt.id}
                      onClick={() => { setBusyId(apt.id); completeMutation.mutate(apt.id); }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {query.hasNextPage && (
            <button
              onClick={() => query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
              className="w-full mt-1 py-2 text-xs text-petra-muted hover:text-petra-text transition-colors disabled:opacity-50"
            >
              {query.isFetchingNextPage ? "טוען..." : "טען עוד"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
