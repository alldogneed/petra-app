"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Award,
  BookOpen,
  ChevronDown,
  CheckCircle2,
  Circle,
  Clock,
  HelpCircle,
  Lock,
  MessageSquare,
  Video,
} from "lucide-react";
import { fetchJSON } from "@/lib/utils";
import { Modal, heDate, heDateTime } from "./shared";

// ─── Types (mirror src/services/student-dossier.ts; dates arrive as ISO strings) ─

interface DossierLesson {
  id: string;
  title: string;
  moduleTitle: string;
  percent: number;
  completedAt: string | null;
  watchedSeconds: number;
  durationMin: number | null;
}

interface DossierCourse {
  courseId: string;
  title: string;
  status: string;
  percent: number;
  completedLessons: number;
  totalLessons: number;
  lastActivityAt: string | null;
  certificate: {
    serial: string;
    issuedAt: string;
    revokedAt: string | null;
    issuedManually: boolean;
  } | null;
  lessons: DossierLesson[];
}

interface DossierQuestion {
  id: string;
  body: string;
  answerBody: string | null;
  answeredAt: string | null;
  createdAt: string;
  isPrivate: boolean;
  lessonTitle: string;
  courseTitle: string;
}

interface DossierLiveClass {
  title: string;
  startsAt: string;
  status: string;
}

interface Dossier {
  student: {
    name: string;
    email: string;
    phone: string | null;
    status: string;
    validUntil: string | null;
    paymentNote: string | null;
    approvedAt: string | null;
    joinedAt: string;
  };
  summary: {
    coursesStarted: number;
    coursesCompleted: number;
    certificatesCount: number;
    lastActivityAt: string | null;
    stalledDays: number | null;
    questionsAsked: number;
    questionsUnanswered: number;
  };
  courses: DossierCourse[];
  questions: DossierQuestion[];
  liveClasses: DossierLiveClass[];
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "ממתין לאישור", cls: "badge-warning" },
  active: { label: "פעיל", cls: "badge-success" },
  expired: { label: "פג תוקף", cls: "badge-neutral" },
  suspended: { label: "מושהה", cls: "badge-neutral" },
};

const REG_STATUS_META: Record<string, { label: string; cls: string }> = {
  registered: { label: "רשום", cls: "badge-success" },
  waitlist: { label: "רשימת המתנה", cls: "badge-warning" },
  cancelled: { label: "בוטל", cls: "badge-neutral" },
};

function courseStatusLabel(status: string): string {
  return status === "published" ? "מפורסם" : "טיוטה";
}

function fmtMinutes(min: number | null): string {
  if (!min || min <= 0) return "";
  return `${min} דק'`;
}

function fmtWatched(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.round(seconds / 60);
  if (m < 1) return "פחות מדקה";
  return `${m} דק'`;
}

// ─── Small building blocks ──────────────────────────────────────

