"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus, Check, Clock, MapPin, Pencil, UserX, X, CalendarClock } from "lucide-react";
import { cn, fetchJSON } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PetraLoader } from "@/components/ui/PetraLoader";
import {
  LEAD_MEETING_STATUS_LABELS,
  addMinutesHHmm,
  isMeetingDue,
  type LeadMeetingStatus,
} from "@/lib/lead-meetings";

// ─── Types (contract: GET /api/leads/[id]/meetings) ──────────────────────────

interface LeadMeeting {
  id: string;
  leadId: string;
  date: string; // ISO — Israel day at 00:00Z; use slice(0, 10)
  startTime: string;
  endTime: string;
  serviceId: string | null;
  location: string | null;
  notes: string | null;
  status: LeadMeetingStatus;
  outcomeAt: string | null;
  appointmentId: string | null;
  createdAt: string;
  service: { id: string; name: string } | null;
}

interface OutcomeResult {
  outcome: "completed" | "no_show";
  customer: { id: string; name: string } | null;
  appointmentId: string | null;
}

interface LeadMeetingsSectionProps {
  leadId: string;
  leadName: string;
  isCustomer: boolean;
  onConverted?: (customer: { id: string; name: string }) => void;
}

interface MeetingForm {
  date: string;
  startTime: string;
  endTime: string;
  serviceId: string;
  location: string;
  notes: string;
}

// ─── Styles (match LeadTreatmentModal) ───────────────────────────────────────

const FIELD_BASE =
  "w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-[#0F172A] placeholder:text-slate-400 outline-none transition-colors focus:border-[#FB923C] focus:ring-[3px] focus:ring-orange-500/15";
const INPUT_CLS = cn(FIELD_BASE, "h-10");
const TEXTAREA_CLS = cn(FIELD_BASE, "py-2 leading-relaxed resize-y");
const FIELD_LABEL_CLS = "block text-[13px] font-medium text-[#0F172A] mb-1.5";
const SMALL_BTN =
  "h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border text-[13px] font-medium transition-colors disabled:opacity-50";

