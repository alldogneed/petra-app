export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimitAsync, RATE_LIMITS } from "@/lib/rate-limit";
import { supportScope } from "@/lib/support-access";
import { validateSupportReply } from "@/lib/support-tickets";
import { addCustomerReply, ServiceError } from "@/services/support-tickets";

/** POST { body } — the customer answers in their ticket (a resolved ticket reopens). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { session, businessId } = authResult;
  const scope = supportScope(session, businessId);
  if (!scope.canReply) {
    return NextResponse.json({ error: "לא ניתן להשיב בשם העסק במצב התחזות" }, { status: 403 });
  }

  const rl = await rateLimitAsync("support:reply", session.user.id, RATE_LIMITS.API_WRITE);
  if (!rl.allowed) return NextResponse.json({ error: "יותר מדי הודעות בזמן קצר. נסו שוב בעוד רגע." }, { status: 429 });

  let raw: { body?: unknown };
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const v = validateSupportReply(raw.body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  try {
    const result = await addCustomerReply(
      scope,
      params.id,
      { userId: session.user.id, name: session.user.name ?? null, email: session.user.email },
      v.body
    );
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof ServiceError && e.code === "NOT_FOUND") return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
