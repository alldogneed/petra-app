export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { listMessageTemplates, createMessageTemplate, ServiceError } from "@/services/notifications";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel");

    const templates = await listMessageTemplates(authResult.businessId, prisma, { channel });
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching message templates:", error);
    return NextResponse.json({ error: "Failed to fetch message templates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:messages:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json();

    let template;
    try {
      template = await createMessageTemplate(authResult.businessId, prisma, {
        name: body.name,
        channel: body.channel,
        subject: body.subject,
        body: body.body,
        variables: body.variables,
      });
    } catch (e) {
      if (e instanceof ServiceError && e.code === "VALIDATION") {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    logCurrentUserActivity("CREATE_MESSAGE_TEMPLATE");
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating message template:", error);
    return NextResponse.json({ error: "Failed to create message template" }, { status: 500 });
  }
}
