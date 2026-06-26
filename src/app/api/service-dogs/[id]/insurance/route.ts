export const dynamic = "force-dynamic";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

const InsuranceSchema = z.object({
  provider: z.string().max(200).nullable().optional(),
  policyNumber: z.string().max(100).nullable().optional(),
  premium: z.union([z.number(), z.string()]).nullable().optional(),
  deductible: z.union([z.number(), z.string()]).nullable().optional(),
  coverageType: z.string().max(100).nullable().optional(),
  startDate: z.string().max(30).nullable().optional(),
  renewalDate: z.string().max(30).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  policyDocument: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

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

    const raw = await request.json();
    const parsed = InsuranceSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "נתונים לא תקינים", details: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

    const premium = body.premium != null ? parseFloat(String(body.premium)) : null;
    const deductible = body.deductible != null ? parseFloat(String(body.deductible)) : null;
    if ((premium != null && (!isFinite(premium) || premium < 0)) ||
        (deductible != null && (!isFinite(deductible) || deductible < 0))) {
      return NextResponse.json({ error: "סכומים לא תקינים" }, { status: 400 });
    }

    const insurance = await prisma.serviceDogInsurance.create({
      data: {
        serviceDogId: params.id,
        businessId: auth.businessId,
        provider: body.provider || null,
        policyNumber: body.policyNumber || null,
        premium,
        deductible,
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
