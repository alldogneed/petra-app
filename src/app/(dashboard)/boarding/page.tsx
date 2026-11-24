"use client";
import { PageTitle } from "@/components/ui/PageTitle";

import { TierGate } from "@/components/paywall/TierGate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, memo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn, fetchJSON, toWhatsAppPhone } from "@/lib/utils";
import { BoardingTabs } from "@/components/boarding/BoardingTabs";
import { toast } from "sonner";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { CustomerPicker, type PickerCustomer } from "@/components/customers/CustomerPicker";
import { usePermissions } from "@/hooks/usePermissions";
import { StayBillingBlock } from "@/components/boarding/StayBillingBlock";
import { staysOverlap, staysShareNight, israelDayKey } from "@/lib/boarding-overlap";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  buildStayMovePatch,
  dragDayDelta,
  isStayDraggable,
  shiftIsoByIsraelDays,
  UNASSIGNED_ROW,
  type StayMovePatch,
} from "@/lib/boarding-drag";
import { normalizeHebrewPunct } from "@/lib/text-variants";
import { packLanes, type LaneLayout } from "@/lib/timeline-lanes";
import {
  addDayKey,
  dayKeyDiff,
  dayKeyWeekday,
  extendWindowForScroll,
  firstWeekdayIndex,
  monthSegments,
  scrollLeftForDay,
  windowAround,
  windowContains,
  TL_EXTEND_THRESHOLD_DAYS,
  type DayWindow,
} from "@/lib/timeline-window";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RoomStay {
  id: string;
  checkIn: string;
  checkOut: string | null;
  status: string;
  isTentative?: boolean;
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
  /** "רישום בלבד" — intro meetings / settling-in, not counted in occupancy or availability. */
  registrationOnly?: boolean;
  _count: { boardingStays: number };
  boardingStays: RoomStay[];
}

interface BoardingStay {
  id: string;
  checkIn: string;
  checkOut: string | null;
  status: string;
  /** Temporary hold (waiting for contract) — still a normal reserved stay for capacity. */
  isTentative?: boolean;
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

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  reserved:    { label: "הזמנה",  color: "#8B5CF6", bg: "#F5F3FF" },
  checked_in:  { label: "נמצא",   color: "#10B981", bg: "#ECFDF5" },
  checked_out: { label: "יצא",    color: "#64748B", bg: "#F1F5F9" },
  canceled:    { label: "בוטל",   color: "#EF4444", bg: "#FEF2F2" },
};

const TENTATIVE_LABEL = "שמור זמנית";
const TENTATIVE_FULL_LABEL = "שמור זמנית – ממתין לחוזה";

/** A reserved stay that only holds the room until it is confirmed (contract pending). */
function isTentativeStay(stay: { status: string; isTentative?: boolean }): boolean {
  return stay.status === "reserved" && stay.isTentative === true;
}

function TentativeBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-dashed border-amber-400 whitespace-nowrap",
        className,
      )}
      title={TENTATIVE_FULL_LABEL}
    >
      <Clock className="w-2.5 h-2.5" />{TENTATIVE_LABEL}
    </span>
  );
}

const ROOM_STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  available:       { label: "פנוי",         color: "#22C55E", bg: "#F0FDF4", border: "#BBF7D0" },
  occupied:        { label: "תפוס",         color: "#F97316", bg: "#FFF7ED", border: "#FDBA74" },
  needs_cleaning:  { label: "דרוש ניקיון",  color: "#EAB308", bg: "#FEFCE8", border: "#FDE047" },
};

const ROOM_TYPE_LABELS: Record<string, string> = {
  standard: "רגיל",
  premium: "פרמיום",
  suite: "סוויט",
};


const ACTIVE_STATUSES = ["reserved", "checked_in"];
type TabKey = "active" | "checkin_today" | "checkout_today" | "history";
type ViewMode = "grid" | "timeline" | "calendar";

const HE_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateStr(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
}

