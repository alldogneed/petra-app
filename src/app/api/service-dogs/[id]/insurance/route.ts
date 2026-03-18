export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: auth.businessId },
      select: { id: true },
    });
    if (!dog) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const insurances = await prisma.serviceDogInsurance.findMany({
      where: { serviceDogId: params.id, businessId: auth.businessId },
      include: { claims: { orderBy: { incidentDate: "desc" } } },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(insurances);
  } catch (e) {
    console.error("GET insurance error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: auth.businessId },
      select: { id: true },
    });
    if (!dog) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();

    if (body.policyDocument) {
      try { const u = new URL(body.policyDocument); if (u.protocol !== "https:") throw new Error(); } catch {
        return NextResponse.json({ error: "כתובת מסמך ביטוח לא חוקית" }, { status: 400 });
      }
    }

    const insurance = await prisma.serviceDogInsurance.create({
      data: {
        serviceDogId: params.id,
        businessId: auth.businessId,
        provider: body.provider || null,
        policyNumber: body.policyNumber || null,
        premium: body.premium ? parseFloat(body.premium) : null,
        deductible: body.deductible ? parseFloat(body.deductible) : null,
        coverageType: body.coverageType || null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        renewalDate: body.renewalDate ? new Date(body.renewalDate) : null,
        notes: body.notes || null,
        policyDocument: body.policyDocument || null,
        isActive: body.isActive !== false,
      },
      include: { claims: true },
    });

    return NextResponse.json(insurance, { status: 201 });
  } catch (e) {
    console.error("POST insurance error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
