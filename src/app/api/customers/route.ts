export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getMaxCustomers } from "@/lib/feature-flags";
import { checkFirstCustomer } from "@/lib/engagement-service";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";
import { validateIsraeliPhone, validateEmail, sanitizeName, normalizeIsraeliPhone } from "@/lib/validation";

/** Strip PII from a customer object for callers who cannot see sensitive data */
function maskCustomerPii<T extends { address?: string | null }>(c: T): T {
  return { ...c, address: null };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { businessId, session } = authResult;

    // Staff cannot access customer data
    const membership = session.memberships.find((m) => m.businessId === businessId && m.isActive);
    if (membership && !hasTenantPermission(membership.role, TENANT_PERMS.CUSTOMERS_PII)) {
      return NextResponse.json({ error: "אין הרשאה לצפות בלקוחות" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const rawSearch = searchParams.get("search");
    const search = rawSearch ? rawSearch.slice(0, 100) : null; // max 100 chars
    const tag = searchParams.get("tag")?.slice(0, 50);
    const enhanced = searchParams.get("enhanced") === "1";
    const serviceType = searchParams.get("serviceType")?.slice(0, 50) || null;
    const cursor = searchParams.get("cursor") || undefined;
    const rawTake = parseInt(searchParams.get("take") ?? "50", 10);
    const take = Math.min(Math.max(rawTake, 1), 100); // clamp 1–100
    const sortBy = searchParams.get("sortBy") ?? "newest"; // "name_asc" | "newest" | "oldest"

    const orderBy =
      sortBy === "name_asc" ? [{ name: "asc" as const }, { id: "asc" as const }] :
      sortBy === "oldest"   ? [{ createdAt: "asc" as const }, { id: "asc" as const }] :
                              [{ createdAt: "desc" as const }, { id: "desc" as const }]; // newest (default)

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

    // ─── name_asc: Hebrew-first sort via raw SQL ─────────────────────────────
    // PostgreSQL C collation sorts Hebrew (U+05D0-U+05EA) after ASCII, so we
    // bucket by first-character code point: Hebrew=0, English=1, Digits=2, Other=3.
    if (sortBy === "name_asc") {
      const offset = cursor && /^\d+$/.test(cursor) ? parseInt(cursor, 10) : 0;

      const searchFrag = search
        ? Prisma.sql`AND (
            c.name ILIKE ${`%${search}%`} OR
            c.phone LIKE ${`%${search}%`} OR
            c.email ILIKE ${`%${search}%`}
            OR EXISTS (SELECT 1 FROM "Pet" p WHERE p."customerId" = c.id AND p.name ILIKE ${`%${search}%`})
          )`
        : Prisma.sql``;

      const tagFrag = tag
        ? Prisma.sql`AND c.tags LIKE ${`%${tag}%`}`
        : Prisma.sql``;

      const serviceTypeFrag = serviceType
        ? Prisma.sql`AND EXISTS (
            SELECT 1 FROM "Appointment" a
            LEFT JOIN "Service" s ON s.id = a."serviceId"
            WHERE a."customerId" = c.id AND s.type = ${serviceType}
          )`
        : Prisma.sql``;

      const idRows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT c.id FROM "Customer" c
        WHERE c."businessId" = ${businessId}
        ${searchFrag}
        ${tagFrag}
        ${serviceTypeFrag}
        ORDER BY
          CASE
            WHEN coalesce(ascii(left(c.name, 1)), 0) BETWEEN 1488 AND 1514 THEN 0
            WHEN coalesce(ascii(left(c.name, 1)), 0) BETWEEN 65 AND 90
              OR coalesce(ascii(left(c.name, 1)), 0) BETWEEN 97 AND 122 THEN 1
            WHEN coalesce(ascii(left(c.name, 1)), 0) BETWEEN 48 AND 57 THEN 2
            ELSE 3
          END ASC,
          c.name ASC,
          c.id ASC
        LIMIT ${take + 1}
        OFFSET ${offset}
      `;

      const hasMore = idRows.length > take;
      const ids = idRows.slice(0, take).map((r) => r.id);
      const nextCursorRaw = hasMore ? String(offset + take) : null;

      let totalRaw: number | null = null;
      if (!cursor) {
        totalRaw = await prisma.customer.count({ where });
      }

      if (enhanced) {
        const fetched = await prisma.customer.findMany({
          where: { id: { in: ids } },
          include: {
            pets: { select: { id: true, name: true, species: true, breed: true } },
            appointments: {
              select: { date: true, startTime: true, status: true, service: { select: { name: true, type: true } } },
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
            trainingPrograms: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
            _count: { select: { pets: true, appointments: true } },
          },
        });
        const cmap = new Map(fetched.map((c) => [c.id, c]));
        const page2 = ids.map((id) => cmap.get(id)).filter(Boolean) as typeof fetched;

        const enrichedPage2 = page2.map((c) => {
          const tagsParsed: string[] = (() => { try { return JSON.parse(c.tags); } catch { return []; } })();
          const isVip = tagsParsed.some((t) => t.toLowerCase().includes("vip"));
          const now2 = new Date();
          const thirtyDaysAgo2 = new Date(now2.getTime() - 30 * 24 * 60 * 60 * 1000);
          const pastAppts = c.appointments.filter((a) => new Date(a.date) <= now2 && a.status !== "canceled").sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const futureAppts = c.appointments.filter((a) => new Date(a.date) > now2 && a.status === "scheduled").sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const recentAppts = pastAppts.filter((a) => new Date(a.date) >= thirtyDaysAgo2);
          const isInBoarding = c.boardingStays.length > 0;
          const hasActiveTraining = c.trainingPrograms.length > 0;
          const hasFutureAppointment = futureAppts.length > 0;
          const sevenDaysAgo = new Date(now2.getTime() - 7 * 24 * 60 * 60 * 1000);
          const isNewCustomer = new Date(c.createdAt) >= sevenDaysAgo;
          const isActive = isInBoarding || hasActiveTraining || hasFutureAppointment || isNewCustomer;
          const status = isVip ? "vip" : isActive ? "active" : "dormant";
          const lastAppt = pastAppts[0] || null;
          const nextAppt = futureAppts[0] || null;
          const totalPaid = c.payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
          const totalPending = c.payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
          const hasDeposits = c.payments.some((p) => p.isDeposit);
          const serviceTypes = [...new Set(c.appointments.map((a) => a.service?.type).filter(Boolean))];
          return {
            id: c.id, name: c.name, phone: c.phone, email: c.email, address: c.address, idNumber: c.idNumber, tags: c.tags, notes: c.notes, source: c.source, createdAt: c.createdAt,
            pets: c.pets, _count: c._count,
            status, isVip, isInBoarding, hasActiveTraining,
            appointmentsLast30: recentAppts.length,
            lastAppointment: lastAppt ? { date: lastAppt.date, startTime: lastAppt.startTime, serviceName: lastAppt.service?.name ?? null } : null,
            nextAppointment: nextAppt ? { date: nextAppt.date, startTime: nextAppt.startTime, serviceName: nextAppt.service?.name ?? null } : null,
            financial: { totalPaid, totalPending, hasDeposits },
            serviceTypes,
          };
        });
        const mbr2 = authResult.session.memberships.find((m) => m.businessId === businessId);
        const role2 = (mbr2?.role ?? "user") as TenantRole;
        const pii2 = hasTenantPermission(role2, TENANT_PERMS.CUSTOMERS_PII);
        const masked2 = pii2 ? enrichedPage2 : enrichedPage2.map(maskCustomerPii);
        return NextResponse.json({ customers: masked2, nextCursor: nextCursorRaw, hasMore, total: totalRaw });
      }

      // Non-enhanced name_asc
      const full2 = searchParams.get("full") === "1";
      const fetched2 = await prisma.customer.findMany({
        where: { id: { in: ids } },
        include: full2
          ? { pets: { select: { id: true, name: true, species: true } } }
          : { _count: { select: { pets: true, appointments: true } } },
      });
      const cmap2 = new Map(fetched2.map((c) => [c.id, c]));
      const ordered2 = ids.map((id) => cmap2.get(id)).filter(Boolean) as typeof fetched2;
      const mbr3 = authResult.session.memberships.find((m) => m.businessId === businessId);
      const role3 = (mbr3?.role ?? "user") as TenantRole;
      const pii3 = hasTenantPermission(role3, TENANT_PERMS.CUSTOMERS_PII);
      return NextResponse.json(pii3 ? ordered2 : ordered2.map(maskCustomerPii));
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
        orderBy,
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
        const sevenDaysAgo = new Date(now2.getTime() - 7 * 24 * 60 * 60 * 1000);
        const isNewCustomer = new Date(c.createdAt) >= sevenDaysAgo;
        const isActive = isInBoarding || hasActiveTraining || hasFutureAppointment || isNewCustomer;
        const status = isVip ? "vip" : isActive ? "active" : "dormant";
        const lastAppt = pastAppts[0] || null;
        const nextAppt = futureAppts[0] || null;
        const totalPaid = c.payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
        const totalPending = c.payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
        const hasDeposits = c.payments.some((p) => p.isDeposit);
        const serviceTypes = [...new Set(c.appointments.map((a) => a.service?.type).filter(Boolean))];
        return {
          id: c.id, name: c.name, phone: c.phone, email: c.email, address: c.address, idNumber: c.idNumber, tags: c.tags, notes: c.notes, source: c.source, createdAt: c.createdAt,
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

      // Total count (only on first page — cursor not set)
      let total: number | null = null;
      if (!cursor) {
        total = await prisma.customer.count({ where });
      }

      return NextResponse.json({ customers: maskedPage, nextCursor, hasMore, total });
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
      orderBy,
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
          { error: `הגעת לתקרת ${maxCustomers} הלקוחות במסלול החינמי. שדרג לבייסיק כדי להוסיף ללא הגבלה.`, code: "LIMIT_REACHED" },
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
    const safeName = sanitizeName(body.name);

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

    // Server-side phone validation
    const phoneErr = validateIsraeliPhone(body.phone);
    if (phoneErr) {
      return NextResponse.json({ error: phoneErr }, { status: 400 });
    }

    // Server-side email validation
    if (body.email) {
      const emailErr = validateEmail(body.email);
      if (emailErr) {
        return NextResponse.json({ error: emailErr }, { status: 400 });
      }
    }

    // Normalize phone to local display format (05X-XXXXXXX)
    const normalizedPhone = normalizeIsraeliPhone(body.phone);

    // Compute phoneNorm for consistent lookups (same as booking wizard)
    const _phoneDigits = normalizedPhone.replace(/\D/g, "");
    const phoneNorm = _phoneDigits.startsWith("0") && _phoneDigits.length >= 9
      ? "972" + _phoneDigits.slice(1)
      : _phoneDigits || null;

    // Duplicate phone detection
    if (phoneNorm) {
      const existing = await prisma.customer.findFirst({
        where: { businessId, phoneNorm },
        select: { id: true, name: true },
      });
      if (existing) {
        return NextResponse.json(
          { error: `לקוח עם מספר טלפון זה כבר קיים במערכת (${existing.name})`, code: "DUPLICATE_PHONE", existingId: existing.id },
          { status: 409 }
        );
      }
    }

    const customer = await prisma.customer.create({
      data: {
        name: safeName,
        phone: normalizedPhone,
        phoneNorm,
        email: body.email || null,
        address: body.address || null,
        idNumber: body.idNumber || null,
        secondContactName: body.secondContactName || null,
        secondContactPhone: body.secondContactPhone || null,
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