const STATUS_CHIP: Record<LeadMeetingStatus, string> = {
  scheduled: "bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  no_show: "bg-amber-50 text-amber-700 border-amber-200",
  canceled: "bg-slate-50 text-slate-500 border-slate-200",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayYmd(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function meetingStart(m: LeadMeeting): Date {
  return new Date(`${m.date.slice(0, 10)}T${m.startTime}:00`);
}

function formatMeetingDay(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString("he-IL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

const emptyForm = (): MeetingForm => ({
  date: todayYmd(),
  startTime: "10:00",
  endTime: "11:00",
  serviceId: "",
  location: "",
  notes: "",
});

// ─── Component ───────────────────────────────────────────────────────────────

export function LeadMeetingsSection({ leadId, leadName, isCustomer, onConverted }: LeadMeetingsSectionProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeadMeeting | null>(null);
  const [form, setForm] = useState<MeetingForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<LeadMeeting | null>(null);
  const [mounted, setMounted] = useState(false);
  // Re-evaluate "is it due" while the card stays open
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const { data, isLoading, isError } = useQuery<{ meetings: LeadMeeting[] }>({
    queryKey: ["lead-meetings", leadId],
    queryFn: () => fetchJSON(`/api/leads/${leadId}/meetings`),
  });
  const meetings = data?.meetings ?? [];

  // Same key + shape as NewAppointmentModal — shares the cache
  const { data: services } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["services-for-appt"],
    queryFn: () =>
      fetch("/api/services").then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    enabled: modalOpen,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["lead-meetings", leadId] });
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["leads-calendar"] });
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setFormError(null);
  };

  const saveMutation = useMutation({
    mutationFn: (f: MeetingForm) => {
      const body = {
        date: f.date,
        startTime: f.startTime,
        endTime: f.endTime,
        serviceId: f.serviceId || null,
        location: f.location.trim() || null,
        notes: f.notes.trim() || null,
      };
      return editing
        ? fetchJSON<{ meeting: LeadMeeting }>(`/api/leads/${leadId}/meetings/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : fetchJSON<{ meeting: LeadMeeting }>(`/api/leads/${leadId}/meetings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
    },
    onSuccess: () => {
      toast.success(editing ? "הפגישה עודכנה" : "הפגישה נקבעה");
      invalidateAll();
      closeModal();
    },
    onError: (err: Error) => setFormError(err.message || "שגיאה בשמירת הפגישה"),
  });

  const cancelMutation = useMutation({
    mutationFn: (meetingId: string) =>
      fetchJSON<{ ok: true }>(`/api/leads/${leadId}/meetings/${meetingId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("הפגישה בוטלה");
      invalidateAll();
      setCancelTarget(null);
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה בביטול הפגישה"),
  });

  const outcomeMutation = useMutation({
    mutationFn: ({ meetingId, outcome }: { meetingId: string; outcome: "completed" | "no_show" }) =>
      fetchJSON<OutcomeResult>(`/api/leads/${leadId}/meetings/${meetingId}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      }),
    onSuccess: (res) => {
      invalidateAll();
      if (res.outcome === "completed") {
        queryClient.invalidateQueries({ queryKey: ["customers"] });
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        const customer = res.customer;
        if (customer && onConverted) {
          // The host (lead card) runs its own "won" flow — closes the card and shows
          // the page's won message with a link to the customer.
          onConverted(customer);
        } else if (customer) {
          toast.success(`${customer.name || leadName} הפך/ה ללקוח`, {
            duration: 8000,
            action: { label: "פתח כרטיס לקוח", onClick: () => router.push(`/customers/${customer.id}`) },
          });
        } else {
          toast.success(`${leadName} הפך/ה ללקוח`);
        }
      } else {
        toast.success("סומן: לא הגיע — נקבע מעקב למחר");
      }
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה בשמירת תוצאת הפגישה"),
  });

  const busy = saveMutation.isPending || cancelMutation.isPending || outcomeMutation.isPending;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (m: LeadMeeting) => {
    setEditing(m);
    setForm({
      date: m.date.slice(0, 10),
      startTime: m.startTime,
      endTime: m.endTime,
      serviceId: m.serviceId ?? "",
      location: m.location ?? "",
      notes: m.notes ?? "",
    });
    setFormError(null);
    setModalOpen(true);
  };

  const onStartChange = (value: string) => {
    setForm((f) => {
      // Keep the end time in step: default length 60 min, and never before the start
      const followsStart = f.endTime === addMinutesHHmm(f.startTime, 60);
      const endTime = followsStart || !f.endTime || f.endTime <= value ? addMinutesHHmm(value, 60) : f.endTime;
      return { ...f, startTime: value, endTime };
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date || !form.startTime || !form.endTime) {
      setFormError("יש למלא תאריך ושעות");
      return;
    }
    if (form.startTime >= form.endTime) {
      setFormError("שעת ההתחלה חייבת להיות לפני שעת הסיום");
      return;
    }
    setFormError(null);
    saveMutation.mutate(form);
  };

  // The lead drawer closes on Escape — while our modal/confirm is open, Escape belongs to them.
  useEffect(() => {
    if (!modalOpen && !cancelTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (modalOpen && !cancelTarget && !saveMutation.isPending) closeModal();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, cancelTarget, saveMutation.isPending]);

  return (
    <div className="px-6 py-5 border-b border-[#F1F5F9]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-slate-500">פגישות</div>
        {!isCustomer && (
          <button
            type="button"
            onClick={openCreate}
            disabled={busy}
            className={cn(SMALL_BTN, "border-[#FDBA74] bg-[#FFF7ED] text-[#9A3412] hover:bg-orange-100")}
          >
            <CalendarPlus className="w-4 h-4" />
            קבע פגישה
          </button>
        )}
      </div>

      {isCustomer && (
        <p className="mt-2 text-xs text-slate-500">הליד כבר לקוח — קבע/י תור רגיל ביומן.</p>
      )}

      {isLoading ? (
        <PetraLoader variant="inline" className="py-4" />
      ) : isError ? (
        <p className="mt-2 text-sm text-red-600">שגיאה בטעינת הפגישות</p>
      ) : meetings.length === 0 ? (
        !isCustomer && <p className="mt-2 text-sm text-slate-400">אין פגישות עדיין</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {meetings.map((m) => {
            const ymd = m.date.slice(0, 10);
            const scheduled = m.status === "scheduled";
            const due = scheduled && isMeetingDue(meetingStart(m), now);
            return (
              <li
                key={m.id}
                className={cn(
                  "rounded-xl border p-3",
                  due ? "border-orange-200 bg-orange-50/40" : "border-slate-200 bg-white",
                  m.status === "canceled" && "opacity-70"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                    <Clock className="w-4 h-4 text-slate-400" />
                    {formatMeetingDay(ymd)} · <span dir="ltr">{m.startTime}–{m.endTime}</span>
                  </span>
                  <span className={cn("ms-auto text-[11px] font-semibold border rounded-full px-2 py-0.5", STATUS_CHIP[m.status])}>
                    {LEAD_MEETING_STATUS_LABELS[m.status] ?? m.status}
                  </span>
                </div>

                {(m.service || m.location || m.notes) && (
                  <div className="mt-1.5 space-y-0.5 text-xs text-slate-600">
                    {m.service && <div>{m.service.name}</div>}
                    {m.location && (
                      <div className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {m.location}
                      </div>
                    )}
                    {m.notes && <div className="text-slate-500 whitespace-pre-wrap break-words">{m.notes}</div>}
                  </div>
                )}

                {scheduled && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {due ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => outcomeMutation.mutate({ meetingId: m.id, outcome: "completed" })}
                          className={cn(SMALL_BTN, "border-transparent bg-[#059669] text-white hover:bg-[#047857]")}
                        >
                          <Check className="w-4 h-4" />
                          התקיימה
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => outcomeMutation.mutate({ meetingId: m.id, outcome: "no_show" })}
                          className={cn(SMALL_BTN, "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100")}
                        >
                          <UserX className="w-4 h-4" />
                          לא הגיע
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openEdit(m)}
                          className={cn(SMALL_BTN, "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}
                        >
                          <CalendarClock className="w-4 h-4" />
                          נדחתה
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openEdit(m)}
                        className={cn(SMALL_BTN, "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        ערוך
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setCancelTarget(m)}
                      className={cn(SMALL_BTN, "border-red-200 bg-white text-red-700 hover:bg-red-50")}
                    >
                      <X className="w-3.5 h-3.5" />
                      בטל פגישה
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Portaled to <body>: the drawer is a fixed z-50 layer, so its children can't stack above it */}
      {mounted && modalOpen && createPortal(
        <div className="modal-overlay z-[60]" dir="rtl">
          <div className="modal-backdrop" onClick={() => { if (!saveMutation.isPending) closeModal(); }} />
          <form
            onSubmit={submit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-meeting-modal-title"
            className="modal-content max-w-md mx-auto p-5 sm:p-6 text-[#0F172A]"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 id="lead-meeting-modal-title" className="text-base font-bold">
                פגישה עם {leadName}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                disabled={saveMutation.isPending}
                className="text-slate-400 hover:text-slate-700"
                aria-label="סגור"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="lead-meeting-date" className={FIELD_LABEL_CLS}>תאריך</label>
                <input
                  id="lead-meeting-date"
                  type="date"
                  required
                  className={cn(INPUT_CLS, "tabular-nums")}
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label htmlFor="lead-meeting-start" className={FIELD_LABEL_CLS}>שעת התחלה</label>
                  <input
                    id="lead-meeting-start"
                    type="time"
                    required
                    className={cn(INPUT_CLS, "tabular-nums")}
                    value={form.startTime}
                    onChange={(e) => onStartChange(e.target.value)}
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="lead-meeting-end" className={FIELD_LABEL_CLS}>שעת סיום</label>
                  <input
                    id="lead-meeting-end"
                    type="time"
                    required
                    className={cn(INPUT_CLS, "tabular-nums")}
                    value={form.endTime}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="lead-meeting-service" className={FIELD_LABEL_CLS}>
                  שירות <span className="text-slate-400 font-normal">(אופציונלי)</span>
                </label>
                <select
                  id="lead-meeting-service"
                  className={INPUT_CLS}
                  value={form.serviceId}
                  onChange={(e) => setForm((f) => ({ ...f, serviceId: e.target.value }))}
                >
                  <option value="">ללא שירות</option>
                  {(Array.isArray(services) ? services : []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="lead-meeting-location" className={FIELD_LABEL_CLS}>
                  מיקום <span className="text-slate-400 font-normal">(אופציונלי)</span>
                </label>
                <input
                  id="lead-meeting-location"
                  className={INPUT_CLS}
                  value={form.location}
                  maxLength={200}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="lead-meeting-notes" className={FIELD_LABEL_CLS}>
                  הערות <span className="text-slate-400 font-normal">(אופציונלי)</span>
                </label>
                <textarea
                  id="lead-meeting-notes"
                  rows={2}
                  className={TEXTAREA_CLS}
                  value={form.notes}
                  maxLength={2000}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <p className="text-xs text-slate-500">הליד נשאר ליד. תזכורת בוואטסאפ נשלחת אוטומטית יום לפני.</p>
              {formError && <p className="text-xs text-red-600">{formError}</p>}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="h-10 px-5 rounded-[10px] bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {saveMutation.isPending ? "שומר..." : editing ? "שמור" : "קבע פגישה"}
              </button>
              <button
                type="button"
                onClick={closeModal}
                disabled={saveMutation.isPending}
                className="h-10 px-4 border border-slate-200 rounded-[10px] bg-white text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                ביטול
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {mounted && createPortal(
        <ConfirmDialog
          open={!!cancelTarget}
          title="לבטל את הפגישה?"
          description={
            cancelTarget
              ? `הפגישה עם ${leadName} ב-${formatMeetingDay(cancelTarget.date.slice(0, 10))} ${cancelTarget.startTime} תבוטל, והתזכורת לא תישלח.`
              : undefined
          }
          confirmLabel="בטל פגישה"
          cancelLabel="השאר"
          danger
          loading={cancelMutation.isPending}
          onConfirm={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
          onCancel={() => setCancelTarget(null)}
        />,
        document.body
      )}
    </div>
  );
}

export default LeadMeetingsSection;
