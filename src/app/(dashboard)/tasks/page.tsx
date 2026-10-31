"use client";
import { PageTitle } from "@/components/ui/PageTitle";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  isToday,
  isPast,
  isFuture,
  differenceInMinutes,
  format,
  addDays,
  startOfDay,
} from "date-fns";
import { useTranslations } from "next-intl";
import {
  ListTodo,
  Plus,
  X,
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  Trash2,
  CalendarClock,
  Flame,
  Timer,
  CalendarDays,
  Calendar,
  Filter,
  Pencil,
  Search,
  Copy,
  LayoutTemplate,
  Repeat2,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Users,
  PawPrint,
  Target,
  Sparkles,
  Download,
  FileSpreadsheet,
  CheckSquare,
} from "lucide-react";
import { cn, fetchJSON } from "@/lib/utils";
import { mapWithConcurrency } from "@/lib/concurrency";
import { toast } from "sonner";
import { usePlan } from "@/hooks/usePlan";
import { getMaxTasks } from "@/lib/feature-flags";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { usePermissions } from "@/hooks/usePermissions";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { dateFnsLocaleFor } from "@/lib/format";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  dueAt: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  relatedEntityName: string | null;        // resolved by API
  relatedEntityCustomerId: string | null;  // resolved by API — for navigation
  relatedEntityLeadId: string | null;      // resolved by API — for lead navigation
}

type ComputedStatus = "active" | "overdue" | "scheduled" | "completed";

// ─── Constants ────────────────────────────────────────────────────────────────

// Labels live in messages (tasks.categories / priorities / statusFilters / computedStatus);
// these constants keep only ids + styling.
const CATEGORIES = [
  { id: "ALL" },
  { id: "GENERAL" },
  { id: "BOARDING" },
  { id: "TRAINING" },
  { id: "LEADS" },
  { id: "HEALTH" },
  { id: "MEDICATION" },
  { id: "FEEDING" },
];

const PRIORITIES: Record<string, { color: string }> = {
  LOW: { color: "#94A3B8" },
  MEDIUM: { color: "#F59E0B" },
  HIGH: { color: "#EF4444" },
  URGENT: { color: "#DC2626" },
};
const PRIORITY_IDS = Object.keys(PRIORITIES);

const STATUS_FILTERS = [
  { id: "ALL", icon: ListTodo },
  { id: "active", icon: Flame },
  { id: "overdue", icon: AlertCircle },
  { id: "scheduled", icon: CalendarDays },
  { id: "COMPLETED", icon: CheckCircle2 },
];

