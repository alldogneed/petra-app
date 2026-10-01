export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError, requireBusinessPermission } from "@/lib/auth-guards";
import { TENANT_PERMS, sessionHasTenantPermission } from "@/lib/permissions";
import { updateYard, deleteYard, ServiceError } from "@/services/boarding";
import type { UpdateYardData } from "@/services/boarding";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { name, capacity, type, status, pricePerSession } = body;

    // Structure changes (name/capacity/type/price) need BOARDING_MANAGE; a status-only
    // update (e.g. "mark clean") is daily operational work and stays open.
    const changesStructure = ["name", "capacity", "type", "pricePerSession"].some((k) => k in body);
    if (changesStructure && !sessionHasTenantPermission(authResult.session, authResult.businessId, TENANT_PERMS.BOARDING_MANAGE)) {
      return NextResponse.json({ error: "אין לך הרשאה לנהל חדרים וחצרות בפנסיון" }, { status: 403 });
    }

    const data: UpdateYardData = {};
    if (name !== undefined) data.name = name;
    if (capacity !== undefined) data.capacity = Number(capacity);
    if (type !== undefined) data.type = type;
    if (status !== undefined) data.status = status;
    if ("pricePerSession" in body) data.pricePerSession = pricePerSession != null ? Number(pricePerSession) : null;

    let yard;
    try {
      yard = await updateYard(authResult.businessId, prisma, params.id, data);
    } catch (e) {
      if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }
    return NextResponse.json(yard);
  } catch (error) {
    console.error("PATCH yard error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון החצר" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessPermission(request, TENANT_PERMS.BOARDING_MANAGE);
    if (isGuardError(authResult)) return authResult;

    try {
      await deleteYard(authResult.businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json({ error: e.message }, { status: e.code === "CONFLICT" ? 409 : 400 });
      }
      throw e;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE yard error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת החצר" }, { status: 500 });
  }
}
