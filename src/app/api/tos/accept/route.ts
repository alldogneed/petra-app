export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { CURRENT_TOS_VERSION } from "@/lib/tos";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || null;

    const body = await request.json().catch(() => ({}));
    const version = body.version ?? CURRENT_TOS_VERSION;

    if (version !== CURRENT_TOS_VERSION) {
      return NextResponse.json({ error: "Invalid ToS version" }, { status: 400 });
    }

    // Sequential operations (no $transaction — Supabase PgBouncer incompatible)
    await prisma.userConsent.upsert({
      where: { id: `${session.user.id}:${version}` },
      create: {
        id: `${session.user.id}:${version}`,
        userId: session.user.id,
        termsVersion: version,
        ipAddress: ip,
        userAgent,
      },
      update: {
        acceptedAt: new Date(),
        ipAddress: ip,
        userAgent,
      },
    });
    await prisma.platformUser.update({
      where: { id: session.user.id },
      data: {
        tosAcceptedVersion: version,
        tosAcceptedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, version });
  } catch (error) {
    console.error("ToS accept error:", error);
    return NextResponse.json({ error: "Failed to record acceptance" }, { status: 500 });
  }
}
