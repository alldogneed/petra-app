export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { listSystemMessages, createSystemMessage, ServiceError } from "@/services/notifications";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const all = searchParams.get("all") === "true";

    const result = await listSystemMessages(authResult.businessId, prisma, { unreadOnly, all });
    return NextResponse.json(
      result,
      { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=60" } }
    );
  } catch (error) {
    console.error("System messages API error:", error);
    return NextResponse.json({ messages: [], unreadCount: 0 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:system-messages:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json();

    let message;
    try {
      message = await createSystemMessage(authResult.businessId, prisma, body);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "VALIDATION") {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error("Create message error:", error);
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 });
  }
}
