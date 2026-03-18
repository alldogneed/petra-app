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

    const VALID_CLAIM_STATUSES = ["PENDING", "SUBMITTED", "IN_REVIEW", "PAID", "DENIED", "WITHDRAWN"];
    if (body.status !== undefined && body.status !== null && !VALID_CLAIM_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "סטטוס תביעה לא חוקי" }, { status: 400 });
    }

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
        submittedAt: body.submittedAt !== undefined ? (body.submittedAt ? new Date(body.submittedAt) : null) : undefined,
        resolvedAt: body.resolvedAt !== undefined ? (body.resolvedAt ? new Date(body.resolvedAt) : null) : undefined,
        followUpAt: body.followUpAt !== undefined ? (body.followUpAt ? new Date(body.followUpAt) : null) : undefined,
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
