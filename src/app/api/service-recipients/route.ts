export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";
import { listRecipients, createRecipient, ServiceError } from "@/services/service-dogs";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    const callerMembership = session.memberships.find((m) => m.businessId === businessId && m.isActive);
    if (callerMembership && !hasTenantPermission(callerMembership.role as TenantRole, TENANT_PERMS.RECIPIENTS_SENSITIVE)) {
      return NextResponse.json({ error: "אין הרשאה לצפות בזכאים" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const membership = session.memberships.find((m) => m.businessId === businessId);
    const callerRole = (membership?.role ?? "user") as TenantRole;
    const canSeeSensitive = hasTenantPermission(callerRole, TENANT_PERMS.RECIPIENTS_SENSITIVE);

    const data = await listRecipients(businessId, prisma, { status, canSeeSensitive });
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/service-recipients error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת זכאים" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const postMembership = authResult.session.memberships.find((m) => m.businessId === authResult.businessId && m.isActive);
    if (postMembership && !hasTenantPermission(postMembership.role as TenantRole, TENANT_PERMS.RECIPIENTS_SENSITIVE)) {
      return NextResponse.json({ error: "אין הרשאה לנהל זכאים" }, { status: 403 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:service-recipients:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json();

    let recipient;
    try {
      recipient = await createRecipient(authResult.businessId, prisma, body);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "VALIDATION") {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(recipient, { status: 201 });
  } catch (error) {
    console.error("POST /api/service-recipients error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת מקבל" }, { status: 500 });
  }
}
