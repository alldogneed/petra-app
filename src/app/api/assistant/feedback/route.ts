export const dynamic = 'force-dynamic';

/**
 * POST /api/assistant/feedback — 👍 / 👎 on a Petra AI answer.
 * Body: { messageId, rating: 1 | -1 | 0 }   (0 clears the rating)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

const bodySchema = z.object({
  messageId: z.string().min(1).max(40),
  rating: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
});

export async function POST(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { session, businessId } = authResult;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  const { messageId, rating } = parsed.data;

  // Only the user's own conversation in their own business, and only assistant answers.
  const result = await prisma.assistantMessage.updateMany({
    where: {
      id: messageId,
      businessId,
      role: "assistant",
      conversation: { businessId, userId: session.user.id },
    },
    data: { rating: rating === 0 ? null : rating },
  });
  if (result.count === 0) return NextResponse.json({ error: "ההודעה לא נמצאה" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
