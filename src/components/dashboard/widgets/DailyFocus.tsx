"use client";
import { useState } from "react";
import Link from "next/link";
import { Clock, ArrowLeft, Flame, Check } from "lucide-react";
import { isToday, isPast, differenceInMinutes, format, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { DashboardStats } from "@/components/dashboard/dashboard-shared";


// ─── Daily Focus Task Status Logic ───────────────────────────────────────────

type FocusStatus = "active" | "overdue";

export function computeFocusStatus(task: { dueAt: string | null; dueDate: string | null; status: string }): FocusStatus {
  const now = new Date();
  if (task.dueAt) {
    const dueAt = new Date(task.dueAt);
    const diffMin = differenceInMinutes(dueAt, now);
    if (isPast(dueAt) && diffMin < -30) return "overdue";
    return "active";
  }
  if (task.dueDate) {
    const dueDate = startOfDay(new Date(task.dueDate));
    if (isToday(dueDate)) return "active";
    if (isPast(dueDate)) return "overdue";
  }
  return "active";
}

export function formatFocusTime(task: { dueAt: string | null; dueDate: string | null }): string {
  if (task.dueAt) {
    return format(new Date(task.dueAt), "HH:mm");
  }
  return "כל היום";
}

const FOCUS_CONFIG: Record<FocusStatus, { label: string; color: string; bg: string; border: string }> = {
  active: { label: "עכשיו", color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
  overdue: { label: "באיחור", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
};

export function DailyFocusSection({ todayTasks, overdueTasks, onComplete }: {
  todayTasks: DashboardStats["todayTasks"];
  overdueTasks: DashboardStats["overdueTasks"];
  onComplete: (taskId: string) => void;
}) {
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [focusFilter, setFocusFilter] = useState<"overdue" | "today" | null>(null);
  const allFocusTasks = focusFilter === "overdue" ? overdueTasks : focusFilter === "today" ? todayTasks : [...overdueTasks, ...todayTasks];
  const visibleTasks = allFocusTasks.filter((t) => !completingIds.has(t.id));
  if (visibleTasks.length === 0 && allFocusTasks.length === 0) return null;

  const handleComplete = (taskId: string) => {
    setCompletingIds((prev) => new Set(prev).add(taskId));
    // Small delay for animation, then fire the actual API call
    setTimeout(() => onComplete(taskId), 350);
  };

  return (
    <div className="card overflow-hidden"
      style={{ borderTop: "3px solid #F97316" }}
    >
      <div className="px-6 pt-5 pb-4 flex items-start justify-between border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-orange-700">
            <Flame className="w-3.5 h-3.5" />
            <span>מיקוד יומי</span>
          </div>
          <h2 className="mt-2 text-base font-bold text-petra-text leading-tight">
            {allFocusTasks.length} {allFocusTasks.length === 1 ? "משימה" : "משימות"} מחכות
          </h2>
          <p className="mt-1 text-[12px] text-petra-muted flex items-center gap-1.5">
            {overdueTasks.length > 0 && (
              <button
                onClick={() => setFocusFilter(focusFilter === "overdue" ? null : "overdue")}
                className={cn("font-medium transition-colors", focusFilter === "overdue" ? "text-red-600 underline" : "text-red-500 hover:text-red-600")}
              >
                {overdueTasks.length} באיחור
              </button>
            )}
            {overdueTasks.length > 0 && todayTasks.length > 0 && <span className="text-slate-300">·</span>}
            {todayTasks.length > 0 && (
              <button
                onClick={() => setFocusFilter(focusFilter === "today" ? null : "today")}
                className={cn("transition-colors", focusFilter === "today" ? "text-blue-600 underline" : "hover:text-petra-text")}
              >
                {todayTasks.length} להיום
              </button>
            )}
            {focusFilter && <button onClick={() => setFocusFilter(null)} className="text-slate-400 hover:text-slate-600 mr-1">× הכל</button>}
          </p>
        </div>
        <Link
          href={focusFilter === "overdue" ? "/tasks?filter=overdue" : "/tasks"}
          className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1 mt-1"
        >
          כל המשימות
          <ArrowLeft className="w-3 h-3" />
        </Link>
      </div>

      <div className="divide-y divide-slate-50">
        {allFocusTasks.slice(0, 5).map((task) => {
          const isCompleting = completingIds.has(task.id);
          const focusStatus = computeFocusStatus(task);
          const config = FOCUS_CONFIG[focusStatus];
          const timeStr = formatFocusTime(task);
          return (
            <div
              key={task.id}
              className={cn(
                "px-5 py-3 flex items-center gap-3 transition-all duration-300",
                focusStatus === "overdue" ? "bg-red-50/30" : "hover:bg-slate-50/50",
                isCompleting && "opacity-0 max-h-0 py-0 overflow-hidden"
              )}
            >
              {/* Complete checkbox */}
              <button
                onClick={() => handleComplete(task.id)}
                disabled={isCompleting}
                className={cn(
                  "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200",
                  isCompleting
                    ? "bg-green-500 border-green-500"
                    : "border-slate-300 hover:border-green-500 hover:bg-green-50"
                )}
                title="סמן כבוצע"
              >
                {isCompleting && <Check className="w-3 h-3 text-white" />}
              </button>

              {/* Title — opens the task */}
              <Link
                href={`/tasks?task=${task.id}`}
                className={cn(
                  "text-sm font-medium text-petra-text flex-1 truncate transition-all duration-200 hover:text-brand-600",
                  isCompleting && "line-through text-petra-muted"
                )}
              >
                {task.title}
              </Link>

              {/* Time */}
              <span
                className="text-[10px] font-medium flex items-center gap-0.5 px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ color: config.color, background: config.bg }}
              >
                <Clock className="w-3 h-3" />
                {timeStr}
              </span>

              {/* Status badge */}
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ color: config.color, background: config.bg, border: `1px solid ${config.border}` }}
              >
                {config.label}
              </span>

              {/* Priority */}
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  background:
                    task.priority === "URGENT" ? "#DC2626" :
                      task.priority === "HIGH" ? "#EF4444" :
                        task.priority === "MEDIUM" ? "#F59E0B" : "#94A3B8",
                }}
              />
            </div>
          );
        })}
        {allFocusTasks.length > 5 && (
          <div className="px-5 py-2.5 border-t border-slate-100">
            <Link href="/tasks" className="text-xs text-brand-500 hover:text-brand-600 font-medium">
              הצג {allFocusTasks.length - 5} נוספות ←
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
