export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const leads = await prisma.lead.findMany({
      where: { businessId: authResult.businessId },
      include: {
        customer: true,
        callLogs: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return NextResponse.json(leads);
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:leads:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });
    }

    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { name, phone, email, source, stage, notes, customerId } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    if (stage) {
      const validStage = await prisma.leadStage.findFirst({
        where: { id: stage, businessId: authResult.businessId },
      });
      if (!validStage) {
        return NextResponse.json({ error: "Invalid stage value" }, { status: 400 });
      }
    }

    const lead = await prisma.lead.create({
      data: {
        businessId: authResult.businessId,
        name,
        phone,
        email,
        source,
        stage: stage || "new",
        notes,
        customerId: customerId || undefined,
      },
      include: {
        customer: true,
        callLogs: true,
      },
    });

    logCurrentUserActivity("CREATE_LEAD");
    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    console.error("Error creating lead:", error);
    return NextResponse.json(
      { error: "Failed to create lead" },
      { status: 500 }
    );
  }
}
