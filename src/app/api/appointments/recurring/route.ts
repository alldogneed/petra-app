export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { createRecurringAppointments, ServiceError } from "@/services/appointments";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    let result;
    try {
      result = await createRecurringAppointments(authResult.businessId, prisma, body);
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/appointments/recurring error:", error);
    return NextResponse.json({ error: "Failed to create recurring appointments" }, { status: 500 });
  }
}
