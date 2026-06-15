export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { listStayCareLogs, createStayCareLog, deleteStayCareLog, ServiceError } from "@/services/boarding";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    try {
      const result = await listStayCareLogs(auth.businessId, prisma, params.id);
      return NextResponse.json(result);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") return NextResponse.json({ error: "Not found" }, { status: 404 });
      throw e;
    }
  } catch (error) {
    console.error("GET care-logs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    const body = await request.json();
    let log;
    try {
      log = await createStayCareLog(auth.businessId, prisma, params.id, body, auth.session.user.id || null);
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json({ error: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 400 });
      }
      throw e;
    }
    return NextResponse.json(log);
  } catch (error) {
    console.error("POST care-logs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const logId = searchParams.get("logId");
    if (!logId) return NextResponse.json({ error: "logId required" }, { status: 400 });

    await deleteStayCareLog(auth.businessId, prisma, params.id, logId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE care-logs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