const STATUS_CONFIG: Record<ComputedStatus, { color: string; bg: string; border: string }> = {
  active: { color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
  overdue: { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
  scheduled: { color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB" },
  completed: { color: "#10B981", bg: "#ECFDF5", border: "#A7F3D0" },
};

// ─── i18n helpers ─────────────────────────────────────────────────────────────

/** Translator of the "tasks" namespace, passed to module-level helpers. */
type TasksT = ReturnType<typeof useTranslations<"tasks">>;

// Values come from the API — an id without a message falls back to the raw id (as before).
const categoryLabel = (t: TasksT, id: string) =>
  t.has(`categories.${id}`) ? t(`categories.${id}`) : id;
const priorityLabel = (t: TasksT, id: string) =>
  t.has(`priorities.${id}`) ? t(`priorities.${id}`) : id;
const taskStatusLabel = (t: TasksT, id: string) =>
  t.has(`taskStatus.${id}`) ? t(`taskStatus.${id}`) : id;

// ─── Status Calculation Logic ─────────────────────────────────────────────────

function computeTaskStatus(task: Task): ComputedStatus {
  if (task.status === "COMPLETED") return "completed";

  const now = new Date();

  // If task has a specific time (dueAt)
  if (task.dueAt) {
    const dueAt = new Date(task.dueAt);
    const diffMin = differenceInMinutes(dueAt, now);

    // Within ±30 min window = Active (Green)
    if (diffMin >= -30 && diffMin <= 30) return "active";
    // Past the window = Overdue (Red)
    if (isPast(dueAt) && diffMin < -30) return "overdue";
    // Today but not yet in window = Active (treat as "coming up today")
    if (isToday(dueAt) && diffMin > 30) return "active";
    // Future = Scheduled (Gray)
    return "scheduled";
  }

  // If task only has a date (no specific time)
  if (task.dueDate) {
    const dueDate = startOfDay(new Date(task.dueDate));
    if (isToday(dueDate)) return "active";
    if (isPast(dueDate)) return "overdue";
    if (isFuture(dueDate)) return "scheduled";
  }

  // No due date at all — treat as scheduled
  return "scheduled";
}

function formatShortDate(task: Task, t: TasksT): string {
  if (task.dueAt) {
    const d = new Date(task.dueAt);
    if (isToday(d)) return t("card.todayAt", { time: format(d, t.raw("dateFormats.time")) });
    return format(d, t.raw("dateFormats.shortDateTime"));
  }
  if (task.dueDate) {
    const d = new Date(task.dueDate);
    if (isToday(d)) return t("card.today");
    return format(d, t.raw("dateFormats.shortDate"));
  }
  return "";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TasksPage() {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const { canExportData } = usePermissions();
  const { isFree, tier } = usePlan();
  const maxTasks = getMaxTasks(tier);
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "tasks";

  const [activeCategory, setActiveCategory] = useState("ALL");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewTask, setShowNewTask] = useState(false);
  const [postponeTask, setPostponeTask] = useState<Task | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [tick, setTick] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const queryClient = useQueryClient();

  // Auto-refresh every 30 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      setTick((t) => t + 1);
      queryClient.invalidateQueries({ queryKey: ["tasks", activeCategory] });
    }, 30_000);
    return () => clearInterval(timer);
  }, [autoRefresh, queryClient, activeCategory]);

  // Keyboard shortcut: 'N' to create new task (when no input is focused)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "n" || e.key === "N") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        setShowNewTask(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Fetch tasks — completed tab fetches only completed; otherwise fetch only non-completed
  const { data: allTasks = [], isLoading, isError, isFetching: tasksFetching, refetch: refetchTasks } = useQuery<Task[]>({
    queryKey: ["tasks", activeCategory, activeFilter, dateFrom, dateTo],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeCategory !== "ALL") params.set("category", activeCategory);
      // Scope query to reduce data fetched: completed tab → only completed; else exclude completed
      if (activeFilter === "COMPLETED") params.set("status", "COMPLETED");
      else params.set("excludeCompleted", "true");
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      return fetchJSON<Task[]>(`/api/tasks?${params}`);
    },
  });

  // Compute each task's status once per data/tick — avoids O(n log n) redundant calls
  const taskStatuses = useMemo(() => {
    const map = new Map<string, ComputedStatus>();
    for (const t of allTasks) map.set(t.id, computeTaskStatus(t));
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTasks, tick]);

  // Apply computed status filter + search on client
  const filteredTasks = useMemo(() => allTasks.filter((task) => {
    if (activeFilter !== "ALL") {
      if (activeFilter === "COMPLETED" && task.status !== "COMPLETED") return false;
      if (activeFilter !== "COMPLETED") {
        if (taskStatuses.get(task.id) !== activeFilter) return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        task.title.toLowerCase().includes(q) ||
        (task.description?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  }), [allTasks, activeFilter, searchQuery, taskStatuses]);

  // Sort: overdue first, then active, then scheduled, then completed
  const sortedTasks = useMemo(() => [...filteredTasks].sort((a, b) => {
    const order: Record<ComputedStatus, number> = { overdue: 0, active: 1, scheduled: 2, completed: 3 };
    const statusA = taskStatuses.get(a.id) ?? "scheduled";
    const statusB = taskStatuses.get(b.id) ?? "scheduled";
    if (order[statusA] !== order[statusB]) return order[statusA] - order[statusB];
    const dateA = a.dueAt || a.dueDate || a.createdAt;
    const dateB = b.dueAt || b.dueDate || b.createdAt;
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  }), [filteredTasks, taskStatuses]);

  // Count by status for filter badges
  const statusCounts = useMemo(() => allTasks.reduce(
    (acc, task) => {
      const s = taskStatuses.get(task.id) ?? "scheduled";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  ), [allTasks, taskStatuses]);

  // Deep links from the dashboard: ?filter=overdue|active|scheduled preselects the
  // status filter; ?task=<id> opens that task's edit modal once the list is loaded.
  useEffect(() => {
    const filter = new URLSearchParams(window.location.search).get("filter");
    if (filter && STATUS_FILTERS.some((f) => f.id === filter)) setActiveFilter(filter);
  }, []);
  const taskDeepLinkHandled = useRef(false);
  useEffect(() => {
    if (taskDeepLinkHandled.current || isLoading) return;
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get("task");
    if (!taskId) return;
    taskDeepLinkHandled.current = true;
    const target = allTasks.find((t) => t.id === taskId);
    if (target) setEditTask(target);
    else toast.error(t("toasts.notFound"));
    params.delete("task");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, [allTasks, isLoading]);

  const createMutation = useMutation({
    mutationFn: (data: { title: string; description: string; category: string; priority: string; dueDate: string; dueAt: string; relatedEntityType: string | null; relatedEntityId: string | null }) => {
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description || undefined,
        category: data.category,
        priority: data.priority,
      };
      if (data.dueDate) payload.dueDate = data.dueDate;
      if (data.dueDate && data.dueAt) {
        payload.dueAt = new Date(`${data.dueDate}T${data.dueAt}:00`).toISOString();
      }
      if (data.relatedEntityType) payload.relatedEntityType = data.relatedEntityType;
      if (data.relatedEntityId) payload.relatedEntityId = data.relatedEntityId;
      return fetchJSON<Task>("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (newTask: Task) => {
      queryClient.setQueryData<Task[]>(["tasks", activeCategory], (old) =>
        [newTask, ...(old ?? [])]
      );
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-counters"] });
      setShowNewTask(false);
      toast.success(t("toasts.created"));
    },
    onError: (err: Error) => {
      if (err.message?.includes("מוגבל") || err.message?.includes("403")) { // i18n-ok — matches the API error text
        toast.error(t("toasts.limitReached"));
      } else {
        toast.error(t("toasts.createError"));
      }
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetchJSON<Task>(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onMutate: async ({ id, status }) => {
      const key = ["tasks", activeCategory, activeFilter, dateFrom, dateTo];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<Task[]>(key);
      queryClient.setQueryData<Task[]>(key, (old) =>
        old?.map((t) => t.id === id
          ? { ...t, status, completedAt: status === "COMPLETED" ? new Date().toISOString() : null }
          : t) ?? []
      );
      return { prev };
    },
    onSuccess: (_data, { status }) => {
      type Counters = { openTasks: number; overdueFollowUps: number; pendingBookings: number; activeBoarding: number };
      queryClient.setQueryData<Counters>(["sidebar-counters"], (old) => {
        if (!old) return old;
        const delta = status === "COMPLETED" ? -1 : 1;
        return { ...old, openTasks: Math.max(0, old.openTasks + delta) };
      });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-counters"] });
      if (status === "COMPLETED") toast.success(t("toasts.completed"));
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["tasks", activeCategory, activeFilter, dateFrom, dateTo], ctx.prev);
      toast.error(t("toasts.updateError"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJSON(`/api/tasks/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      const key = ["tasks", activeCategory, activeFilter, dateFrom, dateTo];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<Task[]>(key);
      queryClient.setQueryData<Task[]>(key, (old) =>
        old?.filter((t) => t.id !== id) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["tasks", activeCategory, activeFilter, dateFrom, dateTo], ctx.prev);
      toast.error(t("toasts.deleteError"));
    },
    onSuccess: () => {
      setDeleteConfirm(null);
      toast.success(t("toasts.deleted"));
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-counters"] });
    },
  });

  const bulkCompleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      // Bounded concurrency — firing all PATCHes at once exhausts the DB pool
      // and cascades into app-wide 500s (incl. the dashboard). See concurrency.ts.
      mapWithConcurrency(ids, 3, (id) => fetchJSON(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      })),
    onSuccess: (_, ids) => {
      type Counters = { openTasks: number; overdueFollowUps: number; pendingBookings: number; activeBoarding: number };
      queryClient.setQueryData<Counters>(["sidebar-counters"], (old) =>
        old ? { ...old, openTasks: Math.max(0, old.openTasks - ids.length) } : old
      );
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-counters"] });
      setSelectedTaskIds(new Set());
      toast.success(t("toasts.bulkCompleted", { count: ids.length }));
    },
    onError: () => toast.error(t("toasts.bulkUpdateError")),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      // Bounded concurrency — same rationale as bulkCompleteMutation (see concurrency.ts).
      // Each delete catches internally so one failure doesn't abort the rest.
      mapWithConcurrency(ids, 3, async (id) => {
        try {
          await fetchJSON(`/api/tasks/${id}`, { method: "DELETE" });
          return { id, ok: true };
        } catch {
          return { id, ok: false };
        }
      }),
    onSuccess: (results) => {
      const failed = results.filter((r) => !r.ok).length;
      const deleted = results.length - failed;
      if (failed > 0) {
        toast.error(t("toasts.bulkDeletePartial", { deleted, failed }));
      } else {
        toast.success(t("toasts.bulkDeleted", { count: deleted }));
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-counters"] });
      setShowBulkDeleteConfirm(false);
      setSelectedTaskIds(new Set());
      setSelectionMode(false);
    },
    onError: () => {
      setShowBulkDeleteConfirm(false);
      toast.error(t("toasts.bulkDeleteError"));
    },
  });

  const postponeMutation = useMutation({
    mutationFn: ({ id, dueDate, dueAt }: { id: string; dueDate: string; dueAt: string | null }) => {
      const payload: Record<string, unknown> = { dueDate };
      if (dueDate && dueAt) {
        payload.dueAt = new Date(`${dueDate}T${dueAt}:00`).toISOString();
      } else {
        payload.dueAt = null;
      }
      return fetchJSON<Task>(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (updatedTask: Task) => {
      queryClient.setQueryData<Task[]>(["tasks", activeCategory], (old) =>
        old?.map((t) => t.id === updatedTask.id ? updatedTask : t) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setPostponeTask(null);
      toast.success(t("toasts.postponed"));
    },
    onError: () => toast.error(t("toasts.postponeError")),
  });

  const duplicateMutation = useMutation({
    mutationFn: (task: Task) =>
      fetchJSON("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t("duplicateTitle", { title: task.title }),
          description: task.description || undefined,
          category: task.category,
          priority: task.priority,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-counters"] });
      toast.success(t("toasts.duplicated"));
    },
    onError: () => toast.error(t("toasts.duplicateError")),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; title: string; description: string; category: string; priority: string; dueDate: string; dueAt: string; relatedEntityType: string | null; relatedEntityId: string | null }) => {
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description || undefined,
        category: data.category,
        priority: data.priority,
        relatedEntityType: data.relatedEntityType ?? null,
        relatedEntityId: data.relatedEntityId ?? null,
      };
      if (data.dueDate) payload.dueDate = data.dueDate;
      if (data.dueDate && data.dueAt) {
        payload.dueAt = new Date(`${data.dueDate}T${data.dueAt}:00`).toISOString();
      } else {
        payload.dueAt = null;
      }
      return fetchJSON<Task>(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (updatedTask: Task) => {
      queryClient.setQueryData<Task[]>(["tasks", activeCategory], (old) =>
        old?.map((t) => t.id === updatedTask.id ? updatedTask : t) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditTask(null);
      toast.success(t("toasts.updated"));
    },
    onError: () => toast.error(t("toasts.updateError")),
  });

  return (
    <div>
      <PageTitle title={t("title")} />
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        {/* Right (RTL start): action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {tab !== "automation" && (
            isFree && maxTasks !== null && activeFilter !== "COMPLETED" && allTasks.length >= maxTasks ? (
              <a href="/upgrade" className="btn-primary gap-2 bg-amber-500 hover:bg-amber-600 border-amber-500 text-white rounded-xl px-4 py-2 text-sm font-medium flex items-center">
                <Sparkles className="w-4 h-4" />
                {t("header.upgrade")}
              </a>
            ) : (
              <button className="btn-primary" onClick={() => setShowNewTask(true)}>
                <Plus className="w-4 h-4" />
                {t("header.newTask")}
              </button>
            )
          )}
        </div>

        {/* Left: title + count + refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? t("header.autoRefreshOff") : t("header.autoRefreshOn")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 h-7 rounded-lg border text-xs font-medium transition-all",
              autoRefresh
                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                : "bg-white border-slate-200 text-petra-muted hover:text-petra-text"
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
            {t("header.auto")}
          </button>
          <button
            onClick={() => { refetchTasks(); setTick((t) => t + 1); }}
            disabled={tasksFetching}
            title={t("header.refreshNow")}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-petra-muted hover:text-petra-text transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", tasksFetching && "animate-spin")} />
          </button>
          <h1 className="page-title">
            {t("title")}
            {tab !== "automation" && (
              <span className="text-sm font-normal text-petra-muted ms-2">({allTasks.length})</span>
            )}
          </h1>
        </div>
      </div>

      {/* Free tier task limit banner */}
      {isFree && maxTasks !== null && activeFilter !== "COMPLETED" && (
        <div className={`flex items-center justify-between gap-3 mb-4 px-4 py-3 rounded-xl border ${
          allTasks.length >= maxTasks ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"
        }`}>
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className={`w-4 h-4 flex-shrink-0 ${allTasks.length >= maxTasks ? "text-amber-500" : "text-slate-400"}`} />
            <span className={allTasks.length >= maxTasks ? "text-amber-800" : "text-slate-600"}>
              {t("freeLimit.banner", { count: allTasks.length, max: maxTasks })}
            </span>
          </div>
          {allTasks.length >= maxTasks && (
            <a href="/upgrade" className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap">
              {t("freeLimit.upgradeLink")}
            </a>
          )}
        </div>
      )}

      {tab === "automation" ? (
        <AutomationTab
          onTasksGenerated={() => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["sidebar-counters"] });
          }}
        />
      ) : (<>

      {/* Quick Stats Strip */}
      {allTasks.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div className="card p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <p className="text-base font-bold text-petra-text">{statusCounts.overdue || 0}</p>
              <p className="text-[10px] text-petra-muted">{t("stats.overdue")}</p>
            </div>
          </div>
          <div className="card p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-base font-bold text-petra-text">{statusCounts.active || 0}</p>
              <p className="text-[10px] text-petra-muted">{t("stats.activeNow")}</p>
            </div>
          </div>
          <div className="card p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-base font-bold text-petra-text">{statusCounts.scheduled || 0}</p>
              <p className="text-[10px] text-petra-muted">{t("stats.scheduled")}</p>
            </div>
          </div>
          <div className="card p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-base font-bold text-petra-text">{statusCounts.completed || 0}</p>
              <p className="text-[10px] text-petra-muted">{t("stats.completed")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Row 1: Status Filter Tabs */}
      <div className="flex gap-1.5 mb-2 overflow-x-auto scrollbar-hide flex-nowrap">
        {STATUS_FILTERS.map((f) => {
          const Icon = f.icon;
          const count = f.id === "ALL"
            ? allTasks.length
            : f.id === "COMPLETED"
            ? statusCounts.completed || 0
            : statusCounts[f.id] || 0;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex-shrink-0",
                activeFilter === f.id
                  ? "bg-slate-800 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-petra-muted hover:bg-slate-50"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t(`statusFilters.${f.id}`)}
              {count > 0 && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center",
                  activeFilter === f.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Row 2: Category Chips */}
      <div className="flex items-center gap-2 mb-2">
        <Filter className="w-3.5 h-3.5 text-petra-muted flex-shrink-0" />
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-nowrap flex-1 min-w-0">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex-shrink-0",
                activeCategory === c.id
                  ? "bg-brand-500 text-white"
                  : "bg-slate-100 text-petra-muted hover:bg-slate-200"
              )}
            >
              {t(`categories.${c.id}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Row 3: Search + Date Range */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted pointer-events-none" />
          <input
            className="input ps-9 w-full text-sm"
            placeholder={t("filters.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute end-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-200 text-petra-muted"
              onClick={() => setSearchQuery("")}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-petra-muted flex-shrink-0" />
          <input
            type="date" lang={cfg.lang}
            className="input text-xs py-1.5 px-2 w-[120px]"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <span className="text-xs text-petra-muted">—</span>
          <input
            type="date" lang={cfg.lang}
            className="input text-xs py-1.5 px-2 w-[120px]"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-petra-muted hover:text-red-500 transition-colors"
              title={t("filters.clearDates")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom controls: export + select */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {canExportData && (
          <button
            onClick={() => setShowExportModal(true)}
            className="btn-secondary gap-1.5 text-xs py-1.5 px-3"
          >
            <Download className="w-3.5 h-3.5" />
            {t("toolbar.export")}
          </button>
          )}
          <button
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              selectionMode
                ? "bg-brand-600 text-white border-brand-600 hover:bg-brand-700"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200"
            )}
            onClick={() => {
              setSelectionMode(!selectionMode);
              if (selectionMode) setSelectedTaskIds(new Set());
            }}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            {selectionMode ? t("toolbar.cancelSelection") : t("toolbar.select")}
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedTaskIds.size > 0 && (
        <div className="flex items-center gap-3 mb-3 p-3 rounded-xl bg-brand-50 border border-brand-100">
          <span className="text-sm font-medium text-brand-700">{t("bulk.selected", { count: selectedTaskIds.size })}</span>
          <button
            className="btn-primary text-xs py-1.5 px-3"
            disabled={bulkCompleteMutation.isPending}
            onClick={() => bulkCompleteMutation.mutate([...selectedTaskIds])}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {bulkCompleteMutation.isPending ? "..." : t("bulk.completeAll")}
          </button>
          <button
            className="btn-danger text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
            disabled={bulkDeleteMutation.isPending}
            onClick={() => setShowBulkDeleteConfirm(true)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {bulkDeleteMutation.isPending ? tc("progress.deleting") : t("bulk.deleteSelected")}
          </button>
          <button
            className="text-xs text-petra-muted hover:text-petra-text ms-auto"
            onClick={() => { setSelectedTaskIds(new Set()); setSelectionMode(false); }}
          >
            {t("toolbar.cancelSelection")}
          </button>
        </div>
      )}

      {/* Tasks List */}
      {isLoading ? (
        <PetraLoader />
      ) : isError ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <h3 className="text-base font-semibold text-petra-text mb-1">{t("list.loadError")}</h3>
          <p className="text-sm text-petra-muted">{t("list.loadErrorHint")}</p>
        </div>
      ) : sortedTasks.length === 0 ? (
        <div className="empty-state text-center py-16">
          <div className="empty-state-icon mx-auto">
            <ListTodo className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-petra-text mb-1">{t("list.empty")}</h3>
          <p className="text-sm text-petra-muted mb-4">
            {activeFilter !== "ALL"
              ? t("list.emptyFiltered")
              : t("list.emptyHint")}
          </p>
          <button
            className="btn-primary text-sm inline-flex items-center gap-1.5 mx-auto"
            onClick={() => setShowNewTask(true)}
          >
            <Plus className="w-4 h-4" />
            {t("header.newTask")}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {selectionMode && sortedTasks.length > 1 && activeFilter !== "COMPLETED" && (
            <div className="flex justify-end">
              <button
                className="text-xs text-petra-muted hover:text-brand-600"
                onClick={() => {
                  const openIds = sortedTasks.filter((t) => t.status !== "COMPLETED").map((t) => t.id);
                  const allSelected = openIds.every((id) => selectedTaskIds.has(id));
                  setSelectedTaskIds(allSelected ? new Set() : new Set(openIds));
                }}
              >
                {sortedTasks.filter((t) => t.status !== "COMPLETED").every((t) => selectedTaskIds.has(t.id))
                  ? t("list.deselectAll")
                  : t("list.selectAll")}
              </button>
            </div>
          )}
          {sortedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isSelected={selectedTaskIds.has(task.id)}
              selectionMode={selectionMode}
              onSelect={(id) => setSelectedTaskIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
              })}
              onToggle={(id, status) => toggleMutation.mutate({ id, status })}
              onPostpone={(task) => setPostponeTask(task)}
              onDelete={(task) => setDeleteConfirm(task)}
              onEdit={(task) => setEditTask(task)}
              onDuplicate={(task) => duplicateMutation.mutate(task)}
            />
          ))}
        </div>
      )}

      {/* Edit Task Modal */}
      {editTask && (
        <EditTaskModal
          task={editTask}
          onClose={() => setEditTask(null)}
          onSubmit={(data) => editMutation.mutate(data)}
          isPending={editMutation.isPending}
        />
      )}

      {/* New Task Modal */}
      {showNewTask && (
        <NewTaskModal
          onClose={() => setShowNewTask(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isPending={createMutation.isPending}
        />
      )}

      {/* Postpone Modal */}
      {postponeTask && (
        <PostponeModal
          task={postponeTask}
          onClose={() => setPostponeTask(null)}
          onSubmit={(data) => postponeMutation.mutate(data)}
          isPending={postponeMutation.isPending}
        />
      )}

      {/* Export Modal */}
      {showExportModal && (
        <ExportTasksModal
          tasks={sortedTasks}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)} />
          <div className="modal-content max-w-sm mx-4 p-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-petra-text mb-2">{t("deleteDialog.title")}</h2>
              <p className="text-sm text-petra-muted mb-1">
                {t("deleteDialog.body", { title: deleteConfirm.title })}
              </p>
              <p className="text-xs text-petra-muted mb-6">{t("deleteDialog.irreversible")}</p>
              <div className="flex gap-3">
                <button
                  className="btn-danger flex-1"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                >
                  {deleteMutation.isPending ? tc("progress.deleting") : tc("actions.delete")}
                </button>
                <button className="btn-secondary flex-1" onClick={() => setDeleteConfirm(null)}>
                  {tc("actions.cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      {showBulkDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setShowBulkDeleteConfirm(false)} />
          <div className="modal-content max-w-sm mx-4 p-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-petra-text mb-2">{t("bulkDeleteDialog.title")}</h2>
              <p className="text-sm text-petra-muted mb-1">
                {t("bulkDeleteDialog.body", { count: selectedTaskIds.size })}
              </p>
              <p className="text-xs text-petra-muted mb-6">{t("deleteDialog.irreversible")}</p>
              <div className="flex gap-3">
                <button
                  className="btn-danger flex-1"
                  disabled={bulkDeleteMutation.isPending}
                  onClick={() => bulkDeleteMutation.mutate([...selectedTaskIds])}
                >
                  {bulkDeleteMutation.isPending ? tc("progress.deleting") : tc("actions.delete")}
                </button>
                <button className="btn-secondary flex-1" onClick={() => setShowBulkDeleteConfirm(false)}>
                  {tc("actions.cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </>)}
    </div>
  );
}

// ─── Automation Tab ───────────────────────────────────────────────────────────

function AutomationTab({ onTasksGenerated }: { onTasksGenerated: () => void }) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const { locale, cfg } = useBusinessLocale();
  const queryClient = useQueryClient();

  // Template state
  const [showNewTpl, setShowNewTpl] = useState(false);
  const [tplForm, setTplForm] = useState({ name: "", defaultCategory: "GENERAL", defaultPriority: "MEDIUM", defaultTitleTemplate: "", defaultDescriptionTemplate: "" });

  // Recurring state
  const [showNewRule, setShowNewRule] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState({ templateId: "", freq: "DAILY", interval: 1, weekDays: [] as number[], startAt: new Date().toISOString().slice(0, 10), endAt: "" });

  const { data: templates = [], isLoading: loadingTpl } = useQuery<TaskTemplate[]>({
    queryKey: ["task-templates"],
    queryFn: () => fetchJSON("/api/task-templates"),
  });

  const { data: rules = [], isLoading: loadingRules } = useQuery<RecurrenceRule[]>({
    queryKey: ["task-recurrence-rules"],
    queryFn: () => fetchJSON("/api/task-recurrence"),
  });

  const createTplMutation = useMutation({
    mutationFn: (data: typeof tplForm) => fetchJSON("/api/task-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      setShowNewTpl(false);
      setTplForm({ name: "", defaultCategory: "GENERAL", defaultPriority: "MEDIUM", defaultTitleTemplate: "", defaultDescriptionTemplate: "" });
      toast.success(t("automation.toasts.templateCreated"));
    },
    onError: () => toast.error(t("automation.toasts.templateCreateError")),
  });

  const deleteTplMutation = useMutation({
    mutationFn: (id: string) => fetchJSON(`/api/task-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["task-templates"] }); toast.success(t("automation.toasts.templateDeleted")); },
    onError: () => toast.error(t("automation.toasts.templateDeleteError")),
  });

  const useTplMutation = useMutation({
    mutationFn: (tpl: TaskTemplate) => fetchJSON("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: tpl.defaultTitleTemplate, description: tpl.defaultDescriptionTemplate || undefined, category: tpl.defaultCategory, priority: tpl.defaultPriority }) }),
    onSuccess: () => { onTasksGenerated(); toast.success(t("automation.toasts.taskFromTemplate")); },
    onError: () => toast.error(t("automation.toasts.taskCreateError")),
  });

  const createRuleMutation = useMutation({
    mutationFn: (data: { templateId: string; rrule: string; startAt: string; endAt: string | null }) =>
      fetchJSON("/api/task-recurrence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-recurrence-rules"] });
      setShowNewRule(false);
      setRuleForm({ templateId: "", freq: "DAILY", interval: 1, weekDays: [], startAt: new Date().toISOString().slice(0, 10), endAt: "" });
      toast.success(t("automation.toasts.ruleCreated"));
    },
    onError: () => toast.error(t("automation.toasts.ruleCreateError")),
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetchJSON(`/api/task-recurrence/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-recurrence-rules"] }),
    onError: () => toast.error(t("automation.toasts.ruleUpdateError")),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => fetchJSON(`/api/task-recurrence/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["task-recurrence-rules"] }); toast.success(t("automation.toasts.ruleDeleted")); },
    onError: () => toast.error(t("automation.toasts.ruleDeleteError")),
  });

  async function generateNow(rule: RecurrenceRule) {
    setGeneratingId(rule.id);
    try {
      const res = await fetchJSON<{ created: number; error?: string }>(`/api/task-recurrence/${rule.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days: 30 }) });
      if ((res as { error?: string }).error) { toast.error((res as { error?: string }).error); return; }
      toast.success(t("automation.toasts.generated", { count: (res as { created: number }).created }));
      onTasksGenerated();
      queryClient.invalidateQueries({ queryKey: ["task-recurrence-rules"] });
    } catch { toast.error(t("automation.toasts.generateError")); } finally { setGeneratingId(null); }
  }

  return (
    <div className="space-y-10">
      {/* ── Templates ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-brand-500" />
              {t("automation.templatesTitle")}
            </h2>
            <p className="text-xs text-petra-muted mt-0.5">{t("automation.templatesSubtitle")}</p>
          </div>
          {!showNewTpl && (
            <button onClick={() => setShowNewTpl(true)} className="btn-secondary gap-2">
              <Plus className="w-4 h-4" />{t("automation.newTemplate")}
            </button>
          )}
        </div>

        {showNewTpl && (
          <div className="card p-4 mb-4 space-y-3">
            <h3 className="text-sm font-bold text-petra-text">{t("automation.newTemplate")}</h3>
            <div>
              <label className="label">{t("automation.templateName")}</label>
              <input className="input w-full" placeholder={t("automation.templateNamePlaceholder")} value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} />
            </div>
            <div>
              <label className="label">{t("automation.defaultTitle")}</label>
              <input className="input w-full" placeholder={t("automation.defaultTitlePlaceholder")} value={tplForm.defaultTitleTemplate} onChange={(e) => setTplForm({ ...tplForm, defaultTitleTemplate: e.target.value })} />
            </div>
            <div>
              <label className="label">{t("automation.descriptionOptional")}</label>
              <textarea className="input w-full resize-none" rows={2} value={tplForm.defaultDescriptionTemplate} onChange={(e) => setTplForm({ ...tplForm, defaultDescriptionTemplate: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t("form.category")}</label>
                <select className="input w-full" value={tplForm.defaultCategory} onChange={(e) => setTplForm({ ...tplForm, defaultCategory: e.target.value })}>
                  {CATEGORIES.filter((c) => c.id !== "ALL").map((c) => <option key={c.id} value={c.id}>{t(`categories.${c.id}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{t("form.priority")}</label>
                <select className="input w-full" value={tplForm.defaultPriority} onChange={(e) => setTplForm({ ...tplForm, defaultPriority: e.target.value })}>
                  {PRIORITY_IDS.map((k) => <option key={k} value={k}>{t(`priorities.${k}`)}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={!tplForm.name || !tplForm.defaultTitleTemplate || createTplMutation.isPending} onClick={() => createTplMutation.mutate(tplForm)}>
                {createTplMutation.isPending ? tc("progress.saving") : t("automation.saveTemplate")}
              </button>
              <button className="btn-secondary" onClick={() => setShowNewTpl(false)}>{tc("actions.cancel")}</button>
            </div>
          </div>
        )}

        {loadingTpl ? (
          <PetraLoader />
        ) : templates.length === 0 ? (
          <div className="card p-8 text-center text-petra-muted text-sm">
            <LayoutTemplate className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>{t("automation.noTemplates")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map((tpl) => (
              <div key={tpl.id} className="card p-4 flex items-center gap-3 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-petra-text truncate">{tpl.name}</p>
                  <p className="text-xs text-petra-muted truncate">{tpl.defaultTitleTemplate}</p>
                  <div className="flex gap-1.5 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">{categoryLabel(t, tpl.defaultCategory)}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">{priorityLabel(t, tpl.defaultPriority)}</span>
                  </div>
                </div>
                <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => useTplMutation.mutate(tpl)} disabled={useTplMutation.isPending} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors">
                    <Plus className="w-3 h-3" />{t("automation.createTask")}
                  </button>
                  <button onClick={() => { if (window.confirm(t("automation.confirmDeleteTemplate", { name: tpl.name }))) deleteTplMutation.mutate(tpl.id); }} disabled={deleteTplMutation.isPending} title={t("automation.deleteTemplate")} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recurring Rules ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
              <Repeat2 className="w-4 h-4 text-violet-500" />
              {t("automation.recurringTitle")}
            </h2>
            <p className="text-xs text-petra-muted mt-0.5">{t("automation.recurringSubtitle")}</p>
          </div>
          {!showNewRule && templates.length > 0 && (
            <button onClick={() => setShowNewRule(true)} className="btn-secondary gap-2">
              <Plus className="w-4 h-4" />{t("automation.newRule")}
            </button>
          )}
        </div>

        {templates.length === 0 && (
          <div className="card p-4 bg-amber-50 border-amber-200 text-sm text-amber-700 flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {t("automation.needTemplateFirst")}
          </div>
        )}

        {showNewRule && (
          <div className="card p-4 mb-4 space-y-3">
            <h3 className="text-sm font-bold text-petra-text">{t("automation.newRuleTitle")}</h3>
            <div>
              <label className="label">{t("automation.template")}</label>
              <select className="input w-full" value={ruleForm.templateId} onChange={(e) => setRuleForm({ ...ruleForm, templateId: e.target.value })}>
                <option value="">{t("automation.chooseTemplate")}</option>
                {templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t("automation.frequency")}</label>
                <select className="input w-full" value={ruleForm.freq} onChange={(e) => setRuleForm({ ...ruleForm, freq: e.target.value, weekDays: [] })}>
                  <option value="DAILY">{t("automation.freq.DAILY")}</option>
                  <option value="WEEKLY">{t("automation.freq.WEEKLY")}</option>
                  <option value="MONTHLY">{t("automation.freq.MONTHLY")}</option>
                </select>
              </div>
              <div>
                <label className="label">{t("automation.every")}</label>
                <div className="flex items-center gap-1">
                  <input type="number" min={1} max={99} className="input w-full" value={ruleForm.interval} onChange={(e) => setRuleForm({ ...ruleForm, interval: Math.max(1, parseInt(e.target.value) || 1) })} />
                  <span className="text-xs text-petra-muted whitespace-nowrap">{ruleForm.freq === "DAILY" ? t("automation.units.days") : ruleForm.freq === "WEEKLY" ? t("automation.units.weeks") : t("automation.units.months")}</span>
                </div>
              </div>
            </div>
            {ruleForm.freq === "WEEKLY" && (
              <div>
                <label className="label">{t("automation.weekDays")}</label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_OF_WEEK.map((d) => (
                    <button key={d.value} type="button"
                      onClick={() => setRuleForm((prev) => ({ ...prev, weekDays: prev.weekDays.includes(d.value) ? prev.weekDays.filter((x) => x !== d.value) : [...prev.weekDays, d.value] }))}
                      className={cn("px-2 py-1 rounded-lg text-xs font-medium border transition-colors", ruleForm.weekDays.includes(d.value) ? "bg-brand-500 text-white border-brand-500" : "bg-white text-petra-muted border-slate-200 hover:border-brand-300")}
                    >{t(`weekdays.${d.key}`)}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t("automation.startFrom")}</label>
                <input type="date" lang={cfg.lang} className="input w-full" value={ruleForm.startAt} onChange={(e) => setRuleForm({ ...ruleForm, startAt: e.target.value })} />
              </div>
              <div>
                <label className="label">{t("automation.endOptional")}</label>
                <input type="date" lang={cfg.lang} className="input w-full" value={ruleForm.endAt} onChange={(e) => setRuleForm({ ...ruleForm, endAt: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={!ruleForm.templateId || !ruleForm.startAt || createRuleMutation.isPending}
                onClick={() => { if (!ruleForm.templateId) { toast.error(t("automation.toasts.chooseTemplate")); return; } createRuleMutation.mutate({ templateId: ruleForm.templateId, rrule: buildRrule(ruleForm.freq, ruleForm.interval, ruleForm.weekDays), startAt: new Date(ruleForm.startAt).toISOString(), endAt: ruleForm.endAt ? new Date(ruleForm.endAt).toISOString() : null }); }}
              >
                {createRuleMutation.isPending ? tc("progress.saving") : t("automation.createRule")}
              </button>
              <button className="btn-secondary" onClick={() => setShowNewRule(false)}>{tc("actions.cancel")}</button>
            </div>
          </div>
        )}

        {loadingRules ? (
          <PetraLoader />
        ) : rules.length === 0 ? (
          <div className="card p-8 text-center text-petra-muted text-sm">
            <Repeat2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>{t("automation.noRules")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className={cn("card p-4 transition-opacity", !rule.isActive && "opacity-60")}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-semibold text-petra-text">{rule.template.name}</span>
                      {!rule.isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">{t("automation.off")}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 font-medium">{humanizeRrule(rule.rrule, t)}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">{categoryLabel(t, rule.template.defaultCategory)}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">{t("automation.taskCount", { count: rule._count.tasks })}</span>
                    </div>
                    {rule.lastGeneratedAt && <p className="text-[10px] text-petra-muted mt-1">{t("automation.lastRun", { date: new Date(rule.lastGeneratedAt).toLocaleDateString(locale) })}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => generateNow(rule)} disabled={!rule.isActive || generatingId === rule.id}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-40" title={t("automation.runTitle")}>
                      <RefreshCw className={cn("w-3 h-3", generatingId === rule.id && "animate-spin")} />{t("automation.run")}
                    </button>
                    <button onClick={() => toggleRuleMutation.mutate({ id: rule.id, isActive: !rule.isActive })} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-500 transition-colors" title={rule.isActive ? t("automation.pause") : t("automation.run")}>
                      {rule.isActive ? <ToggleRight className="w-4 h-4 text-brand-500" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => deleteRuleMutation.mutate(rule.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared types for AutomationTab ──────────────────────────────────────────

interface TaskTemplate {
  id: string;
  name: string;
  defaultCategory: string;
  defaultPriority: string;
  defaultTitleTemplate: string;
  defaultDescriptionTemplate: string | null;
}

// ─── Automation helpers (used by AutomationTab) ───────────────────────────────

// value = JS weekday (0 = Sunday); key → tasks.weekdays.*
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAYS_OF_WEEK = WEEKDAY_KEYS.map((key, value) => ({ value, key }));

interface RecurrenceRule {
  id: string;
  rrule: string;
  startAt: string;
  endAt: string | null;
  isActive: boolean;
  lastGeneratedAt: string | null;
  createdAt: string;
  template: { id: string; name: string; defaultCategory: string; defaultPriority: string; defaultTitleTemplate: string };
  _count: { tasks: number };
}

function buildRrule(freq: string, interval: number, weekDays: number[]): string {
  const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  let rule = `FREQ=${freq};INTERVAL=${interval}`;
  if (freq === "WEEKLY" && weekDays.length > 0) {
    rule += `;BYDAY=${weekDays.map((d) => dayNames[d]).join(",")}`;
  }
  return rule;
}

function humanizeRrule(rrule: string, t: TasksT): string {
  const parts: Record<string, string> = {};
  for (const part of rrule.split(";")) {
    const [k, v] = part.split("=");
    if (k && v) parts[k] = v;
  }
  const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const interval = parseInt(parts["INTERVAL"] ?? "1", 10);
  const freq = parts["FREQ"];
  if (freq === "DAILY") return interval === 1 ? t("rrule.daily") : t("rrule.everyNDays", { n: interval });
  if (freq === "WEEKLY") {
    const days = parts["BYDAY"]
      ? parts["BYDAY"].split(",").map((d) => t(`weekdays.${WEEKDAY_KEYS[dayMap[d] ?? 0]}`)).join(", ")
      : "";
    return interval === 1
      ? t("rrule.weekly", { days: days || t("rrule.everyWeek") })
      : t("rrule.everyNWeeks", { n: interval, days });
  }
  if (freq === "MONTHLY") return interval === 1 ? t("rrule.monthly") : t("rrule.everyNMonths", { n: interval });
  return rrule;
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  isSelected,
  selectionMode,
  onSelect,
  onToggle,
  onPostpone,
  onDelete,
  onEdit,
  onDuplicate,
}: {
  task: Task;
  isSelected: boolean;
  selectionMode: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string, status: string) => void;
  onPostpone: (task: Task) => void;
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDuplicate: (task: Task) => void;
}) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const computed = computeTaskStatus(task);
  const config = STATUS_CONFIG[computed];
  const priorityId = PRIORITIES[task.priority] ? task.priority : "MEDIUM";
  const priority = PRIORITIES[priorityId];
  const isCompleted = computed === "completed";
  const shortDate = formatShortDate(task, t);

  return (
    <div
      className={cn(
        "card p-4 transition-all group",
        isCompleted && "opacity-50",
        !selectionMode && computed === "active" && "ring-1 ring-green-200",
        !selectionMode && computed === "overdue" && "ring-1 ring-red-200",
        selectionMode && !isCompleted && "cursor-pointer hover:bg-brand-50/40",
        selectionMode && isSelected && "ring-2 ring-brand-500 bg-brand-50/60"
      )}
      onClick={selectionMode && !isCompleted ? () => onSelect(task.id) : undefined}
    >
      <div className="flex items-start gap-3">
        {/* Complete toggle / selection checkbox */}
        {selectionMode && !isCompleted ? (
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(task.id); }}
            className="flex-shrink-0 mt-0.5"
          >
            {isSelected ? (
              <CheckCircle2 className="w-5 h-5 text-brand-500" />
            ) : (
              <Circle className="w-5 h-5 text-slate-300" />
            )}
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(task.id, isCompleted ? "OPEN" : "COMPLETED"); }}
            className="flex-shrink-0 mt-0.5"
          >
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : (
              <Circle className="w-5 h-5 text-slate-300 hover:text-brand-400 transition-colors" />
            )}
          </button>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* Status indicator dot */}
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2"
              style={{
                background: config.color,
                boxShadow: `0 0 0 2px ${config.bg}`,
              }}
            />
            <span
              className={cn(
                "text-sm font-semibold flex-1 truncate",
                isCompleted
                  ? "line-through text-petra-muted"
                  : "text-petra-text"
              )}
            >
              {task.title}
            </span>
            {/* Status badge */}
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{
                color: config.color,
                background: config.bg,
                border: `1px solid ${config.border}`,
              }}
            >
              {t(`computedStatus.${computed}`)}
            </span>
          </div>

          {task.description && (
            <p className="text-xs text-petra-muted truncate mb-1.5 ms-4.5">
              {task.description}
            </p>
          )}

          {/* Related entity chip */}
          {task.relatedEntityName && task.relatedEntityCustomerId && (
            <div className="mb-1.5 ms-4.5">
              <Link
                href={`/customers/${task.relatedEntityCustomerId}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 border border-brand-100 px-2 py-0.5 rounded-full transition-colors"
              >
                {task.relatedEntityType === "CUSTOMER"
                  ? <Users className="w-3 h-3 flex-shrink-0" />
                  : <PawPrint className="w-3 h-3 flex-shrink-0" />
                }
                {task.relatedEntityName}
              </Link>
            </div>
          )}
          {task.relatedEntityName && task.relatedEntityLeadId && (
            <div className="mb-1.5 ms-4.5">
              <Link
                href="/leads"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 border border-orange-100 px-2 py-0.5 rounded-full transition-colors"
              >
                <Target className="w-3 h-3 flex-shrink-0" />
                {task.relatedEntityName}
              </Link>
            </div>
          )}

          <div className="flex items-center gap-2 ms-4.5 flex-wrap">
            {/* Due info */}
            {shortDate && (
              <span
                className={cn(
                  "text-[10px] font-medium flex items-center gap-0.5 px-1.5 py-0.5 rounded",
                  computed === "overdue"
                    ? "bg-red-50 text-red-600"
                    : computed === "active"
                    ? "bg-green-50 text-green-600"
                    : "bg-slate-50 text-petra-muted"
                )}
              >
                <Clock className="w-3 h-3" />
                {shortDate}
              </span>
            )}
            {/* Category */}
            <span className="badge-neutral text-[10px]">
              {categoryLabel(t, task.category)}
            </span>
            {/* Priority dot */}
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: priority.color }}
              title={t(`priorities.${priorityId}`)}
            />
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 flex-shrink-0">
          {!isCompleted && (
            <>
              <button
                onClick={() => onEdit(task)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-500 transition-colors"
                title={t("card.edit")}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onPostpone(task)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-500 transition-colors"
                title={t("card.postpone")}
              >
                <CalendarClock className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDuplicate(task)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-500 transition-colors"
                title={t("card.duplicate")}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            onClick={() => onDelete(task)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            title={tc("actions.delete")}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Entity Picker ────────────────────────────────────────────────────────────

interface SearchResult { id: string; name: string; subtitle?: string; customerId?: string }

function EntityPicker({
  entityType,
  entityId,
  entityName,
  onChange,
}: {
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  onChange: (type: string | null, id: string | null, name: string | null) => void;
}) {
  const t = useTranslations("tasks");
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: searchData } = useQuery<{ customers: {id:string;name:string;phone:string|null}[]; pets: {id:string;name:string;customer:{id:string;name:string}|null}[] }>({
    queryKey: ["entity-search", entityType, search],
    queryFn: () => fetchJSON(`/api/search?q=${encodeURIComponent(search)}`),
    enabled: !!entityType && !entityId && search.length >= 1,
    staleTime: 10_000,
  });

  const results: SearchResult[] = (() => {
    if (!searchData || !entityType) return [];
    if (entityType === "CUSTOMER") return (searchData.customers ?? []).map(c => ({ id: c.id, name: c.name, subtitle: c.phone ?? undefined }));
    if (entityType === "DOG") return (searchData.pets ?? []).map(p => ({ id: p.id, name: p.name, subtitle: p.customer?.name, customerId: p.customer?.id }));
    return [];
  })();

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const TYPE_OPTIONS = [
    { value: null,       label: t("entityPicker.none"),     icon: null },
    { value: "CUSTOMER", label: t("entityPicker.customer"), icon: Users },
    { value: "DOG",      label: t("entityPicker.pet"),      icon: PawPrint },
  ];

  return (
    <div>
      <label className="label">{t("entityPicker.label")}</label>
      {/* Type selector chips */}
      <div className="flex gap-1.5 mb-2">
        {TYPE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = (opt.value === null && !entityType) || entityType === opt.value;
          return (
            <button
              key={opt.value ?? "none"}
              type="button"
              onClick={() => { onChange(opt.value, null, null); setSearch(""); }}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border",
                isActive ? "bg-brand-500 text-white border-brand-500" : "bg-white text-petra-muted border-slate-200 hover:border-brand-300 hover:text-petra-text"
              )}
            >
              {Icon && <Icon className="w-3 h-3" />}
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Search input */}
      {entityType && !entityId && (
        <div className="relative" ref={dropdownRef}>
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-petra-muted pointer-events-none" />
          <input
            className="input ps-9 text-sm w-full"
            placeholder={entityType === "CUSTOMER" ? t("entityPicker.searchCustomer") : t("entityPicker.searchPet")}
            value={search}
            autoFocus
            onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
          />
          {showDropdown && search.length >= 1 && (
            <div className="absolute top-full start-0 end-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden max-h-52 overflow-y-auto">
              {results.length > 0 ? results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="w-full text-start px-3 py-2.5 hover:bg-slate-50 transition-colors flex items-center gap-2.5 border-b border-slate-50 last:border-0"
                  onClick={() => { onChange(entityType, r.id, r.name); setSearch(""); setShowDropdown(false); }}
                >
                  {entityType === "CUSTOMER"
                    ? <Users className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
                    : <PawPrint className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
                  }
                  <span className="text-sm font-medium text-petra-text flex-1 truncate">{r.name}</span>
                  {r.subtitle && <span className="text-xs text-petra-muted flex-shrink-0">{r.subtitle}</span>}
                </button>
              )) : (
                <div className="px-3 py-4 text-center text-xs text-petra-muted">{t("entityPicker.noResults")}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Selected entity chip */}
      {entityId && entityName && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-50 border border-brand-100">
          {entityType === "CUSTOMER"
            ? <Users className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
            : <PawPrint className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
          }
          <span className="text-sm font-semibold text-brand-700 flex-1 truncate">{entityName}</span>
          <button
            type="button"
            className="text-brand-400 hover:text-brand-600 transition-colors flex-shrink-0"
            onClick={() => { onChange(entityType, null, null); setSearch(""); }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── New Task Modal ───────────────────────────────────────────────────────────

function NewTaskModal({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (data: { title: string; description: string; category: string; priority: string; dueDate: string; dueAt: string; relatedEntityType: string | null; relatedEntityId: string | null }) => void;
  isPending: boolean;
}) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const { locale, cfg } = useBusinessLocale();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "GENERAL",
    priority: "MEDIUM",
    dueDate: format(new Date(), "yyyy-MM-dd"),
    dueAt: "",
  });
  const [entityType, setEntityType] = useState<string | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entityName, setEntityName] = useState<string | null>(null);

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text">{t("form.newTitle")}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">{t("form.title")}</label>
            <input
              className="input"
              placeholder={t("form.titlePlaceholder")}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t("form.description")}</label>
            <textarea
              className="input"
              rows={2}
              placeholder={t("form.descriptionPlaceholder")}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("form.category")}</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
              >
                {CATEGORIES.filter((c) => c.id !== "ALL").map((c) => (
                  <option key={c.id} value={c.id}>
                    {t(`categories.${c.id}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t("form.priority")}</label>
              <select
                className="input"
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: e.target.value })
                }
              >
                <option value="LOW">{t("priorities.LOW")}</option>
                <option value="MEDIUM">{t("priorities.MEDIUM")}</option>
                <option value="HIGH">{t("priorities.HIGH")}</option>
                <option value="URGENT">{t("priorities.URGENT")}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("form.dueDateRequired")}</label>
              <input
                type="date" lang={cfg.lang}
                className="input"
                value={form.dueDate}
                onChange={(e) =>
                  setForm({ ...form, dueDate: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">{t("form.time")}</label>
              <input
                type="time"
                className="input"
                value={form.dueAt}
                onChange={(e) =>
                  setForm({ ...form, dueAt: e.target.value })
                }
              />
            </div>
          </div>
          {form.dueDate && (
            <div className="flex items-center gap-2 text-xs text-petra-muted bg-slate-50 rounded-lg px-3 py-2">
              <Timer className="w-3.5 h-3.5" />
              <span>
                {form.dueAt
                  ? format(
                      new Date(`${form.dueDate}T${form.dueAt}:00`),
                      t.raw("dateFormats.dueWithTime"),
                      { locale: dateFnsLocaleFor(locale) }
                    )
                  : format(
                      new Date(form.dueDate + "T00:00:00"),
                      t.raw("dateFormats.dueAllDay"),
                      { locale: dateFnsLocaleFor(locale) }
                    )}
              </span>
            </div>
          )}
          <EntityPicker
            entityType={entityType}
            entityId={entityId}
            entityName={entityName}
            onChange={(type, id, name) => { setEntityType(type); setEntityId(id); setEntityName(name); }}
          />
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!form.title.trim() || !form.dueDate || isPending}
            onClick={() => onSubmit({ ...form, relatedEntityType: entityType, relatedEntityId: entityId })}
          >
            <Plus className="w-4 h-4" />
            {isPending ? tc("progress.saving") : t("form.create")}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            {tc("actions.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Task Modal ──────────────────────────────────────────────────────────

function EditTaskModal({
  task,
  onClose,
  onSubmit,
  isPending,
}: {
  task: Task;
  onClose: () => void;
  onSubmit: (data: { id: string; title: string; description: string; category: string; priority: string; dueDate: string; dueAt: string; relatedEntityType: string | null; relatedEntityId: string | null }) => void;
  isPending: boolean;
}) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const { locale, cfg } = useBusinessLocale();
  const initialDate = task.dueAt
    ? format(new Date(task.dueAt), "yyyy-MM-dd")
    : task.dueDate
    ? format(new Date(task.dueDate), "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");

  const initialTime = task.dueAt ? format(new Date(task.dueAt), "HH:mm") : "";

  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? "",
    category: task.category,
    priority: task.priority,
    dueDate: initialDate,
    dueAt: initialTime,
  });
  const [entityType, setEntityType] = useState<string | null>(task.relatedEntityType ?? null);
  const [entityId, setEntityId] = useState<string | null>(task.relatedEntityId ?? null);
  const [entityName, setEntityName] = useState<string | null>(task.relatedEntityName ?? null);

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text">{t("form.editTitle")}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">{t("form.title")}</label>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t("form.description")}</label>
            <textarea
              className="input"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("form.category")}</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.filter((c) => c.id !== "ALL").map((c) => (
                  <option key={c.id} value={c.id}>{t(`categories.${c.id}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t("form.priority")}</label>
              <select
                className="input"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="LOW">{t("priorities.LOW")}</option>
                <option value="MEDIUM">{t("priorities.MEDIUM")}</option>
                <option value="HIGH">{t("priorities.HIGH")}</option>
                <option value="URGENT">{t("priorities.URGENT")}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("form.dueDate")}</label>
              <input
                type="date" lang={cfg.lang}
                className="input"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t("form.time")}</label>
              <input
                type="time"
                className="input"
                value={form.dueAt}
                onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
              />
            </div>
          </div>
          {form.dueDate && (
            <div className="flex items-center gap-2 text-xs text-petra-muted bg-slate-50 rounded-lg px-3 py-2">
              <Timer className="w-3.5 h-3.5" />
              <span>
                {form.dueAt
                  ? format(new Date(`${form.dueDate}T${form.dueAt}:00`), t.raw("dateFormats.dueWithTime"), { locale: dateFnsLocaleFor(locale) })
                  : format(new Date(form.dueDate + "T00:00:00"), t.raw("dateFormats.dueAllDay"), { locale: dateFnsLocaleFor(locale) })}
              </span>
            </div>
          )}
          <EntityPicker
            entityType={entityType}
            entityId={entityId}
            entityName={entityName}
            onChange={(type, id, name) => { setEntityType(type); setEntityId(id); setEntityName(name); }}
          />
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!form.title.trim() || isPending}
            onClick={() => onSubmit({ id: task.id, ...form, relatedEntityType: entityType, relatedEntityId: entityId })}
          >
            <Pencil className="w-4 h-4" />
            {isPending ? tc("progress.saving") : t("form.saveChanges")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Postpone Modal ───────────────────────────────────────────────────────────

function PostponeModal({
  task,
  onClose,
  onSubmit,
  isPending,
}: {
  task: Task;
  onClose: () => void;
  onSubmit: (data: { id: string; dueDate: string; dueAt: string | null }) => void;
  isPending: boolean;
}) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const { locale, cfg } = useBusinessLocale();
  const currentDate = task.dueDate
    ? format(new Date(task.dueDate), "yyyy-MM-dd")
    : task.dueAt
    ? format(new Date(task.dueAt), "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");

  const currentTime = task.dueAt
    ? format(new Date(task.dueAt), "HH:mm")
    : "";

  const [newDate, setNewDate] = useState(currentDate);
  const [newTime, setNewTime] = useState(currentTime);

  const quickDates = [
    { label: t("postpone.tomorrow"), value: format(addDays(new Date(), 1), "yyyy-MM-dd") },
    { label: t("postpone.inTwoDays"), value: format(addDays(new Date(), 2), "yyyy-MM-dd") },
    { label: t("postpone.inAWeek"), value: format(addDays(new Date(), 7), "yyyy-MM-dd") },
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-petra-text">{t("postpone.title")}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-petra-muted mb-4 truncate">
          &quot;{task.title}&quot;
        </p>

        {/* Quick select */}
        <div className="flex gap-2 mb-4">
          {quickDates.map((q) => (
            <button
              key={q.value}
              onClick={() => setNewDate(q.value)}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-medium transition-all",
                newDate === q.value
                  ? "bg-brand-500 text-white"
                  : "bg-slate-100 text-petra-muted hover:bg-slate-200"
              )}
            >
              {q.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label">{t("postpone.newDate")}</label>
            <input
              type="date" lang={cfg.lang}
              className="input"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("form.time")}</label>
            <input
              type="time"
              className="input"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
            />
          </div>
        </div>

        {newDate && (
          <div className="flex items-center gap-2 text-xs text-petra-muted bg-slate-50 rounded-lg px-3 py-2 mb-4">
            <CalendarClock className="w-3.5 h-3.5" />
            <span>
              {newTime
                ? format(
                    new Date(`${newDate}T${newTime}:00`),
                    t.raw("dateFormats.dueWithTime"),
                    { locale: dateFnsLocaleFor(locale) }
                  )
                : format(
                    new Date(newDate + "T00:00:00"),
                    t.raw("dateFormats.dueAllDay"),
                    { locale: dateFnsLocaleFor(locale) }
                  )}
            </span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            className="btn-primary flex-1"
            disabled={!newDate || isPending}
            onClick={() =>
              onSubmit({
                id: task.id,
                dueDate: newDate,
                dueAt: newTime || null,
              })
            }
          >
            <CalendarClock className="w-4 h-4" />
            {isPending ? tc("progress.updating") : t("postpone.submit")}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            {tc("actions.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Export Tasks Modal ────────────────────────────────────────────────────────

// Header labels (= xlsx column titles) → tasks.export.columns.<key>
const EXPORT_COLUMNS = [
  { key: "title", default: true },
  { key: "description", default: true },
  { key: "category", default: true },
  { key: "priority", default: true },
  { key: "status", default: true },
  { key: "dueDate", default: true },
  { key: "dueAt", default: false },
  { key: "createdAt", default: true },
  { key: "completedAt", default: false },
  { key: "relatedEntityName", default: true },
] as const;

function ExportTasksModal({
  tasks,
  onClose,
}: {
  tasks: Task[];
  onClose: () => void;
}) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const [selectedCols, setSelectedCols] = useState<Set<string>>(
    () => new Set(EXPORT_COLUMNS.filter((c) => c.default).map((c) => c.key))
  );
  const [exporting, setExporting] = useState(false);

  const toggleCol = (key: string) => {
    setSelectedCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () =>
    setSelectedCols(new Set(EXPORT_COLUMNS.map((c) => c.key)));
  const selectNone = () => setSelectedCols(new Set());

  const handleExport = async () => {
    if (selectedCols.size === 0) {
      toast.error(t("export.noColumns"));
      return;
    }
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const cols = EXPORT_COLUMNS.filter((c) => selectedCols.has(c.key)).map((c) => ({
        ...c,
        label: t(`export.columns.${c.key}`),
      }));
      const dateFmt = t.raw("dateFormats.exportDate");
      const timeFmt = t.raw("dateFormats.exportTime");
      const dateTimeFmt = t.raw("dateFormats.exportDateTime");

      const rows = tasks.map((task) => {
        const row: Record<string, string> = {};
        for (const col of cols) {
          switch (col.key) {
            case "title":
              row[col.label] = task.title;
              break;
            case "description":
              row[col.label] = task.description ?? "";
              break;
            case "category":
              row[col.label] = categoryLabel(t, task.category);
              break;
            case "priority":
              row[col.label] = priorityLabel(t, task.priority);
              break;
            case "status":
              row[col.label] = taskStatusLabel(t, task.status);
              break;
            case "dueDate":
              row[col.label] = task.dueDate
                ? format(new Date(task.dueDate), dateFmt)
                : task.dueAt
                ? format(new Date(task.dueAt), dateFmt)
                : "";
              break;
            case "dueAt":
              row[col.label] = task.dueAt
                ? format(new Date(task.dueAt), timeFmt)
                : "";
              break;
            case "createdAt":
              row[col.label] = format(new Date(task.createdAt), dateTimeFmt);
              break;
            case "completedAt":
              row[col.label] = task.completedAt
                ? format(new Date(task.completedAt), dateTimeFmt)
                : "";
              break;
            case "relatedEntityName":
              row[col.label] = task.relatedEntityName ?? "";
              break;
          }
        }
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      // Auto-size columns
      const maxWidths = cols.map((col) => {
        const headerLen = col.label.length;
        const maxData = Math.max(...rows.map((r) => (r[col.label] ?? "").length), 0);
        return Math.min(Math.max(headerLen, maxData) + 2, 40);
      });
      ws["!cols"] = maxWidths.map((w) => ({ wch: w }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, t("export.sheetName"));

      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = t("export.fileName", { date: format(new Date(), "yyyy-MM-dd") });
      a.click();
      URL.revokeObjectURL(url);

      toast.success(t("export.success", { count: tasks.length }));
      onClose();
    } catch {
      toast.error(t("export.error"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
            {t("export.title")}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-petra-muted mb-4">
          {t("export.intro", { count: tasks.length })}
        </p>

        {/* Select all / none */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={selectAll}
            className="text-xs text-brand-600 hover:text-brand-800 font-medium"
          >
            {t("export.selectAll")}
          </button>
          <span className="text-xs text-petra-muted">|</span>
          <button
            onClick={selectNone}
            className="text-xs text-petra-muted hover:text-petra-text font-medium"
          >
            {t("export.clearAll")}
          </button>
        </div>

        {/* Column checkboxes */}
        <div className="space-y-1.5 mb-6 max-h-[280px] overflow-y-auto">
          {EXPORT_COLUMNS.map((col) => (
            <label
              key={col.key}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedCols.has(col.key)}
                onChange={() => toggleCol(col.key)}
                className="w-4 h-4 rounded accent-brand-500"
              />
              <span className="text-sm text-petra-text">{t(`export.columns.${col.key}`)}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            className="btn-primary flex-1 gap-2"
            disabled={selectedCols.size === 0 || exporting}
            onClick={handleExport}
          >
            <Download className="w-4 h-4" />
            {exporting ? tc("progress.exporting") : t("export.submit", { count: selectedCols.size })}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            {tc("actions.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
