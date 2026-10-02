export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { isMcpAllowedUser } from "@/lib/mcp-allowlist";
import { isPlatformAdmin } from "@/lib/permissions";

/** DELETE /api/mcp/connections/[id] — revoke an MCP connection */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    if (!isMcpAllowedUser(authResult.session.user.email, authResult.session.user.platformRole)) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    const conn = await prisma.mcpConnection.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      select: { id: true, revokedAt: true, createdByUserId: true },
    });

    if (!conn) {
      return NextResponse.json({ error: "חיבור לא נמצא" }, { status: 404 });
    }

    // Owner / platform admin may revoke any connection of the business; other
    // members only connections they minted themselves (legacy rows: owner only).
    const { session, businessId } = authResult;
    const isOwner = session.memberships.some((m) => m.businessId === businessId && m.isActive && m.role === "owner");
    const isPlatformAdminUser = isPlatformAdmin(session.user.platformRole);
    if (!isOwner && !isPlatformAdminUser && conn.createdByUserId !== session.user.id) {
      return NextResponse.json({ error: "רק בעלי העסק או מי שיצר את החיבור יכולים לבטל אותו" }, { status: 403 });
    }

    if (conn.revokedAt) {
      return NextResponse.json({ error: "החיבור כבר בוטל" }, { status: 400 });
    }

    await prisma.mcpConnection.update({
      where: { id: params.id },
      // Also drop the refresh token so a revoked OAuth grant can never be refreshed
      // (the refresh path checks revokedAt too — belt and braces).
      data: { revokedAt: new Date(), refreshTokenHash: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/mcp/connections/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בביטול חיבור" }, { status: 500 });
  }
}

/** GET /api/mcp/connections/[id] — get connection details + audit log */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    if (!isMcpAllowedUser(authResult.session.user.email, authResult.session.user.platformRole)) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    const conn = await prisma.mcpConnection.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: {
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            toolName: true,
            status: true,
            resultSummary: true,
            errorMessage: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conn) {
      return NextResponse.json({ error: "חיבור לא נמצא" }, { status: 404 });
    }

    // Minter display info (null for legacy rows minted before governance fields existed)
    const minter = conn.createdByUserId
      ? await prisma.platformUser.findUnique({
          where: { id: conn.createdByUserId },
          select: { name: true, email: true },
        })
      : null;

    // Strip all token hashes from response (access + OAuth refresh tokens)
    const {
      tokenHash: _tokenHash,
      refreshTokenHash: _refreshTokenHash,
      prevRefreshTokenHash: _prevRefreshTokenHash,
      ...safe
    } = conn;
    return NextResponse.json({
      ...safe,
      createdBy: minter ? { name: minter.name, email: minter.email } : null,
      isExpired: !!conn.expiresAt && conn.expiresAt.getTime() < Date.now(),
    });
  } catch (error) {
    console.error("GET /api/mcp/connections/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת חיבור" }, { status: 500 });
  }
}
