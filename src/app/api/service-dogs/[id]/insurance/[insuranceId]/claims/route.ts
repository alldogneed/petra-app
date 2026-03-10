export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; insuranceId: string } }
) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    // Verify insurance belongs to this dog + business
    const insurance = await prisma.serviceDogInsurance.findFirst({
      where: { id: params.insuranceId, serviceDogId: params.id, businessId: auth.businessId },
    });
    if (!insurance) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();

    const claim = await prisma.serviceDogClaim.create({
      data: {
        insuranceId: params.insuranceId,
        businessId: auth.businessId,
        incidentDate: new Date(body.incidentDate),
        description: body.description || null,
        amount: body.amount ? parseFloat(body.amount) : null,
        deductiblePaid: body.deductiblePaid ? parseFloat(body.deductiblePaid) : null,
        reimbursedAmount: body.reimbursedAmount ? parseFloat(body.reimbursedAmount) : null,
        vetName: body.vetName || null,
        claimNumber: body.claimNumber || null,
        invoiceAttached: body.invoiceAttached ?? false,
        visitSummaryAttached: body.visitSummaryAttached ?? false,
        documents: body.documents ?? [],
        submittedAt: body.submittedAt ? new Date(body.submittedAt) : null,
        status: body.status || "PENDING",
        notes: body.notes || null,
      },
    });

    return NextResponse.json(claim, { status: 201 });
  } catch (e) {
    console.error("POST claim error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
