export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// GET /api/my-booking/[token] — fetch booking by customerToken (public)
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  // Rate limit to prevent token enumeration
  const ip = _req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit("api:my-booking", ip, RATE_LIMITS.STRICT_TOKEN);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const booking = await prisma.booking.findUnique({
    where: { customerToken: params.token },
    select: {
      id: true,
      status: true,
      startAt: true,
      endAt: true,
      notes: true,
      customerToken: true,
      customer: { select: { name: true, phone: true } },
      priceListItem: { select: { name: true, category: true } },
      service: { select: { name: true } },
      dogs: { select: { pet: { select: { name: true } } } },
      business: { select: { name: true, phone: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "הזמנה לא נמצאה" }, { status: 404 });
  }

  return NextResponse.json(booking);
}

// PATCH /api/my-booking/[token] — cancel booking (public)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  // Rate limit to prevent abuse
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit("api:my-booking:write", ip, RATE_LIMITS.STRICT_TOKEN);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action !== "cancel") {
    return NextResponse.json({ error: "פעולה לא נתמכת" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { customerToken: params.token },
    select: { id: true, status: true },
  });

  if (!booking) {
    return NextResponse.json({ error: "הזמנה לא נמצאה" }, { status: 404 });
  }

  if (!["pending", "confirmed"].includes(booking.status)) {
    return NextResponse.json(
      { error: "לא ניתן לבטל הזמנה בסטטוס זה" },
      { status: 409 }
    );
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "cancelled" },
    select: { id: true, status: true, customerToken: true },
  });

  return NextResponse.json(updated);
}
