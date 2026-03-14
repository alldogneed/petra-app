export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { InvoicingService } from "@/lib/invoicing/invoicing-service";
import { enqueueInvoiceJob } from "@/lib/invoicing/invoicing-jobs";
import { notifyPaymentReceived } from "@/lib/engagement-service";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    // Staff (user/volunteer) cannot access financial data
    const membership = session.memberships.find((m) => m.businessId === businessId);
    const callerRole = (membership?.role ?? "user") as TenantRole;
    if (!hasTenantPermission(callerRole, TENANT_PERMS.FINANCE_READ)) {
      return NextResponse.json({ error: "אין הרשאה לצפייה בנתונים פיננסיים" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: any = { businessId: authResult.businessId };
    if (status) {
      where.status = status;
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        appointment: {
          include: {
            service: { select: { name: true } },
          },
        },
        boardingStay: {
          include: {
            pet: { select: { name: true } },
            room: { select: { name: true } },
          },
        },
        order: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error("Failed to fetch payments:", error);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:payments:write", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי בקשות" }, { status: 429 });
    }

    const body = await request.json();
    const { amount, method, status, customerId, appointmentId, boardingStayId, orderId, notes } =
      body;

    if (!amount || !method || !status || !customerId) {
      return NextResponse.json(
        { error: "Missing required fields: amount, method, status, customerId" },
        { status: 400 }
      );
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    const validMethods = ["cash", "credit_card", "bank_transfer", "bit", "paybox", "check"];
    if (!validMethods.includes(method)) {
      return NextResponse.json(
        { error: "Invalid payment method" },
        { status: 400 }
      );
    }

    const validStatuses = ["pending", "paid", "canceled"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid payment status" },
        { status: 400 }
      );
    }

    const payment = await prisma.payment.create({
      data: {
        amount,
        method,
        status,
        customerId,
        appointmentId: appointmentId || null,
        boardingStayId: boardingStayId || null,
        orderId: orderId || null,
        notes: notes || null,
        paidAt: status === "paid" ? new Date() : null,
        businessId: authResult.businessId,
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        appointment: {
          include: {
            service: { select: { name: true } },
          },
        },
        boardingStay: {
          include: {
            pet: { select: { name: true } },
            room: { select: { name: true } },
          },
        },
      },
    });

    logCurrentUserActivity("CREATE_PAYMENT");

    // In-app notification milestone (first payment)
    if (status === "paid") {
      notifyPaymentReceived(
        authResult.session.user.id,
        authResult.businessId,
        amount,
        payment.customer?.name ?? "לקוח"
      );
    }

    // Auto-issue invoicing document for paid payments
    if (status === "paid") {
      try {
        const configured = await InvoicingService.isConfigured(authResult.businessId);
        if (configured) {
          try {
            await InvoicingService.issue(authResult.businessId, payment.id);
          } catch {
            // On failure, enqueue for retry — don't fail the payment creation
            await enqueueInvoiceJob({
              businessId: authResult.businessId,
              paymentId: payment.id,
              customerId,
              action: "issue_document",
            });
          }
        }
      } catch {
        // Invoicing check failed — silently continue
      }
    }

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    console.error("Failed to create payment:", error);
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}
