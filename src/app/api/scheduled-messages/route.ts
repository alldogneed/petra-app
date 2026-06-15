export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { listScheduledMessages } from "@/services/notifications";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));

    const result = await listScheduledMessages(authResult.businessId, prisma, { status, page });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET scheduled-messages error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת הודעות" }, { status: 500 });
  }
}
