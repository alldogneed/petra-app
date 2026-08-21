export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import {
  generateMcpToken,
  MCP_PROFILES,
  capScopesForRole,
  MCP_TOKEN_TTL_DAYS,
} from "@/lib/mcp-auth";
import { isMcpAllowedUser, isMcpAllowedBusiness, isInternalTestEmail } from "@/lib/mcp-allowlist";
import { normalizeTier } from "@/lib/feature-flags";

/** GET /api/mcp/connections — list all MCP connections for the business */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    if (!isMcpAllowedUser(authResult.session.user.email, authResult.session.user.platformRole)) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    const connections = await prisma.mcpConnection.findMany({
      where: { businessId: authResult.businessId },
      select: {
        id: true,
        name: true,
        scopes: true,
        profile: true,
        createdByUserId: true,
        createdByRole: true,
        expiresAt: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        _count: { select: { auditLogs: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Resolve minter display info in ONE query (legacy rows have createdByUserId = null).
    const minterIds = Array.from(
      new Set(connections.map((c) => c.createdByUserId).filter((id): id is string => !!id))
    );
    const minters = minterIds.length
      ? await prisma.platformUser.findMany({
          where: { id: { in: minterIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const minterById = new Map(minters.map((u) => [u.id, { name: u.name, email: u.email }]));

    const now = Date.now();
    const rows = connections.map((c) => ({
      ...c,
      createdBy: c.createdByUserId ? minterById.get(c.createdByUserId) ?? null : null,
      isExpired: !!c.expiresAt && c.expiresAt.getTime() < now,
    }));

    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET /api/mcp/connections error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת חיבורים" }, { status: 500 });
  }
}

/** POST /api/mcp/connections — create a new MCP connection + token */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    if (!isMcpAllowedUser(authResult.session.user.email, authResult.session.user.platformRole)) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    // Only owners/managers (or platform admins) may mint tokens — a token grants
    // API access beyond the minting user's UI permissions.
    const membershipRole = authResult.session.memberships.find(
      (m) => m.businessId === authResult.businessId
    )?.role;
    const isPlatformAdmin = ["super_admin", "admin"].includes(authResult.session.user.platformRole ?? "");
    if (!isPlatformAdmin && membershipRole !== "owner" && membershipRole !== "manager") {
      return NextResponse.json({ error: "אין לך הרשאה ליצור חיבור AI" }, { status: 403 });
    }

    // Server-side paywall (the UI PaywallCard alone is bypassable via curl):
    // MCP is basic+ — free-tier businesses can't mint tokens. Platform admins and
    // internal @petra.local QA accounts (seeded server-side) are exempt.
    const business = await prisma.business.findUnique({
      where: { id: authResult.businessId },
      select: { tier: true },
    });
    const isInternalQa = isInternalTestEmail(authResult.session.user.email);
    if (!isPlatformAdmin && !isInternalQa && normalizeTier(business?.tier) === "free") {
      return NextResponse.json({ error: "חיבור עוזרי AI זמין במנוי בייסיק ומעלה" }, { status: 403 });
    }

    // A token only works if the business itself passes the allowlist (e.g. an
    // admin impersonating a non-beta business would otherwise mint an inert token).
    if (!(await isMcpAllowedBusiness(authResult.businessId))) {
      return NextResponse.json({ error: "העסק הזה אינו בבטא של עוזרי AI" }, { status: 403 });
    }

    let body: { name?: unknown; readOnly?: unknown; profile?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "גוף הבקשה אינו JSON תקין" }, { status: 400 });
    }
    const { name, readOnly, profile: rawProfile } = body ?? {};

    if (!name || typeof name !== "string" || name.trim().length < 1) {
      return NextResponse.json({ error: "נדרש שם לחיבור" }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: "שם ארוך מדי (מקסימום 100 תווים)" }, { status: 400 });
    }

    // Access profile (preferred): one of MCP_PROFILES keys; default "read".
    // Backward-compat: legacy clients send `readOnly` — true → "read", false → "full".
    if (readOnly !== undefined && typeof readOnly !== "boolean") {
      return NextResponse.json({ error: "ערך לא תקין עבור 'קריאה בלבד'" }, { status: 400 });
    }
    if (
      rawProfile !== undefined &&
      (typeof rawProfile !== "string" ||
        !Object.prototype.hasOwnProperty.call(MCP_PROFILES, rawProfile) ||
        !Array.isArray(MCP_PROFILES[rawProfile]))
    ) {
      return NextResponse.json({ error: "פרופיל גישה לא תקין" }, { status: 400 });
    }
    const profile: string =
      typeof rawProfile === "string"
        ? rawProfile
        : readOnly === false
          ? "full"
          : "read";

    // Cap by the minter's tenant role (manager loses analytics/payments/destructive;
    // platform admin / owner keep everything).
    const requestedScopes = MCP_PROFILES[profile];
    const scopes = capScopesForRole(requestedScopes, membershipRole, isPlatformAdmin);
    const scopesCapped = scopes.length < requestedScopes.length;

    // Check limit: max 10 active connections per business
    const activeCount = await prisma.mcpConnection.count({
      where: { businessId: authResult.businessId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });
    if (activeCount >= 10) {
      return NextResponse.json({ error: "הגעת למקסימום 10 חיבורים פעילים" }, { status: 400 });
    }

    const { raw, hash } = generateMcpToken();
    const expiresAt = new Date(Date.now() + MCP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    const connection = await prisma.mcpConnection.create({
      data: {
        businessId: authResult.businessId,
        name: name.trim(),
        tokenHash: hash,
        scopes,
        profile,
        createdByUserId: authResult.session.user.id,
        createdByRole: membershipRole ?? (isPlatformAdmin ? "owner" : null),
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        scopes: true,
        profile: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    // Return the raw token ONCE — never stored in plain text
    return NextResponse.json({ ...connection, scopesCapped, token: raw }, { status: 201 });
  } catch (error) {
    console.error("POST /api/mcp/connections error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת חיבור" }, { status: 500 });
  }
}
