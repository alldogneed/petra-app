/**
 * Student dossier ("תיק סטודנט") — admin side (business owner).
 *
 * Aggregates a single membership's full profile across the online-classes
 * feature: course progress, certificates, questions asked, and live-class
 * registrations. Read-only, business-scoped.
 *
 * Efficiency: the business course tree and this member's progress/certs/
 * questions/registrations are each fetched exactly once, then aggregated in
 * memory — NO per-course or per-lesson query loops.
 *
 * Concurrency: read-only, no transactions.
 */

import prisma from "@/lib/prisma";
import { ServiceError } from "@/services/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DossierLesson {
  id: string;
  title: string;
  moduleTitle: string;
  percent: number;
  completedAt: Date | null;
  watchedSeconds: number;
  durationMin: number | null;
}

export interface DossierCourse {
  courseId: string;
  title: string;
  status: string;
  percent: number;
  completedLessons: number;
  totalLessons: number;
  lastActivityAt: Date | null;
  certificate: {
    serial: string;
    issuedAt: Date;
    revokedAt: Date | null;
    issuedManually: boolean;
  } | null;
  lessons: DossierLesson[];
}

export interface DossierQuestion {
  id: string;
  body: string;
  answerBody: string | null;
  answeredAt: Date | null;
  createdAt: Date;
  isPrivate: boolean;
  lessonTitle: string;
  courseTitle: string;
}

export interface DossierLiveClass {
  title: string;
  startsAt: Date;
  status: string;
}

export interface StudentDossier {
  student: {
    name: string;
    email: string;
    phone: string | null;
    status: string;
    validUntil: Date | null;
    paymentNote: string | null;
    approvedAt: Date | null;
    joinedAt: Date;
  };
  summary: {
    coursesStarted: number;
    coursesCompleted: number;
    certificatesCount: number;
    lastActivityAt: Date | null;
    stalledDays: number | null;
    questionsAsked: number;
    questionsUnanswered: number;
  };
  courses: DossierCourse[];
  questions: DossierQuestion[];
  liveClasses: DossierLiveClass[];
}

/**
 * Full profile for one membership. Everything is scoped to businessId:
 * the membership must belong to the business (NOT_FOUND otherwise), and all
 * lessons/questions/certs are reached only through that business's courses.
 */
