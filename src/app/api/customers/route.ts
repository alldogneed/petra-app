export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

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
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const customers = await prisma.customer.findMany({
        where,
        take: 500,
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
          _count: { select: { pets: true, appointments: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const enriched = customers.map((c) => {
        // Parse tags
        const tags: string[] = (() => {
          try {
            return JSON.parse(c.tags);
          } catch {
            return [];
          }
        })();
        const isVip = tags.some(
          (t) => t.toLowerCase().includes("vip")
        );

        // Separate past and future appointments
        const pastAppts = c.appointments
          .filter((a) => new Date(a.date) <= now && a.status !== "canceled")
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
        const futureAppts = c.appointments
          .filter((a) => new Date(a.date) > now && a.status === "scheduled")
          .sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );
        const recentAppts = pastAppts.filter(
          (a) => new Date(a.date) >= thirtyDaysAgo
        );

        // Compute status
        const isActive = recentAppts.length > 0 || futureAppts.length > 0;
        const status = isVip ? "vip" : isActive ? "active" : "dormant";

        // Last & next appointments
        const lastAppt = pastAppts[0] || null;
        const nextAppt = futureAppts[0] || null;

        // Financial summary
        const totalPaid = c.payments
          .filter((p) => p.status === "paid")
          .reduce((s, p) => s + p.amount, 0);
        const totalPending = c.payments
          .filter((p) => p.status === "pending")
          .reduce((s, p) => s + p.amount, 0);
        const hasDeposits = c.payments.some(
          (p) => p.isDeposit && p.status === "paid"
        );

        // Unique service types used by this customer
        const serviceTypes = [
          ...new Set(c.appointments.map((a) => a.service?.type).filter(Boolean)),
        ];

        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          address: c.address,
          notes: c.notes,
          tags: c.tags,
          source: c.source,
          createdAt: c.createdAt,
          pets: c.pets,
          _count: c._count,
          status,
          lastAppointment: lastAppt
            ? {
                date: lastAppt.date,
                startTime: lastAppt.startTime,
                serviceName: lastAppt.service?.name ?? null,
              }
            : null,
          nextAppointment: nextAppt
            ? {
                date: nextAppt.date,
                startTime: nextAppt.startTime,
                serviceName: nextAppt.service?.name ?? null,
              }
            : null,
          financial: { totalPaid, totalPending, hasDeposits },
          serviceTypes,
        };
      });

      return NextResponse.json(enriched);
    }

    // ─── Original mode (backward compatible) ───
    const full = searchParams.get("full") === "1";

    const customers = await prisma.customer.findMany({
      where,
      take: 1000,
      include: full
        ? { pets: { select: { id: true, name: true, species: true } } }
        : { _count: { select: { pets: true, appointments: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(customers);
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

    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email || null,
        address: body.address || null,
        notes: body.notes || null,
        tags,
        source: body.source || "manual",
        businessId,
      },
    });

    logCurrentUserActivity("CREATE_CUSTOMER");

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
