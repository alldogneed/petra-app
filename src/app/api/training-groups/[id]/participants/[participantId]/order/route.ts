export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { createParticipantOrder, ServiceError } from "@/services/training";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// POST /api/training-groups/[id]/participants/[participantId]/order
// Creates a confirmed workshop Order for the participant (total = group.price)
// and links participant.orderId. Returns the data the UI needs for the
// WhatsApp payment-request message (paymentUrl = Stripe link or null).
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; participantId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:training-groups:participant-order", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    let result;
    try {
      result = await createParticipantOrder(
        authResult.businessId,
        prisma,
        params.participantId,
        params.id
      );
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json(
          { error: e.message },
          { status: e.code === "NOT_FOUND" ? 404 : e.code === "CONFLICT" ? 409 : 400 }
        );
      }
      throw e;
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/training-groups/[id]/participants/[participantId]/order error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת הזמנה למשתתף" }, { status: 500 });
  }
}
