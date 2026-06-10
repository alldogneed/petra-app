export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { PLATFORM_PERMS } from "@/lib/permissions";

// ─── GET: broadcast history ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const authResult = await requirePlatformPermission(req, PLATFORM_PERMS.SETTINGS_WRITE);
    if (isGuardError(authResult)) return authResult;

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

    // Validate actionUrl format if provided
    if (actionUrl?.trim()) {
      const trimmedUrl = actionUrl.trim();
      if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
        return NextResponse.json({ error: "actionUrl must start with http:// or https://" }, { status: 400 });
      }
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
  } catch (error) {
    console.error("POST /api/admin/broadcast-messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
