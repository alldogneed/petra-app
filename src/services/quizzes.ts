/**
 * Quizzes service — end-of-module quizzes for the Online Classes module.
 *
 * Admin side: getQuizForBusiness / upsertQuiz / deleteQuiz (full tree, WITH isCorrect).
 * Student side: getQuizForStudent (isCorrect NEVER leaves the server) / submitAttempt.
 *
 * Ownership: every path validates the chain quiz → module → course → businessId.
 * Students may only reach quizzes whose course is published.
 * Grading happens ONLY from the DB — nothing the client sends about correctness is trusted.
 *
 * Concurrency: NO interactive prisma.$transaction(async...) — Supabase PgBouncer
 * (transaction pooling) is incompatible. Batch $transaction([...]) is allowed.
 */

import prisma from "@/lib/prisma";
import { ServiceError } from "./types";

export { ServiceError };

// ─── Limits ────────────────────────────────────────────────────────────────

export const QUIZ_TITLE_MAX = 200;
export const QUIZ_MAX_QUESTIONS = 50;
export const QUIZ_MIN_QUESTIONS = 1;
export const QUESTION_TEXT_MAX = 500;
export const OPTION_TEXT_MAX = 300;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface QuizUpsertInput {
  title: string;
  passScore: number;
  questions: Array<{
    text: string;
    options: Array<{ text: string; isCorrect: boolean }>;
  }>;
}

export interface StudentQuiz {
  id: string;
  title: string;
  passScore: number;
  moduleTitle: string;
  courseTitle: string;
  questions: Array<{
    id: string;
    text: string;
    options: Array<{ id: string; text: string }>;
  }>;
  bestAttempt: { score: number; passed: boolean; createdAt: Date } | null;
}

export interface AttemptResult {
  score: number;
  passed: boolean;
  passScore: number;
  correctCount: number;
  totalQuestions: number;
  /** correctOptionId is revealed only once the attempt passed — otherwise a
   *  failing submission would hand back the answer key for an instant retry. */
  results: Array<{
    questionId: string;
    correct: boolean;
    correctOptionId: string | null;
  }>;
}

// ─── Shared helpers ────────────────────────────────────────────────────────

/** Verifies module → course → businessId. Throws NOT_FOUND otherwise. */
async function assertModuleOwnership(businessId: string, moduleId: string) {
  const mod = await prisma.courseModule.findFirst({
    where: { id: moduleId, course: { businessId } },
    select: { id: true },
  });
  if (!mod) throw new ServiceError("פרק לא נמצא", "NOT_FOUND");
  return mod;
}

/** Verifies the membership belongs to this business. Throws NOT_FOUND otherwise. */
async function assertMembership(businessId: string, membershipId: string) {
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, businessId },
    select: { id: true },
  });
  if (!membership) throw new ServiceError("מנוי לא נמצא", "NOT_FOUND");
  return membership;
}

