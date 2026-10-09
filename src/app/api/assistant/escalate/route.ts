export const dynamic = 'force-dynamic';

/**
 * POST /api/assistant/escalate — "דבר עם אדם".
 * Opens a SupportTicket (same queue as the help-center form: /owner/support +
 * email) with the chat transcript, the screen and the business, and flags the
 * conversation as handed to a human.
 *
 * Body: { conversationId?, screen?, note? }  — without a conversation a note is required.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { env } from "@/lib/env";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimitAsync, RATE_LIMITS } from "@/lib/rate-limit";
import { sendSupportTicketEmail } from "@/lib/email";
import { resolveAssistantScreen } from "@/lib/assistant/screens";
import { buildEscalationText } from "@/lib/assistant/transcript";
import { ASSISTANT_MAX_NOTE_CHARS } from "@/lib/assistant/limits";

const bodySchema = z.object({
  conversationId: z.string().min(1).max(40).optional(),
  screen: z.string().max(300).optional(),
  note: z.string().trim().max(ASSISTANT_MAX_NOTE_CHARS).optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { session, businessId } = authResult;
  const userId = session.user.id;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  const { conversationId, screen: pathname } = parsed.data;
  const note = parsed.data.note || null;

  const conversation = conversationId
    ? await prisma.assistantConversation.findFirst({
        where: { id: conversationId, businessId, userId },
        select: {
          id: true,
          escalated: true,
          supportTicketId: true,
          messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true } },
        },
      })
    : null;
  if (conversationId && !conversation) return NextResponse.json({ error: "השיחה לא נמצאה." }, { status: 404 });

  // Already handed over — don't open a second ticket for the same chat.
  if (conversation?.escalated && conversation.supportTicketId) {
    return NextResponse.json({ id: conversation.supportTicketId, alreadyEscalated: true });
  }

  const messages = conversation?.messages ?? [];
  if (messages.length === 0 && (!note || note.length < 10)) {
    return NextResponse.json({ error: "כתבו בכמה מילים במה צריך עזרה, כדי שנוכל לחזור אליכם." }, { status: 400 });
  }

  const rl = await rateLimitAsync("assistant:escalate", businessId, RATE_LIMITS.ASSISTANT_ESCALATE);
  if (!rl.allowed) {
    return NextResponse.json({ error: "נשלחו כמה פניות בזמן קצר. נחזור אליכם בהקדם." }, { status: 429 });
  }

  const screen = resolveAssistantScreen(pathname);
  const [ticket, business] = await Promise.all([
    prisma.supportTicket.create({
      data: {
        businessId,
        userId,
        title: `Petra AI — בקשה לדבר עם אדם${screen ? ` (${screen.name})` : ""}`,
        description: buildEscalationText({ screenName: screen?.name ?? null, note, messages }),
        pageUrl: screen?.href ?? null,
        status: "open",
      },
    }),
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
  ]);

  if (conversation) {
    await prisma.assistantConversation.update({
      where: { id: conversation.id },
      data: { escalated: true, escalatedAt: new Date(), supportTicketId: ticket.id },
    });
  }

  // Email notification — the ticket is already saved, so a mail failure must not fail the request.
  try {
    await sendSupportTicketEmail({
      ticketId: ticket.id,
      businessName: business?.name ?? businessId,
      userEmail: session.user.email,
      title: ticket.title,
      description: ticket.description,
      pageUrl: ticket.pageUrl,
      adminUrl: `${env.APP_URL ?? "https://petra-app.com"}/owner/support`,
    });
  } catch (err) {
    console.error("[assistant/escalate] Failed to send email:", err);
  }

  return NextResponse.json({ id: ticket.id }, { status: 201 });
}
