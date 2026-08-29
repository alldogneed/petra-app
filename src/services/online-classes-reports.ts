/**
 * Online Classes — student progress reports (admin side).
 *
 * Read-only aggregation over LessonProgress for the business's courses.
 * All functions take businessId first and scope EVERY query by it — lesson and
 * course ownership is verified through the lesson → module → course → businessId
 * chain, and membership rows through Membership.businessId.
 *
 * Efficiency: never one query per student. Each entry point loads the business's
 * course tree once and the relevant progress rows once, then aggregates in memory.
 *
 * Concurrency: read-only, no transactions (Supabase PgBouncer — see CLAUDE.md #17).
 */

import prisma from "@/lib/prisma";
import { ServiceError } from "./types";

export { ServiceError };

/** Aggregation is in-memory by design (no per-student queries) — these caps keep
 *  a very large catalog from pulling the whole progress table into the lambda. */
const PROGRESS_SCAN_LIMIT = 50_000;
const STUDENT_SCAN_LIMIT = 5_000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Below this many students who started, a drop-off point is statistical noise. */
const MIN_STUDENTS_FOR_DROPOFF = 3;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CourseReport {
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

export interface StudentProgressRow {
  membershipId: string;
  name: string;
  email: string;
  phone: string | null;
  completedLessons: number;
  totalLessons: number;
  percent: number;
  lastActivityAt: Date | null;
  stalledDays: number | null;
}

export interface StudentDetail {
  student: {
    name: string;
    email: string;
    phone: string | null;
    membershipStatus: string;
    joinedAt: Date;
  };
  courses: Array<{
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
      completedAt: Date | null;
    }>;
  }>;
}

// ─── Internal loaders ──────────────────────────────────────────────────────

type FlatLesson = {
  id: string;
  title: string;
  moduleTitle: string;
};

type LoadedCourse = {
  id: string;
  title: string;
  status: string;
  /** Ordered by module.position, then lesson.position. */
  lessons: FlatLesson[];
};

/**
 * The business's courses with their lessons flattened in study order.
 * Scoped by Course.businessId — modules/lessons are reached only through it,
 * so the ownership chain can never leak another tenant's rows.
 */
async function loadCourses(
  businessId: string,
  opts: { courseId?: string; publishedOnly?: boolean } = {}
): Promise<LoadedCourse[]> {
  const courses = await prisma.course.findMany({
    where: {
      businessId,
      ...(opts.courseId ? { id: opts.courseId } : {}),
      ...(opts.publishedOnly ? { status: "published" } : {}),
    },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      modules: {
        orderBy: { position: "asc" },
        select: {
          title: true,
          lessons: {
            orderBy: { position: "asc" },
            select: { id: true, title: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return courses.map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    lessons: c.modules.flatMap((m) =>
      m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        moduleTitle: m.title,
      }))
    ),
  }));
}

type ProgressRow = {
  membershipId: string;
  lessonId: string;
  completedAt: Date | null;
  percent: number;
  updatedAt: Date;
};

/**
 * Every progress row for the given lessons, double-scoped: the lesson ids come
 * from this business's course tree AND the membership must belong to it.
 */
