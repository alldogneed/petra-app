"use client";

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
  useSensor,
  useSensors,
} from "@dnd-kit/core";
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
} from "lucide-react";
import { cn, fetchJSON, toWhatsAppPhone } from "@/lib/utils";
import { BoardingTabs } from "@/components/boarding/BoardingTabs";
import { toast } from "sonner";

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

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  reserved:    { label: "הזמנה",  color: "#8B5CF6", bg: "#F5F3FF" },
  checked_in:  { label: "נמצא",   color: "#10B981", bg: "#ECFDF5" },
  checked_out: { label: "יצא",    color: "#64748B", bg: "#F1F5F9" },
  canceled:    { label: "בוטל",   color: "#EF4444", bg: "#FEF2F2" },
};

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
const TIMELINE_DAYS = 14;

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
  return Math.max(0, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

function calcStayProgress(checkIn: string, checkOut: string | null): number {
  if (!checkOut) return 0;
  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  const now = Date.now();
  const total = end - start;
  if (total <= 0) return 100;
  return Math.round(((now - start) / total) * 100);
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

function getRoomDisplayStatus(room: Room): string {
  const checkedIn = room.boardingStays.filter((s) => s.status === "checked_in");
  if (checkedIn.length > 0) return "occupied";
  if (room.status === "needs_cleaning") return "needs_cleaning";
  return "available";
}

// ─── Stay Progress Bar ──────────────────────────────────────────────────────

function StayProgress({ checkIn, checkOut }: { checkIn: string; checkOut: string | null }) {
  if (!checkOut) return null;
  const progress = calcStayProgress(checkIn, checkOut);
  const clamped = Math.min(progress, 100);
  const color = progress > 100 ? "bg-red-500" : progress >= 75 ? "bg-amber-500" : "bg-emerald-500";

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
        <span className={cn("text-[9px]", progress > 100 ? "text-red-500 font-semibold" : "text-petra-muted")}>
          {progress > 100 ? `חריגה! ${progress - 100}%` : `${progress}%`}
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
  occPeriodStays,
}: {
  room: Room;
  onCheckin: (id: string) => void;
  onCheckout: (id: string) => void;
  onMarkClean: (roomId: string) => void;
  occPeriodStays: BoardingStay[]; // always provided (date-filtered stays for this room)
}) {
  const { setNodeRef, isOver } = useDroppable({ id: room.id });
  const displayStatus = getRoomDisplayStatus(room);
  const statusConfig = ROOM_STATUS_MAP[displayStatus];

  // Display: always use date-filtered stays for the dog list
  const displayCheckedIn = occPeriodStays.filter((s) => s.status === "checked_in");
  const displayReserved = occPeriodStays.filter((s) => s.status === "reserved");

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
        isOver ? "ring-2 ring-brand-400 shadow-lg scale-[1.02]" : "hover:shadow-md"
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

        {/* Checked-in dogs for selected period — draggable */}
        {displayCheckedIn.map((stay) => (
          <DraggableStayInRoom key={stay.id} stayId={stay.id}>
            <div className="p-3 rounded-lg mb-2" style={{ background: "#FFF7ED", border: "1px solid #FDBA74" }}>
              <div className="flex items-center gap-2">
                <PawPrint className="w-4 h-4 text-orange-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-petra-text truncate">{stay.pet.name}</div>
                  {stay.pet.breed && <div className="text-xs text-petra-muted">{stay.pet.breed}</div>}
                  <div className="text-[10px] text-petra-muted">{stay.customer?.name ?? "כלב שירות"}</div>
                </div>
              </div>
              {stay.checkOut && (
                <div className="text-xs text-orange-600 font-medium mt-2 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  יציאה: {formatDate(stay.checkOut)}
                </div>
              )}
            </div>
          </DraggableStayInRoom>
        ))}

        {/* Reserved dogs for selected period — draggable */}
        {displayReserved.map((stay) => (
          <DraggableStayInRoom key={stay.id} stayId={stay.id}>
            <div className="p-3 rounded-lg mb-2" style={{ background: "#F5F3FF", border: "1px solid #C4B5FD" }}>
              <div className="flex items-center gap-2">
                <PawPrint className="w-4 h-4 text-purple-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-petra-text truncate">{stay.pet.name}</div>
                  <div className="text-xs text-petra-muted">{stay.customer?.name ?? "כלב שירות"}</div>
                </div>
              </div>
              <div className="text-xs text-purple-600 font-medium mt-2 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                כניסה: {formatDate(stay.checkIn)}
              </div>
            </div>
          </DraggableStayInRoom>
        ))}

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

        {/* Action buttons — based on current actual state, stop pointer propagation to prevent drag */}
        {hasCurrentStays && (
          <div className="mt-2 pt-2 border-t border-slate-100 space-y-1" onPointerDown={(e) => e.stopPropagation()}>
            {checkedIn.map((stay) => (
              <button
                key={stay.id}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                onClick={() => onCheckout(stay.id)}
              >
                <LogOut className="w-3.5 h-3.5" />צ׳ק-אאוט {stay.pet.name}
              </button>
            ))}
            {reserved.map((stay) => (
              <button
                key={stay.id}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
                onClick={() => onCheckin(stay.id)}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />צ׳ק-אין {stay.pet.name}
              </button>
            ))}
            {displayStatus === "needs_cleaning" && (
              <button
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-yellow-700 hover:bg-yellow-50 transition-colors"
                onClick={() => onMarkClean(room.id)}
              >
                <Sparkles className="w-3.5 h-3.5" />סמן כנקי
              </button>
            )}
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
        (s) => s.checkOut && toDateStr(s.checkOut) === dateStr
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

function TimelineView({
  rooms,
  stays,
  numDays = TIMELINE_DAYS,
}: {
  rooms: Room[];
  stays: BoardingStay[];
  numDays?: number;
}) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: numDays }, (_, i) => addDays(today, i));
  const timelineEnd = addDays(today, numDays);

  // Group stays by room
  const roomStaysMap = useMemo(() => {
    const map: Record<string, BoardingStay[]> = {};
    rooms.forEach((r) => { map[r.id] = []; });
    map["unassigned"] = [];

    stays
      .filter((s) => ACTIVE_STATUSES.includes(s.status))
      .filter((s) => {
        const checkIn = new Date(s.checkIn);
        const checkOut = s.checkOut ? new Date(s.checkOut) : addDays(today, numDays + 30);
        return checkIn < timelineEnd && checkOut > today;
      })
      .forEach((s) => {
        const key = s.room?.id || "unassigned";
        if (map[key]) map[key].push(s);
        else map["unassigned"].push(s);
      });

    return map;
  }, [rooms, stays, today, timelineEnd]);

  function getBarPosition(stay: BoardingStay) {
    const checkIn = startOfDay(new Date(stay.checkIn));
    const checkOut = stay.checkOut ? startOfDay(new Date(stay.checkOut)) : addDays(today, numDays);

    const visibleStart = checkIn < today ? today : checkIn;
    const visibleEnd = checkOut > timelineEnd ? timelineEnd : checkOut;

    const startOffset = diffDays(visibleStart, today);
    const endOffset = diffDays(visibleEnd, today);

    const left = (startOffset / numDays) * 100;
    const width = ((endOffset - startOffset) / numDays) * 100;

    return {
      left: `${Math.max(0, left)}%`,
      width: `${Math.max(2, Math.min(width, 100 - Math.max(0, left)))}%`,
    };
  }

  const todayIndex = 0;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto" dir="ltr">
        <div style={{ minWidth: "900px" }}>
          {/* Header row */}
          <div
            className="grid border-b border-petra-border"
            style={{ gridTemplateColumns: `140px repeat(${numDays}, 1fr)` }}
          >
            <div className="p-2 text-sm font-semibold text-petra-text bg-slate-50 border-l border-petra-border text-right" dir="rtl">
              חדר
            </div>
            {days.map((day, i) => {
              const isToday = i === todayIndex;
              const dayOfWeek = day.getDay();
              return (
                <div
                  key={i}
                  className={cn(
                    "p-1.5 text-center border-l border-petra-border",
                    isToday ? "bg-orange-50" : dayOfWeek === 6 ? "bg-slate-50/50" : ""
                  )}
                >
                  <div className={cn("text-[10px]", isToday ? "text-orange-600 font-bold" : "text-petra-muted")}>
                    {HE_DAYS[dayOfWeek]}
                  </div>
                  <div className={cn("text-xs font-semibold", isToday ? "text-orange-600" : "text-petra-text")}>
                    {day.getDate()}/{day.getMonth() + 1}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Room rows */}
          {rooms.map((room) => {
            const roomStays = roomStaysMap[room.id] || [];
            const displayStatus = getRoomDisplayStatus(room);
            const statusColor = ROOM_STATUS_MAP[displayStatus]?.color || "#94A3B8";

            return (
              <div
                key={room.id}
                className="grid border-b border-slate-100"
                style={{ gridTemplateColumns: `140px repeat(${numDays}, 1fr)` }}
              >
                {/* Room label */}
                <div className="p-2 flex items-center gap-2 bg-slate-50/50 border-l border-petra-border" dir="rtl">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: statusColor }}
                  />
                  <span className="text-xs font-medium text-petra-text truncate">{room.name}</span>
                  <span className="text-[9px] text-petra-muted ms-auto">{room._count.boardingStays}/{room.capacity}</span>
                </div>

                {/* Timeline cells with bars */}
                <div
                  className="relative col-span-14"
                  style={{ gridColumn: `2 / -1`, minHeight: "48px" }}
                >
                  {/* Day grid lines */}
                  <div
                    className="absolute inset-0 grid"
                    style={{ gridTemplateColumns: `repeat(${numDays}, 1fr)` }}
                  >
                    {days.map((day, i) => {
                      const isToday = i === todayIndex;
                      const dayOfWeek = day.getDay();
                      return (
                        <div
                          key={i}
                          className={cn(
                            "border-l border-slate-100 h-full",
                            isToday && "bg-orange-50/30",
                            dayOfWeek === 6 && "bg-slate-50/30"
                          )}
                        />
                      );
                    })}
                  </div>

                  {/* Stay bars */}
                  {roomStays.map((stay) => {
                    const pos = getBarPosition(stay);
                    const stayStatus = STATUS_MAP[stay.status] || STATUS_MAP.reserved;

                    return (
                      <div
                        key={stay.id}
                        className="absolute top-1.5 bottom-1.5 rounded-md flex items-center gap-1 px-2 text-[10px] font-semibold text-white truncate shadow-sm cursor-default"
                        style={{
                          left: pos.left,
                          width: pos.width,
                          backgroundColor: stayStatus.color,
                        }}
                        title={`${stay.pet.name} — ${stay.customer?.name ?? "כלב שירות"}\n${formatDate(stay.checkIn)}${stay.checkOut ? ` → ${formatDate(stay.checkOut)}` : ""}`}
                      >
                        <PawPrint className="w-3 h-3 flex-shrink-0" />
                        {stay.pet.name}
                      </div>
                    );
                  })}

                  {/* Empty state */}
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
          {(roomStaysMap["unassigned"] || []).length > 0 && (
            <div
              className="grid border-b border-slate-100"
              style={{ gridTemplateColumns: `140px repeat(${numDays}, 1fr)` }}
            >
              <div className="p-2 flex items-center gap-2 bg-slate-100/50 border-l border-petra-border" dir="rtl">
                <Hotel className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-500">ללא חדר</span>
              </div>
              <div
                className="relative col-span-14"
                style={{ gridColumn: `2 / -1`, minHeight: "48px" }}
              >
                <div
                  className="absolute inset-0 grid"
                  style={{ gridTemplateColumns: `repeat(${numDays}, 1fr)` }}
                >
                  {days.map((_, i) => (
                    <div key={i} className="border-l border-slate-100 h-full" />
                  ))}
                </div>
                {(roomStaysMap["unassigned"] || []).map((stay) => {
                  const pos = getBarPosition(stay);
                  return (
                    <div
                      key={stay.id}
                      className="absolute top-1.5 bottom-1.5 rounded-md flex items-center gap-1 px-2 text-[10px] font-semibold text-white truncate shadow-sm bg-slate-400"
                      style={{ left: pos.left, width: pos.width }}
                    >
                      <PawPrint className="w-3 h-3 flex-shrink-0" />
                      {stay.pet.name}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Draggable Stay wrapper for Grid View ───────────────────────────────────

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
          <DraggableStayInRoom key={stay.id} stayId={stay.id}>
            <div className="p-3 rounded-lg mb-2 bg-white border border-slate-200">
              <div className="flex items-center gap-2">
                <PawPrint className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-petra-text truncate">{stay.pet.name}</div>
                  <div className="text-[10px] text-petra-muted">{stay.customer?.name ?? "כלב שירות"}</div>
                </div>
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
  settings,
}: {
  stay: BoardingStay;
  onCheckin: (id: string) => void;
  onCheckout: (id: string) => void;
  onExtend: (id: string) => void;
  settings: BusinessSettings;
}) {
  const st = STATUS_MAP[stay.status] || STATUS_MAP.reserved;
  const today = toDateStr(new Date());
  const isCheckinToday = toDateStr(stay.checkIn) === today && stay.status === "reserved";
  const isCheckoutToday = stay.checkOut && toDateStr(stay.checkOut) === today && stay.status === "checked_in";
  const overdue = isOverdue(stay, settings.boardingCheckOutTime || "11:00");

  return (
    <div className={cn("card p-4 flex items-center gap-4", overdue && "ring-2 ring-red-200")}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: st.bg }}>
        <PawPrint className="w-5 h-5" style={{ color: st.color }} />
      </div>

      <div className="flex-1 min-w-0">
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
          <StayProgress checkIn={stay.checkIn} checkOut={stay.checkOut} />
        )}
      </div>

      <span className="badge text-[10px] flex-shrink-0" style={{ background: st.bg, color: st.color }}>
        {st.label}
      </span>

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
                href={`https://web.whatsapp.com/send?phone=${toWhatsAppPhone(stay.customer!.phone)}&text=${encodeURIComponent(lines)}`}
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
                href={`https://web.whatsapp.com/send?phone=${toWhatsAppPhone(stay.customer!.phone)}&text=${encodeURIComponent(lines)}`}
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
                href={`https://web.whatsapp.com/send?phone=${toWhatsAppPhone(stay.customer!.phone)}&text=${encodeURIComponent(waText)}`}
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
      <div className="modal-content max-w-md mx-4 p-6">
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

  const nights = stay.checkOut ? calcNights(stay.checkIn, stay.checkOut) : calcNights(stay.checkIn, new Date().toISOString());
  const calcMode = settings.boardingCalcMode || "nights";
  const configuredCheckoutTime = settings.boardingCheckOutTime || "11:00";

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const isLate = currentTime > configuredCheckoutTime;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onCancel} />
      <div className="modal-content max-w-md mx-4 p-6">
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

          {isLate && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              יציאה מאוחרת — שעת הצ׳ק-אאוט המוגדרת היא {configuredCheckoutTime}
            </div>
          )}

          <div>
            <label className="label">הערות צ׳ק-אאוט</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="הערות ליציאה..." />
          </div>
        </div>

        {/* WhatsApp payment request — only when customer exists */}
        {settings.boardingPricePerNight && stay.customer?.phone && (
          <a
            href={(() => {
              const total = nights * (settings.boardingPricePerNight || 0);
              const msg = `שלום ${stay.customer!.name}! 😊\nתודה שהיה לנו את ${stay.pet.name} בפנסיון.\nסיכום השהייה: ${nights} ${calcMode === "nights" ? "לילות" : "ימים"} × ₪${settings.boardingPricePerNight} = ₪${total.toFixed(0)}.\n\nנשמח לקבל תשלום 🙏`;
              return `https://web.whatsapp.com/send?phone=${toWhatsAppPhone(stay.customer!.phone)}&text=${encodeURIComponent(msg)}`;
            })()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            שלח בקשת תשלום בוואטסאפ
          </a>
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
  const currentCheckout = stay.checkOut
    ? new Date(stay.checkOut).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const [newCheckout, setNewCheckout] = useState(currentCheckout);

  const minDate = new Date(Math.max(
    new Date(stay.checkIn).getTime() + 86400000,
    Date.now()
  )).toISOString().slice(0, 10);

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onCancel} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-petra-text">הארכת שהות</h2>
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
              <span className="font-medium">{stay.checkOut ? new Date(stay.checkOut).toLocaleDateString("he-IL") : "לא מוגדר"}</span>
            </div>
          </div>
          <div>
            <label className="label">תאריך יציאה חדש *</label>
            <input
              type="date"
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
            disabled={isPending || !newCheckout || newCheckout < minDate || newCheckout === currentCheckout}
            onClick={() => onConfirm(newCheckout + "T12:00:00")}
          >
            <Calendar className="w-4 h-4" />
            {isPending ? "שומר..." : "עדכן תאריך יציאה"}
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
  status: "expired" | "expiring_soon" | "valid";
}

interface HealthAlertsData {
  alerts: VaccinationAlert[];
  totalAlerts: number;
  expired: number;
  expiringSoon: number;
}

function VaccinationAlertBanner() {
  const [expanded, setExpanded] = useState(false);

  const { data } = useQuery<HealthAlertsData>({
    queryKey: ["health-alerts"],
    queryFn: () => fetchJSON<HealthAlertsData>("/api/health-alerts?days=30"),
    staleTime: 5 * 60 * 1000,
  });

  if (!data || data.totalAlerts === 0) return null;

  const shown = expanded ? data.alerts : data.alerts.slice(0, 3);
  const hasMore = data.alerts.length > 3;

  return (
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-3 text-right"
      >
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-amber-900">
            {data.expired > 0
              ? `${data.expired} כלבים עם חיסון פג תוקף`
              : `${data.expiringSoon} כלבים עם חיסון פג בקרוב`}
          </span>
          {data.expired > 0 && data.expiringSoon > 0 && (
            <span className="text-xs text-amber-700 mr-2">
              (+{data.expiringSoon} שפוגים ב-30 יום)
            </span>
          )}
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
          {shown.map((alert) => {
            const waPhone = toWhatsAppPhone(alert.customerPhone);
            const msg = encodeURIComponent(
              `שלום ${alert.customerName}, חיסון הכלוף של ${alert.petName} פג תוקף${alert.rabiesValidUntil ? ` בתאריך ${formatDate(alert.rabiesValidUntil)}` : ""}. נא לחדש לפני הכניסה לפנסיון.`
            );
            return (
              <div
                key={alert.petId}
                className="flex items-center gap-3 px-4 py-2.5 bg-white/60"
              >
                <div
                  className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    alert.status === "expired" ? "bg-red-500" : "bg-amber-400"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-petra-text">
                    {alert.petName}
                  </span>
                  <span className="text-xs text-petra-muted mr-2">
                    ({alert.customerName})
                  </span>
                  {alert.rabiesValidUntil && (
                    <span
                      className={cn(
                        "text-xs font-medium",
                        alert.status === "expired" ? "text-red-600" : "text-amber-700"
                      )}
                    >
                      כלב: {formatDate(alert.rabiesValidUntil)}
                    </span>
                  )}
                </div>
                {waPhone && (
                  <a
                    href={`https://web.whatsapp.com/send?phone=${waPhone}&text=${msg}`}
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
          {hasMore && !expanded && (
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
  });

  const typeConfig = Object.fromEntries(CARE_LOG_TYPES.map((t) => [t.value, t]));

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[85vh] overflow-y-auto">
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
        {isLoading && (
          <div className="text-center py-4 text-petra-muted text-sm">
            <RefreshCw className="w-4 h-4 mx-auto animate-spin mb-1" />
            טוען...
          </div>
        )}
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
  const [showNewStay, setShowNewStay] = useState(false);
  const [careLogStay, setCareLogStay] = useState<{ id: string; petName: string } | null>(null);
  const [form, setForm] = useState({
    customerId: "", petIds: [] as string[], roomId: "", checkIn: "", checkOut: "", checkInTime: "12:00", checkOutTime: "12:00", notes: "", pricePerNight: 0,
  });
  const [serviceDogMode, setServiceDogMode] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [staySearch, setStaySearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("active");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [activeStayId, setActiveStayId] = useState<string | null>(null);

  // Occupancy checker — defaults to today
  const todayStr = new Date().toISOString().slice(0, 10);
  const [occFrom, setOccFrom] = useState(todayStr);
  const [occTo, setOccTo] = useState(todayStr);
  // Draft state for date inputs (apply on button click)
  const [occDraftFrom, setOccDraftFrom] = useState(todayStr);
  const [occDraftTo, setOccDraftTo] = useState(todayStr);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [timelineDays, setTimelineDays] = useState(14);

  // Dialog state
  const shouldCreateMedTasksRef = useRef(false);
  const checkinStayRef = useRef<BoardingStay | null>(null);
  const [checkinDialogStay, setCheckinDialogStay] = useState<BoardingStay | null>(null);
  const [checkoutDialogStay, setCheckoutDialogStay] = useState<BoardingStay | null>(null);
  const [extendDialogStay, setExtendDialogStay] = useState<BoardingStay | null>(null);

  // Rooms manager
  const [showRoomsManager, setShowRoomsManager] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editRoomForm, setEditRoomForm] = useState({ name: "", capacity: 1, type: "standard", pricePerNight: "" as string | number });
  const [newRoomForm, setNewRoomForm] = useState({ name: "", capacity: 1, type: "standard", pricePerNight: "" as string | number });

  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
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

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers-for-select"],
    queryFn: () => fetchJSON<Customer[]>("/api/customers?full=1"),
    enabled: showNewStay,
  });

  const { data: serviceDogsList = [] } = useQuery<Array<{ id: string; phase: string; pet: { id: string; name: string; breed?: string | null } }>>({
    queryKey: ["service-dogs-for-select"],
    queryFn: () => fetchJSON("/api/service-dogs"),
    enabled: showNewStay && serviceDogMode,
  });

  const { data: occStays = [], isFetching: occLoading } = useQuery<BoardingStay[]>({
    queryKey: ["boarding-occupancy", occFrom, occTo],
    queryFn: () => fetchJSON<BoardingStay[]>(`/api/boarding?from=${occFrom}&to=${occTo}`),
    enabled: !!occFrom && !!occTo,
    staleTime: 30_000,
  });

  const selectedCustomer = customers.find((c) => c.id === form.customerId);
  const selectedServiceDog = serviceDogMode && form.petIds.length > 0
    ? serviceDogsList.find((sd) => sd.pet.id === form.petIds[0])
    : undefined;
  // Service dogs in training don't need price calculation — they board for free during training
  const isServiceDogInTraining = !!(selectedServiceDog && selectedServiceDog.phase !== "CERTIFIED");
  const showPricing = !isServiceDogInTraining;

  const filteredCustomers = customers.filter(
    (c) =>
      !customerSearch ||
      c.name.includes(customerSearch) ||
      c.phone.includes(customerSearch)
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
          }),
        }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boarding"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setShowNewStay(false);
      setForm({ customerId: "", petIds: [], roomId: "", checkIn: "", checkOut: "", checkInTime: settings.boardingCheckInTime || "14:00", checkOutTime: settings.boardingCheckOutTime || "11:00", notes: "", pricePerNight: settings.boardingPricePerNight || 150 });
      setCustomerSearch("");
      setServiceDogMode(false);
      toast.success("ההשמה נוצרה בהצלחה");
    },
    onError: () => toast.error("שגיאה ביצירת ההשמה. נסה שוב."),
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
      toast.error("שגיאה בעדכון הסטטוס. נסה שוב.");
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
      if (!r.ok) throw new Error("שגיאה בשיוך החדר");
      return r.json();
    },
    onMutate: async ({ id, roomId }) => {
      await queryClient.cancelQueries({ queryKey: ["boarding"] });
      await queryClient.cancelQueries({ queryKey: ["rooms"] });

      const prev = queryClient.getQueryData<BoardingStay[]>(["boarding"]);
      const prevRooms = queryClient.getQueryData<Room[]>(["rooms"]);

      const targetRoom = roomId ? (prevRooms?.find((r) => r.id === roomId) ?? null) : null;

      // Update boarding cache
      queryClient.setQueryData<BoardingStay[]>(["boarding"], (old) =>
        old?.map((s) => s.id === id
          ? { ...s, room: targetRoom ? { id: targetRoom.id, name: targetRoom.name } : null }
          : s) ?? []
      );

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

      return { prev, prevRooms };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["boarding"], ctx.prev);
      if (ctx?.prevRooms) queryClient.setQueryData(["rooms"], ctx.prevRooms);
      toast.error("שגיאה בשיוך החדר. נסה שוב.");
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
      toast.error("שגיאה בעדכון תאריך היציאה. נסה שוב.");
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

    const newRoomId = targetId === "unassigned" ? null : targetId;
    const currentRoomId = stay.room?.id ?? null;
    if (newRoomId === currentRoomId) return;

    roomMutation.mutate({ id: stayId, roomId: newRoomId });
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
    if (!staySearch.trim()) return base;
    const q = staySearch.toLowerCase();
    return base.filter(
      (s) =>
        s.pet.name.toLowerCase().includes(q) ||
        (s.customer?.name ?? "").toLowerCase().includes(q) ||
        (s.room?.name.toLowerCase().includes(q) ?? false)
    );
  }, [tabStays, activeTab, staySearch, selectedCalendarDate]);

  // Room availability for selected dates in new stay modal
  const roomAvailability = useMemo(() => {
    if (!form.checkIn || !form.checkOut) return {} as Record<string, boolean>;
    return Object.fromEntries(
      rooms.map((room) => {
        const overlapping = stays.filter(
          (s) =>
            s.room?.id === room.id &&
            ACTIVE_STATUSES.includes(s.status) &&
            toDateStr(s.checkIn) < form.checkOut! &&
            (!s.checkOut || toDateStr(s.checkOut) > form.checkIn)
        ).length;
        return [room.id, overlapping < room.capacity];
      })
    );
  }, [form.checkIn, form.checkOut, rooms, stays]);

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
    const fromDate = new Date(occFrom);
    const toDate = new Date(occTo);
    toDate.setHours(23, 59, 59);
    // Build day list
    const days: Date[] = [];
    const cursor = new Date(fromDate);
    while (cursor <= toDate) { days.push(new Date(cursor)); cursor.setDate(cursor.getDate() + 1); }
    // Per room: max concurrent stays across all days
    const result: Record<string, number> = {};
    for (const room of rooms) {
      const roomStays = occStays.filter(s => s.room?.id === room.id);
      let maxConcurrent = 0;
      for (const day of days) {
        const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59);
        const concurrent = roomStays.filter(s => {
          const ci = new Date(s.checkIn);
          const co = s.checkOut ? new Date(s.checkOut) : null;
          return ci <= dayEnd && (!co || co >= day);
        }).length;
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
            const waUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(lines.join("\n"))}`;
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
            const waUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(lines.join("\n").trim())}`;
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
          <a
            href="/api/boarding/export"
            download
            className="btn-secondary hidden sm:flex"
            title="ייצוא יומי לאקסל"
          >
            <ClipboardList className="w-4 h-4" />
            ייצוא יומי
          </a>
          <button className="btn-secondary" onClick={() => setShowRoomsManager(true)}>
            <Settings2 className="w-4 h-4" />ניהול חדרים
          </button>
          <button className="btn-primary" onClick={() => { setForm((f) => ({ ...f, pricePerNight: settings.boardingPricePerNight || 150, checkInTime: settings.boardingCheckInTime || "14:00", checkOutTime: settings.boardingCheckOutTime || "11:00" })); setShowNewStay(true); }}>
            <Plus className="w-4 h-4" />שהייה חדשה
          </button>
        </div>
      </div>

      {/* Vaccination Alert Banner */}
      <VaccinationAlertBanner />

      {/* Room Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
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

      {/* Overdue Banner */}
      {overdueStays.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">
              {overdueStays.length} שהיות עם איחור בצ׳ק-אאוט
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {overdueStays.map((s) => s.pet.name).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* View Toggle + Occupancy strip */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-petra-text">מפת חדרים</h2>
          {/* ── Occupancy checker strip ── */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Calendar className="w-3.5 h-3.5 text-petra-muted flex-shrink-0" />
            <input
              type="date" value={occDraftFrom}
              onChange={e => setOccDraftFrom(e.target.value)}
              className="text-xs border border-petra-border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand-400 h-7 w-32"
            />
            <span className="text-xs text-petra-muted">—</span>
            <input
              type="date" value={occDraftTo} min={occDraftFrom}
              onChange={e => setOccDraftTo(e.target.value)}
              className="text-xs border border-petra-border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand-400 h-7 w-32"
            />
            <button
              onClick={() => { setOccFrom(occDraftFrom); setOccTo(occDraftTo); }}
              className="h-7 px-2.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition-colors flex-shrink-0"
            >
              הצג
            </button>
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
        <div className="flex items-center gap-2">
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
                <button className="btn-primary mx-auto" onClick={() => setShowRoomsManager(true)}>
                  <Plus className="w-4 h-4" />הוסף חדר ראשון
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {rooms.map((room) => (
                  <RoomStatusCard
                    key={room.id}
                    room={room}
                    onCheckin={handleCheckin}
                    onCheckout={handleCheckout}
                    onMarkClean={handleMarkClean}
                    occPeriodStays={occStays.filter(s => s.room?.id === room.id)}
                  />
                ))}
                {/* Unassigned stays drop zone */}
                <UnassignedGridCard
                  stays={activeStays.filter((s) => !s.room)}
                  onCheckin={handleCheckin}
                  onCheckout={handleCheckout}
                />
              </div>
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
            <TimelineView rooms={rooms} stays={stays} numDays={timelineDays} />
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
      <div>
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
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-petra-text">לוח שהיות</h2>
          <div className="relative flex-1 min-w-[180px] max-w-xs">
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
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="card p-4 animate-pulse h-20" />)}
          </div>
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
          <div className="modal-content max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
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
      )}

      {/* ── New Stay Modal ── */}
      {showNewStay && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setShowNewStay(false)} />
          <div className="modal-content max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
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

            <div className="space-y-4">
              {/* Mode toggle: לקוח רגיל / כלב שירות */}
              <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => { setServiceDogMode(false); setForm({ ...form, petIds: [], customerId: "" }); setCustomerSearch(""); }}
                  className={cn("flex-1 text-xs py-1.5 rounded-md font-medium transition-colors", !serviceDogMode ? "bg-white shadow-sm text-petra-text" : "text-petra-muted hover:text-petra-text")}
                >
                  לקוח רגיל
                </button>
                <button
                  type="button"
                  onClick={() => { setServiceDogMode(true); setForm({ ...form, petIds: [], customerId: "" }); setCustomerSearch(""); }}
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
                      onClick={() => { setForm({ ...form, customerId: "", petIds: [] }); setCustomerSearch(""); }}
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
                        placeholder="חיפוש לפי שם או טלפון..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-petra-border rounded-xl divide-y divide-petra-border">
                      {filteredCustomers.length === 0 ? (
                        <div className="py-4 text-center text-sm text-petra-muted">לא נמצאו לקוחות</div>
                      ) : (
                        filteredCustomers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { setForm({ ...form, customerId: c.id, petIds: [], pricePerNight: settings.boardingPricePerNight || 150 }); setCustomerSearch(""); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 transition-colors text-right"
                          >
                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 flex-shrink-0">
                              {c.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-petra-text truncate">{c.name}</p>
                              <p className="text-[10px] text-petra-muted" dir="ltr">{c.phone}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
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
                  <div className="max-h-48 overflow-y-auto border border-petra-border rounded-xl divide-y divide-petra-border">
                    {serviceDogsList.length === 0 ? (
                      <div className="py-4 text-center text-sm text-petra-muted">אין כלבי שירות פעילים</div>
                    ) : (
                      serviceDogsList.map((sd) => (
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
                      const roomStatus = getRoomDisplayStatus(r);
                      const isFull = r._count.boardingStays >= r.capacity;
                      return (
                        <option key={r.id} value={r.id} disabled={isFull}>
                          {r.name} ({r._count.boardingStays}/{r.capacity}) {isFull ? "— מלא" : roomStatus === "needs_cleaning" ? "— דרוש ניקיון" : ""}
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
                    type="date"
                    className="input"
                    value={form.checkIn}
                    onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
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

              {/* Check-out */}
              <div>
                <label className="label">צ׳ק-אאוט</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
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

            <div className="flex gap-3 mt-6">
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

      {/* ── Extend Stay Dialog ── */}
      {extendDialogStay && (
        <ExtendStayDialog
          stay={extendDialogStay}
          onConfirm={(checkOut) => extendMutation.mutate({ id: extendDialogStay.id, checkOut })}
          onCancel={() => setExtendDialogStay(null)}
          isPending={extendMutation.isPending}
        />
      )}
    </div>
  );
}

export default function BoardingPage() {
  return (
    <TierGate
      feature="boarding"
      title="ניהול פנסיון"
      description="ניהול חדרים, לינות ותפוסה. עקוב אחרי כל כלב שנמצא בפנסיון בזמן אמת."
    >
      <BoardingPageContent />
    </TierGate>
  );
}
