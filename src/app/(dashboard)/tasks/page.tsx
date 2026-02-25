"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  isToday,
  isPast,
  isFuture,
  differenceInMinutes,
  format,
  addDays,
  startOfDay,
} from "date-fns";
import { he } from "date-fns/locale";
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
  Filter,
} from "lucide-react";
import { cn, fetchJSON } from "@/lib/utils";

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
}

type ComputedStatus = "active" | "overdue" | "scheduled" | "completed";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "ALL", label: "הכל" },
  { id: "GENERAL", label: "כללי" },
  { id: "BOARDING", label: "פנסיון" },
  { id: "TRAINING", label: "אילוף" },
  { id: "LEADS", label: "לידים" },
  { id: "HEALTH", label: "בריאות" },
  { id: "MEDICATION", label: "תרופות" },
  { id: "FEEDING", label: "האכלה" },
];

const CATEGORY_LABEL: Record<string, string> = {
  GENERAL: "כללי",
  BOARDING: "פנסיון",
  TRAINING: "אילוף",
  LEADS: "לידים",
  HEALTH: "בריאות",
  MEDICATION: "תרופות",
  FEEDING: "האכלה",
};

const PRIORITIES: Record<string, { label: string; color: string }> = {
  LOW: { label: "נמוכה", color: "#94A3B8" },
  MEDIUM: { label: "בינונית", color: "#F59E0B" },
  HIGH: { label: "גבוהה", color: "#EF4444" },
  URGENT: { label: "דחופה", color: "#DC2626" },
};

const STATUS_FILTERS = [
  { id: "ALL", label: "הכל", icon: ListTodo },
  { id: "active", label: "עכשיו", icon: Flame },
  { id: "overdue", label: "באיחור", icon: AlertCircle },
  { id: "scheduled", label: "מתוכננות", icon: CalendarDays },
  { id: "COMPLETED", label: "הושלמו", icon: CheckCircle2 },
];

