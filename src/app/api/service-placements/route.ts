export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { listPlacements, createPlacement, ServiceError } from "@/services/service-dogs";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let placements;
    try {
      placements = await listPlacements(authResult.businessId, prisma, { status });
    } catch (e) {
      if (e instanceof ServiceError && e.code === "VALIDATION") {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    return NextResponse.json(placements);
  } catch (error) {
    console.error("GET /api/service-placements error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת שיבוצים" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

    let placement;
    try {
      placement = await createPlacement(authResult.businessId, prisma, body);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "VALIDATION") {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
      if (e instanceof ServiceError && e.code === "CONFLICT") {
        return NextResponse.json({ error: e.message }, { status: 409 });
      }
      throw e;
    }

    return NextResponse.json(placement, { status: 201 });
  } catch (error) {
    console.error("POST /api/service-placements error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת שיבוץ" }, { status: 500 });
  }
}
