/**
 * Lesson Q&A service — Online Classes module.
 *
 * Students ask questions under a lesson; the business answers; answers are
 * visible to the whole course (unless the student marked the question private,
 * in which case only its author — and the business inbox — can see it).
 *
 * Tenant scoping: EVERY query is filtered by businessId, either directly on
 * LessonQuestion.businessId or through the verified lesson→module→course chain.
 * No Request/Response knowledge. Throws ServiceError on failure.
 *
 * Concurrency: NO interactive prisma.$transaction(async...) — Supabase PgBouncer.
 */

import prisma from "@/lib/prisma";
import { ServiceError } from "./types";
import { sendEmail } from "@/lib/email";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { toWhatsAppPhone } from "@/lib/utils";

export { ServiceError };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://petra-app.com";

const MIN_BODY = 3;
const MAX_BODY = 1000;
const MIN_ANSWER = 1;
const MAX_ANSWER = 2000;
/** A membership may not stack more than this many unanswered questions per lesson. */
const MAX_OPEN_PER_LESSON = 5;

/**
 * Local HTML escape. src/lib/email.ts has one but does NOT export it, so we
 * keep a private copy here. Student-authored text is untrusted and must never
 * reach notification HTML unescaped.
 */
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "דנה כהן" → "דנה כ." — first name plus the initial of the rest. */
function shortName(fullName: string): string {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "משתתף/ת";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}

/**
 * Verify a lesson belongs to a PUBLISHED course of this business.
 * Throws ServiceError NOT_FOUND otherwise. Returns the lesson identity.
 */
async function assertPublishedLesson(businessId: string, lessonId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      module: { course: { businessId, status: "published" } },
    },
    select: {
      id: true,
      title: true,
      module: { select: { course: { select: { id: true, title: true } } } },
    },
  });
  if (!lesson) throw new ServiceError("שיעור לא נמצא", "NOT_FOUND");
  return lesson;
}

// ─── Student side ──────────────────────────────────────────────────────────

export interface LessonQuestionPublic {
  id: string;
  body: string;
  isPrivate: boolean;
  answerBody: string | null;
  answeredAt: Date | null;
  createdAt: Date;
  /** First name + initial, e.g. "דנה כ." — never the full name or contact info. */
  askedByName: string;
  isMine: boolean;
}

/**
 * Questions visible to one student under one lesson.
 * Visible = public question, OR a private question owned by this membership.
 */
export async function listLessonQuestions(
  businessId: string,
  lessonId: string,
  membershipId: string
): Promise<LessonQuestionPublic[]> {
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, businessId },
    select: { id: true },
  });
  if (!membership) throw new ServiceError("מנוי לא נמצא", "NOT_FOUND");

  await assertPublishedLesson(businessId, lessonId);

  const rows = await prisma.lessonQuestion.findMany({
    where: {
      businessId,
      lessonId,
      OR: [{ isPrivate: false }, { membershipId }],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      isPrivate: true,
      answerBody: true,
      answeredAt: true,
      createdAt: true,
      membershipId: true,
      membership: { select: { portalUser: { select: { name: true } } } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    isPrivate: r.isPrivate,
    answerBody: r.answerBody,
    answeredAt: r.answeredAt,
    createdAt: r.createdAt,
    askedByName: shortName(r.membership?.portalUser?.name ?? ""),
    isMine: r.membershipId === membershipId,
  }));
}

/**
 * Ask a question under a lesson.
 * Refuses when the membership already has MAX_OPEN_PER_LESSON unanswered
 * questions on this same lesson (spam / rate sanity guard).
 */
