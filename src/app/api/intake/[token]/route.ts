export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  // Rate limit by IP to prevent token enumeration
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit("intake:view", ip, RATE_LIMITS.STRICT_TOKEN);
  if (!rl.allowed) {
    return NextResponse.json({ error: "יותר מדי בקשות" }, { status: 429 });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(params.token).digest("hex");

    const form = await prisma.intakeForm.findUnique({
      where: { tokenHash },
      include: {
        business: {
          select: { name: true },
        },
        customer: {
          select: { name: true, phone: true },
        },
      },
    });

    if (!form) {
      return NextResponse.json({ error: "טופס לא נמצא" }, { status: 404 });
    }

    if (form.expiresAt < new Date()) {
      return NextResponse.json({ error: "הטופס פג תוקף" }, { status: 410 });
    }

    if (form.status === "SUBMITTED") {
      return NextResponse.json({ error: "הטופס כבר מולא" }, { status: 409 });
    }

    // Mark as opened — atomic conditional update prevents race condition
    if (form.status === "SENT") {
      await prisma.intakeForm.updateMany({
        where: { id: form.id, status: "SENT" },
        data: { status: "OPENED", openedAt: new Date() },
      });
    }

    return NextResponse.json({
      id: form.id,
      businessName: form.business.name,
      customerName: form.customer?.name || null,
      // customerPhone intentionally omitted — PII not needed on public endpoint
      status: form.status,
    });
  } catch (error) {
    console.error("GET intake form error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת טופס" }, { status: 500 });
  }
}
