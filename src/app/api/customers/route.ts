export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { checkFirstCustomer } from "@/lib/engagement-service";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";
import {
  listCustomers, createCustomer, ServiceError,
  type CustomerListOptions, type EnrichedCustomer,
} from "@/services/clients";

function maskPii<T extends { address?: string | null }>(item: T): T {
  return { ...item, address: null };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    const membership = session.memberships.find((m) => m.businessId === businessId && m.isActive);
    if (membership && !hasTenantPermission(membership.role, TENANT_PERMS.CUSTOMERS_PII)) {
      return NextResponse.json({ error: "אין הרשאה לצפות בלקוחות" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const opts: CustomerListOptions = {
      search: searchParams.get("search"),
      tag: searchParams.get("tag"),
      enhanced: searchParams.get("enhanced") === "1",
      serviceType: searchParams.get("serviceType"),
      cursor: searchParams.get("cursor") || undefined,
      take: parseInt(searchParams.get("take") ?? "50", 10),
      sortBy: (searchParams.get("sortBy") as CustomerListOptions["sortBy"]) ?? "newest",
      full: searchParams.get("full") === "1",
    };

    const result = await listCustomers(businessId, prisma, opts);

    // PII masking — role-based, HTTP-layer concern
    const callerRole = (membership?.role ?? "user") as TenantRole;
    const canSeePii = hasTenantPermission(callerRole, TENANT_PERMS.CUSTOMERS_PII);

    if (result.enhanced) {
      const customers = canSeePii
        ? result.customers
        : result.customers.map((c) => maskPii(c as EnrichedCustomer));
      return NextResponse.json({ customers, nextCursor: result.nextCursor, hasMore: result.hasMore, total: result.total });
    }

    const customers = canSeePii ? result.customers : result.customers.map(maskPii);
    if (result.nextCursor !== undefined) {
      return NextResponse.json({ customers, nextCursor: result.nextCursor, hasMore: result.hasMore, total: result.total ?? null });
    }
    return NextResponse.json(customers);
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

    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const body = await request.json();

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
          e.code === "NOT_FOUND" ? 404 :
          e.code === "VALIDATION" ? 400 : 400;
        return NextResponse.json({ error: e.message, ...(e.details as object | null ?? {}) }, { status });
      }
      throw e;
    }

    logCurrentUserActivity("CREATE_CUSTOMER");
    // Fire-and-forget: first-customer engagement notification
    checkFirstCustomer(authResult.session.user.id, businessId);

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Customers POST error:", error);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
