export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { ensureSessionAttendance, ServiceError } from "@/services/training";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// POST /api/training-groups/[id]/sessions/[sessionId]/attendance
// Idempotently seeds NO_SHOW attendance rows for all current ACTIVE
// participants. Optional body { markAll: "PRESENT" } bulk-marks every row.
// Returns the refreshed attendance rows.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:training-groups:attendance", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json().catch(() => ({}));
    if (body.markAll !== undefined && body.markAll !== "PRESENT") {
      return NextResponse.json({ error: "ערך markAll לא תקין" }, { status: 400 });
    }

    let attendance;
    try {
      attendance = await ensureSessionAttendance(authResult.businessId, prisma, params.sessionId, {
        markAll: body.markAll,
        groupId: params.id,
      });
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "מפגש לא נמצא" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(attendance);
  } catch (error) {
    console.error("POST /api/training-groups/[id]/sessions/[sessionId]/attendance error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון נוכחות" }, { status: 500 });
  }
}
