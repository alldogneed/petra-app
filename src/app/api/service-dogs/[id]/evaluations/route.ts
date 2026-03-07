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

    const evaluations = await prisma.serviceDogEvaluation.findMany({
      where: { serviceDogId: params.id, businessId: auth.businessId },
      orderBy: { evaluationDate: "desc" },
    });

    return NextResponse.json(evaluations);
  } catch (e) {
    console.error("GET evaluations error:", e);
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
    const { evaluationType, evaluationDate, evaluatorName, scores, totalScore, maxScore, passed, notes } = body;

    const evaluation = await prisma.serviceDogEvaluation.create({
      data: {
        serviceDogId: params.id,
        businessId: auth.businessId,
        evaluationType: evaluationType || "PUBLIC_SPACE",
        evaluationDate: new Date(evaluationDate),
        evaluatorName: evaluatorName || null,
        scores: typeof scores === "string" ? scores : JSON.stringify(scores || {}),
        totalScore: totalScore ?? 0,
        maxScore: maxScore ?? 0,
        passed: passed ?? false,
        notes: notes || null,
        certificateIssuedAt: passed ? new Date() : null,
      },
    });

    return NextResponse.json(evaluation, { status: 201 });
  } catch (e) {
    console.error("POST evaluation error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