export async function getStudentDossier(
  businessId: string,
  membershipId: string
): Promise<StudentDossier> {
  // Ownership gate first — a membership from another business is invisible.
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, businessId },
    include: {
      portalUser: { select: { name: true, phone: true, email: true } },
    },
  });
  if (!membership) throw new ServiceError("מנוי לא נמצא", "NOT_FOUND");

  // One fetch per entity — no loops. All already business-scoped (courses via
  // businessId; progress/certs/questions/registrations via this membership,
  // which we just proved belongs to the business).
  const [courses, progressRows, certs, questions, registrations] = await Promise.all([
    prisma.course.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      include: {
        modules: {
          orderBy: { position: "asc" },
          include: { lessons: { orderBy: { position: "asc" } } },
        },
      },
    }),
    prisma.lessonProgress.findMany({
      where: { membershipId },
      select: {
        lessonId: true,
        completedAt: true,
        percent: true,
        watchedSeconds: true,
        updatedAt: true,
      },
    }),
    prisma.courseCertificate.findMany({
      where: { membershipId, businessId },
      select: {
        courseId: true,
        serial: true,
        issuedAt: true,
        revokedAt: true,
        issuedManually: true,
      },
    }),
    prisma.lessonQuestion.findMany({
      where: { membershipId, businessId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        body: true,
        answerBody: true,
        answeredAt: true,
        createdAt: true,
        isPrivate: true,
        lesson: {
          select: {
            title: true,
            module: { select: { course: { select: { title: true } } } },
          },
        },
      },
    }),
    prisma.classRegistration.findMany({
      where: { membershipId, onlineClass: { businessId } },
      orderBy: { onlineClass: { startsAt: "desc" } },
      select: {
        status: true,
        onlineClass: { select: { title: true, startsAt: true } },
      },
    }),
  ]);

  // Index progress by lessonId for O(1) merge.
  const progressByLesson = new Map(progressRows.map((p) => [p.lessonId, p]));
  const certByCourse = new Map(certs.map((c) => [c.courseId, c]));

  let overallLastActivity: Date | null = null;
  const trackActivity = (d: Date | null) => {
    if (d && (!overallLastActivity || d > overallLastActivity)) overallLastActivity = d;
  };

  const dossierCourses: DossierCourse[] = [];
  let coursesStarted = 0;
  let coursesCompleted = 0;

  for (const course of courses) {
    const lessons: DossierLesson[] = [];
    let percentSum = 0;
    let completedLessons = 0;
    let started = false;
    let courseLastActivity: Date | null = null;

    for (const mod of course.modules) {
      for (const lesson of mod.lessons) {
        const prog = progressByLesson.get(lesson.id);
        const isComplete = !!prog?.completedAt;
        const percent = isComplete ? 100 : prog?.percent ?? 0;
        if (prog) {
          started = true;
          if (prog.updatedAt) {
            if (!courseLastActivity || prog.updatedAt > courseLastActivity) {
              courseLastActivity = prog.updatedAt;
            }
            trackActivity(prog.updatedAt);
          }
        }
        if (isComplete) completedLessons += 1;
        percentSum += percent;
        lessons.push({
          id: lesson.id,
          title: lesson.title,
          moduleTitle: mod.title,
          percent,
          completedAt: prog?.completedAt ?? null,
          watchedSeconds: prog?.watchedSeconds ?? 0,
          durationMin: lesson.durationMin,
        });
      }
    }

    const totalLessons = lessons.length;
    const cert = certByCourse.get(course.id) ?? null;

    // Include only courses the student could meaningfully see: published, or any
    // course they have progress/a certificate in (even if later unpublished).
    if (course.status !== "published" && !started && !cert) continue;

    if (started) coursesStarted += 1;
    if (totalLessons > 0 && completedLessons === totalLessons) coursesCompleted += 1;

    dossierCourses.push({
      courseId: course.id,
      title: course.title,
      status: course.status,
      percent: totalLessons > 0 ? Math.round(percentSum / totalLessons) : 0,
      completedLessons,
      totalLessons,
      lastActivityAt: courseLastActivity,
      certificate: cert
        ? {
            serial: cert.serial,
            issuedAt: cert.issuedAt,
            revokedAt: cert.revokedAt,
            issuedManually: cert.issuedManually,
          }
        : null,
      lessons,
    });
  }

  const stalledDays =
    overallLastActivity !== null
      ? Math.floor((Date.now() - (overallLastActivity as Date).getTime()) / DAY_MS)
      : null;

  const dossierQuestions: DossierQuestion[] = questions.map((q) => ({
    id: q.id,
    body: q.body,
    answerBody: q.answerBody,
    answeredAt: q.answeredAt,
    createdAt: q.createdAt,
    isPrivate: q.isPrivate,
    lessonTitle: q.lesson?.title ?? "",
    courseTitle: q.lesson?.module?.course?.title ?? "",
  }));

  const liveClasses: DossierLiveClass[] = registrations.map((r) => ({
    title: r.onlineClass.title,
    startsAt: r.onlineClass.startsAt,
    status: r.status,
  }));

  return {
    student: {
      name: membership.portalUser.name,
      email: membership.portalUser.email,
      phone: membership.portalUser.phone,
      status: membership.status,
      validUntil: membership.validUntil,
      paymentNote: membership.paymentNote,
      approvedAt: membership.approvedAt,
      joinedAt: membership.createdAt,
    },
    summary: {
      coursesStarted,
      coursesCompleted,
      certificatesCount: certs.filter((c) => !c.revokedAt).length,
      lastActivityAt: overallLastActivity,
      stalledDays,
      questionsAsked: dossierQuestions.length,
      questionsUnanswered: dossierQuestions.filter((q) => !q.answeredAt).length,
    },
    courses: dossierCourses,
    questions: dossierQuestions,
    liveClasses,
  };
}
