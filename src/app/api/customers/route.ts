export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getMaxCustomers } from "@/lib/feature-flags";
import { checkFirstCustomer } from "@/lib/engagement-service";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";

/** Strip PII from a customer object for callers who cannot see sensitive data */
function maskCustomerPii<T extends { address?: string | null }>(c: T): T {
  return { ...c, address: null };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { businessId } = authResult;
    const { searchParams } = new URL(request.url);
    const rawSearch = searchParams.get("search");
    const search = rawSearch ? rawSearch.slice(0, 100) : null; // max 100 chars
    const tag = searchParams.get("tag")?.slice(0, 50);
    const enhanced = searchParams.get("enhanced") === "1";
    const serviceType = searchParams.get("serviceType");
    const cursor = searchParams.get("cursor") || undefined;
    const rawTake = parseInt(searchParams.get("take") ?? "50", 10);
    const take = Math.min(Math.max(rawTake, 1), 100); // clamp 1–100

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { businessId };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
      // Also search by pet name in enhanced mode
      if (enhanced) {
        where.OR.push({ pets: { some: { name: { contains: search } } } });
      }
    }

    if (tag) {
      where.tags = { contains: tag };
    }

    // Filter by service type: only customers with appointments of this service type
    if (serviceType) {
      where.appointments = { some: { service: { type: serviceType } } };
    }

    // ─── Enhanced mode: return rich data for the management dashboard ───
    if (enhanced) {
      const customers = await prisma.customer.findMany({
        where,
        take: take + 1, // fetch one extra to determine hasMore
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          pets: {
            select: { id: true, name: true, species: true, breed: true },
          },
          appointments: {
            select: {
              date: true,
              startTime: true,
              status: true,
              service: { select: { name: true, type: true } },
            },
            orderBy: { date: "desc" },
            take: 20,
          },
          payments: {
            select: { amount: true, status: true, isDeposit: true },
            orderBy: { createdAt: "desc" },
            take: 50,
          },
          boardingStays: {
            where: { status: { in: ["reserved", "checked_in"] } },
            select: { id: true, status: true },
            take: 1,
          },
          trainingPrograms: {
            where: { status: "ACTIVE" },
            select: { id: true },
            take: 1,
          },
          _count: { select: { pets: true, appointments: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const hasMore = customers.length > take;
      const page = hasMore ? customers.slice(0, take) : customers;
      const nextCursor = hasMore ? page[page.length - 1]?.id : null;
      const enrichedPage = page.map((c) => {
        const tags: string[] = (() => {
          try { return JSON.parse(c.tags); } catch { return []; }
        })();
        const isVip = tags.some((t) => t.toLowerCase().includes("vip"));
        const now2 = new Date();
        const thirtyDaysAgo2 = new Date(now2.getTime() - 30 * 24 * 60 * 60 * 1000);
        const pastAppts = c.appointments.filter((a) => new Date(a.date) <= now2 && a.status !== "canceled").sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const futureAppts = c.appointments.filter((a) => new Date(a.date) > now2 && a.status === "scheduled").sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const recentAppts = pastAppts.filter((a) => new Date(a.date) >= thirtyDaysAgo2);
        const isInBoarding = c.boardingStays.length > 0;
        const hasActiveTraining = c.trainingPrograms.length > 0;
        const hasFutureAppointment = futureAppts.length > 0;
        const isActive = isInBoarding || hasActiveTraining || hasFutureAppointment;
        const status = isVip ? "vip" : isActive ? "active" : "dormant";
        const lastAppt = pastAppts[0] || null;
        const nextAppt = futureAppts[0] || null;
        const totalPaid = c.payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
        const totalPending = c.payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
        const hasDeposits = c.payments.some((p) => p.isDeposit);
        const serviceTypes = [...new Set(c.appointments.map((a) => a.service?.type).filter(Boolean))];
        return {
          id: c.id, name: c.name, phone: c.phone, email: c.email, address: c.address, tags: c.tags, notes: c.notes, source: c.source, createdAt: c.createdAt,
          pets: c.pets, _count: c._count,
          status, isVip, isInBoarding, hasActiveTraining,
          appointmentsLast30: recentAppts.length,
          lastAppointment: lastAppt ? { date: lastAppt.date, startTime: lastAppt.startTime, serviceName: lastAppt.service?.name ?? null } : null,
          nextAppointment: nextAppt ? { date: nextAppt.date, startTime: nextAppt.startTime, serviceName: nextAppt.service?.name ?? null } : null,
          financial: { totalPaid, totalPending, hasDeposits },
          serviceTypes,
        };
      });
      // PII masking
      const membership2 = authResult.session.memberships.find((m) => m.businessId === businessId);
      const callerRole2 = (membership2?.role ?? "user") as TenantRole;
      const canSeePii2 = hasTenantPermission(callerRole2, TENANT_PERMS.CUSTOMERS_PII);
      const maskedPage = canSeePii2 ? enrichedPage : enrichedPage.map(maskCustomerPii);

      return NextResponse.json({ customers: maskedPage, nextCursor, hasMore });
    }

    // ─── Original mode (backward compatible) ───
    const full = searchParams.get("full") === "1";

    const customers = await prisma.customer.findMany({
      where,
      take: Math.min(take, 100),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: full
        ? { pets: { select: { id: true, name: true, species: true } } }
        : { _count: { select: { pets: true, appointments: true } } },
      orderBy: { createdAt: "desc" },
    });

    // PII masking for original mode too
    const membership3 = authResult.session.memberships.find((m) => m.businessId === businessId);
    const callerRole3 = (membership3?.role ?? "user") as TenantRole;
    const canSeePii3 = hasTenantPermission(callerRole3, TENANT_PERMS.CUSTOMERS_PII);
    const result = canSeePii3 ? customers : customers.map(maskCustomerPii);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Customers GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
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

    // ── Tier-based customer limit enforcement ─────────────────────────────────
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { tier: true },
    });
    const maxCustomers = getMaxCustomers(business?.tier);
    if (maxCustomers !== null) {
      const count = await prisma.customer.count({ where: { businessId } });
      if (count >= maxCustomers) {
        return NextResponse.json(
          { error: `הגעת למגבלת הלקוחות (${maxCustomers}) בחבילה החינמית. שדרג/י לחבילת בייסיק להוספת לקוחות ללא הגבלה.`, code: "CUSTOMER_LIMIT_REACHED" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();

    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    let tags = "[]";
    if (body.tags) {
      try {
        // If already a valid JSON array string (from frontend), use as-is
        const parsed = JSON.parse(body.tags);
        tags = Array.isArray(parsed) ? JSON.stringify(parsed) : "[]";
      } catch {
        // Fallback: comma-separated string
        tags = JSON.stringify(
          body.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
        );
      }
    }

    if (!body.phone || typeof body.phone !== "string" || !body.phone.trim()) {
      return NextResponse.json(
        { error: "Missing required field: phone" },
        { status: 400 }
      );
    }

    // Compute phoneNorm for consistent lookups (same as booking wizard)
    const _phoneDigits = body.phone.replace(/\D/g, "");
    const phoneNorm = _phoneDigits.startsWith("0") && _phoneDigits.length >= 9
      ? "972" + _phoneDigits.slice(1)
      : _phoneDigits || null;

    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        phone: body.phone,
        phoneNorm,
        email: body.email || null,
        address: body.address || null,
        notes: body.notes || null,
        tags,
        source: body.source || "manual",
        businessId,
      },
    });

    logCurrentUserActivity("CREATE_CUSTOMER");

    // Fire-and-forget: first-customer engagement notification
    checkFirstCustomer(authResult.session.user.id, businessId);

    await prisma.timelineEvent.create({
      data: {
        type: "customer_created",
        description: `\u05DC\u05E7\u05D5\u05D7 \u05D7\u05D3\u05E9 \u05E0\u05D5\u05E6\u05E8: ${customer.name}`,
        customerId: customer.id,
        businessId,
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Customers POST error:", error);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}
