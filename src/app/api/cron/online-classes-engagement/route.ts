export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { hasFeatureWithOverrides } from "@/lib/feature-flags";
import { sendEmail, brandHeader, brandFooter } from "@/lib/email";
import { toWhatsAppPhone } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://petra-app.com";

/** A course created within this window is still "new" — its lessons are news, not backfill. */
const NEW_COURSE_WINDOW_MS = 7 * DAY_MS;
/** Hard cap on students notified about new lessons in a single run. */
const MAX_ANNOUNCE_RECIPIENTS = 200;
/** Courses inspected per run — keeps the query count bounded on Vercel. */
const MAX_COURSES_PER_RUN = 25;

/** A student is "stalled" when their last touch on a course is older than this… */
const STALL_MIN_MS = 7 * DAY_MS;
/** …but not older than this (past 30 days they moved on — do not nag). */
const STALL_MAX_MS = 30 * DAY_MS;
/** One nudge per membership per this window. */
const NUDGE_THROTTLE_MS = 14 * DAY_MS;
/** Hard cap on nudges sent in a single run. */
const MAX_NUDGES = 200;

// Query bounds — this is a cron on Vercel, not a batch server.
const LESSON_SCAN_LIMIT = 500;
const PROGRESS_SCAN_LIMIT = 1000;
const MEMBERSHIP_SCAN_LIMIT = 300;
const PROGRESS_DETAIL_LIMIT = 3000;
const COURSE_LESSON_LIMIT = 2000;

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

const heDateFormatter = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function heDate(d: Date): string {
  return heDateFormatter.format(d);
}

/** WhatsApp first; email as fallback when the WhatsApp send fails. Fire-and-forget. */
function notifyWithEmailFallback(params: {
  phone: string | null;
  email: string;
  body: string;
  emailSubject: string;
  emailHtml: string;
}): void {
  const sendFallbackEmail = () => {
    sendEmail({ to: params.email, subject: params.emailSubject, html: params.emailHtml })
      .catch(() => {});
  };
  // Email-only students (enrolled by email, no phone on file) go straight to email.
  if (!params.phone) {
    sendFallbackEmail();
    return;
  }
  sendWhatsAppMessage({ to: toWhatsAppPhone(params.phone), body: params.body })
    .then((r) => {
      if (!r.success) sendFallbackEmail();
    })
    .catch(() => sendFallbackEmail());
}

/** A business that lost the online_classes entitlement stops notifying students. */
function isEntitled(business: {
  tier?: string | null;
  featureOverrides?: unknown;
} | null | undefined): boolean {
  if (!business) return false;
  return hasFeatureWithOverrides(
    business.tier ?? null,
    "online_classes",
    (business.featureOverrides as Record<string, boolean> | null) ?? null
  );
}

function wrapEmail(innerHtml: string): string {
  return `
    <div dir="rtl" style="font-family:'Heebo',Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
      ${brandHeader()}
      <div style="padding:32px 24px;">
        ${innerHtml}
      </div>
      ${brandFooter()}
    </div>`;
}

/** null when the business has no portal slug — the message then ships without a link. */
function courseUrl(slug: string | null, courseId: string): string | null {
  return slug ? `${APP_URL}/c/${slug}/courses/${courseId}` : null;
}

function ctaButton(href: string, label: string): string {
  return `
    <p style="text-align:center;margin:24px 0;">
      <a href="${escapeHtml(href)}" style="background:#f97316;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">${label}</a>
    </p>`;
}

type PendingLesson = {
  id: string;
  title: string;
  position: number;
  modulePosition: number;
  courseId: string;
  courseTitle: string;
  courseCreatedAt: Date;
  businessId: string;
  businessName: string;
  businessSlug: string | null;
};

/**
 * GET/POST /api/cron/online-classes-engagement — runs daily.
 *
 * Job 1: announce newly published lessons to the business's active students,
 *        one grouped message per course (a course that gained 6 lessons at once
 *        sends ONE message listing all 6).
 * Job 2: nudge students who completed something in a published course, stalled
 *        7–30 days ago, and have not been nudged in the last 14 days.
 *
 * Both jobs use an atomic updateMany claim (announcedAt / lastNudgeAt marker)
 * for idempotency — no interactive transactions (PgBouncer).
 *
 * NOTE on "new" lessons: the Lesson model has no createdAt column, so lesson age
 * cannot be read directly. The backfill guard works at course level instead: a
 * course older than 7 days that has never had ANY lesson announced is the
 * pre-existing catalog — all its lessons are claimed silently (counted in
 * `skipped`). Once a course has announced lessons, every later unannounced
 * lesson is genuinely new and gets announced. Courses created in the last 7 days
 * announce their initial lessons as news.
 */
