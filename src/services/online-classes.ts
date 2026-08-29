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
import { validateIsraeliPhone, validateSafeUrl } from "@/lib/validation";
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

/**
 * trimOrNull + http/https-only scheme validation. These values render as
 * href/src in the public portal — a stored javascript: URL would execute
 * in members' browsers, so anything else is rejected.
 */
function safeUrlOrNull(
  v: string | null | undefined,
  label: string
): string | null | undefined {
  const t = trimOrNull(v);
  if (t === undefined || t === null) return t;
  const err = validateSafeUrl(t);
  if (err) throw new ServiceError(`${label}: ${err}`, "VALIDATION");
  return t;
}

/** IPv4/IPv6 address or CIDR range (shape check — matching lives in portal-access.ts). */
const IP_RULE_RE = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F:]{2,45})(?:\/\d{1,3})?$/;

const VIDEO_REF_RE = /^[A-Za-z0-9_-]{6,20}$/;
/** YouTube video id only (schema contract) — never a URL or path. */
function videoRefOrNull(
  v: string | null | undefined
): string | null | undefined {
  const t = trimOrNull(v);
  if (t === undefined || t === null) return t;
  if (!VIDEO_REF_RE.test(t)) {
    throw new ServiceError(
      "מזהה סרטון יוטיוב לא תקין — הזינו את המזהה בלבד (למשל dQw4w9WgXcQ)",
      "VALIDATION"
    );
  }
  return t;
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
    maxDevicesPerStudent: number;
    ipRestrictionEnabled: boolean;
    allowedIps: string[];
  }>
) {
  const update: Record<string, unknown> = {};
  if (data.maxDevicesPerStudent !== undefined) {
    const n = Number(data.maxDevicesPerStudent);
    if (!Number.isInteger(n) || n < 0 || n > 10) {
      throw new ServiceError("מספר מכשירים חייב להיות בין 0 ל-10 (0 = ללא הגבלה)", "VALIDATION");
    }
    update.maxDevicesPerStudent = n;
  }
  if (data.ipRestrictionEnabled !== undefined) {
    update.ipRestrictionEnabled = !!data.ipRestrictionEnabled;
  }
  if (data.allowedIps !== undefined) {
    const list = Array.isArray(data.allowedIps) ? data.allowedIps : [];
    const cleaned = list
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);
    if (cleaned.length > 50) {
      throw new ServiceError("ניתן להגדיר עד 50 כתובות IP", "VALIDATION");
    }
    for (const entry of cleaned) {
      if (!IP_RULE_RE.test(entry)) {
        throw new ServiceError(`כתובת IP לא תקינה: ${entry}`, "VALIDATION");
      }
    }
    update.allowedIps = cleaned;
  }
  if (data.logoUrl !== undefined) update.logoUrl = safeUrlOrNull(data.logoUrl, "לוגו");
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
  if (data.paymentLinkUrl !== undefined) update.paymentLinkUrl = safeUrlOrNull(data.paymentLinkUrl, "לינק תשלום");
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
      zoomLink: safeUrlOrNull(data.zoomLink, "קישור זום") ?? null,
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
  if (data.zoomLink !== undefined) update.zoomLink = safeUrlOrNull(data.zoomLink, "קישור זום");

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
  if (existing.portalUser.phone) {
    sendWhatsAppMessage({ to: toWhatsAppPhone(existing.portalUser.phone), body: waBody }).catch(
      () => {}
    );
  }

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
      coverUrl: safeUrlOrNull(data.coverUrl, "תמונת שער") ?? null,
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
  if (data.coverUrl !== undefined) update.coverUrl = safeUrlOrNull(data.coverUrl, "תמונת שער");
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

/**
 * Manually enroll students into a course by email.
 *
 * Access in this product is membership-wide (an active membership opens every
 * published course), so enrolling grants/refreshes the business membership and
 * notifies the student about THIS course with a direct link to it.
 *
 * Email is the identity — name/phone are optional extras used only when the
 * PortalUser does not exist yet. Per-student failures never abort the batch.
 */
