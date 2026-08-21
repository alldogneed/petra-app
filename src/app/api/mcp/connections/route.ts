export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { generateMcpToken, DEFAULT_MCP_SCOPES, READ_ONLY_MCP_SCOPES } from "@/lib/mcp-auth";
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
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        _count: { select: { auditLogs: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(connections);
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

    const body = await request.json();
    const { name, readOnly = false } = body;

    if (!name || typeof name !== "string" || name.trim().length < 1) {
      return NextResponse.json({ error: "נדרש שם לחיבור" }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: "שם ארוך מדי (מקסימום 100 תווים)" }, { status: 400 });
    }
    // readOnly (optional, default false): true → read:* scopes only; the agent
    // can't create/update appointments, clients, leads, tasks or orders.
    if (typeof readOnly !== "boolean") {
      return NextResponse.json({ error: "ערך לא תקין עבור 'קריאה בלבד'" }, { status: 400 });
    }

    // Check limit: max 10 active connections per business
    const activeCount = await prisma.mcpConnection.count({
      where: { businessId: authResult.businessId, revokedAt: null },
    });
    if (activeCount >= 10) {
      return NextResponse.json({ error: "הגעת למקסימום 10 חיבורים פעילים" }, { status: 400 });
    }

    const { raw, hash } = generateMcpToken();

    const connection = await prisma.mcpConnection.create({
      data: {
        businessId: authResult.businessId,
        name: name.trim(),
        tokenHash: hash,
        scopes: readOnly ? READ_ONLY_MCP_SCOPES : DEFAULT_MCP_SCOPES,
      },
      select: {
        id: true,
        name: true,
        scopes: true,
        createdAt: true,
      },
    });

    // Return the raw token ONCE — never stored in plain text
    return NextResponse.json({ ...connection, token: raw }, { status: 201 });
  } catch (error) {
    console.error("POST /api/mcp/connections error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת חיבור" }, { status: 500 });
  }
}
