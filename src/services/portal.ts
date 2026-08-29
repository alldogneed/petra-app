/**
 * Portal service — dog-owner side of the Online Classes module (/c/[slug]).
 *
 * All functions are tenant-scoped: businessId (resolved from the slug by the
 * route via requirePortalAuth) plus the caller's membership context.
 * No Request/Response knowledge. Throws ServiceError on failure.
 *
 * Concurrency: NO interactive prisma.$transaction(async...) — Supabase PgBouncer.
 * Capacity is claimed/released with single atomic raw UPDATEs guarded by
 * `"spotsTaken" < capacity` / GREATEST(...-1, 0).
 */

import prisma from "@/lib/prisma";
import { ServiceError } from "./types";
import { hasFeatureWithOverrides } from "@/lib/feature-flags";
import { toWhatsAppPhone } from "@/lib/utils";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendEmail } from "@/lib/email";
import { getBranding } from "./online-classes";

export { ServiceError };

/** Escape values interpolated into notification HTML (names, titles, notes). */
function escapeHtml(v: string): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://petra-app.com";
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function heDateTime(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// ─── Public branding ───────────────────────────────────────────────────────

/**
 * Public (unauthenticated) portal branding by business slug.
 * Returns null when the slug is unknown, the business is not active, or the
 * business tier lacks the online_classes feature.
 */
export async function getPublicBranding(slug: string) {
  const business = await prisma.business.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      status: true,
      tier: true,
      featureOverrides: true,
    },
  });
  if (!business || business.status !== "active") return null;
  if (
    !hasFeatureWithOverrides(
      business.tier,
      "online_classes",
      business.featureOverrides as Record<string, boolean> | null
    )
  ) {
    return null;
  }

  const branding = await getBranding(business.id);

  return {
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug as string,
      logo: business.logo,
    },
    branding: {
      logoUrl: branding.logoUrl,
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      senderName: branding.senderName,
      paymentLinkUrl: branding.paymentLinkUrl,
      aboutText: branding.aboutText,
    },
  };
}

// ─── Membership ────────────────────────────────────────────────────────────

/**
 * Dog owner asks to join a business's portal. Idempotent: an existing
 * membership (any status) is returned as-is; otherwise a "pending" one is
 * created and the business is notified by email (fire-and-forget).
 */
