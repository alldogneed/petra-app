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

    const VALID_CLAIM_STATUSES = ["PENDING", "SUBMITTED", "IN_REVIEW", "PAID", "DENIED", "WITHDRAWN"];
    if (body.status && !VALID_CLAIM_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "סטטוס תביעה לא חוקי" }, { status: 400 });
    }

    // Validate required date
    const incidentDate = new Date(body.incidentDate);
    if (isNaN(incidentDate.getTime())) {
      return NextResponse.json({ error: "תאריך אירוע לא חוקי" }, { status: 400 });
    }

    // Validate optional dates
    let submittedAt: Date | null = null;
    if (body.submittedAt) {
      submittedAt = new Date(body.submittedAt);
      if (isNaN(submittedAt.getTime())) return NextResponse.json({ error: "תאריך הגשה לא חוקי" }, { status: 400 });
    }
    let followUpAt: Date | null = null;
    if (body.followUpAt) {
      followUpAt = new Date(body.followUpAt);
      if (isNaN(followUpAt.getTime())) return NextResponse.json({ error: "תאריך מעקב לא חוקי" }, { status: 400 });
    }

    // Validate numeric amounts
    const parseAmount = (val: unknown): number | null => {
      if (val == null || val === "") return null;
      const n = parseFloat(String(val));
      return Number.isFinite(n) && n >= 0 ? n : null;
    };

    const claim = await prisma.serviceDogClaim.create({
      data: {
        insuranceId: params.insuranceId,
        businessId: auth.businessId,
        incidentDate,
        description: body.description || null,
        amount: parseAmount(body.amount),
        deductiblePaid: parseAmount(body.deductiblePaid),
        reimbursedAmount: parseAmount(body.reimbursedAmount),
        vetName: body.vetName || null,
        claimNumber: body.claimNumber || null,
        invoiceAttached: body.invoiceAttached ?? false,
        visitSummaryAttached: body.visitSummaryAttached ?? false,
        documents: body.documents ?? [],
        submittedAt,
        followUpAt,
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
