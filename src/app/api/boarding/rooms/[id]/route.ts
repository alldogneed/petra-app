export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError, requireBusinessPermission } from "@/lib/auth-guards";
import { TENANT_PERMS, sessionHasTenantPermission } from "@/lib/permissions";
import { updateRoom, deleteRoom, ServiceError } from "@/services/boarding";
import type { UpdateRoomData } from "@/services/boarding";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { name, capacity, type, status, pricePerNight } = body;

    // Structure changes (name/capacity/type/price) need BOARDING_MANAGE; a status-only
    // update (e.g. "mark clean") is daily operational work and stays open.
    const changesStructure = ["name", "capacity", "type", "pricePerNight"].some((k) => k in body);
    if (changesStructure && !sessionHasTenantPermission(authResult.session, authResult.businessId, TENANT_PERMS.BOARDING_MANAGE)) {
      return NextResponse.json({ error: "אין לך הרשאה לנהל חדרים וחצרות בפנסיון" }, { status: 403 });
    }

    const data: UpdateRoomData = {};
    if (name !== undefined) data.name = name;
    if (capacity !== undefined) data.capacity = Number(capacity);
    if (type !== undefined) data.type = type;
    if (status !== undefined) data.status = status;
    if ("pricePerNight" in body) data.pricePerNight = pricePerNight != null ? Number(pricePerNight) : null;

    let room;
    try {
      room = await updateRoom(authResult.businessId, prisma, params.id, data);
    } catch (e) {
      if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }
    return NextResponse.json(room);
  } catch (error) {
    console.error("PATCH room error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון החדר" }, { status: 500 });
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
      await deleteRoom(authResult.businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json({ error: e.message }, { status: e.code === "CONFLICT" ? 409 : 400 });
      }
      throw e;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE room error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת החדר" }, { status: 500 });
  }
}
