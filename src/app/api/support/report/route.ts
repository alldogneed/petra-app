export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimitAsync, RATE_LIMITS } from "@/lib/rate-limit";
import { createSupportTicket } from "@/services/support-tickets";

export async function POST(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { session, businessId } = authResult;

  // Every ticket alerts the platform owner (WhatsApp + email) — cap per user and per business.
  const [rlUser, rlBiz] = await Promise.all([
    rateLimitAsync("support:report", session.user.id, RATE_LIMITS.SUPPORT_WRITE),
    rateLimitAsync("support:report:biz", businessId, { max: 20, windowMs: 60 * 60 * 1000 }),
  ]);
  if (!rlUser.allowed || !rlBiz.allowed) {
    return NextResponse.json({ error: "נשלחו כמה פניות בזמן קצר. נסו שוב בעוד כמה דקות." }, { status: 429 });
  }

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
  // Validate URL scheme to prevent javascript: / data: XSS when rendered as a link
  if (typeof pageUrl === "string" && pageUrl.trim()) {
    try {
      const parsedUrl = new URL(pageUrl.trim());
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return NextResponse.json({ error: "כתובת עמוד לא תקינה" }, { status: 400 });
      }
    } catch {
      // Not a valid URL — store as-is (safe as plain text, just won't be a clickable link)
    }
  }
  // Limit screenshot to ~2MB base64 (~2.7M chars)
  if (typeof screenshotBase64 === "string" && screenshotBase64.length > 2_800_000) {
    return NextResponse.json({ error: "צילום מסך גדול מדי (מקסימום 2MB)" }, { status: 400 });
  }

  // Saves the ticket + its first history event, emails info@ and alerts the owner (never throws on alerts).
  const ticket = await createSupportTicket({
    businessId,
    actor: { userId: session.user.id, name: session.user.name ?? null, email: session.user.email },
    title: title.trim(),
    description: description.trim(),
    pageUrl: typeof pageUrl === "string" ? pageUrl.trim() : null,
    screenshotBase64: typeof screenshotBase64 === "string" ? screenshotBase64 : null,
  });

  return NextResponse.json({ id: ticket.id }, { status: 201 });
}