async function loadProgress(
  businessId: string,
  lessonIds: string[],
  opts: { membershipId?: string } = {}
): Promise<ProgressRow[]> {
  if (lessonIds.length === 0) return [];
  return prisma.lessonProgress.findMany({
    where: {
      lessonId: { in: lessonIds },
      membership: {
        businessId,
        ...(opts.membershipId ? { id: opts.membershipId } : {}),
      },
    },
    select: {
      membershipId: true,
      lessonId: true,
      completedAt: true,
      percent: true,
      updatedAt: true,
    },
    take: PROGRESS_SCAN_LIMIT,
  });
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

// ─── Course-level report ───────────────────────────────────────────────────

/**
 * Per-course funnel: how many active members started, how many finished,
 * the average completion, and the single lesson with the biggest fall-off.
 *
 * Includes draft courses (the owner wants to see everything they built).
 */
export async function getCourseReports(
  businessId: string
): Promise<CourseReport[]> {
  const [courses, enrolledStudents] = await Promise.all([
    loadCourses(businessId),
    prisma.membership.count({ where: { businessId, status: "active" } }),
  ]);

  const allLessonIds = courses.flatMap((c) => c.lessons.map((l) => l.id));
  const progress = await loadProgress(businessId, allLessonIds);

  // lessonId → { started: Set<membershipId>, completed: Set<membershipId> }
  const byLesson = new Map<
    string,
    { started: Set<string>; completed: Set<string> }
  >();
  for (const row of progress) {
    let entry = byLesson.get(row.lessonId);
    if (!entry) {
      entry = { started: new Set(), completed: new Set() };
      byLesson.set(row.lessonId, entry);
    }
    entry.started.add(row.membershipId);
    if (row.completedAt) entry.completed.add(row.membershipId);
  }

  return courses.map((course) => {
    const lessonCount = course.lessons.length;

    // Students who touched at least one lesson of this course.
    const startedSet = new Set<string>();
    // membershipId → completed lesson count within this course
    const completedPerStudent = new Map<string, number>();

    for (const lesson of course.lessons) {
      const entry = byLesson.get(lesson.id);
      if (!entry) continue;
      for (const m of entry.started) startedSet.add(m);
      for (const m of entry.completed) {
        completedPerStudent.set(m, (completedPerStudent.get(m) ?? 0) + 1);
      }
    }

    const startedStudents = startedSet.size;
    let completedStudents = 0;
    let percentSum = 0;
    for (const membershipId of startedSet) {
      const done = completedPerStudent.get(membershipId) ?? 0;
      if (lessonCount > 0 && done >= lessonCount) completedStudents += 1;
      percentSum += pct(done, lessonCount);
    }
    const avgCompletionPercent =
      startedStudents > 0 ? Math.round(percentSum / startedStudents) : 0;

    return {
      courseId: course.id,
      title: course.title,
      status: course.status,
      lessonCount,
      enrolledStudents,
      startedStudents,
      completedStudents,
      avgCompletionPercent,
      dropOffLesson: findDropOff(course, byLesson, startedStudents),
    };
  });
}

/**
 * The lesson where most students fell off: the largest count of students who
 * completed the PREVIOUS lesson but not this one. null when the course has
 * fewer than 2 lessons, fewer than MIN_STUDENTS_FOR_DROPOFF students who
 * started, or nobody actually dropped.
 */
function findDropOff(
  course: LoadedCourse,
  byLesson: Map<string, { started: Set<string>; completed: Set<string> }>,
  startedStudents: number
): CourseReport["dropOffLesson"] {
  if (course.lessons.length < 2) return null;
  if (startedStudents < MIN_STUDENTS_FOR_DROPOFF) return null;

  let best: CourseReport["dropOffLesson"] = null;

  for (let i = 1; i < course.lessons.length; i++) {
    const prev = course.lessons[i - 1];
    const current = course.lessons[i];
    const reached = byLesson.get(prev.id)?.completed ?? new Set<string>();
    if (reached.size === 0) continue;

    const currentDone = byLesson.get(current.id)?.completed ?? new Set<string>();
    let droppedCount = 0;
    for (const membershipId of reached) {
      if (!currentDone.has(membershipId)) droppedCount += 1;
    }
    if (droppedCount === 0) continue;

    if (!best || droppedCount > best.droppedCount) {
      best = {
        id: current.id,
        title: current.title,
        moduleTitle: current.moduleTitle,
        reachedCount: reached.size,
        droppedCount,
      };
    }
  }

  return best;
}

// ─── Student-level report ──────────────────────────────────────────────────

/**
 * One row per ACTIVE member of the business, with completion across the
 * published courses (or a single course when opts.courseId is given — the
 * course id is resolved through the business's own courses, so an id from
 * another tenant simply yields an empty scope).
 */
export async function getStudentProgress(
  businessId: string,
  opts: { courseId?: string } = {}
): Promise<StudentProgressRow[]> {
  const [memberships, courses] = await Promise.all([
    prisma.membership.findMany({
      where: { businessId, status: "active" },
      select: {
        id: true,
        createdAt: true,
        portalUser: { select: { name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: STUDENT_SCAN_LIMIT,
    }),
    loadCourses(businessId, {
      courseId: opts.courseId,
      publishedOnly: !opts.courseId,
    }),
  ]);

  const lessonIds = courses.flatMap((c) => c.lessons.map((l) => l.id));
  const totalLessons = lessonIds.length;
  const progress = await loadProgress(businessId, lessonIds);

  const completedByMember = new Map<string, number>();
  const lastActivityByMember = new Map<string, Date>();
  for (const row of progress) {
    if (row.completedAt) {
      completedByMember.set(
        row.membershipId,
        (completedByMember.get(row.membershipId) ?? 0) + 1
      );
    }
    const seen = lastActivityByMember.get(row.membershipId);
    if (!seen || row.updatedAt > seen) {
      lastActivityByMember.set(row.membershipId, row.updatedAt);
    }
  }

  const now = Date.now();

  return memberships.map((m) => {
    const completedLessons = Math.min(
      completedByMember.get(m.id) ?? 0,
      totalLessons
    );
    const lastActivityAt = lastActivityByMember.get(m.id) ?? null;
    const stalledDays = lastActivityAt
      ? Math.max(0, Math.floor((now - lastActivityAt.getTime()) / DAY_MS))
      : null;

    return {
      membershipId: m.id,
      name: m.portalUser.name,
      email: m.portalUser.email,
      phone: m.portalUser.phone ?? null,
      completedLessons,
      totalLessons,
      percent: pct(completedLessons, totalLessons),
      lastActivityAt,
      stalledDays,
    };
  });
}

// ─── Single student breakdown ──────────────────────────────────────────────

/**
 * Per-course, per-lesson breakdown for one member.
 * ServiceError NOT_FOUND when the membership is not this business's.
 */
export async function getStudentDetail(
  businessId: string,
  membershipId: string
): Promise<StudentDetail> {
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, businessId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      portalUser: { select: { name: true, email: true, phone: true } },
    },
  });
  if (!membership) throw new ServiceError("תלמיד לא נמצא", "NOT_FOUND");

  const courses = await loadCourses(businessId);
  const allLessonIds = courses.flatMap((c) => c.lessons.map((l) => l.id));
  const progress = await loadProgress(businessId, allLessonIds, {
    membershipId: membership.id,
  });

  const byLesson = new Map<string, ProgressRow>();
  for (const row of progress) byLesson.set(row.lessonId, row);

  const courseRows = courses
    .map((course) => {
      const lessons = course.lessons.map((lesson) => {
        const row = byLesson.get(lesson.id);
        return {
          id: lesson.id,
          title: lesson.title,
          moduleTitle: lesson.moduleTitle,
          percent: row ? Math.max(0, Math.min(100, row.percent)) : 0,
          completedAt: row?.completedAt ?? null,
        };
      });
      const completedLessons = lessons.filter((l) => l.completedAt).length;
      const touched = lessons.some((l) => byLesson.has(l.id));
      return {
        courseId: course.id,
        title: course.title,
        percent: pct(completedLessons, lessons.length),
        completedLessons,
        totalLessons: lessons.length,
        lessons,
        _status: course.status,
        _touched: touched,
      };
    })
    // Published courses the student can actually study, plus any draft they
    // already made progress in (so nothing they did disappears from the report).
    .filter((c) => c._status === "published" || c._touched)
    .map(({ _status, _touched, ...rest }) => rest);

  return {
    student: {
      name: membership.portalUser.name,
      email: membership.portalUser.email,
      phone: membership.portalUser.phone ?? null,
      membershipStatus: membership.status,
      joinedAt: membership.createdAt,
    },
    courses: courseRows,
  };
}
