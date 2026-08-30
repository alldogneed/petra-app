/**
 * Certificate management — owner-facing admin operations for the Online
 * Classes module. Complements src/services/certificates.ts (the automatic,
 * student-earned issuing path) with the manual issue / revoke / restore /
 * list operations the business owner drives from the dashboard.
 *
 * Every query is scoped by businessId (IDOR guard). No interactive
 * prisma.$transaction(async...) — Supabase PgBouncer.
 *
 * Serial generation mirrors certificates.ts (crypto.randomBytes base64url,
 * uppercased alnum, retry once on collision). That file keeps its helpers
 * private, so the approach is replicated here rather than imported.
 */

import crypto from "crypto";
import type { CourseCertificate } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ServiceError } from "./types";
import { toWhatsAppPhone } from "@/lib/utils";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendEmail } from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://petra-app.com";
const SERIAL_LENGTH = 12;

/** Escape values interpolated into notification HTML (names, titles). */
function escapeHtml(v: string): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function heDate(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Unguessable public handle: 12 uppercase alphanumeric chars (~62 bits).
 * The serial is the only thing protecting /verify/[serial] — never a counter.
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

// ─── List ────────────────────────────────────────────────────────────────

export interface CertificateAdminRow {
  id: string;
  serial: string;
  studentName: string;
  courseTitle: string;
  issuedAt: Date;
  issuedManually: boolean;
  revokedAt: Date | null;
  courseId: string;
  membershipId: string;
  student: { name: string; email: string };
}

/**
 * List certificates for a business, newest first. Revoked certificates are
 * excluded unless `includeRevoked` is set. Optionally scoped to one course.
 */
export async function listCertificates(
  businessId: string,
  opts?: { courseId?: string; includeRevoked?: boolean }
): Promise<CertificateAdminRow[]> {
  const rows = await prisma.courseCertificate.findMany({
    where: {
      businessId,
      ...(opts?.courseId ? { courseId: opts.courseId } : {}),
      ...(opts?.includeRevoked ? {} : { revokedAt: null }),
    },
    orderBy: { issuedAt: "desc" },
    take: 2000, // safety cap — a single business is unlikely to exceed this
    select: {
      id: true,
      serial: true,
      studentName: true,
      courseTitle: true,
      issuedAt: true,
      issuedManually: true,
      revokedAt: true,
      courseId: true,
      membershipId: true,
      membership: {
        select: { portalUser: { select: { name: true, email: true } } },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    serial: r.serial,
    studentName: r.studentName,
    courseTitle: r.courseTitle,
    issuedAt: r.issuedAt,
    issuedManually: r.issuedManually,
    revokedAt: r.revokedAt,
    courseId: r.courseId,
    membershipId: r.membershipId,
    student: {
      name: r.membership?.portalUser?.name ?? r.studentName,
      email: r.membership?.portalUser?.email ?? "",
    },
  }));
}

// ─── Manual issue ──────────────────────────────────────────────────────────

/**
 * Owner override: issue a certificate for a student who finished offline.
 *
 * Verifies the course belongs to the business AND is published, and that the
 * membership belongs to the business (ServiceError NOT_FOUND otherwise).
 * Idempotent on the (membershipId, courseId) unique — if a row already exists
 * (even revoked) it is un-revoked and returned rather than erroring.
 *
 * studentName / courseTitle are snapshotted from portalUser.name / course.title.
 */
export async function issueCertificateManually(
  businessId: string,
  membershipId: string,
  courseId: string
): Promise<CourseCertificate> {
  const course = await prisma.course.findFirst({
    where: { id: courseId, businessId },
    select: { id: true, title: true, status: true },
  });
  if (!course || course.status !== "published") {
    throw new ServiceError("הקורס לא נמצא או אינו מפורסם", "NOT_FOUND");
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

  // Idempotent on the unique index — un-revoke an existing row rather than error.
  const existing = await prisma.courseCertificate.findUnique({
    where: { membershipId_courseId: { membershipId, courseId } },
  });
  if (existing) {
    if (existing.revokedAt) {
      return prisma.courseCertificate.update({
        where: { id: existing.id },
        data: { revokedAt: null, revokedReason: null },
      });
    }
    return existing;
  }

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
        data: { ...data, serial: generateSerial(), issuedManually: true },
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
          <p>קיבלת תעודת סיום עבור הקורס <strong>${escapeHtml(courseTitle)}</strong>.</p>
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
          `כל הכבוד ${studentName}! קיבלת תעודת סיום עבור הקורס "${courseTitle}" ` +
          `(${heDate(new Date())}).\n` +
          `לצפייה ולהדפסה: ${verifyUrl}`,
      }).catch(() => {})
    );
  }

  await Promise.all(tasks);
}

// ─── Revoke / restore ────────────────────────────────────────────────────

/** Revoke a certificate (scoped by businessId). NOT_FOUND if not this business's. */
export async function revokeCertificate(
  businessId: string,
  certificateId: string,
  reason?: string
): Promise<void> {
  const cleanReason = (reason ?? "").trim().slice(0, 500) || null;
  const result = await prisma.courseCertificate.updateMany({
    where: { id: certificateId, businessId },
    data: { revokedAt: new Date(), revokedReason: cleanReason },
  });
  if (result.count === 0) {
    throw new ServiceError("התעודה לא נמצאה", "NOT_FOUND");
  }
}

/** Un-revoke a certificate (scoped by businessId). NOT_FOUND if not this business's. */
export async function restoreCertificate(
  businessId: string,
  certificateId: string
): Promise<void> {
  const result = await prisma.courseCertificate.updateMany({
    where: { id: certificateId, businessId },
    data: { revokedAt: null, revokedReason: null },
  });
  if (result.count === 0) {
    throw new ServiceError("התעודה לא נמצאה", "NOT_FOUND");
  }
}

/** Hard delete a certificate (scoped by businessId). NOT_FOUND if not this business's. */
export async function deleteCertificate(
  businessId: string,
  certificateId: string
): Promise<void> {
  const result = await prisma.courseCertificate.deleteMany({
    where: { id: certificateId, businessId },
  });
  if (result.count === 0) {
    throw new ServiceError("התעודה לא נמצאה", "NOT_FOUND");
  }
}