export async function askQuestion(
  businessId: string,
  membershipId: string,
  lessonId: string,
  body: string,
  isPrivate?: boolean
) {
  const trimmed = (body ?? "").trim();
  if (trimmed.length < MIN_BODY)
    throw new ServiceError("השאלה קצרה מדי — לפחות 3 תווים", "VALIDATION");
  if (trimmed.length > MAX_BODY)
    throw new ServiceError("השאלה ארוכה מדי — עד 1000 תווים", "VALIDATION");

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, businessId },
    select: { id: true, portalUser: { select: { name: true } } },
  });
  if (!membership) throw new ServiceError("מנוי לא נמצא", "NOT_FOUND");

  const lesson = await assertPublishedLesson(businessId, lessonId);

  const openCount = await prisma.lessonQuestion.count({
    where: { businessId, lessonId, membershipId, answeredAt: null },
  });
  if (openCount >= MAX_OPEN_PER_LESSON) {
    throw new ServiceError(
      "יש לך כבר 5 שאלות שממתינות לתשובה בשיעור הזה — המתן/י לתשובה לפני שליחת שאלה נוספת",
      "CONFLICT"
    );
  }

  const question = await prisma.lessonQuestion.create({
    data: {
      businessId,
      lessonId,
      membershipId,
      body: trimmed,
      isPrivate: isPrivate === true,
    },
    select: {
      id: true,
      body: true,
      isPrivate: true,
      answerBody: true,
      answeredAt: true,
      createdAt: true,
    },
  });

  // Fire-and-forget: tell the business a new question arrived.
  void (async () => {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, email: true },
    });
    if (!business?.email) return;
    const safeStudent = escapeHtml(membership.portalUser?.name ?? "משתתף/ת");
    const safeLesson = escapeHtml(lesson.title);
    const safeCourse = escapeHtml(lesson.module?.course?.title ?? "");
    const safeBody = escapeHtml(trimmed).replace(/\n/g, "<br/>");
    await sendEmail({
      to: business.email,
      subject: "‏שאלה חדשה בשיעור אונליין",
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right;">
          <h2>שאלה חדשה מתלמיד/ה</h2>
          <p><strong>${safeStudent}</strong> שאל/ה שאלה בשיעור <strong>${safeLesson}</strong>${
            safeCourse ? ` (קורס: ${safeCourse})` : ""
          }.</p>
          <blockquote style="margin:12px 0;padding:12px 16px;background:#f8fafc;border-right:3px solid #cbd5e1;">
            ${safeBody}
          </blockquote>
          <p><a href="${APP_URL}/online-classes">למענה על השאלה במערכת פטרה</a></p>
        </div>`,
    });
  })().catch(() => {});

  return question;
}

// ─── Business side ─────────────────────────────────────────────────────────

export interface BusinessQuestionItem {
  id: string;
  body: string;
  answerBody: string | null;
  answeredAt: Date | null;
  createdAt: Date;
  isPrivate: boolean;
  student: { name: string; email: string };
  lesson: { id: string; title: string; courseTitle: string };
}

/**
 * The business inbox: every question asked in this business's courses.
 * opts.answered === false → only unanswered; true → only answered; omitted → all.
 */
export async function listBusinessQuestions(
  businessId: string,
  opts?: { answered?: boolean }
): Promise<BusinessQuestionItem[]> {
  const where: {
    businessId: string;
    answeredAt?: null | { not: null };
  } = { businessId };
  if (opts?.answered === false) where.answeredAt = null;
  else if (opts?.answered === true) where.answeredAt = { not: null };

  const rows = await prisma.lessonQuestion.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      body: true,
      answerBody: true,
      answeredAt: true,
      createdAt: true,
      isPrivate: true,
      membership: {
        select: { portalUser: { select: { name: true, email: true } } },
      },
      lesson: {
        select: {
          id: true,
          title: true,
          module: { select: { course: { select: { title: true } } } },
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    answerBody: r.answerBody,
    answeredAt: r.answeredAt,
    createdAt: r.createdAt,
    isPrivate: r.isPrivate,
    student: {
      name: r.membership?.portalUser?.name ?? "—",
      email: r.membership?.portalUser?.email ?? "",
    },
    lesson: {
      id: r.lesson?.id ?? "",
      title: r.lesson?.title ?? "—",
      courseTitle: r.lesson?.module?.course?.title ?? "",
    },
  }));
}

/**
 * Answer (or re-answer) a question. Sets answeredAt and notifies the student
 * by email, plus WhatsApp when a phone is on file (PortalUser.phone is nullable).
 */
export async function answerQuestion(
  businessId: string,
  questionId: string,
  answerBody: string
) {
  const trimmed = (answerBody ?? "").trim();
  if (trimmed.length < MIN_ANSWER)
    throw new ServiceError("לא ניתן לשלוח תשובה ריקה", "VALIDATION");
  if (trimmed.length > MAX_ANSWER)
    throw new ServiceError("התשובה ארוכה מדי — עד 2000 תווים", "VALIDATION");

  const existing = await prisma.lessonQuestion.findFirst({
    where: { id: questionId, businessId },
    select: {
      id: true,
      body: true,
      membership: {
        select: {
          portalUser: { select: { name: true, email: true, phone: true } },
        },
      },
      lesson: {
        select: {
          id: true,
          title: true,
          module: {
            select: { course: { select: { id: true, title: true } } },
          },
        },
      },
    },
  });
  if (!existing) throw new ServiceError("שאלה לא נמצאה", "NOT_FOUND");

  const updated = await prisma.lessonQuestion.update({
    where: { id: existing.id },
    data: { answerBody: trimmed, answeredAt: new Date() },
    select: {
      id: true,
      body: true,
      answerBody: true,
      answeredAt: true,
      createdAt: true,
      isPrivate: true,
    },
  });

  // Fire-and-forget: notify the student.
  void (async () => {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, slug: true },
    });
    const student = existing.membership?.portalUser;
    if (!student) return;

    const courseId = existing.lesson?.module?.course?.id ?? "";
    const link =
      business?.slug && courseId
        ? `${APP_URL}/c/${business.slug}/courses/${courseId}`
        : business?.slug
          ? `${APP_URL}/c/${business.slug}`
          : APP_URL;

    if (student.email) {
      const safeStudent = escapeHtml(student.name ?? "");
      const safeLesson = escapeHtml(existing.lesson?.title ?? "");
      const safeBusiness = escapeHtml(business?.name ?? "");
      const safeQuestion = escapeHtml(existing.body).replace(/\n/g, "<br/>");
      const safeAnswer = escapeHtml(trimmed).replace(/\n/g, "<br/>");
      await sendEmail({
        to: student.email,
        subject: "‏קיבלת תשובה לשאלה שלך",
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right;">
            <h2>יש תשובה לשאלה שלך</h2>
            <p>שלום ${safeStudent}, ${safeBusiness} ענה/תה לשאלתך בשיעור <strong>${safeLesson}</strong>.</p>
            <blockquote style="margin:12px 0;padding:12px 16px;background:#f8fafc;border-right:3px solid #cbd5e1;">
              ${safeQuestion}
            </blockquote>
            <p><strong>התשובה:</strong></p>
            <blockquote style="margin:12px 0;padding:12px 16px;background:#ecfdf5;border-right:3px solid #10b981;">
              ${safeAnswer}
            </blockquote>
            <p><a href="${link}">לצפייה בשיעור בפורטל</a></p>
          </div>`,
      });
    }

    // PortalUser.phone is nullable — only send when it exists.
    if (student.phone) {
      await sendWhatsAppMessage({
        to: toWhatsAppPhone(student.phone),
        body: `שלום ${student.name || ""}, קיבלת תשובה לשאלה ששאלת בשיעור "${
          existing.lesson?.title ?? ""
        }".\n${trimmed}\n\nלצפייה בשיעור: ${link}`,
      });
    }
  })().catch(() => {});

  return updated;
}

/** Hard-delete a question (business side). Scoped by businessId. */
export async function deleteQuestion(
  businessId: string,
  questionId: string
): Promise<void> {
  const existing = await prisma.lessonQuestion.findFirst({
    where: { id: questionId, businessId },
    select: { id: true },
  });
  if (!existing) throw new ServiceError("שאלה לא נמצאה", "NOT_FOUND");

  await prisma.lessonQuestion.delete({ where: { id: existing.id } });
}
