export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { updateMessageTemplate, deleteMessageTemplate, ServiceError } from "@/services/notifications";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

    let template;
    try {
      template = await updateMessageTemplate(authResult.businessId, prisma, params.id, {
        name: body.name,
        channel: body.channel,
        subject: body.subject,
        body: body.body,
        variables: body.variables,
      });
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Message template not found" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error updating message template:", error);
    return NextResponse.json({ error: "Failed to update message template" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:messages:delete", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    try {
      await deleteMessageTemplate(authResult.businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Message template not found" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting message template:", error);
    return NextResponse.json({ error: "Failed to delete message template" }, { status: 500 });
  }
}
