"use client";
import { PageTitle } from "@/components/ui/PageTitle";

import { TierGate } from "@/components/paywall/TierGate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef, useCallback, memo } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Hotel,
  Plus,
  X,
  RefreshCw,
  PawPrint,
  Calendar,
  CheckCircle2,
  Clock,
  DoorOpen,
  LogIn,
  LogOut,
  Pencil,
  Trash2,
  Check,
  Settings2,
  Search,
  AlertTriangle,
  AlertCircle,
  LayoutGrid,
  GanttChart,
  Sparkles,
  Users,
  ShieldAlert,
  MessageCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Share2,
  UtensilsCrossed,
  Pill,
  Syringe,
  ClipboardList,
  Printer,
  GripVertical,
} from "lucide-react";
import { cn, fetchJSON, toWhatsAppPhone } from "@/lib/utils";
import { BoardingTabs } from "@/components/boarding/BoardingTabs";
import { toast } from "sonner";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { CustomerPicker, type PickerCustomer } from "@/components/customers/CustomerPicker";
import { usePermissions } from "@/hooks/usePermissions";
import { staysOverlap, israelDayKey } from "@/lib/boarding-overlap";
import { normalizeHebrewPunct } from "@/lib/text-variants";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { currencySymbol } from "@/lib/format";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RoomStay {
  id: string;
  checkIn: string;
  checkOut: string | null;
  status: string;
  pet: { id: string; name: string; breed: string | null; species: string };
  customer: { id: string; name: string; phone: string } | null;
}

interface Room {
  id: string;
  name: string;
  capacity: number;
  type: string;
  status: string;
  isActive: boolean;
  pricePerNight: number | null;
  _count: { boardingStays: number };
  boardingStays: RoomStay[];
}

interface BoardingStay {
  id: string;
  checkIn: string;
  checkOut: string | null;
  status: string;
  notes: string | null;
  dailyTrainingMinutes: number | null;
  room: { id: string; name: string } | null;
  yard: { id: string; name: string } | null;
  pet: {
    id: string; name: string; species: string; breed: string | null;
    foodNotes: string | null;
    medicalNotes: string | null;
    health?: { allergies: string | null; medicalConditions: string | null; activityLimitations: string | null } | null;
    behavior?: { dogAggression: boolean; humanAggression: boolean; biteHistory: boolean; biteDetails: string | null; separationAnxiety: boolean; leashReactivity: boolean; resourceGuarding: boolean } | null;
    medications?: { medName: string; dosage: string | null; frequency: string | null; times: string | null }[];
    serviceDogProfile?: { id: string } | null;
  };
  customer: { id: string; name: string; phone: string } | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  pets: { id: string; name: string; species: string }[];
}

interface BusinessSettings {
  boardingCheckInTime: string | null;
  boardingCheckOutTime: string | null;
  boardingCalcMode: string | null;
  boardingMinNights: number | null;
  boardingPricePerNight: number | null;
}

interface TeamMember { id: string; name: string }

// ─── Constants ───────────────────────────────────────────────────────────────

// Labels: boarding.boardingPage.stayStatus.<key> (rendered with t)
const STATUS_MAP: Record<string, { color: string; bg: string }> = {
  reserved:    { color: "#8B5CF6", bg: "#F5F3FF" },
  checked_in:  { color: "#10B981", bg: "#ECFDF5" },
  checked_out: { color: "#64748B", bg: "#F1F5F9" },
  canceled:    { color: "#EF4444", bg: "#FEF2F2" },
};

// Labels: boarding.boardingPage.roomStatus.<key>
const ROOM_STATUS_MAP: Record<string, { color: string; bg: string; border: string }> = {
  available:       { color: "#22C55E", bg: "#F0FDF4", border: "#BBF7D0" },
  occupied:        { color: "#F97316", bg: "#FFF7ED", border: "#FDBA74" },
  needs_cleaning:  { color: "#EAB308", bg: "#FEFCE8", border: "#FDE047" },
};

type BoardingT = ReturnType<typeof useTranslations<"boarding.boardingPage">>;

/** Room type label (boarding.boardingPage.roomTypes.<type>); unknown types render as-is. */
function roomTypeLabel(t: BoardingT, type: string): string {
  return t.has(`roomTypes.${type}`) ? t(`roomTypes.${type}`) : type;
}


const ACTIVE_STATUSES = ["reserved", "checked_in"];
type TabKey = "active" | "checkin_today" | "checkout_today" | "history";
type ViewMode = "grid" | "timeline" | "calendar";

