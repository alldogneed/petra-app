"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  PlayCircle,
  GraduationCap,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  TrendingDown,
  CheckCircle2,
  Circle,
  BookOpen,
} from "lucide-react";
import { fetchJSON } from "@/lib/utils";
import { Modal, heDate, unwrapList } from "./shared";

// ─── Types (mirror src/services/online-classes-reports.ts, JSON-serialised) ──

interface CourseReport {
  courseId: string;
  title: string;
  status: string;
  lessonCount: number;
  enrolledStudents: number;
  startedStudents: number;
  completedStudents: number;
  avgCompletionPercent: number;
  dropOffLesson: {
    id: string;
    title: string;
    moduleTitle: string;
    reachedCount: number;
    droppedCount: number;
  } | null;
}

interface StudentRow {
  membershipId: string;
  name: string;
  email: string;
  phone: string | null;
  completedLessons: number;
  totalLessons: number;
  percent: number;
  lastActivityAt: string | null;
  stalledDays: number | null;
}

interface StudentDetailCourse {
  courseId: string;
  title: string;
  percent: number;
  completedLessons: number;
  totalLessons: number;
  lessons: Array<{
    id: string;
    title: string;
    moduleTitle: string;
    percent: number;
    completedAt: string | null;
  }>;
}

interface StudentDetailData {
  student: {
    name: string;
    email: string;
    phone: string | null;
    membershipStatus: string;
    joinedAt: string;
  } | null;
  courses: StudentDetailCourse[];
}

const MEMBERSHIP_STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "מנוי פעיל", cls: "badge-success" },
  pending: { label: "ממתין לאישור", cls: "badge-warning" },
  expired: { label: "מנוי פג", cls: "badge-neutral" },
  suspended: { label: "מושהה", cls: "badge-neutral" },
};

const STALLED_THRESHOLD_DAYS = 7;

// ─── Small building blocks ──────────────────────────────────────────────────

function ProgressBar({ percent }: { percent: number }) {
  const safe = Math.max(0, Math.min(100, percent));
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
      <div
        className="h-full rounded-full bg-brand-500 transition-all"
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}

function StatCard({
  icon,
  iconClass,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconClass}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-petra-muted">{label}</p>
        <p className="text-lg font-bold text-petra-text">{value}</p>
      </div>
    </div>
  );
}

// ─── Main tab ───────────────────────────────────────────────────────────────

