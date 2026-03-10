export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; insuranceId: string; claimId: string } }
) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    const existing = await prisma.serviceDogClaim.findFirst({
      where: { id: params.claimId, insuranceId: params.insuranceId, businessId: auth.businessId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const updated = await prisma.serviceDogClaim.update({
      where: { id: params.claimId },
      data: {
        incidentDate: body.incidentDate ? new Date(body.incidentDate) : undefined,
        description: body.description ?? undefined,
        amount: body.amount != null ? parseFloat(body.amount) : undefined,
        deductiblePaid: body.deductiblePaid != null ? parseFloat(body.deductiblePaid) : undefined,
        reimbursedAmount: body.reimbursedAmount != null ? parseFloat(body.reimbursedAmount) : undefined,
        vetName: body.vetName ?? undefined,
        claimNumber: body.claimNumber ?? undefined,
        invoiceAttached: body.invoiceAttached ?? undefined,
        visitSummaryAttached: body.visitSummaryAttached ?? undefined,
        documents: body.documents !== undefined ? body.documents : undefined,
        submittedAt: body.submittedAt ? new Date(body.submittedAt) : undefined,
        resolvedAt: body.resolvedAt ? new Date(body.resolvedAt) : undefined,
        status: body.status ?? undefined,
        notes: body.notes ?? undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("PATCH claim error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; insuranceId: string; claimId: string } }
) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    await prisma.serviceDogClaim.deleteMany({
      where: { id: params.claimId, insuranceId: params.insuranceId, businessId: auth.businessId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE claim error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
