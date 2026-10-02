export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isGuardError } from "@/lib/auth-guards";
import { requireCustomerAccess } from "@/lib/customer-access";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS, ENTITY_TYPES } from "@/lib/activity-actions";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { applyTagChange, cleanText, parseTagList, TAG_MAX_LEN } from "@/lib/customer-filters";

const MAX_IDS = 500;
const ACTIONS = ["add_tag", "remove_tag"] as const;
type BulkAction = (typeof ACTIONS)[number];

// POST /api/customers/bulk — { action: "add_tag"|"remove_tag", tag, ids[] } → { updated }
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCustomerAccess(request, "write");
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    const rl = rateLimit("api:customers:bulk", businessId, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const action = body?.action as BulkAction;
    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ error: "פעולה לא נתמכת" }, { status: 400 });
    }
    const tag = typeof body?.tag === "string" ? cleanText(body.tag, TAG_MAX_LEN + 1) : null;
    if (!tag || tag.length > TAG_MAX_LEN) {
      return NextResponse.json({ error: `תגית חייבת להכיל 1-${TAG_MAX_LEN} תווים` }, { status: 400 });
    }
    const rawIds: unknown = body?.ids;
    if (!Array.isArray(rawIds) || rawIds.length === 0 || rawIds.length > MAX_IDS) {
      return NextResponse.json({ error: `יש לבחור בין 1 ל-${MAX_IDS} לקוחות` }, { status: 400 });
    }
    const ids = Array.from(
      new Set(rawIds.filter((v): v is string => typeof v === "string" && v.length > 0 && v.length <= 64))
    );
    if (ids.length === 0) {
      return NextResponse.json({ error: "מזהי לקוחות לא תקינים" }, { status: 400 });
    }

    // Only customers of this business (ids from the client are never trusted).
    const customers = await prisma.customer.findMany({
      where: { businessId, id: { in: ids } },
      select: { id: true, tags: true },
    });

    // Group by resulting tags string → one updateMany per distinct result.
    const groups = new Map<string, string[]>();
    for (const c of customers) {
      const before = parseTagList(c.tags);
      const after = applyTagChange(before, action, tag);
      if (after.length === before.length && after.every((t, i) => t === before[i])) continue;
      const key = JSON.stringify(after);
      const list = groups.get(key) ?? [];
      list.push(c.id);
      groups.set(key, list);
    }

    let updated = 0;
    for (const [tags, groupIds] of Array.from(groups.entries())) {
      if (groupIds.length === 0) continue; // never run updateMany with an empty/undefined filter
      const r = await prisma.customer.updateMany({
        where: { businessId, id: { in: groupIds } },
        data: { tags },
      });
      updated += r.count;
    }

    await logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.BULK_UPDATE_CUSTOMERS, {
      businessId,
      entityType: ENTITY_TYPES.CUSTOMER,
      entityLabel: `${action === "add_tag" ? "הוספת" : "הסרת"} תגית "${tag}" — ${updated} לקוחות`,
    });

    return NextResponse.json({ updated, matched: customers.length });
  } catch (error) {
    console.error("Customers bulk error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון הלקוחות" }, { status: 500 });
  }
}
