"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Video,
  FileText,
  Type,
  Eye,
  AlertTriangle,
  Globe,
  EyeOff,
} from "lucide-react";
import { cn, fetchJSON } from "@/lib/utils";
import {
  Modal,
  extractYouTubeId,
  unwrapList,
  unwrapObject,
  type CourseItem,
  type CourseTree,
  type CourseModuleItem,
  type LessonItem,
} from "./shared";

const LESSON_TYPES: { value: string; label: string; icon: React.ReactNode }[] = [
  { value: "video", label: "וידאו", icon: <Video className="w-3.5 h-3.5" /> },
  { value: "pdf", label: "PDF", icon: <FileText className="w-3.5 h-3.5" /> },
  { value: "text", label: "טקסט", icon: <Type className="w-3.5 h-3.5" /> },
];

function lessonTypeMeta(type: string) {
  return LESSON_TYPES.find((t) => t.value === type?.toLowerCase()) ?? LESSON_TYPES[0];
}

function courseLessonCount(c: CourseItem): number {
  return c.lessonCount ?? c._count?.lessons ?? 0;
}

// ═══════════════════════════════════════════════════════
// Courses grid
// ═══════════════════════════════════════════════════════

export function CoursesTab() {
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ title: "", description: "", coverUrl: "" });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["oc-courses"],
    queryFn: () => fetchJSON("/api/online-classes/courses"),
  });
  const courses = unwrapList<CourseItem>(data, "courses", "items");

  const createMutation = useMutation({
    mutationFn: () =>
      fetchJSON("/api/online-classes/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createForm.title.trim(),
          description: createForm.description.trim() || null,
          coverUrl: createForm.coverUrl.trim() || null,
        }),
      }),
    onSuccess: () => {
      toast.success("הקורס נוצר");
      setShowCreate(false);
      setCreateForm({ title: "", description: "", coverUrl: "" });
      queryClient.invalidateQueries({ queryKey: ["oc-courses"] });
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה ביצירת הקורס"),
  });

  if (selectedCourseId) {
    return (
      <CourseBuilder
        courseId={selectedCourseId}
        onBack={() => {
          setSelectedCourseId(null);
          queryClient.invalidateQueries({ queryKey: ["oc-courses"] });
        }}
      />
    );
  }

  if (isError) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-400" />
        <p className="text-red-600 font-medium mb-2">שגיאה בטעינת הקורסים</p>
        <button className="btn-secondary text-sm" onClick={() => refetch()}>נסה שוב</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-petra-text">קורסים מוקלטים</h2>
        <button className="btn-primary text-sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          קורס חדש
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse h-48" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon">
            <BookOpen className="w-6 h-6 text-slate-400" />
          </div>
          <p className="font-medium text-petra-text mb-1">אין קורסים עדיין</p>
          <p className="text-sm text-petra-muted mb-4">
            בנה קורס מוקלט ראשון עם פרקים ושיעורי וידאו מיוטיוב
          </p>
          <button className="btn-primary text-sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            קורס חדש
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => {
            const published = c.status?.toLowerCase() === "published";
            return (
              <button
                key={c.id}
                className="card overflow-hidden text-right hover:shadow-md transition-shadow"
                onClick={() => setSelectedCourseId(c.id)}
              >
                <div className="h-28 relative">
                  {c.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.coverUrl} alt={c.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-brand-400 to-orange-300 flex items-center justify-center">
                      <BookOpen className="w-8 h-8 text-white/70" />
                    </div>
                  )}
                  <span
                    className={cn(
                      "absolute top-2 right-2",
                      published ? "badge-success" : "badge-neutral"
                    )}
                  >
                    {published ? "פורסם" : "טיוטה"}
                  </span>
                </div>
                <div className="p-4">
                  <p className="font-bold text-petra-text truncate">{c.title}</p>
                  {c.description && (
                    <p className="text-xs text-petra-muted mt-1 line-clamp-2">{c.description}</p>
                  )}
                  <p className="text-xs text-petra-muted mt-2">
                    {courseLessonCount(c)} שיעורים
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showCreate && (
        <Modal title="קורס חדש" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div>
              <label className="label">שם הקורס *</label>
              <input
                className="input"
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                placeholder="למשל: קורס גורים מהבית"
              />
            </div>
            <div>
              <label className="label">תיאור</label>
              <textarea
                className="input min-h-[70px]"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              />
            </div>
            <div>
              <label className="label">קישור לתמונת שער</label>
              <input
                className="input"
                dir="ltr"
                value={createForm.coverUrl}
                onChange={(e) => setCreateForm({ ...createForm, coverUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                className="btn-primary flex-1 justify-center"
                disabled={createMutation.isPending || !createForm.title.trim()}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? "יוצר..." : "צור קורס"}
              </button>
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>ביטול</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Course builder
// ═══════════════════════════════════════════════════════

interface LessonFormState {
  title: string;
  type: string;
  videoRef: string;
  fileUrl: string;
  textContent: string;
  durationMin: string;
  isFreePreview: boolean;
}

const EMPTY_LESSON: LessonFormState = {
  title: "",
  type: "video",
  videoRef: "",
  fileUrl: "",
  textContent: "",
  durationMin: "",
  isFreePreview: false,
};

function CourseBuilder({ courseId, onBack }: { courseId: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [modules, setModules] = useState<CourseModuleItem[]>([]);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [showAddModule, setShowAddModule] = useState(false);
  const [lessonModal, setLessonModal] = useState<{
    moduleId: string;
    lesson: LessonItem | null;
  } | null>(null);
  const [lessonForm, setLessonForm] = useState<LessonFormState>(EMPTY_LESSON);

  const treeKey = ["oc-course", courseId];
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: treeKey,
    queryFn: () => fetchJSON(`/api/online-classes/courses/${courseId}`),
  });
  const course = unwrapObject<CourseTree>(data, "course");

  useEffect(() => {
    if (course?.modules) setModules(course.modules);
  }, [course?.modules]);

  const invalidateTree = () => {
    queryClient.invalidateQueries({ queryKey: treeKey });
    queryClient.invalidateQueries({ queryKey: ["oc-courses"] });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ─── Mutations ───

  const reorderMutation = useMutation({
    mutationFn: (body: { moduleIds?: string[]; moduleId?: string; lessonIds?: string[] }) =>
      fetchJSON(`/api/online-classes/courses/${courseId}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onError: (e: Error) => {
      toast.error(e.message || "שגיאה בשינוי הסדר");
      invalidateTree();
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      fetchJSON(`/api/online-classes/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_d, status) => {
      toast.success(status === "published" ? "הקורס פורסם בפורטל" : "הקורס הוסתר (טיוטה)");
      invalidateTree();
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בעדכון סטטוס הקורס"),
  });

  const deleteCourseMutation = useMutation({
    mutationFn: () =>
      fetchJSON(`/api/online-classes/courses/${courseId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("הקורס נמחק");
      onBack();
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה במחיקת הקורס"),
  });

  const addModuleMutation = useMutation({
    mutationFn: (title: string) =>
      fetchJSON(`/api/online-classes/courses/${courseId}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }),
    onSuccess: () => {
      toast.success("הפרק נוסף");
      setNewModuleTitle("");
      setShowAddModule(false);
      invalidateTree();
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בהוספת פרק"),
  });

  const renameModuleMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      fetchJSON(`/api/online-classes/modules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }),
    onSuccess: () => {
      toast.success("שם הפרק עודכן");
      invalidateTree();
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בעדכון הפרק"),
  });

  const deleteModuleMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJSON(`/api/online-classes/modules/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("הפרק נמחק");
      invalidateTree();
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה במחיקת הפרק"),
  });

  const saveLessonMutation = useMutation({
    mutationFn: async () => {
      if (!lessonModal) return;
      const body: Record<string, unknown> = {
        title: lessonForm.title.trim(),
        type: lessonForm.type,
        videoRef: lessonForm.type === "video" ? extractYouTubeId(lessonForm.videoRef) || null : null,
        fileUrl: lessonForm.type === "pdf" ? lessonForm.fileUrl.trim() || null : null,
        textContent: lessonForm.type === "text" ? lessonForm.textContent.trim() || null : null,
        durationMin: lessonForm.durationMin ? Number(lessonForm.durationMin) : null,
        isFreePreview: lessonForm.isFreePreview,
      };
      if (lessonModal.lesson) {
        return fetchJSON(`/api/online-classes/lessons/${lessonModal.lesson.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      return fetchJSON(`/api/online-classes/modules/${lessonModal.moduleId}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success(lessonModal?.lesson ? "השיעור עודכן" : "השיעור נוסף");
      setLessonModal(null);
      invalidateTree();
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בשמירת השיעור"),
  });

  const deleteLessonMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJSON(`/api/online-classes/lessons/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("השיעור נמחק");
      invalidateTree();
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה במחיקת השיעור"),
  });

  // ─── Drag handlers ───

  const onModuleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = modules.findIndex((m) => m.id === active.id);
    const newIndex = modules.findIndex((m) => m.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(modules, oldIndex, newIndex);
    setModules(next);
    reorderMutation.mutate({ moduleIds: next.map((m) => m.id) });
  };

  const onLessonDragEnd = (moduleId: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;
    const oldIndex = mod.lessons.findIndex((l) => l.id === active.id);
    const newIndex = mod.lessons.findIndex((l) => l.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const nextLessons = arrayMove(mod.lessons, oldIndex, newIndex);
    setModules(modules.map((m) => (m.id === moduleId ? { ...m, lessons: nextLessons } : m)));
    reorderMutation.mutate({ moduleId, lessonIds: nextLessons.map((l) => l.id) });
  };

  // ─── Render ───

  if (isError) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-400" />
        <p className="text-red-600 font-medium mb-2">שגיאה בטעינת הקורס</p>
        <div className="flex gap-2 justify-center">
          <button className="btn-secondary text-sm" onClick={() => refetch()}>נסה שוב</button>
          <button className="btn-ghost text-sm" onClick={onBack}>חזרה לקורסים</button>
        </div>
      </div>
    );
  }

  if (isLoading || !course) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-6 animate-pulse h-20" />
        ))}
      </div>
    );
  }

  const published = course.status?.toLowerCase() === "published";

  return (
    <div>
      {/* Builder header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button className="btn-ghost text-sm" onClick={onBack}>
          <ArrowRight className="w-4 h-4" />
          חזרה לקורסים
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-petra-text truncate">{course.title}</h2>
            <span className={published ? "badge-success" : "badge-neutral"}>
              {published ? "פורסם" : "טיוטה"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 ms-auto">
          <button
            className={cn("text-sm", published ? "btn-secondary" : "btn-primary")}
            disabled={statusMutation.isPending}
            onClick={() => statusMutation.mutate(published ? "draft" : "published")}
          >
            {published ? (
              <>
                <EyeOff className="w-4 h-4" />
                בטל פרסום
              </>
            ) : (
              <>
                <Globe className="w-4 h-4" />
                פרסם קורס
              </>
            )}
          </button>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-petra-muted hover:text-red-600"
            title="מחיקת הקורס"
            onClick={() => {
              if (window.confirm(`למחוק את הקורס "${course.title}" על כל הפרקים והשיעורים שבו?`)) {
                deleteCourseMutation.mutate();
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modules */}
      {modules.length === 0 ? (
        <div className="empty-state card mb-4">
          <div className="empty-state-icon">
            <BookOpen className="w-6 h-6 text-slate-400" />
          </div>
          <p className="font-medium text-petra-text mb-1">אין פרקים בקורס</p>
          <p className="text-sm text-petra-muted">הוסף פרק ראשון כדי להתחיל לבנות את הקורס</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onModuleDragEnd}
        >
          <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3 mb-4">
              {modules.map((mod, idx) => (
                <SortableModule
                  key={mod.id}
                  module={mod}
                  index={idx}
                  onRename={(title) => renameModuleMutation.mutate({ id: mod.id, title })}
                  onDelete={() => {
                    if (
                      window.confirm(`למחוק את הפרק "${mod.title}" על כל השיעורים שבו?`)
                    ) {
                      deleteModuleMutation.mutate(mod.id);
                    }
                  }}
                  onAddLesson={() => {
                    setLessonForm(EMPTY_LESSON);
                    setLessonModal({ moduleId: mod.id, lesson: null });
                  }}
                  onEditLesson={(lesson) => {
                    setLessonForm({
                      title: lesson.title,
                      type: lesson.type?.toLowerCase() || "video",
                      videoRef: lesson.videoRef ?? "",
                      fileUrl: lesson.fileUrl ?? "",
                      textContent: lesson.textContent ?? "",
                      durationMin: lesson.durationMin != null ? String(lesson.durationMin) : "",
                      isFreePreview: !!lesson.isFreePreview,
                    });
                    setLessonModal({ moduleId: mod.id, lesson });
                  }}
                  onDeleteLesson={(lesson) => {
                    if (window.confirm(`למחוק את השיעור "${lesson.title}"?`)) {
                      deleteLessonMutation.mutate(lesson.id);
                    }
                  }}
                  onLessonDragEnd={onLessonDragEnd(mod.id)}
                  sensors={sensors}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add module */}
      {showAddModule ? (
        <div className="card p-4 flex items-center gap-2">
          <input
            className="input flex-1"
            autoFocus
            placeholder="שם הפרק..."
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newModuleTitle.trim()) {
                addModuleMutation.mutate(newModuleTitle.trim());
              }
            }}
          />
          <button
            className="btn-primary text-sm"
            disabled={addModuleMutation.isPending || !newModuleTitle.trim()}
            onClick={() => addModuleMutation.mutate(newModuleTitle.trim())}
          >
            הוסף
          </button>
          <button className="btn-ghost text-sm" onClick={() => setShowAddModule(false)}>
            ביטול
          </button>
        </div>
      ) : (
        <button className="btn-secondary text-sm" onClick={() => setShowAddModule(true)}>
          <Plus className="w-4 h-4" />
          הוסף פרק
        </button>
      )}

      {/* Lesson modal */}
      {lessonModal && (
        <Modal
          title={lessonModal.lesson ? "עריכת שיעור" : "שיעור חדש"}
          onClose={() => setLessonModal(null)}
        >
          <div className="space-y-4">
            <div>
              <label className="label">שם השיעור *</label>
              <input
                className="input"
                value={lessonForm.title}
                onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">סוג</label>
                <select
                  className="input"
                  value={lessonForm.type}
                  onChange={(e) => setLessonForm({ ...lessonForm, type: e.target.value })}
                >
                  {LESSON_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">משך (דקות)</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={lessonForm.durationMin}
                  onChange={(e) => setLessonForm({ ...lessonForm, durationMin: e.target.value })}
                />
              </div>
            </div>
            {lessonForm.type === "video" && (
              <div>
                <label className="label">מזהה סרטון יוטיוב *</label>
                <input
                  className="input"
                  dir="ltr"
                  value={lessonForm.videoRef}
                  onChange={(e) =>
                    setLessonForm({ ...lessonForm, videoRef: extractYouTubeId(e.target.value) })
                  }
                  placeholder="dQw4w9WgXcQ"
                />
                <p className="text-[11px] text-petra-muted mt-1">
                  מזהה סרטון יוטיוב — האותיות אחרי v= בכתובת. אפשר גם להדביק כתובת מלאה והמזהה יחולץ אוטומטית.
                </p>
              </div>
            )}
            {lessonForm.type === "pdf" && (
              <div>
                <label className="label">קישור לקובץ PDF *</label>
                <input
                  className="input"
                  dir="ltr"
                  value={lessonForm.fileUrl}
                  onChange={(e) => setLessonForm({ ...lessonForm, fileUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            )}
            {lessonForm.type === "text" && (
              <div>
                <label className="label">תוכן השיעור *</label>
                <textarea
                  className="input min-h-[120px]"
                  value={lessonForm.textContent}
                  onChange={(e) => setLessonForm({ ...lessonForm, textContent: e.target.value })}
                />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-petra-text cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400"
                checked={lessonForm.isFreePreview}
                onChange={(e) =>
                  setLessonForm({ ...lessonForm, isFreePreview: e.target.checked })
                }
              />
              שיעור לצפייה חופשית
              <Eye className="w-3.5 h-3.5 text-petra-muted" />
            </label>
            <div className="flex gap-2 pt-1">
              <button
                className="btn-primary flex-1 justify-center"
                disabled={saveLessonMutation.isPending || !lessonForm.title.trim()}
                onClick={() => saveLessonMutation.mutate()}
              >
                {saveLessonMutation.isPending
                  ? "שומר..."
                  : lessonModal.lesson
                    ? "שמור שינויים"
                    : "הוסף שיעור"}
              </button>
              <button className="btn-secondary" onClick={() => setLessonModal(null)}>ביטול</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Sortable module + lessons
// ═══════════════════════════════════════════════════════

function SortableModule({
  module: mod,
  index,
  onRename,
  onDelete,
  onAddLesson,
  onEditLesson,
  onDeleteLesson,
  onLessonDragEnd,
  sensors,
}: {
  module: CourseModuleItem;
  index: number;
  onRename: (title: string) => void;
  onDelete: () => void;
  onAddLesson: () => void;
  onEditLesson: (lesson: LessonItem) => void;
  onDeleteLesson: (lesson: LessonItem) => void;
  onLessonDragEnd: (event: DragEndEvent) => void;
  sensors: ReturnType<typeof useSensors>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(mod.title);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: mod.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("card overflow-hidden", isDragging && "opacity-60 shadow-lg z-10 relative")}
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
        <button
          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-petra-text touch-none"
          title="גרור לשינוי סדר"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        {editingTitle ? (
          <input
            className="input py-1.5 flex-1"
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && titleDraft.trim()) {
                onRename(titleDraft.trim());
                setEditingTitle(false);
              }
              if (e.key === "Escape") {
                setTitleDraft(mod.title);
                setEditingTitle(false);
              }
            }}
            onBlur={() => {
              if (titleDraft.trim() && titleDraft.trim() !== mod.title) {
                onRename(titleDraft.trim());
              } else {
                setTitleDraft(mod.title);
              }
              setEditingTitle(false);
            }}
          />
        ) : (
          <p className="font-semibold text-petra-text text-sm flex-1 truncate">
            פרק {index + 1}: {mod.title}
          </p>
        )}
        <span className="text-xs text-petra-muted whitespace-nowrap">
          {mod.lessons.length} שיעורים
        </span>
        <button
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 text-petra-muted"
          title="שינוי שם"
          onClick={() => {
            setTitleDraft(mod.title);
            setEditingTitle(true);
          }}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-petra-muted hover:text-red-600"
          title="מחיקת פרק"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <button
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 text-petra-muted"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="p-3">
          {mod.lessons.length === 0 ? (
            <p className="text-xs text-petra-muted text-center py-3">אין שיעורים בפרק זה</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onLessonDragEnd}
            >
              <SortableContext
                items={mod.lessons.map((l) => l.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1.5">
                  {mod.lessons.map((lesson) => (
                    <SortableLesson
                      key={lesson.id}
                      lesson={lesson}
                      onEdit={() => onEditLesson(lesson)}
                      onDelete={() => onDeleteLesson(lesson)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          <button className="btn-ghost text-xs mt-2" onClick={onAddLesson}>
            <Plus className="w-3.5 h-3.5" />
            הוסף שיעור
          </button>
        </div>
      )}
    </div>
  );
}

function SortableLesson({
  lesson,
  onEdit,
  onDelete,
}: {
  lesson: LessonItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lesson.id });
  const meta = lessonTypeMeta(lesson.type);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-100 bg-white",
        isDragging && "opacity-60 shadow-md z-10 relative"
      )}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-petra-text touch-none"
        title="גרור לשינוי סדר"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <span className="text-petra-muted">{meta.icon}</span>
      <p className="text-sm text-petra-text flex-1 truncate">{lesson.title}</p>
      {lesson.durationMin != null && lesson.durationMin > 0 && (
        <span className="text-[11px] text-petra-muted whitespace-nowrap">
          {lesson.durationMin} דק׳
        </span>
      )}
      {lesson.isFreePreview && <span className="badge-brand">צפייה חופשית</span>}
      <button
        className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-100 text-petra-muted"
        title="עריכה"
        onClick={onEdit}
      >
        <Pencil className="w-3 h-3" />
      </button>
      <button
        className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-50 text-petra-muted hover:text-red-600"
        title="מחיקה"
        onClick={onDelete}
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}
