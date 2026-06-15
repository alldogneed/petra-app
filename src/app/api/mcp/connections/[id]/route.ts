export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

/** DELETE /api/mcp/connections/[id] — revoke an MCP connection */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const conn = await prisma.mcpConnection.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      select: { id: true, revokedAt: true },
    });

    if (!conn) {
      return NextResponse.json({ error: "חיבור לא נמצא" }, { status: 404 });
    }

    if (conn.revokedAt) {
      return NextResponse.json({ error: "החיבור כבר בוטל" }, { status: 400 });
    }

    await prisma.mcpConnection.update({
      where: { id: params.id },
      data: { revokedAt: new Date() },
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

    // Strip tokenHash from response
    const { tokenHash: _, ...safe } = conn;
    return NextResponse.json(safe);
  } catch (error) {
    console.error("GET /api/mcp/connections/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת חיבור" }, { status: 500 });
  }
}