async function handle(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    let lessonsAnnounced = 0;
    let recipientsNotified = 0;
    let nudgesSent = 0;
    let skipped = 0;

    // ── Job 1: new lesson announcements ───────────────────────────────────────
    try {
      const pendingRows = await prisma.lesson.findMany({
        where: {
          announcedAt: null,
          // Suspended or downgraded businesses must not keep messaging students.
          module: { course: { status: "published", business: { status: "active" } } },
        },
        select: {
          id: true,
          title: true,
          position: true,
          module: {
            select: {
              position: true,
              course: {
                select: {
                  id: true,
                  title: true,
                  createdAt: true,
                  businessId: true,
                  business: {
                    select: { name: true, slug: true, tier: true, featureOverrides: true },
                  },
                },
              },
            },
          },
        },
        take: LESSON_SCAN_LIMIT,
      });

      const pending: PendingLesson[] = pendingRows
        // Drop businesses that no longer hold the online_classes entitlement.
        .filter((l) => isEntitled(l.module.course.business))
        .map((l) => ({
          id: l.id,
          title: l.title,
          position: l.position,
          modulePosition: l.module.position,
          courseId: l.module.course.id,
          courseTitle: l.module.course.title,
          courseCreatedAt: l.module.course.createdAt,
          businessId: l.module.course.businessId,
          businessName: l.module.course.business.name,
          businessSlug: l.module.course.business.slug,
        }));

      // Group by course so a course that gained several lessons sends ONE message.
      const byCourse = new Map<string, PendingLesson[]>();
      for (const lesson of pending) {
        const list = byCourse.get(lesson.courseId);
        if (list) list.push(lesson);
        else byCourse.set(lesson.courseId, [lesson]);
      }

      let recipientBudget = MAX_ANNOUNCE_RECIPIENTS;
      let coursesProcessed = 0;

      for (const [courseId, lessonsRaw] of byCourse) {
        if (coursesProcessed >= MAX_COURSES_PER_RUN) {
          skipped += lessonsRaw.length;
          console.log(
            `CRON online-classes-engagement: course ${courseId} deferred — course cap reached (${lessonsRaw.length} lessons)`
          );
          continue;
        }
        coursesProcessed++;

        const lessons = [...lessonsRaw].sort(
          (a, b) => a.modulePosition - b.modulePosition || a.position - b.position
        );
        const head = lessons[0];

        // Backfill guard — see the note on this function.
        const isOldCourse =
          now.getTime() - head.courseCreatedAt.getTime() > NEW_COURSE_WINDOW_MS;
        let isBackfill = false;
        if (isOldCourse) {
          const alreadyAnnounced = await prisma.lesson.count({
            where: { module: { courseId }, announcedAt: { not: null } },
          });
          isBackfill = alreadyAnnounced === 0;
        }

        if (isBackfill) {
          // Pre-existing catalog: mark announced WITHOUT sending anything.
          for (const lesson of lessons) {
            const claimed = await prisma.lesson.updateMany({
              where: { id: lesson.id, announcedAt: null },
              data: { announcedAt: new Date() },
            });
            if (claimed.count === 1) skipped++;
          }
          console.log(
            `CRON online-classes-engagement: backfill — silently marked ${lessons.length} lesson(s) of course ${courseId}`
          );
          continue;
        }

        // Recipients: active memberships of the course's business.
        const recipientWhere = {
          businessId: head.businessId,
          status: "active",
          OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        };
        const recipientCount = await prisma.membership.count({ where: recipientWhere });

        if (recipientCount === 0) {
          // Nobody to tell — still claim so we don't rescan these forever.
          for (const lesson of lessons) {
            const claimed = await prisma.lesson.updateMany({
              where: { id: lesson.id, announcedAt: null },
              data: { announcedAt: new Date() },
            });
            if (claimed.count === 1) skipped++;
          }
          continue;
        }

        if (recipientCount > recipientBudget) {
          if (recipientBudget < MAX_ANNOUNCE_RECIPIENTS) {
            // Budget partly spent — leave this course unannounced for the next run.
            skipped += lessons.length;
            console.log(
              `CRON online-classes-engagement: course ${courseId} deferred — needs ${recipientCount} recipients, ${recipientBudget} left in budget`
            );
            continue;
          }
          // Full budget available and the course is still bigger: send to the cap
          // rather than stalling this course forever.
          console.log(
            `CRON online-classes-engagement: course ${courseId} has ${recipientCount} recipients — capping at ${MAX_ANNOUNCE_RECIPIENTS}, ${recipientCount - MAX_ANNOUNCE_RECIPIENTS} not notified`
          );
        }

        // Atomic idempotency claim — only one cron run announces each lesson.
        const claimedLessons: PendingLesson[] = [];
        for (const lesson of lessons) {
          const claimed = await prisma.lesson.updateMany({
            where: { id: lesson.id, announcedAt: null },
            data: { announcedAt: new Date() },
          });
          if (claimed.count === 1) claimedLessons.push(lesson);
        }
        if (claimedLessons.length === 0) continue;
        lessonsAnnounced += claimedLessons.length;

        const take = Math.min(recipientCount, recipientBudget);
        const recipients = await prisma.membership.findMany({
          where: recipientWhere,
          select: { portalUser: { select: { name: true, phone: true, email: true } } },
          take,
        });
        recipientBudget -= recipients.length;

        const url = courseUrl(head.businessSlug, courseId);
        const single = claimedLessons.length === 1;
        const titles = claimedLessons.map((l) => l.title);

        const linkLine = url ? `לצפייה:\n${url}\n` : "";

        const body = single
          ? `שלום! עדכון מ-${head.businessName}:\n` +
            `נוסף שיעור חדש לקורס "${head.courseTitle}":\n` +
            `${titles[0]}\n` +
            linkLine +
            `למידה נעימה! 🐾`
          : `שלום! עדכון מ-${head.businessName}:\n` +
            `נוספו ${claimedLessons.length} שיעורים חדשים לקורס "${head.courseTitle}":\n` +
            titles.map((t) => `• ${t}`).join("\n") +
            `\n` +
            linkLine +
            `למידה נעימה! 🐾`;

        const emailHtml = wrapEmail(`
          <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">${single ? "שיעור חדש בקורס שלכם" : "שיעורים חדשים בקורס שלכם"}</h2>
          <p style="margin:0 0 16px;font-size:14px;color:#475569;">
            ${single ? "נוסף שיעור חדש" : `נוספו ${claimedLessons.length} שיעורים חדשים`} לקורס
            <strong>${escapeHtml(head.courseTitle)}</strong> של ${escapeHtml(head.businessName)}:
          </p>
          <ul style="margin:0 0 16px;padding-inline-start:20px;font-size:14px;color:#0f172a;">
            ${titles.map((t) => `<li style="margin:0 0 6px;">${escapeHtml(t)}</li>`).join("")}
          </ul>
          ${url ? ctaButton(url, "לצפייה בקורס") : ""}`);

        const emailSubject = single
          ? `שיעור חדש בקורס ${head.courseTitle}`
          : `${claimedLessons.length} שיעורים חדשים בקורס ${head.courseTitle}`;

        for (const r of recipients) {
          recipientsNotified++;
          notifyWithEmailFallback({
            phone: r.portalUser.phone,
            email: r.portalUser.email,
            body,
            emailSubject,
            emailHtml,
          });
        }
      }
    } catch (error) {
      console.error("CRON online-classes-engagement job1 (announcements) error:", error);
    }

    // ── Job 2: stalled student nudges ─────────────────────────────────────────
    try {
      const stallFrom = new Date(now.getTime() - STALL_MAX_MS); // 30 days ago
      const stallTo = new Date(now.getTime() - STALL_MIN_MS); //  7 days ago
      const nudgeCutoff = new Date(now.getTime() - NUDGE_THROTTLE_MS);

      // Candidates: progress rows last touched inside the stall window, on a
      // published course, for an active membership that is not throttled.
      const candidates = await prisma.lessonProgress.findMany({
        where: {
          updatedAt: { gte: stallFrom, lte: stallTo },
          membership: {
            status: "active",
            AND: [
              { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
              { OR: [{ lastNudgeAt: null }, { lastNudgeAt: { lt: nudgeCutoff } }] },
            ],
          },
          lesson: {
            module: {
              // Same gate as job 1: suspended businesses stop messaging students.
              course: { status: "published", business: { status: "active" } },
            },
          },
        },
        select: {
          membershipId: true,
          lesson: {
            select: {
              module: {
                select: {
                  course: {
                    select: {
                      id: true,
                      title: true,
                      business: {
                        select: {
                          name: true,
                          slug: true,
                          tier: true,
                          featureOverrides: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: PROGRESS_SCAN_LIMIT,
      });

      if (candidates.length > 0) {
        const courseInfo = new Map<
          string,
          { id: string; title: string; businessName: string; businessSlug: string | null }
        >();
        const candidatePairs = new Set<string>();
        const membershipIdSet = new Set<string>();

        for (const row of candidates) {
          const course = row.lesson.module.course;
          // Skip businesses that lost the online_classes entitlement.
          if (!isEntitled(course.business)) continue;
          if (!courseInfo.has(course.id)) {
            courseInfo.set(course.id, {
              id: course.id,
              title: course.title,
              businessName: course.business.name,
              businessSlug: course.business.slug,
            });
          }
          candidatePairs.add(`${row.membershipId}:${course.id}`);
          membershipIdSet.add(row.membershipId);
        }

        const membershipIds = [...membershipIdSet].slice(0, MEMBERSHIP_SCAN_LIMIT);
        const membershipIdFilter = new Set(membershipIds);
        const courseIds = [...courseInfo.keys()];

        // Full progress picture for those memberships — a completion or a recent
        // touch may sit outside the candidate window.
        const allProgress = await prisma.lessonProgress.findMany({
          where: { membershipId: { in: membershipIds } },
          select: {
            membershipId: true,
            lessonId: true,
            completedAt: true,
            updatedAt: true,
            lesson: { select: { module: { select: { courseId: true } } } },
          },
          // Newest first: if the cap truncates, we keep the rows that prove recent
          // activity — never nudge a student who is in fact still watching.
          orderBy: { updatedAt: "desc" },
          take: PROGRESS_DETAIL_LIMIT,
        });

        // Every lesson of every candidate course, in play order.
        const courseLessons = await prisma.lesson.findMany({
          where: { module: { courseId: { in: courseIds } } },
          select: {
            id: true,
            title: true,
            position: true,
            module: { select: { courseId: true, position: true } },
          },
          take: COURSE_LESSON_LIMIT,
        });

        const lessonsByCourse = new Map<
          string,
          { id: string; title: string; order: number }[]
        >();
        for (const l of courseLessons) {
          const list = lessonsByCourse.get(l.module.courseId) ?? [];
          list.push({
            id: l.id,
            title: l.title,
            order: l.module.position * 100000 + l.position,
          });
          lessonsByCourse.set(l.module.courseId, list);
        }
        for (const list of lessonsByCourse.values()) list.sort((a, b) => a.order - b.order);

        type PairState = {
          membershipId: string;
          courseId: string;
          lastTouched: Date;
          anyCompleted: boolean;
          completedLessonIds: Set<string>;
        };
        const pairs = new Map<string, PairState>();

        for (const p of allProgress) {
          if (!membershipIdFilter.has(p.membershipId)) continue;
          const courseId = p.lesson.module.courseId;
          const key = `${p.membershipId}:${courseId}`;
          if (!candidatePairs.has(key)) continue;
          let state = pairs.get(key);
          if (!state) {
            state = {
              membershipId: p.membershipId,
              courseId,
              lastTouched: p.updatedAt,
              anyCompleted: false,
              completedLessonIds: new Set<string>(),
            };
            pairs.set(key, state);
          }
          if (p.updatedAt > state.lastTouched) state.lastTouched = p.updatedAt;
          if (p.completedAt !== null) {
            state.anyCompleted = true;
            state.completedLessonIds.add(p.lessonId);
          }
        }

        // One nudge per membership — keep the most recently touched qualifying course.
        type Winner = {
          membershipId: string;
          courseId: string;
          lastTouched: Date;
          nextLessonTitle: string;
          remaining: number;
        };
        const winners = new Map<string, Winner>();

        for (const state of pairs.values()) {
          // Must have finished at least one lesson of this course.
          if (!state.anyCompleted) continue;
          // Most recent touch must sit inside 7–30 days — a newer row disqualifies.
          const age = now.getTime() - state.lastTouched.getTime();
          if (age < STALL_MIN_MS || age > STALL_MAX_MS) continue;

          const lessons = lessonsByCourse.get(state.courseId) ?? [];
          if (lessons.length === 0) continue;
          const nextLesson = lessons.find((l) => !state.completedLessonIds.has(l.id));
          // No incomplete lesson left → the course is finished, nothing to nudge.
          if (!nextLesson) continue;
          const remaining = lessons.filter((l) => !state.completedLessonIds.has(l.id)).length;

          const current = winners.get(state.membershipId);
          if (!current || state.lastTouched > current.lastTouched) {
            winners.set(state.membershipId, {
              membershipId: state.membershipId,
              courseId: state.courseId,
              lastTouched: state.lastTouched,
              nextLessonTitle: nextLesson.title,
              remaining,
            });
          }
        }

        const ordered = [...winners.values()].sort(
          (a, b) => b.lastTouched.getTime() - a.lastTouched.getTime()
        );
        const toNudge = ordered.slice(0, MAX_NUDGES);
        if (ordered.length > toNudge.length) {
          skipped += ordered.length - toNudge.length;
          console.log(
            `CRON online-classes-engagement: ${ordered.length - toNudge.length} nudge(s) deferred — per-run cap ${MAX_NUDGES}`
          );
        }

        const students = await prisma.membership.findMany({
          where: { id: { in: toNudge.map((w) => w.membershipId) } },
          select: {
            id: true,
            portalUser: { select: { name: true, phone: true, email: true } },
          },
        });
        const studentById = new Map(students.map((s) => [s.id, s.portalUser]));

        for (const w of toNudge) {
          const student = studentById.get(w.membershipId);
          const course = courseInfo.get(w.courseId);
          if (!student || !course) continue;

          // Atomic idempotency claim — one nudge per membership per 14 days.
          const claimed = await prisma.membership.updateMany({
            where: {
              id: w.membershipId,
              OR: [{ lastNudgeAt: null }, { lastNudgeAt: { lt: nudgeCutoff } }],
            },
            data: { lastNudgeAt: new Date() },
          });
          if (claimed.count !== 1) continue;
          nudgesSent++;

          const url = courseUrl(course.businessSlug, course.id);
          const body =
            `שלום ${student.name},\n` +
            `שמנו לב שלא המשכת בקורס "${course.title}" של ${course.businessName} מאז ${heDate(w.lastTouched)}.\n` +
            `השיעור הבא שמחכה לך: "${w.nextLessonTitle}".\n` +
            `${w.remaining === 1 ? "נשאר שיעור אחד לסיום הקורס" : `נשארו ${w.remaining} שיעורים לסיום הקורס`} — כדאי להמשיך!\n` +
            (url ? `${url}\n` : "") +
            `למידה נעימה! 🐾`;

          const emailHtml = wrapEmail(`
            <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">ממשיכים מאיפה שעצרתם?</h2>
            <p style="margin:0 0 16px;font-size:14px;color:#475569;">
              שלום ${escapeHtml(student.name)}, לא המשכתם בקורס
              <strong>${escapeHtml(course.title)}</strong> של ${escapeHtml(course.businessName)}
              מאז ${heDate(w.lastTouched)}.
            </p>
            <p style="margin:0 0 16px;font-size:14px;color:#0f172a;">
              השיעור הבא שמחכה לכם: <strong>${escapeHtml(w.nextLessonTitle)}</strong>.
              ${w.remaining === 1 ? "נשאר שיעור אחד לסיום הקורס." : `נשארו ${w.remaining} שיעורים לסיום הקורס.`}
            </p>
            ${url ? ctaButton(url, "להמשך הקורס") : ""}`);

          notifyWithEmailFallback({
            phone: student.phone,
            email: student.email,
            body,
            emailSubject: `ממשיכים בקורס ${course.title}?`,
            emailHtml,
          });
        }
      }
    } catch (error) {
      console.error("CRON online-classes-engagement job2 (nudges) error:", error);
    }

    return NextResponse.json({
      ok: true,
      lessonsAnnounced,
      recipientsNotified,
      nudgesSent,
      skipped,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("CRON online-classes-engagement error:", error);
    return NextResponse.json(
      { error: "Failed to process online classes engagement" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