const STATUS_CONFIG: Record<ComputedStatus, { label: string; color: string; bg: string; border: string }> = {
  active: { label: "עכשיו", color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
  overdue: { label: "באיחור", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
  scheduled: { label: "מתוכנן", color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB" },
  completed: { label: "הושלם", color: "#10B981", bg: "#ECFDF5", border: "#A7F3D0" },
};

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

function formatShortDate(task: Task): string {
  if (task.dueAt) {
    const d = new Date(task.dueAt);
    if (isToday(d)) return `היום ${format(d, "HH:mm")}`;
    return format(d, "d/M HH:mm");
  }
  if (task.dueDate) {
    const d = new Date(task.dueDate);
    if (isToday(d)) return "היום";
    return format(d, "d/M/yy");
  }
  return "";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TasksPage() {
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [showNewTask, setShowNewTask] = useState(false);
  const [postponeTask, setPostponeTask] = useState<Task | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Task | null>(null);
  const [, setTick] = useState(0);
  const queryClient = useQueryClient();

  // Auto-refresh every 30 seconds for live status updates
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Fetch ALL open tasks (we filter on client side for computed statuses)
  const { data: allTasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["tasks", activeCategory],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeCategory !== "ALL") params.set("category", activeCategory);
      return fetchJSON<Task[]>(`/api/tasks?${params}`);
    },
  });

  // Apply computed status filter on client
  const filteredTasks = allTasks.filter((task) => {
    if (activeFilter === "ALL") return true;
    if (activeFilter === "COMPLETED") return task.status === "COMPLETED";
    const computed = computeTaskStatus(task);
    return computed === activeFilter;
  });

  // Sort: overdue first, then active, then scheduled, then completed
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const order: Record<ComputedStatus, number> = { overdue: 0, active: 1, scheduled: 2, completed: 3 };
    const statusA = computeTaskStatus(a);
    const statusB = computeTaskStatus(b);
    if (order[statusA] !== order[statusB]) return order[statusA] - order[statusB];
    // Within same status group, sort by due date
    const dateA = a.dueAt || a.dueDate || a.createdAt;
    const dateB = b.dueAt || b.dueDate || b.createdAt;
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });

  // Count by status for filter badges
  const statusCounts = allTasks.reduce(
    (acc, task) => {
      const s = computeTaskStatus(task);
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const createMutation = useMutation({
    mutationFn: (data: { title: string; description: string; category: string; priority: string; dueDate: string; dueAt: string }) => {
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description || undefined,
        category: data.category,
        priority: data.priority,
      };
      if (data.dueDate) {
        payload.dueDate = data.dueDate;
      }
      // Combine date + time into dueAt ISO string
      if (data.dueDate && data.dueAt) {
        payload.dueAt = new Date(`${data.dueDate}T${data.dueAt}:00`).toISOString();
      }
      return fetchJSON("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setShowNewTask(false);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetchJSON(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJSON(`/api/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDeleteConfirm(null);
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
      return fetchJSON(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setPostponeTask(null);
    },
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="page-title">משימות</h1>
        <p className="text-sm text-petra-muted">{allTasks.length} משימות</p>
        <button className="btn-primary" onClick={() => setShowNewTask(true)}>
          <Plus className="w-4 h-4" />
          משימה חדשה
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
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
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all",
                activeFilter === f.id
                  ? "bg-slate-800 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-petra-muted hover:bg-slate-50"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {f.label}
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

      {/* Category Filter */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-3.5 h-3.5 text-petra-muted" />
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all",
                activeCategory === c.id
                  ? "bg-brand-500 text-white"
                  : "bg-slate-100 text-petra-muted hover:bg-slate-200"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : sortedTasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <ListTodo className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין משימות</h3>
          <p className="text-sm text-petra-muted mb-4">
            {activeFilter !== "ALL"
              ? "אין משימות בסטטוס הנבחר"
              : "צור משימה חדשה כדי להתחיל"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={(id, status) => toggleMutation.mutate({ id, status })}
              onPostpone={(task) => setPostponeTask(task)}
              onDelete={(task) => setDeleteConfirm(task)}
            />
          ))}
        </div>
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

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)} />
          <div className="modal-content max-w-sm mx-4 p-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-petra-text mb-2">מחיקת משימה</h2>
              <p className="text-sm text-petra-muted mb-1">
                למחוק את המשימה &quot;{deleteConfirm.title}&quot;?
              </p>
              <p className="text-xs text-petra-muted mb-6">פעולה זו אינה ניתנת לביטול</p>
              <div className="flex gap-3">
                <button
                  className="btn-danger flex-1"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                >
                  {deleteMutation.isPending ? "מוחק..." : "מחק"}
                </button>
                <button className="btn-secondary flex-1" onClick={() => setDeleteConfirm(null)}>
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onToggle,
  onPostpone,
  onDelete,
}: {
  task: Task;
  onToggle: (id: string, status: string) => void;
  onPostpone: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const computed = computeTaskStatus(task);
  const config = STATUS_CONFIG[computed];
  const priority = PRIORITIES[task.priority] || PRIORITIES.MEDIUM;
  const isCompleted = computed === "completed";
  const shortDate = formatShortDate(task);

  return (
    <div
      className={cn(
        "card p-4 transition-all group",
        isCompleted && "opacity-50",
        computed === "active" && "ring-1 ring-green-200",
        computed === "overdue" && "ring-1 ring-red-200"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Complete toggle */}
        <button
          onClick={() =>
            onToggle(task.id, isCompleted ? "OPEN" : "COMPLETED")
          }
          className="flex-shrink-0 mt-0.5"
        >
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <Circle className="w-5 h-5 text-slate-300 hover:text-brand-400 transition-colors" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* Status indicator dot */}
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2"
              style={{
                background: config.color,
                ringColor: config.bg,
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
              {config.label}
            </span>
          </div>

          {task.description && (
            <p className="text-xs text-petra-muted truncate mb-1.5 mr-4.5">
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-2 mr-4.5 flex-wrap">
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
              {CATEGORY_LABEL[task.category] ?? task.category}
            </span>
            {/* Priority dot */}
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: priority.color }}
              title={priority.label}
            />
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {!isCompleted && (
            <button
              onClick={() => onPostpone(task)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-500 transition-colors"
              title="דחה"
            >
              <CalendarClock className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onDelete(task)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            title="מחק"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
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
  onSubmit: (data: { title: string; description: string; category: string; priority: string; dueDate: string; dueAt: string }) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "GENERAL",
    priority: "MEDIUM",
    dueDate: format(new Date(), "yyyy-MM-dd"),
    dueAt: "",
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text">משימה חדשה</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">כותרת *</label>
            <input
              className="input"
              placeholder="מה צריך לעשות?"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="label">תיאור</label>
            <textarea
              className="input"
              rows={2}
              placeholder="פרטים נוספים..."
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">קטגוריה</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
              >
                {CATEGORIES.filter((c) => c.id !== "ALL").map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">עדיפות</label>
              <select
                className="input"
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: e.target.value })
                }
              >
                <option value="LOW">נמוכה</option>
                <option value="MEDIUM">בינונית</option>
                <option value="HIGH">גבוהה</option>
                <option value="URGENT">דחופה</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תאריך יעד *</label>
              <input
                type="date"
                className="input"
                value={form.dueDate}
                onChange={(e) =>
                  setForm({ ...form, dueDate: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">שעה</label>
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
                      "EEEE, d MMMM yyyy · HH:mm",
                      { locale: he }
                    )
                  : format(
                      new Date(form.dueDate + "T00:00:00"),
                      "EEEE, d MMMM yyyy · כל היום",
                      { locale: he }
                    )}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!form.title.trim() || !form.dueDate || isPending}
            onClick={() => onSubmit(form)}
          >
            <Plus className="w-4 h-4" />
            {isPending ? "שומר..." : "צור משימה"}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
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
    { label: "מחר", value: format(addDays(new Date(), 1), "yyyy-MM-dd") },
    { label: "עוד יומיים", value: format(addDays(new Date(), 2), "yyyy-MM-dd") },
    { label: "עוד שבוע", value: format(addDays(new Date(), 7), "yyyy-MM-dd") },
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-petra-text">דחיית משימה</h2>
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
            <label className="label">תאריך חדש</label>
            <input
              type="date"
              className="input"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">שעה</label>
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
                    "EEEE, d MMMM yyyy · HH:mm",
                    { locale: he }
                  )
                : format(
                    new Date(newDate + "T00:00:00"),
                    "EEEE, d MMMM yyyy · כל היום",
                    { locale: he }
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
            {isPending ? "מעדכן..." : "דחה משימה"}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
