export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { PLATFORM_PERMS } from "@/lib/permissions";

/**
 * Validate an optional actionUrl. The notification bell routes with
 * router.push(), so internal deep-links like "/calendar" must be allowed —
 * but protocol-relative "//host" is rejected (open redirect).
 * Returns an error response, or null when valid/empty.
 */
function validateActionUrl(actionUrl: unknown): NextResponse | null {
  if (typeof actionUrl !== "string" || !actionUrl.trim()) return null;
  const trimmedUrl = actionUrl.trim();
  const isAbsolute = trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://");
  const isInternalPath = trimmedUrl.startsWith("/") && !trimmedUrl.startsWith("//");
  if (!isAbsolute && !isInternalPath) {
    return NextResponse.json(
      { error: "actionUrl חייב להיות נתיב פנימי (למשל /calendar) או כתובת http/https מלאה" },
      { status: 400 }
    );
  }
  return null;
}

/**
 * A broadcast wave has no id of its own — it is N SystemMessage rows created
 * by one createMany. The history GET groups by (title, content, type) on
 * icon='broadcast', so PATCH/DELETE use the same triple as the selector.
 */
function broadcastSelector(selector: { title?: unknown; content?: unknown; type?: unknown }) {
  const { title, content, type } = selector;
  if (typeof title !== "string" || !title || typeof content !== "string" || !content || typeof type !== "string" || !type) {
    return null;
  }
  return { icon: "broadcast", title, content, type };
}

// ─── GET: broadcast history ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const authResult = await requirePlatformPermission(req, PLATFORM_PERMS.SETTINGS_WRITE);
    if (isGuardError(authResult)) return authResult;

    // Group by title + content + type (deduplicate per broadcast wave)
    // NOTE: PostgreSQL requires double-quoting for camelCase identifiers
    const rows = await prisma.$queryRaw<
      {
        title: string; content: string; type: string; sentAt: Date;
        businesses: bigint; readCount: bigint;
        actionUrl: string | null; actionLabel: string | null; expiresAt: Date | null;
      }[]
    >`
      SELECT
        title,
        content,
        type,
        MIN("createdAt") AS "sentAt",
        COUNT(DISTINCT "businessId") AS businesses,
        COUNT(*) FILTER (WHERE "isRead") AS "readCount",
        MIN("actionUrl") AS "actionUrl",
        MIN("actionLabel") AS "actionLabel",
        MIN("expiresAt") AS "expiresAt"
      FROM "SystemMessage"
      WHERE icon = 'broadcast'
      GROUP BY title, content, type
      ORDER BY "sentAt" DESC
      LIMIT 30
    `;

    // Convert bigint (PostgreSQL COUNT return type) to number for JSON serialization
    return NextResponse.json({
      broadcasts: rows.map((r) => ({
        ...r,
        businesses: Number(r.businesses),
        readCount: Number(r.readCount),
      })),
    });
  } catch (error) {
    console.error("GET /api/admin/broadcast-messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST: send broadcast to all businesses ────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePlatformPermission(req, PLATFORM_PERMS.SETTINGS_WRITE);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const { title, content, type, actionUrl, actionLabel, expiresAt } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "כותרת חובה" }, { status: 400 });
    }
    if (title.length > 500) {
      return NextResponse.json({ error: "כותרת ארוכה מדי (מקסימום 500 תווים)" }, { status: 400 });
    }
    if (!content?.trim()) {
      return NextResponse.json({ error: "תוכן ההודעה חובה" }, { status: 400 });
    }
    if (content.length > 5000) {
      return NextResponse.json({ error: "תוכן ארוך מדי (מקסימום 5000 תווים)" }, { status: 400 });
    }

    const urlError = validateActionUrl(actionUrl);
    if (urlError) return urlError;

    // Fetch all active businesses
    const businesses = await prisma.business.findMany({
      where: { status: "active" },
      select: { id: true },
    });

    if (!businesses.length) {
      return NextResponse.json({ error: "אין עסקים פעילים במערכת" }, { status: 404 });
    }

    await prisma.systemMessage.createMany({
      data: businesses.map((b) => ({
        businessId: b.id,
        title: title.trim(),
        content: content.trim(),
        type: type || "info",
        icon: "broadcast", // marker so we can identify broadcasts in history
        actionUrl: actionUrl?.trim() || null,
        actionLabel: actionLabel?.trim() || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })),
    });

    return NextResponse.json({ sent: businesses.length });
  } catch (error) {
    console.error("POST /api/admin/broadcast-messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── PATCH: edit an existing broadcast (all remaining copies) ──────────────────
// Copies a user already dismissed ("קראתי" deletes the row) are gone and are
// NOT resurrected — the edit only updates messages still in inboxes.

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requirePlatformPermission(req, PLATFORM_PERMS.SETTINGS_WRITE);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const where = broadcastSelector(body.original ?? {});
    if (!where) {
      return NextResponse.json({ error: "חסר מזהה שידור (original.title/content/type)" }, { status: 400 });
    }

    const { title, content, type, actionUrl, actionLabel, expiresAt } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "כותרת חובה" }, { status: 400 });
    }
    if (title.length > 500) {
      return NextResponse.json({ error: "כותרת ארוכה מדי (מקסימום 500 תווים)" }, { status: 400 });
    }
    if (!content?.trim()) {
      return NextResponse.json({ error: "תוכן ההודעה חובה" }, { status: 400 });
    }
    if (content.length > 5000) {
      return NextResponse.json({ error: "תוכן ארוך מדי (מקסימום 5000 תווים)" }, { status: 400 });
    }
    const urlError = validateActionUrl(actionUrl);
    if (urlError) return urlError;

    const result = await prisma.systemMessage.updateMany({
      where,
      data: {
        title: title.trim(),
        content: content.trim(),
        type: type || "info",
        actionUrl: actionUrl?.trim() || null,
        actionLabel: actionLabel?.trim() || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "השידור לא נמצא — ייתכן שכל העסקים כבר מחקו אותו" }, { status: 404 });
    }
    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error("PATCH /api/admin/broadcast-messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── DELETE: retract a broadcast (removes all remaining copies) ────────────────

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requirePlatformPermission(req, PLATFORM_PERMS.SETTINGS_WRITE);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const where = broadcastSelector(body);
    if (!where) {
      return NextResponse.json({ error: "חסר מזהה שידור (title/content/type)" }, { status: 400 });
    }

    const result = await prisma.systemMessage.deleteMany({ where });
    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("DELETE /api/admin/broadcast-messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
