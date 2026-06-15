export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { listDailyCareBoard, createCareLog, ServiceError } from "@/services/boarding";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const stays = await listDailyCareBoard(authResult.businessId, prisma, dateStr);
    return NextResponse.json(stays);
  } catch (error) {
    console.error("GET care-log error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת לוח הטיפולים" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    let log;
    try {
      log = await createCareLog(authResult.businessId, prisma, body, authResult.session.user.id || null);
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json({ error: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 400 });
      }
      throw e;
    }
    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("POST care-log error:", error);
    return NextResponse.json({ error: "שגיאה בשמירת הפעולה" }, { status: 500 });
  }
}