export async function enrollStudentsInCourse(
  businessId: string,
  courseId: string,
  students: Array<{ email: string; name?: string | null; phone?: string | null }>,
  opts: { validUntil?: Date | null; paymentNote?: string | null; notify?: boolean } = {}
): Promise<{
  added: Array<{ email: string; name: string; created: boolean; notified: boolean }>;
  skipped: Array<{ email: string; reason: string }>;
}> {
  const course = await prisma.course.findFirst({
    where: { id: courseId, businessId },
    select: { id: true, title: true, status: true },
  });
  if (!course) throw new ServiceError("קורס לא נמצא", "NOT_FOUND");

  if (!Array.isArray(students) || students.length === 0) {
    throw new ServiceError("לא נשלחו תלמידים להוספה", "VALIDATION");
  }
  if (students.length > 200) {
    throw new ServiceError("ניתן להוסיף עד 200 תלמידים בבת אחת", "VALIDATION");
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true, slug: true },
  });
  const portalUrl = portalLink(business?.slug ?? null);
  const courseUrl = portalUrl ? `${portalUrl}/courses/${course.id}` : null;
  const notify = opts.notify !== false;

  const added: Array<{ email: string; name: string; created: boolean; notified: boolean }> = [];
  const skipped: Array<{ email: string; reason: string }> = [];
  const seen = new Set<string>();

  for (const raw of students) {
    const email = (raw?.email || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skipped.push({ email: raw?.email || "—", reason: "כתובת אימייל לא תקינה" });
      continue;
    }
    if (seen.has(email)) continue; // duplicate inside the same batch
    seen.add(email);

    try {
      let portalUser = await prisma.portalUser.findUnique({ where: { email } });
      let created = false;

      if (!portalUser) {
        // Optional phone — validated only when supplied.
        let phone: string | null = null;
        const rawPhone = (raw.phone || "").trim();
        if (rawPhone) {
          const phoneError = validateIsraeliPhone(rawPhone);
          if (phoneError) {
            skipped.push({ email, reason: phoneError });
            continue;
          }
          phone = "+" + toWhatsAppPhone(rawPhone);
          const phoneTaken = await prisma.portalUser.findUnique({ where: { phone } });
          if (phoneTaken) {
            skipped.push({ email, reason: "הטלפון כבר רשום למשתמש אחר" });
            continue;
          }
        }
        portalUser = await prisma.portalUser.create({
          data: { email, name: (raw.name || "").trim() || email.split("@")[0], phone },
        });
        created = true;
      }

      await prisma.membership.upsert({
        where: { portalUserId_businessId: { portalUserId: portalUser.id, businessId } },
        update: {
          status: "active",
          approvedAt: new Date(),
          ...(opts.validUntil !== undefined ? { validUntil: opts.validUntil } : {}),
          ...(opts.paymentNote !== undefined
            ? { paymentNote: trimOrNull(opts.paymentNote) }
            : {}),
        },
        create: {
          portalUserId: portalUser.id,
          businessId,
          status: "active",
          approvedAt: new Date(),
          validUntil: opts.validUntil ?? null,
          paymentNote: trimOrNull(opts.paymentNote) ?? null,
        },
      });

      if (notify) {
        notifyCourseEnrollment({
          name: portalUser.name,
          email: portalUser.email,
          phone: portalUser.phone,
          businessName: business?.name ?? "",
          courseTitle: course.title,
          courseUrl,
          portalUrl,
          isNewUser: created,
        });
      }

      added.push({ email, name: portalUser.name, created, notified: notify });
    } catch (err) {
      console.error("[enrollStudentsInCourse]", email, err);
      skipped.push({ email, reason: "שגיאה בהוספה" });
    }
  }

  return { added, skipped };
}

/** Fire-and-forget enrollment notification: WhatsApp when a phone exists, plus email. */
function notifyCourseEnrollment(p: {
  name: string;
  email: string;
  phone: string | null;
  businessName: string;
  courseTitle: string;
  courseUrl: string | null;
  portalUrl: string | null;
  isNewUser: boolean;
}): void {
  const link = p.courseUrl ?? p.portalUrl;
  const howToEnter = p.isNewUser
    ? `הכניסה עם כתובת האימייל הזו — נשלח אליך קוד חד-פעמי, בלי סיסמאות.`
    : `הכניסה עם כתובת האימייל הזו כרגיל.`;

  if (p.phone) {
    sendWhatsAppMessage({
      to: toWhatsAppPhone(p.phone),
      body:
        `היי ${p.name}, נוספת לקורס "${p.courseTitle}" של ${p.businessName}!` +
        (link ? `\nלצפייה: ${link}` : "") +
        `\n${howToEnter}`,
    }).catch(() => {});
  }

  sendEmail({
    to: p.email,
    subject: `‏נוספת לקורס "${p.courseTitle}"`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right;">
        <h2>נוספת לקורס!</h2>
        <p>היי ${p.name},</p>
        <p>
          ${p.businessName} הוסיף/ה אותך לקורס
          <strong>${p.courseTitle}</strong> בפורטל החברים.
        </p>
        ${link ? `<p><a href="${link}">לצפייה בקורס</a></p>` : ""}
        <p>${howToEnter}</p>
      </div>`,
  }).catch(() => {});
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
    description?: string | null;
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
      description: trimOrNull(data.description) ?? null,
      videoRef: videoRefOrNull(data.videoRef) ?? null,
      fileUrl: safeUrlOrNull(data.fileUrl, "קובץ PDF") ?? null,
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
    description: string | null;
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
  if (data.description !== undefined) update.description = trimOrNull(data.description);
  if (data.videoRef !== undefined) update.videoRef = videoRefOrNull(data.videoRef);
  if (data.fileUrl !== undefined) update.fileUrl = safeUrlOrNull(data.fileUrl, "קובץ PDF");
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
