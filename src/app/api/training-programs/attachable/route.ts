export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { listAttachablePrograms } from "@/services/training-appointments";

/**
 * GET /api/training-programs/attachable?customerId=&petId=
 * Active individual training programs of a customer (optionally one dog) that still have
 * meetings left — the calendar offers "לשייך לחבילת אילוף" for them (rule #45).
 * businessId from the session only; unknown / foreign customer → [].
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const customerId = (searchParams.get("customerId") || "").slice(0, 64);
    const petId = (searchParams.get("petId") || "").slice(0, 64) || null;
    if (!customerId) return NextResponse.json([]);

    const programs = await listAttachablePrograms(authResult.businessId, prisma, customerId, petId);
    return NextResponse.json(programs);
  } catch (error) {
    console.error("GET /api/training-programs/attachable error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת תוכניות אילוף" }, { status: 500 });
  }
}
