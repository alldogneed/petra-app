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
  UserPlus,
  ShieldAlert,
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
  const [enrollFor, setEnrollFor] = useState<CourseItem | null>(null);
  const [deleteFor, setDeleteFor] = useState<CourseItem | null>(null);

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
              <div key={c.id} className="card overflow-hidden flex flex-col">
                <button
                  className="text-right hover:opacity-95 transition-opacity"
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
                        "absolute top-2 left-2",
                        published ? "badge-success" : "badge-neutral"
                      )}
                    >
                      {published ? "פורסם" : "טיוטה"}
                    </span>
                  </div>
                  <div className="p-4 pb-2">
                    <p className="font-bold text-petra-text truncate">{c.title}</p>
                    {c.description && (
                      <p className="text-xs text-petra-muted mt-1 line-clamp-2">{c.description}</p>
                    )}
                    <p className="text-xs text-petra-muted mt-2">
                      {courseLessonCount(c)} שיעורים
                    </p>
                  </div>
                </button>

                {/* Actions — pinned to the right (start) edge in RTL */}
                <div className="mt-auto px-4 pb-3 pt-1 flex items-center gap-2 border-t border-petra-border/60">
                  <button
                    className="btn-secondary text-xs px-2.5 py-1.5"
                    onClick={() => setEnrollFor(c)}
                    title="הוסף תלמידים לקורס לפי אימייל"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    הוסף תלמידים
                  </button>
                  <button
                    className="btn-danger text-xs px-2.5 py-1.5"
                    onClick={() => setDeleteFor(c)}
                    title="מחק קורס"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    מחק
                  </button>
                </div>
              </div>
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

      {enrollFor && (
        <EnrollStudentsModal
          course={enrollFor}
          onClose={() => setEnrollFor(null)}
          onDone={() => queryClient.invalidateQueries({ queryKey: ["oc-memberships", ""] })}
        />
      )}

      {deleteFor && (
        <DeleteCourseModal
          course={deleteFor}
          onClose={() => setDeleteFor(null)}
          onDeleted={() => {
            setDeleteFor(null);
            queryClient.invalidateQueries({ queryKey: ["oc-courses"] });
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Manual enrollment by email
// ═══════════════════════════════════════════════════════

interface EnrollResult {
  added: Array<{ email: string; name: string; created: boolean; notified: boolean }>;
  skipped: Array<{ email: string; reason: string }>;
}

function EnrollStudentsModal({
  course,
  onClose,
  onDone,
}: {
  course: CourseItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const [emails, setEmails] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [result, setResult] = useState<EnrollResult | null>(null);

  const parsed = emails
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
  const single = parsed.length === 1;

  const mutation = useMutation({
    mutationFn: () =>
      fetchJSON<EnrollResult>(`/api/online-classes/courses/${course.id}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          students: parsed.map((email, i) => ({
            email,
            // Name/phone apply only when adding one student at a time.
            name: single && i === 0 && name.trim() ? name.trim() : null,
            phone: single && i === 0 && phone.trim() ? phone.trim() : null,
          })),
          validUntil: validUntil || null,
          paymentNote: paymentNote.trim() || null,
          notify,
        }),
      }),
    onSuccess: (res) => {
      setResult(res);
      const n = res.added.length;
      if (n > 0) {
        toast.success(
          notify
            ? `${n === 1 ? "תלמיד/ה נוסף/ה" : `${n} תלמידים נוספו`} וקיבלו הודעה`
            : `${n === 1 ? "תלמיד/ה נוסף/ה" : `${n} תלמידים נוספו`}`
        );
        setEmails("");
        setName("");
        setPhone("");
        onDone();
      } else {
        toast.error("אף תלמיד לא נוסף");
      }
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בהוספת התלמידים"),
  });

  return (
    <Modal title={`הוספת תלמידים — ${course.title}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl bg-brand-50 border border-brand-100 p-3 text-xs text-petra-text leading-relaxed">
          הוספה ידנית מפעילה לתלמיד/ה <strong>מנוי פעיל</strong> בפורטל שלך ושולחת הודעה עם
          קישור ישיר לקורס. מנוי פעיל פותח את כל הקורסים שפרסמת ואת השיעורים החיים.
        </div>

        <div>
          <label className="label">כתובות אימייל *</label>
          <textarea
            className="input min-h-[80px]"
            dir="ltr"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="dana@example.com, yossi@example.com"
          />
          <p className="text-xs text-petra-muted mt-1">
            אפשר להדביק כמה כתובות — מופרדות בפסיק, רווח או שורה חדשה
            {parsed.length > 1 && ` (${parsed.length} כתובות)`}
          </p>
        </div>

        {single && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">שם (לא חובה)</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לתלמיד/ה חדש/ה"
              />
            </div>
            <div>
              <label className="label">טלפון (לא חובה)</label>
              <input
                className="input"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05X-XXXXXXX"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">תוקף מנוי (לא חובה)</label>
            <input
              className="input"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
          <div>
            <label className="label">תיעוד תשלום</label>
            <input
              className="input"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="למשל: שולם בביט"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-petra-text cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 accent-brand-500"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
          />
          שלח הודעה על ההוספה (וואטסאפ + אימייל)
        </label>

        {result && (
          <div className="rounded-xl border border-petra-border p-3 space-y-2 max-h-40 overflow-y-auto">
            {result.added.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-700 mb-1">
                  נוספו ({result.added.length})
                </p>
                {result.added.map((a) => (
                  <p key={a.email} className="text-xs text-petra-muted" dir="ltr">
                    {a.email}
                    {a.created ? " — משתמש חדש" : ""}
                  </p>
                ))}
              </div>
            )}
            {result.skipped.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-600 mb-1">
                  לא נוספו ({result.skipped.length})
                </p>
                {result.skipped.map((s, i) => (
                  <p key={`${s.email}-${i}`} className="text-xs text-petra-muted">
                    <span dir="ltr">{s.email}</span> — {s.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            className="btn-primary flex-1 justify-center"
            disabled={mutation.isPending || parsed.length === 0}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending
              ? "מוסיף..."
              : parsed.length > 1
                ? `הוסף ${parsed.length} תלמידים`
                : "הוסף לקורס"}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            {result ? "סגור" : "ביטול"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════
// Course deletion — confirm by typing the course name
// ═══════════════════════════════════════════════════════

function DeleteCourseModal({
  course,
  onClose,
  onDeleted,
}: {
  course: CourseItem;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const lessons = courseLessonCount(course);
  const matches = confirmText.trim() === course.title.trim();

  const mutation = useMutation({
    mutationFn: () =>
      fetchJSON(`/api/online-classes/courses/${course.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("הקורס נמחק");
      onDeleted();
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה במחיקת הקורס"),
  });

  return (
    <Modal title="מחיקת קורס" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm text-red-800 leading-relaxed">
              <p className="font-bold mb-1">הפעולה הזו בלתי הפיכה.</p>
              <p>
                מחיקת <strong>&quot;{course.title}&quot;</strong> תמחק לצמיתות את כל הפרקים,
                {" "}{lessons} השיעורים, וכל נתוני ההתקדמות של התלמידים בקורס.
              </p>
              <p className="mt-1">
                תלמידים שצופים בקורס יאבדו אליו גישה מיידית. אין שחזור.
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="label">
            להמשך, הקלד/י את שם הקורס במדויק:
          </label>
          <p className="text-xs text-petra-muted mb-1.5 font-mono bg-slate-50 rounded-lg px-2 py-1 inline-block">
            {course.title}
          </p>
          <input
            className="input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="שם הקורס"
            autoFocus
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            className="btn-danger flex-1 justify-center"
            disabled={!matches || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            <Trash2 className="w-4 h-4" />
            {mutation.isPending ? "מוחק..." : "מחק את הקורס לצמיתות"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </Modal>
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
