export const dynamic = "force-dynamic";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessPermission, isGuardError } from "@/lib/auth-guards";
import { TENANT_PERMS } from "@/lib/permissions";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";
import { ENTITY_TYPES } from "@/lib/activity-actions";
import { rateLimit } from "@/lib/rate-limit";
import { mergeConfirmToken } from "@/lib/customer-merge-plan";
import { resyncCustomerAppointmentsToGcal } from "@/lib/google-calendar";
import { previewCustomerMerge, mergeCustomers, ServiceError } from "@/services/customer-merge";

/** Merge is heavy (many sequential writes) and irreversible — keep it tight. */
const MERGE_RATE_LIMIT = { max: 10, windowMs: 60_000 };

const MergeBodySchema = z.object({
  sourceId: z.string().min(1).max(64),
  confirm: z.string().max(100),
});

function serviceErrorResponse(e: ServiceError) {
  const status = e.code === "NOT_FOUND" ? 404 : e.code === "CONFLICT" ? 409 : 400;
  return NextResponse.json({ error: e.message }, { status });
}

/** GET /api/customers/[id]/merge?sourceId=<dupId> — preview of what would move into [id]. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireBusinessPermission(request, TENANT_PERMS.CRITICAL_DELETE);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const sourceId = (request.nextUrl.searchParams.get("sourceId") ?? "").trim();
    if (!sourceId || sourceId.length > 64) {
      return NextResponse.json({ error: "חסר מזהה לקוח כפול" }, { status: 400 });
    }

    const preview = await previewCustomerMerge(businessId, prisma, params.id, sourceId);
    return NextResponse.json(preview);
  } catch (error) {
    if (error instanceof ServiceError) return serviceErrorResponse(error);
    console.error("Customer merge preview error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת תצוגת המיזוג" }, { status: 500 });
  }
}

/** POST /api/customers/[id]/merge { sourceId, confirm: "MERGE_<sourceId>" } — [id] stays, sourceId is deleted. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireBusinessPermission(request, TENANT_PERMS.CRITICAL_DELETE);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    const rl = rateLimit("api:customers:merge", `${businessId}:${session.user.id}`, MERGE_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });
    }

    const raw = await request.json().catch(() => null);
    const parsed = MergeBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "קלט לא תקין" }, { status: 400 });
    }
    const { sourceId, confirm } = parsed.data;
    if (confirm !== mergeConfirmToken(sourceId)) {
      return NextResponse.json({ error: "נדרש אישור מפורש למיזוג" }, { status: 428 });
    }

    const result = await mergeCustomers(businessId, prisma, params.id, sourceId);

    await logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.MERGE_CUSTOMER, {
      businessId,
      entityType: ENTITY_TYPES.CUSTOMER,
      entityId: result.target.id,
      entityLabel: result.target.name,
    });

    // Moved upcoming appointments now belong to the target → refresh their Google Calendar events
    // (title/address come from the customer). Non-critical.
    if (result.moved.appointments > 0) {
      await resyncCustomerAppointmentsToGcal(result.target.id, businessId).catch((err) =>
        console.error("Customer merge: gcal resync failed (non-critical):", err),
      );
    }

    return NextResponse.json({ ok: true, targetId: result.target.id, moved: result.moved });
  } catch (error) {
    if (error instanceof ServiceError) return serviceErrorResponse(error);
    console.error("Customer merge error:", error);
    return NextResponse.json({ error: "שגיאה במיזוג הלקוחות" }, { status: 500 });
  }
}