function validateUpsertInput(data: QuizUpsertInput) {
  const title = typeof data?.title === "string" ? data.title.trim() : "";
  if (!title) throw new ServiceError("נדרשת כותרת לבוחן", "VALIDATION");
  if (title.length > QUIZ_TITLE_MAX) {
    throw new ServiceError(
      `כותרת הבוחן ארוכה מדי (מקסימום ${QUIZ_TITLE_MAX} תווים)`,
      "VALIDATION"
    );
  }

  const passScore =
    typeof data?.passScore === "number"
      ? data.passScore
      : typeof data?.passScore === "string"
        ? parseInt(data.passScore, 10)
        : NaN;
  if (!Number.isInteger(passScore) || passScore < 0 || passScore > 100) {
    throw new ServiceError(
      "ציון עובר חייב להיות מספר שלם בין 0 ל-100",
      "VALIDATION"
    );
  }

  const rawQuestions = Array.isArray(data?.questions) ? data.questions : [];
  if (rawQuestions.length < QUIZ_MIN_QUESTIONS) {
    throw new ServiceError("יש להוסיף לפחות שאלה אחת לבוחן", "VALIDATION");
  }
  if (rawQuestions.length > QUIZ_MAX_QUESTIONS) {
    throw new ServiceError(
      `מקסימום ${QUIZ_MAX_QUESTIONS} שאלות בבוחן`,
      "VALIDATION"
    );
  }

  const questions = rawQuestions.map((q, index) => {
    const n = index + 1;
    const text = typeof q?.text === "string" ? q.text.trim() : "";
    if (!text) throw new ServiceError(`שאלה ${n}: נדרש טקסט לשאלה`, "VALIDATION");
    if (text.length > QUESTION_TEXT_MAX) {
      throw new ServiceError(
        `שאלה ${n}: טקסט השאלה ארוך מדי (מקסימום ${QUESTION_TEXT_MAX} תווים)`,
        "VALIDATION"
      );
    }

    const rawOptions = Array.isArray(q?.options) ? q.options : [];
    if (rawOptions.length < MIN_OPTIONS || rawOptions.length > MAX_OPTIONS) {
      throw new ServiceError(
        `שאלה ${n}: נדרשות בין ${MIN_OPTIONS} ל-${MAX_OPTIONS} תשובות`,
        "VALIDATION"
      );
    }

    let correctCount = 0;
    const options = rawOptions.map((o) => {
      const optText = typeof o?.text === "string" ? o.text.trim() : "";
      if (!optText) {
        throw new ServiceError(`שאלה ${n}: נדרש טקסט לכל תשובה`, "VALIDATION");
      }
      if (optText.length > OPTION_TEXT_MAX) {
        throw new ServiceError(
          `שאלה ${n}: טקסט התשובה ארוך מדי (מקסימום ${OPTION_TEXT_MAX} תווים)`,
          "VALIDATION"
        );
      }
      const isCorrect = o?.isCorrect === true;
      if (isCorrect) correctCount++;
      return { text: optText, isCorrect };
    });

    if (correctCount !== 1) {
      throw new ServiceError(
        `שאלה ${n}: יש לסמן תשובה נכונה אחת בדיוק`,
        "VALIDATION"
      );
    }

    return { text, options };
  });

  return { title, passScore, questions };
}

// ─── Admin side ────────────────────────────────────────────────────────────

/** Full quiz tree (WITH isCorrect) for the business editor. null when the module has no quiz. */
export async function getQuizForBusiness(businessId: string, moduleId: string) {
  await assertModuleOwnership(businessId, moduleId);

  return prisma.quiz.findFirst({
    where: { moduleId, module: { course: { businessId } } },
    select: {
      id: true,
      moduleId: true,
      title: true,
      passScore: true,
      createdAt: true,
      questions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          text: true,
          position: true,
          options: {
            orderBy: { position: "asc" },
            select: { id: true, text: true, isCorrect: true, position: true },
          },
        },
      },
    },
  });
}

/**
 * Creates or replaces the module quiz. The entire question set is rewritten
 * (delete-then-recreate) inside a BATCH $transaction([...]).
 * Positions are 10, 20, 30…
 */
export async function upsertQuiz(
  businessId: string,
  moduleId: string,
  data: QuizUpsertInput
) {
  await assertModuleOwnership(businessId, moduleId);
  const { title, passScore, questions } = validateUpsertInput(data);

  const quiz = await prisma.quiz.upsert({
    where: { moduleId },
    update: { title, passScore, businessId },
    create: { businessId, moduleId, title, passScore },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.quizQuestion.deleteMany({ where: { quizId: quiz.id } }),
    ...questions.map((q, qi) =>
      prisma.quizQuestion.create({
        data: {
          quizId: quiz.id,
          text: q.text,
          position: (qi + 1) * 10,
          options: {
            create: q.options.map((o, oi) => ({
              text: o.text,
              isCorrect: o.isCorrect,
              position: (oi + 1) * 10,
            })),
          },
        },
      })
    ),
  ]);

  return getQuizForBusiness(businessId, moduleId);
}

