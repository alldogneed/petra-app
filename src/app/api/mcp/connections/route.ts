export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { generateMcpToken } from "@/lib/mcp-auth";

/** GET /api/mcp/connections — list all MCP connections for the business */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

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

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length < 1) {
      return NextResponse.json({ error: "נדרש שם לחיבור" }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: "שם ארוך מדי (מקסימום 100 תווים)" }, { status: 400 });
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
        scopes: [
          "read:clients",
          "read:appointments",
          "read:stats",
          "write:appointments",
          "write:notes",
          "write:reminders",
        ],
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
