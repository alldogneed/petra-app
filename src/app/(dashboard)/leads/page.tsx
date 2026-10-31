"use client";
import { PageTitle } from "@/components/ui/PageTitle";

import dynamic from "next/dynamic";
import { TierGate } from "@/components/paywall/TierGate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus, X, Phone, MessageCircle, Archive, Pencil, Trash2, Lock, GripVertical, UserCheck, Search, FileText,
  Clock, RefreshCw, Sparkles, Download, RotateCcw, ChevronDown, CheckSquare, Square, MinusSquare,
} from "lucide-react";
import { fetchJSON, toWhatsAppPhone, cn } from "@/lib/utils";
import { mapWithConcurrency } from "@/lib/concurrency";
import { triggerLimitModal } from "@/lib/limit-reached";
import { validateIsraeliPhone, validateEmail, sanitizeName, validateName, normalizeIsraeliPhone } from "@/lib/validation";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { formatAttributionLine } from "@/lib/lead-attribution";
import { sumDealValues, formatIls } from "@/lib/lead-deal-value";
import { LEAD_SOURCES, LOST_REASON_CODES } from "@/lib/constants";
import { LeadTreatmentModal } from "@/components/leads/LeadTreatmentModal";
import LeadDetailsModal from "@/components/leads/LeadDetailsModal";
const LeadsReports = dynamic(() => import("@/components/leads/LeadsReports").then(m => ({ default: m.LeadsReports })), { ssr: false });
import {
  DndContext,
  DragOverlay,
  closestCorners,
  pointerWithin,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  CollisionDetection,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { usePermissions } from "@/hooks/usePermissions";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { formatTime } from "@/lib/format";

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city?: string | null;
  requestedService?: string | null;
  source: string;
  stage: string;
  notes: string | null;
  createdAt: string;
  lastContactedAt: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lostReasonCode: string | null;
  lostReasonText: string | null;
  customerId: string | null;
  customer: { id: string; name: string } | null;
  nextFollowUpAt: string | null;
  followUpStatus: string | null;
  previousStageId: string | null;
  trafficSource?: string | null;
  landingPage?: string | null;
  dealValue?: number | null;
  callLogs?: {
    id: string;
    type?: string;
    summary: string;
    treatment: string;
    createdAt: string;
  }[];
  existingCustomer?: { id: string; name: string } | null;
  duplicateLead?: { id: string; name: string } | null;
}

interface LeadStage {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isWon: boolean;
  isLost: boolean;
}

// Stage color palette (column dot picker + stage editing)
const STAGE_SWATCHES = [
  "#94A3B8", "#64748B", "#6366F1", "#3B82F6", "#8B5CF6",
  "#EC4899", "#EF4444", "#F97316", "#F59E0B", "#10B981",
];

type SalesView = "board" | "followup" | "list" | "archive" | "reports";

type LeadsPageT = ReturnType<typeof useTranslations<"leads.leadsPage">>;

/** Normalize phone to 972XXXXXXXXX for local duplicate check */
function toPhoneNormLocal(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972") && digits.length >= 11) return digits;
  if (digits.startsWith("0") && digits.length >= 9) return "972" + digits.slice(1);
  return null;
}