function formatDateFull(d: string) {
  return new Date(d).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
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
        <span className="text-[9px] text-petra-muted">{formatDate(checkIn)}</span>
        <span className={cn("text-[9px]", isOverdue ? "text-red-500 font-semibold" : "text-petra-muted")}>
          {isOverdue ? `חריגה! ${progress - 100}%` : `${Math.min(progress, 100)}%`}
        </span>
        <span className="text-[9px] text-petra-muted">{formatDate(checkOut)}</span>
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
  canDrag = false,
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
  /** Stay cards can be dragged between rooms (BOARDING_MANAGE). */
  canDrag?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: room.id, disabled: !canDrag });
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
            {statusConfig.label}
          </span>
        </div>

        {/* Room meta */}
        <div className="flex items-center gap-2 text-xs text-petra-muted mb-3">
          <Users className="w-3.5 h-3.5" />
          <span>{occPeriodStays.length}/{room.capacity}</span>
          <span className="badge-neutral text-[10px]">{ROOM_TYPE_LABELS[room.type] || room.type}</span>
          {room.pricePerNight != null && (
            <span className="ms-auto text-[10px] font-semibold text-brand-600">₪{room.pricePerNight}/לילה</span>
          )}
        </div>

        {/* Checked-in + Reserved dogs — compact 2-column grid */}
        {(displayCheckedIn.length > 0 || displayReserved.length > 0) && (
          <SortableContext items={sortedStayIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-1.5 mb-1">
            {displayCheckedIn.map((stay) => {
              const actionStay = checkedIn.find(s => s.id === stay.id);
              return (
                <SortableStayInRoom key={stay.id} stayId={stay.id} disabled={!canDrag}>
                  <div className="p-2 rounded-lg" style={{ background: "#FFF7ED", border: "1px solid #FDBA74" }}>
                    <div className="flex items-center gap-1 mb-1">
                      <PawPrint className="w-3 h-3 text-orange-500 flex-shrink-0" />
                      <button
                        type="button"
                        className="flex-1 min-w-0 text-right"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onOpenStay(stay)}
                        title="פתח את ההזמנה"
                      >
                        <div className="text-xs font-semibold text-petra-text truncate hover:text-brand-600 hover:underline">{stay.pet.name}</div>
                        <div className="text-[10px] text-petra-muted truncate">{stay.customer?.name ?? "כלב שירות"}</div>
                      </button>
                    </div>
                    {stay.checkOut && (
                      <div className="text-[10px] text-orange-600 font-medium flex items-center gap-0.5 mb-1">
                        <Calendar className="w-2.5 h-2.5" />
                        יציאה: {formatDate(stay.checkOut)}
                      </div>
                    )}
                    {actionStay && (
                      <button
                        className="w-full flex items-center justify-center gap-1 py-1 rounded text-[10px] font-medium text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200 bg-white"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onCheckout(actionStay.id)}
                      >
                        <LogOut className="w-2.5 h-2.5" />צ׳ק-אאוט
                      </button>
                    )}
                  </div>
                </SortableStayInRoom>
              );
            })}
            {displayReserved.map((stay) => {
              const actionStay = reserved.find(s => s.id === stay.id);
              return (
                <SortableStayInRoom key={stay.id} stayId={stay.id} disabled={!canDrag}>
                  <div
                    className="p-2 rounded-lg"
                    style={isTentativeStay(stay)
                      ? { background: "#FFFBEB", border: "1px dashed #F59E0B" }
                      : { background: "#F5F3FF", border: "1px solid #C4B5FD" }}
                  >
                    {isTentativeStay(stay) && <TentativeBadge className="mb-1" />}
                    <div className="flex items-center gap-1 mb-1">
                      <PawPrint className="w-3 h-3 text-purple-500 flex-shrink-0" />
                      <button
                        type="button"
                        className="flex-1 min-w-0 text-right"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onOpenStay(stay)}
                        title="פתח את ההזמנה"
                      >
                        <div className="text-xs font-semibold text-petra-text truncate hover:text-brand-600 hover:underline">{stay.pet.name}</div>
                        <div className="text-[10px] text-petra-muted truncate">{stay.customer?.name ?? "כלב שירות"}</div>
                      </button>
                    </div>
                    <div className="text-[10px] text-purple-600 font-medium flex items-center gap-0.5 mb-1">
                      <Calendar className="w-2.5 h-2.5" />
                      כניסה: {formatDate(stay.checkIn)}
                    </div>
                    {actionStay && (
                      <button
                        className="w-full flex items-center justify-center gap-1 py-1 rounded text-[10px] font-medium text-emerald-600 hover:bg-emerald-50 transition-colors border border-emerald-200 bg-white"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onCheckin(actionStay.id)}
                      >
                        <CheckCircle2 className="w-2.5 h-2.5" />צ׳ק-אין
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
            <p className="text-xs text-brand-500 font-medium">שחרר כאן</p>
          </div>
        )}

        {/* Empty state */}
        {!isOver && !hasPeriodStays && displayStatus === "available" && (
          <div className="text-center py-6">
            <div className="w-10 h-10 rounded-full bg-green-50 mx-auto mb-2 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-sm text-green-600 font-medium">פנוי לאורחים</p>
          </div>
        )}

        {!isOver && !hasPeriodStays && displayStatus === "needs_cleaning" && (
          <div className="text-center py-4">
            <div className="w-10 h-10 rounded-full bg-yellow-50 mx-auto mb-2 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-sm text-yellow-600 font-medium mb-2">דרוש ניקיון</p>
            <button onClick={() => onMarkClean(room.id)} className="btn-ghost text-xs text-yellow-700 hover:bg-yellow-50">
              <Check className="w-3.5 h-3.5" />סמן כנקי
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
              <Sparkles className="w-3.5 h-3.5" />סמן כנקי
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
  // "רישום בלבד" rooms are not sleeping places: neither their capacity nor their stays count.
  const regOnlyIds = useMemo(() => new Set(rooms.filter((r) => r.registrationOnly).map((r) => r.id)), [rooms]);
  const totalCapacity = rooms.filter((r) => !r.registrationOnly).reduce((sum, r) => sum + r.capacity, 0);
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
          !(s.room && regOnlyIds.has(s.room.id)) &&
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

  const monthLabel = calendarMonth.toLocaleDateString("he-IL", { month: "long", year: "numeric" });

  return (
    <div className="card p-4 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => onChangeMonth(new Date(year, month + 1, 1))}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-petra-muted hover:bg-slate-100 hover:text-petra-text transition-colors"
          aria-label="חודש הבא"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-petra-text">{monthLabel}</h3>
          {calendarMonth.getMonth() !== new Date().getMonth() || calendarMonth.getFullYear() !== new Date().getFullYear() ? (
            <button
              onClick={() => onChangeMonth(new Date())}
              className="text-[10px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
            >
              היום
            </button>
          ) : null}
        </div>
        <button
          onClick={() => onChangeMonth(new Date(year, month - 1, 1))}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-petra-muted hover:bg-slate-100 hover:text-petra-text transition-colors"
          aria-label="חודש קודם"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"].map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-petra-muted py-1">
            {d}
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
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-50 border border-amber-200" /> מעט תפוס</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-orange-100 border border-orange-300" /> כמעט מלא</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-100 border border-red-300" /> מלא</div>
        <div className="flex items-center gap-1"><span className="bg-green-100 text-green-700 rounded px-0.5">+N</span> הגעות</div>
        <div className="flex items-center gap-1"><span className="bg-slate-200 text-slate-600 rounded px-0.5">-N</span> עזיבות</div>
      </div>
    </div>
  );
}

// ─── Timeline / Gantt View ──────────────────────────────────────────────────
// Continuous horizontal scroll (גבעת הכלבים 18/11/2026): a wide window of fixed-width
// day columns (60 days back, 180 ahead of the anchor) that grows as the user nears
// either end (`src/lib/timeline-window.ts`). Room column + header row stay sticky.

const TL_DAY_W = 44; // px per day column
const TL_DAY_W_COMPACT = 28;
const TL_ROOM_W = 140; // px for the sticky room-name column
const TL_ROOM_W_NARROW = 96; // phones (< 640px)
const TL_ROOM_W_COMPACT = 104;
const TL_ROOM_W_COMPACT_NARROW = 72;
const TL_ROW_H = 26; // px per stacked bar
const TL_ROW_H_COMPACT = 18;
const TL_BAR_H = 22;
const TL_BAR_H_COMPACT = 14;
const TL_ROW_MIN = 48;
const TL_ROW_MIN_COMPACT = 24;
const TL_PAN_THRESHOLD = 3; // px before a mouse press on empty grid becomes a pan
const TL_COMPACT_STORAGE_KEY = "petra.boarding.timelineCompact";

/** A request to scroll the timeline to a day ("YYYY-MM-DD"); bump `n` to repeat the same day. */
interface TimelineScrollRequest {
  day: string;
  n: number;
}

/** "YYYY-MM-DD" of a local Date (the timeline's own day columns). */
function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Day + time label for the move confirmation ("12.11, 14:00"). */
function formatDateTimeShort(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Live drag state of a timeline bar (only while a drag is active). */
interface TimelineDrag {
  stayId: string;
  originRow: string;
  targetRow: string;
  dayDelta: number;
}

interface TimelinePendingMove {
  stay: BoardingStay;
  patch: StayMovePatch;
}

type TimelinePendingScroll =
  | { kind: "day"; key: string }
  | { kind: "shift"; px: number; startKey: string };

const TL_LONG_PRESS_MS = 300;
const TL_TOUCH_TOLERANCE = 8; // px a finger may move before the long-press = a scroll
const TL_MOUSE_THRESHOLD = 5; // px before a mouse press becomes a drag
const TL_EDGE = 36; // px from the scroller edge that auto-scrolls during a drag
const TL_EDGE_STEP = 14;

function TimelineView({
  rooms,
  stays,
  scrollTo,
  compact = false,
  search = "",
  onOpenStay,
  canDrag = false,
  fullHeight = false,
}: {
  rooms: Room[];
  stays: BoardingStay[];
  /** Day to scroll to (today by default). A new `n` scrolls again, even to the same day. */
  scrollTo: TimelineScrollRequest;
  /** Narrow columns + thin rows — many days and rooms on one screen. */
  compact?: boolean;
  /** Normalised search query (normSearch) — only rows with a matching stay are shown. */
  search?: string;
  onOpenStay?: (stay: BoardingStay) => void;
  /** Bars can be dragged to another room / other dates (BOARDING_MANAGE). */
  canDrag?: boolean;
  /** Full-screen mode: the grid uses the whole viewport height. */
  fullHeight?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setBoxWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = boxWidth > 0 && boxWidth < 640;
  const roomW = compact
    ? (narrow ? TL_ROOM_W_COMPACT_NARROW : TL_ROOM_W_COMPACT)
    : (narrow ? TL_ROOM_W_NARROW : TL_ROOM_W);
  const dayW = compact ? TL_DAY_W_COMPACT : TL_DAY_W;
  const rowH = compact ? TL_ROW_H_COMPACT : TL_ROW_H;
  const barH = compact ? TL_BAR_H_COMPACT : TL_BAR_H;
  const barTop = compact ? 2 : 4;
  const rowMin = compact ? TL_ROW_MIN_COMPACT : TL_ROW_MIN;
  const rowHeightFor = (n: number) => Math.max(rowMin, n * rowH + barTop * 2);

  const [win, setWin] = useState<DayWindow>(() => windowAround(scrollTo.day));
  const winRef = useRef(win);
  winRef.current = win;
  const numDays = win.days;
  const originKey = win.startKey;
  const trackWidth = numDays * dayW;
  const todayIndex = dayKeyDiff(originKey, localDayKey(new Date())); // may be outside the window
  const days = useMemo(
    () => Array.from({ length: numDays }, (_, i) => addDayKey(originKey, i)),
    [originKey, numDays],
  );
  const segments = useMemo(() => monthSegments(win), [win]);
  const saturdayIndex = firstWeekdayIndex(originKey, 6);

  const dayWRef = useRef(dayW);
  dayWRef.current = dayW;
  const roomWRef = useRef(roomW);
  roomWRef.current = roomW;
  const draggingRef = useRef(false);

  // ── Scroll position management ──
  // A pending adjustment is applied right after the DOM reflects the change it belongs to
  // (first render / a jump → scroll to the day; a prepend → keep the view still).
  const pendingScrollRef = useRef<TimelinePendingScroll | null>({ kind: "day", key: scrollTo.day });
  const leftDayRef = useRef<number | null>(null); // first visible day (fractional) — kept across a compact toggle
  const prevDayWRef = useRef(dayW);
  const panRef = useRef<{ startX: number; startY: number; startScrollLeft: number; startScrollTop: number; active: boolean } | null>(null);
  const panCleanupRef = useRef<(() => void) | null>(null);
  const scrollRafRef = useRef(0);
  const [panning, setPanning] = useState(false);

  const lastRequestRef = useRef(scrollTo.n);
  useLayoutEffect(() => {
    if (scrollTo.n === lastRequestRef.current) return;
    lastRequestRef.current = scrollTo.n;
    if (!windowContains(winRef.current, scrollTo.day, TL_EXTEND_THRESHOLD_DAYS + 14)) {
      setWin(windowAround(scrollTo.day));
    }
    pendingScrollRef.current = { kind: "day", key: scrollTo.day };
  }, [scrollTo.n, scrollTo.day]);

  // Runs after every commit (declared after the jump effect, so it sees its request).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prevDayWRef.current !== dayW) {
      prevDayWRef.current = dayW;
      if (leftDayRef.current !== null && !pendingScrollRef.current) el.scrollLeft = leftDayRef.current * dayW;
    }
    const p = pendingScrollRef.current;
    if (!p) return;
    if (p.kind === "day") {
      if (!windowContains(win, p.key)) return; // the new window is not rendered yet
      el.scrollLeft = scrollLeftForDay(win, p.key, dayW);
    } else {
      if (win.startKey !== p.startKey) return;
      el.scrollLeft += p.px;
      if (panRef.current) panRef.current.startScrollLeft += p.px;
    }
    pendingScrollRef.current = null;
    leftDayRef.current = el.scrollLeft / dayW;
  });

  const handleScroll = useCallback(() => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      const el = scrollRef.current;
      if (!el) return;
      leftDayRef.current = el.scrollLeft / dayWRef.current;
      // Never move the origin under a bar drag (its day delta is measured from it).
      if (draggingRef.current || pendingScrollRef.current) return;
      const next = extendWindowForScroll(winRef.current, {
        scrollLeft: el.scrollLeft,
        viewportWidth: el.clientWidth - roomWRef.current,
        dayW: dayWRef.current,
      });
      if (!next) return;
      pendingScrollRef.current = { kind: "shift", px: next.shiftPx, startKey: next.win.startKey };
      setWin(next.win);
    });
  }, []);

  useEffect(() => () => {
    if (scrollRafRef.current) window.cancelAnimationFrame(scrollRafRef.current);
    panCleanupRef.current?.();
  }, []);

  /** Mouse drag on empty grid area pans the timeline (bars keep their own drag). */
  function handleScrollerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea, label, [data-tl-no-pan]")) return;
    const el = scrollRef.current;
    if (!el) return;
    // A press on the native scrollbar keeps its normal behaviour.
    const r = el.getBoundingClientRect();
    if (e.clientX - r.left > el.clientWidth || e.clientY - r.top > el.clientHeight) return;
    panCleanupRef.current?.();
    e.preventDefault(); // no text selection while panning
    const pointerId = e.pointerId;
    const st = { startX: e.clientX, startY: e.clientY, startScrollLeft: el.scrollLeft, startScrollTop: el.scrollTop, active: false };
    panRef.current = st;
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dx = ev.clientX - st.startX;
      const dy = ev.clientY - st.startY;
      if (!st.active) {
        if (Math.hypot(dx, dy) < TL_PAN_THRESHOLD) return;
        st.active = true;
        setPanning(true);
      }
      el.scrollLeft = st.startScrollLeft - dx;
      el.scrollTop = st.startScrollTop - dy;
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      panRef.current = null;
      panCleanupRef.current = null;
      setPanning(false);
    };
    function onEnd(ev: PointerEvent) {
      if (ev.pointerId === pointerId) cleanup();
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    panCleanupRef.current = cleanup;
  }

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

  // Non-overlapping stays share a line — otherwise a room with history gets one line per stay.
  const laneMap = useMemo(() => {
    const out: Record<string, LaneLayout> = {};
    for (const [key, list] of Object.entries(roomStaysMap)) {
      out[key] = packLanes(list.map((st) => ({ id: st.id, ...spanOf(st) })));
    }
    return out;
  }, [roomStaysMap, spanOf]);
  const lanesOf = (key: string) => laneMap[key]?.lanes ?? 0;
  const laneIndex = (key: string, stayId: string) => laneMap[key]?.laneOf.get(stayId) ?? 0;

  const visibleRooms = search
    ? rooms.filter((r) => (roomStaysMap[r.id] || []).length > 0 || normSearch(r.name).includes(search))
    : rooms;

  function getBarPosition(stay: BoardingStay) {
    const { start, end } = spanOf(stay);
    const visibleStart = Math.max(0, start);
    const visibleEnd = Math.min(numDays, end);
    return {
      left: `${visibleStart * dayW}px`,
      width: `${Math.max(dayW / 2, (visibleEnd - visibleStart) * dayW)}px`,
      days: visibleEnd - visibleStart,
    };
  }

  // ── Drag a bar to another room row and/or other dates ──
  // Pointer events (mouse + touch). Mouse: press and move 5px. Touch: long-press 300ms,
  // then move — a finger that moves earlier is a normal scroll.
  const queryClient = useQueryClient();
  const [drag, setDrag] = useState<TimelineDrag | null>(null);
  const [pendingMove, setPendingMove] = useState<TimelinePendingMove | null>(null);
  const suppressClickRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  // While a touch drag is active, stop the browser from scrolling the timeline
  // (needs a non-passive listener — React's onTouchMove is passive).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onTouchMove = (ev: TouchEvent) => { if (draggingRef.current) ev.preventDefault(); };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, []);

  const moveMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: StayMovePatch }) =>
      fetchJSON<BoardingStay>(`/api/boarding/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      setPendingMove(null);
      toast.success("ההזמנה עודכנה");
    },
    onError: (err: unknown) => {
      setPendingMove(null);
      toast.error(err instanceof Error && err.message ? err.message : "שגיאה בעדכון ההזמנה");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["boarding"] });
      queryClient.invalidateQueries({ queryKey: ["boarding-occupancy"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  function rowAtPoint(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    return el?.closest<HTMLElement>("[data-tl-row]")?.dataset.tlRow ?? null;
  }

  function handleBarPointerDown(e: React.PointerEvent<HTMLButtonElement>, stay: BoardingStay, originRow: string) {
    suppressClickRef.current = false;
    if (!canDrag || !isStayDraggable(stay.status) || moveMutation.isPending) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    cleanupRef.current?.();

    const pointerId = e.pointerId;
    const isTouch = e.pointerType !== "mouse";
    const st = {
      startX: e.clientX,
      startY: e.clientY,
      startScroll: scroller.scrollLeft,
      lastX: e.clientX,
      lastY: e.clientY,
      active: false,
      targetRow: originRow,
      dayDelta: 0,
      timer: 0,
    };

    const publish = () => {
      const dx = st.lastX + scroller.scrollLeft - (st.startX + st.startScroll);
      const delta = dragDayDelta(dx, dayWRef.current);
      const row = rowAtPoint(st.lastX, st.lastY) ?? st.targetRow;
      if (delta === st.dayDelta && row === st.targetRow && st.active && draggingRef.current) {
        // unchanged — skip a re-render
        return;
      }
      st.dayDelta = delta;
      st.targetRow = row;
      setDrag({ stayId: stay.id, originRow, targetRow: row, dayDelta: delta });
    };

    const activate = () => {
      st.active = true;
      suppressClickRef.current = true;
      setDrag({ stayId: stay.id, originRow, targetRow: originRow, dayDelta: 0 });
      draggingRef.current = true;
      if (isTouch && typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate(15); } catch { /* not supported */ }
      }
    };

    const autoScroll = (x: number, y: number) => {
      const r = scroller.getBoundingClientRect();
      if (x < r.left + roomWRef.current + TL_EDGE) scroller.scrollLeft -= TL_EDGE_STEP;
      else if (x > r.right - TL_EDGE) scroller.scrollLeft += TL_EDGE_STEP;
      if (y < r.top + TL_EDGE + 40) scroller.scrollTop -= TL_EDGE_STEP;
      else if (y > r.bottom - TL_EDGE) scroller.scrollTop += TL_EDGE_STEP;
    };

    const finish = (commit: boolean) => {
      window.clearTimeout(st.timer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      cleanupRef.current = null;
      draggingRef.current = false;
      setDrag(null);
      if (!st.active) return;
      // The click that follows pointerup must not open the stay.
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
      if (!commit) return;
      // Dropped back on its own row → the room is unchanged (also for a stay whose
      // room is not in the list and therefore sits in the "ללא חדר" row).
      const row = st.targetRow === originRow ? (stay.room?.id ?? UNASSIGNED_ROW) : st.targetRow;
      const patch = buildStayMovePatch(
        { checkIn: stay.checkIn, checkOut: stay.checkOut, roomId: stay.room?.id ?? null },
        st.dayDelta,
        row,
      );
      if (patch) setPendingMove({ stay, patch });
    };

    function onMove(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      st.lastX = ev.clientX;
      st.lastY = ev.clientY;
      if (!st.active) {
        const dist = Math.hypot(ev.clientX - st.startX, ev.clientY - st.startY);
        if (isTouch) {
          if (dist > TL_TOUCH_TOLERANCE) finish(false); // a scroll, not a long-press
          return;
        }
        if (dist < TL_MOUSE_THRESHOLD) return;
        activate();
      }
      autoScroll(ev.clientX, ev.clientY);
      publish();
    }
    function onUp(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      if (st.active) {
        st.lastX = ev.clientX;
        st.lastY = ev.clientY;
        publish();
      }
      finish(true);
    }
    function onCancel(ev: PointerEvent) {
      if (ev.pointerId === pointerId) finish(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") finish(false);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    cleanupRef.current = () => finish(false);
    if (isTouch) st.timer = window.setTimeout(activate, TL_LONG_PRESS_MS);
  }

  const draggedStay = drag ? stays.find((s) => s.id === drag.stayId) ?? null : null;

  function renderGhost(rowKey: string, list: BoardingStay[]) {
    if (!drag || !draggedStay || drag.targetRow !== rowKey) return null;
    const { start, end } = spanOf(draggedStay);
    const s = start + drag.dayDelta;
    const e = end + drag.dayDelta;
    const visibleStart = Math.max(0, s);
    const visibleEnd = Math.min(numDays, e);
    const width = Math.max(dayW / 2, (visibleEnd - visibleStart) * dayW);
    const sameRow = rowKey === drag.originRow;
    const layoutKey = rowKey === UNASSIGNED_ROW ? "unassigned" : rowKey;
    const idx = sameRow ? laneIndex(layoutKey, draggedStay.id) : lanesOf(layoutKey);
    const newIn = drag.dayDelta ? shiftIsoByIsraelDays(draggedStay.checkIn, drag.dayDelta) : draggedStay.checkIn;
    const newOut = draggedStay.checkOut
      ? (drag.dayDelta ? shiftIsoByIsraelDays(draggedStay.checkOut, drag.dayDelta) : draggedStay.checkOut)
      : null;
    const offscreen = visibleEnd <= 0 || visibleStart >= numDays;
    return (
      <div
        key="__ghost"
        dir="rtl"
        aria-hidden
        className={cn(
          "absolute z-[5] pointer-events-none rounded-md border-2 border-dashed border-brand-500 bg-brand-100/80 flex items-center gap-1 font-semibold text-brand-800 overflow-hidden whitespace-nowrap shadow-md",
          compact ? "px-1 text-[9px]" : "px-2 text-[10px]",
        )}
        style={{
          left: `${offscreen ? 0 : visibleStart * dayW}px`,
          width: `${offscreen ? dayW : width}px`,
          top: `${barTop + idx * rowH}px`,
          height: `${barH}px`,
        }}
      >
        {!compact && <PawPrint className="w-3 h-3 flex-shrink-0" />}
        <span className="truncate">
          {draggedStay.pet.name} · {formatDate(newIn)}{newOut ? ` → ${formatDate(newOut)}` : ""}
        </span>
      </div>
    );
  }

  function renderBars(list: BoardingStay[], rowKey: string) {
    const layoutKey = rowKey === UNASSIGNED_ROW ? "unassigned" : rowKey;
    return list.map((stay) => {
      const rowIdx = laneIndex(layoutKey, stay.id);
      const pos = getBarPosition(stay);
      const barColor = stay.status === "checked_in" ? "#22C55E"
        : stay.status === "checked_out" ? "#3B82F6"
        : "#94A3B8";
      // Temporary hold: amber + diagonal stripes + dashed border, dark text (capacity = a normal reservation).
      const tentative = isTentativeStay(stay);
      const tentativePrefix = tentative ? `${TENTATIVE_LABEL} · ` : "";
      const range = `${formatDate(stay.checkIn)}${stay.checkOut ? ` → ${formatDate(stay.checkOut)}` : ""}`;
      const draggable = canDrag && isStayDraggable(stay.status);
      const isDragged = drag?.stayId === stay.id;
      return (
        <button
          type="button"
          key={stay.id}
          onClick={() => {
            if (suppressClickRef.current) { suppressClickRef.current = false; return; }
            onOpenStay?.(stay);
          }}
          onPointerDown={draggable ? (e) => handleBarPointerDown(e, stay, rowKey) : undefined}
          onContextMenu={draggable ? (e) => e.preventDefault() : undefined}
          dir="rtl"
          className={cn(
            "absolute flex items-center gap-1 font-semibold overflow-hidden whitespace-nowrap shadow-sm hover:brightness-110 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 transition-[filter,box-shadow,opacity]",
            compact ? "rounded px-1 text-[9px] leading-none" : "rounded-md px-2 text-[10px]",
            tentative ? "text-amber-950 border border-dashed border-amber-600" : "text-white",
            draggable ? "cursor-grab select-none" : "cursor-pointer",
            isDragged && "opacity-40 ring-2 ring-brand-400",
          )}
          style={{
            left: pos.left,
            width: pos.width,
            top: `${barTop + rowIdx * rowH}px`,
            height: `${barH}px`,
            backgroundColor: tentative ? "#FCD34D" : barColor,
            backgroundImage: tentative
              ? "repeating-linear-gradient(135deg, rgba(255,255,255,0.45) 0 6px, transparent 6px 12px)"
              : undefined,
            WebkitTouchCallout: draggable ? "none" : undefined,
            WebkitUserSelect: draggable ? "none" : undefined,
          }}
          title={`${tentativePrefix}${stay.pet.name} — ${stay.customer?.name ?? "כלב שירות"}\n${range}\nלחצו לפתיחת ההזמנה${draggable ? " · גררו להעברת חדר או תאריכים" : ""}`}
          aria-label={`${tentativePrefix}${stay.pet.name}, ${range} — פתח את ההזמנה`}
        >
          {!compact && (tentative ? <Clock className="w-3 h-3 flex-shrink-0" /> : <PawPrint className="w-3 h-3 flex-shrink-0" />)}
          <span className="truncate">{tentative && !compact && pos.days >= 4 ? `${TENTATIVE_LABEL} · ` : ""}{stay.pet.name}</span>
          {pos.days >= (compact ? 6 : 3) && stay.checkOut && (
            <span className="ms-auto ps-1 font-normal opacity-90 flex-shrink-0">עד {formatDate(stay.checkOut)}</span>
          )}
        </button>
      );
    });
  }

  /** Extra stacked slot for the ghost when it lands in a row it does not come from. */
  function ghostExtra(rowKey: string): number {
    return drag && drag.targetRow === rowKey && drag.originRow !== rowKey ? 1 : 0;
  }

  function moveDescription(m: TimelinePendingMove): string {
    const parts: string[] = [];
    if (m.patch.roomId !== undefined) {
      const room = m.patch.roomId ? rooms.find((r) => r.id === m.patch.roomId) : null;
      parts.push(room ? `לחדר ${room.name}` : "לשורת ״ללא חדר״");
    }
    let text = `להעביר את ${m.stay.pet.name}${parts.length ? ` ${parts[0]}` : ""}`;
    if (m.patch.checkIn) {
      const out = m.patch.checkOut;
      text += ` · ${formatDateTimeShort(m.patch.checkIn)}${out ? ` → ${formatDateTimeShort(out)}` : " (ללא תאריך יציאה)"}`;
    } else {
      text += ` · התאריכים לא משתנים`;
    }
    return `${text}?`;
  }

  // Grid lines (one per day) + Saturday tint as repeating CSS backgrounds — no element
  // per day per row, so hundreds of columns stay cheap.
  const gridStyle = (withTint: boolean): React.CSSProperties => {
    const line = "linear-gradient(to right, #f1f5f9 1px, transparent 1px)";
    if (!withTint) return { backgroundImage: line, backgroundSize: `${dayW}px 100%` };
    const sat = `linear-gradient(to right, rgba(241,245,249,0.6) ${dayW}px, transparent ${dayW}px)`;
    return {
      backgroundImage: `${line}, ${sat}`,
      backgroundSize: `${dayW}px 100%, ${dayW * 7}px 100%`,
      backgroundPosition: `0 0, ${saturdayIndex * dayW}px 0`,
    };
  };

  function renderGridOverlays(withTint: boolean) {
    return (
      <>
        {segments.slice(1).map((s) => (
          <div key={s.month} aria-hidden className="absolute inset-y-0 w-px bg-slate-300 pointer-events-none" style={{ left: s.startIndex * dayW }} />
        ))}
        {withTint && todayIndex >= 0 && todayIndex < numDays && (
          <div aria-hidden className="absolute inset-y-0 bg-orange-50/40 pointer-events-none" style={{ left: todayIndex * dayW, width: dayW }} />
        )}
      </>
    );
  }

  // Header (memoised — a bar drag re-renders the view on every day change).
  const header = useMemo(() => (
    <div className="flex sticky top-0 z-20 bg-white border-b border-petra-border">
      <div
        className={cn(
          "sticky left-0 z-30 flex-shrink-0 flex items-end font-semibold text-petra-text bg-slate-50 border-r border-petra-border text-right",
          compact ? "px-1.5 py-1 text-xs" : "p-2 text-sm",
        )}
        style={{ width: roomW }}
        dir="rtl"
      >
        חדר
      </div>
      <div className="flex-shrink-0" style={{ width: numDays * dayW }}>
        {/* Month row — the label sticks next to the room column while its month is on screen */}
        <div className="flex border-b border-slate-100">
          {segments.map((s) => {
            const [y, m] = s.month.split("-").map(Number);
            const label = new Date(y, m - 1, 1).toLocaleDateString("he-IL", { month: compact ? "short" : "long", year: "numeric" });
            return (
              <div
                key={s.month}
                className="flex-shrink-0 border-l border-slate-300"
                style={{ width: s.length * dayW }}
              >
                <span
                  className={cn("sticky inline-block truncate align-top px-1.5 font-semibold text-petra-text", compact ? "text-[9px] leading-4" : "text-[10px] leading-5")}
                  style={{ left: roomW, maxWidth: s.length * dayW }}
                  dir="rtl"
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex">
          {days.map((key, i) => {
            const isToday = i === todayIndex;
            const dayOfWeek = dayKeyWeekday(key);
            const dayOfMonth = Number(key.slice(8, 10));
            return (
              <div
                key={key}
                className={cn(
                  "flex-shrink-0 text-center border-l",
                  compact ? "py-0.5" : "py-1.5",
                  dayOfMonth === 1 ? "border-slate-300" : "border-petra-border",
                  isToday ? "bg-orange-50" : dayOfWeek === 6 ? "bg-slate-50" : "bg-white",
                )}
                style={{ width: dayW }}
              >
                <div className={cn(compact ? "text-[9px] leading-3" : "text-[10px]", isToday ? "text-orange-600 font-bold" : "text-petra-muted")}>
                  {HE_DAYS[dayOfWeek]}
                </div>
                <div className={cn("font-semibold", compact ? "text-[10px] leading-3" : "text-[11px]", isToday ? "text-orange-600" : "text-petra-text")}>
                  {compact ? dayOfMonth : `${dayOfMonth}/${Number(key.slice(5, 7))}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  ), [compact, roomW, numDays, dayW, segments, days, todayIndex]);

  const unassigned = roomStaysMap["unassigned"] || [];
  const showUnassignedRow = unassigned.length > 0 || !!drag;
  const unassignedH = rowHeightFor(lanesOf("unassigned") + ghostExtra(UNASSIGNED_ROW));

  return (
    <div className="card overflow-hidden">
      <p className="px-3 py-1.5 text-[11px] text-petra-muted border-b border-slate-100" dir="rtl">
        גללו לצדדים לתאריכים נוספים (במחשב: גלגלת עם Shift, משטח מגע, או גרירה של רקע ריק)
        {canDrag ? " · אפשר לגרור הזמנה לחדר אחר או לתאריכים אחרים — בטלפון: לחיצה ארוכה ואז גרירה." : "."}
      </p>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onPointerDown={handleScrollerPointerDown}
        className={cn(
          "overflow-auto overscroll-contain",
          fullHeight ? "max-h-[calc(100dvh-7.5rem)]" : "max-h-[75vh]",
          drag || panning ? "cursor-grabbing select-none" : "cursor-grab",
        )}
        dir="ltr"
        data-no-pull-refresh
      >
        <div style={{ width: roomW + trackWidth }}>
          {header}

          {/* Room rows */}
          {visibleRooms.map((room) => {
            const roomStays = roomStaysMap[room.id] || [];
            const displayStatus = getRoomDisplayStatus(room);
            const statusColor = ROOM_STATUS_MAP[displayStatus]?.color || "#94A3B8";
            const rowHeight = rowHeightFor(lanesOf(room.id) + ghostExtra(room.id));
            const isDropTarget = !!drag && drag.targetRow === room.id;

            return (
              <div key={room.id} className="flex border-b border-slate-100" data-tl-row={room.id}>
                {/* Room label — sticky on the side while scrolling sideways */}
                <div
                  className={cn(
                    "sticky left-0 z-10 flex-shrink-0 flex items-center bg-slate-50 border-r border-petra-border",
                    compact ? "px-1.5 py-0.5 gap-1" : "p-2 gap-2",
                  )}
                  style={{ width: roomW, minHeight: rowHeight }}
                  dir="rtl"
                  title={room.name}
                >
                  <div
                    className={cn("rounded-full flex-shrink-0", compact ? "w-1.5 h-1.5" : "w-2 h-2")}
                    style={{ backgroundColor: statusColor }}
                  />
                  <span className={cn("font-medium text-petra-text truncate", compact ? "text-[10px]" : "text-xs")}>{room.name}</span>
                  {room.registrationOnly && !narrow && (
                    <span className={cn("text-slate-500 whitespace-nowrap", compact ? "text-[8px]" : "text-[9px]")} title="רישום בלבד — לא נספר בתפוסה">רישום</span>
                  )}
                  <span className={cn("text-petra-muted ms-auto", compact ? "text-[8px]" : "text-[9px]")}>{room._count.boardingStays}/{room.capacity}</span>
                </div>

                {/* Timeline cells with bars */}
                <div
                  className={cn("relative flex-shrink-0", isDropTarget && "bg-brand-50/60")}
                  style={{ width: trackWidth, minHeight: rowHeight, ...gridStyle(true) }}
                >
                  {renderGridOverlays(true)}
                  {renderBars(roomStays, room.id)}
                  {renderGhost(room.id, roomStays)}
                </div>
              </div>
            );
          })}

          {/* Unassigned row */}
          {showUnassignedRow && (
            <div className="flex border-b border-slate-100" data-tl-row={UNASSIGNED_ROW}>
              <div
                className={cn(
                  "sticky left-0 z-10 flex-shrink-0 flex items-center bg-slate-100 border-r border-petra-border",
                  compact ? "px-1.5 py-0.5 gap-1" : "p-2 gap-2",
                )}
                style={{ width: roomW, minHeight: unassignedH }}
                dir="rtl"
              >
                <Hotel className={cn("text-slate-400", compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
                <span className={cn("font-medium text-slate-500", compact ? "text-[10px]" : "text-xs")}>ללא חדר</span>
              </div>
              <div
                className={cn("relative flex-shrink-0", drag?.targetRow === UNASSIGNED_ROW && "bg-brand-50/60")}
                style={{ width: trackWidth, minHeight: unassignedH, ...gridStyle(false) }}
              >
                {renderGridOverlays(false)}
                {renderBars(unassigned, UNASSIGNED_ROW)}
                {renderGhost(UNASSIGNED_ROW, unassigned)}
              </div>
            </div>
          )}

          {search && visibleRooms.length === 0 && unassigned.length === 0 && (
            <div className="sticky left-0 p-6 text-center text-sm text-petra-muted" style={{ width: boxWidth || undefined }} dir="rtl">לא נמצאו הזמנות תואמות בטווח המוצג</div>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!pendingMove}
        title="עדכון ההזמנה"
        description={pendingMove ? moveDescription(pendingMove) : undefined}
        confirmLabel="העבר"
        loading={moveMutation.isPending}
        onConfirm={() => {
          if (pendingMove) moveMutation.mutate({ id: pendingMove.stay.id, patch: pendingMove.patch });
        }}
        onCancel={() => setPendingMove(null)}
      />
    </div>
  );
}

// ─── Simple Draggable wrapper (for unassigned zone) ─────────────────────────

const DraggableStayInRoom = memo(function DraggableStayInRoom({ stayId, children, disabled = false }: { stayId: string; children: React.ReactNode; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: stayId, disabled });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  if (disabled) return <div className="rounded-lg">{children}</div>;
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

const SortableStayInRoom = memo(function SortableStayInRoom({ stayId, children, disabled = false }: { stayId: string; children: React.ReactNode; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stayId, disabled });
  const style = { transform: CSS.Transform.toString(transform), transition };
  // Without BOARDING_MANAGE the card is static — no drag listeners / handle cursor.
  if (disabled) return <div className="rounded-lg">{children}</div>;
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
  canDrag = false,
}: {
  stays: BoardingStay[];
  onCheckin: (id: string) => void;
  onCheckout: (id: string) => void;
  /** Stay cards can be dragged between rooms (BOARDING_MANAGE). */
  canDrag?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "unassigned", disabled: !canDrag });

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
          <span className="font-bold text-petra-text">ללא חדר</span>
          <span className="ms-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
            {stays.length}
          </span>
        </div>

        {stays.length === 0 && isOver && (
          <div className="text-center py-4 border-2 border-dashed border-brand-300 rounded-lg bg-brand-50/30">
            <p className="text-xs text-brand-500 font-medium">שחרר כאן להסרה מחדר</p>
          </div>
        )}

        {stays.map((stay) => (
          <DraggableStayInRoom key={stay.id} stayId={stay.id} disabled={!canDrag}>
            <div className="p-3 rounded-lg mb-2 bg-white border border-slate-200">
              <div className="flex items-center gap-2">
                <PawPrint className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-petra-text truncate">{stay.pet.name}</div>
                  <div className="text-[10px] text-petra-muted">{stay.customer?.name ?? "כלב שירות"}</div>
                </div>
                {isTentativeStay(stay) && <TentativeBadge className="flex-shrink-0" />}
              </div>
              <div className="text-[10px] text-petra-muted mt-1">
                {formatDate(stay.checkIn)}{stay.checkOut ? ` → ${formatDate(stay.checkOut)}` : ""}
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
                <CheckCircle2 className="w-3.5 h-3.5" />צ׳ק-אין {stay.pet.name}
              </button>
            ))}
            {stays.filter((s) => s.status === "checked_in").map((stay) => (
              <button
                key={stay.id}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                onClick={() => onCheckout(stay.id)}
              >
                <LogOut className="w-3.5 h-3.5" />צ׳ק-אאוט {stay.pet.name}
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
  const st = STATUS_MAP[stay.status] || STATUS_MAP.reserved;
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
              title="עבור לפרופיל כלב שירות"
            >
              <Sparkles className="w-2.5 h-2.5" />כלב שירות
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
            <span className="text-sm text-blue-600 font-medium">כלב שירות</span>
          )}
          {isTentativeStay(stay) && <TentativeBadge />}
          {isCheckinToday && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-50 text-brand-600 border border-brand-100">
              <LogIn className="w-2.5 h-2.5" />צ׳ק-אין היום
            </span>
          )}
          {isCheckoutToday && !overdue && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-100">
              <LogOut className="w-2.5 h-2.5" />צ׳ק-אאוט היום
            </span>
          )}
          {overdue && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200 animate-pulse">
              <AlertTriangle className="w-2.5 h-2.5" />איחור צ׳ק-אאוט!
            </span>
          )}
        </div>
        <div className="text-xs text-petra-muted flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(stay.checkIn).toLocaleDateString("he-IL")}
            {stay.checkOut ? ` → ${new Date(stay.checkOut).toLocaleDateString("he-IL")}` : " (פתוח)"}
          </span>
          {stay.room && (
            <span className="flex items-center gap-1">
              <DoorOpen className="w-3 h-3" />
              {stay.room.name}
            </span>
          )}
          {stay.checkOut && stay.status === "checked_in" && (
            <span className="flex items-center gap-1 text-[10px]">
              {calcNights(stay.checkIn, stay.checkOut)} {(settings.boardingCalcMode || "nights") === "nights" ? "לילות" : "ימים"}
            </span>
          )}
        </div>
        {(stay.status === "checked_in" || stay.status === "reserved") && stay.checkOut && (
          <StayProgress checkIn={stay.checkIn} checkOut={stay.checkOut} status={stay.status} />
        )}
      </div>

      <span className="badge text-[10px] flex-shrink-0" style={{ background: st.bg, color: st.color }}>
        {st.label}
      </span>

      {(stay.status === "reserved" || stay.status === "checked_in") && (
        <button
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
          onClick={() => onDelete(stay)}
          title="מחק שהות"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}

      {stay.status === "reserved" && (
        <div className="flex gap-1 flex-shrink-0">
          {isCheckinToday && stay.customer?.phone && (() => {
            const checkInTime = settings.boardingCheckInTime || "10:00";
            const lines = [
              `שלום ${stay.customer!.name} 👋`,
              `תזכורת — היום ${stay.pet.name} מגיע/ה אלינו לפנסיון!`,
              `שעת צ׳ק-אין: ${checkInTime}`,
              stay.room ? `חדר: ${stay.room.name}` : "",
              stay.checkOut ? `יציאה מתוכננת: ${new Date(stay.checkOut).toLocaleDateString("he-IL")}` : "",
              "",
              `מחכים לכם! 🐾`,
            ].filter(Boolean).join("\n");
            return (
              <a
                href={`https://api.whatsapp.com/send?phone=${toWhatsAppPhone(stay.customer!.phone)}&text=${encodeURIComponent(lines)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                title="שלח תזכורת צ׳ק-אין"
                onClick={(e) => e.stopPropagation()}
              >
                <MessageCircle className="w-3 h-3" />
                <span className="hidden sm:inline">תזכורת</span>
              </a>
            );
          })()}
          <button className="btn-ghost text-xs" onClick={() => onCheckin(stay.id)}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">צ׳ק-אין</span>
          </button>
        </div>
      )}
      {stay.status === "checked_in" && (
        <div className="flex gap-1 flex-shrink-0">
          {isCheckoutToday && stay.customer?.phone && (() => {
            const checkOutTime = settings.boardingCheckOutTime || "11:00";
            const lines = [
              `שלום ${stay.customer!.name} 👋`,
              `${stay.pet.name} מסיים/ת היום את השהות בפנסיון.`,
              `שעת צ׳ק-אאוט: ${checkOutTime}`,
              "",
              `תודה ולהתראות! 🐾`,
            ].join("\n");
            return (
              <a
                href={`https://api.whatsapp.com/send?phone=${toWhatsAppPhone(stay.customer!.phone)}&text=${encodeURIComponent(lines)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                title="שלח תזכורת צ׳ק-אאוט"
                onClick={(e) => e.stopPropagation()}
              >
                <MessageCircle className="w-3 h-3" />
                <span className="hidden sm:inline">תזכורת</span>
              </a>
            );
          })()}
          {stay.customer?.phone && (stay.pet.foodNotes || stay.pet.medicalNotes || (stay.pet.medications && stay.pet.medications.length > 0)) && (() => {
            const lines = [
              `🐾 הוראות טיפול — ${stay.pet.name}`,
              stay.room ? `חדר: ${stay.room.name}` : "",
              "",
            ];
            if (stay.pet.foodNotes) {
              lines.push(`🍽️ *הוראות האכלה:*`);
              lines.push(stay.pet.foodNotes);
              lines.push("");
            }
            if (stay.pet.medications && stay.pet.medications.length > 0) {
              lines.push(`💊 *תרופות:*`);
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
              lines.push(`🏥 *הערות רפואיות:*`);
              lines.push(stay.pet.medicalNotes);
            }
            const waText = lines.filter((l, i) => !(l === "" && lines[i - 1] === "")).join("\n").trim();
            return (
              <a
                href={`https://api.whatsapp.com/send?phone=${toWhatsAppPhone(stay.customer!.phone)}&text=${encodeURIComponent(waText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                title="שלח הוראות טיפול"
                onClick={(e) => e.stopPropagation()}
              >
                <MessageCircle className="w-3 h-3" />
                <span className="hidden sm:inline">הוראות</span>
              </a>
            );
          })()}
          <button className="btn-ghost text-xs" onClick={() => onExtend(stay.id)} title="הארך שהות">
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">הארך</span>
          </button>
          <button className="btn-ghost text-xs" onClick={() => onCheckout(stay.id)}>
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">צ׳ק-אאוט</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Pet Health Alert Panel ──────────────────────────────────────────────────

function PetHealthAlert({ pet }: { pet: BoardingStay["pet"] }) {
  const warnings: { icon: string; text: string; urgent: boolean }[] = [];

  if (pet.behavior?.dogAggression) warnings.push({ icon: "🐕", text: "תוקפנות כלפי כלבים", urgent: true });
  if (pet.behavior?.humanAggression) warnings.push({ icon: "👤", text: "תוקפנות כלפי אנשים", urgent: true });
  if (pet.behavior?.biteHistory) warnings.push({ icon: "⚠️", text: pet.behavior.biteDetails ? `היסטוריית נשיכה: ${pet.behavior.biteDetails}` : "היסטוריית נשיכה", urgent: true });
  if (pet.behavior?.resourceGuarding) warnings.push({ icon: "🛡️", text: "שמירת משאבים", urgent: true });
  if (pet.behavior?.leashReactivity) warnings.push({ icon: "🔗", text: "ריאקטיביות בשרשרת", urgent: false });
  if (pet.behavior?.separationAnxiety) warnings.push({ icon: "😰", text: "חרדת נטישה", urgent: false });
  if (pet.health?.allergies) warnings.push({ icon: "🌿", text: `אלרגיות: ${pet.health.allergies}`, urgent: false });
  if (pet.health?.medicalConditions) warnings.push({ icon: "🏥", text: `מצב רפואי: ${pet.health.medicalConditions}`, urgent: false });
  if (pet.health?.activityLimitations) warnings.push({ icon: "🦮", text: `הגבלות תנועה: ${pet.health.activityLimitations}`, urgent: false });
  if (pet.medications && pet.medications.length > 0) {
    pet.medications.forEach((m) => {
      warnings.push({ icon: "💊", text: `תרופה: ${m.medName}${m.dosage ? ` · ${m.dosage}` : ""}${m.frequency ? ` · ${m.frequency}` : ""}`, urgent: false });
    });
  }

  if (warnings.length === 0) return null;

  const hasUrgent = warnings.some((w) => w.urgent);

  return (
    <div className={cn("rounded-xl p-3 border text-sm", hasUrgent ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200")}>
      <div className="flex items-center gap-1.5 mb-2">
        <ShieldAlert className={cn("w-4 h-4", hasUrgent ? "text-red-600" : "text-amber-600")} />
        <span className={cn("font-semibold text-xs", hasUrgent ? "text-red-700" : "text-amber-700")}>
          {hasUrgent ? "⚠️ שים לב — מידע חשוב על הכלב" : "מידע על הכלב"}
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
            <h2 className="text-lg font-bold text-petra-text">צ׳ק-אין</h2>
            <p className="text-sm text-petra-muted mt-0.5">{stay.pet.name} — {stay.customer?.name ?? "כלב שירות"}</p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-petra-muted">חדר:</span>
              <span className="font-medium">{stay.room?.name || "לא שובץ"}</span>
            </div>
            {stay.yard && (
              <div className="flex justify-between">
                <span className="text-petra-muted">חצר:</span>
                <span className="font-medium text-teal-700">{stay.yard.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-petra-muted">תאריך כניסה:</span>
              <span className="font-medium">{formatDateFull(stay.checkIn)}</span>
            </div>
            {stay.checkOut && (
              <div className="flex justify-between">
                <span className="text-petra-muted">תאריך יציאה מתוכנן:</span>
                <span className="font-medium">{formatDateFull(stay.checkOut)}</span>
              </div>
            )}
          </div>

          <PetHealthAlert pet={stay.pet} />

          <div>
            <label className="label">שעת כניסה בפועל</label>
            <input type="time" className="input" value={actualTime} onChange={(e) => setActualTime(e.target.value)} />
          </div>

          {isEarly && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              כניסה מוקדמת — שעת הצ׳ק-אין המוגדרת היא {configuredTime}
            </div>
          )}

          <div>
            <label className="label">הערות צ׳ק-אין</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="הערות לכניסה..." />
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
                💊 צור משימות תרופות אוטומטיות ({stay.pet.medications!.length})
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
            {isPending ? "מבצע..." : "אשר צ׳ק-אין"}
          </button>
          <button className="btn-secondary" onClick={onCancel}>ביטול</button>
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
              description: `פנסיון — ${stay.pet.name} (${nights} ${calcMode === "nights" ? "לילות" : "ימים"})`,
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
      const linkBlock = link ? `\n\n💳 לתשלום מאובטח לחצו כאן:\n${link}` : "";
      if (!link) {
        toast.warning("לא הוגדר קישור תשלום — ההודעה נשלחת ללא לינק (להגדרת Stripe: הגדרות ← אינטגרציות)");
      }
      const discountLine = discountAmount > 0 ? `\nהנחה: −₪${discountAmount.toFixed(0)}` : "";
      const msg = `שלום ${stay.customer.name}! 😊\nתודה שהיה לנו את ${stay.pet.name} בפנסיון.\nסיכום השהייה: ${nights} ${calcMode === "nights" ? "לילות" : "ימים"} × ₪${pricePerNight} = ₪${subtotal.toFixed(0)}.${discountLine}\nלתשלום: ₪${total.toFixed(0)}\n\nנשמח לקבל תשלום 🙏${linkBlock}`;
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
            <h2 className="text-lg font-bold text-petra-text">צ׳ק-אאוט</h2>
            <p className="text-sm text-petra-muted mt-0.5">{stay.pet.name} — {stay.customer?.name ?? "כלב שירות"}</p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-petra-muted">חיה:</span>
              <span className="font-medium">{stay.pet.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-petra-muted">לקוח:</span>
              <span className="font-medium">{stay.customer?.name ?? "כלב שירות"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-petra-muted">חדר:</span>
              <span className="font-medium">{stay.room?.name || "—"}</span>
            </div>
            {stay.yard && (
              <div className="flex justify-between">
                <span className="text-petra-muted">חצר:</span>
                <span className="font-medium text-teal-700">{stay.yard.name}</span>
              </div>
            )}
            <div className="divider" />
            <div className="flex justify-between">
              <span className="text-petra-muted">כניסה:</span>
              <span className="font-medium">{formatDateFull(stay.checkIn)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-petra-muted">יציאה:</span>
              <span className="font-medium">{stay.checkOut ? formatDateFull(stay.checkOut) : "היום"}</span>
            </div>
            <div className="divider" />
            <div className="flex justify-between items-center">
              <span className="text-petra-muted">משך שהייה:</span>
              <span className="text-base font-bold text-brand-600">
                {nights} {calcMode === "nights" ? "לילות" : "ימים"}
              </span>
            </div>
          </div>

          {stay.customer && (
            <StayBillingBlock
              stay={stay}
              nights={nights}
              defaultPricePerNight={pricePerNight}
              unitLabel={calcMode === "nights" ? "לילות" : "ימים"}
            />
          )}

          {isLate && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              יציאה מאוחרת — שעת הצ׳ק-אאוט המוגדרת היא {configuredCheckoutTime}
            </div>
          )}

          {/* Pricing — overrideable per stay */}
          {stay.customer && (
            <div className="p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="label text-xs">מחיר ל{calcMode === "nights" ? "לילה" : "יום"} (₪)</label>
                  <input
                    type="number"
                    min={0}
                    className="input w-full text-sm"
                    value={pricePerNight}
                    onChange={(e) => setPricePerNight(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="flex-1">
                  <label className="label text-xs">הנחה</label>
                  <select
                    className="input w-full text-sm"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as "none" | "percent" | "fixed")}
                  >
                    <option value="none">ללא הנחה</option>
                    <option value="percent">הנחה %</option>
                    <option value="fixed">הנחה ₪</option>
                  </select>
                </div>
                {discountType !== "none" && (
                  <div className="w-24">
                    <label className="label text-xs">{discountType === "percent" ? "%" : "₪"}</label>
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
                  <span>סכום ביניים</span>
                  <span>₪{subtotal.toLocaleString()}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>הנחה{discountType === "percent" ? ` (${discountValue}%)` : ""}</span>
                    <span>−₪{discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-petra-text border-t pt-1">
                  <span>לתשלום</span>
                  <span>₪{total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="label">הערות צ׳ק-אאוט</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="הערות ליציאה..." />
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
            {sendingPaymentRequest ? "מכין קישור..." : "שלח בקשת תשלום בוואטסאפ"}
          </button>
        )}

        <div className="flex gap-3 mt-2">
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={isPending}
            onClick={() => onConfirm({ notes })}
          >
            <LogOut className="w-4 h-4" />
            {isPending ? "מבצע..." : "אשר צ׳ק-אאוט"}
          </button>
          <button className="btn-secondary" onClick={onCancel}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Stay Dialog ────────────────────────────────────────────────────────

/** Reached by clicking a dog inside a room: edit the stay's dates, room and notes. */
/** Opening a card from the booking dialog navigates in the same window (an installed app opened a
 * new window per click — גבעת הכלבים 22/11/2026); the boarding page reads this back and returns to
 * the timeline at the same day. */
const BOARDING_RETURN_KEY = "petra.boarding.return";
function rememberTimelineReturn(day: string) {
  try { sessionStorage.setItem(BOARDING_RETURN_KEY, JSON.stringify({ day, at: Date.now() })); } catch { /* storage unavailable */ }
}

function EditStayDialog({
  stay,
  rooms,
  onSave,
  onCancel,
  isPending,
  onConfirmTentative,
  isConfirming = false,
  stays = [],
  onCheckin,
  onCheckout,
  defaultPricePerNight = 0,
}: {
  stay: BoardingStay;
  rooms: Room[];
  /** Business default nightly price — the billing block starts from the room's price, else this. */
  defaultPricePerNight?: number;
  /** All loaded stays — used to mark rooms that are full on the chosen dates. */
  stays?: BoardingStay[];
  /** Opens the regular check-in / check-out dialog for this stay. */
  onCheckin?: () => void;
  onCheckout?: () => void;
  onSave: (data: { checkIn: string; checkOut: string | null; roomId: string | null; notes: string; isTentative?: boolean }) => void;
  onCancel: () => void;
  isPending: boolean;
  /** "אשר הזמנה" on a temporary hold — saves `isTentative: false` right away. */
  onConfirmTentative?: () => void;
  isConfirming?: boolean;
}) {
  const toLocalInput = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [checkIn, setCheckIn] = useState(toLocalInput(stay.checkIn));
  const [checkOut, setCheckOut] = useState(stay.checkOut ? toLocalInput(stay.checkOut) : "");
  const [roomId, setRoomId] = useState(stay.room?.id ?? "");
  const [notes, setNotes] = useState(stay.notes ?? "");
  const initialTentative = stay.isTentative === true;
  const [isTentative, setIsTentative] = useState(initialTentative);
  // The stay can be confirmed from the banner while the dialog stays open — follow it.
  useEffect(() => { setIsTentative(initialTentative); }, [initialTentative]);
  const isReserved = stay.status === "reserved";
  const tentativeNow = isTentativeStay(stay);
  const petHref = stay.pet.serviceDogProfile
    ? `/service-dogs/${stay.pet.serviceDogProfile.id}`
    : `/pets/${stay.pet.id}`;

  const invalidRange = !!checkOut && new Date(checkOut) <= new Date(checkIn);
  const nights = checkOut && !invalidRange ? calcNights(checkIn, checkOut) : 0;

  // Rooms that are full for the chosen dates (same rule as the server: shared nights, this stay excluded).
  const fullRoomIds = useMemo(() => {
    const full = new Set<string>();
    if (!checkIn || invalidRange) return full;
    const range = { checkIn: new Date(checkIn).toISOString(), checkOut: checkOut ? new Date(checkOut).toISOString() : null };
    for (const room of rooms) {
      const taken = stays.filter(
        (s) => s.id !== stay.id && s.room?.id === room.id && ACTIVE_STATUSES.includes(s.status) && staysShareNight(s, range)
      ).length;
      if (taken >= room.capacity) full.add(room.id);
    }
    return full;
  }, [checkIn, checkOut, invalidRange, rooms, stays, stay.id]);
  const chosenRoomFull = !!roomId && roomId !== (stay.room?.id ?? "") && fullRoomIds.has(roomId);

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onCancel} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[85dvh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-petra-text">עריכת הזמנה</h2>
            <p className="text-sm text-petra-muted mt-0.5">{stay.pet.name} — {stay.customer?.name ?? "כלב שירות"}</p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {tentativeNow && (
          <div className="mb-4 p-3 rounded-lg border border-dashed border-amber-400 bg-amber-50 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-[10rem]">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-amber-900">{TENTATIVE_FULL_LABEL}</span>
            </div>
            {onConfirmTentative && (
              <button
                type="button"
                className="btn-primary text-sm py-1.5"
                disabled={isConfirming || isPending}
                onClick={onConfirmTentative}
              >
                <CheckCircle2 className="w-4 h-4" />
                {isConfirming ? "מאשר..." : "אשר הזמנה"}
              </button>
            )}
          </div>
        )}

        <div className={cn("mb-4 grid gap-2", stay.customer ? "grid-cols-2" : "grid-cols-1")}>
          {stay.customer && (
            <Link
              href={`/customers/${stay.customer.id}`}
              onClick={() => rememberTimelineReturn(israelDayKey(stay.checkIn))}
              className="flex items-center justify-center gap-1.5 min-w-0 px-2 py-2 rounded-lg border border-brand-200 bg-brand-50 text-xs sm:text-sm font-medium text-brand-700 hover:bg-brand-100 transition-colors"
            >
              <Users className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">פתח כרטיס לקוח</span>
            </Link>
          )}
          <Link
            href={petHref}
            onClick={() => rememberTimelineReturn(israelDayKey(stay.checkIn))}
            className="flex items-center justify-center gap-1.5 min-w-0 px-2 py-2 rounded-lg border border-brand-200 bg-brand-50 text-xs sm:text-sm font-medium text-brand-700 hover:bg-brand-100 transition-colors"
          >
            <PawPrint className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">פתח כרטיס כלב</span>
          </Link>
        </div>

        {((stay.status === "reserved" && onCheckin) || (stay.status === "checked_in" && onCheckout)) && (
          <div className="mb-4">
            {stay.status === "reserved" ? (
              <button type="button" className="btn-secondary w-full justify-center text-sm" onClick={onCheckin}>
                <LogIn className="w-4 h-4" />
                צ׳ק-אין
              </button>
            ) : (
              <button type="button" className="btn-secondary w-full justify-center text-sm" onClick={onCheckout}>
                <LogOut className="w-4 h-4" />
                צ׳ק-אאוט
              </button>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">כניסה</label>
              <input type="datetime-local" lang="he" className="input w-full text-sm" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">יציאה</label>
              <input type="datetime-local" lang="he" className="input w-full text-sm" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
          </div>

          {invalidRange && (
            <p className="text-xs text-red-600">תאריך היציאה חייב להיות אחרי תאריך הכניסה</p>
          )}
          {nights > 0 && (
            <p className="text-xs text-petra-muted">{nights} לילות</p>
          )}

          <div>
            <label className="label text-xs">חדר</label>
            <select className="input w-full text-sm" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">ללא חדר</option>
              {rooms.filter((r) => r.isActive).map((r) => {
                const full = fullRoomIds.has(r.id) && r.id !== (stay.room?.id ?? "");
                return (
                  <option key={r.id} value={r.id} disabled={full}>
                    {r.name}{r.registrationOnly ? " · רישום בלבד" : ""}{full ? " — מלא בתאריכים" : ""}
                  </option>
                );
              })}
            </select>
            {fullRoomIds.size > 0 && (
              <p className="text-[11px] text-petra-muted mt-1">חדרים מלאים בתאריכים שנבחרו מסומנים ולא ניתנים לבחירה</p>
            )}
            {chosenRoomFull && (
              <p className="text-xs text-red-600 mt-1">החדר מלא בתאריכים האלה — בחרו חדר אחר</p>
            )}
          </div>

          <div>
            <label className="label text-xs">הערות</label>
            <textarea className="input w-full text-sm" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {isReserved && (
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 accent-amber-500 flex-shrink-0"
                checked={isTentative}
                onChange={(e) => setIsTentative(e.target.checked)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-petra-text">{TENTATIVE_FULL_LABEL}</span>
                <span className="block text-xs text-petra-muted mt-0.5">השהייה תופסת את החדר עד שמאשרים אותה</span>
              </span>
            </label>
          )}

          {stay.customer && (
            <StayBillingBlock
              stay={stay}
              nights={stay.checkOut ? calcNights(stay.checkIn, stay.checkOut) : 0}
              defaultPricePerNight={rooms.find((r) => r.id === stay.room?.id)?.pricePerNight ?? defaultPricePerNight}
            />
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={isPending || invalidRange || !checkIn || chosenRoomFull}
            onClick={() =>
              onSave({
                checkIn: new Date(checkIn).toISOString(),
                checkOut: checkOut ? new Date(checkOut).toISOString() : null,
                roomId: roomId || null,
                notes,
                ...(isReserved && isTentative !== initialTentative ? { isTentative } : {}),
              })
            }
          >
            {isPending ? "שומר..." : "שמור שינויים"}
          </button>
          <button className="btn-secondary" onClick={onCancel}>ביטול</button>
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
            <h2 className="text-lg font-bold text-petra-text">{hasCheckout ? "הארכת שהות" : "הגדרת תאריך יציאה"}</h2>
            <p className="text-sm text-petra-muted mt-0.5">{stay.pet.name} — {stay.customer?.name ?? "כלב שירות"}</p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-petra-muted">כניסה:</span>
              <span className="font-medium">{new Date(stay.checkIn).toLocaleDateString("he-IL")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-petra-muted">יציאה נוכחית:</span>
              <span className="font-medium">{hasCheckout ? new Date(stay.checkOut!).toLocaleDateString("he-IL") : "שהות פתוחה — לא הוגדר תאריך"}</span>
            </div>
          </div>
          <div>
            <label className="label">{hasCheckout ? "תאריך יציאה חדש *" : "תאריך יציאה *"}</label>
            <input
              type="date" lang="he"
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
            {isPending ? "שומר..." : hasCheckout ? "עדכן תאריך יציאה" : "הגדר תאריך יציאה"}
          </button>
          <button className="btn-secondary" onClick={onCancel}>ביטול</button>
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
  if (data.expired > 0) summaryParts.push(`${data.expired} פג תוקף`);
  if ((data.notVaccinated ?? 0) > 0) summaryParts.push(`${data.notVaccinated} לא חוסן`);
  if (data.expiringSoon > 0) summaryParts.push(`${data.expiringSoon} פוגים בקרוב`);

  return (
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-3 text-right"
      >
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-amber-900">
            {summaryParts.length > 0 ? `כלבים: ${summaryParts.join(" · ")}` : `${data.expiringSoon} כלבים עם חיסון פג בקרוב`}
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
                ? `שלום ${alert.customerName}, הכלב ${alert.petName} אינו מחוסן. נא לחסן לפני הכניסה לפנסיון.`
                : `שלום ${alert.customerName}, חיסון הכלב של ${alert.petName} פג תוקף${alert.rabiesValidUntil ? ` בתאריך ${formatDate(alert.rabiesValidUntil)}` : ""}. נא לחדש לפני הכניסה לפנסיון.`
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
                    <span className="text-xs font-medium text-orange-600">לא חוסן</span>
                  ) : alert.rabiesValidUntil ? (
                    <span
                      className={cn(
                        "text-xs font-medium",
                        alert.status === "expired" ? "text-red-600" : "text-amber-700"
                      )}
                    >
                      כלב: {formatDate(alert.rabiesValidUntil)}
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
                    תזכורת
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
              הצג עוד {data.alerts.length - 3}...
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Training Minutes Field ───────────────────────────────────────────────────

function TrainingMinutesField({ stay }: { stay: BoardingStay }) {
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
    onError: () => toast.error("שגיאה בשמירת דקות אימון"),
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
        <span className="text-xs text-petra-muted">דק׳ אימון</span>
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
      title="ערוך דקות אימון יומי"
    >
      <Sparkles className="w-3 h-3" />
      {stay.dailyTrainingMinutes ? `${stay.dailyTrainingMinutes} דק׳ אימון` : "הוסף דקות אימון"}
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

const CARE_LOG_TYPES = [
  { value: "FEEDING", label: "האכלה", emoji: "🍽️" },
  { value: "MEDICATION", label: "תרופה", emoji: "💊" },
  { value: "WALK", label: "טיול", emoji: "🦮" },
  { value: "NOTE", label: "הערה", emoji: "📝" },
];

function CareLogModal({ stayId, petName, onClose }: { stayId: string; petName: string; onClose: () => void }) {
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
        if (!r.ok) throw new Error("שגיאה");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["care-logs", stayId] });
      setTitle("");
      setNotes("");
      toast.success("רישום נוסף");
    },
    onError: () => toast.error("שגיאה בהוספת רישום"),
  });

  const deleteMutation = useMutation({
    mutationFn: (logId: string) =>
      fetch(`/api/boarding/${stayId}/care-logs?logId=${logId}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["care-logs", stayId] });
    },
    onError: () => toast.error("שגיאה במחיקת הרישום"),
  });

  const typeConfig = Object.fromEntries(CARE_LOG_TYPES.map((t) => [t.value, t]));

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[85dvh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-brand-500" />
            יומן טיפול — {petName}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Add form */}
        <div className="p-3 bg-slate-50 rounded-xl mb-4 space-y-2">
          <div className="flex gap-1 flex-wrap">
            {CARE_LOG_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setLogType(t.value)}
                className={cn(
                  "px-2 py-1 rounded-lg text-xs font-medium border transition-all",
                  logType === t.value
                    ? "bg-brand-500 text-white border-brand-500"
                    : "bg-white text-petra-muted border-slate-200"
                )}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
          <input
            className="input text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="כותרת הרישום *"
          />
          <input
            className="input text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="הערות (אופציונלי)"
          />
          <button
            className="btn-primary w-full text-sm py-1.5"
            disabled={!title.trim() || addMutation.isPending}
            onClick={() => addMutation.mutate()}
          >
            {addMutation.isPending ? "שומר..." : "הוסף רישום"}
          </button>
        </div>

        {/* Log timeline */}
        {isLoading && <PetraLoader variant="inline" />}
        {!isLoading && logs.length === 0 && (
          <p className="text-center text-sm text-petra-muted py-4">אין רישומים עדיין</p>
        )}
        {logs.map((log) => {
          const tc = typeConfig[log.type] ?? { emoji: "📋", label: log.type };
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
                  {new Date(log.doneAt).toLocaleDateString("he-IL")} · {new Date(log.doneAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
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
  const { canExportData, canManageBoarding, canWritePayments } = usePermissions();
  const [showNewStay, setShowNewStay] = useState(false);
  const [careLogStay, setCareLogStay] = useState<{ id: string; petName: string } | null>(null);
  const [form, setForm] = useState({
    customerId: "", petIds: [] as string[], roomId: "", checkIn: "", checkOut: "", checkInTime: "12:00", checkOutTime: "12:00", notes: "", pricePerNight: 0, createOrder: true, assignedToUserId: "",
    // Retroactive stays (dog already in the pension before the business joined Petra):
    // "" = let the server decide (reserved), or an explicit status for backdated dates.
    status: "" as "" | "reserved" | "checked_in" | "checked_out",
    // Temporary hold while the customer comes to sign the contract — sent only for reserved stays.
    isTentative: false,
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
  const [editStay, setEditStay] = useState<BoardingStay | null>(null);
  // Timeline: continuous scroll — "היום" / the date picker ask it to scroll to a day.
  const [timelineJump, setTimelineJump] = useState<TimelineScrollRequest>(() => ({ day: localDayKey(new Date()), n: 0 }));
  // Compact timeline (many days + rooms on one screen) — remembered per browser.
  const [timelineCompact, setTimelineCompact] = useState(false);
  useEffect(() => {
    try { setTimelineCompact(window.localStorage.getItem(TL_COMPACT_STORAGE_KEY) === "1"); } catch { /* storage blocked */ }
  }, []);
  // Full-screen timeline (גבעת הכלבים 22/11/2026): a fixed layer over the page, Esc closes it.
  const [timelineFull, setTimelineFull] = useState(false);
  useEffect(() => {
    if (!timelineFull) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector(".modal-overlay")) setTimelineFull(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [timelineFull]);
  // Back from a customer / dog card opened in the booking dialog → the timeline at the same day.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(BOARDING_RETURN_KEY);
      if (!raw) return;
      sessionStorage.removeItem(BOARDING_RETURN_KEY);
      const { day, at } = JSON.parse(raw) as { day?: string; at?: number };
      if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !at || Date.now() - at > 2 * 60 * 60 * 1000) return;
      setViewMode("timeline");
      setTimelineJump((j) => ({ day, n: j.n + 1 }));
    } catch { /* storage unavailable */ }
  }, []);
  const toggleTimelineCompact = () => {
    setTimelineCompact((v) => {
      const next = !v;
      try { window.localStorage.setItem(TL_COMPACT_STORAGE_KEY, next ? "1" : "0"); } catch { /* storage blocked */ }
      return next;
    });
  };

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
  const [editRoomForm, setEditRoomForm] = useState({ name: "", capacity: 1, type: "standard", pricePerNight: "" as string | number, registrationOnly: false });
  const [newRoomForm, setNewRoomForm] = useState({ name: "", capacity: 1, type: "standard", pricePerNight: "" as string | number, registrationOnly: false });

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

  // Deep link `/boarding?stay=<id>` (customer card, dashboard…) → open that stay's edit dialog
  // on the timeline at its check-in day, then drop the param so a refresh does not reopen it.
  const router = useRouter();
  const deepLinkHandledRef = useRef(false);
  useEffect(() => {
    if (deepLinkHandledRef.current || isLoading) return;
    let stayId: string | null = null;
    try { stayId = new URLSearchParams(window.location.search).get("stay"); } catch { /* no window */ }
    if (!stayId) { deepLinkHandledRef.current = true; return; }
    deepLinkHandledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    params.delete("stay");
    const rest = params.toString();
    router.replace(`/boarding${rest ? `?${rest}` : ""}`, { scroll: false });

    const open = (stay: BoardingStay) => {
      setViewMode("timeline");
      setTimelineJump((j) => ({ day: localDayKey(new Date(stay.checkIn)), n: j.n + 1 }));
      setEditStay(stay);
    };
    const loaded = stays.find((s) => s.id === stayId);
    if (loaded) { open(loaded); return; }
    fetchJSON<BoardingStay>(`/api/boarding/${encodeURIComponent(stayId)}`)
      .then((stay) => open({ ...stay, yard: stay.yard ?? null }))
      .catch(() => toast.error("השהייה לא נמצאה"));
  }, [isLoading, stays, router]);

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
            ...(data.isTentative && !serviceDogMode && (!data.status || data.status === "reserved") ? { isTentative: true } : {}),
          }),
        }).then(async (r) => { if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Failed"); } return r.json(); })
      );
      const created = (await Promise.all(promises)) as { id: string; checkIn: string; checkOut: string | null; petId: string }[];
      // One payment order per stay, linked to it (round 2, דור 23/11/2026). The stays already
      // exist — a failed order is reported but does not undo them.
      let orderFailed = false;
      const nights = checkOutDT ? calcNights(checkInDT, checkOutDT) : 0;
      if (data.createOrder && canWritePayments && data.customerId && !serviceDogMode && nights > 0 && data.pricePerNight > 0) {
        for (const stay of created) {
          const petName = selectedCustomer?.pets.find((p) => p.id === stay.petId)?.name ?? "";
          try {
            const r = await fetch("/api/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                customerId: data.customerId,
                orderType: "boarding",
                status: "confirmed",
                petId: stay.petId,
                startAt: stay.checkIn,
                endAt: stay.checkOut,
                relatedEntityType: "BoardingStay",
                relatedEntityId: stay.id,
                suppressPaymentRequest: true,
                lines: [{ name: `פנסיון${petName ? ` — ${petName}` : ""}`, unit: "לילה", quantity: nights, unitPrice: data.pricePerNight }],
              }),
            });
            if (!r.ok) orderFailed = true;
          } catch {
            orderFailed = true;
          }
        }
      }
      return { created, orderFailed, withOrder: data.createOrder && nights > 0 && data.pricePerNight > 0 && canWritePayments };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["boarding"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["boarding-billing"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (res?.orderFailed) toast.error("השהייה נוצרה, אבל יצירת ההזמנה הכספית נכשלה — אפשר ליצור אותה מחלון השהייה");
      setShowNewStay(false);
      setForm({ customerId: "", petIds: [], roomId: "", checkIn: "", checkOut: "", checkInTime: settings.boardingCheckInTime || "14:00", checkOutTime: settings.boardingCheckOutTime || "11:00", notes: "", pricePerNight: settings.boardingPricePerNight || 150, createOrder: true, assignedToUserId: "", status: "", isTentative: false });
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
    mutationFn: ({ id, ...data }: { id: string; checkIn: string; checkOut: string | null; roomId: string | null; notes: string; isTentative?: boolean }) =>
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

  const confirmTentativeMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJSON<BoardingStay>(`/api/boarding/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTentative: false }),
      }),
    onSuccess: (_data, id) => {
      setEditStay((s) => (s && s.id === id ? { ...s, isTentative: false } : s));
      toast.success("ההזמנה אושרה");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "שגיאה באישור ההזמנה");
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
    mutationFn: (data: { name: string; capacity: number; type: string; pricePerNight: string | number; registrationOnly: boolean }) =>
      fetch("/api/boarding/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, pricePerNight: data.pricePerNight !== "" ? Number(data.pricePerNight) : null }),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setNewRoomForm({ name: "", capacity: 1, type: "standard", pricePerNight: "", registrationOnly: false });
      toast.success("החדר נוצר בהצלחה");
    },
    onError: () => toast.error("שגיאה ביצירת החדר. נסה שוב."),
  });

  const updateRoomMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; capacity: number; type: string; pricePerNight: string | number; registrationOnly: boolean }) =>
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
    setEditRoomForm({ name: room.name, capacity: room.capacity, type: room.type, pricePerNight: room.pricePerNight ?? "", registrationOnly: room.registrationOnly === true });
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
    if (!canManageBoarding) return;
    setActiveStayId(String(event.active.id));
  }, [canManageBoarding]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveStayId(null);
    // Moving a stay between rooms needs BOARDING_MANAGE (the server answers 403 too).
    if (!canManageBoarding) return;
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
  }, [stays, roomMutation, canManageBoarding]);

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
            // Same rule as the server capacity check: shared nights, hours ignored.
            staysShareNight(s, {
              checkIn: `${form.checkIn}T${form.checkInTime || "12:00"}:00`,
              checkOut: `${form.checkOut}T${form.checkOutTime || "12:00"}:00`,
            })
        ).length;
        return [room.id, overlapping < room.capacity];
      })
    );
  }, [form.checkIn, form.checkOut, form.checkInTime, form.checkOutTime, rooms, stays]);

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
  // "רישום בלבד" rooms are left out of the free / occupied counters.
  const availableRooms = rooms.filter((r) => !r.registrationOnly && getRoomDisplayStatus(r) === "available").length;
  const occupiedRooms = rooms.filter((r) => !r.registrationOnly && getRoomDisplayStatus(r) === "occupied").length;
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
              <button
                type="button"
                onClick={() => setTimelineJump((j) => ({ day: localDayKey(new Date()), n: j.n + 1 }))}
                className="px-2 py-1 rounded-md bg-orange-50 text-orange-700 font-medium hover:bg-orange-100"
                title="גלילה להיום"
              >
                היום
              </button>
              <input
                type="date" lang="he"
                className="input !py-1 !px-2 text-xs w-[8.5rem]"
                value={timelineJump.day}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) setTimelineJump((j) => ({ day: v, n: j.n + 1 }));
                }}
                title="קפיצה לתאריך בציר הזמן (אפשר גם אחורה)"
              />
              <button
                type="button"
                onClick={toggleTimelineCompact}
                aria-pressed={timelineCompact}
                className={cn(
                  "px-2 py-1 rounded-md font-medium border transition-all",
                  timelineCompact
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-petra-muted border-slate-200 hover:text-petra-text"
                )}
                title="עמודות צרות ושורות דקות — יותר ימים וחדרים במסך אחד"
              >
                תצוגה מצומצמת
              </button>
              <button
                type="button"
                onClick={() => setTimelineFull(true)}
                className="px-2 py-1 rounded-md font-medium border bg-white text-petra-muted border-slate-200 hover:text-petra-text inline-flex items-center gap-1"
                title="הצגת ציר הזמן על כל המסך"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                מסך מלא
              </button>
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
                  canDrag={canManageBoarding}
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
                    canDrag={canManageBoarding}
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
            <>
              {timelineFull ? (
                <div className="fixed inset-0 z-[49] bg-slate-50 flex flex-col p-2 sm:p-3 pb-20 md:pb-3" dir="rtl" data-no-pull-refresh>
                  <div className="flex items-center gap-2 mb-2 flex-wrap text-xs">
                    <h2 className="text-sm font-bold text-petra-text me-auto">ציר זמן — פנסיון</h2>
                    <button
                      type="button"
                      onClick={() => setTimelineJump((j) => ({ day: localDayKey(new Date()), n: j.n + 1 }))}
                      className="px-2 py-1 rounded-md font-medium border bg-white text-petra-muted border-slate-200 hover:text-petra-text"
                    >
                      היום
                    </button>
                    <button
                      type="button"
                      onClick={toggleTimelineCompact}
                      aria-pressed={timelineCompact}
                      className={cn(
                        "px-2 py-1 rounded-md font-medium border",
                        timelineCompact ? "bg-slate-800 text-white border-slate-800" : "bg-white text-petra-muted border-slate-200 hover:text-petra-text"
                      )}
                    >
                      תצוגה מצומצמת
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimelineFull(false)}
                      className="px-2 py-1 rounded-md font-medium border bg-white text-petra-text border-slate-300 hover:bg-slate-100 inline-flex items-center gap-1"
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                      סגור מסך מלא
                    </button>
                  </div>
                  <TimelineView rooms={rooms} stays={stays} search={searchNorm} onOpenStay={setEditStay} canDrag={canManageBoarding} scrollTo={timelineJump} compact={timelineCompact} fullHeight />
                </div>
              ) : (
                <TimelineView rooms={rooms} stays={stays} search={searchNorm} onOpenStay={setEditStay} canDrag={canManageBoarding} scrollTo={timelineJump} compact={timelineCompact} />
              )}
              <div className="flex gap-3 mt-2 flex-wrap text-[10px] text-petra-muted">
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ backgroundColor: "#94A3B8" }} /> הזמנה</div>
                <div className="flex items-center gap-1">
                  <div
                    className="w-3 h-3 rounded border border-dashed border-amber-600"
                    style={{ backgroundColor: "#FCD34D", backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.45) 0 3px, transparent 3px 6px)" }}
                  />
                  {TENTATIVE_FULL_LABEL}
                </div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ backgroundColor: "#22C55E" }} /> בפנסיון</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ backgroundColor: "#3B82F6" }} /> יצא</div>
              </div>
            </>
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
                        <label className="flex items-start gap-2 text-xs text-petra-text cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={editRoomForm.registrationOnly}
                            onChange={(e) => setEditRoomForm({ ...editRoomForm, registrationOnly: e.target.checked })}
                          />
                          <span>
                            <span className="font-medium">רישום בלבד (לא נספר בתפוסה)</span>
                            <span className="block text-[11px] text-petra-muted">החדר מופיע ביומן ואפשר לרשום בו שהיות, אבל הוא לא נספר בתפוסה ובבדיקות זמינות (למשל חדרי התרשמות והרגלה)</span>
                          </span>
                        </label>
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
                          {room.registrationOnly && (
                            <span className="mr-2 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">רישום בלבד</span>
                          )}
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
                <label className="flex items-start gap-2 text-sm text-petra-text cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={newRoomForm.registrationOnly}
                    onChange={(e) => setNewRoomForm({ ...newRoomForm, registrationOnly: e.target.checked })}
                  />
                  <span>
                    <span className="font-medium">רישום בלבד (לא נספר בתפוסה)</span>
                    <span className="block text-xs text-petra-muted">החדר מופיע ביומן ואפשר לרשום בו שהיות, אבל הוא לא נספר בתפוסה ובבדיקות זמינות (למשל חדרי התרשמות והרגלה)</span>
                  </span>
                </label>
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
                          {r.name} (היום {todayCount}/{r.capacity}){r.registrationOnly ? " · רישום בלבד" : ""}{roomStatus === "needs_cleaning" ? " — דרוש ניקיון" : ""}
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

              {/* Temporary hold — only for a stay that will be a plain reservation */}
              {!serviceDogMode && (!form.checkIn || form.checkIn >= new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }) || form.status === "reserved") && (
                <label className={cn(
                  "flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors",
                  form.isTentative ? "border-amber-300 bg-amber-50" : "border-slate-200 hover:bg-slate-50",
                )}>
                  <input
                    type="checkbox"
                    className="mt-0.5 w-4 h-4 accent-amber-500 flex-shrink-0"
                    checked={form.isTentative}
                    onChange={(e) => setForm((f) => ({ ...f, isTentative: e.target.checked }))}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-petra-text">{TENTATIVE_FULL_LABEL}</span>
                    <span className="block text-xs text-petra-muted mt-0.5">השהייה תופסת את החדר עד שמאשרים אותה</span>
                  </span>
                </label>
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
                  {canWritePayments && !serviceDogMode && form.customerId && (
                    <label className="flex items-center gap-2 pt-1.5 cursor-pointer text-sm text-petra-text">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-brand-500"
                        checked={form.createOrder}
                        onChange={(e) => setForm((f) => ({ ...f, createOrder: e.target.checked }))}
                      />
                      צור הזמנה כספית לשהייה{form.petIds.length > 1 ? " (הזמנה לכל כלב)" : ""}
                    </label>
                  )}
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
          onConfirmTentative={() => confirmTentativeMutation.mutate(editStay.id)}
          isConfirming={confirmTentativeMutation.isPending}
          stays={stays}
          defaultPricePerNight={settings.boardingPricePerNight || 0}
          onCheckin={() => { const s = editStay; setEditStay(null); setCheckinDialogStay(s); }}
          onCheckout={() => { const s = editStay; setEditStay(null); setCheckoutDialogStay(s); }}
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
