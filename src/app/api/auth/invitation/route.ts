export const dynamic = 'force-dynamic';
/**
 * POST /api/auth/invitation — PUBLIC (the token is the credential), rate-limited per IP.
 *
 * { action: "lookup", token }                    → who invited whom, to which business
 * { action: "accept", token, password?, name? }  → join the business
 *
 * New account:      password required (registration rules) → account + membership, logged in.
 * Existing account: must be signed in AS that account (login → back to /invite), so a
 *                   link in the wrong hands — the inviter's included — cannot attach
 *                   someone else's account. No password is touched (keeps 2FA / Google).
 * The token travels in the POST body, never in an API URL.
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, setSessionCookie } from "@/lib/auth";
import { rateLimitAsync, RATE_LIMITS } from "@/lib/rate-limit";
import { logAudit, AUDIT_ACTIONS, getRequestContext } from "@/lib/audit";
import { getSession, invalidateUserSessionCache } from "@/lib/session";
import { hashInviteToken, invitationStatus, isStrongPassword } from "@/lib/team-invitations";

const ERR_INVALID = "הקישור לא תקין. בקש/י מבעל העסק לשלוח הזמנה חדשה.";
const STATUS_ERRORS: Record<string, string> = {
  accepted: "ההזמנה כבר אושרה — אפשר להתחבר.",
  revoked: "ההזמנה בוטלה על ידי בעל העסק.",
  expired: "תוקף ההזמנה פג. בקש/י מבעל העסק לשלוח הזמנה חדשה.",
};

async function loadInvitation(token: unknown) {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return null;
  return prisma.teamInvitation.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { business: { select: { name: true } } },
  });
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await rateLimitAsync("auth:invitation", ip, RATE_LIMITS.STRICT_TOKEN);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי ניסיונות. נסה/י שוב בעוד דקה." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const invitation = await loadInvitation(body?.token);
    if (!invitation) return NextResponse.json({ error: ERR_INVALID }, { status: 404 });

    const status = invitationStatus(invitation);
    if (status !== "pending") {
      return NextResponse.json({ error: STATUS_ERRORS[status], status }, { status: 410 });
    }

    const user = await prisma.platformUser.findFirst({
      where: { email: { equals: invitation.email, mode: "insensitive" } },
      select: { id: true, isActive: true },
    });

    // For an existing account: is the browser signed in as exactly that user (2FA done, not impersonating)?
    let signedInAsInvitee = false;
    if (user) {
      const session = await getSession();
      signedInAsInvitee =
        session?.user.id === user.id &&
        !session.impersonatedBusinessId &&
        (!session.user.twoFaEnabled || session.twoFaVerified);
    }

    if (body.action === "lookup") {
      const inviter = invitation.invitedById
        ? await prisma.platformUser.findUnique({ where: { id: invitation.invitedById }, select: { name: true } })
        : null;
      return NextResponse.json({
        businessName: invitation.business.name,
        name: invitation.name,
        email: invitation.email,
        role: invitation.role,
        inviterName: inviter?.name ?? null,
        hasAccount: !!user,
        signedInAsInvitee,
        expiresAt: invitation.expiresAt.toISOString(),
      });
    }

    if (body.action !== "accept") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (user && !user.isActive) {
      return NextResponse.json({ error: "החשבון מושבת. פנה/י לתמיכה." }, { status: 403 });
    }
    if (user && !signedInAsInvitee) {
      return NextResponse.json(
        { error: "כדי לאשר, התחבר/י קודם לחשבון של האימייל שהוזמן.", code: "LOGIN_REQUIRED" },
        { status: 401 },
      );
    }

    // New account: validate before consuming the token so a weak password can be retried.
    let passwordHash: string | null = null;
    let name = invitation.name;
    if (!user) {
      const password = body.password;
      if (typeof password !== "string" || password.length > 1000) {
        return NextResponse.json({ error: "יש לבחור סיסמה" }, { status: 400 });
      }
      if (!isStrongPassword(password)) {
        return NextResponse.json(
          { error: "הסיסמה חייבת להכיל לפחות 12 תווים, אות גדולה, אות קטנה וספרה" },
          { status: 400 },
        );
      }
      if (typeof body.name === "string" && body.name.trim()) name = body.name.trim().slice(0, 100);
      passwordHash = await bcrypt.hash(password, 12);
    }

    // Consume atomically — a double click or a replayed link joins only once.
    const consumed = await prisma.teamInvitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { acceptedAt: new Date() },
    });
    if (consumed.count === 0) {
      return NextResponse.json({ error: STATUS_ERRORS.accepted, status: "accepted" }, { status: 410 });
    }

    // Everything after the consume is undone on failure (acceptedAt back to null), so the
    // invitee can retry instead of holding a burned link with no membership.
    // A new account that was created before the failure retries as an existing one.
    const unconsume = () =>
      prisma.teamInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: null } }).catch(() => {});

    let userId = user?.id;
    if (!userId) {
      try {
        const created = await prisma.platformUser.create({
          data: { email: invitation.email, name, passwordHash, isActive: true },
          select: { id: true },
        });
        userId = created.id;
      } catch (err) {
        // Most likely the same email registered a moment ago — let them retry as existing.
        await unconsume();
        console.error("invitation accept: user create failed", err);
        return NextResponse.json({ error: "לא הצלחנו ליצור את החשבון. נסה/י שוב." }, { status: 409 });
      }
    }

    try {
      if (!user) {
        // Skip the business-setup onboarding — the business already exists.
        await prisma.onboardingProgress.upsert({
          where: { userId },
          create: {
            userId,
            currentStep: 4,
            stepCompleted1: true,
            stepCompleted2: true,
            stepCompleted3: true,
            stepCompleted4: true,
            startedAt: new Date(),
            completedAt: new Date(),
          },
          update: {},
        });
      }

      // Membership — an already-active member keeps their current role (never downgrade
      // or upgrade through an old invitation); an inactive one is reactivated.
      const existing = await prisma.businessUser.findUnique({
        where: { businessId_userId: { businessId: invitation.businessId, userId } },
        select: { id: true, isActive: true },
      });
      if (!existing) {
        await prisma.businessUser.create({
          data: { businessId: invitation.businessId, userId, role: invitation.role, isActive: true },
        });
      } else if (!existing.isActive) {
        await prisma.businessUser.update({
          where: { id: existing.id },
          data: { isActive: true, role: invitation.role },
        });
      }
    } catch (err) {
      await unconsume();
      console.error("invitation accept: membership failed", err);
      return NextResponse.json({ error: "לא הצלחנו להשלים את ההצטרפות. נסה/י שוב." }, { status: 500 });
    }
    invalidateUserSessionCache(userId);

    // The membership already exists — an audit failure must not turn this into an error.
    const { ip: auditIp, userAgent } = getRequestContext(request);
    logAudit({
      actorUserId: userId,
      actorBusinessId: invitation.businessId,
      action: AUDIT_ACTIONS.TENANT_INVITATION_ACCEPTED,
      targetType: "team_invitation",
      targetId: invitation.id,
      ip: auditIp,
      userAgent,
      metadata: { role: invitation.role, newAccount: !user },
    }).catch((err) => console.error("invitation accept: audit failed", err));

    if (!user) {
      // Fresh account with the password they just chose → straight in.
      const { token: sessionToken } = await createSession(userId, request);
      setSessionCookie(sessionToken);
      return NextResponse.json({ ok: true, loggedIn: true });
    }
    // Already signed in as the invitee — the new business shows up after a reload.
    return NextResponse.json({ ok: true, loggedIn: true });
  } catch (error) {
    console.error("POST /api/auth/invitation error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
