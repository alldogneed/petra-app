"use client";
import { useState } from "react";
import Link from "next/link";
import { isToday, isPast, isYesterday, differenceInMinutes, format, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { DashboardStats, TASK_CATEGORY_LABELS } from "@/components/dashboard/dashboard-shared";
import {
  DashCard,
  DashCardHeader,
  DashLink,
  Segmented,
  TaskCheckbox,
  PriorityDot,
} from "@/components/dashboard/dash-ui";


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

/** Time text per the design: overdue → "באיחור · 09:00" / "באיחור · אתמול" / "באיחור · 28/09". */
function focusTimeLabel(task: { dueAt: string | null; dueDate: string | null }, status: FocusStatus): string {
  if (status !== "overdue") return formatFocusTime(task);
  const ref = task.dueAt ?? task.dueDate;
  if (!ref) return "באיחור";
  const d = new Date(ref);
  const when = task.dueAt && isToday(d)
    ? format(d, "HH:mm")
    : isYesterday(d)
      ? "אתמול"
      : format(d, "dd/MM");
  return `באיחור · ${when}`;
}

type FocusFilter = "all" | "overdue" | "today";

export function DailyFocusSection({ todayTasks, overdueTasks, onComplete }: {
  todayTasks: DashboardStats["todayTasks"];
  overdueTasks: DashboardStats["overdueTasks"];
  onComplete: (taskId: string) => void;
}) {
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [focusFilterState, setFocusFilter] = useState<"overdue" | "today" | null>(null);
  // A filter whose bucket emptied (e.g. all overdue tasks completed) falls back to "all"
  // so the card never disappears while the other bucket still has tasks.
  const focusFilter =
    (focusFilterState === "overdue" && overdueTasks.length === 0) || (focusFilterState === "today" && todayTasks.length === 0)
      ? null
      : focusFilterState;
  const allFocusTasks = focusFilter === "overdue" ? overdueTasks : focusFilter === "today" ? todayTasks : [...overdueTasks, ...todayTasks];
  const totalCount = overdueTasks.length + todayTasks.length;
  if (allFocusTasks.length === 0) return null;

  const handleComplete = (taskId: string) => {
    setCompletingIds((prev) => new Set(prev).add(taskId));
    // Small delay for animation, then fire the actual API call
    setTimeout(() => onComplete(taskId), 350);
  };

  const options: { key: FocusFilter; label: React.ReactNode }[] = [{ key: "all", label: "הכל" }];
  if (overdueTasks.length > 0) options.push({ key: "overdue", label: `${overdueTasks.length} באיחור` });
  if (todayTasks.length > 0) options.push({ key: "today", label: `${todayTasks.length} להיום` });

  return (
    <DashCard>
      <DashCardHeader
        title="מיקוד יומי"
        subtitle={`${totalCount} ${totalCount === 1 ? "משימה מחכה" : "משימות מחכות"}`}
        actions={
          <>
            <Segmented<FocusFilter>
              options={options}
              value={focusFilter ?? "all"}
              onChange={(k) => setFocusFilter(k === "all" ? null : k)}
            />
            <DashLink href={focusFilter === "overdue" ? "/tasks?filter=overdue" : "/tasks"}>כל המשימות</DashLink>
          </>
        }
      />

      {allFocusTasks.slice(0, 5).map((task) => {
        const isCompleting = completingIds.has(task.id);
        const focusStatus = computeFocusStatus(task);
        const overdue = focusStatus === "overdue";
        const category = TASK_CATEGORY_LABELS[task.category] ?? null;
        return (
          <div
            key={task.id}
            className={cn(
              "flex items-center gap-3 py-[11px] border-t border-slate-100 max-h-20 transition-all duration-300",
              isCompleting && "opacity-0 max-h-0 py-0 overflow-hidden"
            )}
          >
            <TaskCheckbox onClick={() => handleComplete(task.id)} completing={isCompleting} />
            <PriorityDot priority={task.priority} />
            <Link
              href={`/tasks?task=${task.id}`}
              className={cn(
                "flex-1 min-w-0 truncate text-sm font-medium text-slate-900 hover:text-orange-600 transition-colors",
                isCompleting && "line-through text-slate-400"
              )}
            >
              {task.title}
            </Link>
            {category && <span className="text-xs text-slate-500 flex-shrink-0">{category}</span>}
            <span
              className={cn(
                "text-xs font-medium flex-shrink-0 min-w-[64px] text-left tabular-nums whitespace-nowrap",
                overdue ? "text-red-700" : "text-slate-500"
              )}
            >
              {focusTimeLabel(task, focusStatus)}
            </span>
          </div>
        );
      })}
      {allFocusTasks.length > 5 && (
        <div className="py-2.5 border-t border-slate-100">
          <DashLink href="/tasks">הצג {allFocusTasks.length - 5} נוספות</DashLink>
        </div>
      )}
    </DashCard>
  );
}
