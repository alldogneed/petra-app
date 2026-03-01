export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { DOCUMENT_TYPE_LABELS } from "@/lib/invoicing/types";

// POST /api/invoicing/credit-note — create a credit note referencing an original invoice
export async function POST(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    const body = await request.json();
    const { originalInvoiceId, notes } = body;

    if (!originalInvoiceId) {
      return NextResponse.json(
        { error: "חסר מזהה חשבונית מקורית" },
        { status: 400 }
      );
    }

    // Load original invoice
    const original = await prisma.invoiceDocument.findFirst({
      where: {
        id: originalInvoiceId,
        businessId: authResult.businessId,
        status: "issued",
      },
    });

    if (!original) {
      return NextResponse.json(
        { error: "חשבונית מקורית לא נמצאה או אינה בסטטוס הונפקה" },
        { status: 404 }
      );
    }

    // Check if credit note already exists
    const existingCreditNote = await prisma.invoiceDocument.findFirst({
      where: {
        originalInvoiceId,
        businessId: authResult.businessId,
        status: { not: "cancelled" },
      },
    });

    if (existingCreditNote) {
      return NextResponse.json(
        { error: "כבר קיימת חשבונית זיכוי לחשבונית זו" },
        { status: 409 }
      );
    }

    // Create credit note as draft
    const creditNote = await prisma.invoiceDocument.create({
      data: {
        businessId: authResult.businessId,
        customerId: original.customerId,
        paymentId: original.paymentId,
        orderId: original.orderId,
        originalInvoiceId: original.id,
        providerName: original.providerName,
        docType: 330, // credit note
        docTypeName: DOCUMENT_TYPE_LABELS[330] ?? "חשבונית זיכוי",
        subtotal: original.subtotal ? -original.subtotal : null,
        taxTotal: original.taxTotal ? -original.taxTotal : null,
        amount: -original.amount,
        currency: original.currency,
        vatRate: original.vatRate,
        vatNumber: original.vatNumber,
        linesJson: original.linesJson,
        notes: notes ?? `זיכוי עבור חשבונית ${original.documentNumber ?? original.id}`,
        status: "draft",
      },
      include: {
        customer: { select: { name: true } },
      },
    });

    return NextResponse.json(creditNote, { status: 201 });
  } catch (error) {
    console.error("Create credit note error:", error);
    return NextResponse.json(
      { error: "שגיאה ביצירת חשבונית זיכוי" },
      { status: 500 }
    );
  }
}
