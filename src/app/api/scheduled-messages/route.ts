export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/scheduled-messages?status=PENDING&page=1
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const take = 50;
    const skip = (page - 1) * take;

    const where = {
      businessId: DEMO_BUSINESS_ID,
      ...(status && status !== "ALL" ? { status } : {}),
    };

    const [messages, total] = await Promise.all([
      prisma.scheduledMessage.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { sendAt: "desc" },
        take,
        skip,
      }),
      prisma.scheduledMessage.count({ where }),
    ]);

    return NextResponse.json({ messages, total, page, pages: Math.ceil(total / take) });
  } catch (error) {
    console.error("GET scheduled-messages error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת הודעות" }, { status: 500 });
  }
}