function NewLeadModal({ isOpen, onClose, stages }: { isOpen: boolean; onClose: () => void; stages: LeadStage[] }) {
  const t = useTranslations("leads.leadsPage");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const activeStages = stages.filter((s) => !s.isWon && !s.isLost);
  const emptyForm = { name: "", phone: "", email: "", city: "", address: "", requestedService: "", source: "manual", notes: "", stage: activeStages[0]?.id || "" };
  const [form, setForm] = useState(emptyForm);
  const [phoneWarning, setPhoneWarning] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) { setForm({ ...emptyForm, stage: activeStages[0]?.id || "" }); setPhoneWarning(null); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function checkPhoneDuplicate(phone: string) {
    if (!phone.trim() || validateIsraeliPhone(phone)) { setPhoneWarning(null); return; }
    const norm = toPhoneNormLocal(phone);
    if (!norm) { setPhoneWarning(null); return; }
    const cached = queryClient.getQueryData<Lead[]>(["leads"]) ?? [];
    const match = cached.find(l => l.phone && toPhoneNormLocal(l.phone) === norm);
    setPhoneWarning(match ? t("newLead.existingPhoneWarning", { name: match.name }) : null);
  }

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({ error: t("newLead.errorFallback") }));
          const err = new Error(body.error || t("newLead.errorFallback"));
          if (body.code) (err as unknown as Record<string, unknown>).code = body.code;
          throw err;
        }
        return r.json();
      }),
    onSuccess: (data: Lead & { existingCustomer?: { id: string; name: string } | null }) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      onClose();
      if (data.existingCustomer) {
        toast.warning(t("newLead.createdWithExistingCustomer", { name: data.existingCustomer.name }), { duration: 6000 });
      } else {
        toast.success(t("newLead.created"));
      }
    },
    onError: (err: Error) => {
      if ((err as unknown as Record<string, unknown>).code === "LIMIT_REACHED") {
        triggerLimitModal(err.message);
      } else {
        toast.error(t("newLead.createError"));
      }
    },
  });

  const [leadFieldErrors, setLeadFieldErrors] = useState<{ name?: string; phone?: string; email?: string }>({});

  function validateAndSubmitLead() {
    const errors: typeof leadFieldErrors = {};
    const nameErr = validateName(form.name);
    if (nameErr) errors.name = nameErr;
    if (!form.phone.trim()) {
      errors.phone = t("newLead.phoneRequired");
    } else {
      const phoneErr = validateIsraeliPhone(form.phone);
      if (phoneErr) errors.phone = phoneErr;
    }
    if (form.email.trim()) {
      const emailErr = validateEmail(form.email);
      if (emailErr) errors.email = emailErr;
    }
    setLeadFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    mutation.mutate({ ...form, name: sanitizeName(form.name) });
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-petra-text">{t("newLead.title")}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">{t("newLead.nameLabel")}</label>
            <input
              className={cn("input", leadFieldErrors.name && "border-red-300 focus:ring-red-200")}
              value={form.name}
              onChange={(e) => { setForm({ ...form, name: e.target.value }); if (leadFieldErrors.name) setLeadFieldErrors({ ...leadFieldErrors, name: undefined }); }}
            />
            {leadFieldErrors.name && <p className="text-xs text-red-500 mt-1">{leadFieldErrors.name}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">{t("newLead.phoneLabel")}</label>
              <input
                type="tel"
                dir="ltr"
                className={cn("input text-right", leadFieldErrors.phone && "border-red-300 focus:ring-red-200", phoneWarning && !leadFieldErrors.phone && "border-amber-400")}
                value={form.phone}
                onChange={(e) => { setForm({ ...form, phone: e.target.value }); if (leadFieldErrors.phone) setLeadFieldErrors({ ...leadFieldErrors, phone: undefined }); }}
                onBlur={(e) => checkPhoneDuplicate(e.target.value)}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData("text");
                  const normalized = normalizeIsraeliPhone(pasted);
                  setForm((f) => ({ ...f, phone: normalized }));
                  if (leadFieldErrors.phone) setLeadFieldErrors((err) => ({ ...err, phone: undefined }));
                  setTimeout(() => checkPhoneDuplicate(normalized), 0);
                }}
                placeholder="050-0000000"
                inputMode="tel"
              />
              {leadFieldErrors.phone && <p className="text-xs text-red-500 mt-1">{leadFieldErrors.phone}</p>}
              {phoneWarning && !leadFieldErrors.phone && (
                <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                  <span>⚠️</span> {phoneWarning}
                </p>
              )}
            </div>
            <div>
              <label className="label">{t("newLead.emailLabel")}</label>
              <input
                dir="ltr"
                inputMode="email"
                className={cn("input text-right", leadFieldErrors.email && "border-red-300 focus:ring-red-200")}
                value={form.email}
                onChange={(e) => { setForm({ ...form, email: e.target.value }); if (leadFieldErrors.email) setLeadFieldErrors({ ...leadFieldErrors, email: undefined }); }}
              />
              {leadFieldErrors.email && <p className="text-xs text-red-500 mt-1">{leadFieldErrors.email}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("newLead.cityLabel")}</label>
              <input
                className="input"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder={t("newLead.cityPlaceholder")}
              />
            </div>
            <div>
              <label className="label">{t("newLead.addressLabel")}</label>
              <input
                className="input"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder={t("newLead.addressPlaceholder")}
              />
            </div>
          </div>
          <div>
            <label className="label">{t("newLead.serviceLabel")}</label>
            <input
              className="input"
              value={form.requestedService}
              onChange={(e) => setForm({ ...form, requestedService: e.target.value })}
              placeholder={t("newLead.servicePlaceholder")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("newLead.sourceLabel")}</label>
              <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {LEAD_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t("newLead.stageLabel")}</label>
              <select className="input" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                {activeStages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{t("newLead.notesLabel")}</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-primary flex-1" disabled={mutation.isPending} onClick={validateAndSubmitLead}>
            <Plus className="w-4 h-4" />{mutation.isPending ? tc("progress.saving") : t("newLead.submit")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}


// ─── Sales pipeline helpers ──────────────────────────────────────────────────

// getDay() index → followUp.weekdays.* message key
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

type FollowUpBucket = "overdue" | "today" | "tomorrow" | "week" | "later" | "none";

interface FollowUpInfo {
  bucket: FollowUpBucket;
  label: string;
  color: string;
  bg: string;
  border: string;
  sortKey: number;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Older follow-ups were saved date-only (UTC midnight) — don't show a made-up clock time for them. */
function hasClockTime(d: Date): boolean {
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) return false;
  if (d.getHours() === 0 && d.getMinutes() === 0) return false;
  return true;
}

function clockOf(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function localDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function atDayOffset(offset: number, hour: number): string {
  const d = startOfToday();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/** Translator + business locale for the follow-up label; omitted → label "" (bucket / sortKey only). */
interface FollowUpFmt {
  t: LeadsPageT;
  locale: string;
}

// Overdue = followUpDate < todayStart — the same condition sortLeadsByPriority() uses (rule #18).
function getFollowUpInfo(nextFollowUpAt: string | null, fmt?: FollowUpFmt): FollowUpInfo {
  const neutral = { bg: "#F8FAFC", border: "#E2E8F0" };
  if (!nextFollowUpAt) {
    return { bucket: "none", label: fmt ? fmt.t("followUp.none") : "", color: "#94A3B8", ...neutral, sortKey: Number.POSITIVE_INFINITY };
  }
  const d = new Date(nextFollowUpAt);
  const todayStart = startOfToday();
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((dayStart.getTime() - todayStart.getTime()) / 86400000);
  const time = fmt && hasClockTime(d) ? formatTime(clockOf(d), { locale: fmt.locale }) : "";
  const withTime = (s: string) => (time && fmt ? fmt.t("followUp.withTime", { label: s, time }) : s);
  const dm = fmt ? fmt.t("followUp.dayMonth", { day: d.getDate(), month: d.getMonth() + 1 }) : "";
  const sortKey = d.getTime();

  if (d < todayStart) {
    return { bucket: "overdue", label: fmt ? fmt.t("followUp.overdue", { date: dm }) : "", color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA", sortKey };
  }
  if (diff <= 0) {
    return { bucket: "today", label: withTime(fmt ? fmt.t("followUp.today") : ""), color: "#C2410C", bg: "#FFF7ED", border: "#FED7AA", sortKey };
  }
  if (diff === 1) {
    return { bucket: "tomorrow", label: withTime(fmt ? fmt.t("followUp.tomorrow", { date: dm }) : ""), color: "#475569", ...neutral, sortKey };
  }
  const weekdayLabel = withTime(fmt ? fmt.t("followUp.weekday", { weekday: fmt.t(`followUp.weekdays.${WEEKDAY_KEYS[d.getDay()]}`), date: dm }) : "");
  if (diff < 7) {
    return { bucket: "week", label: weekdayLabel, color: "#475569", ...neutral, sortKey };
  }
  return { bucket: "later", label: weekdayLabel, color: "#64748B", ...neutral, sortKey };
}

function byFollowUp(a: Lead, b: Lead): number {
  const ka = getFollowUpInfo(a.nextFollowUpAt).sortKey;
  const kb = getFollowUpInfo(b.nextFollowUpAt).sortKey;
  if (ka === kb) return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  return ka - kb;
}

const FU_DROP_PREFIX = "fu:";

// Column name = followUp.columns.<id>
const FOLLOW_UP_COLUMNS: {
  id: "overdue" | "today" | "tomorrow" | "week" | "later";
  color: string;
  buckets: FollowUpBucket[];
  target: (() => string) | null;
}[] = [
  { id: "overdue", color: "#EF4444", buckets: ["overdue"], target: null },
  { id: "today", color: "#F97316", buckets: ["today"], target: () => atDayOffset(0, 18) },
  { id: "tomorrow", color: "#3B82F6", buckets: ["tomorrow"], target: () => atDayOffset(1, 10) },
  { id: "week", color: "#8B5CF6", buckets: ["week"], target: () => atDayOffset(3, 10) },
  { id: "later", color: "#94A3B8", buckets: ["later", "none"], target: () => atDayOffset(7, 10) },
];

// Label = followUp.quick.<id>
const FOLLOW_UP_QUICK = [
  { id: "today18", at: () => atDayOffset(0, 18) },
  { id: "tomorrow10", at: () => atDayOffset(1, 10) },
  { id: "in3Days", at: () => atDayOffset(3, 10) },
  { id: "inWeek", at: () => atDayOffset(7, 10) },
] as const;

function isHexColor(c: string | null | undefined): c is string {
  return !!c && /^#[0-9a-fA-F]{6}$/.test(c);
}

function sourceLabelOf(source: string): string {
  return LEAD_SOURCES.find((s) => s.id === source)?.label || source;
}

/** מחלץ עיר ושירות מבוקש מתוך שדה ה-notes */
function parseLeadMeta(notes: string | null): { city: string | null; service: string | null; cleanNotes: string | null } {
  if (!notes) return { city: null, service: null, cleanNotes: null };
  let city: string | null = null;
  let service: string | null = null;
  const lines = notes.split("\n").filter((line) => {
    const cityMatch = line.match(/^עיר:\s*(.+)/); // i18n-ok — legacy notes format (data)
    const serviceMatch = line.match(/^שירות מבוקש:\s*(.+)/); // i18n-ok — legacy notes format (data)
    if (cityMatch) { city = cityMatch[1].trim(); return false; }
    if (serviceMatch) { service = serviceMatch[1].trim(); return false; }
    return true;
  });
  const cleanNotes = lines.join("\n").trim() || null;
  return { city, service, cleanNotes };
}

/** City / service live in their own columns on newer leads and inside `notes` on older ones. */
function leadMeta(lead: Lead): { city: string | null; service: string | null; cleanNotes: string | null } {
  const parsed = parseLeadMeta(lead.notes);
  return {
    city: lead.city || parsed.city,
    service: lead.requestedService || parsed.service,
    cleanNotes: parsed.cleanNotes,
  };
}

/** Last contact snippet — deal-value journal lines are not contact activity (rule #28). */
function leadSnippet(lead: Lead): string | null {
  const contactLogs = (lead.callLogs ?? []).filter((log) => log.type !== "deal_value");
  if (contactLogs.length > 0) return contactLogs[0].summary;
  return leadMeta(lead).cleanNotes;
}

function openWhatsApp(phone: string) {
  window.open(`https://wa.me/${toWhatsAppPhone(phone)}`, "whatsapp_window");
}

const CARD_HOVER_SHADOW = "hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.10),0_2px_8px_-2px_rgba(0,0,0,0.06)]";
const POPOVER_SHADOW = "shadow-[0_8px_24px_-4px_rgba(0,0,0,0.10),0_2px_8px_-2px_rgba(0,0,0,0.06)]";
const PANEL = "bg-white border border-slate-200 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]";
const TOOL_BTN = "h-9 px-3 rounded-[10px] border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50";
const TOOL_BTN_ON = "!bg-[#FFF7ED] !border-[#FED7AA] !text-[#C2410C]";
const WA_BTN = "flex items-center justify-center rounded-lg bg-[#059669] hover:bg-[#047857] text-white transition-colors flex-shrink-0";
const CALL_BTN = "flex items-center justify-center rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white transition-colors flex-shrink-0";

function chipClass(on: boolean, big = false): string {
  return cn(
    "flex-shrink-0 whitespace-nowrap border text-[13px] font-medium transition-colors",
    big ? "h-9 px-3.5 rounded-full" : "h-[30px] px-3 rounded-lg",
    on ? "bg-[#0F172A] border-[#0F172A] text-white" : "bg-white border-slate-200 text-slate-700 hover:border-slate-300",
  );
}

function StageDot({ color }: { color: string }) {
  return <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: isHexColor(color) ? color : "#94A3B8" }} />;
}

// ─── Follow-up picker (card pill popover) ────────────────────────────────────

function FollowUpPicker({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const t = useTranslations("leads.leadsPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const queryClient = useQueryClient();
  const initial = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null;
  const [date, setDate] = useState(initial ? localDateInput(initial) : "");
  const [time, setTime] = useState(initial && hasClockTime(initial) ? clockOf(initial) : "10:00");

  const mutation = useMutation({
    mutationFn: (iso: string | null) =>
      fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextFollowUpAt: iso }),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: (_, iso) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-counters"] });
      toast.success(iso ? t("followUp.picker.saved") : t("followUp.picker.cleared"));
      onClose();
    },
    onError: () => toast.error(t("followUp.picker.updateError")),
  });

  const saveCustom = () => {
    if (!date) { mutation.mutate(null); return; }
    const d = new Date(`${date}T${time || "10:00"}`);
    if (isNaN(d.getTime())) { toast.error(t("followUp.picker.invalidDate")); return; }
    mutation.mutate(d.toISOString());
  };

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className={cn("absolute top-9 inset-x-0 z-40 min-w-[200px] bg-white border border-slate-200 rounded-xl p-3", POPOVER_SHADOW)}>
        <p className="text-xs font-semibold text-slate-500 mb-2">{t("followUp.picker.title", { name: lead.name })}</p>
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {FOLLOW_UP_QUICK.map((q) => (
            <button
              key={q.id}
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(q.at())}
              className="h-8 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-[#FED7AA] hover:bg-[#FFF7ED] hover:text-[#C2410C] transition-colors disabled:opacity-50"
            >
              {t(`followUp.quick.${q.id}`)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          <input
            type="date"
            lang={cfg.lang}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 w-full border border-slate-200 rounded-lg px-2 text-[13px] bg-white outline-none focus:border-[#FB923C] focus:ring-[3px] focus:ring-orange-500/15"
          />
          <input
            type="time"
            step={900}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-9 w-full border border-slate-200 rounded-lg px-2 text-[13px] bg-white outline-none focus:border-[#FB923C] focus:ring-[3px] focus:ring-orange-500/15"
          />
        </div>
        <div className="flex gap-1.5 mt-2.5">
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={saveCustom}
            className="flex-1 h-8 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? tc("progress.saving") : t("followUp.picker.save")}
          </button>
          {lead.nextFollowUpAt && (
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(null)}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {t("followUp.picker.clear")}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Lead card (board + follow-up views) ─────────────────────────────────────

function LeadCard({
  lead,
  stage,
  showStage = false,
  onOpen,
  onDetails,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}: {
  lead: Lead;
  stage?: LeadStage;
  showStage?: boolean;
  onOpen: () => void;
  onDetails: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const t = useTranslations("leads.leadsPage");
  const { locale } = useBusinessLocale();
  const [showPicker, setShowPicker] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
    disabled: selectionMode, // no dragging while selecting — clicks toggle selection
  });

  const fu = getFollowUpInfo(lead.nextFollowUpAt, { t, locale });
  const { city, service } = leadMeta(lead);
  const snippet = leadSnippet(lead);
  const attributionLine = formatAttributionLine({ trafficSource: lead.trafficSource, landingPage: lead.landingPage });
  const detailLine = [service, sourceLabelOf(lead.source)].filter(Boolean).join(" · ");

  return (
    <div
      ref={setNodeRef}
      {...(selectionMode ? {} : attributes)}
      {...(selectionMode ? {} : listeners)}
      onClick={selectionMode ? undefined : onOpen}
      className={cn(
        "relative bg-white border border-slate-200 rounded-xl px-3.5 py-3 transition-[box-shadow,border-color,opacity] duration-150 hover:border-slate-300",
        CARD_HOVER_SHADOW,
        selectionMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-35",
        selectionMode && isSelected && "!border-[#FB923C] ring-2 ring-orange-200 bg-[#FFF7ED]",
      )}
    >
      {/* Selection overlay — whole card toggles selection, inner actions blocked */}
      {selectionMode && (
        <button
          type="button"
          aria-label={isSelected ? t("card.deselectLead") : t("card.selectLead")}
          className="absolute inset-0 z-10 cursor-pointer rounded-xl"
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
        />
      )}

      <div className="flex items-baseline gap-2">
        {selectionMode && (
          isSelected
            ? <CheckSquare className="w-4 h-4 text-brand-500 flex-shrink-0 self-center" />
            : <Square className="w-4 h-4 text-slate-400 flex-shrink-0 self-center" />
        )}
        <span className="text-sm font-semibold text-petra-text flex-1 min-w-0 truncate">{lead.name}</span>
        {lead.dealValue != null && (
          <span className="text-xs text-slate-500 tabular-nums flex-shrink-0" title={t("card.dealValue")}>{formatIls(lead.dealValue)}</span>
        )}
        {!selectionMode && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDetails(); }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            title={t("card.details")}
            aria-label={t("card.details")}
            className="w-8 h-8 sm:w-6 sm:h-6 -my-1 -me-1.5 rounded-md flex items-center justify-center text-slate-300 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0 self-center"
          >
            <FileText className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {(lead.phone || city) && (
        <div className="text-xs text-slate-600 mt-1 truncate">
          {lead.phone && <span dir="ltr" className="tabular-nums">{lead.phone}</span>}
          {lead.phone && city && <span className="mx-1 text-slate-300">·</span>}
          {city}
        </div>
      )}
      {detailLine && <div className="text-xs text-slate-500 mt-0.5 truncate">{detailLine}</div>}
      {showStage && stage && (
        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
          <StageDot color={stage.color} />{stage.name}
        </div>
      )}
      {attributionLine && (
        <div className="text-[11px] text-slate-400 mt-0.5 truncate" title={attributionLine}>{attributionLine}</div>
      )}

      {(lead.existingCustomer || lead.duplicateLead) && (
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {lead.existingCustomer && (
            <span className="text-[11px] px-2 py-px rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium" title={t("card.existingCustomerTitle", { name: lead.existingCustomer.name })}>
              {t("card.existingCustomer")}
            </span>
          )}
          {lead.duplicateLead && !lead.existingCustomer && (
            <span className="text-[11px] px-2 py-px rounded-full bg-orange-50 text-orange-700 border border-orange-200 font-medium" title={t("card.returningLeadTitle", { name: lead.duplicateLead.name })}>
              {t("card.returningLead")}
            </span>
          )}
        </div>
      )}

      {snippet && (
        <p className="text-xs text-slate-600 mt-2 leading-[1.45] line-clamp-2 whitespace-pre-line">{snippet}</p>
      )}

      {/* Footer — pointer events stop here so buttons never start a drag */}
      <div
        className="relative flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="flex-1 min-w-0 flex">
          <button
            type="button"
            onClick={() => setShowPicker((v) => !v)}
            title={t("card.updateFollowUp")}
            className="inline-flex items-center gap-1 h-8 sm:h-6 px-2 rounded-full border text-xs font-medium tabular-nums whitespace-nowrap max-w-full overflow-hidden"
            style={{ color: fu.color, background: fu.bg, borderColor: fu.border }}
          >
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{fu.label}</span>
          </button>
          {showPicker && <FollowUpPicker lead={lead} onClose={() => setShowPicker(false)} />}
        </div>
        {lead.phone && (
          <button type="button" onClick={() => openWhatsApp(lead.phone!)} title={t("card.whatsapp")} className={cn(WA_BTN, "w-9 h-9 sm:w-7 sm:h-7")}>
            <MessageCircle className="w-3.5 h-3.5" />
          </button>
        )}
        <button type="button" onClick={onOpen} title={t("card.logCall")} className={cn(CALL_BTN, "w-9 h-9 sm:w-7 sm:h-7")}>
          <Phone className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Stage column (board view) ───────────────────────────────────────────────

function StageColumn({
  stage,
  leads,
  editMode,
  editingStageId,
  editingName,
  onStartEdit,
  onChangeName,
  onSaveName,
  onChangeColor,
  onDelete,
  onLeadClick,
  onDetails,
  dragAttributes,
  dragListeners,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
}: {
  stage: LeadStage;
  leads: Lead[];
  editMode: boolean;
  editingStageId: string | null;
  editingName: string;
  onStartEdit: (id: string, name: string) => void;
  onChangeName: (name: string) => void;
  onSaveName: (id: string) => void;
  onChangeColor: (id: string, color: string) => void;
  onDelete: (stage: LeadStage) => void;
  onLeadClick: (l: Lead) => void;
  onDetails: (l: Lead) => void;
  dragAttributes?: Record<string, any>;
  dragListeners?: Record<string, any>;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  const t = useTranslations("leads.leadsPage");
  const { isOver, setNodeRef } = useDroppable({ id: stage.id, disabled: editMode });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const columnValue = sumDealValues(leads);
  const tint = isHexColor(stage.color) ? stage.color : "#94A3B8";

  return (
    <div
      ref={setNodeRef}
      className="rounded-[14px] p-2.5 transition-colors border-t-[3px]"
      style={{
        // The whole column carries its stage color (header strip + soft tint), so a color change is visible
        background: isOver ? `${tint}2E` : `${tint}14`,
        borderTopColor: tint,
        outline: `2px dashed ${isOver ? tint : "transparent"}`,
        outlineOffset: -2,
      }}
    >
      {/* Column header */}
      <div className={cn("flex items-center gap-2 px-1.5 pt-1 pb-3 relative", editMode && "bg-amber-50/80 rounded-lg -mx-0.5 px-2 pt-1.5 mb-1")}>
        {editMode && dragListeners && (
          <button className="cursor-grab active:cursor-grabbing text-amber-500 hover:text-amber-700" {...dragAttributes} {...dragListeners}>
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowColorPicker((v) => !v)}
          title={t("column.changeColor")}
          className="w-[18px] h-[18px] rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors flex-shrink-0"
        >
          <StageDot color={stage.color} />
        </button>
        {showColorPicker && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowColorPicker(false)} />
            <div className={cn("absolute top-8 start-0 z-40 bg-white border border-slate-200 rounded-xl p-2.5 w-44", POPOVER_SHADOW)}>
              <div className="text-xs text-slate-500 mb-2 truncate">{t("column.colorFor", { name: stage.name })}</div>
              <div className="grid grid-cols-5 gap-1.5">
                {STAGE_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={t("column.colorSwatch", { color: c })}
                    className="w-[26px] h-[26px] rounded-full"
                    style={{
                      background: c,
                      boxShadow: c.toLowerCase() === (stage.color || "").toLowerCase() ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : "none",
                    }}
                    onClick={() => { onChangeColor(stage.id, c); setShowColorPicker(false); }}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {editMode && editingStageId === stage.id ? (
          <input
            className="text-sm font-semibold text-petra-text bg-white border border-brand-300 rounded px-2 py-0.5 w-28 focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={editingName}
            onChange={(e) => onChangeName(e.target.value)}
            onBlur={() => onSaveName(stage.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveName(stage.id);
              if (e.key === "Escape") onSaveName(stage.id);
            }}
            autoFocus
          />
        ) : (
          <span
            className={cn("text-sm font-semibold text-petra-text truncate", editMode && "cursor-pointer hover:text-brand-600 border-b border-dashed border-amber-400")}
            onClick={() => editMode && onStartEdit(stage.id, stage.name)}
          >
            {stage.name}
          </span>
        )}
        <span className="text-[13px] text-slate-400 tabular-nums">{leads.length}</span>

        {columnValue > 0 && (
          <span className="ms-auto text-xs text-slate-500 tabular-nums whitespace-nowrap" title={t("column.totalDealValue")}>
            {formatIls(columnValue)}
          </span>
        )}

        {editMode && (
          stage.isWon || stage.isLost ? (
            <span title={t("column.cannotDelete")} className={columnValue > 0 ? "" : "ms-auto"}>
              <Lock className="w-4 h-4 text-petra-muted" />
            </span>
          ) : (
            <button
              onClick={() => onDelete(stage)}
              className={cn("w-6 h-6 flex items-center justify-center rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors", columnValue > 0 ? "" : "ms-auto")}
              title={t("column.deleteStage")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )
        )}
      </div>

      {/* Column body */}
      <div className="flex flex-col gap-2 min-h-[420px]">
        {!editMode && leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            stage={stage}
            onOpen={() => onLeadClick(lead)}
            onDetails={() => onDetails(lead)}
            selectionMode={selectionMode}
            isSelected={selectedIds?.has(lead.id) ?? false}
            onToggleSelect={() => onToggleSelect?.(lead.id)}
          />
        ))}
        {editMode && leads.map((lead) => (
          <div key={lead.id} className="bg-white/70 border border-slate-200 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-500 truncate">
            {lead.name}
          </div>
        ))}
        {leads.length === 0 && !isOver && (
          <div className="text-[13px] text-slate-400 text-center py-6">{t("column.empty")}</div>
        )}
      </div>
    </div>
  );
}

// ─── Edit Mode: Sortable Column Wrapper ──────────────────────────────────────

function SortableStageColumn(props: React.ComponentProps<typeof StageColumn>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.stage.id,
    disabled: !props.editMode,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="min-w-[252px] flex-1 flex-shrink-0"
    >
      <StageColumn {...props} dragAttributes={attributes} dragListeners={listeners} />
    </div>
  );
}

// ─── Follow-up column (follow-up view) ───────────────────────────────────────

function FollowUpColumn({
  column,
  leads,
  stagesById,
  onLeadClick,
  onDetails,
}: {
  column: (typeof FOLLOW_UP_COLUMNS)[number];
  leads: Lead[];
  stagesById: Map<string, LeadStage>;
  onLeadClick: (l: Lead) => void;
  onDetails: (l: Lead) => void;
}) {
  const t = useTranslations("leads.leadsPage");
  const droppable = !!column.target;
  const { isOver, setNodeRef } = useDroppable({ id: FU_DROP_PREFIX + column.id, disabled: !droppable });
  const columnValue = sumDealValues(leads);

  return (
    <div
      ref={setNodeRef}
      className="rounded-[14px] p-2.5 transition-colors min-w-[252px] flex-1 flex-shrink-0"
      style={{
        background: isOver ? "#FFF7ED" : "#F1F5F9",
        outline: `2px dashed ${isOver ? "#FDBA74" : "transparent"}`,
        outlineOffset: -2,
      }}
    >
      <div className="flex items-center gap-2 px-1.5 pt-1 pb-3">
        <StageDot color={column.color} />
        <span className="text-sm font-semibold text-petra-text">{t(`followUp.columns.${column.id}`)}</span>
        <span className="text-[13px] text-slate-400 tabular-nums">{leads.length}</span>
        {columnValue > 0 && (
          <span className="ms-auto text-xs text-slate-500 tabular-nums whitespace-nowrap">{formatIls(columnValue)}</span>
        )}
      </div>
      <div className="flex flex-col gap-2 min-h-[420px]">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            stage={stagesById.get(lead.stage)}
            showStage
            onOpen={() => onLeadClick(lead)}
            onDetails={() => onDetails(lead)}
          />
        ))}
        {leads.length === 0 && !isOver && (
          <div className="text-[13px] text-slate-400 text-center py-6">
            {column.id === "overdue" ? t("followUp.emptyOverdue") : t("followUp.empty")}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Won / lost drop zones (shown while dragging) ────────────────────────────

function archiveValueSuffix(leads: Lead[]): string {
  const total = sumDealValues(leads);
  return total > 0 ? ` · ${formatIls(total)}` : "";
}

function ArchiveDropZones({
  leads,
  wonStage,
  lostStage,
  active,
}: {
  leads: Lead[];
  wonStage?: LeadStage;
  lostStage?: LeadStage;
  active: boolean;
}) {
  const t = useTranslations("leads.leadsPage");
  const won = useDroppable({ id: wonStage?.id || "__won", disabled: !wonStage });
  const lost = useDroppable({ id: lostStage?.id || "__lost", disabled: !lostStage });

  if (!wonStage && !lostStage) return null;

  const wonLeads = wonStage ? leads.filter((l) => l.stage === wonStage.id) : [];
  const lostLeads = lostStage ? leads.filter((l) => l.stage === lostStage.id) : [];
  const zone = "flex-1 h-16 rounded-[14px] border-2 border-dashed flex flex-col items-center justify-center text-sm font-semibold shadow-[0_8px_24px_-4px_rgba(0,0,0,0.10)] transition-colors";

  // Always mounted (so dnd-kit measures them on drag start) — only faded in while a card is dragged.
  return (
    <div
      className={cn("fixed bottom-5 end-4 md:end-6 z-40 flex gap-3 transition-opacity duration-150", active ? "opacity-100" : "opacity-0 pointer-events-none")}
      style={{ insetInlineStart: "calc(var(--petra-shell-inset, 0px) + 16px)" }}
      aria-hidden={!active}
    >
      {wonStage && (
        <div ref={won.setNodeRef} className={cn(zone, "border-[#6EE7B7] text-[#047857]", won.isOver ? "bg-[#ECFDF5]" : "bg-white")}>
          {t("dropZones.won")}
          <span className="text-[11px] font-normal text-slate-500 tabular-nums">{t("dropZones.wonCount", { count: wonLeads.length, suffix: archiveValueSuffix(wonLeads) })}</span>
        </div>
      )}
      {lostStage && (
        <div ref={lost.setNodeRef} className={cn(zone, "border-[#FCA5A5] text-[#B91C1C]", lost.isOver ? "bg-[#FEF2F2]" : "bg-white")}>
          {t("dropZones.lost")}
          <span className="text-[11px] font-normal text-slate-500 tabular-nums">{t("dropZones.lostCount", { count: lostLeads.length, suffix: archiveValueSuffix(lostLeads) })}</span>
        </div>
      )}
    </div>
  );
}

// ─── List view ───────────────────────────────────────────────────────────────

const LIST_GRID = "grid grid-cols-[minmax(150px,1.3fr)_minmax(110px,1fr)_minmax(90px,0.8fr)_minmax(90px,0.8fr)_minmax(120px,1fr)_minmax(140px,1.2fr)_minmax(70px,0.6fr)_104px] gap-3 px-5";

function LeadsListView({
  leads,
  stagesById,
  onLeadClick,
  onDetails,
}: {
  leads: Lead[];
  stagesById: Map<string, LeadStage>;
  onLeadClick: (l: Lead) => void;
  onDetails: (l: Lead) => void;
}) {
  const t = useTranslations("leads.leadsPage");
  const { locale } = useBusinessLocale();
  return (
    <div className={cn(PANEL, "overflow-x-auto")}>
      <div className="min-w-[1000px]">
        <div className={cn(LIST_GRID, "py-3 border-b border-slate-200 text-xs font-semibold text-slate-500")}>
          <span>{t("list.headers.lead")}</span><span>{t("list.headers.service")}</span><span>{t("list.headers.city")}</span><span>{t("list.headers.source")}</span><span>{t("list.headers.stage")}</span><span>{t("list.headers.followUp")}</span><span>{t("list.headers.value")}</span><span />
        </div>
        {leads.map((lead) => {
          const { city, service } = leadMeta(lead);
          const stage = stagesById.get(lead.stage);
          const fu = getFollowUpInfo(lead.nextFollowUpAt, { t, locale });
          return (
            <div
              key={lead.id}
              onClick={() => onLeadClick(lead)}
              className={cn(LIST_GRID, "py-3 border-b border-slate-100 items-center text-[13px] cursor-pointer hover:bg-slate-50 transition-colors")}
            >
              <div className="min-w-0">
                <div className="font-semibold text-petra-text truncate">{lead.name}</div>
                {lead.phone && <div dir="ltr" className="text-xs text-slate-500 tabular-nums text-right">{lead.phone}</div>}
              </div>
              <span className="text-slate-700 truncate">{service || "—"}</span>
              <span className="text-slate-600 truncate">{city || "—"}</span>
              <span className="text-slate-500 truncate">{sourceLabelOf(lead.source)}</span>
              <span className="flex items-center gap-1.5 min-w-0">
                {stage && <StageDot color={stage.color} />}
                <span className="truncate">{stage?.name || "—"}</span>
              </span>
              <span className="font-medium tabular-nums truncate" style={{ color: fu.color }}>{fu.label}</span>
              <span className="tabular-nums">{lead.dealValue != null ? formatIls(lead.dealValue) : "—"}</span>
              <span className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => onDetails(lead)} title={t("card.details")} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                  <FileText className="w-3.5 h-3.5" />
                </button>
                {lead.phone && (
                  <button type="button" onClick={() => openWhatsApp(lead.phone!)} title={t("card.whatsapp")} className={cn(WA_BTN, "w-7 h-7")}>
                    <MessageCircle className="w-3.5 h-3.5" />
                  </button>
                )}
                <button type="button" onClick={() => onLeadClick(lead)} title={t("card.logCall")} className={cn(CALL_BTN, "w-7 h-7")}>
                  <Phone className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          );
        })}
        {leads.length === 0 && (
          <div className="py-10 text-center text-[13px] text-slate-400">{t("list.empty")}</div>
        )}
      </div>
    </div>
  );
}

// ─── Mobile board (tabs: לטיפול + stages) ────────────────────────────────────

function MobileBoard({
  leads,
  activeStages,
  onLeadClick,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
  onShownChange,
  onTabChange,
}: {
  leads: Lead[];
  activeStages: LeadStage[];
  onLeadClick: (l: Lead) => void;
  /** Phones: "בחר" turns a tap into select/unselect (bulk delete from the bottom bar). */
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  /** The ids this tab shows — "בחר הכל" on the phone selects only these. */
  onShownChange?: (ids: string[]) => void;
  onTabChange?: () => void;
}) {
  const t = useTranslations("leads.leadsPage");
  const { locale } = useBusinessLocale();
  const [tab, setTabState] = useState<string>("focus");
  const setTab = (id: string) => {
    setTabState(id);
    onTabChange?.();
  };
  const stagesById = useMemo(() => new Map(activeStages.map((s) => [s.id, s])), [activeStages]);
  const focus = leads.filter((l) => {
    const b = getFollowUpInfo(l.nextFollowUpAt).bucket;
    return b === "overdue" || b === "today";
  });
  const tabs = [
    { id: "focus", label: t("mobile.focusTab"), count: focus.length },
    ...activeStages.map((s) => ({ id: s.id, label: s.name, count: leads.filter((l) => l.stage === s.id).length })),
  ];
  const shown = (tab === "focus" ? focus : leads.filter((l) => l.stage === tab)).slice().sort(byFollowUp);
  const shownKey = shown.map((l) => l.id).join(",");
  useEffect(() => {
    onShownChange?.(shownKey ? shownKey.split(",") : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey]);

  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-0.5">
        {tabs.map((tb) => (
          <button key={tb.id} type="button" onClick={() => setTab(tb.id)} className={chipClass(tab === tb.id, true)}>
            {tb.label} <span className="opacity-70 tabular-nums">{tb.count}</span>
          </button>
        ))}
      </div>
      <div className={cn("flex flex-col gap-2 mt-3.5", selectionMode ? "pb-40" : "pb-8")}>
        {shown.map((lead) => {
          const fu = getFollowUpInfo(lead.nextFollowUpAt, { t, locale });
          const { city, service } = leadMeta(lead);
          const stage = stagesById.get(lead.stage);
          const isSelected = selectionMode && (selectedIds?.has(lead.id) ?? false);
          return (
            <div
              key={lead.id}
              onClick={() => (selectionMode ? onToggleSelect?.(lead.id) : onLeadClick(lead))}
              role={selectionMode ? "checkbox" : undefined}
              aria-checked={selectionMode ? isSelected : undefined}
              className={cn(
                "bg-white border border-slate-200 rounded-[14px] p-3.5 active:bg-slate-50",
                isSelected && "!border-[#FB923C] ring-2 ring-orange-200 bg-[#FFF7ED]",
              )}
            >
              <div className="flex items-baseline gap-2">
                {selectionMode && (
                  <span className="self-center flex-shrink-0" aria-hidden>
                    {isSelected ? <CheckSquare className="w-5 h-5 text-brand-500" /> : <Square className="w-5 h-5 text-slate-400" />}
                  </span>
                )}
                <span className="text-[15px] font-semibold text-petra-text flex-1 min-w-0 truncate">{lead.name}</span>
                {lead.dealValue != null && <span className="text-xs text-slate-500 tabular-nums">{formatIls(lead.dealValue)}</span>}
              </div>
              {(lead.phone || city) && (
                <div className="text-[13px] text-slate-600 mt-0.5 truncate">
                  {lead.phone && <span dir="ltr" className="tabular-nums">{lead.phone}</span>}
                  {lead.phone && city && <span className="mx-1 text-slate-300">·</span>}
                  {city}
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 min-w-0">
                {stage && <StageDot color={stage.color} />}
                <span className="truncate">{[stage?.name, service].filter(Boolean).join(" · ")}</span>
              </div>
              <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                <span className="flex-1 min-w-0 text-[13px] font-medium tabular-nums truncate" style={{ color: fu.color }}>{fu.label}</span>
                {lead.phone && !selectionMode && (
                  <>
                    <button type="button" onClick={() => openWhatsApp(lead.phone!)} aria-label={t("card.whatsapp")} className={cn(WA_BTN, "w-11 h-11 rounded-xl")}>
                      <MessageCircle className="w-[18px] h-[18px]" />
                    </button>
                    <a href={`tel:${lead.phone}`} aria-label={t("mobile.callClient")} className={cn(CALL_BTN, "w-11 h-11 rounded-xl")}>
                      <Phone className="w-[18px] h-[18px]" />
                    </a>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {shown.length === 0 && (
          <div className="py-10 text-center text-[13px] text-slate-400">{tab === "focus" ? t("mobile.emptyFocus") : t("mobile.empty")}</div>
        )}
      </div>
    </div>
  );
}

// ─── Archive Tab ─────────────────────────────────────────────────────────────

const ARCHIVE_GRID = "grid grid-cols-[minmax(150px,1.3fr)_minmax(100px,1fr)_minmax(80px,0.7fr)_minmax(150px,1.6fr)_minmax(80px,0.8fr)_minmax(70px,0.7fr)_110px] gap-3 px-5";

function ArchiveTab({
  leads,
  wonStage,
  lostStage,
  activeStages,
  searchQuery,
  onLeadClick,
}: {
  leads: Lead[];
  wonStage?: LeadStage;
  lostStage?: LeadStage;
  activeStages: LeadStage[];
  searchQuery: string;
  onLeadClick: (l: Lead) => void;
}) {
  const t = useTranslations("leads.leadsPage");
  const { locale } = useBusinessLocale();
  const queryClient = useQueryClient();
  const [restoreLead, setRestoreLead] = useState<Lead | null>(null);
  const [filterType, setFilterType] = useState<"all" | "won" | "lost">("all");

  const archivedLeads = leads.filter(l => l.stage === wonStage?.id || l.stage === lostStage?.id);

  const filtered = archivedLeads
    .filter(l => filterType === "all" || (filterType === "won" ? l.stage === wonStage?.id : l.stage === lostStage?.id))
    .filter(l => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return l.name.toLowerCase().includes(q)
        || (l.phone || "").includes(q)
        || (l.email || "").toLowerCase().includes(q)
        || (l.lostReasonText || "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const dateA = new Date(a.lostAt || a.wonAt || a.createdAt).getTime();
      const dateB = new Date(b.lostAt || b.wonAt || b.createdAt).getTime();
      return dateB - dateA;
    });

  const counts = {
    all: archivedLeads.length,
    won: archivedLeads.filter(l => l.stage === wonStage?.id).length,
    lost: archivedLeads.filter(l => l.stage === lostStage?.id).length,
  };

  return (
    <div>
      <div className="flex items-center gap-1 mb-4 flex-wrap">
        {(["all", "won", "lost"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilterType(f)} className={chipClass(filterType === f)}>
            {t(`archive.filters.${f}`)} <span className="tabular-nums opacity-80">{counts[f]}</span>
          </button>
        ))}
      </div>

      <div className={cn(PANEL, "overflow-x-auto")}>
        <div className="min-w-[900px]">
          <div className={cn(ARCHIVE_GRID, "py-3 border-b border-slate-200 text-xs font-semibold text-slate-500")}>
            <span>{t("archive.headers.lead")}</span><span>{t("archive.headers.service")}</span><span>{t("archive.headers.status")}</span><span>{t("archive.headers.reason")}</span><span>{t("archive.headers.date")}</span><span>{t("archive.headers.value")}</span><span />
          </div>
          {filtered.map(lead => {
            const isWon = lead.stage === wonStage?.id;
            const lostReasonLabel = lead.lostReasonCode
              ? LOST_REASON_CODES.find(r => r.id === lead.lostReasonCode)?.label
              : null;
            const date = isWon ? lead.wonAt : lead.lostAt;
            const { service, cleanNotes } = leadMeta(lead);
            const reason = isWon ? (cleanNotes || "—") : ([lostReasonLabel, lead.lostReasonText].filter(Boolean).join(" · ") || "—");
            return (
              <div
                key={lead.id}
                onClick={() => onLeadClick(lead)}
                className={cn(ARCHIVE_GRID, "py-3 border-b border-slate-100 items-center text-[13px] cursor-pointer hover:bg-slate-50 transition-colors")}
              >
                <div className="min-w-0">
                  <div className="font-semibold text-petra-text truncate">{lead.name}</div>
                  {lead.phone && (
                    <a
                      href={`https://wa.me/${toWhatsAppPhone(lead.phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="ltr"
                      onClick={(e) => e.stopPropagation()}
                      className="block text-xs text-slate-500 hover:text-[#047857] tabular-nums text-right"
                      title={t("archive.sendWhatsapp")}
                    >
                      {lead.phone}
                    </a>
                  )}
                </div>
                <span className="text-slate-700 truncate">{service || "—"}</span>
                <span>
                  <span className={cn(
                    "inline-block text-xs font-medium px-2.5 py-0.5 rounded-full border",
                    isWon ? "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]" : "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
                  )}>
                    {isWon ? t("archive.wonBadge") : t("archive.lostBadge")}
                  </span>
                </span>
                <span className="text-slate-600 truncate" title={reason}>{reason}</span>
                <span className="text-slate-500 tabular-nums whitespace-nowrap">{date ? new Date(date).toLocaleDateString(locale) : "—"}</span>
                <span className="tabular-nums">{lead.dealValue != null ? formatIls(lead.dealValue) : "—"}</span>
                <span className="flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setRestoreLead(lead); }}
                    className="h-[30px] px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-[#FED7AA] hover:text-[#C2410C] hover:bg-[#FFF7ED] transition-colors whitespace-nowrap"
                  >
                    {t("archive.restore")}
                  </button>
                </span>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-[13px] text-slate-400">{searchQuery ? t("archive.noResults") : t("archive.empty")}</div>
          )}
        </div>
      </div>

      {restoreLead && (
        <RestoreLeadModal
          lead={restoreLead}
          activeStages={activeStages}
          onClose={() => setRestoreLead(null)}
          onRestored={() => {
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            setRestoreLead(null);
          }}
        />
      )}
    </div>
  );
}


// ─── Add Stage Inline ────────────────────────────────────────────────────────

function AddStageInline({ onAdd, triggerOpen = 0 }: { onAdd: (name: string) => void; triggerOpen?: number }) {
  const t = useTranslations("leads.leadsPage");
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // When the header "הוסף שלב" button is clicked, open the inline input
  useEffect(() => {
    if (triggerOpen > 0) {
      setIsAdding(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [triggerOpen]);

  const handleSubmit = () => {
    if (name.trim()) {
      onAdd(name.trim());
      setName("");
      setIsAdding(false);
    }
  };

  if (!isAdding) {
    return (
      <div className="min-w-[200px] flex flex-col">
        <button
          onClick={() => {
            setIsAdding(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 text-petra-muted hover:border-brand-300 hover:text-brand-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">{t("addStage.button")}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-[200px] flex flex-col">
      <div className="flex items-center gap-2 px-1 mb-3">
        <input
          ref={inputRef}
          className="text-sm font-semibold text-petra-text bg-white border border-brand-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-brand-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") { setIsAdding(false); setName(""); }
          }}
          onBlur={() => {
            if (name.trim()) handleSubmit();
            else { setIsAdding(false); setName(""); }
          }}
          placeholder={t("addStage.placeholder")}
          autoFocus
        />
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ────────────────────────────────────────────────────

function DeleteStageModal({
  stage,
  leadCount,
  onConfirm,
  onClose,
}: {
  stage: LeadStage;
  leadCount: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("leads.leadsPage");
  const tc = useTranslations("common");
  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <h3 className="text-lg font-bold text-petra-text mb-3">
          {t("deleteStage.title", { name: stage.name })}
        </h3>
        {leadCount > 0 ? (
          <>
            <p className="text-sm text-petra-muted mb-4">
              {t("deleteStage.hasLeads", { count: leadCount })}
            </p>
            <div className="flex justify-end">
              <button className="btn-secondary" onClick={onClose}>{t("deleteStage.gotIt")}</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-petra-muted mb-4">
              {t("deleteStage.confirm")}
            </p>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
              <button className="btn-danger" onClick={onConfirm}>{t("deleteStage.delete")}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Restore Lead Modal ───────────────────────────────────────────────────────

function RestoreLeadModal({
  lead,
  activeStages,
  onClose,
  onRestored,
}: {
  lead: Lead;
  activeStages: LeadStage[];
  onClose: () => void;
  onRestored: () => void;
}) {
  const t = useTranslations("leads.leadsPage");
  const tc = useTranslations("common");
  // If previousStageId is set and still exists as active stage → pre-select it
  const prevStage = lead.previousStageId
    ? activeStages.find(s => s.id === lead.previousStageId)
    : null;
  const [selectedStage, setSelectedStage] = useState(prevStage?.id || activeStages[0]?.id || "");
  const [showPicker, setShowPicker] = useState(!prevStage); // skip picker if we know previous stage
  const [saving, setSaving] = useState(false);

  const handleRestore = async (stageId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: stageId,
          lostAt: null,
          wonAt: null,
          lostReasonCode: null,
          lostReasonText: null,
          previousStageId: null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("restore.restored", { name: lead.name }));
      onRestored();
    } catch {
      toast.error(t("restore.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{t("restore.title")}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        {/* Fast path: known previous stage */}
        {!showPicker && prevStage ? (
          <>
            <p className="text-sm text-petra-muted mb-4">
              {t.rich("restore.toLastStage", { name: lead.name, b: (c) => <span className="font-semibold text-petra-text">{c}</span> })}
            </p>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-brand-300 bg-brand-50 mb-5">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: prevStage.color }} />
              <span className="text-sm font-semibold text-brand-700">{prevStage.name}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleRestore(prevStage.id)}
                disabled={saving}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                {t("restore.restoreHere")}
              </button>
              <button onClick={() => setShowPicker(true)} className="btn-secondary px-3" title={t("restore.pickOther")}>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-petra-muted mb-4">
              {t.rich("restore.whichStage", { name: lead.name, b: (c) => <span className="font-semibold text-petra-text">{c}</span> })}
            </p>
            <div className="space-y-2 mb-5">
              {activeStages.map(stage => (
                <button
                  key={stage.id}
                  onClick={() => setSelectedStage(stage.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all text-start",
                    selectedStage === stage.id
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 hover:border-slate-300 text-petra-text"
                  )}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                  {stage.name}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleRestore(selectedStage)}
                disabled={!selectedStage || saving}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                {t("restore.restore")}
              </button>
              <button onClick={onClose} className="btn-secondary flex-1">{tc("actions.cancel")}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Priority sort ────────────────────────────────────────────────────────────
// Groups: 0=overdue (red) → 1=untouched (amber) → 2=handled (grey)
// Within each group: oldest first (waiting longest = top of column)

function sortLeadsByPriority(leads: Lead[]): Lead[] {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const getPriority = (lead: Lead): 0 | 1 | 2 => {
    const followUpDate = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null;
    if (followUpDate && followUpDate < todayStart) return 0;
    const hasActivity = (lead.callLogs ?? []).some((log) => log.type !== "deal_value") || !!lead.lastContactedAt;
    const hasFutureFollowUp = !!followUpDate && followUpDate >= todayStart;
    return (hasActivity || hasFutureFollowUp || lead.followUpStatus === "completed") ? 2 : 1;
  };

  const getAgeMs = (lead: Lead): number => {
    // Sort by lead age (createdAt) within each priority group — oldest lead first
    return new Date(lead.createdAt).getTime();
  };

  return [...leads].sort((a, b) => {
    const pa = getPriority(a);
    const pb = getPriority(b);
    if (pa !== pb) return pa - pb;
    return getAgeMs(a) - getAgeMs(b); // older = smaller timestamp = sorts first
  });
}

// ─── Main Page ───────────────────────────────────────────────────────────────

function LeadsPageContent() {
  const t = useTranslations("leads.leadsPage");
  const tc = useTranslations("common");
  const { locale, cfg } = useBusinessLocale();
  const { canExportData } = usePermissions();
  const [showModal, setShowModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailsLead, setDetailsLead] = useState<Lead | null>(null);
  const [activeDragLead, setActiveDragLead] = useState<Lead | null>(null);
  const [wonToast, setWonToast] = useState<{ name: string; customerId: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SalesView>("board");
  // Reports need ANALYTICS_READ (owner/manager by default) — same gate as GET /api/leads/reports.
  const { canViewAnalytics } = usePermissions();
  // Deep link: /leads?view=reports (used by /analytics → "לדוחות המכירות המלאים")
  useEffect(() => {
    const view = new URLSearchParams(window.location.search).get("view");
    if (view === "reports" || view === "archive" || view === "list" || view === "followup") setActiveTab(view);
  }, []);
  useEffect(() => {
    if (activeTab === "reports" && !canViewAnalytics) setActiveTab("board");
  }, [activeTab, canViewAnalytics]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const { maxLeads } = useSubscription();

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [addStageTrigger, setAddStageTrigger] = useState(0);
  const kanbanScrollRef = useRef<HTMLDivElement>(null);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ stage: LeadStage; leadCount: number } | null>(null);

  // Bulk selection state (same pattern as customers page)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  // Phones: the ids the current mobile tab shows ("בחר הכל" selects only what is on screen).
  const [mobileShownIds, setMobileShownIds] = useState<string[]>([]);

  // Filters changing mid-selection would leave leads selected that are no longer
  // visible — "מחק נבחרים" would then delete leads the user can't see. Clear the
  // selection whenever the visible set's filters change.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchQuery, sourceFilter]);

  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: leads = [], isFetching: leadsLoading, isLoading: leadsInitialLoading, refetch: refetchLeads } = useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: () => fetchJSON<Lead[]>("/api/leads"),
  });


  // Auto-refresh every 30 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    }, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, queryClient]);

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExportMenu]);

  function exportLeads() {
    const p = new URLSearchParams();
    if (exportFrom) p.set("from", exportFrom);
    if (exportTo) p.set("to", exportTo);
    window.location.href = `/api/leads/export${p.toString() ? `?${p.toString()}` : ""}`;
    setShowExportMenu(false);
  }

  const { data: stages = [], isLoading: stagesLoading } = useQuery<LeadStage[]>({
    queryKey: ["lead-stages"],
    queryFn: () => fetchJSON<LeadStage[]>("/api/leads/stages"),
  });

  // Deep link: /leads?lead=<id> ("פתח את הליד" in the customer's sales history, the global
  // search, dashboard alerts) opens that lead's card once the list is loaded, then drops the
  // param. Read from useSearchParams so it also works when /leads is already open (the
  // search pushes the same route with a new query). A closed (won / lost) lead switches
  // the screen to the archive tab behind the card, where that lead lives.
  const searchParams = useSearchParams();
  const leadParam = searchParams.get("lead");
  useEffect(() => {
    if (!leadParam || leadsInitialLoading || stagesLoading) return;
    const target = leads.find((l) => l.id === leadParam);
    if (target) {
      const stage = stages.find((st) => st.id === target.stage);
      if (stage?.isWon || stage?.isLost) setActiveTab("archive");
      setSelectedLead(target);
    } else {
      toast.error(t("toasts.leadNotFound"));
    }
    router.replace("/leads", { scroll: false });
  }, [leadParam, leads, leadsInitialLoading, stages, stagesLoading, router]);
  const wonStageId = stages.find((s) => s.isWon)?.id;
  const lostStageId = stages.find((s) => s.isLost)?.id;

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (sourceFilter) {
      result = result.filter((l) => l.source === sourceFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) => {
        if (l.name.toLowerCase().includes(q)) return true;
        if (l.phone?.includes(q)) return true;
        if (l.email?.toLowerCase().includes(q)) return true;
        const meta = leadMeta(l);
        if (meta.city?.toLowerCase().includes(q)) return true;
        if (meta.service?.toLowerCase().includes(q)) return true;
        if (l.callLogs?.some((log) => log.summary?.toLowerCase().includes(q))) return true;
        return false;
      });
    }
    return result;
  }, [leads, searchQuery, sourceFilter]);

  // ─── Mutations ──────────────────────────────────────────────────────────

  const moveMutation = useMutation({
    mutationFn: async ({ id, stage, fromStageName, toStageName, isLost, previousStageId }: { id: string; stage: string; fromStageName?: string; toStageName?: string; isLost?: boolean; previousStageId?: string }) => {
      const payload: Record<string, unknown> = { stage };
      if (isLost) { payload.lostAt = new Date().toISOString(); }
      if (previousStageId) payload.previousStageId = previousStageId;
      await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); });
      if (fromStageName && toStageName) {
        await fetch(`/api/leads/${id}/logs`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "stage_change", summary: `הועבר מ"${fromStageName}" ל"${toStageName}"`, treatment: "" }), // i18n-ok — parsed by parseStageChangeSummary() (sales-report.ts)
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
    onError: () => toast.error(t("toasts.moveError")),
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; color?: string }) =>
      fetch(`/api/leads/stages/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lead-stages"] }),
    onError: () => toast.error(t("toasts.stageUpdateError")),
  });

  const createStageMutation = useMutation({
    mutationFn: (data: { name: string; color?: string }) =>
      fetch("/api/leads/stages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-stages"] });
      toast.success(t("toasts.stageCreated"));
    },
    onError: () => toast.error(t("toasts.stageCreateError")),
  });

  const deleteStageMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/leads/stages/${id}`, { method: "DELETE" }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-stages"] });
      toast.success(t("toasts.stageDeleted"));
    },
    onError: () => toast.error(t("toasts.stageDeleteError")),
  });

  const reorderMutation = useMutation({
    mutationFn: (stageIds: string[]) =>
      fetch("/api/leads/stages/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stageIds }) }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lead-stages"] }),
    onError: () => toast.error(t("toasts.reorderError")),
  });

  // ─── Bulk Delete mutation ──────────────────────────────────────────────
  // Loops the existing per-lead DELETE endpoint — exact same fetch shape as
  // the single-lead delete in LeadTreatmentModal (x-confirm-action header per
  // RBAC delete flow). Bounded concurrency to avoid exhausting the DB pool.
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await mapWithConcurrency(ids, 3, async (id) => {
        try {
          const r = await fetch(`/api/leads/${id}`, {
            method: "DELETE",
            headers: { "x-confirm-action": `DELETE_LEAD_${id}` },
          });
          // 404 = lead already gone — the end state is what the user wanted.
          if (r.status === 404) return "deleted" as const;
          // 202 = manager flow — deletion request sent to owner for approval.
          if (r.status === 202) return "pending" as const;
          if (!r.ok) return "failed" as const;
          return "deleted" as const;
        } catch {
          return "failed" as const;
        }
      });
      return {
        deleted: results.filter((s) => s === "deleted").length,
        pending: results.filter((s) => s === "pending").length,
        failed: results.filter((s) => s === "failed").length,
      };
    },
    onSuccess: ({ deleted, pending, failed }) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-counters"] });
      setShowBulkDeleteConfirm(false);
      setSelectedIds(new Set());
      setSelectionMode(false);
      if (deleted > 0) toast.success(t("toasts.bulkDeleted", { count: deleted }));
      if (pending > 0) toast.success(t("toasts.bulkPending", { count: pending }));
      if (failed > 0) toast.error(t("toasts.bulkFailed", { count: failed }));
    },
    onError: () => toast.error(t("toasts.bulkError")),
  });

  // ─── Follow-up reschedule (follow-up view drag) ────────────────────────
  const followUpMoveMutation = useMutation({
    mutationFn: ({ id, at }: { id: string; at: string; name: string }) =>
      fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextFollowUpAt: at }),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: (_, { at, name }) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-counters"] });
      toast.success(t("toasts.followUpMoved", { name, label: getFollowUpInfo(at, { t, locale }).label }));
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.error(t("toasts.followUpMoveError"));
    },
  });

  // Won/lost zones sit on top of the board while dragging — they win over a column underneath.
  const leadCollision: CollisionDetection = useCallback((args) => {
    const hits = pointerWithin(args);
    const zoneHit = hits.find((h) => h.id === wonStageId || h.id === lostStageId);
    if (zoneHit) return [zoneHit];
    if (hits.length > 0) return hits;
    // Columns are only as tall as their own cards, so a card dragged sideways from far
    // down a long column is released below the shorter target column and pointerWithin
    // finds nothing. Fall back to the column the pointer is under (x within, y below top).
    const pointer = args.pointerCoordinates;
    if (!pointer) return [];
    const column = args.droppableContainers.find((c) => {
      if (c.id === wonStageId || c.id === lostStageId) return false;
      const rect = args.droppableRects.get(c.id);
      return !!rect && pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top;
    });
    return column ? [{ id: column.id }] : [];
  }, [wonStageId, lostStageId]);

  // ─── Lead DnD Sensors ──────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

  // ─── Lead DnD Handlers ─────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const lead = active.data.current?.lead;
    if (lead) setActiveDragLead(lead);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragLead(null);
    const { active, over } = event;

    // Follow-up view: dropping on a time column reschedules the next follow-up
    if (over && typeof over.id === "string" && over.id.startsWith(FU_DROP_PREFIX)) {
      const column = FOLLOW_UP_COLUMNS.find((c) => FU_DROP_PREFIX + c.id === over.id);
      const lead = leads.find((l) => l.id === active.id);
      if (!column?.target || !lead) return;
      if (column.buckets.includes(getFollowUpInfo(lead.nextFollowUpAt).bucket)) return;
      const at = column.target();
      queryClient.setQueryData(["leads"], (old: Lead[]) =>
        old.map(l => l.id === lead.id ? { ...l, nextFollowUpAt: at } : l)
      );
      followUpMoveMutation.mutate({ id: lead.id, at, name: lead.name });
      return;
    }

    if (over && active.id !== over.id) {
      const activeLeadId = active.id as string;
      const targetStageId = over.id as string;
      const lead = leads.find((l) => l.id === activeLeadId);
      const targetStage = stages.find((s) => s.id === targetStageId);

      if (lead && lead.stage !== targetStageId) {
        const fromStage = stages.find((s) => s.id === lead.stage);
        queryClient.setQueryData(["leads"], (old: Lead[]) =>
          old.map(l => l.id === activeLeadId ? { ...l, stage: targetStageId } : l)
        );

        if (targetStage?.isWon) {
          // Open treatment modal — it will call close-won and create the customer
          setSelectedLead({ ...lead, stage: targetStageId });
        } else {
          moveMutation.mutate({
            id: activeLeadId, stage: targetStageId,
            fromStageName: fromStage?.name, toStageName: targetStage?.name,
            isLost: !!targetStage?.isLost,
            previousStageId: (targetStage?.isLost || targetStage?.isWon) ? lead.stage : undefined,
          });
          if (targetStage?.isLost) {
            setSelectedLead({ ...lead, stage: targetStageId });
          }
        }
      }
    }
  };

  // ─── Column Reorder DnD Handler (edit mode) ────────────────────────────

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(stages, oldIndex, newIndex);

    // Optimistic update
    queryClient.setQueryData(["lead-stages"], newOrder.map((s, i) => ({ ...s, sortOrder: i })));

    reorderMutation.mutate(newOrder.map((s) => s.id));
  };

  // ─── Edit Mode Handlers ────────────────────────────────────────────────

  const handleStartEdit = (id: string, name: string) => {
    setEditingStageId(id);
    setEditingName(name);
  };

  const handleSaveName = (id: string) => {
    if (editingName.trim() && editingName.trim() !== stages.find((s) => s.id === id)?.name) {
      updateStageMutation.mutate({ id, name: editingName.trim() });
    }
    setEditingStageId(null);
    setEditingName("");
  };

  const handleChangeColor = (id: string, color: string) => {
    updateStageMutation.mutate({ id, color });
  };

  const handleDelete = (stage: LeadStage) => {
    const count = leads.filter((l) => l.stage === stage.id).length;
    setDeleteTarget({ stage, leadCount: count });
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      deleteStageMutation.mutate(deleteTarget.stage.id);
      setDeleteTarget(null);
    }
  };

  const handleAddStage = (name: string) => {
    createStageMutation.mutate({ name });
  };


  // ─── Render ─────────────────────────────────────────────────────────────

  const wonStage = stages.find((s) => s.isWon);
  const lostStage = stages.find((s) => s.isLost);
  const activeStages = stages.filter((s) => !s.isWon && !s.isLost);

  // ─── Selection helpers ──────────────────────────────────────────────────
  // "Visible" = the leads currently rendered on the kanban board (active-stage
  // columns), respecting the active search/source filters.
  const visibleKanbanLeads = useMemo(() => {
    const activeStageIds = new Set(activeStages.map((s) => s.id));
    return filteredLeads.filter((l) => activeStageIds.has(l.stage));
  }, [filteredLeads, activeStages]);

  const allSelected = visibleKanbanLeads.length > 0 && visibleKanbanLeads.every((l) => selectedIds.has(l.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(allSelected ? new Set() : new Set(visibleKanbanLeads.map((l) => l.id)));
  }, [allSelected, visibleKanbanLeads]);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
  }, []);

  // Bulk selection / stage editing belong to the board view only
  useEffect(() => {
    if (activeTab !== "board") {
      exitSelectionMode();
      setEditMode(false);
      setEditingStageId(null);
      setEditingName("");
    }
  }, [activeTab, exitSelectionMode]);

  const stagesById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  // Header summary — all open leads (active stages), regardless of search/source filters
  const openLeads = useMemo(() => {
    const activeStageIds = new Set(activeStages.map((s) => s.id));
    return leads.filter((l) => activeStageIds.has(l.stage));
  }, [leads, activeStages]);
  const pipelineValue = sumDealValues(openLeads);
  const overdueCount = openLeads.filter((l) => getFollowUpInfo(l.nextFollowUpAt).bucket === "overdue").length;
  const todayCount = openLeads.filter((l) => getFollowUpInfo(l.nextFollowUpAt).bucket === "today").length;
  const archiveCount = (wonStage ? leads.filter(l => l.stage === wonStage.id).length : 0)
    + (lostStage ? leads.filter(l => l.stage === lostStage.id).length : 0);

  const sortedVisibleLeads = useMemo(() => [...visibleKanbanLeads].sort(byFollowUp), [visibleKanbanLeads]);

  const archiveHits = useMemo(() => {
    if (activeTab === "archive" || !searchQuery.trim()) return 0;
    const q = searchQuery.toLowerCase();
    return leads.filter(l =>
      (l.stage === wonStage?.id || l.stage === lostStage?.id) &&
      (l.name.toLowerCase().includes(q) || (l.phone || "").includes(q) || (l.email || "").toLowerCase().includes(q))
    ).length;
  }, [activeTab, searchQuery, leads, wonStage, lostStage]);

  const atLeadLimit = maxLeads !== null && leads.length >= maxLeads;

  const views: { id: SalesView; label: string }[] = [
    { id: "board", label: t("views.board") },
    { id: "followup", label: t("views.followup", { count: overdueCount + todayCount }) },
    { id: "list", label: t("views.list") },
    { id: "archive", label: t("views.archive", { count: archiveCount }) },
    ...(canViewAnalytics ? [{ id: "reports" as const, label: t("views.reports") }] : []),
  ];

  const openLead = (lead: Lead) => setSelectedLead(lead);
  const openDetails = (lead: Lead) => setDetailsLead(lead);

  return (
    <div>
      {leadsInitialLoading && <PetraLoader />}

      {/* ── Header ── */}
      <div className="flex items-end justify-between gap-x-4 gap-y-3 flex-wrap">
        <div className="min-w-0 flex-1 md:flex-none">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl md:text-2xl font-bold tracking-[-0.02em] text-petra-text">{t("header.title")}</h1>
            {/* Mobile: "בחר" (bulk select / delete) + compact new-lead button next to the title */}
            {activeTab === "board" && !editMode && (
              <button
                type="button"
                onClick={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}
                aria-pressed={selectionMode}
                className={cn(
                  "md:hidden h-11 px-3.5 rounded-xl border text-[13px] font-semibold flex items-center gap-1.5 flex-shrink-0 ms-auto",
                  selectionMode ? "bg-[#FFF7ED] border-[#FB923C] text-[#C2410C]" : "bg-white border-slate-200 text-slate-600 active:bg-slate-50",
                )}
              >
                <CheckSquare className="w-4 h-4" />
                {selectionMode ? t("header.cancel") : t("header.select")}
              </button>
            )}
            {atLeadLimit ? (
              <a href="/upgrade" aria-label={t("header.upgrade")} className="md:hidden w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5" />
              </a>
            ) : (
              <button type="button" aria-label={t("header.newLead")} onClick={() => setShowModal(true)} className="md:hidden w-11 h-11 rounded-xl bg-[#F97316] active:bg-[#EA580C] text-white flex items-center justify-center flex-shrink-0">
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="mt-1.5 text-[13px] md:text-sm text-slate-500 flex gap-x-3.5 gap-y-1 flex-wrap tabular-nums">
            <span>{openLeads.length === 1 ? t("header.oneOpenLead") : t("header.openLeads", { count: openLeads.length })}</span>
            {pipelineValue > 0 && <span>{t("header.pipeline", { amount: formatIls(pipelineValue) })}</span>}
            <span className="text-[#B91C1C] font-medium">{t("header.overdue", { count: overdueCount })}</span>
            <span className="text-[#C2410C] font-medium">{t("header.today", { count: todayCount })}</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 w-full md:w-auto min-w-0">
          <div className="flex bg-slate-100 rounded-[10px] p-[3px] gap-0.5 overflow-x-auto scrollbar-hide min-w-0 flex-1 md:flex-none">
            {views.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setActiveTab(v.id)}
                className={cn(
                  "h-8 px-3.5 rounded-lg text-[13px] whitespace-nowrap transition-colors tabular-nums flex-shrink-0",
                  activeTab === v.id
                    ? "bg-white text-petra-text font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                    : "text-slate-500 font-medium hover:text-petra-text",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
          {atLeadLimit ? (
            <a href="/upgrade" className="hidden md:flex h-[38px] px-4 rounded-[10px] bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold items-center gap-1.5 flex-shrink-0 transition-colors">
              <Sparkles className="w-4 h-4" />{t("header.upgrade")}
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="hidden md:flex h-[38px] px-4 rounded-[10px] bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold items-center gap-1.5 flex-shrink-0 transition-colors"
            >
              <Plus className="w-4 h-4" />{t("header.newLead")}
              {maxLeads !== null && <span className="opacity-75 text-xs tabular-nums">({leads.length}/{maxLeads})</span>}
            </button>
          )}
        </div>
      </div>

      {/* ── Filters & tools ── */}
      {activeTab !== "reports" && (
        <div className="flex items-center gap-2.5 mt-4 md:mt-5 flex-wrap">
          <div className="relative w-full sm:w-[260px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === "archive" ? t("toolbar.searchArchive") : t("toolbar.searchPlaceholder")}
              className="w-full h-9 border border-slate-200 rounded-[10px] ps-[34px] pe-8 text-[13px] bg-white outline-none transition-shadow focus:border-[#FB923C] focus:ring-[3px] focus:ring-orange-500/15"
            />
            <Search className="absolute start-[11px] top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
            {searchQuery && (
              <button type="button" aria-label={t("toolbar.clearSearch")} onClick={() => setSearchQuery("")} className="absolute end-2.5 top-2.5 text-slate-400 hover:text-slate-700">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {archiveHits > 0 && (
            <button type="button" onClick={() => setActiveTab("archive")} className="text-[13px] font-medium text-[#EA580C] hover:text-[#C2410C] flex items-center gap-1">
              <Archive className="w-3.5 h-3.5" />{t("toolbar.archiveHits", { count: archiveHits })}
            </button>
          )}

          {activeTab !== "archive" && !editMode && (
            <select
              value={sourceFilter ?? ""}
              onChange={(e) => setSourceFilter(e.target.value || null)}
              aria-label={t("toolbar.sourceFilter")}
              className={cn(TOOL_BTN, "hidden md:flex pe-2 ps-3 cursor-pointer", sourceFilter && TOOL_BTN_ON)}
            >
              <option value="">{t("toolbar.allSources")}</option>
              {LEAD_SOURCES.map((src) => {
                const count = leads.filter((l) => l.source === src.id).length;
                if (count === 0 && sourceFilter !== src.id) return null;
                return <option key={src.id} value={src.id}>{src.label} ({count})</option>;
              })}
            </select>
          )}

          <div className="hidden md:flex items-center gap-1.5 ms-auto flex-wrap">
            {activeTab === "board" && (
              <>
                <button
                  type="button"
                  className={cn(TOOL_BTN, "hidden md:flex", selectionMode && TOOL_BTN_ON)}
                  onClick={() => {
                    if (selectionMode) {
                      exitSelectionMode();
                    } else {
                      setSelectionMode(true);
                      setEditMode(false);
                      setEditingStageId(null);
                      setEditingName("");
                    }
                  }}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  {selectionMode ? t("toolbar.cancelSelection") : t("toolbar.select")}
                </button>
                <button
                  type="button"
                  className={cn(TOOL_BTN, editMode && TOOL_BTN_ON)}
                  onClick={() => {
                    setEditMode(!editMode);
                    setEditingStageId(null);
                    setEditingName("");
                    if (!editMode) exitSelectionMode();
                  }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {editMode ? t("toolbar.doneEditing") : t("toolbar.editStages")}
                </button>
                {editMode && (
                  <button
                    type="button"
                    className={TOOL_BTN}
                    onClick={() => {
                      setAddStageTrigger((n) => n + 1);
                      // The add-stage column sits at the inline end: far left in RTL, far right in LTR.
                      setTimeout(() => { kanbanScrollRef.current?.scrollTo({ left: (cfg.dir === "rtl" ? -1 : 1) * kanbanScrollRef.current.scrollWidth, behavior: "smooth" }); }, 50);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t("addStage.button")}
                  </button>
                )}
              </>
            )}

            {/* Export */}
            {canExportData && (
            <div className="relative" ref={exportMenuRef}>
              <button type="button" className={TOOL_BTN} onClick={() => setShowExportMenu((v) => !v)} title={t("toolbar.exportLeads")}>
                <Download className="w-3.5 h-3.5" />{t("toolbar.export")}
              </button>
              {showExportMenu && (
                <div className={cn("absolute end-0 top-full mt-1.5 w-64 bg-white rounded-xl border border-slate-200 z-50 p-4 space-y-3", POPOVER_SHADOW)}>
                  <p className="text-xs font-semibold text-petra-text">{t("toolbar.exportTitle")}</p>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-petra-muted mb-1 block">{t("toolbar.exportFrom")}</label>
                      <input type="date" lang={cfg.lang} className="input text-sm py-1.5" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-petra-muted mb-1 block">{t("toolbar.exportTo")}</label>
                      <input type="date" lang={cfg.lang} className="input text-sm py-1.5" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
                    </div>
                  </div>
                  <p className="text-[11px] text-petra-muted">{t("toolbar.exportHint")}</p>
                  <button type="button" className="w-full h-9 rounded-[10px] bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors" onClick={exportLeads}>
                    <Download className="w-3.5 h-3.5" />{t("toolbar.downloadCsv")}
                  </button>
                </div>
              )}
            </div>
            )}

            {/* Refresh controls */}
            <button
              type="button"
              onClick={() => refetchLeads()}
              disabled={leadsLoading}
              title={t("toolbar.refreshNow")}
              aria-label={t("toolbar.refreshNow")}
              className={cn(TOOL_BTN, "w-9 px-0 justify-center")}
            >
              <RefreshCw className={cn("w-4 h-4", leadsLoading && "animate-spin")} />
            </button>
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              title={autoRefresh ? t("toolbar.autoRefreshOff") : t("toolbar.autoRefreshOn")}
              className={cn(TOOL_BTN, autoRefresh && "!bg-emerald-50 !border-emerald-300 !text-emerald-700")}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
              {autoRefresh ? t("toolbar.autoActive") : t("toolbar.autoRefresh")}
            </button>
          </div>
        </div>
      )}

      {/* Limit banner — shown when free tier reaches its lead cap */}
      {atLeadLimit && activeTab !== "reports" && activeTab !== "archive" && (
        <div className="flex items-center justify-between gap-3 mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              {t.rich("limit.reached", { max: maxLeads ?? 0, b: (c) => <span className="font-semibold">{c}</span> })}
            </p>
          </div>
          <a href="/upgrade" className="flex-shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 transition-colors">
            {t("limit.upgrade")}
          </a>
        </div>
      )}

      <div className="mt-5">
        {/* Reports */}
        {activeTab === "reports" && canViewAnalytics && <LeadsReports />}

        {/* Archive */}
        {activeTab === "archive" && (
          <ArchiveTab
            leads={leads}
            wonStage={wonStage}
            lostStage={lostStage}
            activeStages={activeStages}
            searchQuery={searchQuery}
            onLeadClick={openLead}
          />
        )}

        {/* List */}
        {activeTab === "list" && (
          <LeadsListView leads={sortedVisibleLeads} stagesById={stagesById} onLeadClick={openLead} onDetails={openDetails} />
        )}

        {/* ─── Bulk Selection Bar ─── */}
        {activeTab === "board" && selectionMode && !editMode && (
          <div className="p-3 mb-4 hidden md:flex flex-wrap items-center gap-3 rounded-xl bg-[#FFF7ED] border border-[#FED7AA]">
            <button onClick={toggleSelectAll} className="flex items-center gap-2 text-slate-500 hover:text-petra-text transition-colors">
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-brand-500" />
              ) : someSelected ? (
                <MinusSquare className="w-4 h-4 text-brand-400" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span className="text-xs font-medium">{t("bulk.selectAll")}</span>
            </button>
            <div className="w-px h-5 bg-[#FED7AA]" />
            <span className="text-sm font-semibold text-petra-text">{t("bulk.selectedCount", { count: selectedIds.size })}</span>
            {selectedIds.size > 0 && (
              <button
                className="ms-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                onClick={() => setShowBulkDeleteConfirm(true)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t("bulk.deleteSelected")}
              </button>
            )}
          </div>
        )}

        {/* ─── Phones: bulk actions bar, fixed above the bottom navigation ─── */}
        {activeTab === "board" && selectionMode && !editMode && (
          <div
            className="md:hidden fixed inset-x-3 z-40 rounded-2xl bg-white border border-[#FED7AA] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.25)] p-2.5 flex items-center gap-2"
            style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
          >
            {(() => {
              const allShownSelected = mobileShownIds.length > 0 && mobileShownIds.every((id) => selectedIds.has(id));
              return (
                <button
                  type="button"
                  onClick={() => setSelectedIds(allShownSelected ? new Set() : new Set(mobileShownIds))}
                  className="h-11 px-3 rounded-xl text-[13px] font-medium text-slate-600 bg-slate-100 active:bg-slate-200 flex items-center gap-1.5 flex-shrink-0"
                >
                  {allShownSelected ? <CheckSquare className="w-4 h-4 text-brand-500" /> : <Square className="w-4 h-4" />}
                  {t("bulk.selectAll")}
                </button>
              );
            })()}
            <span className="flex-1 min-w-0 text-center text-sm font-semibold text-petra-text tabular-nums">{t("bulk.selectedCount", { count: selectedIds.size })}</span>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="h-11 px-3.5 rounded-xl text-[13px] font-semibold bg-red-600 text-white active:bg-red-700 disabled:opacity-40 flex items-center gap-1.5 flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              {tc("actions.delete")}
            </button>
            <button
              type="button"
              onClick={exitSelectionMode}
              className="h-11 px-3 rounded-xl text-[13px] font-medium text-slate-600 active:bg-slate-100 flex-shrink-0"
            >
              {tc("actions.cancel")}
            </button>
          </div>
        )}

        {/* ─── Board: stage editing mode (column reorder) ─── */}
        {activeTab === "board" && editMode && (
          <>
            <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Pencil className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-sm text-amber-800">
                {t.rich("editBanner", {
                  b: (c) => <span className="font-semibold">{c}</span>,
                  grip: () => <GripVertical className="w-3.5 h-3.5 inline-block align-middle" />,
                  trash: () => <Trash2 className="w-3.5 h-3.5 inline-block align-middle text-red-500" />,
                })}
              </p>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleColumnDragEnd}>
              <SortableContext items={activeStages.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
                <div ref={kanbanScrollRef} className="flex gap-3.5 overflow-x-auto pb-6 items-start">
                  {activeStages.map((stage) => (
                    <SortableStageColumn
                      key={stage.id}
                      stage={stage}
                      leads={sortLeadsByPriority(filteredLeads.filter((l) => l.stage === stage.id))}
                      editMode={editMode}
                      editingStageId={editingStageId}
                      editingName={editingName}
                      onStartEdit={handleStartEdit}
                      onChangeName={setEditingName}
                      onSaveName={handleSaveName}
                      onChangeColor={handleChangeColor}
                      onDelete={handleDelete}
                      onLeadClick={openLead}
                      onDetails={openDetails}
                    />
                  ))}
                  <AddStageInline onAdd={handleAddStage} triggerOpen={addStageTrigger} />
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}

        {/* ─── Board / follow-up views: lead drag & drop ─── */}
        {((activeTab === "board" && !editMode) || activeTab === "followup") && (
          <DndContext
            sensors={sensors}
            collisionDetection={leadCollision}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveDragLead(null)}
          >
            {activeTab === "board" ? (
              <>
                <div className="hidden md:block">
                  <div ref={kanbanScrollRef} className="flex gap-3.5 overflow-x-auto pb-28 items-start">
                    {activeStages.map((stage) => (
                      <div key={stage.id} className="min-w-[252px] flex-1 flex-shrink-0">
                        <StageColumn
                          stage={stage}
                          leads={sortLeadsByPriority(filteredLeads.filter((l) => l.stage === stage.id))}
                          editMode={false}
                          editingStageId={null}
                          editingName=""
                          onStartEdit={() => { }}
                          onChangeName={() => { }}
                          onSaveName={() => { }}
                          onChangeColor={handleChangeColor}
                          onDelete={() => { }}
                          onLeadClick={openLead}
                          onDetails={openDetails}
                          selectionMode={selectionMode}
                          selectedIds={selectedIds}
                          onToggleSelect={toggleSelect}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="md:hidden">
                  <MobileBoard
                    leads={visibleKanbanLeads}
                    activeStages={activeStages}
                    onLeadClick={openLead}
                    selectionMode={selectionMode && !editMode}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    onShownChange={setMobileShownIds}
                    // Another tab = other leads: drop the selection so nothing hidden gets deleted.
                    onTabChange={() => setSelectedIds(new Set())}
                  />
                </div>
              </>
            ) : (
              <div className="flex gap-3.5 overflow-x-auto pb-28 items-start">
                {FOLLOW_UP_COLUMNS.map((column) => (
                  <FollowUpColumn
                    key={column.id}
                    column={column}
                    leads={sortedVisibleLeads.filter((l) => column.buckets.includes(getFollowUpInfo(l.nextFollowUpAt).bucket))}
                    stagesById={stagesById}
                    onLeadClick={openLead}
                    onDetails={openDetails}
                  />
                ))}
              </div>
            )}

            <ArchiveDropZones leads={leads} wonStage={wonStage} lostStage={lostStage} active={!!activeDragLead} />

            <DragOverlay>
              {activeDragLead ? (
                <div className="bg-white border border-slate-300 rounded-xl px-3.5 py-3 w-[252px] rotate-2 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)] cursor-grabbing">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-petra-text flex-1 truncate">{activeDragLead.name}</span>
                    {activeDragLead.dealValue != null && (
                      <span className="text-xs text-slate-500 tabular-nums">{formatIls(activeDragLead.dealValue)}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{sourceLabelOf(activeDragLead.source)}</div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Won Toast */}
      {wonToast && (
        <div /* rtl-ok — centered, direction-neutral */ className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 bg-white border border-slate-200 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)] rounded-xl px-4 py-3 animate-in slide-in-from-bottom-4">
          <div className="w-9 h-9 rounded-full bg-[#ECFDF5] flex items-center justify-center flex-shrink-0">
            <UserCheck className="w-[18px] h-[18px] text-[#059669]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-petra-text">{t("wonToast.becameClient", { name: wonToast.name })}</p>
            <p className="text-xs text-petra-muted">{t("wonToast.converted")}</p>
          </div>
          <button
            onClick={() => router.push(`/customers/${wonToast.customerId}`)}
            className="ms-2 h-8 px-3 text-xs font-semibold rounded-lg bg-[#059669] text-white hover:bg-[#047857] transition-colors whitespace-nowrap"
          >
            {t("wonToast.viewClient")}
          </button>
          <button onClick={() => setWonToast(null)} aria-label={tc("actions.close")} className="text-petra-muted hover:text-petra-text">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <NewLeadModal isOpen={showModal} onClose={() => setShowModal(false)} stages={stages} />

      <LeadTreatmentModal
        lead={selectedLead}
        isOpen={!!selectedLead}
        onClose={() => {
          setSelectedLead(null);
          // A won/lost drag updates the cache optimistically — resync if the drawer closed without saving
          queryClient.invalidateQueries({ queryKey: ["leads"] });
        }}
        stages={stages}
        onWon={(name, customerId) => {
          setSelectedLead(null);
          setWonToast({ name, customerId });
          setTimeout(() => setWonToast(null), 6000);
        }}
      />

      {detailsLead && (
        <LeadDetailsModal
          lead={detailsLead}
          isOpen={true}
          onClose={() => setDetailsLead(null)}
        />
      )}

      {deleteTarget && (
        <DeleteStageModal
          stage={deleteTarget.stage}
          leadCount={deleteTarget.leadCount}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {/* Bulk delete confirmation — same modal style as DeleteStageModal */}
      {showBulkDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => { if (!bulkDeleteMutation.isPending) setShowBulkDeleteConfirm(false); }} />
          <div className="modal-content max-w-sm mx-4 p-6">
            <h3 className="text-lg font-bold text-petra-text mb-3">
              {t("bulk.confirmTitle", { count: selectedIds.size })}
            </h3>
            <p className="text-sm text-petra-muted mb-4">
              {t("bulk.confirmBody")}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                className="btn-secondary"
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={bulkDeleteMutation.isPending}
              >
                {tc("actions.cancel")}
              </button>
              <button
                className="btn-danger flex items-center gap-1.5"
                disabled={bulkDeleteMutation.isPending || selectedIds.size === 0}
                onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {bulkDeleteMutation.isPending ? tc("progress.deleting") : t("bulk.confirmDelete", { count: selectedIds.size })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeadsPage() {
  const t = useTranslations("leads.leadsPage");
  return (
    <>
      <PageTitle title={t("header.title")} />
      <TierGate
      feature="leads"
      title={t("tierGate.title")}
      description={t("tierGate.description")}
    >
      <LeadsPageContent />
    </TierGate>
    </>
  );
}
