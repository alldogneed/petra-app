export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; evalId: string } }
) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    const existing = await prisma.serviceDogEvaluation.findFirst({
      where: { id: params.evalId, serviceDogId: params.id, businessId: auth.businessId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const updated = await prisma.serviceDogEvaluation.update({
      where: { id: params.evalId },
      data: {
        evaluationType: body.evaluationType ?? undefined,
        evaluationDate: body.evaluationDate ? new Date(body.evaluationDate) : undefined,
        evaluatorName: body.evaluatorName ?? undefined,
        scores: body.scores != null
          ? typeof body.scores === "string" ? body.scores : JSON.stringify(body.scores)
          : undefined,
        totalScore: body.totalScore ?? undefined,
        maxScore: body.maxScore ?? undefined,
        passed: body.passed ?? undefined,
        notes: body.notes ?? undefined,
        certificateIssuedAt: body.passed === true && !existing.certificateIssuedAt
          ? new Date()
          : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("PATCH evaluation error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; evalId: string } }
) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    await prisma.serviceDogEvaluation.deleteMany({
      where: { id: params.evalId, serviceDogId: params.id, businessId: auth.businessId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE evaluation error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
