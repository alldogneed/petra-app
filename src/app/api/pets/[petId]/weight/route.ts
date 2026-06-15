export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { listWeightEntries, addWeightEntry, deleteWeightEntry, ServiceError } from "@/services/pets";

export async function GET(
  request: NextRequest,
  { params }: { params: { petId: string } }
) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    let entries;
    try {
      entries = await listWeightEntries(auth.businessId, prisma, params.petId);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("GET pet weight error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת נתונים" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { petId: string } }
) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    const body = await request.json();
    let entry;
    try {
      entry = await addWeightEntry(auth.businessId, prisma, params.petId, body);
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json({ error: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 400 });
      }
      throw e;
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error("POST pet weight error:", error);
    return NextResponse.json({ error: "שגיאה בשמירת משקל" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { petId: string } }
) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get("entryId");
    if (!entryId) return NextResponse.json({ error: "entryId required" }, { status: 400 });

    await deleteWeightEntry(auth.businessId, prisma, params.petId, entryId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE pet weight error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת רשומה" }, { status: 500 });
  }
}
