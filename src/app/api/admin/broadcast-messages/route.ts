export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { resolveSession } from "@/lib/auth-guards";
import { PLATFORM_ROLES } from "@/lib/permissions";

/** Only legacy MASTER role or super_admin platformRole may broadcast. */
async function requireMasterAccess(req: NextRequest): Promise<NextResponse | null> {
  const session = await resolveSession(req);

  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!session.user.isActive) {
    return NextResponse.json({ error: "Account is disabled" }, { status: 403 });
  }

  const isLegacyMaster = (session.user as { role?: string }).role === "MASTER";
  const isSuperAdmin = session.user.platformRole === PLATFORM_ROLES.SUPER_ADMIN;

  if (!isLegacyMaster && !isSuperAdmin) {
    return NextResponse.json({ error: "Master admin access required" }, { status: 403 });
  }

  return null; // authorized
}

// ─── GET: broadcast history ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const deny = await requireMasterAccess(req);
  if (deny) return deny;

  // Group by title + content + type (deduplicate per broadcast wave)
  // NOTE: PostgreSQL requires double-quoting for camelCase identifiers
  const rows = await prisma.$queryRaw<
    { title: string; content: string; type: string; sentAt: Date; businesses: bigint }[]
  >`
    SELECT
      title,
      content,
      type,
      MIN("createdAt") AS "sentAt",
      COUNT(DISTINCT "businessId") AS businesses
    FROM "SystemMessage"
    WHERE icon = 'broadcast'
    GROUP BY title, content, type
    ORDER BY "sentAt" DESC
    LIMIT 30
  `;

  // Convert bigint (PostgreSQL COUNT return type) to number for JSON serialization
  return NextResponse.json({
    broadcasts: rows.map((r) => ({ ...r, businesses: Number(r.businesses) })),
  });
}

// ─── POST: send broadcast to all businesses ────────────────────────────────────

export async function POST(req: NextRequest) {
  const deny = await requireMasterAccess(req);
  if (deny) return deny;

  const body = await req.json();
  const { title, content, type, actionUrl, actionLabel, expiresAt } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "כותרת חובה" }, { status: 400 });
  }
  if (!content?.trim()) {
    return NextResponse.json({ error: "תוכן ההודעה חובה" }, { status: 400 });
  }

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
}
