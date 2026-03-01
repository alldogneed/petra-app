export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;

    const existing = await prisma.lead.findFirst({
      where: { id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const callLogs = await prisma.callLog.findMany({
      where: { leadId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(callLogs);
  } catch (error) {
    console.error("Error fetching call logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch call logs" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;
    const body = await request.json();
    const { summary, treatment } = body;

    if (!summary || !treatment) {
      return NextResponse.json(
        { error: "Summary and treatment are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.lead.findFirst({
      where: { id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const callLog = await prisma.callLog.create({
      data: {
        leadId: id,
        summary,
        treatment,
      },
    });

    // Update lastContactedAt when a log is added
    await prisma.lead.update({
      where: { id },
      data: { lastContactedAt: new Date() },
    });

    return NextResponse.json(callLog, { status: 201 });
  } catch (error) {
    console.error("Error creating call log:", error);
    return NextResponse.json(
      { error: "Failed to create call log" },
      { status: 500 }
    );
  }
}
