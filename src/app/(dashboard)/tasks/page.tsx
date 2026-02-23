"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ListTodo,
  Plus,
  X,
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const PRIORITIES: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  LOW: { label: "נמוכה", color: "#94A3B8", icon: Circle },
  MEDIUM: { label: "בינונית", color: "#F59E0B", icon: AlertCircle },
  HIGH: { label: "גבוהה", color: "#EF4444", icon: AlertCircle },
};

const STATUSES = [
  { id: "ALL", label: "הכל" },
  { id: "OPEN", label: "פתוחות" },
  { id: "COMPLETED", label: "הושלמו" },
  { id: "CANCELED", label: "בוטלו" },
];

export default function TasksPage() {
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [activeStatus, setActiveStatus] = useState("OPEN");
  const [showNewTask, setShowNewTask] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "GENERAL", priority: "MEDIUM", dueDate: "" });
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["tasks", activeCategory, activeStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeCategory !== "ALL") params.set("category", activeCategory);
      if (activeStatus !== "ALL") params.set("status", activeStatus);
      return fetch(`/api/tasks?${params}`).then((r) => r.json());
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => {
        if (!r.ok) throw new Error("Failed"); return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setShowNewTask(false);
      setForm({ title: "", description: "", category: "GENERAL", priority: "MEDIUM", dueDate: "" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">משימות</h1>
          <p className="text-sm text-petra-muted mt-1">{tasks.length} משימות</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNewTask(true)}>
          <Plus className="w-4 h-4" />משימה חדשה
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveStatus(s.id)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                activeStatus === s.id ? "bg-brand-500 text-white" : "bg-slate-100 text-petra-muted hover:bg-slate-200"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={cn("px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all",
                activeCategory === c.id ? "bg-slate-800 text-white" : "bg-slate-100 text-petra-muted hover:bg-slate-200"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks list */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="card p-4 animate-pulse h-16" />)}</div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><ListTodo className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין משימות</h3>
          <p className="text-sm text-petra-muted mb-4">צור משימה חדשה כדי להתחיל</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const priority = PRIORITIES[task.priority] || PRIORITIES.MEDIUM;
            const isCompleted = task.status === "COMPLETED";

            return (
              <div key={task.id} className={cn("card p-4 flex items-center gap-3 group", isCompleted && "opacity-60")}>
                <button
                  onClick={() => toggleMutation.mutate({
                    id: task.id,
                    status: isCompleted ? "OPEN" : "COMPLETED",
                  })}
                  className="flex-shrink-0"
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 hover:text-brand-400 transition-colors" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className={cn("text-sm font-medium", isCompleted ? "line-through text-petra-muted" : "text-petra-text")}>
                    {task.title}
                  </div>
                  {task.description && (
                    <div className="text-xs text-petra-muted mt-0.5 truncate">{task.description}</div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {task.dueDate && (
                    <span className="text-[10px] text-petra-muted flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(task.dueDate).toLocaleDateString("he-IL")}
                    </span>
                  )}
                  <span className="badge-neutral text-[10px]">{task.category}</span>
                  <div className="w-2 h-2 rounded-full" style={{ background: priority.color }} title={priority.label} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Task Modal */}
      {showNewTask && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setShowNewTask(false)} />
          <div className="modal-content max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-petra-text">משימה חדשה</h2>
              <button onClick={() => setShowNewTask(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">כותרת *</label>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="label">תיאור</label>
                <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">קטגוריה</label>
                  <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.filter((c) => c.id !== "ALL").map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">עדיפות</label>
                  <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <option value="LOW">נמוכה</option>
                    <option value="MEDIUM">בינונית</option>
                    <option value="HIGH">גבוהה</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">תאריך יעד</label>
                <input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-primary flex-1" disabled={!form.title || createMutation.isPending} onClick={() => createMutation.mutate(form)}>
                <Plus className="w-4 h-4" />{createMutation.isPending ? "שומר..." : "צור משימה"}
              </button>
              <button className="btn-secondary" onClick={() => setShowNewTask(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
