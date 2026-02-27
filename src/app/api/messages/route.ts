export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel");

    const where: any = {
      businessId: DEMO_BUSINESS_ID,
    };

    if (channel) {
      where.channel = channel;
    }

    const templates = await prisma.messageTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching message templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch message templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { name, channel, subject, body: templateBody, variables } = body;

    const template = await prisma.messageTemplate.create({
      data: {
        businessId: DEMO_BUSINESS_ID,
        name,
        channel,
        subject,
        body: templateBody,
        variables: variables || "[]",
      },
    });

    logCurrentUserActivity("CREATE_MESSAGE_TEMPLATE");
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating message template:", error);
    return NextResponse.json(
      { error: "Failed to create message template" },
      { status: 500 }
    );
  }
}
