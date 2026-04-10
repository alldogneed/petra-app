export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/invoicing/documents/[id] — single document details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    const document = await prisma.invoiceDocument.findFirst({
      where: {
        id: params.id,
        businessId: authResult.businessId,
      },
      include: {
        customer: { select: { name: true, phone: true, email: true } },
        payment: { select: { amount: true, method: true, status: true } },
        order: { select: { id: true, total: true, status: true } },
        originalInvoice: { select: { id: true, documentNumber: true, amount: true } },
        creditNotes: { select: { id: true, documentNumber: true, amount: true, status: true } },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "מסמך לא נמצא" }, { status: 404 });
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error("GET invoicing document error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת מסמך" }, { status: 500 });
  }
}

// PATCH /api/invoicing/documents/[id] — update draft only
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    const existing = await prisma.invoiceDocument.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "מסמך לא נמצא" }, { status: 404 });
    }

    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "ניתן לערוך טיוטות בלבד" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { docType, notes, linesJson, customerId } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (docType !== undefined) data.docType = docType;
    if (notes !== undefined) data.notes = notes;
    if (linesJson !== undefined) data.linesJson = typeof linesJson === "string" ? linesJson : JSON.stringify(linesJson);
    if (customerId) data.customerId = customerId;

    const updated = await prisma.invoiceDocument.update({
      where: { id: params.id, businessId: authResult.businessId },
      data,
      include: { customer: { select: { name: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH invoicing document error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון מסמך" }, { status: 500 });
  }
}

// DELETE /api/invoicing/documents/[id] — delete draft only
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    const existing = await prisma.invoiceDocument.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "מסמך לא נמצא" }, { status: 404 });
    }

    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "ניתן למחוק טיוטות בלבד" },
        { status: 400 }
      );
    }

    await prisma.invoiceDocument.delete({
      where: { id: params.id, businessId: authResult.businessId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE invoicing document error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת מסמך" }, { status: 500 });
  }
}