/** Removes the module quiz (attempts cascade). Idempotent — no error when none exists. */
export async function deleteQuiz(
  businessId: string,
  moduleId: string
): Promise<void> {
  await assertModuleOwnership(businessId, moduleId);
  await prisma.quiz.deleteMany({
    where: { moduleId, module: { course: { businessId } } },
  });
}

// ─── Student side ──────────────────────────────────────────────────────────

/**
 * Quiz as the student sees it — no isCorrect anywhere in the payload.
 * Only quizzes inside a published course of this business are reachable.
 */
export async function getQuizForStudent(
  businessId: string,
  membershipId: string,
  quizId: string
): Promise<StudentQuiz> {
  await assertMembership(businessId, membershipId);

  const quiz = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      businessId,
      module: { course: { businessId, status: "published" } },
    },
    select: {
      id: true,
      title: true,
      passScore: true,
      module: {
        select: { title: true, course: { select: { title: true } } },
      },
      questions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          text: true,
          options: {
            orderBy: { position: "asc" },
            select: { id: true, text: true },
          },
        },
      },
    },
  });
  if (!quiz) throw new ServiceError("בוחן לא נמצא", "NOT_FOUND");

  const bestAttempt = await prisma.quizAttempt.findFirst({
    where: { quizId: quiz.id, membershipId },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    select: { score: true, passed: true, createdAt: true },
  });

  return {
    id: quiz.id,
    title: quiz.title,
    passScore: quiz.passScore,
    moduleTitle: quiz.module.title,
    courseTitle: quiz.module.course.title,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
    })),
    bestAttempt: bestAttempt
      ? {
          score: bestAttempt.score,
          passed: bestAttempt.passed,
          createdAt: bestAttempt.createdAt,
        }
      : null,
  };
}

/**
 * Grades a submission against the DB and records the attempt.
 * Unknown questionIds / optionIds are ignored and counted wrong (never throws for them).
 */
export async function submitAttempt(
  businessId: string,
  membershipId: string,
  quizId: string,
  answers: Array<{ questionId: string; optionId: string }>
): Promise<AttemptResult> {
  await assertMembership(businessId, membershipId);

  const quiz = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      businessId,
      module: { course: { businessId, status: "published" } },
    },
    select: {
      id: true,
      passScore: true,
      questions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          options: {
            orderBy: { position: "asc" },
            select: { id: true, isCorrect: true },
          },
        },
      },
    },
  });
  if (!quiz) throw new ServiceError("בוחן לא נמצא", "NOT_FOUND");

  const totalQuestions = quiz.questions.length;
  if (totalQuestions === 0) {
    throw new ServiceError("אין שאלות בבוחן", "VALIDATION");
  }

  // Client answers → map (last one wins). Anything unrecognized is simply never matched.
  const answerMap = new Map<string, string>();
  if (Array.isArray(answers)) {
    for (const a of answers) {
      if (!a || typeof a !== "object") continue;
      const questionId = typeof a.questionId === "string" ? a.questionId : "";
      const optionId = typeof a.optionId === "string" ? a.optionId : "";
      if (!questionId || !optionId) continue;
      answerMap.set(questionId, optionId);
    }
  }

  const graded = quiz.questions.map((q) => {
    const correctOption = q.options.find((o) => o.isCorrect);
    const chosenId = answerMap.get(q.id) ?? null;
    const correct = !!correctOption && chosenId === correctOption.id;
    return { questionId: q.id, correct, correctOptionId: correctOption?.id ?? null };
  });

  const correctCount = graded.filter((r) => r.correct).length;
  const score = Math.round((correctCount / totalQuestions) * 100);
  const passed = score >= quiz.passScore;

  // Withhold the key on a failed attempt: right/wrong per question is enough
  // feedback to study from, and it keeps retries honest.
  const results = graded.map((r) => ({
    questionId: r.questionId,
    correct: r.correct,
    correctOptionId: passed ? r.correctOptionId : null,
  }));

  await prisma.quizAttempt.create({
    data: { quizId: quiz.id, membershipId, score, passed },
  });

  return {
    score,
    passed,
    passScore: quiz.passScore,
    correctCount,
    totalQuestions,
    results,
  };
}
