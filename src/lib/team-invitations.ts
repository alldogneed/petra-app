/**
 * Team invitations — the owner invites by email, the invitee accepts from the link
 * and sets their own password. The BusinessUser row exists only after acceptance.
 *
 * Only the SHA-256 of the token is stored (same scheme as PasswordResetToken).
 * A resend issues a NEW token, so a link copied earlier stops working.
 */
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendTeamInvitationEmail } from "@/lib/email";

export const INVITE_TTL_DAYS = 7;
const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

export const INVITE_ROLES = ["owner", "manager", "user", "volunteer"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export type InvitationStatus = "pending" | "expired" | "accepted" | "revoked";

export function hashInviteToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function inviteUrl(rawToken: string): string {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  return `${appUrl}/invite?token=${rawToken}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function invitationStatus(inv: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now = new Date()): InvitationStatus {
  if (inv.acceptedAt) return "accepted";
  if (inv.revokedAt) return "revoked";
  if (inv.expiresAt <= now) return "expired";
  return "pending";
}

/** Same rule as registration and password reset: 12+ chars, upper + lower + digit. */
export function isStrongPassword(pw: string): boolean {
  return pw.length >= 12 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw);
}

/**
 * Create an invitation, or refresh the open one for the same business + email
 * (new token, new expiry, updated name/role). Returns the raw token — it is never stored.
 */
export async function upsertInvitation(args: {
  businessId: string;
  email: string;
  name: string;
  role: InviteRole;
  invitedById: string;
}) {
  const email = normalizeEmail(args.email);
  const rawToken = crypto.randomBytes(32).toString("hex");
  const data = {
    name: args.name,
    role: args.role,
    tokenHash: hashInviteToken(rawToken),
    invitedById: args.invitedById,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  };

  const open = await prisma.teamInvitation.findFirst({
    where: { businessId: args.businessId, email, acceptedAt: null, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const invitation = open
    ? await prisma.teamInvitation.update({ where: { id: open.id }, data })
    : await prisma.teamInvitation.create({ data: { ...data, businessId: args.businessId, email } });

  return { invitation, rawToken };
}

/** New token + expiry for an open invitation of this business. Null when it is not open. */
export async function refreshInvitationToken(invitationId: string, businessId: string) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const res = await prisma.teamInvitation.updateMany({
    where: { id: invitationId, businessId, acceptedAt: null, revokedAt: null },
    data: { tokenHash: hashInviteToken(rawToken), expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
  });
  if (res.count === 0) return null;
  const invitation = await prisma.teamInvitation.findUniqueOrThrow({ where: { id: invitationId } });
  return { invitation, rawToken };
}

/**
 * Email the invitation link and record the outcome on the row (lastSentAt / emailError),
 * so the team screen can tell the owner that a send failed. Never throws.
 */
export async function deliverInvitation(
  invitation: { id: string; email: string; name: string; role: string },
  rawToken: string,
  ctx: { businessName: string; inviterName: string },
): Promise<{ emailSent: boolean }> {
  const hasAccount = !!(await prisma.platformUser.findFirst({
    where: { email: { equals: invitation.email, mode: "insensitive" } },
    select: { id: true },
  }));

  let emailError: string | null = null;
  try {
    await sendTeamInvitationEmail({
      to: invitation.email,
      name: invitation.name,
      businessName: ctx.businessName,
      role: invitation.role,
      inviterName: ctx.inviterName,
      inviteUrl: inviteUrl(rawToken),
      hasAccount,
      expiresInDays: INVITE_TTL_DAYS,
    });
  } catch (err) {
    console.error("Team invitation email failed:", err);
    emailError = "send_failed";
  }

  await prisma.teamInvitation.update({
    where: { id: invitation.id },
    data: { lastSentAt: new Date(), emailError },
  });
  return { emailSent: emailError === null };
}

/** Client-safe shape of an invitation (never the token hash). */
export function serializeInvitation(inv: {
  id: string;
  email: string;
  name: string;
  role: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  lastSentAt: Date | null;
  emailError: string | null;
  createdAt: Date;
}) {
  return {
    id: inv.id,
    email: inv.email,
    name: inv.name,
    role: inv.role,
    status: invitationStatus(inv),
    expiresAt: inv.expiresAt.toISOString(),
    lastSentAt: inv.lastSentAt?.toISOString() ?? null,
    emailFailed: inv.emailError !== null,
    createdAt: inv.createdAt.toISOString(),
  };
}