export function ReportsTab() {
  const [courseFilter, setCourseFilter] = useState("");
  const [openStudent, setOpenStudent] = useState<StudentRow | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["oc-reports", courseFilter],
    queryFn: () =>
      fetchJSON(
        courseFilter
          ? `/api/online-classes/reports?courseId=${encodeURIComponent(courseFilter)}`
          : "/api/online-classes/reports"
      ),
  });

  const courses = unwrapList<CourseReport>(data, "courses");
  const students = unwrapList<StudentRow>(data, "students");

  const activeStudents = students.length;
  const startedStudents = students.filter((s) => s.lastActivityAt).length;
  const finishedStudents = students.filter(
    (s) => s.totalLessons > 0 && s.percent >= 100
  ).length;
  const avgPercent =
    startedStudents > 0
      ? Math.round(
          students
            .filter((s) => s.lastActivityAt)
            .reduce((sum, s) => sum + s.percent, 0) / startedStudents
        )
      : 0;

  if (isError) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-400" />
        <p className="text-red-600 font-medium mb-2">שגיאה בטעינת הדוחות</p>
        <button className="btn-secondary text-sm" onClick={() => refetch()}>
          נסה שוב
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-4 h-[72px] animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 h-24 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="w-5 h-5 text-brand-500" />}
          iconClass="bg-brand-50"
          label="תלמידים פעילים"
          value={activeStudents}
        />
        <StatCard
          icon={<PlayCircle className="w-5 h-5 text-indigo-500" />}
          iconClass="bg-indigo-50"
          label="התחילו ללמוד"
          value={startedStudents}
        />
        <StatCard
          icon={<GraduationCap className="w-5 h-5 text-emerald-500" />}
          iconClass="bg-emerald-50"
          label="סיימו קורס"
          value={finishedStudents}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-amber-500" />}
          iconClass="bg-amber-50"
          label="אחוז השלמה ממוצע"
          value={`${avgPercent}%`}
        />
      </div>

      {/* Courses */}
      <div>
        <h2 className="text-base font-bold text-petra-text mb-3">
          התקדמות לפי קורס
        </h2>
        {courses.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-state-icon">
              <BookOpen className="w-6 h-6 text-slate-400" />
            </div>
            <p className="font-medium text-petra-text mb-1">אין קורסים עדיין</p>
            <p className="text-sm text-petra-muted">
              צרו קורס בלשונית &quot;קורסים&quot; והנתונים יופיעו כאן
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {courses.map((c) => (
              <div key={c.courseId} className="card p-4 sm:p-5">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-5 h-5 text-brand-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-petra-text">{c.title}</p>
                      {c.status !== "published" && (
                        <span className="badge-neutral">טיוטה</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap mt-1 text-sm text-petra-muted">
                      <span>{c.lessonCount} שיעורים</span>
                      <span className="flex items-center gap-1">
                        <PlayCircle className="w-3.5 h-3.5" />
                        {c.startedStudents} התחילו
                      </span>
                      <span className="flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5" />
                        {c.completedStudents} סיימו
                      </span>
                      <span>מתוך {c.enrolledStudents} תלמידים</span>
                    </div>

                    <div className="mt-3 max-w-md">
                      <div className="flex items-center justify-between mb-1 text-xs">
                        <span className="text-petra-muted">
                          אחוז השלמה ממוצע
                        </span>
                        <span className="font-bold text-petra-text">
                          {c.avgCompletionPercent}%
                        </span>
                      </div>
                      <ProgressBar percent={c.avgCompletionPercent} />
                    </div>

                    {c.dropOffLesson && (
                      <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2">
                        <TrendingDown className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-700 leading-relaxed">
                          <span className="font-bold">נקודת נטישה: </span>
                          &quot;{c.dropOffLesson.title}&quot; (
                          {c.dropOffLesson.moduleTitle}) —{" "}
                          {c.dropOffLesson.droppedCount} מתוך{" "}
                          {c.dropOffLesson.reachedCount} תלמידים שהגיעו לשיעור
                          הקודם לא סיימו אותו
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Students */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-base font-bold text-petra-text">
            התקדמות תלמידים
          </h2>
          <select
            className="input w-auto text-sm"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          >
            <option value="">כל הקורסים</option>
            {courses.map((c) => (
              <option key={c.courseId} value={c.courseId}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {students.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-state-icon">
              <Users className="w-6 h-6 text-slate-400" />
            </div>
            <p className="font-medium text-petra-text mb-1">
              אין תלמידים פעילים
            </p>
            <p className="text-sm text-petra-muted">
              אשרו מנויים בלשונית &quot;מנויים&quot; והתקדמות התלמידים תופיע כאן
            </p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-petra-muted border-b border-slate-100">
                  <th className="font-medium px-4 py-3">שם</th>
                  <th className="font-medium px-4 py-3 hidden md:table-cell">
                    אימייל
                  </th>
                  <th className="font-medium px-4 py-3 w-48">התקדמות</th>
                  <th className="font-medium px-4 py-3">פעילות אחרונה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s) => (
                  <tr
                    key={s.membershipId}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setOpenStudent(s)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-petra-text">
                        {s.name || "—"}
                      </p>
                      <p className="text-xs text-petra-muted md:hidden" dir="ltr">
                        {s.email}
                      </p>
                    </td>
                    <td
                      className="px-4 py-3 text-petra-muted hidden md:table-cell"
                      dir="ltr"
                    >
                      {s.email}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-[70px]">
                          <ProgressBar percent={s.percent} />
                        </div>
                        <span className="text-xs font-bold text-petra-text w-9 text-left">
                          {s.percent}%
                        </span>
                      </div>
                      <p className="text-[11px] text-petra-muted mt-1">
                        {s.completedLessons}/{s.totalLessons} שיעורים
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-petra-muted">
                          {s.lastActivityAt
                            ? heDate(s.lastActivityAt)
                            : "טרם התחיל"}
                        </span>
                        {s.stalledDays !== null &&
                          s.stalledDays >= STALLED_THRESHOLD_DAYS && (
                            <span className="badge-warning">
                              תקוע {s.stalledDays} ימים
                            </span>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openStudent && (
        <StudentDetailModal
          student={openStudent}
          onClose={() => setOpenStudent(null)}
        />
      )}
    </div>
  );
}

// ─── Detail modal ───────────────────────────────────────────────────────────

function StudentDetailModal({
  student,
  onClose,
}: {
  student: StudentRow;
  onClose: () => void;
}) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["oc-report-student", student.membershipId],
    enabled: !!student.membershipId,
    queryFn: () =>
      fetchJSON<StudentDetailData>(
        `/api/online-classes/reports/students/${student.membershipId}`
      ),
  });

  const detail = data?.student ?? null;
  const courses = unwrapList<StudentDetailCourse>(data, "courses");
  const badge = detail
    ? (MEMBERSHIP_STATUS[detail.membershipStatus?.toLowerCase()] ?? {
        label: detail.membershipStatus,
        cls: "badge-neutral",
      })
    : null;

  return (
    <Modal
      title={`התקדמות — ${student.name || "תלמיד"}`}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      {isError ? (
        <div className="p-6 text-center">
          <AlertTriangle className="w-7 h-7 mx-auto mb-3 text-red-400" />
          <p className="text-red-600 font-medium mb-2">
            שגיאה בטעינת נתוני התלמיד
          </p>
          <button className="btn-secondary text-sm" onClick={() => refetch()}>
            נסה שוב
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="flex items-center gap-2 flex-wrap text-xs text-petra-muted">
            <span dir="ltr">{detail?.email ?? student.email}</span>
            {(detail?.phone ?? student.phone) && (
              <span dir="ltr">· {detail?.phone ?? student.phone}</span>
            )}
            {detail?.joinedAt && (
              <span>· הצטרף ב-{heDate(detail.joinedAt)}</span>
            )}
            {badge && <span className={badge.cls}>{badge.label}</span>}
          </div>

          {courses.length === 0 ? (
            <div className="empty-state py-10">
              <div className="empty-state-icon">
                <BookOpen className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-petra-muted">
                אין קורסים פעילים עבור תלמיד זה
              </p>
            </div>
          ) : (
            courses.map((c) => (
              <div
                key={c.courseId}
                className="rounded-xl border border-slate-100 p-3"
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <p className="font-bold text-petra-text text-sm">{c.title}</p>
                  <span className="text-xs text-petra-muted whitespace-nowrap">
                    {c.completedLessons}/{c.totalLessons} · {c.percent}%
                  </span>
                </div>
                <ProgressBar percent={c.percent} />

                {c.lessons.length > 0 && (
                  <div className="mt-3 divide-y divide-slate-100">
                    {c.lessons.map((l) => (
                      <div key={l.id} className="flex items-center gap-2 py-2">
                        {l.completedAt ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-petra-text truncate">
                            {l.title}
                          </p>
                          <p className="text-[11px] text-petra-muted truncate">
                            {l.moduleTitle}
                          </p>
                        </div>
                        <span className="text-xs text-petra-muted whitespace-nowrap">
                          {l.completedAt
                            ? `הושלם ${heDate(l.completedAt)}`
                            : l.percent > 0
                              ? `${l.percent}%`
                              : "טרם התחיל"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </Modal>
  );
}
