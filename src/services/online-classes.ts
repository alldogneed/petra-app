/**
 * Online Classes service — admin side (business owner).
 *
 * Branding, live Zoom classes, memberships, recorded courses (modules/lessons).
 * All functions are business-scoped (businessId first param).
 * No Request/Response knowledge. Throws ServiceError on failure.
 *
 * Concurrency: NO interactive prisma.$transaction(async...) — Supabase PgBouncer
 * (transaction pooling) is incompatible. Batch $transaction([...]) is allowed.
 * OnlineClass.spotsTaken is only ever touched via atomic raw UPDATEs (see portal.ts).
 */

import prisma from "@/lib/prisma";
import { ServiceError } from "./types";
import { validateIsraeliPhone } from "@/lib/validation";
import { toWhatsAppPhone } from "@/lib/utils";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendEmail } from "@/lib/email";

export { ServiceError };

// ─── Shared helpers ────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://petra-app.com";

export const MEMBERSHIP_STATUSES = ["pending", "active", "expired", "suspended"] as const;
export const COURSE_STATUSES = ["draft", "published"] as const;
export const LESSON_TYPES = ["video", "pdf", "text"] as const;

function portalLink(slug: string | null): string | null {
  return slug ? `${APP_URL}/c/${slug}` : null;
}

function trimOrNull(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

// ─── Branding ──────────────────────────────────────────────────────────────

/** Upsert-on-read: creates the row with defaults on first access. */
export async function getBranding(businessId: string) {
  return prisma.brandingSettings.upsert({
    where: { businessId },
    update: {},
    create: { businessId },
  });
}

export async function updateBranding(
  businessId: string,
  data: Partial<{
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string | null;
    senderName: string | null;
    paymentLinkUrl: string | null;
    aboutText: string | null;
  }>
) {
  const update: Record<string, unknown> = {};
  if (data.logoUrl !== undefined) update.logoUrl = trimOrNull(data.logoUrl);
  if (data.primaryColor !== undefined) {
    const color = (data.primaryColor || "").trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      throw new ServiceError("צבע ראשי לא תקין — נדרש פורמט hex (למשל ‎#F97316)", "VALIDATION");
    }
    update.primaryColor = color;
  }
  if (data.secondaryColor !== undefined) {
    const color = trimOrNull(data.secondaryColor);
    if (color != null && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      throw new ServiceError("צבע משני לא תקין — נדרש פורמט hex", "VALIDATION");
    }
    update.secondaryColor = color;
  }
  if (data.senderName !== undefined) update.senderName = trimOrNull(data.senderName);
  if (data.paymentLinkUrl !== undefined) update.paymentLinkUrl = trimOrNull(data.paymentLinkUrl);
  if (data.aboutText !== undefined) update.aboutText = trimOrNull(data.aboutText);

  return prisma.brandingSettings.upsert({
    where: { businessId },
    update,
    create: { businessId, ...update },
  });
}

// ─── Live classes ──────────────────────────────────────────────────────────

export type OnlineClassWithCounts = Awaited<ReturnType<typeof listClasses>>[number];

