export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { sendSupportTicketEmail } from "@/lib/email";
import { env } from "@/lib/env";

export async function POST(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { session, businessId } = authResult;

  let body: { title?: string; description?: string; pageUrl?: string; screenshotBase64?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title, description, pageUrl, screenshotBase64 } = body;
  if (!title || typeof title !== "string" || title.trim().length < 3) {
    return NextResponse.json({ error: "כותרת קצרה מדי" }, { status: 400 });
  }
  if (title.trim().length > 200) {
    return NextResponse.json({ error: "כותרת ארוכה מדי (מקסימום 200 תווים)" }, { status: 400 });
  }
  if (!description || typeof description !== "string" || description.trim().length < 10) {
    return NextResponse.json({ error: "תיאור קצר מדי" }, { status: 400 });
  }
  if (description.trim().length > 5000) {
    return NextResponse.json({ error: "תיאור ארוך מדי (מקסימום 5000 תווים)" }, { status: 400 });
  }
  if (typeof pageUrl === "string" && pageUrl.length > 2000) {
    return NextResponse.json({ error: "כתובת עמוד ארוכה מדי" }, { status: 400 });
  }
  // Limit screenshot to ~2MB base64 (~2.7M chars)
  if (typeof screenshotBase64 === "string" && screenshotBase64.length > 2_800_000) {
    return NextResponse.json({ error: "צילום מסך גדול מדי (מקסימום 2MB)" }, { status: 400 });
  }

  const [ticket, business] = await Promise.all([
    prisma.supportTicket.create({
      data: {
        businessId,
        userId: session.user.id,
        title: title.trim(),
        description: description.trim(),
        pageUrl: typeof pageUrl === "string" ? pageUrl.trim() : null,
        status: "open",
      },
    }),
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
  ]);

  // Send email notification — non-blocking (don't fail the request if email fails)
  try {
    const appUrl = env.APP_URL ?? "https://petra-app.com";
    await sendSupportTicketEmail({
      ticketId: ticket.id,
      businessName: business?.name ?? businessId,
      userEmail: session.user.email,
      title: ticket.title,
      description: ticket.description,
      pageUrl: ticket.pageUrl,
      adminUrl: `${appUrl}/owner/support`,
      screenshotBase64: typeof screenshotBase64 === "string" ? screenshotBase64 : null,
    });
  } catch (err) {
    console.error("[SupportTicket] Failed to send email:", err);
  }

  return NextResponse.json({ id: ticket.id }, { status: 201 });
}
