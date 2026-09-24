export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

type Params = { params: { id: string; insuranceId: string } };

async function verifyOwnership(dogId: string, insuranceId: string, businessId: string) {
  return prisma.serviceDogInsurance.findFirst({
    where: { id: insuranceId, serviceDogId: dogId, businessId },
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    const existing = await verifyOwnership(params.id, params.insuranceId, auth.businessId);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();

    // Rendered as <a href> in the UI — only an https URL (our Blob upload), never javascript:/data:
    if (body.policyDocument !== undefined && body.policyDocument !== null && body.policyDocument !== "") {
      if (typeof body.policyDocument !== "string" || body.policyDocument.length > 500 || !/^https:\/\//i.test(body.policyDocument)) {
        return NextResponse.json({ error: "קישור מסמך לא חוקי" }, { status: 400 });
      }
    }

    const updated = await prisma.serviceDogInsurance.update({
      where: { id: params.insuranceId, businessId: auth.businessId },
      data: {
        ...(body.provider !== undefined && { provider: body.provider || null }),
        ...(body.policyNumber !== undefined && { policyNumber: body.policyNumber || null }),
        ...(body.premium !== undefined && { premium: body.premium ? parseFloat(body.premium) : null }),
        ...(body.deductible !== undefined && { deductible: body.deductible ? parseFloat(body.deductible) : null }),
        ...(body.coverageType !== undefined && { coverageType: body.coverageType || null }),
        ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
        ...(body.renewalDate !== undefined && { renewalDate: body.renewalDate ? new Date(body.renewalDate) : null }),
        ...(body.notes !== undefined && { notes: body.notes || null }),
        ...(body.policyDocument !== undefined && { policyDocument: body.policyDocument || null }),
        ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }),
      },
      include: { claims: { orderBy: { incidentDate: "desc" } } },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("PATCH insurance error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    const existing = await verifyOwnership(params.id, params.insuranceId, auth.businessId);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.serviceDogInsurance.delete({ where: { id: params.insuranceId, businessId: auth.businessId } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE insurance error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