export async function listClasses(
  businessId: string,
  opts: { from?: Date; includePast?: boolean } = {}
) {
  const now = new Date();
  const classes = await prisma.onlineClass.findMany({
    where: {
      businessId,
      ...(opts.includePast
        ? opts.from
          ? { startsAt: { gte: opts.from } }
          : {}
        : { startsAt: { gte: opts.from ?? now } }),
    },
    include: {
      registrations: { select: { status: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  return classes.map(({ registrations, ...cls }) => ({
    ...cls,
    registeredCount: registrations.filter((r) => r.status === "registered").length,
    waitlistCount: registrations.filter((r) => r.status === "waitlist").length,
  }));
}

export async function createClass(
  businessId: string,
  data: {
    title: string;
    description?: string | null;
    instructorName?: string | null;
    startsAt: Date;
    durationMin?: number;
    capacity: number;
    zoomLink?: string | null;
  }
) {
  const title = (data.title || "").trim();
  if (!title) throw new ServiceError("נדרשת כותרת לשיעור", "VALIDATION");
  if (!(data.startsAt instanceof Date) || isNaN(data.startsAt.getTime())) {
    throw new ServiceError("מועד השיעור לא תקין", "VALIDATION");
  }
  if (!Number.isInteger(data.capacity) || data.capacity < 1) {
    throw new ServiceError("קיבולת השיעור חייבת להיות מספר שלם חיובי", "VALIDATION");
  }
  if (data.durationMin !== undefined && (!Number.isInteger(data.durationMin) || data.durationMin < 1)) {
    throw new ServiceError("משך השיעור לא תקין", "VALIDATION");
  }

  return prisma.onlineClass.create({
    data: {
      businessId,
      title,
      description: trimOrNull(data.description) ?? null,
      instructorName: trimOrNull(data.instructorName) ?? null,
      startsAt: data.startsAt,
      durationMin: data.durationMin ?? 60,
      capacity: data.capacity,
      zoomLink: trimOrNull(data.zoomLink) ?? null,
    },
  });
}

export async function updateClass(
  businessId: string,
  classId: string,
  data: Partial<{
    title: string;
    description: string | null;
    instructorName: string | null;
    startsAt: Date;
    durationMin: number;
    capacity: number;
    zoomLink: string | null;
  }>
) {
  const existing = await prisma.onlineClass.findFirst({ where: { id: classId, businessId } });
  if (!existing) throw new ServiceError("שיעור לא נמצא", "NOT_FOUND");

  const update: Record<string, unknown> = {};
  if (data.title !== undefined) {
    const title = data.title.trim();
    if (!title) throw new ServiceError("נדרשת כותרת לשיעור", "VALIDATION");
    update.title = title;
  }
  if (data.description !== undefined) update.description = trimOrNull(data.description);
  if (data.instructorName !== undefined) update.instructorName = trimOrNull(data.instructorName);
  if (data.startsAt !== undefined) {
    if (!(data.startsAt instanceof Date) || isNaN(data.startsAt.getTime())) {
      throw new ServiceError("מועד השיעור לא תקין", "VALIDATION");
    }
    update.startsAt = data.startsAt;
  }
  if (data.durationMin !== undefined) {
    if (!Number.isInteger(data.durationMin) || data.durationMin < 1) {
      throw new ServiceError("משך השיעור לא תקין", "VALIDATION");
    }
    update.durationMin = data.durationMin;
  }
  if (data.capacity !== undefined) {
    if (!Number.isInteger(data.capacity) || data.capacity < 1) {
      throw new ServiceError("קיבולת השיעור חייבת להיות מספר שלם חיובי", "VALIDATION");
    }
    if (data.capacity < existing.spotsTaken) {
      throw new ServiceError(
        `לא ניתן להקטין את הקיבולת מתחת למספר הנרשמים הנוכחי (${existing.spotsTaken})`,
        "VALIDATION"
      );
    }
    update.capacity = data.capacity;
  }
  if (data.zoomLink !== undefined) update.zoomLink = trimOrNull(data.zoomLink);

  return prisma.onlineClass.update({ where: { id: classId }, data: update });
}

/** Only future classes can be deleted; registrations cascade at the DB level. */
export async function deleteClass(businessId: string, classId: string): Promise<void> {
  const existing = await prisma.onlineClass.findFirst({ where: { id: classId, businessId } });
  if (!existing) throw new ServiceError("שיעור לא נמצא", "NOT_FOUND");
  if (existing.startsAt <= new Date()) {
    throw new ServiceError("לא ניתן למחוק שיעור שכבר התקיים או התחיל", "VALIDATION");
  }
  await prisma.onlineClass.delete({ where: { id: classId } });
}

export async function listRegistrations(businessId: string, classId: string) {
  const cls = await prisma.onlineClass.findFirst({
    where: { id: classId, businessId },
    select: { id: true },
  });
  if (!cls) throw new ServiceError("שיעור לא נמצא", "NOT_FOUND");

  const regs = await prisma.classRegistration.findMany({
    where: { onlineClassId: classId },
    include: {
      membership: {
        select: { portalUser: { select: { name: true, phone: true, email: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return regs.map((r) => ({
    id: r.id,
    status: r.status,
    createdAt: r.createdAt,
    portalUser: r.membership.portalUser,
  }));
}

// ─── Memberships ───────────────────────────────────────────────────────────

export async function listMemberships(businessId: string, opts: { status?: string } = {}) {
  return prisma.membership.findMany({
    where: {
      businessId,
      ...(opts.status ? { status: opts.status } : {}),
    },
    include: {
      portalUser: { select: { name: true, phone: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Approve a pending membership: status → active, approvedAt now.
 * Fire-and-forget notify (WhatsApp free-form + email) with the portal link.
 */
export async function approveMembership(
  businessId: string,
  membershipId: string,
  data: { validUntil?: Date | null; paymentNote?: string } = {}
) {
  const existing = await prisma.membership.findFirst({
    where: { id: membershipId, businessId },
    include: {
      portalUser: { select: { name: true, phone: true, email: true } },
      business: { select: { name: true, slug: true } },
    },
  });
  if (!existing) throw new ServiceError("מנוי לא נמצא", "NOT_FOUND");

  const updated = await prisma.membership.update({
    where: { id: membershipId },
    data: {
      status: "active",
      approvedAt: new Date(),
      ...(data.validUntil !== undefined ? { validUntil: data.validUntil } : {}),
      ...(data.paymentNote !== undefined ? { paymentNote: trimOrNull(data.paymentNote) } : {}),
    },
  });

  // Fire-and-forget notifications — never block/fail the approval.
  const link = portalLink(existing.business.slug);
  const businessName = existing.business.name;
  const userName = existing.portalUser.name;

  const waBody =
    `היי ${userName}, המנוי שלך אצל ${businessName} אושר ופעיל!` +
    (link ? `\nאפשר להיכנס לפורטל כאן: ${link}` : "");
  sendWhatsAppMessage({ to: toWhatsAppPhone(existing.portalUser.phone), body: waBody }).catch(
    () => {}
  );

  sendEmail({
    to: existing.portalUser.email,
    subject: `‏המנוי שלך אצל ${businessName} אושר`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right;">
        <h2>המנוי שלך פעיל!</h2>
        <p>היי ${userName},</p>
        <p>המנוי שלך אצל <strong>${businessName}</strong> אושר והוא פעיל מעכשיו.</p>
        ${link ? `<p><a href="${link}">כניסה לפורטל החברים</a></p>` : ""}
        <p>נתראה בשיעורים!</p>
      </div>`,
  }).catch(() => {});

  return updated;
}

export async function updateMembership(
  businessId: string,
  membershipId: string,
  data: Partial<{ status: string; validUntil: Date | null; paymentNote: string | null }>
) {
  const existing = await prisma.membership.findFirst({
    where: { id: membershipId, businessId },
    select: { id: true },
  });
  if (!existing) throw new ServiceError("מנוי לא נמצא", "NOT_FOUND");

  if (data.status !== undefined && !MEMBERSHIP_STATUSES.includes(data.status as never)) {
    throw new ServiceError("סטטוס מנוי לא תקין", "VALIDATION");
  }
  if (
    data.validUntil !== undefined &&
    data.validUntil !== null &&
    (!(data.validUntil instanceof Date) || isNaN(data.validUntil.getTime()))
  ) {
    throw new ServiceError("תאריך תוקף לא תקין", "VALIDATION");
  }

  return prisma.membership.update({
    where: { id: membershipId },
    data: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.validUntil !== undefined ? { validUntil: data.validUntil } : {}),
      ...(data.paymentNote !== undefined ? { paymentNote: trimOrNull(data.paymentNote) } : {}),
    },
  });
}

/**
 * Manual add by the business owner: find-or-create the global PortalUser
 * (by email, falling back to phone), then create/activate the membership
 * immediately (status "active", approvedAt now).
 */
export async function createManualMembership(
  businessId: string,
  data: {
    name: string;
    phone: string;
    email: string;
    validUntil?: Date | null;
    paymentNote?: string;
  }
) {
  const name = (data.name || "").trim();
  if (!name) throw new ServiceError("נדרש שם", "VALIDATION");

  const email = (data.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ServiceError("כתובת אימייל לא תקינה", "VALIDATION");
  }

  const phoneError = validateIsraeliPhone(data.phone || "");
  if (phoneError) throw new ServiceError(phoneError, "VALIDATION");
  const phone = "+" + toWhatsAppPhone(data.phone);

  // Find-or-create the global PortalUser — email first, then phone.
  let portalUser =
    (await prisma.portalUser.findUnique({ where: { email } })) ??
    (await prisma.portalUser.findUnique({ where: { phone } }));

  if (!portalUser) {
    portalUser = await prisma.portalUser.create({ data: { name, phone, email } });
  }
  // Existing user: reuse as-is (name/phone/email are the user's own identity).

  const membershipData = {
    status: "active" as const,
    approvedAt: new Date(),
    validUntil: data.validUntil ?? null,
    paymentNote: trimOrNull(data.paymentNote) ?? null,
  };

  return prisma.membership.upsert({
    where: { portalUserId_businessId: { portalUserId: portalUser.id, businessId } },
    update: membershipData,
    create: { portalUserId: portalUser.id, businessId, ...membershipData },
  });
}

// ─── Courses ───────────────────────────────────────────────────────────────

export async function listCourses(businessId: string) {
  const courses = await prisma.course.findMany({
    where: { businessId },
    include: {
      modules: { select: { _count: { select: { lessons: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return courses.map(({ modules, ...course }) => ({
    ...course,
    moduleCount: modules.length,
    lessonCount: modules.reduce((sum, m) => sum + m._count.lessons, 0),
  }));
}

export async function createCourse(
  businessId: string,
  data: { title: string; description?: string | null; coverUrl?: string | null }
) {
  const title = (data.title || "").trim();
  if (!title) throw new ServiceError("נדרשת כותרת לקורס", "VALIDATION");

  return prisma.course.create({
    data: {
      businessId,
      title,
      description: trimOrNull(data.description) ?? null,
      coverUrl: trimOrNull(data.coverUrl) ?? null,
    },
  });
}

export async function updateCourse(
  businessId: string,
  courseId: string,
  data: Partial<{
    title: string;
    description: string | null;
    coverUrl: string | null;
    status: string;
  }>
) {
  const existing = await prisma.course.findFirst({
    where: { id: courseId, businessId },
    select: { id: true },
  });
  if (!existing) throw new ServiceError("קורס לא נמצא", "NOT_FOUND");

  const update: Record<string, unknown> = {};
  if (data.title !== undefined) {
    const title = data.title.trim();
    if (!title) throw new ServiceError("נדרשת כותרת לקורס", "VALIDATION");
    update.title = title;
  }
  if (data.description !== undefined) update.description = trimOrNull(data.description);
  if (data.coverUrl !== undefined) update.coverUrl = trimOrNull(data.coverUrl);
  if (data.status !== undefined) {
    if (!COURSE_STATUSES.includes(data.status as never)) {
      throw new ServiceError("סטטוס קורס לא תקין", "VALIDATION");
    }
    update.status = data.status;
  }

  return prisma.course.update({ where: { id: courseId }, data: update });
}

export async function deleteCourse(businessId: string, courseId: string): Promise<void> {
  const existing = await prisma.course.findFirst({
    where: { id: courseId, businessId },
    select: { id: true },
  });
  if (!existing) throw new ServiceError("קורס לא נמצא", "NOT_FOUND");
  await prisma.course.delete({ where: { id: courseId } });
}

/** Full course tree, modules + lessons ordered by position. */
export async function getCourseTree(businessId: string, courseId: string) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, businessId },
    include: {
      modules: {
        orderBy: { position: "asc" },
        include: { lessons: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!course) throw new ServiceError("קורס לא נמצא", "NOT_FOUND");
  return course;
}

export async function createModule(businessId: string, courseId: string, data: { title: string }) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, businessId },
    select: { id: true },
  });
  if (!course) throw new ServiceError("קורס לא נמצא", "NOT_FOUND");

  const title = (data.title || "").trim();
  if (!title) throw new ServiceError("נדרשת כותרת לפרק", "VALIDATION");

  const agg = await prisma.courseModule.aggregate({
    where: { courseId },
    _max: { position: true },
  });

  return prisma.courseModule.create({
    data: { courseId, title, position: (agg._max.position ?? 0) + 10 },
  });
}

export async function updateModule(
  businessId: string,
  moduleId: string,
  data: { title?: string }
) {
  const existing = await prisma.courseModule.findFirst({
    where: { id: moduleId, course: { businessId } },
    select: { id: true },
  });
  if (!existing) throw new ServiceError("פרק לא נמצא", "NOT_FOUND");

  const update: Record<string, unknown> = {};
  if (data.title !== undefined) {
    const title = data.title.trim();
    if (!title) throw new ServiceError("נדרשת כותרת לפרק", "VALIDATION");
    update.title = title;
  }

  return prisma.courseModule.update({ where: { id: moduleId }, data: update });
}

export async function deleteModule(businessId: string, moduleId: string): Promise<void> {
  const existing = await prisma.courseModule.findFirst({
    where: { id: moduleId, course: { businessId } },
    select: { id: true },
  });
  if (!existing) throw new ServiceError("פרק לא נמצא", "NOT_FOUND");
  await prisma.courseModule.delete({ where: { id: moduleId } });
}

export async function createLesson(
  businessId: string,
  moduleId: string,
  data: {
    title: string;
    type?: string;
    videoRef?: string | null;
    fileUrl?: string | null;
    textContent?: string | null;
    durationMin?: number | null;
    isFreePreview?: boolean;
  }
) {
  const mod = await prisma.courseModule.findFirst({
    where: { id: moduleId, course: { businessId } },
    select: { id: true },
  });
  if (!mod) throw new ServiceError("פרק לא נמצא", "NOT_FOUND");

  const title = (data.title || "").trim();
  if (!title) throw new ServiceError("נדרשת כותרת לשיעור", "VALIDATION");
  if (data.type !== undefined && !LESSON_TYPES.includes(data.type as never)) {
    throw new ServiceError("סוג שיעור לא תקין", "VALIDATION");
  }

  const agg = await prisma.lesson.aggregate({
    where: { moduleId },
    _max: { position: true },
  });

  return prisma.lesson.create({
    data: {
      moduleId,
      title,
      position: (agg._max.position ?? 0) + 10,
      type: data.type ?? "video",
      videoRef: trimOrNull(data.videoRef) ?? null,
      fileUrl: trimOrNull(data.fileUrl) ?? null,
      textContent: data.textContent ?? null,
      durationMin: data.durationMin ?? null,
      isFreePreview: data.isFreePreview ?? false,
    },
  });
}

export async function updateLesson(
  businessId: string,
  lessonId: string,
  data: Partial<{
    title: string;
    type: string;
    videoRef: string | null;
    fileUrl: string | null;
    textContent: string | null;
    durationMin: number | null;
    isFreePreview: boolean;
  }>
) {
  const existing = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { course: { businessId } } },
    select: { id: true },
  });
  if (!existing) throw new ServiceError("שיעור לא נמצא", "NOT_FOUND");

  const update: Record<string, unknown> = {};
  if (data.title !== undefined) {
    const title = data.title.trim();
    if (!title) throw new ServiceError("נדרשת כותרת לשיעור", "VALIDATION");
    update.title = title;
  }
  if (data.type !== undefined) {
    if (!LESSON_TYPES.includes(data.type as never)) {
      throw new ServiceError("סוג שיעור לא תקין", "VALIDATION");
    }
    update.type = data.type;
  }
  if (data.videoRef !== undefined) update.videoRef = trimOrNull(data.videoRef);
  if (data.fileUrl !== undefined) update.fileUrl = trimOrNull(data.fileUrl);
  if (data.textContent !== undefined) update.textContent = data.textContent;
  if (data.durationMin !== undefined) update.durationMin = data.durationMin;
  if (data.isFreePreview !== undefined) update.isFreePreview = data.isFreePreview;

  return prisma.lesson.update({ where: { id: lessonId }, data: update });
}

export async function deleteLesson(businessId: string, lessonId: string): Promise<void> {
  const existing = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { course: { businessId } } },
    select: { id: true },
  });
  if (!existing) throw new ServiceError("שיעור לא נמצא", "NOT_FOUND");
  await prisma.lesson.delete({ where: { id: lessonId } });
}

/** Rewrite positions as 10, 20, 30… in the given order. Batch tx (no interactive tx). */
export async function reorderModules(
  businessId: string,
  courseId: string,
  orderedIds: string[]
): Promise<void> {
  const course = await prisma.course.findFirst({
    where: { id: courseId, businessId },
    select: { id: true },
  });
  if (!course) throw new ServiceError("קורס לא נמצא", "NOT_FOUND");

  const owned = await prisma.courseModule.findMany({
    where: { courseId, id: { in: orderedIds } },
    select: { id: true },
  });
  if (owned.length !== orderedIds.length || new Set(orderedIds).size !== orderedIds.length) {
    throw new ServiceError("רשימת הפרקים לא תקינה", "VALIDATION");
  }

  await prisma.$transaction(
    orderedIds.map((id, i) =>
      prisma.courseModule.update({ where: { id }, data: { position: (i + 1) * 10 } })
    )
  );
}

/** Rewrite lesson positions as 10, 20, 30… in the given order. Batch tx. */
export async function reorderLessons(
  businessId: string,
  moduleId: string,
  orderedIds: string[]
): Promise<void> {
  const mod = await prisma.courseModule.findFirst({
    where: { id: moduleId, course: { businessId } },
    select: { id: true },
  });
  if (!mod) throw new ServiceError("פרק לא נמצא", "NOT_FOUND");

  const owned = await prisma.lesson.findMany({
    where: { moduleId, id: { in: orderedIds } },
    select: { id: true },
  });
  if (owned.length !== orderedIds.length || new Set(orderedIds).size !== orderedIds.length) {
    throw new ServiceError("רשימת השיעורים לא תקינה", "VALIDATION");
  }

  await prisma.$transaction(
    orderedIds.map((id, i) =>
      prisma.lesson.update({ where: { id }, data: { position: (i + 1) * 10 } })
    )
  );
}