// Short weekday labels: boarding.boardingPage.weekdaysShort.<key> (index = Date.getDay())
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const TIMELINE_DAYS = 14;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateStr(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

function formatDate(d: string, locale: string) {
  return new Date(d).toLocaleDateString(locale, { day: "numeric", month: "numeric" });
}

function formatDateFull(d: string, locale: string) {
  return new Date(d).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

function calcNights(checkIn: string, checkOut: string): number {
  const d1 = new Date(checkIn);
  const d2 = new Date(checkOut);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  // Use UTC date-only to avoid fractional-day rounding from time differences
  const start = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const end = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}

function calcStayProgress(checkIn: string, checkOut: string | null): number {
  if (!checkOut) return 0;
  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  const now = Date.now();
  const total = end - start;
  if (total <= 0) return 100;
  return Math.max(0, Math.round(((now - start) / total) * 100));
}

function isOverdue(stay: BoardingStay, checkOutTime: string): boolean {
  if (stay.status !== "checked_in" || !stay.checkOut) return false;
  const checkOutDate = new Date(stay.checkOut);
  const [hours, mins] = checkOutTime.split(":").map(Number);
  checkOutDate.setHours(hours, mins, 0, 0);
  return Date.now() > checkOutDate.getTime();
}


function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

/** Normalised search text: geresh/gershayim variants unified, lowercase. */
function normSearch(s: string): string {
  return normalizeHebrewPunct(s).toLowerCase();
}

/** Does the stay match a (normalised) search query — dog, customer or room name. */
function stayMatchesSearch(
  s: { pet: { name: string }; customer: { name: string } | null; room?: { name: string } | null },
  nq: string,
): boolean {
  if (!nq) return true;
  return (
    normSearch(s.pet.name).includes(nq) ||
    normSearch(s.customer?.name ?? "").includes(nq) ||
    normSearch(s.room?.name ?? "").includes(nq)
  );
}

function getRoomDisplayStatus(room: Room): string {
  const checkedIn = room.boardingStays.filter((s) => s.status === "checked_in");
  if (checkedIn.length > 0) return "occupied";
  if (room.status === "needs_cleaning") return "needs_cleaning";
  return "available";
}

// ─── Stay Progress Bar ──────────────────────────────────────────────────────

function StayProgress({ checkIn, checkOut, status }: { checkIn: string; checkOut: string | null; status: string }) {
  const t = useTranslations("boarding.boardingPage");
  const { locale } = useBusinessLocale();
  if (!checkOut) return null;
  const progress = calcStayProgress(checkIn, checkOut);
  const clamped = Math.min(progress, 100);
  const isOverdue = progress > 100 && status === "checked_in";
  const color = isOverdue ? "bg-red-500" : progress >= 75 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="w-full mt-1.5">
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(clamped, 100)}%` }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-petra-muted">{formatDate(checkIn, locale)}</span>
        <span className={cn("text-[9px]", isOverdue ? "text-red-500 font-semibold" : "text-petra-muted")}>
          {isOverdue ? t("progress.overdue", { pct: progress - 100 }) : `${Math.min(progress, 100)}%`}
        </span>
        <span className="text-[9px] text-petra-muted">{formatDate(checkOut, locale)}</span>
      </div>
    </div>
  );
}

// ─── Room Status Card (Grid View) ───────────────────────────────────────────

const RoomStatusCard = memo(function RoomStatusCard({
  room,
  onCheckin,
  onCheckout,
  onMarkClean,
  onOpenStay,
  occPeriodStays,
  sortedStayIds,
  highlight = false,
}: {
  room: Room;
  onCheckin: (id: string) => void;
  onCheckout: (id: string) => void;
  onMarkClean: (roomId: string) => void;
  onOpenStay: (stay: BoardingStay) => void;
  occPeriodStays: BoardingStay[]; // always provided (date-filtered stays for this room)
  sortedStayIds: string[];
  /** A search is active and this room has a matching stay */
  highlight?: boolean;
}) {
  const t = useTranslations("boarding.boardingPage");
  const { locale, currency } = useBusinessLocale();
  const sym = currencySymbol({ locale, currency });
  const { setNodeRef, isOver } = useDroppable({ id: room.id });
  const displayStatus = getRoomDisplayStatus(room);
  const statusConfig = ROOM_STATUS_MAP[displayStatus];

  // Display: always use date-filtered stays for the dog list, sorted by custom order
  const sortedOccPeriodStays = sortedStayIds.length > 0
    ? [...occPeriodStays].sort((a, b) => {
        const ai = sortedStayIds.indexOf(a.id);
        const bi = sortedStayIds.indexOf(b.id);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      })
    : occPeriodStays;
  const displayCheckedIn = sortedOccPeriodStays.filter((s) => s.status === "checked_in");
  const displayReserved = sortedOccPeriodStays.filter((s) => s.status === "reserved");

  // Action buttons: based on actual current room stays
  const checkedIn = room.boardingStays.filter((s) => s.status === "checked_in");
  const reserved = room.boardingStays.filter((s) => s.status === "reserved");
  const hasCurrentStays = checkedIn.length > 0 || reserved.length > 0;
  const hasPeriodStays = displayCheckedIn.length > 0 || displayReserved.length > 0;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "card overflow-hidden transition-all",
        isOver ? "ring-2 ring-brand-400 shadow-lg scale-[1.02]" : highlight ? "ring-2 ring-amber-300 hover:shadow-md" : "hover:shadow-md"
      )}
    >
      {/* Color bar */}
      <div className="h-1.5" style={{ backgroundColor: statusConfig.color }} />

      <div className="p-4">
        {/* Room header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <DoorOpen className="w-5 h-5" style={{ color: statusConfig.color }} />
            <span className="font-bold text-petra-text">{room.name}</span>
          </div>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
            style={{
              background: statusConfig.bg,
              color: statusConfig.color,
              borderColor: statusConfig.border,
            }}
          >
            {t(`roomStatus.${displayStatus}`)}
          </span>
        </div>

        {/* Room meta */}
        <div className="flex items-center gap-2 text-xs text-petra-muted mb-3">
          <Users className="w-3.5 h-3.5" />
          <span>{occPeriodStays.length}/{room.capacity}</span>
          <span className="badge-neutral text-[10px]">{roomTypeLabel(t, room.type)}</span>
          {room.pricePerNight != null && (
            <span className="ms-auto text-[10px] font-semibold text-brand-600">{t("room.pricePerNight", { currency: sym, price: room.pricePerNight })}</span>
          )}
        </div>

        {/* Checked-in + Reserved dogs — compact 2-column grid */}
        {(displayCheckedIn.length > 0 || displayReserved.length > 0) && (
          <SortableContext items={sortedStayIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-1.5 mb-1">
            {displayCheckedIn.map((stay) => {
              const actionStay = checkedIn.find(s => s.id === stay.id);
              return (
                <SortableStayInRoom key={stay.id} stayId={stay.id}>
                  <div className="p-2 rounded-lg" style={{ background: "#FFF7ED", border: "1px solid #FDBA74" }}>
                    <div className="flex items-center gap-1 mb-1">
                      <PawPrint className="w-3 h-3 text-orange-500 flex-shrink-0" />
                      <button
                        type="button"
                        className="flex-1 min-w-0 text-right"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onOpenStay(stay)}
                        title={t("openStay")}
                      >
                        <div className="text-xs font-semibold text-petra-text truncate hover:text-brand-600 hover:underline">{stay.pet.name}</div>
                        <div className="text-[10px] text-petra-muted truncate">{stay.customer?.name ?? t("serviceDog")}</div>
                      </button>
                    </div>
                    {stay.checkOut && (
                      <div className="text-[10px] text-orange-600 font-medium flex items-center gap-0.5 mb-1">
                        <Calendar className="w-2.5 h-2.5" />
                        {t("room.checkOutOn", { date: formatDate(stay.checkOut, locale) })}
                      </div>
                    )}
                    {actionStay && (
                      <button
                        className="w-full flex items-center justify-center gap-1 py-1 rounded text-[10px] font-medium text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200 bg-white"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onCheckout(actionStay.id)}
                      >
                        <LogOut className="w-2.5 h-2.5" />{t("checkOut")}
                      </button>
                    )}
                  </div>
                </SortableStayInRoom>
              );
            })}
            {displayReserved.map((stay) => {
              const actionStay = reserved.find(s => s.id === stay.id);
              return (
                <SortableStayInRoom key={stay.id} stayId={stay.id}>
                  <div className="p-2 rounded-lg" style={{ background: "#F5F3FF", border: "1px solid #C4B5FD" }}>
                    <div className="flex items-center gap-1 mb-1">
                      <PawPrint className="w-3 h-3 text-purple-500 flex-shrink-0" />
                      <button
                        type="button"
                        className="flex-1 min-w-0 text-right"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onOpenStay(stay)}
                        title={t("openStay")}
                      >
                        <div className="text-xs font-semibold text-petra-text truncate hover:text-brand-600 hover:underline">{stay.pet.name}</div>
                        <div className="text-[10px] text-petra-muted truncate">{stay.customer?.name ?? t("serviceDog")}</div>
                      </button>
                    </div>
                    <div className="text-[10px] text-purple-600 font-medium flex items-center gap-0.5 mb-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {t("room.checkInOn", { date: formatDate(stay.checkIn, locale) })}
                    </div>
                    {actionStay && (
                      <button
                        className="w-full flex items-center justify-center gap-1 py-1 rounded text-[10px] font-medium text-emerald-600 hover:bg-emerald-50 transition-colors border border-emerald-200 bg-white"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onCheckin(actionStay.id)}
                      >
                        <CheckCircle2 className="w-2.5 h-2.5" />{t("checkIn")}
                      </button>
                    )}
                  </div>
                </SortableStayInRoom>
              );
            })}
          </div>
          </SortableContext>
        )}

        {/* Drop hint when hovering empty room */}
        {isOver && !hasPeriodStays && (
          <div className="text-center py-4 border-2 border-dashed border-brand-300 rounded-lg bg-brand-50/30">
            <p className="text-xs text-brand-500 font-medium">{t("room.dropHere")}</p>
          </div>
        )}

        {/* Empty state */}
        {!isOver && !hasPeriodStays && displayStatus === "available" && (
          <div className="text-center py-6">
            <div className="w-10 h-10 rounded-full bg-green-50 mx-auto mb-2 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-sm text-green-600 font-medium">{t("room.availableForGuests")}</p>
          </div>
        )}

        {!isOver && !hasPeriodStays && displayStatus === "needs_cleaning" && (
          <div className="text-center py-4">
            <div className="w-10 h-10 rounded-full bg-yellow-50 mx-auto mb-2 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-sm text-yellow-600 font-medium mb-2">{t("roomStatus.needs_cleaning")}</p>
            <button onClick={() => onMarkClean(room.id)} className="btn-ghost text-xs text-yellow-700 hover:bg-yellow-50">
              <Check className="w-3.5 h-3.5" />{t("room.markClean")}
            </button>
          </div>
        )}

        {/* Mark clean button */}
        {displayStatus === "needs_cleaning" && (
          <div className="mt-2 pt-2 border-t border-slate-100" onPointerDown={(e) => e.stopPropagation()}>
            <button
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-yellow-700 hover:bg-yellow-50 transition-colors"
              onClick={() => onMarkClean(room.id)}
            >
              <Sparkles className="w-3.5 h-3.5" />{t("room.markClean")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

// ─── Occupancy Calendar View ─────────────────────────────────────────────────

function OccupancyCalendar({
  stays,
  rooms,
  onSelectDate,
  selectedDate,
  calendarMonth,
  onChangeMonth,
}: {
  stays: BoardingStay[];
  rooms: Room[];
  onSelectDate: (date: string | null) => void;
  selectedDate: string | null;
  calendarMonth: Date;
  onChangeMonth: (d: Date) => void;
}) {
  const t = useTranslations("boarding.boardingPage");
  const { locale } = useBusinessLocale();
  const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0);
  const todayStr = toDateStr(new Date());
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun

  const dayData = useMemo(() => {
    const result: Record<string, { occupied: number; arrivals: number; departures: number }> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const activeOnDay = stays.filter(
        (s) =>
          ACTIVE_STATUSES.includes(s.status) &&
          toDateStr(s.checkIn) <= dateStr &&
          (!s.checkOut || toDateStr(s.checkOut) > dateStr)
      );
      const arrivals = stays.filter(
        (s) => ACTIVE_STATUSES.includes(s.status) && toDateStr(s.checkIn) === dateStr
      ).length;
      const departures = stays.filter(
        (s) => ACTIVE_STATUSES.includes(s.status) && s.checkOut && toDateStr(s.checkOut) === dateStr
      ).length;
      result[dateStr] = { occupied: activeOnDay.length, arrivals, departures };
    }
    return result;
  }, [stays, year, month, daysInMonth]);

  const monthLabel = calendarMonth.toLocaleDateString(locale, { month: "long", year: "numeric" });

  return (
    <div className="card p-4 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => onChangeMonth(new Date(year, month + 1, 1))}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-petra-muted hover:bg-slate-100 hover:text-petra-text transition-colors"
          aria-label={t("calendar.nextMonth")}
        >
          <ChevronLeft className="w-4 h-4 ltr:-scale-x-100" />
        </button>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-petra-text">{monthLabel}</h3>
          {calendarMonth.getMonth() !== new Date().getMonth() || calendarMonth.getFullYear() !== new Date().getFullYear() ? (
            <button
              onClick={() => onChangeMonth(new Date())}
              className="text-[10px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
            >
              {t("today")}
            </button>
          ) : null}
        </div>
        <button
          onClick={() => onChangeMonth(new Date(year, month - 1, 1))}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-petra-muted hover:bg-slate-100 hover:text-petra-text transition-colors"
          aria-label={t("calendar.prevMonth")}
        >
          <ChevronRight className="w-4 h-4 ltr:-scale-x-100" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_KEYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-petra-muted py-1">
            {t(`weekdaysShort.${d}`)}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const data = dayData[dateStr] || { occupied: 0, arrivals: 0, departures: 0 };
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const ratio = totalCapacity > 0 ? data.occupied / totalCapacity : 0;

          let bg = "bg-slate-50 hover:bg-slate-100";
          let textColor = "text-petra-text";
          if (data.occupied > 0) {
            if (ratio >= 1) { bg = "bg-red-100 hover:bg-red-200"; textColor = "text-red-700"; }
            else if (ratio >= 0.8) { bg = "bg-orange-100 hover:bg-orange-200"; textColor = "text-orange-700"; }
            else { bg = "bg-amber-50 hover:bg-amber-100"; textColor = "text-amber-700"; }
          }

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(isSelected ? null : dateStr)}
              className={cn(
                "relative rounded-lg p-1 min-h-[52px] flex flex-col items-center transition-all",
                bg,
                isSelected ? "ring-2 ring-brand-500 ring-offset-1" : "",
                isToday ? "outline outline-2 outline-brand-400 outline-offset-[-2px]" : ""
              )}
            >
              <span className={cn("text-[11px] font-semibold", isToday ? "text-brand-600" : textColor)}>
                {d}
              </span>
              {data.occupied > 0 && totalCapacity > 0 && (
                <span className={cn("text-[9px]", textColor)}>
                  {data.occupied}/{totalCapacity}
                </span>
              )}
              <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                {data.arrivals > 0 && (
                  <span className="text-[8px] bg-green-100 text-green-700 rounded px-0.5">+{data.arrivals}</span>
                )}
                {data.departures > 0 && (
                  <span className="text-[8px] bg-slate-200 text-slate-600 rounded px-0.5">-{data.departures}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-3 pt-3 border-t border-slate-100 flex-wrap text-[10px] text-petra-muted">
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-50 border border-amber-200" /> {t("calendar.legend.partlyBooked")}</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-orange-100 border border-orange-300" /> {t("calendar.legend.almostFull")}</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-100 border border-red-300" /> {t("calendar.legend.full")}</div>
        <div className="flex items-center gap-1"><span className="bg-green-100 text-green-700 rounded px-0.5">+N</span> {t("calendar.legend.arrivals")}</div>
        <div className="flex items-center gap-1"><span className="bg-slate-200 text-slate-600 rounded px-0.5">-N</span> {t("calendar.legend.departures")}</div>
      </div>
    </div>
  );
}

// ─── Timeline / Gantt View ──────────────────────────────────────────────────

const TL_DAY_W = 44; // px per day column
const TL_ROOM_W = 140; // px for the sticky room-name column
const TL_ROW_H = 26; // px per stacked bar

/** "YYYY-MM-DD" of a local Date (the timeline's own day columns). */
function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Whole days from key a to key b (b - a). */
function dayKeyDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

function TimelineView({
  rooms,
  stays,
  numDays = TIMELINE_DAYS,
  startDate,
  search = "",
  onOpenStay,
}: {
  rooms: Room[];
  stays: BoardingStay[];
  numDays?: number;
  /** First visible day (defaults to today). Can be in the past — historical stays are shown too. */
  startDate?: Date;
  /** Normalised search query (normSearch) — only rows with a matching stay are shown. */
  search?: string;
  onOpenStay?: (stay: BoardingStay) => void;
}) {
  const t = useTranslations("boarding.boardingPage");
  const { locale, cfg } = useBusinessLocale();
  const realToday = startOfDay(new Date());
  // `today` is the timeline origin (kept as the variable name to minimise churn below).
  const today = startDate ? startOfDay(startDate) : realToday;
  const days = Array.from({ length: numDays }, (_, i) => addDays(today, i));
  const originKey = localDayKey(today);
  const trackWidth = numDays * TL_DAY_W;

  /**
   * Bar span in day columns. The check-in day is fully covered and the check-out
   * day half-covered, so the real departure date is visible (a 27/10–1/11 stay
   * reaches into 1/11) and a same-day turnover still reads clearly.
   * A same-day stay covers its whole day; an open-ended stay runs to the edge.
   */
  const spanOf = useCallback((stay: BoardingStay): { start: number; end: number } => {
    const start = dayKeyDiff(originKey, israelDayKey(stay.checkIn));
    if (!stay.checkOut) return { start, end: numDays + 1 };
    const out = dayKeyDiff(originKey, israelDayKey(stay.checkOut));
    return { start, end: out <= start ? start + 1 : out + 0.5 };
  }, [originKey, numDays]);

  // Group stays by room
  const roomStaysMap = useMemo(() => {
    const map: Record<string, BoardingStay[]> = {};
    rooms.forEach((r) => { map[r.id] = []; });
    map["unassigned"] = [];

    stays
      .filter((s) => ["reserved", "checked_in", "checked_out"].includes(s.status))
      .filter((s) => {
        const { start, end } = spanOf(s);
        return start < numDays && end > 0;
      })
      .filter((s) => !search || stayMatchesSearch(s, search))
      .forEach((s) => {
        const key = s.room?.id || "unassigned";
        if (map[key]) map[key].push(s);
        else map["unassigned"].push(s);
      });

    return map;
  }, [rooms, stays, spanOf, numDays, search]);

  const visibleRooms = search
    ? rooms.filter((r) => (roomStaysMap[r.id] || []).length > 0 || normSearch(r.name).includes(search))
    : rooms;

  function getBarPosition(stay: BoardingStay) {
    const { start, end } = spanOf(stay);
    const visibleStart = Math.max(0, start);
    const visibleEnd = Math.min(numDays, end);
    return {
      left: `${visibleStart * TL_DAY_W}px`,
      width: `${Math.max(TL_DAY_W / 2, (visibleEnd - visibleStart) * TL_DAY_W)}px`,
      days: visibleEnd - visibleStart,
    };
  }

  const todayIndex = diffDays(realToday, today); // may be out of range when browsing past/future

  function renderBars(list: BoardingStay[]) {
    return list.map((stay, rowIdx) => {
      const pos = getBarPosition(stay);
      const barColor = stay.status === "checked_in" ? "#22C55E"
        : stay.status === "checked_out" ? "#3B82F6"
        : "#94A3B8";
      const range = `${formatDate(stay.checkIn, locale)}${stay.checkOut ? ` → ${formatDate(stay.checkOut, locale)}` : ""}`;
      return (
        <button
          type="button"
          key={stay.id}
          onClick={() => onOpenStay?.(stay)}
          dir={cfg.dir}
          className="absolute rounded-md flex items-center gap-1 px-2 text-[10px] font-semibold text-white overflow-hidden whitespace-nowrap shadow-sm cursor-pointer hover:brightness-110 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 transition-[filter,box-shadow]"
          style={{
            left: pos.left, // rtl-ok — the timeline track is always LTR (dir="ltr" container)
            width: pos.width,
            top: `${4 + rowIdx * TL_ROW_H}px`,
            height: "22px",
            backgroundColor: barColor,
          }}
          title={t("timeline.barTitle", { pet: stay.pet.name, customer: stay.customer?.name ?? t("serviceDog"), range })}
          aria-label={t("timeline.barAria", { pet: stay.pet.name, range })}
        >
          <PawPrint className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{stay.pet.name}</span>
          {pos.days >= 3 && stay.checkOut && (
            <span className="ms-auto ps-1 font-normal opacity-90 flex-shrink-0">{t("timeline.until", { date: formatDate(stay.checkOut, locale) })}</span>
          )}
        </button>
      );
    });
  }

  function renderGridLines(withTint: boolean) {
    return (
      <div className="absolute inset-0 flex">
        {days.map((day, i) => {
          const isToday = i === todayIndex;
          const dayOfWeek = day.getDay();
          return (
            <div
              key={i}
              className={cn(
                "border-l border-slate-100 h-full flex-shrink-0", // rtl-ok — inside the always-LTR timeline track
                withTint && isToday && "bg-orange-50/30",
                withTint && dayOfWeek === 6 && "bg-slate-50/30"
              )}
              style={{ width: TL_DAY_W }}
            />
          );
        })}
      </div>
    );
  }

  const unassigned = roomStaysMap["unassigned"] || [];

  return (
    <div className="card overflow-hidden">
      <div className="overflow-auto max-h-[75vh] overscroll-contain" dir="ltr" data-no-pull-refresh>
        <div style={{ width: TL_ROOM_W + trackWidth }}>
          {/* Header row — sticky on top while scrolling down through the rooms */}
          <div className="flex sticky top-0 z-20 bg-white border-b border-petra-border">
            <div
              className="sticky left-0 z-30 flex-shrink-0 p-2 text-sm font-semibold text-petra-text bg-slate-50 border-r border-petra-border text-start" /* rtl-ok — always-LTR timeline: room column stays on the left */
              style={{ width: TL_ROOM_W }}
              dir={cfg.dir}
            >
              {t("room.label")}
            </div>
            {days.map((day, i) => {
              const isToday = i === todayIndex;
              const dayOfWeek = day.getDay();
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-shrink-0 py-1.5 text-center border-l border-petra-border", // rtl-ok — always-LTR timeline
                    isToday ? "bg-orange-50" : dayOfWeek === 6 ? "bg-slate-50" : "bg-white"
                  )}
                  style={{ width: TL_DAY_W }}
                >
                  <div className={cn("text-[10px]", isToday ? "text-orange-600 font-bold" : "text-petra-muted")}>
                    {t(`weekdaysShort.${WEEKDAY_KEYS[dayOfWeek]}`)}
                  </div>
                  <div className={cn("text-[11px] font-semibold", isToday ? "text-orange-600" : "text-petra-text")}>
                    {day.getDate()}/{day.getMonth() + 1}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Room rows */}
          {visibleRooms.map((room) => {
            const roomStays = roomStaysMap[room.id] || [];
            const displayStatus = getRoomDisplayStatus(room);
            const statusColor = ROOM_STATUS_MAP[displayStatus]?.color || "#94A3B8";
            const rowHeight = Math.max(48, roomStays.length * TL_ROW_H + 8);

            return (
              <div key={room.id} className="flex border-b border-slate-100">
                {/* Room label — sticky on the side while scrolling sideways */}
                <div
                  className="sticky left-0 z-10 flex-shrink-0 p-2 flex items-center gap-2 bg-slate-50 border-r border-petra-border" /* rtl-ok — always-LTR timeline */
                  style={{ width: TL_ROOM_W, minHeight: rowHeight }}
                  dir={cfg.dir}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: statusColor }}
                  />
                  <span className="text-xs font-medium text-petra-text truncate">{room.name}</span>
                  <span className="text-[9px] text-petra-muted ms-auto">{room._count.boardingStays}/{room.capacity}</span>
                </div>

                {/* Timeline cells with bars */}
                <div className="relative flex-shrink-0" style={{ width: trackWidth, minHeight: rowHeight }}>
                  {renderGridLines(true)}
                  {renderBars(roomStays)}
                  {roomStays.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] text-slate-300">—</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Unassigned row */}
          {unassigned.length > 0 && (
            <div className="flex border-b border-slate-100">
              <div
                className="sticky left-0 z-10 flex-shrink-0 p-2 flex items-center gap-2 bg-slate-100 border-r border-petra-border" /* rtl-ok — always-LTR timeline */
                style={{ width: TL_ROOM_W, minHeight: Math.max(48, unassigned.length * TL_ROW_H + 8) }}
                dir={cfg.dir}
              >
                <Hotel className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-500">{t("noRoom")}</span>
              </div>
              <div
                className="relative flex-shrink-0"
                style={{ width: trackWidth, minHeight: Math.max(48, unassigned.length * TL_ROW_H + 8) }}
              >
                {renderGridLines(false)}
                {renderBars(unassigned)}
              </div>
            </div>
          )}

          {search && visibleRooms.length === 0 && unassigned.length === 0 && (
            <div className="p-6 text-center text-sm text-petra-muted" dir={cfg.dir}>{t("timeline.noMatches")}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Simple Draggable wrapper (for unassigned zone) ─────────────────────────

const DraggableStayInRoom = memo(function DraggableStayInRoom({ stayId, children }: { stayId: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: stayId });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn("cursor-grab active:cursor-grabbing select-none rounded-lg", isDragging && "opacity-30")}
    >
      {children}
    </div>
  );
});

// ─── Sortable Stay wrapper for Grid View (supports both intra-room sort & cross-room move) ──

const SortableStayInRoom = memo(function SortableStayInRoom({ stayId, children }: { stayId: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stayId });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn("cursor-grab active:cursor-grabbing select-none rounded-lg", isDragging && "opacity-30")}
    >
      {children}
    </div>
  );
});

// ─── Unassigned Stays Card (droppable, for Grid View) ───────────────────────

const UnassignedGridCard = memo(function UnassignedGridCard({
  stays,
  onCheckin,
  onCheckout,
}: {
  stays: BoardingStay[];
  onCheckin: (id: string) => void;
  onCheckout: (id: string) => void;
}) {
  const t = useTranslations("boarding.boardingPage");
  const { locale } = useBusinessLocale();
  const { setNodeRef, isOver } = useDroppable({ id: "unassigned" });

  if (stays.length === 0 && !isOver) return null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "card overflow-hidden transition-all border-dashed border-2",
        isOver ? "border-brand-400 bg-brand-50/30 shadow-lg scale-[1.02]" : "border-slate-200 bg-slate-50/50"
      )}
    >
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <PawPrint className="w-5 h-5 text-slate-400" />
          <span className="font-bold text-petra-text">{t("noRoom")}</span>
          <span className="ms-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
            {stays.length}
          </span>
        </div>

        {stays.length === 0 && isOver && (
          <div className="text-center py-4 border-2 border-dashed border-brand-300 rounded-lg bg-brand-50/30">
            <p className="text-xs text-brand-500 font-medium">{t("unassigned.dropToUnassign")}</p>
          </div>
        )}

        {stays.map((stay) => (
          <DraggableStayInRoom key={stay.id} stayId={stay.id}>
            <div className="p-3 rounded-lg mb-2 bg-white border border-slate-200">
              <div className="flex items-center gap-2">
                <PawPrint className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-petra-text truncate">{stay.pet.name}</div>
                  <div className="text-[10px] text-petra-muted">{stay.customer?.name ?? t("serviceDog")}</div>
                </div>
              </div>
              <div className="text-[10px] text-petra-muted mt-1">
                {formatDate(stay.checkIn, locale)}{stay.checkOut ? ` → ${formatDate(stay.checkOut, locale)}` : ""}
              </div>
            </div>
          </DraggableStayInRoom>
        ))}

        {/* Action buttons */}
        {stays.length > 0 && (
          <div className="mt-1 pt-2 border-t border-slate-100 space-y-1" onPointerDown={(e) => e.stopPropagation()}>
            {stays.filter((s) => s.status === "reserved").map((stay) => (
              <button
                key={stay.id}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
                onClick={() => onCheckin(stay.id)}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />{t("unassigned.checkInPet", { name: stay.pet.name })}
              </button>
            ))}
            {stays.filter((s) => s.status === "checked_in").map((stay) => (
              <button
                key={stay.id}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                onClick={() => onCheckout(stay.id)}
              >
                <LogOut className="w-3.5 h-3.5" />{t("unassigned.checkOutPet", { name: stay.pet.name })}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});


// ─── Stay Row (list view) ────────────────────────────────────────────────────

function StayRow({
  stay,
  onCheckin,
  onCheckout,
  onExtend,
  onDelete,
  settings,
}: {
  stay: BoardingStay;
  onCheckin: (id: string) => void;
  onCheckout: (id: string) => void;
  onExtend: (id: string) => void;
  onDelete: (stay: BoardingStay) => void;
  settings: BusinessSettings;
}) {
  const t = useTranslations("boarding.boardingPage");
  const { locale } = useBusinessLocale();
  const stKey = STATUS_MAP[stay.status] ? stay.status : "reserved";
  const st = STATUS_MAP[stKey];
  const today = toDateStr(new Date());
  const isCheckinToday = toDateStr(stay.checkIn) === today && stay.status === "reserved";
  const isCheckoutToday = stay.checkOut && toDateStr(stay.checkOut) === today && stay.status === "checked_in";
  const overdue = isOverdue(stay, settings.boardingCheckOutTime || "11:00");

  return (
    <div className={cn("card p-4 flex flex-wrap sm:flex-nowrap items-center gap-4", overdue && "ring-2 ring-red-200")}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: st.bg }}>
        <PawPrint className="w-5 h-5" style={{ color: st.color }} />
      </div>

      <div className="flex-1 min-w-[60%] sm:min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-petra-text">{stay.pet.name}</span>
          {stay.pet.breed && <span className="text-xs text-petra-muted">({stay.pet.breed})</span>}
          {stay.pet.serviceDogProfile && (
            <Link
              href={`/service-dogs/${stay.pet.serviceDogProfile.id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
              title={t("row.serviceDogProfile")}
            >
              <Sparkles className="w-2.5 h-2.5" />{t("serviceDog")}
            </Link>
          )}
          <span className="text-sm text-petra-muted">—</span>
          {stay.customer ? (
            <Link
              href={`/customers/${stay.customer.id}`}
              className="text-sm text-petra-muted hover:text-brand-600 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {stay.customer.name}
            </Link>
          ) : (
            <span className="text-sm text-blue-600 font-medium">{t("serviceDog")}</span>
          )}
          {isCheckinToday && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-50 text-brand-600 border border-brand-100">
              <LogIn className="w-2.5 h-2.5" />{t("checkInToday")}
            </span>
          )}
          {isCheckoutToday && !overdue && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-100">
              <LogOut className="w-2.5 h-2.5" />{t("checkOutToday")}
            </span>
          )}
          {overdue && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200 animate-pulse">
              <AlertTriangle className="w-2.5 h-2.5" />{t("row.lateCheckOut")}
            </span>
          )}
        </div>
        <div className="text-xs text-petra-muted flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(stay.checkIn).toLocaleDateString(locale)}
            {stay.checkOut ? ` → ${new Date(stay.checkOut).toLocaleDateString(locale)}` : ` ${t("row.openEnded")}`}
          </span>
          {stay.room && (
            <span className="flex items-center gap-1">
              <DoorOpen className="w-3 h-3" />
              {stay.room.name}
            </span>
          )}
          {stay.checkOut && stay.status === "checked_in" && (
            <span className="flex items-center gap-1 text-[10px]">
              {(settings.boardingCalcMode || "nights") === "nights"
                ? t("count.nights", { count: calcNights(stay.checkIn, stay.checkOut) })
                : t("count.days", { count: calcNights(stay.checkIn, stay.checkOut) })}
            </span>
          )}
        </div>
        {(stay.status === "checked_in" || stay.status === "reserved") && stay.checkOut && (
          <StayProgress checkIn={stay.checkIn} checkOut={stay.checkOut} status={stay.status} />
        )}
      </div>

      <span className="badge text-[10px] flex-shrink-0" style={{ background: st.bg, color: st.color }}>
        {t(`stayStatus.${stKey}`)}
      </span>

      {(stay.status === "reserved" || stay.status === "checked_in") && (
        <button
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
          onClick={() => onDelete(stay)}
          title={t("row.deleteStay")}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}

      {stay.status === "reserved" && (
        <div className="flex gap-1 flex-shrink-0">
          {isCheckinToday && stay.customer?.phone && (() => {
            const checkInTime = settings.boardingCheckInTime || "10:00";
            const lines = [
              `שלום ${stay.customer!.name} 👋`, // i18n-ok — WhatsApp text to the customer (Phase 3)
              `תזכורת — היום ${stay.pet.name} מגיע/ה אלינו לפנסיון!`, // i18n-ok — WhatsApp text to the customer (Phase 3)
              `שעת צ׳ק-אין: ${checkInTime}`, // i18n-ok — WhatsApp text to the customer (Phase 3)
              stay.room ? `חדר: ${stay.room.name}` : "", // i18n-ok — WhatsApp text to the customer (Phase 3)
              stay.checkOut ? `יציאה מתוכננת: ${new Date(stay.checkOut).toLocaleDateString(locale)}` : "", // i18n-ok — WhatsApp text to the customer (Phase 3)
              "",
              `מחכים לכם! 🐾`, // i18n-ok — WhatsApp text to the customer (Phase 3)
            ].filter(Boolean).join("\n");
            return (
              <a
                href={`https://api.whatsapp.com/send?phone=${toWhatsAppPhone(stay.customer!.phone)}&text=${encodeURIComponent(lines)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                title={t("row.sendCheckInReminder")}
                onClick={(e) => e.stopPropagation()}
              >
                <MessageCircle className="w-3 h-3" />
                <span className="hidden sm:inline">{t("reminder")}</span>
              </a>
            );
          })()}
          <button className="btn-ghost text-xs" onClick={() => onCheckin(stay.id)}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t("checkIn")}</span>
          </button>
        </div>
      )}
      {stay.status === "checked_in" && (
        <div className="flex gap-1 flex-shrink-0">
          {isCheckoutToday && stay.customer?.phone && (() => {
            const checkOutTime = settings.boardingCheckOutTime || "11:00";
            const lines = [
              `שלום ${stay.customer!.name} 👋`, // i18n-ok — WhatsApp text to the customer (Phase 3)
              `${stay.pet.name} מסיים/ת היום את השהות בפנסיון.`, // i18n-ok — WhatsApp text to the customer (Phase 3)
              `שעת צ׳ק-אאוט: ${checkOutTime}`, // i18n-ok — WhatsApp text to the customer (Phase 3)
              "",
              `תודה ולהתראות! 🐾`, // i18n-ok — WhatsApp text to the customer (Phase 3)
            ].join("\n");
            return (
              <a
                href={`https://api.whatsapp.com/send?phone=${toWhatsAppPhone(stay.customer!.phone)}&text=${encodeURIComponent(lines)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                title={t("row.sendCheckOutReminder")}
                onClick={(e) => e.stopPropagation()}
              >
                <MessageCircle className="w-3 h-3" />
                <span className="hidden sm:inline">{t("reminder")}</span>
              </a>
            );
          })()}
          {stay.customer?.phone && (stay.pet.foodNotes || stay.pet.medicalNotes || (stay.pet.medications && stay.pet.medications.length > 0)) && (() => {
            const lines = [
              `🐾 הוראות טיפול — ${stay.pet.name}`, // i18n-ok — WhatsApp text to the customer (Phase 3)
              stay.room ? `חדר: ${stay.room.name}` : "", // i18n-ok — WhatsApp text to the customer (Phase 3)
              "",
            ];
            if (stay.pet.foodNotes) {
              lines.push(`🍽️ *הוראות האכלה:*`); // i18n-ok — WhatsApp text to the customer (Phase 3)
              lines.push(stay.pet.foodNotes);
              lines.push("");
            }
            if (stay.pet.medications && stay.pet.medications.length > 0) {
              lines.push(`💊 *תרופות:*`); // i18n-ok — WhatsApp text to the customer (Phase 3)
              stay.pet.medications.forEach((m) => {
                const parts = [m.medName];
                if (m.dosage) parts.push(m.dosage);
                if (m.frequency) parts.push(m.frequency);
                if (m.times) parts.push(m.times);
                lines.push(`• ${parts.join(" · ")}`);
              });
              lines.push("");
            }
            if (stay.pet.medicalNotes) {
              lines.push(`🏥 *הערות רפואיות:*`); // i18n-ok — WhatsApp text to the customer (Phase 3)
              lines.push(stay.pet.medicalNotes);
            }
            const waText = lines.filter((l, i) => !(l === "" && lines[i - 1] === "")).join("\n").trim();
            return (
              <a
                href={`https://api.whatsapp.com/send?phone=${toWhatsAppPhone(stay.customer!.phone)}&text=${encodeURIComponent(waText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                title={t("row.sendCareInstructions")}
                onClick={(e) => e.stopPropagation()}
              >
                <MessageCircle className="w-3 h-3" />
                <span className="hidden sm:inline">{t("row.instructions")}</span>
              </a>
            );
          })()}
          <button className="btn-ghost text-xs" onClick={() => onExtend(stay.id)} title={t("row.extendStay")}>
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t("row.extend")}</span>
          </button>
          <button className="btn-ghost text-xs" onClick={() => onCheckout(stay.id)}>
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t("checkOut")}</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Pet Health Alert Panel ──────────────────────────────────────────────────

function PetHealthAlert({ pet }: { pet: BoardingStay["pet"] }) {
  const t = useTranslations("boarding.boardingPage");
  const warnings: { icon: string; text: string; urgent: boolean }[] = [];

  if (pet.behavior?.dogAggression) warnings.push({ icon: "🐕", text: t("health.dogAggression"), urgent: true });
  if (pet.behavior?.humanAggression) warnings.push({ icon: "👤", text: t("health.humanAggression"), urgent: true });
  if (pet.behavior?.biteHistory) warnings.push({ icon: "⚠️", text: pet.behavior.biteDetails ? t("health.biteHistoryDetails", { details: pet.behavior.biteDetails }) : t("health.biteHistory"), urgent: true });
  if (pet.behavior?.resourceGuarding) warnings.push({ icon: "🛡️", text: t("health.resourceGuarding"), urgent: true });
  if (pet.behavior?.leashReactivity) warnings.push({ icon: "🔗", text: t("health.leashReactivity"), urgent: false });
  if (pet.behavior?.separationAnxiety) warnings.push({ icon: "😰", text: t("health.separationAnxiety"), urgent: false });
  if (pet.health?.allergies) warnings.push({ icon: "🌿", text: t("health.allergies", { value: pet.health.allergies }), urgent: false });
  if (pet.health?.medicalConditions) warnings.push({ icon: "🏥", text: t("health.medicalConditions", { value: pet.health.medicalConditions }), urgent: false });
  if (pet.health?.activityLimitations) warnings.push({ icon: "🦮", text: t("health.activityLimitations", { value: pet.health.activityLimitations }), urgent: false });
  if (pet.medications && pet.medications.length > 0) {
    pet.medications.forEach((m) => {
      warnings.push({ icon: "💊", text: t("health.medication", { details: `${m.medName}${m.dosage ? ` · ${m.dosage}` : ""}${m.frequency ? ` · ${m.frequency}` : ""}` }), urgent: false });
    });
  }

  if (warnings.length === 0) return null;

  const hasUrgent = warnings.some((w) => w.urgent);

  return (
    <div className={cn("rounded-xl p-3 border text-sm", hasUrgent ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200")}>
      <div className="flex items-center gap-1.5 mb-2">
        <ShieldAlert className={cn("w-4 h-4", hasUrgent ? "text-red-600" : "text-amber-600")} />
        <span className={cn("font-semibold text-xs", hasUrgent ? "text-red-700" : "text-amber-700")}>
          {hasUrgent ? t("health.urgentTitle") : t("health.title")}
        </span>
      </div>
      <ul className="space-y-1">
        {warnings.map((w, i) => (
          <li key={i} className={cn("flex items-start gap-1.5 text-xs", w.urgent ? "text-red-700 font-medium" : "text-amber-800")}>
            <span>{w.icon}</span>
            <span>{w.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Check-in Dialog ─────────────────────────────────────────────────────────

function CheckinDialog({
  stay,
  settings,
  onConfirm,
  onCancel,
  isPending,
}: {
  stay: BoardingStay;
  settings: BusinessSettings;
  onConfirm: (data: { actualTime: string; notes: string; createMedTasks: boolean }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const t = useTranslations("boarding.boardingPage");
  const tCommon = useTranslations("common");
  const { locale } = useBusinessLocale();
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const [actualTime, setActualTime] = useState(currentTime);
  const [notes, setNotes] = useState("");
  const hasMeds = Boolean(stay.pet.medications && stay.pet.medications.length > 0);
  const [createMedTasks, setCreateMedTasks] = useState(hasMeds);

  const configuredTime = settings.boardingCheckInTime || "14:00";
  const isEarly = actualTime < configuredTime;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onCancel} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[85dvh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-petra-text">{t("checkIn")}</h2>
            <p className="text-sm text-petra-muted mt-0.5">{stay.pet.name} — {stay.customer?.name ?? t("serviceDog")}</p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-petra-muted">{t("dialog.roomLabel")}</span>
              <span className="font-medium">{stay.room?.name || t("dialog.notAssigned")}</span>
            </div>
            {stay.yard && (
              <div className="flex justify-between">
                <span className="text-petra-muted">{t("dialog.yardLabel")}</span>
                <span className="font-medium text-teal-700">{stay.yard.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-petra-muted">{t("checkin.checkInDate")}</span>
              <span className="font-medium">{formatDateFull(stay.checkIn, locale)}</span>
            </div>
            {stay.checkOut && (
              <div className="flex justify-between">
                <span className="text-petra-muted">{t("checkin.plannedCheckOutDate")}</span>
                <span className="font-medium">{formatDateFull(stay.checkOut, locale)}</span>
              </div>
            )}
          </div>

          <PetHealthAlert pet={stay.pet} />

          <div>
            <label className="label">{t("checkin.actualTime")}</label>
            <input type="time" className="input" value={actualTime} onChange={(e) => setActualTime(e.target.value)} />
          </div>

          {isEarly && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {t("checkin.early", { time: configuredTime })}
            </div>
          )}

          <div>
            <label className="label">{t("checkin.notes")}</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("checkin.notesPlaceholder")} />
          </div>

          {hasMeds && (
            <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl bg-blue-50 border border-blue-100">
              <input
                type="checkbox"
                checked={createMedTasks}
                onChange={(e) => setCreateMedTasks(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-600"
              />
              <span className="text-sm text-blue-700 font-medium">
                {t("checkin.createMedTasks", { count: stay.pet.medications!.length })}
              </span>
            </label>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={isPending}
            onClick={() => onConfirm({ actualTime, notes, createMedTasks })}
          >
            <CheckCircle2 className="w-4 h-4" />
            {isPending ? t("dialog.processing") : t("checkin.confirm")}
          </button>
          <button className="btn-secondary" onClick={onCancel}>{tCommon("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Check-out Dialog ────────────────────────────────────────────────────────

function CheckoutDialog({
  stay,
  settings,
  onConfirm,
  onCancel,
  isPending,
}: {
  stay: BoardingStay;
  settings: BusinessSettings;
  onConfirm: (data: { notes: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const t = useTranslations("boarding.boardingPage");
  const tCommon = useTranslations("common");
  const { locale, currency } = useBusinessLocale();
  const sym = currencySymbol({ locale, currency });
  const [notes, setNotes] = useState("");
  const [sendingPaymentRequest, setSendingPaymentRequest] = useState(false);

  const nights = stay.checkOut ? calcNights(stay.checkIn, stay.checkOut) : calcNights(stay.checkIn, new Date().toISOString());
  const calcMode = settings.boardingCalcMode || "nights";
  const configuredCheckoutTime = settings.boardingCheckOutTime || "11:00";

  // Price is editable per stay: the nightly rate starts from the business default
  // and can be overridden here, with an optional percentage or shekel discount —
  // the same controls a training order offers.
  const [pricePerNight, setPricePerNight] = useState<number>(settings.boardingPricePerNight || 0);
  const [discountType, setDiscountType] = useState<"none" | "percent" | "fixed">("none");
  const [discountValue, setDiscountValue] = useState<number>(0);

  const subtotal = nights * pricePerNight;
  const discountAmount =
    discountType === "percent"
      ? Math.min(subtotal, (subtotal * Math.max(0, Math.min(100, discountValue))) / 100)
      : discountType === "fixed"
      ? Math.min(subtotal, Math.max(0, discountValue))
      : 0;
  const total = Math.max(0, subtotal - discountAmount);

  // Build + send the boarding payment request, including a payment link when possible.
  // Boarding has no per-product URL, so we generate a one-off Stripe checkout link.
  const sendBoardingPaymentRequest = async () => {
    if (sendingPaymentRequest || !stay.customer?.phone) return;
    // Open the window inside the click gesture so it isn't blocked after the async Stripe call.
    const win = window.open("", "_blank");
    setSendingPaymentRequest(true);
    try {
      let link: string | null = null;
      if (total > 0) {
        try {
          const res = await fetch("/api/payments/stripe/payment-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: total,
              description: `פנסיון — ${stay.pet.name} (${nights} ${calcMode === "nights" ? "לילות" : "ימים"})`, // i18n-ok — payment-link description shown to the customer (Phase 3)
              customerId: stay.customer.id,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            link = data.url ?? null;
          }
        } catch {
          // Stripe not configured — fall through to link-less message.
        }
      }
      const linkBlock = link ? `\n\n💳 לתשלום מאובטח לחצו כאן:\n${link}` : ""; // i18n-ok — WhatsApp text to the customer (Phase 3)
      if (!link) {
        toast.warning(t("checkout.noPaymentLinkWarning"));
      }
      const discountLine = discountAmount > 0 ? `\nהנחה: −${sym}${discountAmount.toFixed(0)}` : ""; // i18n-ok — WhatsApp text to the customer (Phase 3)
      const msg = `שלום ${stay.customer.name}! 😊\nתודה שהיה לנו את ${stay.pet.name} בפנסיון.\nסיכום השהייה: ${nights} ${calcMode === "nights" ? "לילות" : "ימים"} × ${sym}${pricePerNight} = ${sym}${subtotal.toFixed(0)}.${discountLine}\nלתשלום: ${sym}${total.toFixed(0)}\n\nנשמח לקבל תשלום 🙏${linkBlock}`; // i18n-ok — WhatsApp text to the customer (Phase 3)
      const waUrl = `https://api.whatsapp.com/send?phone=${toWhatsAppPhone(stay.customer.phone)}&text=${encodeURIComponent(msg)}`;
      if (win) win.location.href = waUrl;
      else window.open(waUrl, "_blank");
    } finally {
      setSendingPaymentRequest(false);
    }
  };

  const isLate = (() => {
    if (!stay.checkOut) return false;
    const checkOutDate = new Date(stay.checkOut);
    const [h, m] = configuredCheckoutTime.split(":").map(Number);
    checkOutDate.setHours(h, m, 0, 0);
    return Date.now() > checkOutDate.getTime();
  })();

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onCancel} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[85dvh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-petra-text">{t("checkOut")}</h2>
            <p className="text-sm text-petra-muted mt-0.5">{stay.pet.name} — {stay.customer?.name ?? t("serviceDog")}</p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-petra-muted">{t("checkout.pet")}</span>
              <span className="font-medium">{stay.pet.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-petra-muted">{t("checkout.client")}</span>
              <span className="font-medium">{stay.customer?.name ?? t("serviceDog")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-petra-muted">{t("dialog.roomLabel")}</span>
              <span className="font-medium">{stay.room?.name || "—"}</span>
            </div>
            {stay.yard && (
              <div className="flex justify-between">
                <span className="text-petra-muted">{t("dialog.yardLabel")}</span>
                <span className="font-medium text-teal-700">{stay.yard.name}</span>
              </div>
            )}
            <div className="divider" />
            <div className="flex justify-between">
              <span className="text-petra-muted">{t("dialog.checkInLabel")}</span>
              <span className="font-medium">{formatDateFull(stay.checkIn, locale)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-petra-muted">{t("dialog.checkOutLabel")}</span>
              <span className="font-medium">{stay.checkOut ? formatDateFull(stay.checkOut, locale) : t("today")}</span>
            </div>
            <div className="divider" />
            <div className="flex justify-between items-center">
              <span className="text-petra-muted">{t("checkout.duration")}</span>
              <span className="text-base font-bold text-brand-600">
                {calcMode === "nights" ? t("count.nights", { count: nights }) : t("count.days", { count: nights })}
              </span>
            </div>
          </div>

          {isLate && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {t("checkout.late", { time: configuredCheckoutTime })}
            </div>
          )}

          {/* Pricing — overrideable per stay */}
          {stay.customer && (
            <div className="p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="label text-xs">{calcMode === "nights" ? t("checkout.pricePerNight", { currency: sym }) : t("checkout.pricePerDay", { currency: sym })}</label>
                  <input
                    type="number"
                    min={0}
                    className="input w-full text-sm"
                    value={pricePerNight}
                    onChange={(e) => setPricePerNight(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="flex-1">
                  <label className="label text-xs">{t("checkout.discount")}</label>
                  <select
                    className="input w-full text-sm"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as "none" | "percent" | "fixed")}
                  >
                    <option value="none">{t("checkout.noDiscount")}</option>
                    <option value="percent">{t("checkout.discountPercent")}</option>
                    <option value="fixed">{t("checkout.discountFixed", { currency: sym })}</option>
                  </select>
                </div>
                {discountType !== "none" && (
                  <div className="w-24">
                    <label className="label text-xs">{discountType === "percent" ? "%" : sym}</label>
                    <input
                      type="number"
                      min={0}
                      max={discountType === "percent" ? 100 : undefined}
                      className="input w-full text-sm"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                    />
                  </div>
                )}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-petra-muted">
                  <span>{t("checkout.subtotal")}</span>
                  <span>{sym}{subtotal.toLocaleString()}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>{t("checkout.discount")}{discountType === "percent" ? ` (${discountValue}%)` : ""}</span>
                    <span>−{sym}{discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-petra-text border-t pt-1">
                  <span>{t("checkout.toPay")}</span>
                  <span>{sym}{total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="label">{t("checkout.notes")}</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("checkout.notesPlaceholder")} />
          </div>
        </div>

        {/* WhatsApp payment request — only when customer exists */}
        {total > 0 && stay.customer?.phone && (
          <button
            type="button"
            onClick={sendBoardingPaymentRequest}
            disabled={sendingPaymentRequest}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition-colors disabled:opacity-60"
          >
            <MessageCircle className="w-4 h-4" />
            {sendingPaymentRequest ? t("checkout.preparingLink") : t("checkout.sendPaymentRequest")}
          </button>
        )}

        <div className="flex gap-3 mt-2">
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={isPending}
            onClick={() => onConfirm({ notes })}
          >
            <LogOut className="w-4 h-4" />
            {isPending ? t("dialog.processing") : t("checkout.confirm")}
          </button>
          <button className="btn-secondary" onClick={onCancel}>{tCommon("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Stay Dialog ────────────────────────────────────────────────────────

/** Reached by clicking a dog inside a room: edit the stay's dates, room and notes. */
function EditStayDialog({
  stay,
  rooms,
  onSave,
  onCancel,
  isPending,
}: {
  stay: BoardingStay;
  rooms: Room[];
  onSave: (data: { checkIn: string; checkOut: string | null; roomId: string | null; notes: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const t = useTranslations("boarding.boardingPage");
  const tCommon = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const toLocalInput = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [checkIn, setCheckIn] = useState(toLocalInput(stay.checkIn));
  const [checkOut, setCheckOut] = useState(stay.checkOut ? toLocalInput(stay.checkOut) : "");
  const [roomId, setRoomId] = useState(stay.room?.id ?? "");
  const [notes, setNotes] = useState(stay.notes ?? "");

  const invalidRange = !!checkOut && new Date(checkOut) <= new Date(checkIn);
  const nights = checkOut && !invalidRange ? calcNights(checkIn, checkOut) : 0;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onCancel} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[85dvh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-petra-text">{t("edit.title")}</h2>
            <p className="text-sm text-petra-muted mt-0.5">{stay.pet.name} — {stay.customer?.name ?? t("serviceDog")}</p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {stay.customer && (
          <Link
            href={`/customers/${stay.customer.id}`}
            className="mb-4 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-brand-200 bg-brand-50 text-sm font-medium text-brand-700 hover:bg-brand-100 transition-colors"
          >
            <Users className="w-4 h-4" />
            {t("edit.openClientCard")}
          </Link>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">{t("edit.checkIn")}</label>
              <input type="datetime-local" lang={cfg.lang} className="input w-full text-sm" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">{t("edit.checkOut")}</label>
              <input type="datetime-local" lang={cfg.lang} className="input w-full text-sm" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
          </div>

          {invalidRange && (
            <p className="text-xs text-red-600">{t("edit.invalidRange")}</p>
          )}
          {nights > 0 && (
            <p className="text-xs text-petra-muted">{t("count.nights", { count: nights })}</p>
          )}

          <div>
            <label className="label text-xs">{t("room.label")}</label>
            <select className="input w-full text-sm" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">{t("noRoom")}</option>
              {rooms.filter((r) => r.isActive).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label text-xs">{t("notes")}</label>
            <textarea className="input w-full text-sm" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <p className="text-xs text-petra-muted">
            {t("edit.priceHint")}
          </p>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={isPending || invalidRange || !checkIn}
            onClick={() =>
              onSave({
                checkIn: new Date(checkIn).toISOString(),
                checkOut: checkOut ? new Date(checkOut).toISOString() : null,
                roomId: roomId || null,
                notes,
              })
            }
          >
            {isPending ? tCommon("progress.saving") : t("edit.saveChanges")}
          </button>
          <button className="btn-secondary" onClick={onCancel}>{tCommon("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Extend Stay Dialog ──────────────────────────────────────────────────────

function ExtendStayDialog({
  stay,
  onConfirm,
  onCancel,
  isPending,
}: {
  stay: BoardingStay;
  onConfirm: (checkOut: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const t = useTranslations("boarding.boardingPage");
  const tCommon = useTranslations("common");
  const { locale, cfg } = useBusinessLocale();
  const hasCheckout = !!stay.checkOut;
  const currentCheckout = stay.checkOut
    ? new Date(stay.checkOut).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const [newCheckout, setNewCheckout] = useState(currentCheckout);

  // Any day after check-in — retroactive/historical stays must be editable too.
  const minDate = new Date(new Date(stay.checkIn).getTime() + 86400000).toISOString().slice(0, 10);

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onCancel} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-petra-text">{hasCheckout ? t("extend.titleExtend") : t("extend.titleSet")}</h2>
            <p className="text-sm text-petra-muted mt-0.5">{stay.pet.name} — {stay.customer?.name ?? t("serviceDog")}</p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-petra-muted">{t("dialog.checkInLabel")}</span>
              <span className="font-medium">{new Date(stay.checkIn).toLocaleDateString(locale)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-petra-muted">{t("extend.currentCheckOut")}</span>
              <span className="font-medium">{hasCheckout ? new Date(stay.checkOut!).toLocaleDateString(locale) : t("extend.openStay")}</span>
            </div>
          </div>
          <div>
            <label className="label">{hasCheckout ? t("extend.newDateLabel") : t("extend.dateLabel")}</label>
            <input
              type="date" lang={cfg.lang}
              className="input"
              value={newCheckout}
              min={minDate}
              onChange={(e) => setNewCheckout(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={isPending || !newCheckout || newCheckout < minDate || (hasCheckout && newCheckout === currentCheckout)}
            onClick={() => onConfirm(newCheckout + "T12:00:00")}
          >
            <Calendar className="w-4 h-4" />
            {isPending ? tCommon("progress.saving") : hasCheckout ? t("extend.update") : t("extend.set")}
          </button>
          <button className="btn-secondary" onClick={onCancel}>{tCommon("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Vaccination Alert Banner ────────────────────────────────────────────────

interface VaccinationAlert {
  petId: string;
  petName: string;
  customerName: string;
  customerPhone: string;
  rabiesValidUntil: string | null;
  status: "expired" | "expiring_soon" | "valid" | "not_vaccinated";
}

interface HealthAlertsData {
  alerts: VaccinationAlert[];
  totalAlerts: number;
  expired: number;
  expiringSoon: number;
  notVaccinated: number;
}

function VaccinationAlertBanner() {
  const t = useTranslations("boarding.boardingPage");
  const { locale } = useBusinessLocale();
  const [expanded, setExpanded] = useState(false);

  const { data } = useQuery<HealthAlertsData>({
    queryKey: ["health-alerts"],
    queryFn: () => fetchJSON<HealthAlertsData>("/api/health-alerts?days=30"),
    staleTime: 5 * 60 * 1000,
  });

  if (!data || data.totalAlerts === 0) return null;

  const shownAlerts = data.alerts.filter(a => a.status !== "not_vaccinated");
  const notVaccinatedAlerts = data.alerts.filter(a => a.status === "not_vaccinated");
  const allShown = expanded ? data.alerts : data.alerts.slice(0, 3);

  const summaryParts: string[] = [];
  if (data.expired > 0) summaryParts.push(t("vaccination.expiredCount", { count: data.expired }));
  if ((data.notVaccinated ?? 0) > 0) summaryParts.push(t("vaccination.notVaccinatedCount", { count: data.notVaccinated }));
  if (data.expiringSoon > 0) summaryParts.push(t("vaccination.expiringSoonCount", { count: data.expiringSoon }));

  return (
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-3 text-right"
      >
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-amber-900">
            {summaryParts.length > 0 ? t("vaccination.summary", { parts: summaryParts.join(" · ") }) : t("vaccination.expiringSoonDogs", { count: data.expiringSoon })}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-amber-600 transition-transform shrink-0",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-amber-200 divide-y divide-amber-100">
          {allShown.map((alert) => {
            const waPhone = toWhatsAppPhone(alert.customerPhone);
            const isNotVaccinated = alert.status === "not_vaccinated";
            const msg = encodeURIComponent(
              isNotVaccinated
                ? `שלום ${alert.customerName}, הכלב ${alert.petName} אינו מחוסן. נא לחסן לפני הכניסה לפנסיון.` // i18n-ok — WhatsApp text to the customer (Phase 3)
                : `שלום ${alert.customerName}, חיסון הכלב של ${alert.petName} פג תוקף${alert.rabiesValidUntil ? ` בתאריך ${formatDate(alert.rabiesValidUntil, locale)}` : ""}. נא לחדש לפני הכניסה לפנסיון.` // i18n-ok — WhatsApp text to the customer (Phase 3)
            );
            return (
              <div
                key={alert.petId}
                className="flex items-center gap-3 px-4 py-2.5 bg-white/60"
              >
                <div
                  className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    alert.status === "expired" ? "bg-red-500"
                    : alert.status === "not_vaccinated" ? "bg-orange-500"
                    : "bg-amber-400"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-petra-text">
                    {alert.petName}
                  </span>
                  <span className="text-xs text-petra-muted mr-2">
                    ({alert.customerName})
                  </span>
                  {isNotVaccinated ? (
                    <span className="text-xs font-medium text-orange-600">{t("vaccination.notVaccinated")}</span>
                  ) : alert.rabiesValidUntil ? (
                    <span
                      className={cn(
                        "text-xs font-medium",
                        alert.status === "expired" ? "text-red-600" : "text-amber-700"
                      )}
                    >
                      {t("vaccination.validUntil", { date: formatDate(alert.rabiesValidUntil, locale) })}
                    </span>
                  ) : null}
                </div>
                {waPhone && (
                  <a
                    href={`https://api.whatsapp.com/send?phone=${waPhone}&text=${msg}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1 shrink-0"
                  >
                    <MessageCircle className="w-3 h-3" />
                    {t("reminder")}
                  </a>
                )}
              </div>
            );
          })}
          {!expanded && data.alerts.length > 3 && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full text-xs text-amber-700 py-2 hover:bg-amber-100"
            >
              {t("vaccination.showMore", { count: data.alerts.length - 3 })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Training Minutes Field ───────────────────────────────────────────────────

function TrainingMinutesField({ stay }: { stay: BoardingStay }) {
  const t = useTranslations("boarding.boardingPage");
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(stay.dailyTrainingMinutes ?? ""));

  const mutation = useMutation({
    mutationFn: (minutes: number | null) =>
      fetch(`/api/boarding/${stay.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyTrainingMinutes: minutes }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boarding"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setEditing(false);
    },
    onError: () => toast.error(t("training.saveError")),
  });

  if (editing) {
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const num = parseInt(value);
          mutation.mutate(isNaN(num) || value === "" ? null : num);
        }}
      >
        <input
          type="number"
          min={0}
          max={480}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0"
          className="w-16 text-xs border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
          autoFocus
        />
        <span className="text-xs text-petra-muted">{t("training.minutesUnit")}</span>
        <button type="submit" className="text-brand-600 hover:text-brand-800 transition-colors">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-petra-muted hover:text-petra-text transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </form>
    );
  }

  return (
    <button
      onClick={() => { setValue(String(stay.dailyTrainingMinutes ?? "")); setEditing(true); }}
      className="flex items-center gap-1 text-xs text-petra-muted hover:text-blue-600 transition-colors"
      title={t("training.editTitle")}
    >
      <Sparkles className="w-3 h-3" />
      {stay.dailyTrainingMinutes ? t("training.minutes", { count: stay.dailyTrainingMinutes }) : t("training.add")}
    </button>
  );
}

// ─── Care Log Modal ───────────────────────────────────────────────────────────

interface CareLogEntry {
  id: string;
  type: string;
  title: string;
  notes: string | null;
  doneAt: string;
}

// Labels: boarding.boardingPage.careLog.types.<value>
const CARE_LOG_TYPES = [
  { value: "FEEDING", emoji: "🍽️" },
  { value: "MEDICATION", emoji: "💊" },
  { value: "WALK", emoji: "🦮" },
  { value: "NOTE", emoji: "📝" },
];

function CareLogModal({ stayId, petName, onClose }: { stayId: string; petName: string; onClose: () => void }) {
  const t = useTranslations("boarding.boardingPage");
  const tCommon = useTranslations("common");
  const { locale } = useBusinessLocale();
  const queryClient = useQueryClient();
  const [logType, setLogType] = useState("FEEDING");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery<{ logs: CareLogEntry[] }>({
    queryKey: ["care-logs", stayId],
    queryFn: () => fetch(`/api/boarding/${stayId}/care-logs`).then((r) => r.json()),
  });

  const logs = data?.logs ?? [];

  const addMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/boarding/${stayId}/care-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: logType, title, notes }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(t("careLog.genericError"));
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["care-logs", stayId] });
      setTitle("");
      setNotes("");
      toast.success(t("careLog.added"));
    },
    onError: () => toast.error(t("careLog.addError")),
  });

  const deleteMutation = useMutation({
    mutationFn: (logId: string) =>
      fetch(`/api/boarding/${stayId}/care-logs?logId=${logId}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["care-logs", stayId] });
    },
    onError: () => toast.error(t("careLog.deleteError")),
  });

  const typeConfig = Object.fromEntries(CARE_LOG_TYPES.map((lt) => [lt.value, lt]));
  const careTypeLabel = (type: string) => (t.has(`careLog.types.${type}`) ? t(`careLog.types.${type}`) : type);

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[85dvh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-brand-500" />
            {t("careLog.title", { name: petName })}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Add form */}
        <div className="p-3 bg-slate-50 rounded-xl mb-4 space-y-2">
          <div className="flex gap-1 flex-wrap">
            {CARE_LOG_TYPES.map((lt) => (
              <button
                key={lt.value}
                onClick={() => setLogType(lt.value)}
                className={cn(
                  "px-2 py-1 rounded-lg text-xs font-medium border transition-all",
                  logType === lt.value
                    ? "bg-brand-500 text-white border-brand-500"
                    : "bg-white text-petra-muted border-slate-200"
                )}
              >
                {lt.emoji} {careTypeLabel(lt.value)}
              </button>
            ))}
          </div>
          <input
            className="input text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("careLog.titlePlaceholder")}
          />
          <input
            className="input text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("careLog.notesPlaceholder")}
          />
          <button
            className="btn-primary w-full text-sm py-1.5"
            disabled={!title.trim() || addMutation.isPending}
            onClick={() => addMutation.mutate()}
          >
            {addMutation.isPending ? tCommon("progress.saving") : t("careLog.add")}
          </button>
        </div>

        {/* Log timeline */}
        {isLoading && <PetraLoader variant="inline" />}
        {!isLoading && logs.length === 0 && (
          <p className="text-center text-sm text-petra-muted py-4">{t("careLog.empty")}</p>
        )}
        {logs.map((log) => {
          const tc = { emoji: typeConfig[log.type]?.emoji ?? "📋", label: careTypeLabel(log.type) };
          return (
            <div key={log.id} className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
              <span className="text-xl flex-shrink-0 mt-0.5">{tc.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-petra-text">{log.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-petra-muted">
                    {tc.label}
                  </span>
                </div>
                {log.notes && <p className="text-xs text-petra-muted mt-0.5">{log.notes}</p>}
                <p className="text-[10px] text-petra-muted mt-0.5">
                  {new Date(log.doneAt).toLocaleDateString(locale)} · {new Date(log.doneAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <button
                onClick={() => deleteMutation.mutate(log.id)}
                className="text-petra-muted hover:text-red-500 transition-colors p-1 flex-shrink-0"
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

function BoardingPageContent() {
  const { canExportData, canManageBoarding } = usePermissions();
  const [showNewStay, setShowNewStay] = useState(false);
  const [careLogStay, setCareLogStay] = useState<{ id: string; petName: string } | null>(null);
  const [form, setForm] = useState({
    customerId: "", petIds: [] as string[], roomId: "", checkIn: "", checkOut: "", checkInTime: "12:00", checkOutTime: "12:00", notes: "", pricePerNight: 0, assignedToUserId: "",
    // Retroactive stays (dog already in the pension before the business joined Petra):
    // "" = let the server decide (reserved), or an explicit status for backdated dates.
    status: "" as "" | "reserved" | "checked_in" | "checked_out",
  });
  const [serviceDogMode, setServiceDogMode] = useState(false);
  const [pickedCustomer, setPickedCustomer] = useState<PickerCustomer | null>(null);
  const [serviceDogSearch, setServiceDogSearch] = useState("");
  const [staySearch, setStaySearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("active");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [activeStayId, setActiveStayId] = useState<string | null>(null);
  const [roomSlotOrders, setRoomSlotOrders] = useState<Record<string, string[]>>({});

  // Occupancy checker — defaults to the coming week (today → +7 days).
  // Availability is a forward-looking question; past dates stay selectable
  // via the pickers (no min clamp on the "from" input).
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekAheadStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();
  const [occFrom, setOccFrom] = useState(todayStr);
  const [occTo, setOccTo] = useState(weekAheadStr);
  // Draft state for date inputs (apply on button click)
  const [occDraftFrom, setOccDraftFrom] = useState(todayStr);
  const [occDraftTo, setOccDraftTo] = useState(weekAheadStr);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [timelineDays, setTimelineDays] = useState(14);
  const [editStay, setEditStay] = useState<BoardingStay | null>(null);
  // Timeline origin — "" = today. Lets the user scroll back to past weeks (retroactive stays, history).
  const [timelineStart, setTimelineStart] = useState<string>("");

  // Dialog state
  const shouldCreateMedTasksRef = useRef(false);
  const checkinStayRef = useRef<BoardingStay | null>(null);
  const staysListRef = useRef<HTMLDivElement>(null);
  const [checkinDialogStay, setCheckinDialogStay] = useState<BoardingStay | null>(null);
  const [checkoutDialogStay, setCheckoutDialogStay] = useState<BoardingStay | null>(null);
  const [extendDialogStay, setExtendDialogStay] = useState<BoardingStay | null>(null);
  const [deleteDialogStay, setDeleteDialogStay] = useState<BoardingStay | null>(null);

  // Rooms manager
  const [showRoomsManager, setShowRoomsManager] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editRoomForm, setEditRoomForm] = useState({ name: "", capacity: 1, type: "standard", pricePerNight: "" as string | number });
  const [newRoomForm, setNewRoomForm] = useState({ name: "", capacity: 1, type: "standard", pricePerNight: "" as string | number });

  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  // ── Data queries ──

  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ["rooms"],
    queryFn: () => fetchJSON<Room[]>("/api/boarding/rooms"),
  });

  const { data: stays = [], isLoading, isError, isFetching: isBoardingFetching } = useQuery<BoardingStay[]>({
    queryKey: ["boarding"],
    queryFn: () => fetchJSON<BoardingStay[]>("/api/boarding"),
  });

  const { data: settingsData } = useQuery<BusinessSettings>({
    queryKey: ["settings"],
    queryFn: () => fetchJSON<BusinessSettings>("/api/settings"),
  });

  const settings: BusinessSettings = settingsData || {
    boardingCheckInTime: "14:00",
    boardingCheckOutTime: "11:00",
    boardingCalcMode: "nights",
    boardingMinNights: 1,
    boardingPricePerNight: 150,
  };

  const { data: serviceDogsList = [] } = useQuery<Array<{ id: string; phase: string; pet: { id: string; name: string; breed?: string | null } }>>({
    queryKey: ["service-dogs-for-select"],
    queryFn: () => fetchJSON("/api/service-dogs"),
    enabled: showNewStay && serviceDogMode,
  });

  const { data: serviceDogsInBoarding = [] } = useQuery<Array<{ id: string; phase: string; trainingTotalHours: number; pet: { id: string; name: string; breed?: string | null } }>>({
    queryKey: ["service-dogs-in-boarding"],
    queryFn: () => fetchJSON("/api/service-dogs?location=BOARDING"),
  });

  const { data: occStays = [], isFetching: occLoading } = useQuery<BoardingStay[]>({
    queryKey: ["boarding-occupancy", occFrom, occTo],
    queryFn: () => fetchJSON<BoardingStay[]>(`/api/boarding?from=${occFrom}&to=${occTo}`),
    enabled: !!occFrom && !!occTo,
    staleTime: 30_000,
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["team-members"],
    queryFn: () => fetchJSON<TeamMember[]>("/api/team-members"),
  });

  const selectedCustomer: Customer | undefined =
    pickedCustomer && pickedCustomer.id === form.customerId ? pickedCustomer : undefined;
  const selectedServiceDog = serviceDogMode && form.petIds.length > 0
    ? serviceDogsList.find((sd) => sd.pet.id === form.petIds[0])
    : undefined;
  // Service dogs in training don't need price calculation — they board for free during training
  const isServiceDogInTraining = !!(selectedServiceDog && selectedServiceDog.phase !== "CERTIFIED");
  const showPricing = !isServiceDogInTraining;

  const filteredServiceDogs = serviceDogsList.filter(
    (sd) =>
      !serviceDogSearch ||
      sd.pet.name.includes(serviceDogSearch) ||
      (sd.pet.breed ?? "").includes(serviceDogSearch)
  );

  // ── Mutations ──

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const checkInDT = data.checkIn ? `${data.checkIn}T${data.checkInTime || "12:00"}:00` : "";
      const checkOutDT = data.checkOut ? `${data.checkOut}T${data.checkOutTime || "12:00"}:00` : "";
      const promises = data.petIds.map((petId) =>
        fetch("/api/boarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: data.customerId || null,
            petId,
            roomId: data.roomId || null,
            checkIn: checkInDT,
            checkOut: checkOutDT || null,
            notes: data.notes || null,
            assignedToUserId: data.assignedToUserId || null,
            ...(data.status ? { status: data.status } : {}),
          }),
        }).then(async (r) => { if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Failed"); } return r.json(); })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boarding"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setShowNewStay(false);
      setForm({ customerId: "", petIds: [], roomId: "", checkIn: "", checkOut: "", checkInTime: settings.boardingCheckInTime || "14:00", checkOutTime: settings.boardingCheckOutTime || "11:00", notes: "", pricePerNight: settings.boardingPricePerNight || 150, assignedToUserId: "", status: "" });
      setPickedCustomer(null);
      setServiceDogMode(false);
      toast.success("ההשמה נוצרה בהצלחה");
    },
    onError: (err: Error) => toast.error(err.message === "Failed" ? "שגיאה ביצירת ההשמה. נסה שוב." : (err.message || "שגיאה ביצירת ההשמה")),
  });

  const statusMutation = useMutation({
    mutationFn: async (payload: { id: string; status: string; checkinNotes?: string; checkoutNotes?: string; actualCheckinTime?: string; actualCheckoutTime?: string }) => {
      const r = await fetch(`/api/boarding/${payload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "שגיאה בעדכון הסטטוס");
      }
      return r.json();
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["boarding"] });
      const prev = queryClient.getQueryData<BoardingStay[]>(["boarding"]);
      queryClient.setQueryData<BoardingStay[]>(["boarding"], (old) =>
        old?.map((s) => s.id === payload.id ? { ...s, status: payload.status } : s) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["boarding"], ctx.prev);
      toast.error(_err instanceof Error && _err.message ? _err.message : "שגיאה בעדכון הסטטוס. נסה שוב.");
    },
    onSuccess: (updatedStay: BoardingStay, payload) => {
      // Merge server response into cache (may include updated notes/times)
      queryClient.setQueryData<BoardingStay[]>(["boarding"], (old) =>
        old?.map((s) => s.id === updatedStay.id ? updatedStay : s) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["boarding-occupancy"] });
      if (payload.status === "checked_in") {
        const stay = checkinStayRef.current;
        const meds = stay?.pet.medications;
        if (shouldCreateMedTasksRef.current && meds && meds.length > 0) {
          Promise.all(
            meds.map((med) =>
              fetchJSON("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: `💊 ${med.medName} — ${stay!.pet.name}`,
                  description: [
                    med.dosage ? `מינון: ${med.dosage}` : "",
                    med.frequency ? `תדירות: ${med.frequency}` : "",
                    med.times ? `שעות: ${med.times}` : "",
                  ].filter(Boolean).join(", "),
                  category: "MEDICATION",
                  priority: "HIGH",
                  relatedEntityType: "boarding_stay",
                  relatedEntityId: stay!.id,
                }),
              })
            )
          ).then(() => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            toast.success(`צ'ק-אין בוצע ✓ — ${meds.length} משימות תרופות נוצרו`);
          }).catch(() => {
            toast.success("צ'ק-אין בוצע בהצלחה");
            toast.error("שגיאה ביצירת משימות תרופות — בדוק ידנית");
          });
        } else {
          toast.success("צ'ק-אין בוצע בהצלחה");
        }
      } else if (payload.status === "checked_out") {
        toast.success("צ'ק-אאוט בוצע בהצלחה");
      }
    },
  });

  const roomMutation = useMutation({
    mutationFn: async ({ id, roomId }: { id: string; roomId: string | null }) => {
      const r = await fetch(`/api/boarding/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "שגיאה בשיוך החדר");
      }
      return r.json();
    },
    onMutate: async ({ id, roomId }) => {
      const occKey = ["boarding-occupancy", occFrom, occTo];
      await queryClient.cancelQueries({ queryKey: ["boarding"] });
      await queryClient.cancelQueries({ queryKey: ["rooms"] });
      await queryClient.cancelQueries({ queryKey: occKey });

      const prev = queryClient.getQueryData<BoardingStay[]>(["boarding"]);
      const prevRooms = queryClient.getQueryData<Room[]>(["rooms"]);
      const prevOcc = queryClient.getQueryData<BoardingStay[]>(occKey);

      const targetRoom = roomId ? (prevRooms?.find((r) => r.id === roomId) ?? null) : null;

      // Update boarding cache
      queryClient.setQueryData<BoardingStay[]>(["boarding"], (old) =>
        old?.map((s) => s.id === id
          ? { ...s, room: targetRoom ? { id: targetRoom.id, name: targetRoom.name } : null }
          : s) ?? []
      );

      // Update occupancy cache — this is what RoomStatusCard actually displays
      queryClient.setQueryData<BoardingStay[]>(occKey, (old) => {
        if (!old) return old;
        // If stay is already in occ cache, update its room
        const existing = old.find((s) => s.id === id);
        if (existing) {
          return old.map((s) => s.id === id
            ? { ...s, room: targetRoom ? { id: targetRoom.id, name: targetRoom.name } : null }
            : s);
        }
        // Stay not in occ cache yet (came from boarding cache) — add it
        const stayFromBoarding = prev?.find((s) => s.id === id);
        if (stayFromBoarding) {
          return [...old, { ...stayFromBoarding, room: targetRoom ? { id: targetRoom.id, name: targetRoom.name } : null }];
        }
        return old;
      });

      // Update rooms cache so grid cards update instantly
      const stayToMove = prev?.find((s) => s.id === id);
      if (stayToMove) {
        queryClient.setQueryData<Room[]>(["rooms"], (old) =>
          old?.map((r) => {
            if (stayToMove.room?.id === r.id) {
              // Remove from old room
              return {
                ...r,
                boardingStays: r.boardingStays.filter((s) => s.id !== id),
                _count: { ...r._count, boardingStays: Math.max(0, r._count.boardingStays - 1) },
              };
            }
            if (roomId && r.id === roomId) {
              // Add to new room
              const roomStay: RoomStay = {
                id: stayToMove.id,
                checkIn: stayToMove.checkIn,
                checkOut: stayToMove.checkOut,
                status: stayToMove.status,
                pet: { id: stayToMove.pet.id, name: stayToMove.pet.name, breed: stayToMove.pet.breed, species: stayToMove.pet.species },
                customer: stayToMove.customer,
              };
              return {
                ...r,
                boardingStays: [...r.boardingStays, roomStay],
                _count: { ...r._count, boardingStays: r._count.boardingStays + 1 },
              };
            }
            return r;
          }) ?? []
        );
      }

      return { prev, prevRooms, prevOcc, occKey };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["boarding"], ctx.prev);
      if (ctx?.prevRooms) queryClient.setQueryData(["rooms"], ctx.prevRooms);
      if (ctx?.prevOcc) queryClient.setQueryData(ctx.occKey, ctx.prevOcc);
      toast.error(_err instanceof Error && _err.message ? _err.message : "שגיאה בשיוך החדר. נסה שוב.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["boarding"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["boarding-occupancy"] });
    },
  });

  const markCleanMutation = useMutation({
    mutationFn: async (roomId: string) => {
      const r = await fetch(`/api/boarding/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "available" }),
      });
      if (!r.ok) throw new Error("שגיאה בעדכון סטטוס חדר");
      return r.json();
    },
    onMutate: async (roomId) => {
      await queryClient.cancelQueries({ queryKey: ["rooms"] });
      const prev = queryClient.getQueryData<Room[]>(["rooms"]);
      queryClient.setQueryData<Room[]>(["rooms"], (old) =>
        old?.map((r) => r.id === roomId ? { ...r, status: "available" } : r) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["rooms"], ctx.prev);
      toast.error("שגיאה בעדכון החדר. נסה שוב.");
    },
    onSuccess: () => toast.success("החדר סומן כנקי"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["rooms"] }),
  });

  const editStayMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; checkIn: string; checkOut: string | null; roomId: string | null; notes: string }) =>
      fetchJSON<BoardingStay>(`/api/boarding/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      setEditStay(null);
      toast.success("ההזמנה עודכנה");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "שגיאה בעדכון ההזמנה";
      toast.error(msg);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["boarding"] });
      queryClient.invalidateQueries({ queryKey: ["boarding-occupancy"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  const extendMutation = useMutation({
    mutationFn: ({ id, checkOut }: { id: string; checkOut: string }) =>
      fetchJSON<BoardingStay>(`/api/boarding/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkOut }),
      }),
    onMutate: async ({ id, checkOut }) => {
      await queryClient.cancelQueries({ queryKey: ["boarding"] });
      const prev = queryClient.getQueryData<BoardingStay[]>(["boarding"]);
      queryClient.setQueryData<BoardingStay[]>(["boarding"], (old) =>
        old?.map((s) => s.id === id ? { ...s, checkOut } : s) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["boarding"], ctx.prev);
      toast.error(_err instanceof Error && _err.message ? _err.message : "שגיאה בעדכון תאריך היציאה. נסה שוב.");
    },
    onSuccess: (updatedStay: BoardingStay) => {
      queryClient.setQueryData<BoardingStay[]>(["boarding"], (old) =>
        old?.map((s) => s.id === updatedStay.id ? updatedStay : s) ?? []
      );
      setExtendDialogStay(null);
      toast.success("תאריך היציאה עודכן בהצלחה");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["boarding"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  const createRoomMutation = useMutation({
    mutationFn: (data: { name: string; capacity: number; type: string; pricePerNight: string | number }) =>
      fetch("/api/boarding/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, pricePerNight: data.pricePerNight !== "" ? Number(data.pricePerNight) : null }),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setNewRoomForm({ name: "", capacity: 1, type: "standard", pricePerNight: "" });
      toast.success("החדר נוצר בהצלחה");
    },
    onError: () => toast.error("שגיאה ביצירת החדר. נסה שוב."),
  });

  const updateRoomMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; capacity: number; type: string; pricePerNight: string | number }) =>
      fetch(`/api/boarding/rooms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, pricePerNight: data.pricePerNight !== "" ? Number(data.pricePerNight) : null }),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setEditingRoomId(null);
      toast.success("החדר עודכן בהצלחה");
    },
    onError: () => toast.error("שגיאה בעדכון החדר. נסה שוב."),
  });

  const deleteRoomMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/boarding/rooms/${id}`, { method: "DELETE" })
        .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה במחיקת החדר"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("החדר נמחק");
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה במחיקת החדר. נסה שוב."),
  });

  const deleteStayMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/boarding/${id}`, { method: "DELETE" })
        .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה במחיקת השהות"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boarding"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("השהות נמחקה");
      setDeleteDialogStay(null);
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה במחיקת השהות"),
  });

  function startEditRoom(room: Room) {
    setEditingRoomId(room.id);
    setEditRoomForm({ name: room.name, capacity: room.capacity, type: room.type, pricePerNight: room.pricePerNight ?? "" });
  }

  // ── Check-in/out via dialog ──

  const handleCheckin = useCallback((id: string) => {
    const stay = stays.find((s) => s.id === id);
    if (stay) setCheckinDialogStay(stay);
  }, [stays]);

  const handleCheckout = useCallback((id: string) => {
    const stay = stays.find((s) => s.id === id);
    if (stay) setCheckoutDialogStay(stay);
  }, [stays]);

  const handleMarkClean = useCallback((id: string) => {
    markCleanMutation.mutate(id);
  }, [markCleanMutation]);

  const handleExtend = (id: string) => {
    const stay = stays.find((s) => s.id === id);
    if (stay) setExtendDialogStay(stay);
  };

  const confirmCheckin = (data: { actualTime: string; notes: string; createMedTasks: boolean }) => {
    if (!checkinDialogStay) return;
    checkinStayRef.current = checkinDialogStay;
    shouldCreateMedTasksRef.current = data.createMedTasks;
    const stayId = checkinDialogStay.id;
    const dateStr = toDateStr(checkinDialogStay.checkIn);
    setCheckinDialogStay(null); // Close immediately for responsive UX
    statusMutation.mutate({
      id: stayId,
      status: "checked_in",
      checkinNotes: data.notes || undefined,
      actualCheckinTime: new Date(`${dateStr}T${data.actualTime}:00`).toISOString(),
    });
  };

  const confirmCheckout = (data: { notes: string }) => {
    if (!checkoutDialogStay) return;
    const stayId = checkoutDialogStay.id;
    setCheckoutDialogStay(null); // Close immediately for responsive UX
    statusMutation.mutate({
      id: stayId,
      status: "checked_out",
      checkoutNotes: data.notes || undefined,
      actualCheckoutTime: new Date().toISOString(),
    });
  };

  // ── DnD handlers ──

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveStayId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveStayId(null);
    const { active, over } = event;
    if (!over) return;

    const stayId = String(active.id);
    const targetId = String(over.id);
    const stay = stays.find((s) => s.id === stayId);
    if (!stay) return;

    const allStayIds = new Set(stays.map(s => s.id));

    if (allStayIds.has(targetId)) {
      // Dropped onto another stay — check if same room (reorder) or different room (move)
      const overStay = stays.find(s => s.id === targetId);
      const overRoomId = overStay?.room?.id ?? null;
      const activeRoomId = stay.room?.id ?? null;

      if (overRoomId === activeRoomId) {
        // Intra-room reorder
        const roomKey = overRoomId ?? "unassigned";
        setRoomSlotOrders(prev => {
          const roomStayIds = overRoomId
            ? stays.filter(s => s.room?.id === overRoomId).map(s => s.id)
            : stays.filter(s => !s.room).map(s => s.id);
          const current = prev[roomKey] ?? roomStayIds;
          const oldIndex = current.indexOf(stayId);
          const newIndex = current.indexOf(targetId);
          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
          return { ...prev, [roomKey]: arrayMove(current, oldIndex, newIndex) };
        });
      } else {
        // Cross-room move
        roomMutation.mutate({ id: stayId, roomId: overRoomId });
        // Reset slot order for affected rooms
        setRoomSlotOrders(prev => {
          const next = { ...prev };
          if (activeRoomId) delete next[activeRoomId];
          if (overRoomId) delete next[overRoomId];
          return next;
        });
      }
    } else {
      // Dropped onto a room card (not a stay)
      const newRoomId = targetId === "unassigned" ? null : targetId;
      const currentRoomId = stay.room?.id ?? null;
      if (newRoomId === currentRoomId) return;
      roomMutation.mutate({ id: stayId, roomId: newRoomId });
      setRoomSlotOrders(prev => {
        const next = { ...prev };
        if (currentRoomId) delete next[currentRoomId];
        if (newRoomId) delete next[newRoomId];
        return next;
      });
    }
  }, [stays, roomMutation]);

  // ── Computed data ──

  const activeStays = stays.filter((s) => ACTIVE_STATUSES.includes(s.status));
  const today = toDateStr(new Date());

  const overdueStays = useMemo(() =>
    activeStays.filter((s) => isOverdue(s, settings.boardingCheckOutTime || "11:00")),
    [activeStays, settings.boardingCheckOutTime]
  );

  const tabStays: Record<TabKey, BoardingStay[]> = {
    active: [...activeStays].sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()),
    checkin_today: activeStays.filter((s) => toDateStr(s.checkIn) === today && s.status === "reserved").sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()),
    checkout_today: activeStays.filter((s) => s.checkOut && toDateStr(s.checkOut) === today && s.status === "checked_in").sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()),
    history: stays.filter((s) => !ACTIVE_STATUSES.includes(s.status)).sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime()),
  };

  const checkinTodayCount = tabStays.checkin_today.length;
  const checkoutTodayCount = tabStays.checkout_today.length;

  const searchNorm = normSearch(staySearch);

  // Room map follows the same search: only rooms with a matching stay (or a matching room name).
  const occStaysShown = useMemo(
    () => (searchNorm ? occStays.filter((s) => stayMatchesSearch(s, searchNorm)) : occStays),
    [occStays, searchNorm],
  );
  const gridRooms = useMemo(
    () =>
      searchNorm
        ? rooms.filter((r) => normSearch(r.name).includes(searchNorm) || occStaysShown.some((s) => s.room?.id === r.id))
        : rooms,
    [rooms, searchNorm, occStaysShown],
  );

  const displayedStays = useMemo(() => {
    let base = tabStays[activeTab];
    // Filter by selected calendar date
    if (selectedCalendarDate) {
      base = base.filter(
        (s) =>
          toDateStr(s.checkIn) <= selectedCalendarDate &&
          (!s.checkOut || toDateStr(s.checkOut) >= selectedCalendarDate)
      );
    }
    if (!searchNorm) return base;
    return base.filter((s) => stayMatchesSearch(s, searchNorm));
  }, [tabStays, activeTab, searchNorm, selectedCalendarDate]);

  // Room availability for selected dates in new stay modal
  const roomAvailability = useMemo(() => {
    if (!form.checkIn || !form.checkOut) return {} as Record<string, boolean>;
    return Object.fromEntries(
      rooms.map((room) => {
        // Stays share a room only if they share a NIGHT (check-out day = turnover day).
        const overlapping = stays.filter(
          (s) =>
            s.room?.id === room.id &&
            ACTIVE_STATUSES.includes(s.status) &&
            staysOverlap(s, { checkIn: form.checkIn, checkOut: form.checkOut })
        ).length;
        return [room.id, overlapping < room.capacity];
      })
    );
  }, [form.checkIn, form.checkOut, rooms, stays]);

  // Dogs occupying each room today (Israel day) — for the room dropdown before dates are chosen.
  const roomTodayCount = useMemo(() => {
    const todayKey = israelDayKey(new Date());
    const counts: Record<string, number> = {};
    for (const s of stays) {
      if (!s.room || !ACTIVE_STATUSES.includes(s.status)) continue;
      if (!staysOverlap(s, { checkIn: todayKey, checkOut: todayKey })) continue;
      counts[s.room.id] = (counts[s.room.id] ?? 0) + 1;
    }
    return counts;
  }, [stays]);

  const draggedStay = activeStayId ? stays.find((s) => s.id === activeStayId) : null;

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "active", label: "הכל", count: activeStays.length },
    { key: "checkin_today", label: "צ׳ק-אין היום", count: checkinTodayCount },
    { key: "checkout_today", label: "צ׳ק-אאוט היום", count: checkoutTodayCount },
    { key: "history", label: "היסטוריה" },
  ];

  // ── Occupancy checker computation ──
  const occByRoom = useMemo(() => {
    if (!occFrom || !occTo || occStays.length === 0) return {} as Record<string, number>;
    // Build day list ("YYYY-MM-DD" keys)
    const days: string[] = [];
    const cursor = new Date(occFrom + "T00:00:00Z");
    const last = new Date(occTo + "T00:00:00Z");
    while (cursor <= last && days.length < 400) { days.push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
    // Per room: max concurrent stays across all days (a stay occupies [check-in day, check-out day))
    const result: Record<string, number> = {};
    for (const room of rooms) {
      const roomStays = occStays.filter(s => s.room?.id === room.id);
      let maxConcurrent = 0;
      for (const day of days) {
        const concurrent = roomStays.filter(s => staysOverlap(s, { checkIn: day, checkOut: day })).length;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
      }
      result[room.id] = maxConcurrent;
    }
    return result;
  }, [occStays, rooms, occFrom, occTo]);

  const occUnassigned = useMemo(() =>
    occStays.filter(s => !s.room).length,
  [occStays]);

  const occTotalDogs = useMemo(() =>
    occStays.length,
  [occStays]);

  // ── Room stats for header ──
  const availableRooms = rooms.filter((r) => getRoomDisplayStatus(r) === "available").length;
  const occupiedRooms = rooms.filter((r) => getRoomDisplayStatus(r) === "occupied").length;
  const cleaningRooms = rooms.filter((r) => getRoomDisplayStatus(r) === "needs_cleaning").length;

  return (
    <div>
      <BoardingTabs />
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="page-title">פנסיון</h1>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["boarding"] });
            queryClient.invalidateQueries({ queryKey: ["rooms"] });
            queryClient.invalidateQueries({ queryKey: ["boarding-occupancy"] });
          }}
          title="רענן נתונים"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-petra-muted hover:text-petra-text hover:bg-slate-100 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isBoardingFetching ? "animate-spin" : ""}`} />
        </button>
        <p className="text-sm text-petra-muted">
          {activeStays.length} שהיות פעילות · {rooms.length} חדרים
        </p>
        <div className="flex gap-2">
          {activeStays.filter((s) => s.status === "checked_in").length > 0 && (() => {
            const checkedIn = activeStays.filter((s) => s.status === "checked_in");
            const todayStr2 = new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
            const lines = [
              `🏨 סבב בוקר פנסיון — ${todayStr2}`,
              `${checkedIn.length} חיות מאוכסנות`,
              "",
            ];
            for (const s of checkedIn) {
              lines.push(`🐾 *${s.pet.name}*${s.pet.breed ? ` (${s.pet.breed})` : ""} — ${s.room?.name || "ללא חדר"}`);
              if (s.pet.health?.allergies) lines.push(`  ⚠️ אלרגיות: ${s.pet.health.allergies}`);
              if (s.pet.health?.medicalConditions) lines.push(`  🏥 מצב רפואי: ${s.pet.health.medicalConditions}`);
              if (s.pet.medications && s.pet.medications.length > 0) {
                s.pet.medications.forEach((m) => {
                  lines.push(`  💊 ${m.medName}${m.dosage ? ` · ${m.dosage}` : ""}${m.times ? ` · ${m.times}` : ""}`);
                });
              }
              if (s.pet.behavior?.dogAggression || s.pet.behavior?.humanAggression) {
                lines.push(`  🔴 תוקפנות!`);
              }
              if (s.pet.behavior?.separationAnxiety) lines.push(`  😰 חרדת נטישה`);
              if (s.checkOut) lines.push(`  📅 יציאה: ${new Date(s.checkOut).toLocaleDateString("he-IL")}`);
              lines.push("");
            }
            const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(lines.join("\n"))}`;
            return (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary hidden sm:flex"
                title="שתף סבב בוקר"
              >
                <Share2 className="w-4 h-4" />
                סבב בוקר
              </a>
            );
          })()}
          {activeStays.filter((s) => s.status === "checked_in" && (s.pet.foodNotes || (s.pet.medications && s.pet.medications.length > 0))).length > 0 && (() => {
            const checkedIn = activeStays.filter((s) => s.status === "checked_in");
            const todayStr3 = new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
            const lines = [
              `🍽️ סבב האכלה — ${todayStr3}`,
              "",
            ];
            for (const s of checkedIn) {
              const hasFoodInfo = s.pet.foodNotes || (s.pet.medications && s.pet.medications.length > 0) || s.pet.health?.allergies;
              if (!hasFoodInfo) continue;
              lines.push(`🐾 *${s.pet.name}* — ${s.room?.name || "ללא חדר"}`);
              if (s.pet.health?.allergies) lines.push(`  ⚠️ אלרגיות: ${s.pet.health.allergies}`);
              if (s.pet.foodNotes) lines.push(`  🍗 ${s.pet.foodNotes}`);
              if (s.pet.medications && s.pet.medications.length > 0) {
                s.pet.medications.forEach((m) => {
                  const parts = [m.medName];
                  if (m.dosage) parts.push(m.dosage);
                  if (m.times) parts.push(m.times);
                  lines.push(`  💊 ${parts.join(" · ")}`);
                });
              }
              lines.push("");
            }
            const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(lines.join("\n").trim())}`;
            return (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary hidden sm:flex"
                title="סבב האכלה"
              >
                <Share2 className="w-4 h-4" />
                האכלה
              </a>
            );
          })()}
          {canExportData && (
          <a
            href="/api/boarding/export"
            download
            className="btn-secondary hidden sm:flex"
            title="ייצוא יומי לאקסל"
          >
            <ClipboardList className="w-4 h-4" />
            ייצוא יומי
          </a>
          )}
          {canManageBoarding && (
          <button className="btn-secondary" onClick={() => setShowRoomsManager(true)}>
            <Settings2 className="w-4 h-4" />ניהול חדרים
          </button>
          )}
<button className="btn-primary" onClick={() => { setForm((f) => ({ ...f, pricePerNight: settings.boardingPricePerNight || 150, checkInTime: settings.boardingCheckInTime || "14:00", checkOutTime: settings.boardingCheckOutTime || "11:00" })); setShowNewStay(true); }}>
            <Plus className="w-4 h-4" />שהייה חדשה
          </button>
        </div>
      </div>

      {/* Vaccination Alert Banner */}
      <VaccinationAlertBanner />

      {/* Overdue Banner */}
      {overdueStays.length > 0 && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border-2 border-red-300 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-red-700">
              {overdueStays.length} שהיות עם איחור בצ׳ק-אאוט
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
              {overdueStays.map((s) => {
                const checkOutDate = new Date(s.checkOut!);
                const [h, m] = (settings.boardingCheckOutTime || "11:00").split(":").map(Number);
                checkOutDate.setHours(h, m, 0, 0);
                const hoursOverdue = Math.floor((Date.now() - checkOutDate.getTime()) / (1000 * 60 * 60));
                return (
                  <span key={s.id} className="text-xs text-red-600">
                    {s.pet.name} ({hoursOverdue}{hoursOverdue === 1 ? " שעה" : " שעות"} איחור)
                  </span>
                );
              })}
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTab("active");
              setTimeout(() => staysListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
            }}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
          >
            טפל עכשיו
          </button>
        </div>
      )}

      {/* Search — above room map */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-petra-muted pointer-events-none" />
        <input
          type="text"
          value={staySearch}
          onChange={(e) => setStaySearch(e.target.value)}
          placeholder="חפש לפי חיה, לקוח, חדר..."
          className="input pr-8 text-sm h-8"
        />
        {staySearch && (
          <button
            onClick={() => setStaySearch("")}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-petra-muted hover:text-petra-text"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* View Toggle + Occupancy strip */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-petra-text">מפת חדרים</h2>
          {/* ── Occupancy checker strip ── */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Calendar className="w-3.5 h-3.5 text-petra-muted flex-shrink-0" />
            <input
              type="date" lang="he" value={occDraftFrom}
              onChange={e => setOccDraftFrom(e.target.value)}
              className="text-xs border border-petra-border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand-400 h-7 w-32"
            />
            <span className="text-xs text-petra-muted">—</span>
            <input
              type="date" lang="he" value={occDraftTo} min={occDraftFrom}
              onChange={e => setOccDraftTo(e.target.value)}
              className="text-xs border border-petra-border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand-400 h-7 w-32"
            />
            <button
              onClick={() => { setOccFrom(occDraftFrom); setOccTo(occDraftTo); }}
              className="h-7 px-2.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition-colors flex-shrink-0"
            >
              הצג
            </button>
            {/* Shift the whole window by its own length, forwards or back */}
            {(() => {
              const shiftOcc = (dir: -1 | 1) => {
                const from = new Date(`${occDraftFrom}T00:00:00`);
                const to = new Date(`${occDraftTo}T00:00:00`);
                if (isNaN(from.getTime()) || isNaN(to.getTime())) return;
                const span = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000));
                from.setDate(from.getDate() + dir * span);
                to.setDate(to.getDate() + dir * span);
                const f = from.toLocaleDateString("en-CA");
                const t = to.toLocaleDateString("en-CA");
                setOccDraftFrom(f); setOccDraftTo(t);
                setOccFrom(f); setOccTo(t);
              };
              const jumpToday = () => {
                const from = new Date(`${occDraftFrom}T00:00:00`);
                const to = new Date(`${occDraftTo}T00:00:00`);
                const span = !isNaN(from.getTime()) && !isNaN(to.getTime())
                  ? Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000))
                  : 7;
                const start = new Date();
                const end = new Date();
                end.setDate(end.getDate() + span);
                const f = start.toLocaleDateString("en-CA");
                const t = end.toLocaleDateString("en-CA");
                setOccDraftFrom(f); setOccDraftTo(t);
                setOccFrom(f); setOccTo(t);
              };
              return (
                <>
                  <button type="button" onClick={() => shiftOcc(-1)} title="תקופה אחורה"
                    className="h-7 w-7 rounded-lg border border-petra-border text-petra-muted hover:bg-slate-50 flex-shrink-0">‹</button>
                  <button type="button" onClick={() => shiftOcc(1)} title="תקופה קדימה"
                    className="h-7 w-7 rounded-lg border border-petra-border text-petra-muted hover:bg-slate-50 flex-shrink-0">›</button>
                  <button type="button" onClick={jumpToday} title="חזרה להיום"
                    className="h-7 px-2 rounded-lg bg-orange-50 text-orange-700 text-xs font-medium hover:bg-orange-100 flex-shrink-0">היום</button>
                </>
              );
            })()}
            {occLoading && <span className="text-xs text-petra-muted animate-pulse">טוען...</span>}
            {!occLoading && occFrom && occTo && (
              <div className="flex items-center gap-1">
                {occTotalDogs === 0 ? (
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">✓ פנוי לגמרי</span>
                ) : (
                  <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg">
                    {occTotalDogs} כלבים
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewMode === "timeline" && (
            <div className="flex items-center gap-1 text-xs">
              {(() => {
                const todayYmd = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
                const base = timelineStart || todayYmd;
                const shift = (d: number) => {
                  const dt = new Date(base + "T00:00:00"); dt.setDate(dt.getDate() + d);
                  const ymd = dt.toLocaleDateString("en-CA");
                  setTimelineStart(ymd === todayYmd ? "" : ymd);
                };
                return (
                  <>
                    <button type="button" onClick={() => shift(-7)} className="px-1.5 py-1 rounded-md hover:bg-slate-100 text-petra-muted" title="שבוע אחורה">‹</button>
                    <input
                      type="date" lang="he"
                      className="input !py-1 !px-2 text-xs w-[8.5rem]"
                      value={base}
                      onChange={(e) => setTimelineStart(e.target.value && e.target.value !== todayYmd ? e.target.value : "")}
                      title="תאריך התחלה של ציר הזמן (אפשר גם אחורה)"
                    />
                    <button type="button" onClick={() => shift(7)} className="px-1.5 py-1 rounded-md hover:bg-slate-100 text-petra-muted" title="שבוע קדימה">›</button>
                    {timelineStart && (
                      <button type="button" onClick={() => setTimelineStart("")} className="px-2 py-1 rounded-md bg-orange-50 text-orange-700 font-medium hover:bg-orange-100">היום</button>
                    )}
                  </>
                );
              })()}
            </div>
          )}
          {viewMode === "timeline" && (
            <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5 text-xs">
              {[14, 30].map((n) => (
                <button
                  key={n}
                  onClick={() => setTimelineDays(n)}
                  className={cn(
                    "px-2 py-1 rounded-md font-medium transition-all",
                    timelineDays === n ? "bg-white shadow-sm text-petra-text" : "text-petra-muted hover:text-petra-text"
                  )}
                >
                  {n} ימים
                </button>
              ))}
            </div>
          )}
          {viewMode === "grid" && (
            <button
              onClick={() => window.print()}
              className="btn-primary flex items-center gap-1.5 text-sm"
              title="הדפס דוח חדרים"
            >
              <Printer className="w-3.5 h-3.5" />הדפסה
            </button>
          )}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => { setViewMode("grid"); setSelectedCalendarDate(null); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                viewMode === "grid" ? "bg-white shadow-sm text-petra-text" : "text-petra-muted hover:text-petra-text"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />כרטיסים
            </button>
            <button
              onClick={() => { setViewMode("timeline"); setSelectedCalendarDate(null); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                viewMode === "timeline" ? "bg-white shadow-sm text-petra-text" : "text-petra-muted hover:text-petra-text"
              )}
            >
              <GanttChart className="w-3.5 h-3.5" />ציר זמן
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                viewMode === "calendar" ? "bg-white shadow-sm text-petra-text" : "text-petra-muted hover:text-petra-text"
              )}
            >
              <Calendar className="w-3.5 h-3.5" />זמינות
            </button>
          </div>
        </div>
      </div>

      {/* Room Stats Bar — below room map heading + dates */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-50">
            <Check className="w-4 h-4 text-green-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-petra-text">{availableRooms}</p>
            <p className="text-[10px] text-petra-muted">פנויים</p>
          </div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-orange-50">
            <PawPrint className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-petra-text">{occupiedRooms}</p>
            <p className="text-[10px] text-petra-muted">תפוסים</p>
          </div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-yellow-50">
            <Sparkles className="w-4 h-4 text-yellow-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-petra-text">{cleaningRooms}</p>
            <p className="text-[10px] text-petra-muted">דרוש ניקיון</p>
          </div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-50">
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-petra-text">{overdueStays.length}</p>
            <p className="text-[10px] text-petra-muted">איחור צ׳ק-אאוט</p>
          </div>
        </div>
      </div>

      {/* ── Grid View (with DnD) ── */}
      {viewMode === "grid" && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="mb-8">
            {rooms.length === 0 ? (
              <div className="card p-8 text-center">
                <div className="empty-state-icon mx-auto mb-3">
                  <Hotel className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm text-petra-muted mb-3">אין חדרים מוגדרים במערכת</p>
                {canManageBoarding && (
                <button className="btn-primary mx-auto" onClick={() => setShowRoomsManager(true)}>
                  <Plus className="w-4 h-4" />הוסף חדר ראשון
                </button>
                )}
              </div>
            ) : (
              <>
              <div className="boarding-print-header">
                <img src="/petra-logo.png" alt="Petra" style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 6, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#1e293b" }}>מפת חדרי פנסיון</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>הופק: {new Date().toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" })}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-print-rooms>
                {/* Unassigned stays drop zone — first = rightmost in RTL */}
                <UnassignedGridCard
                  stays={occStaysShown.filter((s) => !s.room)}
                  onCheckin={handleCheckin}
                  onCheckout={handleCheckout}
                />
                {gridRooms.map((room) => (
                  <RoomStatusCard
                    key={room.id}
                    room={room}
                    onCheckin={handleCheckin}
                    onCheckout={handleCheckout}
                    onMarkClean={handleMarkClean}
                    onOpenStay={setEditStay}
                    occPeriodStays={occStaysShown.filter(s => s.room?.id === room.id)}
                    sortedStayIds={roomSlotOrders[room.id] ?? occStaysShown.filter(s => s.room?.id === room.id).map(s => s.id)}
                    highlight={!!searchNorm}
                  />
                ))}
              </div>
              {searchNorm && gridRooms.length === 0 && (
                <p className="text-sm text-petra-muted text-center py-4">לא נמצאו חדרים עם &quot;{staySearch.trim()}&quot; בתאריכים שנבחרו</p>
              )}
              </>
            )}
          </div>
          <DragOverlay>
            {draggedStay ? (
              <div className="card p-2.5 w-[200px] rotate-2 shadow-modal cursor-grabbing">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
                    <PawPrint className="w-3.5 h-3.5 text-brand-500" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-petra-text">{draggedStay.pet.name}</div>
                    <div className="text-[10px] text-petra-muted">{draggedStay.customer?.name ?? "כלב שירות"}</div>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* ── Timeline View ── */}
      {viewMode === "timeline" && (
        <div className="mb-8">
          {rooms.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm text-petra-muted">אין חדרים מוגדרים</p>
            </div>
          ) : (
            <TimelineView rooms={rooms} stays={stays} search={searchNorm} onOpenStay={setEditStay} numDays={timelineDays} startDate={timelineStart ? new Date(timelineStart + "T00:00:00") : undefined} />
          )}
        </div>
      )}

      {/* ── Calendar / Availability View ── */}
      {viewMode === "calendar" && (
        <OccupancyCalendar
          stays={stays}
          rooms={rooms}
          onSelectDate={setSelectedCalendarDate}
          selectedDate={selectedCalendarDate}
          calendarMonth={calendarMonth}
          onChangeMonth={setCalendarMonth}
        />
      )}

      {/* ── Stays List with Tabs ── */}
      <div ref={staysListRef}>
        {/* Date filter banner */}
        {selectedCalendarDate && (
          <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-brand-50 border border-brand-100 rounded-xl text-sm text-brand-700">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-brand-500" />
            <span className="flex-1">
              מציג שהיות ל-{new Date(selectedCalendarDate).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })}
            </span>
            <button
              onClick={() => setSelectedCalendarDate(null)}
              className="text-brand-400 hover:text-brand-700 transition-colors"
              aria-label="נקה סינון"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-petra-text">לוח שהיות</h2>
        </div>

        <div className="flex gap-1 mb-4 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
                activeTab === tab.key
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-petra-muted hover:bg-slate-100 hover:text-petra-text"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                    activeTab === tab.key
                      ? "bg-white/20 text-white"
                      : tab.count > 0 && (tab.key === "checkin_today" || tab.key === "checkout_today")
                      ? "bg-red-100 text-red-600"
                      : "bg-slate-100 text-slate-500"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <PetraLoader />
        ) : isError ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-sm text-petra-muted">שגיאה בטעינת נתוני הפנסיון. נסה לרענן את הדף.</p>
          </div>
        ) : displayedStays.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Hotel className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-petra-muted">
              {staySearch.trim()
                ? "לא נמצאו שהיות תואמות"
                : activeTab === "checkin_today" ? "אין צ׳ק-אינים מתוכננים להיום"
                : activeTab === "checkout_today" ? "אין צ׳ק-אאוטים מתוכננים להיום"
                : activeTab === "active" ? "אין שהיות פעילות"
                : "אין שהיות בהיסטוריה"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedStays.map((stay) => (
              <div key={stay.id}>
                <StayRow
                  stay={stay}
                  onCheckin={handleCheckin}
                  onCheckout={handleCheckout}
                  onExtend={handleExtend}
                  onDelete={(s) => setDeleteDialogStay(s)}
                  settings={settings}
                />
                {(stay.status === "checked_in" || stay.status === "reserved") && (
                  <div className="mr-14 mt-1 mb-2 flex items-center gap-4 flex-wrap">
                    <button
                      onClick={() => setCareLogStay({ id: stay.id, petName: stay.pet.name })}
                      className="text-xs text-petra-muted hover:text-brand-600 flex items-center gap-1 transition-colors"
                    >
                      <ClipboardList className="w-3 h-3" />
                      יומן טיפול
                    </button>
                    {stay.pet.serviceDogProfile && (
                      <TrainingMinutesField stay={stay} />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Service Dogs in Boarding ── */}
      {serviceDogsInBoarding.length > 0 && (
        <div className="mt-6 card p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2 text-blue-700">
            <ShieldAlert className="w-4 h-4 text-blue-500" />
            כלבי שירות בפנסיון
            <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {serviceDogsInBoarding.length} כלבים
            </span>
          </h2>
          <div className="divide-y">
            {serviceDogsInBoarding.map((dog) => (
              <div key={dog.id} className="flex items-center justify-between py-2.5 gap-3">
                <div>
                  <p className="text-sm font-medium">{dog.pet.name}</p>
                  {dog.pet.breed && <p className="text-xs text-petra-muted">{dog.pet.breed}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-petra-muted">{dog.trainingTotalHours.toFixed(0)} שעות אימון</span>
                  <a
                    href={`/service-dogs/${dog.id}`}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    תיק כלב
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Care Log Modal ── */}
      {careLogStay && (
        <CareLogModal
          stayId={careLogStay.id}
          petName={careLogStay.petName}
          onClose={() => setCareLogStay(null)}
        />
      )}

      {/* ── Rooms Manager Modal ── */}
      {showRoomsManager && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => { setShowRoomsManager(false); setEditingRoomId(null); }} />
          <div className="modal-content max-w-lg mx-4 flex flex-col max-h-[85dvh] overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-petra-text">ניהול חדרים</h2>
                <p className="text-sm text-petra-muted mt-0.5">הוסף, ערוך או מחק חדרים</p>
              </div>
              <button
                onClick={() => { setShowRoomsManager(false); setEditingRoomId(null); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pt-4 pb-6">
            <div className="space-y-2 mb-6">
              {rooms.length === 0 ? (
                <p className="text-sm text-petra-muted text-center py-4">אין חדרים עדיין</p>
              ) : (
                rooms.map((room) => (
                  <div key={room.id} className="card p-3">
                    {editingRoomId === room.id ? (
                      <div className="space-y-2">
                        <input
                          className="input"
                          placeholder="שם החדר"
                          value={editRoomForm.name}
                          onChange={(e) => setEditRoomForm({ ...editRoomForm, name: e.target.value })}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="label text-[11px]">קיבולת</label>
                            <input
                              type="number"
                              min={1}
                              className="input"
                              value={editRoomForm.capacity}
                              onChange={(e) => setEditRoomForm({ ...editRoomForm, capacity: Number(e.target.value) })}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="label text-[11px]">סוג</label>
                            <select
                              className="input"
                              value={editRoomForm.type}
                              onChange={(e) => setEditRoomForm({ ...editRoomForm, type: e.target.value })}
                            >
                              <option value="standard">רגיל</option>
                              <option value="premium">פרמיום</option>
                              <option value="suite">סוויט</option>
                            </select>
                          </div>
                          <div className="flex-1">
                            <label className="label text-[11px]">מחיר/לילה (₪)</label>
                            <input
                              type="number"
                              min={0}
                              className="input"
                              placeholder="אופציונלי"
                              value={editRoomForm.pricePerNight}
                              onChange={(e) => setEditRoomForm({ ...editRoomForm, pricePerNight: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            className="btn-primary text-xs flex-1"
                            disabled={!editRoomForm.name.trim() || updateRoomMutation.isPending}
                            onClick={() => updateRoomMutation.mutate({ id: room.id, ...editRoomForm })}
                          >
                            <Check className="w-3.5 h-3.5" />
                            {updateRoomMutation.isPending ? "שומר..." : "שמור"}
                          </button>
                          <button
                            className="btn-secondary text-xs"
                            onClick={() => setEditingRoomId(null)}
                          >
                            ביטול
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <DoorOpen className="w-4 h-4 text-brand-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-petra-text">{room.name}</span>
                          <span className="text-xs text-petra-muted mr-2">· קיבולת {room.capacity}</span>
                          <span className="text-xs text-petra-muted">· {room._count.boardingStays} פעילות</span>
                          {room.pricePerNight != null && (
                            <span className="text-xs text-brand-600 mr-2">· ₪{room.pricePerNight}/לילה</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted hover:text-petra-text transition-colors"
                            onClick={() => startEditRoom(room)}
                            title="ערוך"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-petra-muted hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            onClick={() => deleteRoomMutation.mutate(room.id)}
                            disabled={room._count.boardingStays > 0 || deleteRoomMutation.isPending}
                            title={room._count.boardingStays > 0 ? "לא ניתן למחוק חדר עם שהיות פעילות" : "מחק חדר"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-semibold text-petra-text mb-3">הוסף חדר חדש</h3>
              <div className="space-y-3">
                <div>
                  <label className="label">שם החדר *</label>
                  <input
                    className="input"
                    placeholder='לדוגמה: חדר 5, חדר פרמיום...'
                    value={newRoomForm.name}
                    onChange={(e) => setNewRoomForm({ ...newRoomForm, name: e.target.value })}
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="label">קיבולת</label>
                    <input
                      type="number"
                      min={1}
                      className="input"
                      value={newRoomForm.capacity}
                      onChange={(e) => setNewRoomForm({ ...newRoomForm, capacity: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="label">סוג</label>
                    <select
                      className="input"
                      value={newRoomForm.type}
                      onChange={(e) => setNewRoomForm({ ...newRoomForm, type: e.target.value })}
                    >
                      <option value="standard">רגיל</option>
                      <option value="premium">פרמיום</option>
                      <option value="suite">סוויט</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="label">מחיר/לילה (₪)</label>
                    <input
                      type="number"
                      min={0}
                      className="input"
                      placeholder="אופציונלי"
                      value={newRoomForm.pricePerNight}
                      onChange={(e) => setNewRoomForm({ ...newRoomForm, pricePerNight: e.target.value })}
                    />
                  </div>
                </div>
                <button
                  className="btn-primary w-full"
                  disabled={!newRoomForm.name.trim() || createRoomMutation.isPending}
                  onClick={() => createRoomMutation.mutate(newRoomForm)}
                >
                  <Plus className="w-4 h-4" />
                  {createRoomMutation.isPending ? "מוסיף..." : "הוסף חדר"}
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* ── New Stay Modal ── */}
      {showNewStay && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setShowNewStay(false)} />
          <div className="modal-content max-w-lg mx-4 flex flex-col max-h-[90dvh] overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-petra-text">שהייה חדשה</h2>
                <p className="text-sm text-petra-muted mt-0.5">הוסף שהייה לפנסיון</p>
              </div>
              <button
                onClick={() => setShowNewStay(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pt-4 pb-2">

            <div className="space-y-4">
              {/* Mode toggle: לקוח רגיל / כלב שירות */}
              <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => { setServiceDogMode(false); setForm({ ...form, petIds: [], customerId: "" }); setPickedCustomer(null); }}
                  className={cn("flex-1 text-xs py-1.5 rounded-md font-medium transition-colors", !serviceDogMode ? "bg-white shadow-sm text-petra-text" : "text-petra-muted hover:text-petra-text")}
                >
                  לקוח רגיל
                </button>
                <button
                  type="button"
                  onClick={() => { setServiceDogMode(true); setForm({ ...form, petIds: [], customerId: "" }); setPickedCustomer(null); setServiceDogSearch(""); }}
                  className={cn("flex-1 text-xs py-1.5 rounded-md font-medium transition-colors", serviceDogMode ? "bg-white shadow-sm text-petra-text" : "text-petra-muted hover:text-petra-text")}
                >
                  כלב שירות
                </button>
              </div>

              {/* Customer selector */}
              {!serviceDogMode && (
              <div>
                <label className="label">לקוח *</label>
                {form.customerId && selectedCustomer ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-brand-50 border border-brand-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-sm flex-shrink-0">
                        {selectedCustomer.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-petra-text">{selectedCustomer.name}</p>
                        <p className="text-[10px] text-petra-muted" dir="ltr">{selectedCustomer.phone}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setForm({ ...form, customerId: "", petIds: [] }); setPickedCustomer(null); }}
                      className="text-xs text-brand-500 hover:text-brand-700 font-medium"
                    >
                      שנה
                    </button>
                  </div>
                ) : (
                  <CustomerPicker
                    value={null}
                    autoFocus
                    onSelect={(c, matchedPetId) => {
                      setPickedCustomer(c);
                      setForm({ ...form, customerId: c.id, petIds: matchedPetId ? [matchedPetId] : [], pricePerNight: settings.boardingPricePerNight || 150 });
                    }}
                  />
                )}
              </div>
              )}

              {/* Service dog selector */}
              {serviceDogMode && (
              <div>
                <label className="label">כלב שירות *</label>
                {selectedServiceDog ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-brand-50 border border-brand-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-sm flex-shrink-0">
                        🐕
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-petra-text">{selectedServiceDog.pet.name}</p>
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", selectedServiceDog.phase === "CERTIFIED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
                            {selectedServiceDog.phase === "CERTIFIED" ? "מוסמך" : "בהכשרה"}
                          </span>
                        </div>
                        {selectedServiceDog.pet.breed && <p className="text-[10px] text-petra-muted">{selectedServiceDog.pet.breed}</p>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, petIds: [] })}
                      className="text-xs text-brand-500 hover:text-brand-700 font-medium"
                    >
                      שנה
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="relative mb-2">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        className="input pr-10"
                        placeholder="חיפוש לפי שם או גזע..."
                        value={serviceDogSearch}
                        onChange={(e) => setServiceDogSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                  <div className="max-h-48 overflow-y-auto border border-petra-border rounded-xl divide-y divide-petra-border">
                    {filteredServiceDogs.length === 0 ? (
                      <div className="py-4 text-center text-sm text-petra-muted">{serviceDogsList.length === 0 ? "אין כלבי שירות פעילים" : "לא נמצאו תוצאות"}</div>
                    ) : (
                      filteredServiceDogs.map((sd) => (
                        <button
                          key={sd.id}
                          type="button"
                          onClick={() => setForm({ ...form, petIds: [sd.pet.id], customerId: "", pricePerNight: settings.boardingPricePerNight || 150 })}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 transition-colors text-right"
                        >
                          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-sm flex-shrink-0">🐕</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-petra-text truncate">{sd.pet.name}</p>
                            {sd.pet.breed && <p className="text-[10px] text-petra-muted truncate">{sd.pet.breed}</p>}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  </div>
                )}
              </div>
              )}

              {/* Pet selector — checkboxes for multi-select */}
              {selectedCustomer && (
                <div>
                  <label className="label">חיות מחמד * ({form.petIds.length} נבחרו)</label>
                  <div className="border border-petra-border rounded-xl divide-y divide-petra-border max-h-40 overflow-y-auto">
                    {selectedCustomer.pets.length === 0 ? (
                      <div className="py-3 text-center text-sm text-petra-muted">אין חיות מחמד</div>
                    ) : (
                      selectedCustomer.pets.map((p) => {
                        const checked = form.petIds.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors",
                              checked ? "bg-brand-50" : "hover:bg-slate-50"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  petIds: prev.petIds.includes(p.id)
                                    ? prev.petIds.filter((id) => id !== p.id)
                                    : [...prev.petIds, p.id],
                                }));
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                            />
                            <PawPrint className="w-4 h-4 text-petra-muted flex-shrink-0" />
                            <span className="text-sm font-medium text-petra-text">{p.name}</span>
                            <span className="text-xs text-petra-muted">{p.species === "dog" ? "כלב" : p.species === "cat" ? "חתול" : "אחר"}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Price per night — display only, not saved to stay record */}
              {selectedCustomer && showPricing && (
                <div>
                  <label className="label">מחיר ללילה (₪) — הערכת עלות בלבד</label>
                  <input
                    type="number"
                    className="input"
                    min={0}
                    value={form.pricePerNight}
                    onChange={(e) => setForm({ ...form, pricePerNight: Number(e.target.value) || 0 })}
                  />
                  <p className="text-[11px] text-petra-muted mt-1">הסכום לא נשמר אוטומטית — יש להוסיף תשלום ידנית בלשונית "פיננסים"</p>
                </div>
              )}

              {/* Room selector */}
              <div>
                <label className="label">
                  חדר
                  {form.checkIn && form.checkOut && (
                    <span className="text-[10px] font-normal text-brand-500 mr-2">
                      זמינות לפי תאריכים שנבחרו
                    </span>
                  )}
                </label>
                {form.checkIn && form.checkOut ? (
                  // Availability-aware card picker
                  <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, roomId: "" })}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all text-right",
                        form.roomId === ""
                          ? "border-brand-400 bg-brand-50 text-brand-700"
                          : "border-slate-200 bg-white hover:border-slate-300 text-petra-muted"
                      )}
                    >
                      <span className="flex-1">ללא חדר</span>
                    </button>
                    {[...rooms]
                      .sort((a, b) => {
                        const aAvail = roomAvailability[a.id] !== false;
                        const bAvail = roomAvailability[b.id] !== false;
                        return (bAvail ? 1 : 0) - (aAvail ? 1 : 0);
                      })
                      .map((r) => {
                        const available = roomAvailability[r.id] !== false;
                        const isSelected = form.roomId === r.id;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            disabled={!available}
                            onClick={() => available && setForm({ ...form, roomId: r.id, pricePerNight: r.pricePerNight ?? form.pricePerNight })}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all text-right",
                              isSelected
                                ? "border-brand-400 bg-brand-50 text-brand-700"
                                : available
                                ? "border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/40 text-petra-text cursor-pointer"
                                : "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                            )}
                          >
                            <span className="flex-1">{r.name} · {ROOM_TYPE_LABELS[r.type] || r.type}</span>
                            {r.pricePerNight != null && (
                              <span className="text-[10px] text-petra-muted ms-1">₪{r.pricePerNight}</span>
                            )}
                            {available ? (
                              <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">✓ זמין</span>
                            ) : (
                              <span className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">✗ תפוס</span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                ) : (
                  // Simple dropdown (no dates selected yet)
                  <select
                    className="input"
                    value={form.roomId}
                    onChange={(e) => setForm({ ...form, roomId: e.target.value })}
                  >
                    <option value="">ללא חדר</option>
                    {rooms.map((r) => {
                      // No dates yet → show only who occupies the room TODAY (not every future booking);
                      // real availability is checked once dates are picked.
                      const roomStatus = getRoomDisplayStatus(r);
                      const todayCount = roomTodayCount[r.id] ?? 0;
                      return (
                        <option key={r.id} value={r.id}>
                          {r.name} (היום {todayCount}/{r.capacity}){roomStatus === "needs_cleaning" ? " — דרוש ניקיון" : ""}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* Check-in */}
              <div>
                <label className="label">צ׳ק-אין *</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date" lang="he"
                    className="input"
                    value={form.checkIn}
                    onChange={(e) => {
                      const newCheckIn = e.target.value;
                      const newCheckOut = form.checkOut && form.checkOut <= newCheckIn ? "" : form.checkOut;
                      const todayYmd = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
                      // Backdated check-in → the dog is already here (or already left) — default accordingly.
                      const autoStatus = newCheckIn && newCheckIn < todayYmd
                        ? (newCheckOut && newCheckOut < todayYmd ? "checked_out" : "checked_in")
                        : "";
                      setForm({ ...form, checkIn: newCheckIn, checkOut: newCheckOut, status: autoStatus });
                    }}
                  />
                  <div className="relative">
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-petra-muted pointer-events-none" />
                    <input
                      type="time"
                      className="input pr-9"
                      value={form.checkInTime}
                      onChange={(e) => setForm({ ...form, checkInTime: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Retroactive stay — dog entered before today (e.g. existing dogs when joining Petra) */}
              {form.checkIn && form.checkIn < new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }) && (
                <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <div className="font-medium text-amber-800 mb-1">שהייה רטרואקטיבית — תאריך הכניסה כבר עבר</div>
                  <p className="text-amber-700 text-xs mb-2">אפשר לרשום כלבים שכבר נמצאים בפנסיון (או שהיות שהסתיימו) בלי לעבור צ׳ק-אין ידני.</p>
                  <select
                    className="input"
                    value={form.status || "checked_in"}
                    onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
                  >
                    <option value="checked_in">הכלב כבר בפנסיון (צ׳ק-אין בוצע)</option>
                    <option value="checked_out">השהייה הסתיימה (היסטורית)</option>
                    <option value="reserved">הזמנה בלבד (ממתין לצ׳ק-אין)</option>
                  </select>
                </div>
              )}

              {/* Check-out */}
              <div>
                <label className="label">צ׳ק-אאוט</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date" lang="he"
                    className="input"
                    value={form.checkOut}
                    onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
                  />
                  <div className="relative">
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-petra-muted pointer-events-none" />
                    <input
                      type="time"
                      className="input pr-9"
                      value={form.checkOutTime}
                      onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label">הערות</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              {/* Staff picker */}
              {teamMembers.length > 0 && (
                <div>
                  <label className="label">איש צוות</label>
                  <select
                    className="input"
                    value={form.assignedToUserId}
                    onChange={(e) => setForm((f) => ({ ...f, assignedToUserId: e.target.value }))}
                  >
                    <option value="">ללא שיוך</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Training notice for service dogs in training */}
            {isServiceDogInTraining && form.checkIn && form.petIds.length > 0 && (
              <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-700">
                כלב שירות בהכשרה — ללא חיוב
              </div>
            )}

            {/* Price summary — hidden for service dogs in training */}
            {showPricing && form.checkIn && form.checkOut && form.petIds.length > 0 && form.pricePerNight > 0 && (() => {
              const checkInDT = `${form.checkIn}T${form.checkInTime || "12:00"}`;
              const checkOutDT = `${form.checkOut}T${form.checkOutTime || "12:00"}`;
              const nights = calcNights(checkInDT, checkOutDT);
              const total = nights * form.pricePerNight * form.petIds.length;
              return (
                <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex justify-between text-sm text-petra-muted">
                    <span>לילות</span>
                    <span>{nights}</span>
                  </div>
                  <div className="flex justify-between text-sm text-petra-muted">
                    <span>מחיר ללילה</span>
                    <span>₪{form.pricePerNight}</span>
                  </div>
                  <div className="flex justify-between text-sm text-petra-muted">
                    <span>כלבים</span>
                    <span>{form.petIds.length}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-1.5 flex justify-between text-sm font-bold text-petra-text">
                    <span>סה״כ</span>
                    <span>₪{total.toLocaleString()}</span>
                  </div>
                </div>
              );
            })()}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
              <button
                className="btn-primary flex-1"
                disabled={(serviceDogMode ? false : !form.customerId) || form.petIds.length === 0 || !form.checkIn || createMutation.isPending}
                onClick={() => createMutation.mutate(form)}
              >
                <Plus className="w-4 h-4" />
                {createMutation.isPending ? "שומר..." : form.petIds.length > 1 ? `צור ${form.petIds.length} שהיות` : "צור שהייה"}
              </button>
              <button className="btn-secondary" onClick={() => { setShowNewStay(false); setServiceDogMode(false); }}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Check-in Dialog ── */}
      {checkinDialogStay && (
        <CheckinDialog
          stay={checkinDialogStay}
          settings={settings}
          onConfirm={confirmCheckin}
          onCancel={() => setCheckinDialogStay(null)}
          isPending={statusMutation.isPending}
        />
      )}

      {/* ── Check-out Dialog ── */}
      {checkoutDialogStay && (
        <CheckoutDialog
          stay={checkoutDialogStay}
          settings={settings}
          onConfirm={confirmCheckout}
          onCancel={() => setCheckoutDialogStay(null)}
          isPending={statusMutation.isPending}
        />
      )}

      {/* ── Edit Stay Dialog ── */}
      {editStay && (
        <EditStayDialog
          stay={editStay}
          rooms={rooms}
          onSave={(data) => editStayMutation.mutate({ id: editStay.id, ...data })}
          onCancel={() => setEditStay(null)}
          isPending={editStayMutation.isPending}
        />
      )}

      {/* ── Extend Stay Dialog ── */}
      {extendDialogStay && (
        <ExtendStayDialog
          stay={extendDialogStay}
          onConfirm={(checkOut) => extendMutation.mutate({ id: extendDialogStay.id, checkOut })}
          onCancel={() => setExtendDialogStay(null)}
          isPending={extendMutation.isPending}
        />
      )}

      {/* ── Delete Stay Confirmation ── */}
      {deleteDialogStay && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setDeleteDialogStay(null)} />
          <div className="modal-content max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-petra-text">מחיקת שהות</h2>
                <p className="text-sm text-petra-muted">{deleteDialogStay.pet.name} — {deleteDialogStay.customer?.name ?? "כלב שירות"}</p>
              </div>
            </div>
            <p className="text-sm text-petra-muted mb-5">
              האם למחוק את השהות של {deleteDialogStay.pet.name}? פעולה זו בלתי הפיכה.
            </p>
            <div className="flex gap-3">
              <button
                className="btn-primary flex-1 !bg-red-500 hover:!bg-red-600"
                disabled={deleteStayMutation.isPending}
                onClick={() => deleteStayMutation.mutate(deleteDialogStay.id)}
              >
                <Trash2 className="w-4 h-4" />
                {deleteStayMutation.isPending ? "מוחק..." : "מחק"}
              </button>
              <button className="btn-secondary flex-1" onClick={() => setDeleteDialogStay(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BoardingPage() {
  return (
    <>
      <style>{`
        .boarding-print-header { display: none; }
        @media print {
          body > * { display: none !important; }
          body > div:has([data-print-rooms]) { display: block !important; }
          [data-print-rooms] { display: block !important; }
          aside, nav, header, [data-sidebar], [data-topbar] { display: none !important; }
          .no-print { display: none !important; }
          .modal-overlay { display: none !important; }
          [data-print-rooms] .card { break-inside: avoid; box-shadow: none; border: 1px solid #e2e8f0; }
          [data-print-rooms] button { display: none !important; }
          .boarding-print-header { display: flex !important; align-items: center; gap: 12px; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0; margin-bottom: 16px; }
        }
      `}</style>
      <PageTitle title="פנסיון" />
      <TierGate
      feature="boarding"
      title="ניהול פנסיון"
      description="ניהול חדרים, לינות ותפוסה. עקוב אחרי כל כלב שנמצא בפנסיון בזמן אמת."
    >
      <BoardingPageContent />
    </TierGate>
    </>
  );
}