export async function requestMembership(businessId: string, portalUserId: string) {
  const existing = await prisma.membership.findUnique({
    where: { portalUserId_businessId: { portalUserId, businessId } },
  });
  if (existing) return existing;

  const membership = await prisma.membership.create({
    data: { portalUserId, businessId, status: "pending" },
  });

  // Fire-and-forget: notify the business owner by email.
  void (async () => {
    const [business, portalUser] = await Promise.all([
      prisma.business.findUnique({
        where: { id: businessId },
        select: { name: true, email: true },
      }),
      prisma.portalUser.findUnique({
        where: { id: portalUserId },
        select: { name: true, phone: true, email: true },
      }),
    ]);
    if (!business?.email || !portalUser) return;
    await sendEmail({
      to: business.email,
      subject: "‏בקשת מנוי חדשה בפורטל החברים",
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right;">
          <h2>בקשת מנוי חדשה</h2>
          <p><strong>${escapeHtml(portalUser.name)}</strong> ביקש/ה להצטרף לפורטל של ${escapeHtml(business.name)}.</p>
          <p>${portalUser.phone ? `טלפון: ${escapeHtml(portalUser.phone)}<br/>` : ""}אימייל: ${escapeHtml(portalUser.email)}</p>
          <p><a href="${APP_URL}/online-classes">לאישור הבקשה במערכת פטרה</a></p>
        </div>`,
    });
  })().catch(() => {});

  return membership;
}

// ─── Live classes ──────────────────────────────────────────────────────────

/**
 * Upcoming (and currently in-progress) classes for the portal.
 * zoomLink is exposed ONLY when the caller is registered AND the class starts
 * within the next 2 hours or is currently in progress.
 */
export async function listPortalClasses(businessId: string, membershipId: string | null) {
  const now = new Date();
  // Fetch a little into the past so in-progress classes still show; exact
  // "ended" filtering happens below (durationMin varies per class).
  const fetchFloor = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const classes = await prisma.onlineClass.findMany({
    where: { businessId, startsAt: { gte: fetchFloor } },
    include: {
      registrations: {
        // No membership yet → match nothing (myStatus stays null for all).
        where: { membershipId: membershipId ?? "__none__" },
        select: { status: true },
      },
    },
    orderBy: { startsAt: "asc" },
  });

  return classes
    .filter((cls) => {
      const endsAt = new Date(cls.startsAt.getTime() + cls.durationMin * 60 * 1000);
      return endsAt >= now; // upcoming or in progress
    })
    .map((cls) => {
      const reg = cls.registrations[0];
      const myStatus: "registered" | "waitlist" | null =
        reg && (reg.status === "registered" || reg.status === "waitlist")
          ? (reg.status as "registered" | "waitlist")
          : null;

      const endsAt = new Date(cls.startsAt.getTime() + cls.durationMin * 60 * 1000);
      const zoomVisible =
        myStatus === "registered" &&
        now.getTime() >= cls.startsAt.getTime() - TWO_HOURS_MS &&
        now <= endsAt;

      return {
        id: cls.id,
        title: cls.title,
        description: cls.description,
        instructorName: cls.instructorName,
        startsAt: cls.startsAt,
        durationMin: cls.durationMin,
        capacity: cls.capacity,
        spotsTaken: cls.spotsTaken,
        myStatus,
        zoomLink: zoomVisible ? cls.zoomLink : null,
      };
    });
}

/**
 * Register for a class. Atomic capacity claim via a single raw UPDATE guarded
 * by `"spotsTaken" < capacity` — no interactive transaction (PgBouncer).
 * Full class → waitlist. Re-registering after cancel reuses the same row.
 */
export async function registerForClass(
  businessId: string,
  membershipId: string,
  classId: string
): Promise<{ status: "registered" | "waitlist" }> {
  const cls = await prisma.onlineClass.findFirst({
    where: { id: classId, businessId },
    select: { id: true, startsAt: true },
  });
  if (!cls) throw new ServiceError("שיעור לא נמצא", "NOT_FOUND");
  if (cls.startsAt <= new Date()) {
    throw new ServiceError("השיעור כבר התחיל — לא ניתן להירשם", "VALIDATION");
  }

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, businessId },
    select: { status: true, validUntil: true },
  });
  if (!membership) throw new ServiceError("מנוי לא נמצא", "NOT_FOUND");
  const active =
    membership.status === "active" &&
    (membership.validUntil === null || membership.validUntil >= new Date());
  if (!active) {
    throw new ServiceError("נדרש מנוי פעיל כדי להירשם לשיעור", "UNAUTHORIZED");
  }

  // Acquire the registration row FIRST (atomically), and only then claim a
  // spot. Two concurrent register calls would otherwise both pass a
  // read-then-claim check and double-increment spotsTaken while collapsing
  // into a single registration row (phantom taken spot).
  // Winner = the call that inserts the row, or the one that flips an
  // existing 'cancelled' row (updateMany count===1). Losers return the
  // current status idempotently without touching spotsTaken.
  const inserted: number = await prisma.$executeRaw`
    INSERT INTO "ClassRegistration" ("id", "onlineClassId", "membershipId", "status", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, ${classId}, ${membershipId}, 'waitlist', NOW(), NOW())
    ON CONFLICT ("onlineClassId", "membershipId") DO NOTHING`;

  if (inserted === 0) {
    const revived = await prisma.classRegistration.updateMany({
      where: { onlineClassId: classId, membershipId, status: "cancelled" },
      data: { status: "waitlist" },
    });
    if (revived.count === 0) {
      // Existing live registration — idempotent return.
      const existing = await prisma.classRegistration.findUnique({
        where: { onlineClassId_membershipId: { onlineClassId: classId, membershipId } },
        select: { status: true },
      });
      const s = existing?.status === "registered" ? "registered" : "waitlist";
      return { status: s };
    }
  }

  // We own the (provisional 'waitlist') row — atomic capacity claim.
  const claimed: number = await prisma.$executeRaw`
    UPDATE "OnlineClass" SET "spotsTaken" = "spotsTaken" + 1
    WHERE id = ${classId} AND "businessId" = ${businessId} AND "spotsTaken" < capacity`;
  if (claimed === 1) {
    await prisma.classRegistration.update({
      where: { onlineClassId_membershipId: { onlineClassId: classId, membershipId } },
      data: { status: "registered" },
    });
    return { status: "registered" };
  }
  return { status: "waitlist" };
}

/**
 * Cancel a registration. If a taken spot is released, the oldest waitlisted
 * registration is promoted (atomic claim) and the promoted user gets a
 * fire-and-forget WhatsApp.
 */
export async function cancelRegistration(
  businessId: string,
  membershipId: string,
  classId: string
): Promise<void> {
  const cls = await prisma.onlineClass.findFirst({
    where: { id: classId, businessId },
    select: { id: true, title: true, startsAt: true },
  });
  if (!cls) throw new ServiceError("שיעור לא נמצא", "NOT_FOUND");

  const reg = await prisma.classRegistration.findUnique({
    where: { onlineClassId_membershipId: { onlineClassId: classId, membershipId } },
  });
  if (!reg) throw new ServiceError("לא נמצאה הרשמה לשיעור", "NOT_FOUND");
  if (reg.status === "cancelled") return; // idempotent

  const wasRegistered = reg.status === "registered";
  await prisma.classRegistration.update({
    where: { id: reg.id },
    data: { status: "cancelled" },
  });

  if (!wasRegistered) return; // waitlist cancel frees no spot

  // Release the spot (floor 0).
  await prisma.$executeRaw`
    UPDATE "OnlineClass" SET "spotsTaken" = GREATEST("spotsTaken" - 1, 0)
    WHERE id = ${classId} AND "businessId" = ${businessId}`;

  // Promote the oldest waitlisted registration, if any.
  const next = await prisma.classRegistration.findFirst({
    where: { onlineClassId: classId, status: "waitlist" },
    orderBy: { createdAt: "asc" },
    include: {
      membership: {
        select: { portalUser: { select: { name: true, phone: true } } },
      },
    },
  });
  if (!next) return;

  const claimed: number = await prisma.$executeRaw`
    UPDATE "OnlineClass" SET "spotsTaken" = "spotsTaken" + 1
    WHERE id = ${classId} AND "businessId" = ${businessId} AND "spotsTaken" < capacity`;
  if (claimed !== 1) return; // spot was re-taken concurrently — leave on waitlist

  // Guard against a concurrent promotion/cancel of the same waitlist row.
  const promoted = await prisma.classRegistration.updateMany({
    where: { id: next.id, status: "waitlist" },
    data: { status: "registered" },
  });
  if (promoted.count !== 1) {
    // Row changed under us — give the spot back.
    await prisma.$executeRaw`
      UPDATE "OnlineClass" SET "spotsTaken" = GREATEST("spotsTaken" - 1, 0)
      WHERE id = ${classId} AND "businessId" = ${businessId}`;
    return;
  }

  const user = next.membership.portalUser;
  if (user.phone) {
    sendWhatsAppMessage({
      to: toWhatsAppPhone(user.phone),
      body:
        `היי ${user.name}, התפנה מקום בשיעור "${cls.title}" ` +
        `בתאריך ${heDateTime(cls.startsAt)} — עלית מרשימת ההמתנה ואת/ה רשום/ה! נתראה בשיעור.`,
    }).catch(() => {});
  }
}

// ─── Courses ───────────────────────────────────────────────────────────────

/** Published courses catalog for the portal. */
export async function listPortalCourses(businessId: string, _membershipActive: boolean) {
  const courses = await prisma.course.findMany({
    where: { businessId, status: "published" },
    include: {
      modules: {
        select: { lessons: { select: { isFreePreview: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return courses.map(({ modules, ...course }) => {
    const lessons = modules.flatMap((m) => m.lessons);
    return {
      id: course.id,
      title: course.title,
      description: course.description,
      coverUrl: course.coverUrl,
      lessonCount: lessons.length,
      hasFreePreview: lessons.some((l) => l.isFreePreview),
    };
  });
}

/**
 * Full course tree for the portal player. Draft (or foreign) course → null.
 * Without an active membership, non-free-preview lessons keep their metadata
 * but the content fields (videoRef/fileUrl/textContent) are stripped and the
 * lesson is flagged `locked: true`.
 * Includes `myProgress`: completed lesson ids for the given membership.
 */
export async function getPortalCourse(
  businessId: string,
  courseId: string,
  membershipId: string | null,
  membershipActive: boolean
) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, businessId, status: "published" },
    include: {
      modules: {
        orderBy: { position: "asc" },
        include: {
          lessons: { orderBy: { position: "asc" } },
          quiz: { select: { id: true, title: true, passScore: true } },
        },
      },
    },
  });
  if (!course) return null;

  const progressRows = membershipId
    ? await prisma.lessonProgress.findMany({
        where: { membershipId, lesson: { module: { courseId } } },
        select: { lessonId: true, percent: true, completedAt: true },
      })
    : [];
  // myProgress stays "completed lesson ids" — partially-watched lessons live in
  // progressDetail so the player can resume and show a per-lesson percentage.
  const myProgress = progressRows.filter((p) => p.completedAt !== null).map((p) => p.lessonId);
  const progressDetail = progressRows.map((p) => ({
    lessonId: p.lessonId,
    percent: p.percent,
    completedAt: p.completedAt,
  }));

  return {
    ...course,
    modules: course.modules.map((mod) => ({
      ...mod,
      lessons: mod.lessons.map((lesson) => {
        const unlocked = membershipActive || lesson.isFreePreview;
        return {
          ...lesson,
          videoRef: unlocked ? lesson.videoRef : null,
          fileUrl: unlocked ? lesson.fileUrl : null,
          textContent: unlocked ? lesson.textContent : null,
          locked: !unlocked,
        };
      }),
    })),
    myProgress,
    progressDetail,
  };
}

/** Mark a lesson as completed (idempotent upsert on membership+lesson). */
export async function markLessonComplete(
  businessId: string,
  membershipId: string,
  lessonId: string
): Promise<void> {
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, businessId },
    select: { id: true },
  });
  if (!membership) throw new ServiceError("מנוי לא נמצא", "NOT_FOUND");

  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      module: { course: { businessId, status: "published" } },
    },
    select: { id: true, type: true, videoRef: true },
  });
  if (!lesson) throw new ServiceError("שיעור לא נמצא", "NOT_FOUND");

  // Video lessons are completed by watching them (recordLessonProgress), never
  // by asking. Without this the whole watch gate is one POST away from bypass.
  if (lesson.type === "video" && lesson.videoRef) {
    throw new ServiceError(
      "שיעור וידאו מסומן כהושלם לפי צפייה בפועל",
      "VALIDATION"
    );
  }

  await prisma.lessonProgress.upsert({
    where: { membershipId_lessonId: { membershipId, lessonId } },
    update: { completedAt: new Date(), percent: 100 },
    create: { membershipId, lessonId, completedAt: new Date(), percent: 100 },
  });
}

/**
 * A video lesson is only "done" once the student has actually covered this much
 * of it. The client reports distinct watched seconds (seeking to the end does
 * not count), so this is real coverage, not furthest position.
 * Slightly under 100% so trailing credits / rounding don't strand a lesson.
 */
export const COMPLETE_AT_PERCENT = 95;

/**
 * Anti-cheat budget (see recordLessonProgress). Two independent limits:
 *  · per-report growth cannot outrun the wall clock, and
 *  · completion cannot happen before the lesson could physically have been
 *    watched, measured from the FIRST report on that lesson.
 * Without the second limit a single fabricated request completed any lesson
 * shorter than the first-report grant.
 */
const PLAYBACK_RATE_SLACK = 2.2; // YouTube tops out at 2x — plus jitter
const REPORT_GRACE_SEC = 30; // absorbs throttling and a late final beacon
const FIRST_REPORT_GRANT_SEC = 45; // small credit for the very first report

/**
 * Record watch progress for a video lesson and auto-complete it at
 * COMPLETE_AT_PERCENT. Monotonic: a later, smaller report never lowers the
 * stored coverage, and a completed lesson stays completed.
 */
export async function recordLessonProgress(
  businessId: string,
  membershipId: string,
  lessonId: string,
  data: { watchedSeconds: number; durationSeconds: number }
): Promise<{ percent: number; completed: boolean; watchedSeconds: number }> {
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, businessId },
    select: { id: true },
  });
  if (!membership) throw new ServiceError("מנוי לא נמצא", "NOT_FOUND");

  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      module: { course: { businessId, status: "published" } },
    },
    select: { id: true, durationMin: true },
  });
  if (!lesson) throw new ServiceError("שיעור לא נמצא", "NOT_FOUND");

  const clientDuration = Number(data.durationSeconds);
  const watchedRaw = Number(data.watchedSeconds);
  if (!Number.isFinite(clientDuration) || clientDuration <= 0) {
    throw new ServiceError("משך הסרטון לא תקין", "VALIDATION");
  }
  if (!Number.isFinite(watchedRaw) || watchedRaw < 0) {
    throw new ServiceError("נתוני צפייה לא תקינים", "VALIDATION");
  }

  // The client cannot be the source of truth for the denominator — otherwise
  // {watchedSeconds:1, durationSeconds:1} would complete any lesson. Prefer the
  // duration the business entered; fall back to the reported one only when the
  // lesson has none on file.
  const duration =
    lesson.durationMin && lesson.durationMin > 0
      ? lesson.durationMin * 60
      : Math.round(clientDuration);
  const watched = Math.min(Math.round(watchedRaw), duration);

  const existing = await prisma.lessonProgress.findUnique({
    where: { membershipId_lessonId: { membershipId, lessonId } },
    select: {
      percent: true,
      watchedSeconds: true,
      completedAt: true,
      updatedAt: true,
      startedAt: true,
    },
  });

  // Watching takes real time: coverage cannot grow faster than the wall clock
  // between two reports. This is what stops a scripted "watched the whole thing"
  // POST, independently of the duration source.
  const now = new Date();
  const prevWatched = existing?.watchedSeconds ?? 0;
  const maxGain = existing
    ? Math.ceil(
        Math.max(0, (now.getTime() - existing.updatedAt.getTime()) / 1000) *
          PLAYBACK_RATE_SLACK
      ) + REPORT_GRACE_SEC
    : FIRST_REPORT_GRANT_SEC;
  const cappedWatched = Math.min(watched, prevWatched + maxGain);

  const bestWatched = Math.max(cappedWatched, prevWatched);
  const startedAt = existing?.startedAt ?? now;

  // Second gate: even at maximum playback speed the lesson cannot be finished
  // before this much real time has passed since the first report.
  const sinceStartSec = (now.getTime() - startedAt.getTime()) / 1000;
  const earliestFinishSec = duration / PLAYBACK_RATE_SLACK;
  const longEnough = sinceStartSec + REPORT_GRACE_SEC >= earliestFinishSec;
  const rawPercent = Math.round((bestWatched / duration) * 100);
  const percent = Math.min(100, Math.max(rawPercent, existing?.percent ?? 0));
  const completed = percent >= COMPLETE_AT_PERCENT && longEnough;
  const completedAt = existing?.completedAt ?? (completed ? now : null);

  await prisma.lessonProgress.upsert({
    where: { membershipId_lessonId: { membershipId, lessonId } },
    update: { percent, watchedSeconds: bestWatched, completedAt, startedAt },
    create: {
      membershipId,
      lessonId,
      percent,
      watchedSeconds: bestWatched,
      completedAt,
      startedAt,
    },
  });

  return { percent, completed: completedAt !== null, watchedSeconds: bestWatched };
}
