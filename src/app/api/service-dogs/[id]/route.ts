export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { getServiceDog, updateServiceDog, deleteServiceDog, ServiceError } from "@/services/service-dogs";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    let dog;
    try {
      dog = await getServiceDog(authResult.businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(dog);
  } catch (error) {
    console.error("GET /api/service-dogs/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת כלב שירות" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

    let updated;
    try {
      updated = await updateServiceDog(authResult.businessId, prisma, params.id, body);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "VALIDATION") {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/service-dogs/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון כלב שירות" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    try {
      await deleteServiceDog(authResult.businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/service-dogs/[id] error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת כלב שירות" }, { status: 500 });
  }
}
