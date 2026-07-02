export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from "@/lib/invoicing/types";
import { VAT_RATE } from "@/lib/constants";
import { isVatExempt } from "@/lib/legal-entity";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";

// GET /api/invoicing/documents — list documents with filters
export async function GET(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  // Staff cannot access invoicing documents
  const membership = authResult.session.memberships.find((m) => m.businessId === authResult.businessId && m.isActive);
  if (membership && !hasTenantPermission(membership.role as TenantRole, TENANT_PERMS.FINANCE_READ)) {
    return NextResponse.json({ error: "אין הרשאה לצפות במסמכים" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const docType = url.searchParams.get("docType");
    const customerId = url.searchParams.get("customerId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { businessId: authResult.businessId };
    if (status) where.status = status;
    if (docType) where.docType = Number(docType);
    if (customerId) where.customerId = customerId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to + "T23:59:59.999Z");
    }

    const documents = await prisma.invoiceDocument.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        payment: { select: { amount: true, method: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("GET invoicing documents error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת מסמכים" }, { status: 500 });
  }
}

// POST /api/invoicing/documents — create a draft invoice
export async function POST(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  // Staff cannot create invoicing documents
  const membership = authResult.session.memberships.find((m) => m.businessId === authResult.businessId && m.isActive);
  if (membership && !hasTenantPermission(membership.role as TenantRole, TENANT_PERMS.FINANCE_READ)) {
    return NextResponse.json({ error: "אין הרשאה ליצירת מסמכים" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { customerId, docType, orderId, paymentId, lines, notes } = body;

    if (!customerId) {
      return NextResponse.json({ error: "חובה לבחור לקוח" }, { status: 400 });
    }
    if (notes && typeof notes === "string" && notes.length > 2000) {
      return NextResponse.json({ error: "הערות ארוכות מדי (עד 2000 תווים)" }, { status: 400 });
    }

    // Verify customer exists
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId: authResult.businessId },
      select: { id: true, name: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    }

    // Verify paymentId belongs to this business (IDOR protection)
    if (paymentId) {
      const payment = await prisma.payment.findFirst({
        where: { id: paymentId, businessId: authResult.businessId },
        select: { id: true },
      });
      if (!payment) {
        return NextResponse.json({ error: "תשלום לא נמצא" }, { status: 404 });
      }
    }

    // Get business VAT + legal-entity info
    const business = await prisma.business.findUnique({
      where: { id: authResult.businessId },
      select: { vatNumber: true, vatRate: true, vatEnabled: true, legalEntityType: true },
    });

    const exemptBusiness = isVatExempt(business?.legalEntityType);
    const vatFree = exemptBusiness || business?.vatEnabled === false;

    // עוסק פטור may not issue tax invoices (305/320) — receipts only
    if (
      exemptBusiness &&
      (docType === DOCUMENT_TYPES.TAX_INVOICE || docType === DOCUMENT_TYPES.TAX_INVOICE_RECEIPT)
    ) {
      return NextResponse.json(
        { error: "עוסק פטור אינו רשאי להפיק חשבונית מס — יש להפיק קבלה" },
        { status: 400 }
      );
    }

    // Exempt businesses default to receipt (400); others to tax invoice/receipt (320)
    const effectiveDocType = docType ?? (exemptBusiness ? DOCUMENT_TYPES.RECEIPT : DOCUMENT_TYPES.TAX_INVOICE_RECEIPT);

    const vatRate = vatFree ? 0 : business?.vatRate ?? VAT_RATE;
    let subtotal = 0;
    let linesJson: string | null = null;

    // If orderId provided, snapshot lines from order
    if (orderId) {
      const order = await prisma.order.findFirst({
        where: { id: orderId, businessId: authResult.businessId },
        include: { lines: true },
      });
      if (order) {
        subtotal = order.subtotal;
        linesJson = JSON.stringify(
          order.lines.map((l) => ({
            description: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            total: l.lineTotal,
          }))
        );
      }
    } else if (lines && Array.isArray(lines)) {
      if (lines.length > 200) {
        return NextResponse.json({ error: "מקסימום 200 שורות במסמך" }, { status: 400 });
      }
      linesJson = JSON.stringify(lines);
      subtotal = lines.reduce(
        (sum: number, l: { quantity: number; unitPrice: number }) =>
          sum + l.quantity * l.unitPrice,
        0
      );
    }

    const taxTotal = vatFree ? 0 : Math.round(subtotal * vatRate * 100) / 100;
    const total = Math.round((subtotal + taxTotal) * 100) / 100;

    // Get provider settings
    const settings = await prisma.invoicingSettings.findUnique({
      where: { businessId: authResult.businessId },
      select: { providerName: true },
    });

    const doc = await prisma.invoiceDocument.create({
      data: {
        businessId: authResult.businessId,
        customerId,
        paymentId: paymentId || null,
        orderId: orderId || null,
        providerName: settings?.providerName ?? "morning",
        docType: effectiveDocType,
        docTypeName: DOCUMENT_TYPE_LABELS[effectiveDocType] ?? "חשבונית מס / קבלה",
        subtotal,
        taxTotal,
        amount: total,
        currency: "ILS",
        vatRate,
        vatNumber: business?.vatNumber ?? null,
        linesJson,
        notes: notes || null,
        status: "draft",
      },
      include: {
        customer: { select: { name: true } },
      },
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("POST invoicing document error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת מסמך" }, { status: 500 });
  }
}
