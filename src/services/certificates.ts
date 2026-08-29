/**
 * Course completion certificates — Online Classes module.
 *
 * A certificate is issued once a student (membership) has completed EVERY
 * lesson of a published course. `studentName` / `courseTitle` are SNAPSHOTS:
 * once issued, the certificate never changes, even if the student renames
 * themselves or the course is retitled.
 *
 * Concurrency: NO interactive prisma.$transaction(async...) — Supabase
 * PgBouncer. Idempotency comes from the @@unique([membershipId, courseId])
 * index: a racing insert is caught and the winning row is returned.
 */

import crypto from "crypto";
import type { CourseCertificate } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ServiceError } from "./types";
import { toWhatsAppPhone } from "@/lib/utils";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendEmail } from "@/lib/email";

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
const SERIAL_LENGTH = 12;

/** Public shape of a certificate for the unauthenticated verification page. */
export interface PublicCertificate {
  serial: string;
  studentName: string;
  courseTitle: string;
  issuedAt: Date;
  businessName: string;
  businessLogo: string | null;
}

// ─── Serial ────────────────────────────────────────────────────────────────

/**
 * Unguessable public handle: 12 uppercase alphanumeric chars (~62 bits).
 * Never a counter — the serial is the only thing protecting /verify/[serial].
 */
function generateSerial(): string {
  let out = "";
  while (out.length < SERIAL_LENGTH) {
    out += crypto
      .randomBytes(12)
      .toString("base64url")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
  }
  return out.slice(0, SERIAL_LENGTH);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function heDate(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

// ─── Issue ─────────────────────────────────────────────────────────────────

/**
 * Issue a completion certificate when the student earned it.
 *
 * Returns the existing certificate when one was already issued (idempotent),
 * a freshly created one when every lesson of the course is complete, or
 * `null` when the course is not fully completed (a course with zero lessons
 * is never earned).
 *
 * Throws ServiceError NOT_FOUND when the course does not belong to the
 * business / is not published, or when the membership does not belong to it.
 */
export async function issueCertificateIfEarned(
  businessId: string,
  membershipId: string,
  courseId: string
): Promise<CourseCertificate | null> {
  const course = await prisma.course.findFirst({
    where: { id: courseId, businessId },
    select: {
      id: true,
      title: true,
      status: true,
      modules: { select: { lessons: { select: { id: true } } } },
    },
  });
  if (!course || course.status !== "published") {
    throw new ServiceError("הקורס לא נמצא", "NOT_FOUND");
  }

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, businessId },
    select: {
      id: true,
      portalUser: { select: { name: true, email: true, phone: true } },
    },
  });
  if (!membership) {
    throw new ServiceError("המנוי לא נמצא", "NOT_FOUND");
  }

  // Already issued → return as-is (snapshot must never change).
  const existing = await prisma.courseCertificate.findUnique({
    where: { membershipId_courseId: { membershipId, courseId } },
  });
  if (existing) return existing;

  const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
  if (lessonIds.length === 0) return null;

  const completedCount = await prisma.lessonProgress.count({
    where: {
      membershipId,
      lessonId: { in: lessonIds },
      completedAt: { not: null },
    },
  });
  if (completedCount < lessonIds.length) return null;

  const certificate = await createCertificate({
    businessId,
    courseId,
    membershipId,
    studentName: membership.portalUser.name,
    courseTitle: course.title,
  });

  // Fire-and-forget notification — never blocks the issue path.
  void notifyStudent({
    email: membership.portalUser.email,
    phone: membership.portalUser.phone,
    studentName: certificate.studentName,
    courseTitle: certificate.courseTitle,
    serial: certificate.serial,
  }).catch(() => {});

  return certificate;
}

/** Insert with a fresh serial; retry once on a serial collision. */
async function createCertificate(data: {
  businessId: string;
  courseId: string;
  membershipId: string;
  studentName: string;
  courseTitle: string;
}): Promise<CourseCertificate> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await prisma.courseCertificate.create({
        data: { ...data, serial: generateSerial() },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Another request issued the same certificate first — that row wins.
      const raced = await prisma.courseCertificate.findUnique({
        where: {
          membershipId_courseId: {
            membershipId: data.membershipId,
            courseId: data.courseId,
          },
        },
      });
      if (raced) return raced;
      // Otherwise it was a serial collision — one more try with a new serial.
      if (attempt === 1) throw error;
    }
  }
  throw new ServiceError("לא ניתן להנפיק תעודה כרגע", "CONFLICT");
}

async function notifyStudent(params: {
  email: string;
  phone: string | null;
  studentName: string;
  courseTitle: string;
  serial: string;
}): Promise<void> {
  const { email, phone, studentName, courseTitle, serial } = params;
  const verifyUrl = `${APP_URL}/verify/${serial}`;

  const tasks: Promise<unknown>[] = [];

  if (email) {
    tasks.push(
      sendEmail({
        to: email,
        subject: `‏קיבלת תעודה על סיום "${courseTitle}"`,
        html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right;">
          <h2>כל הכבוד, ${escapeHtml(studentName)}!</h2>
          <p>סיימת את כל השיעורים בקורס <strong>${escapeHtml(courseTitle)}</strong> וקיבלת תעודת סיום.</p>
          <p><a href="${verifyUrl}">לצפייה בתעודה ולהדפסה</a></p>
          <p style="color:#666;font-size:13px;">מספר תעודה: ${serial}</p>
        </div>`,
      }).catch(() => {})
    );
  }

  if (phone) {
    tasks.push(
      sendWhatsAppMessage({
        to: toWhatsAppPhone(phone),
        body:
          `כל הכבוד ${studentName}! סיימת את הקורס "${courseTitle}" ` +
          `וקיבלת תעודת סיום (${heDate(new Date())}).\n` +
          `לצפייה ולהדפסה: ${verifyUrl}`,
      }).catch(() => {})
    );
  }

  await Promise.all(tasks);
}

// ─── Public verification ───────────────────────────────────────────────────

/**
 * Public lookup for /verify/[serial]. Returns null for unknown serials.
 * Exposes nothing beyond the printed certificate — no ids, no email,
 * no membership data.
 */
export async function getCertificateBySerial(
  serial: string
): Promise<PublicCertificate | null> {
  const clean = (serial || "").trim();
  if (!clean || clean.length > 64) return null;

  const certificate = await prisma.courseCertificate.findUnique({
    where: { serial: clean },
    select: {
      serial: true,
      studentName: true,
      courseTitle: true,
      issuedAt: true,
      businessId: true,
    },
  });
  if (!certificate) return null;

  const [business, branding] = await Promise.all([
    prisma.business.findUnique({
      where: { id: certificate.businessId },
      select: { name: true, logo: true },
    }),
    prisma.brandingSettings.findUnique({
      where: { businessId: certificate.businessId },
      select: { logoUrl: true },
    }),
  ]);

  return {
    serial: certificate.serial,
    studentName: certificate.studentName,
    courseTitle: certificate.courseTitle,
    issuedAt: certificate.issuedAt,
    businessName: business?.name ?? "",
    businessLogo: branding?.logoUrl ?? business?.logo ?? null,
  };
}
