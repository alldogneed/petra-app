"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
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
} from "lucide-react";
import { cn, fetchJSON, toWhatsAppPhone } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RoomStay {
  id: string;
  checkIn: string;
  checkOut: string | null;
  status: string;
  pet: { id: string; name: string; breed: string | null; species: string };
  customer: { id: string; name: string; phone: string };
}

interface Room {
  id: string;
  name: string;
  capacity: number;
  type: string;
  status: string;
  isActive: boolean;
  _count: { boardingStays: number };
  boardingStays: RoomStay[];
}

interface BoardingStay {
  id: string;
  checkIn: string;
  checkOut: string | null;
  status: string;
  notes: string | null;
  room: { id: string; name: string } | null;
  pet: { id: string; name: string; species: string; breed: string | null };
  customer: { id: string; name: string; phone: string };
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
type ViewMode = "grid" | "timeline";

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

function RoomStatusCard({
  room,
  onCheckin,
  onCheckout,
  onMarkClean,
}: {
  room: Room;
  onCheckin: (id: string) => void;
  onCheckout: (id: string) => void;
  onMarkClean: (roomId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: room.id });
  const displayStatus = getRoomDisplayStatus(room);
  const statusConfig = ROOM_STATUS_MAP[displayStatus];
  const checkedIn = room.boardingStays.filter((s) => s.status === "checked_in");
  const reserved = room.boardingStays.filter((s) => s.status === "reserved");

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
          <span>{room._count.boardingStays}/{room.capacity}</span>
          <span className="badge-neutral text-[10px] mr-auto">{ROOM_TYPE_LABELS[room.type] || room.type}</span>
        </div>

        {/* Occupied: show dog info — draggable */}
        {checkedIn.map((stay) => (
          <DraggableStayInRoom key={stay.id} stayId={stay.id}>
            <div className="p-3 rounded-lg mb-2" style={{ background: "#FFF7ED", border: "1px solid #FDBA74" }}>
              <div className="flex items-center gap-2">
                <PawPrint className="w-4 h-4 text-orange-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-petra-text truncate">{stay.pet.name}</div>
                  {stay.pet.breed && <div className="text-xs text-petra-muted">{stay.pet.breed}</div>}
                  <div className="text-[10px] text-petra-muted">{stay.customer.name}</div>
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

        {/* Reserved: show upcoming — draggable */}
        {reserved.map((stay) => (
          <DraggableStayInRoom key={stay.id} stayId={stay.id}>
            <div className="p-3 rounded-lg mb-2" style={{ background: "#F5F3FF", border: "1px solid #C4B5FD" }}>
              <div className="flex items-center gap-2">
                <PawPrint className="w-4 h-4 text-purple-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-petra-text truncate">{stay.pet.name}</div>
                  <div className="text-xs text-petra-muted">{stay.customer.name}</div>
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
        {isOver && checkedIn.length === 0 && reserved.length === 0 && (
          <div className="text-center py-4 border-2 border-dashed border-brand-300 rounded-lg bg-brand-50/30">
            <p className="text-xs text-brand-500 font-medium">שחרר כאן</p>
          </div>
        )}

        {/* Available state */}
        {!isOver && displayStatus === "available" && checkedIn.length === 0 && reserved.length === 0 && (
          <div className="text-center py-6">
            <div className="w-10 h-10 rounded-full bg-green-50 mx-auto mb-2 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-sm text-green-600 font-medium">פנוי לאורחים</p>
          </div>
        )}

        {/* Needs cleaning state */}
        {!isOver && displayStatus === "needs_cleaning" && checkedIn.length === 0 && reserved.length === 0 && (
          <div className="text-center py-4">
            <div className="w-10 h-10 rounded-full bg-yellow-50 mx-auto mb-2 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-sm text-yellow-600 font-medium mb-2">דרוש ניקיון</p>
            <button
              onClick={() => onMarkClean(room.id)}
              className="btn-ghost text-xs text-yellow-700 hover:bg-yellow-50"
            >
              <Check className="w-3.5 h-3.5" />סמן כנקי
            </button>
          </div>
        )}

        {/* Action buttons — stop pointer propagation to prevent drag */}
        {(checkedIn.length > 0 || reserved.length > 0) && (
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
}

// ─── Timeline / Gantt View ──────────────────────────────────────────────────

function TimelineView({
  rooms,
  stays,
}: {
  rooms: Room[];
  stays: BoardingStay[];
}) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: TIMELINE_DAYS }, (_, i) => addDays(today, i));
  const timelineEnd = addDays(today, TIMELINE_DAYS);

  // Group stays by room
  const roomStaysMap = useMemo(() => {
    const map: Record<string, BoardingStay[]> = {};
    rooms.forEach((r) => { map[r.id] = []; });
    map["unassigned"] = [];

    stays
      .filter((s) => ACTIVE_STATUSES.includes(s.status))
      .filter((s) => {
        const checkIn = new Date(s.checkIn);
        const checkOut = s.checkOut ? new Date(s.checkOut) : addDays(today, TIMELINE_DAYS + 30);
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
    const checkOut = stay.checkOut ? startOfDay(new Date(stay.checkOut)) : addDays(today, TIMELINE_DAYS);

    const visibleStart = checkIn < today ? today : checkIn;
    const visibleEnd = checkOut > timelineEnd ? timelineEnd : checkOut;

    const startOffset = diffDays(visibleStart, today);
    const endOffset = diffDays(visibleEnd, today);

    const left = (startOffset / TIMELINE_DAYS) * 100;
    const width = ((endOffset - startOffset) / TIMELINE_DAYS) * 100;

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
            style={{ gridTemplateColumns: `140px repeat(${TIMELINE_DAYS}, 1fr)` }}
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
                style={{ gridTemplateColumns: `140px repeat(${TIMELINE_DAYS}, 1fr)` }}
              >
                {/* Room label */}
                <div className="p-2 flex items-center gap-2 bg-slate-50/50 border-l border-petra-border" dir="rtl">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: statusColor }}
                  />
                  <span className="text-xs font-medium text-petra-text truncate">{room.name}</span>
                  <span className="text-[9px] text-petra-muted mr-auto">{room._count.boardingStays}/{room.capacity}</span>
                </div>

                {/* Timeline cells with bars */}
                <div
                  className="relative col-span-14"
                  style={{ gridColumn: `2 / -1`, minHeight: "48px" }}
                >
                  {/* Day grid lines */}
                  <div
                    className="absolute inset-0 grid"
                    style={{ gridTemplateColumns: `repeat(${TIMELINE_DAYS}, 1fr)` }}
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
                        title={`${stay.pet.name} — ${stay.customer.name}\n${formatDate(stay.checkIn)}${stay.checkOut ? ` → ${formatDate(stay.checkOut)}` : ""}`}
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
              style={{ gridTemplateColumns: `140px repeat(${TIMELINE_DAYS}, 1fr)` }}
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
                  style={{ gridTemplateColumns: `repeat(${TIMELINE_DAYS}, 1fr)` }}
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

function DraggableStayInRoom({ stayId, children }: { stayId: string; children: React.ReactNode }) {
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
}

// ─── Unassigned Stays Card (droppable, for Grid View) ───────────────────────

function UnassignedGridCard({
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
          <span className="mr-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
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
                  <div className="text-[10px] text-petra-muted">{stay.customer.name}</div>
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
}


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
          <span className="text-sm text-petra-muted">—</span>
          <Link
            href={`/customers/${stay.customer.id}`}
            className="text-sm text-petra-muted hover:text-brand-600 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {stay.customer.name}
          </Link>
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
        <button className="btn-ghost text-xs flex-shrink-0" onClick={() => onCheckin(stay.id)}>
          <CheckCircle2 className="w-3.5 h-3.5" />צ׳ק-אין
        </button>
      )}
      {stay.status === "checked_in" && (
        <div className="flex gap-1 flex-shrink-0">
          <button className="btn-ghost text-xs" onClick={() => onExtend(stay.id)} title="הארך שהות">
            <Calendar className="w-3.5 h-3.5" />הארך
          </button>
          <button className="btn-ghost text-xs" onClick={() => onCheckout(stay.id)}>
            <Clock className="w-3.5 h-3.5" />צ׳ק-אאוט
          </button>
        </div>
      )}
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
  onConfirm: (data: { actualTime: string; notes: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const [actualTime, setActualTime] = useState(currentTime);
  const [notes, setNotes] = useState("");

  const configuredTime = settings.boardingCheckInTime || "14:00";
  const isEarly = actualTime < configuredTime;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onCancel} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-petra-text">צ׳ק-אין</h2>
            <p className="text-sm text-petra-muted mt-0.5">{stay.pet.name} — {stay.customer.name}</p>
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
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={isPending}
            onClick={() => onConfirm({ actualTime, notes })}
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
            <p className="text-sm text-petra-muted mt-0.5">{stay.pet.name} — {stay.customer.name}</p>
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
              <span className="font-medium">{stay.customer.name}</span>
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

        {/* WhatsApp payment request */}
        {settings.boardingPricePerNight && (
          <a
            href={(() => {
              const total = nights * (settings.boardingPricePerNight || 0);
              const msg = `שלום ${stay.customer.name}! 😊\nתודה שהיה לנו את ${stay.pet.name} בפנסיון.\nסיכום השהייה: ${nights} ${calcMode === "nights" ? "לילות" : "ימים"} × ₪${settings.boardingPricePerNight} = ₪${total.toFixed(0)}.\n\nנשמח לקבל תשלום 🙏`;
              return `https://wa.me/${toWhatsAppPhone(stay.customer.phone)}?text=${encodeURIComponent(msg)}`;
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
            <p className="text-sm text-petra-muted mt-0.5">{stay.pet.name} — {stay.customer.name}</p>
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
            disabled={isPending || !newCheckout || newCheckout <= stay.checkIn.slice(0, 10)}
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
        className="w-full flex items-center gap-3 p-3 text-left"
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
                    href={`https://wa.me/${waPhone}?text=${msg}`}
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

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function BoardingPage() {
  const [showNewStay, setShowNewStay] = useState(false);
  const [form, setForm] = useState({
    customerId: "", petIds: [] as string[], roomId: "", checkIn: "", checkOut: "", checkInTime: "12:00", checkOutTime: "12:00", notes: "", pricePerNight: 0,
  });
  const [customerSearch, setCustomerSearch] = useState("");
  const [staySearch, setStaySearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("active");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [activeStayId, setActiveStayId] = useState<string | null>(null);

  // Dialog state
  const [checkinDialogStay, setCheckinDialogStay] = useState<BoardingStay | null>(null);
  const [checkoutDialogStay, setCheckoutDialogStay] = useState<BoardingStay | null>(null);
  const [extendDialogStay, setExtendDialogStay] = useState<BoardingStay | null>(null);

  // Rooms manager
  const [showRoomsManager, setShowRoomsManager] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editRoomForm, setEditRoomForm] = useState({ name: "", capacity: 1, type: "standard" });
  const [newRoomForm, setNewRoomForm] = useState({ name: "", capacity: 1, type: "standard" });

  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ── Data queries ──

  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ["rooms"],
    queryFn: () => fetchJSON<Room[]>("/api/boarding/rooms"),
  });

  const { data: stays = [], isLoading, isError } = useQuery<BoardingStay[]>({
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

  const selectedCustomer = customers.find((c) => c.id === form.customerId);

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
            customerId: data.customerId,
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
      setForm({ customerId: "", petIds: [], roomId: "", checkIn: "", checkOut: "", checkInTime: "12:00", checkOutTime: "12:00", notes: "", pricePerNight: 0 });
      setCustomerSearch("");
      toast.success("ההשמה נוצרה בהצלחה");
    },
    onError: () => toast.error("שגיאה ביצירת ההשמה. נסה שוב."),
  });

  const statusMutation = useMutation({
    mutationFn: (payload: { id: string; status: string; checkinNotes?: string; checkoutNotes?: string; actualCheckinTime?: string; actualCheckoutTime?: string }) =>
      fetch(`/api/boarding/${payload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json()),
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({ queryKey: ["boarding"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setCheckinDialogStay(null);
      setCheckoutDialogStay(null);
      if (payload.status === "checked_in") toast.success("צ'ק-אין בוצע בהצלחה");
      else if (payload.status === "checked_out") toast.success("צ'ק-אאוט בוצע בהצלחה");
    },
    onError: () => toast.error("שגיאה בעדכון הסטטוס. נסה שוב."),
  });

  const roomMutation = useMutation({
    mutationFn: ({ id, roomId }: { id: string; roomId: string | null }) =>
      fetch(`/api/boarding/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boarding"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: () => toast.error("שגיאה בשיוך החדר. נסה שוב."),
  });

  const markCleanMutation = useMutation({
    mutationFn: (roomId: string) =>
      fetch(`/api/boarding/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "available" }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("החדר סומן כנקי");
    },
    onError: () => toast.error("שגיאה בעדכון החדר. נסה שוב."),
  });

  const extendMutation = useMutation({
    mutationFn: ({ id, checkOut }: { id: string; checkOut: string }) =>
      fetchJSON(`/api/boarding/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkOut }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boarding"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setExtendDialogStay(null);
      toast.success("תאריך היציאה עודכן בהצלחה");
    },
    onError: () => toast.error("שגיאה בעדכון תאריך היציאה. נסה שוב."),
  });

  const createRoomMutation = useMutation({
    mutationFn: (data: { name: string; capacity: number; type: string }) =>
      fetch("/api/boarding/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setNewRoomForm({ name: "", capacity: 1, type: "standard" });
      toast.success("החדר נוצר בהצלחה");
    },
    onError: () => toast.error("שגיאה ביצירת החדר. נסה שוב."),
  });

  const updateRoomMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; capacity: number; type: string }) =>
      fetch(`/api/boarding/rooms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
        .then((r) => r.json())
        .then((data) => { if (data.error) throw new Error(data.error); return data; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("החדר נמחק");
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה במחיקת החדר. נסה שוב."),
  });

  function startEditRoom(room: Room) {
    setEditingRoomId(room.id);
    setEditRoomForm({ name: room.name, capacity: room.capacity, type: room.type });
  }

  // ── Check-in/out via dialog ──

  const handleCheckin = (id: string) => {
    const stay = stays.find((s) => s.id === id);
    if (stay) setCheckinDialogStay(stay);
  };

  const handleCheckout = (id: string) => {
    const stay = stays.find((s) => s.id === id);
    if (stay) setCheckoutDialogStay(stay);
  };

  const handleExtend = (id: string) => {
    const stay = stays.find((s) => s.id === id);
    if (stay) setExtendDialogStay(stay);
  };

  const confirmCheckin = (data: { actualTime: string; notes: string }) => {
    if (!checkinDialogStay) return;
    const dateStr = toDateStr(checkinDialogStay.checkIn);
    statusMutation.mutate({
      id: checkinDialogStay.id,
      status: "checked_in",
      checkinNotes: data.notes || undefined,
      actualCheckinTime: `${dateStr}T${data.actualTime}:00`,
    });
  };

  const confirmCheckout = (data: { notes: string }) => {
    if (!checkoutDialogStay) return;
    statusMutation.mutate({
      id: checkoutDialogStay.id,
      status: "checked_out",
      checkoutNotes: data.notes || undefined,
      actualCheckoutTime: new Date().toISOString(),
    });
  };

  // ── DnD handlers ──

  function handleDragStart(event: DragStartEvent) {
    setActiveStayId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
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
  }

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
    const base = tabStays[activeTab];
    if (!staySearch.trim()) return base;
    const q = staySearch.toLowerCase();
    return base.filter(
      (s) =>
        s.pet.name.toLowerCase().includes(q) ||
        s.customer.name.toLowerCase().includes(q) ||
        (s.room?.name.toLowerCase().includes(q) ?? false)
    );
  }, [tabStays, activeTab, staySearch]);

  const draggedStay = activeStayId ? stays.find((s) => s.id === activeStayId) : null;

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "active", label: "הכל", count: activeStays.length },
    { key: "checkin_today", label: "צ׳ק-אין היום", count: checkinTodayCount },
    { key: "checkout_today", label: "צ׳ק-אאוט היום", count: checkoutTodayCount },
    { key: "history", label: "היסטוריה" },
  ];

  // ── Room stats for header ──
  const availableRooms = rooms.filter((r) => getRoomDisplayStatus(r) === "available").length;
  const occupiedRooms = rooms.filter((r) => getRoomDisplayStatus(r) === "occupied").length;
  const cleaningRooms = rooms.filter((r) => getRoomDisplayStatus(r) === "needs_cleaning").length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="page-title">פנסיון</h1>
        <p className="text-sm text-petra-muted">
          {activeStays.length} שהיות פעילות · {rooms.length} חדרים
        </p>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowRoomsManager(true)}>
            <Settings2 className="w-4 h-4" />ניהול חדרים
          </button>
          <button className="btn-primary" onClick={() => { setForm((f) => ({ ...f, pricePerNight: settings.boardingPricePerNight || 150 })); setShowNewStay(true); }}>
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

      {/* View Toggle */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-petra-text">מפת חדרים</h2>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              viewMode === "grid" ? "bg-white shadow-sm text-petra-text" : "text-petra-muted hover:text-petra-text"
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />כרטיסים
          </button>
          <button
            onClick={() => setViewMode("timeline")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              viewMode === "timeline" ? "bg-white shadow-sm text-petra-text" : "text-petra-muted hover:text-petra-text"
            )}
          >
            <GanttChart className="w-3.5 h-3.5" />ציר זמן
          </button>
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
                    onMarkClean={(id) => markCleanMutation.mutate(id)}
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
                    <div className="text-[10px] text-petra-muted">{draggedStay.customer.name}</div>
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
            <TimelineView rooms={rooms} stays={stays} />
          )}
        </div>
      )}

      {/* ── Stays List with Tabs ── */}
      <div>
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
              <StayRow
                key={stay.id}
                stay={stay}
                onCheckin={handleCheckin}
                onCheckout={handleCheckout}
                onExtend={handleExtend}
                settings={settings}
              />
            ))}
          </div>
        )}
      </div>

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
              {/* Customer selector */}
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

              {/* Price per night */}
              {selectedCustomer && (
                <div>
                  <label className="label">מחיר ללילה (₪)</label>
                  <input
                    type="number"
                    className="input"
                    min={0}
                    value={form.pricePerNight}
                    onChange={(e) => setForm({ ...form, pricePerNight: Number(e.target.value) || 0 })}
                  />
                </div>
              )}

              {/* Room selector */}
              <div>
                <label className="label">חדר</label>
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

            {/* Price summary */}
            {form.checkIn && form.checkOut && form.petIds.length > 0 && form.pricePerNight > 0 && (() => {
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
                disabled={!form.customerId || form.petIds.length === 0 || !form.checkIn || createMutation.isPending}
                onClick={() => createMutation.mutate(form)}
              >
                <Plus className="w-4 h-4" />
                {createMutation.isPending ? "שומר..." : form.petIds.length > 1 ? `צור ${form.petIds.length} שהיות` : "צור שהייה"}
              </button>
              <button className="btn-secondary" onClick={() => setShowNewStay(false)}>
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