function StatBox({ label, value, tone }: { label: string; value: string; tone?: "amber" | "muted" }) {
  return (
    <div className="rounded-xl border border-petra-border bg-slate-50/60 px-3 py-2.5 text-center">
      <div
        className={
          tone === "amber"
            ? "text-sm font-bold text-amber-600"
            : tone === "muted"
              ? "text-sm font-bold text-petra-muted"
              : "text-lg font-bold text-petra-text"
        }
      >
        {value}
      </div>
      <div className="text-[11px] text-petra-muted mt-0.5">{label}</div>
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
      <div
        className="h-full rounded-full bg-brand-500 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function CourseCard({ course }: { course: DossierCourse }) {
  const [open, setOpen] = useState(false);
  const cert = course.certificate;

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <BookOpen className="w-4 h-4 text-brand-500 shrink-0" />
            <span className="font-semibold text-petra-text truncate">{course.title}</span>
            <span className="badge-neutral text-[11px]">{courseStatusLabel(course.status)}</span>
          </div>
        </div>
        <span className="text-sm font-bold text-petra-text shrink-0">{course.percent}%</span>
      </div>

      <div className="mt-3">
        <ProgressBar percent={course.percent} />
        <div className="flex items-center justify-between mt-1.5 text-[11px] text-petra-muted">
          <span>
            {course.completedLessons}/{course.totalLessons} שיעורים
          </span>
          <span>
            {course.lastActivityAt ? `פעילות אחרונה: ${heDate(course.lastActivityAt)}` : "טרם התחיל"}
          </span>
        </div>
      </div>

      {/* Certificate line */}
      <div className="mt-3 flex items-center gap-2 text-xs">
        {cert ? (
          cert.revokedAt ? (
            <span className="inline-flex items-center gap-1.5 text-red-600 font-medium">
              <Award className="w-4 h-4" />
              התעודה בוטלה
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-green-600 font-medium">
                <Award className="w-4 h-4" />
                תעודה הונפקה {heDate(cert.issuedAt)}
              </span>
              {cert.issuedManually && <span className="badge-neutral text-[11px]">ידני</span>}
              <a
                href={`/verify/${cert.serial}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-500 hover:underline font-medium"
              >
                אימות תעודה
              </a>
            </span>
          )
        ) : (
          <span className="inline-flex items-center gap-1.5 text-petra-muted">
            <Award className="w-4 h-4" />
            אין תעודה עדיין
          </span>
        )}
      </div>

      {/* Per-lesson expander */}
      {course.lessons.length > 0 && (
        <div className="mt-3 border-t border-petra-border pt-2">
          <button
            className="flex items-center gap-1.5 text-xs font-medium text-petra-muted hover:text-petra-text"
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
            {open ? "הסתר שיעורים" : `הצג ${course.lessons.length} שיעורים`}
          </button>
          {open && (
            <ul className="mt-2 space-y-1.5">
              {course.lessons.map((lesson) => {
                const done = !!lesson.completedAt;
                const watched = fmtWatched(lesson.watchedSeconds);
                const duration = fmtMinutes(lesson.durationMin);
                return (
                  <li key={lesson.id} className="flex items-start gap-2 text-xs">
                    {done ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={done ? "text-petra-text" : "text-petra-muted"}>
                          {lesson.title}
                        </span>
                        <span className="text-petra-muted shrink-0">
                          {done ? "הושלם" : `${lesson.percent}%`}
                        </span>
                      </div>
                      <div className="text-[11px] text-petra-muted/80">
                        {lesson.moduleTitle}
                        {duration && (
                          <>
                            {" · "}
                            {watched ? `${watched} מתוך ${duration}` : duration}
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────

export function StudentDossier({
  membershipId,
  onClose,
}: {
  membershipId: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError, refetch } = useQuery<Dossier>({
    queryKey: ["oc-dossier", membershipId],
    queryFn: () => fetchJSON(`/api/online-classes/students/${membershipId}`),
  });

  const statusMeta = data
    ? STATUS_META[data.student.status?.toLowerCase()] ?? {
        label: data.student.status,
        cls: "badge-neutral",
      }
    : null;

  const lastActivityText = data
    ? data.summary.lastActivityAt === null
      ? "טרם התחיל"
      : data.summary.stalledDays !== null && data.summary.stalledDays >= 7
        ? `לא פעיל ${data.summary.stalledDays} ימים`
        : heDate(data.summary.lastActivityAt)
    : "—";

  return (
    <Modal
      title={data ? `תיק סטודנט — ${data.student.name}` : "תיק סטודנט"}
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      {isLoading ? (
        <div className="space-y-3">
          <div className="card p-6 animate-pulse h-24" />
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="card animate-pulse h-16" />
            ))}
          </div>
          <div className="card p-6 animate-pulse h-32" />
        </div>
      ) : isError || !data ? (
        <div className="card p-8 text-center">
          <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-400" />
          <p className="text-red-600 font-medium mb-2">שגיאה בטעינת תיק הסטודנט</p>
          <button className="btn-secondary text-sm" onClick={() => refetch()}>
            נסה שוב
          </button>
        </div>
      ) : (
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pl-1">
          {/* Header */}
          <div className="rounded-xl border border-petra-border bg-slate-50/60 p-4">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-semibold text-petra-text">{data.student.name}</span>
              {statusMeta && <span className={statusMeta.cls}>{statusMeta.label}</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <div className="text-petra-muted">
                אימייל: <span dir="ltr" className="text-petra-text">{data.student.email}</span>
              </div>
              <div className="text-petra-muted">
                טלפון:{" "}
                <span dir="ltr" className="text-petra-text">
                  {data.student.phone || "—"}
                </span>
              </div>
              <div className="text-petra-muted">
                הצטרף: <span className="text-petra-text">{heDate(data.student.joinedAt)}</span>
              </div>
              <div className="text-petra-muted">
                בתוקף עד:{" "}
                <span className="text-petra-text">
                  {data.student.validUntil
                    ? heDate(data.student.validUntil)
                    : data.student.status?.toLowerCase() === "active"
                      ? 'הו"ק'
                      : "—"}
                </span>
              </div>
              {data.student.paymentNote && (
                <div className="text-petra-muted sm:col-span-2">
                  הערת תשלום: <span className="text-petra-text">{data.student.paymentNote}</span>
                </div>
              )}
            </div>
          </div>

          {/* Summary stat row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <StatBox label="קורסים שהתחיל" value={String(data.summary.coursesStarted)} />
            <StatBox label="קורסים שהשלים" value={String(data.summary.coursesCompleted)} />
            <StatBox label="תעודות" value={String(data.summary.certificatesCount)} />
            <StatBox
              label="פעילות אחרונה"
              value={lastActivityText}
              tone={
                data.summary.lastActivityAt === null
                  ? "muted"
                  : data.summary.stalledDays !== null && data.summary.stalledDays >= 7
                    ? "amber"
                    : undefined
              }
            />
            <StatBox label="שאלות ששאל" value={String(data.summary.questionsAsked)} />
          </div>

          {/* Courses */}
          <div>
            <h3 className="text-sm font-bold text-petra-text mb-2 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-brand-500" />
              קורסים
            </h3>
            {data.courses.length === 0 ? (
              <p className="text-sm text-petra-muted">אין קורסים להצגה</p>
            ) : (
              <div className="space-y-3">
                {data.courses.map((course) => (
                  <CourseCard key={course.courseId} course={course} />
                ))}
              </div>
            )}
          </div>

          {/* Questions */}
          <div>
            <h3 className="text-sm font-bold text-petra-text mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-brand-500" />
              שאלות ששאל
              {data.summary.questionsUnanswered > 0 && (
                <span className="badge-warning text-[11px]">
                  {data.summary.questionsUnanswered} ממתינות
                </span>
              )}
            </h3>
            {data.questions.length === 0 ? (
              <p className="text-sm text-petra-muted">לא נשאלו שאלות</p>
            ) : (
              <div className="space-y-2.5">
                {data.questions.map((q) => (
                  <div key={q.id} className="card p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-petra-muted min-w-0">
                        {q.isPrivate && <Lock className="w-3.5 h-3.5 shrink-0" />}
                        <span className="truncate">
                          {q.courseTitle && `${q.courseTitle} · `}
                          {q.lessonTitle || "—"}
                        </span>
                      </div>
                      <span className="text-[11px] text-petra-muted shrink-0">
                        {heDate(q.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-petra-text whitespace-pre-wrap">{q.body}</p>
                    {q.answeredAt ? (
                      <div className="mt-2 border-r-2 border-green-400 pr-2.5">
                        <div className="text-[11px] font-medium text-green-600 mb-0.5">
                          נענתה · {heDate(q.answeredAt)}
                        </div>
                        <p className="text-sm text-petra-muted whitespace-pre-wrap">
                          {q.answerBody}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-600">
                        <HelpCircle className="w-3.5 h-3.5" />
                        ממתינה לתשובה
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live classes */}
          {data.liveClasses.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-petra-text mb-2 flex items-center gap-1.5">
                <Video className="w-4 h-4 text-brand-500" />
                שיעורים חיים
              </h3>
              <div className="space-y-2">
                {data.liveClasses.map((cls, i) => {
                  const meta =
                    REG_STATUS_META[cls.status] ?? { label: cls.status, cls: "badge-neutral" };
                  return (
                    <div
                      key={`${cls.title}-${cls.startsAt}-${i}`}
                      className="card p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-petra-text truncate">
                          {cls.title}
                        </div>
                        <div className="text-[11px] text-petra-muted flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {heDateTime(cls.startsAt)}
                        </div>
                      </div>
                      <span className={`${meta.cls} shrink-0`}>{meta.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
