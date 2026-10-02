export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { ENTITY_TYPES } from "@/lib/activity-actions";
import { isGuardError } from "@/lib/auth-guards";
import { requireCustomerAccess, callerCan } from "@/lib/customer-access";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { checkFirstCustomer } from "@/lib/engagement-service";
import { TENANT_PERMS } from "@/lib/permissions";
import { parseCustomerFilters } from "@/lib/customer-filters";
import { listCustomers, createCustomer, ServiceError } from "@/services/clients";

// GET /api/customers — list (basic: plain array for pickers; enhanced=1: paged + filters + stats).
// Filter/sort params: see src/lib/customer-filters.ts (parseCustomerFilters).
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCustomerAccess(request, "read");
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    const { searchParams } = new URL(request.url);
    const filters = parseCustomerFilters(searchParams);
    const includeFinance = callerCan(session, businessId, TENANT_PERMS.FINANCE_READ);
    const takeRaw = parseInt(searchParams.get("take") ?? searchParams.get("limit") ?? "50", 10);
    const cursor = (searchParams.get("cursor") || "").slice(0, 64) || undefined;
    const enhanced = searchParams.get("enhanced") === "1";

    const result = await listCustomers(businessId, prisma, {
      ...filters,
      enhanced,
      cursor,
      take: Number.isFinite(takeRaw) ? takeRaw : 50,
      full: searchParams.get("full") === "1",
      includeFinance,
      withStats: enhanced && !cursor,
    });

    if (result.enhanced) {
      return NextResponse.json({
        customers: result.customers,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        total: result.total,
        ...(result.stats ? { stats: result.stats } : {}),
      });
    }
    return NextResponse.json(result.customers);
  } catch (error) {
    console.error("Customers GET error:", error);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:customers:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });
    }

    const authResult = await requireCustomerAccess(request, "write");
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
    }
    if (!body.phone || typeof body.phone !== "string" || !body.phone.trim()) {
      return NextResponse.json({ error: "Missing required field: phone" }, { status: 400 });
    }

    let customer;
    try {
      customer = await createCustomer(businessId, prisma, {
        name: body.name,
        phone: body.phone,
        email: body.email || null,
        address: body.address || null,
        idNumber: body.idNumber || null,
        secondContactName: body.secondContactName || null,
        secondContactPhone: body.secondContactPhone || null,
        notes: body.notes || null,
        tags: body.tags,
        source: body.source || "manual",
      });
    } catch (e) {
      if (e instanceof ServiceError) {
        const status =
          e.code === "CONFLICT" ? 409 :
          e.code === "NOT_FOUND" ? 404 : 400;
        return NextResponse.json({ error: e.message, ...(e.details as object | null ?? {}) }, { status });
      }
      throw e;
    }

    logActivity(authResult.session.user.id, authResult.session.user.name, "CREATE_CUSTOMER", {
      businessId,
      entityType: ENTITY_TYPES.CUSTOMER,
      entityId: customer.id,
      entityLabel: customer.name,
    });
    // Fire-and-forget: first-customer engagement notification
    checkFirstCustomer(authResult.session.user.id, businessId);

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Customers POST error:", error);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
