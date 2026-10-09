export const dynamic = 'force-dynamic';
// A streamed answer takes 10–30 s; 60 s is within every Vercel plan's limit.
export const maxDuration = 60;

/**
 * POST /api/assistant — Petra AI, the in-app support assistant (read-only: it
 * explains how to use Petra, it never reads business data or performs actions).
 *
 * Body: { message, screen?, conversationId? }
 * Response: NDJSON stream — {type:"meta",conversationId} · {type:"delta",text}… ·
 *           {type:"done",messageId} | {type:"error",message}
 *
 * The business and the user come from the session only. History is loaded from
 * the database (never taken from the client), scoped to businessId + userId.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { env } from "@/lib/env";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimitAsync, RATE_LIMITS } from "@/lib/rate-limit";
import { normalizeTier } from "@/lib/feature-flags";
import { loadAssistantContext } from "@/lib/assistant/context";
import { ASSISTANT_STABLE_PROMPT, buildContextPrompt } from "@/lib/assistant/system-prompt";
import {
  ASSISTANT_HISTORY_MESSAGES,
  ASSISTANT_MAX_CONVERSATION_MESSAGES,
  ASSISTANT_MAX_MESSAGE_CHARS,
  ASSISTANT_MAX_OUTPUT_TOKENS,
} from "@/lib/assistant/limits";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(ASSISTANT_MAX_MESSAGE_CHARS),
  screen: z.string().max(300).optional(),
  conversationId: z.string().min(1).max(40).optional(),
});

const NO_ANSWER_TEXT = 'אני לא בטוח איך לעזור בזה. אפשר ללחוץ על "דבר עם אדם" למטה, והצוות של פטרה יחזור אליך.';

export async function POST(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { session, businessId } = authResult;
  const userId = session.user.id;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: `אפשר לשלוח שאלה של עד ${ASSISTANT_MAX_MESSAGE_CHARS} תווים.` },
      { status: 400 }
    );
  }
  const { message, screen: pathname, conversationId } = parsed.data;

  if (!env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Petra AI לא זמין כרגע. נסו שוב מאוחר יותר." }, { status: 503 });
  }

  const context = await loadAssistantContext(session, businessId, pathname);

  const isFree = normalizeTier(context.tier) === "free";
  const [burst, daily] = await Promise.all([
    rateLimitAsync("assistant:burst", businessId, isFree ? RATE_LIMITS.ASSISTANT_BURST_FREE : RATE_LIMITS.ASSISTANT_BURST),
    rateLimitAsync("assistant:daily", businessId, isFree ? RATE_LIMITS.ASSISTANT_DAILY_FREE : RATE_LIMITS.ASSISTANT_DAILY),
  ]);
  if (!burst.allowed || !daily.allowed) {
    const retryAfterMs = !daily.allowed ? daily.retryAfterMs : burst.retryAfterMs;
    return NextResponse.json(
      {
        error: !daily.allowed
          ? "הגעתם למכסת השאלות היומית של Petra AI. אפשר להמשיך מחר, או לפנות אלינו דרך \"דבר עם אדם\"."
          : "נשלחו הרבה שאלות בזמן קצר. נסו שוב בעוד כמה דקות.",
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  // Conversation — must belong to this business AND this user.
  let conversation: { id: string };
  if (conversationId) {
    const existing = await prisma.assistantConversation.findFirst({
      where: { id: conversationId, businessId, userId },
      select: { id: true, _count: { select: { messages: true } } },
    });
    if (!existing) return NextResponse.json({ error: "השיחה לא נמצאה." }, { status: 404 });
    if (existing._count.messages >= ASSISTANT_MAX_CONVERSATION_MESSAGES) {
      return NextResponse.json(
        { error: "השיחה הזו ארוכה מדי. פתחו שיחה חדשה כדי להמשיך.", code: "conversation_full" },
        { status: 409 }
      );
    }
    conversation = existing;
  } else {
    conversation = await prisma.assistantConversation.create({
      data: { businessId, userId, screen: context.screen?.href ?? null },
      select: { id: true },
    });
  }

  await prisma.assistantMessage.create({
    data: { conversationId: conversation.id, businessId, role: "user", content: message, screen: context.screen?.href ?? null },
  });

  // Only the latest messages go to the model; the first one must be a user turn.
  const recent = await prisma.assistantMessage.findMany({
    where: { conversationId: conversation.id, businessId },
    orderBy: { createdAt: "desc" },
    take: ASSISTANT_HISTORY_MESSAGES,
    select: { role: true, content: true },
  });
  recent.reverse();
  while (recent.length > 0 && recent[0].role !== "user") recent.shift();
  const messages: Anthropic.MessageParam[] = recent.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const stream = anthropic.messages.stream(
    {
      model: env.ASSISTANT_MODEL,
      max_tokens: ASSISTANT_MAX_OUTPUT_TOKENS,
      // Short how-to answers from a document: low effort keeps them fast.
      output_config: { effort: "low" },
      system: [
        // Identical for every request → served from the prompt cache.
        { type: "text", text: ASSISTANT_STABLE_PROMPT, cache_control: { type: "ephemeral" } },
        // Per-request context, after the cache breakpoint.
        { type: "text", text: buildContextPrompt(context) },
      ],
      messages,
    },
    { signal: request.signal }
  );

  const encoder = new TextEncoder();
  const conversationIdOut = conversation.id;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // client went away — nothing to send to
        }
      };
      send({ type: "meta", conversationId: conversationIdOut });

      let text = "";
      try {
        stream.on("text", (delta) => {
          text += delta;
          send({ type: "delta", text: delta });
        });
        const final = await stream.finalMessage();

        // A safety decline or an empty answer: tell the user how to reach a person.
        if (final.stop_reason === "refusal" || !text.trim()) {
          const addition = text.trim() ? `\n\n${NO_ANSWER_TEXT}` : NO_ANSWER_TEXT;
          text += addition;
          send({ type: "delta", text: addition });
        }

        const saved = await prisma.assistantMessage.create({
          data: {
            conversationId: conversationIdOut,
            businessId,
            role: "assistant",
            content: text,
            screen: context.screen?.href ?? null,
          },
          select: { id: true },
        });
        send({ type: "done", messageId: saved.id });
      } catch (err) {
        if (!request.signal.aborted) {
          if (err instanceof Anthropic.RateLimitError) {
            send({ type: "error", message: "יש עומס כרגע. נסו שוב בעוד רגע." });
          } else if (err instanceof Anthropic.APIError) {
            console.error(`[assistant] Anthropic API error ${err.status}:`, err.message);
            send({ type: "error", message: "Petra AI לא הצליח לענות כרגע. נסו שוב." });
          } else {
            console.error("[assistant] stream error:", err);
            send({ type: "error", message: "Petra AI לא הצליח לענות כרגע. נסו שוב." });
          }
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed by a client disconnect
        }
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
