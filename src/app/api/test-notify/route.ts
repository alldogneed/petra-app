export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { notifyOwnerNewUser } from "@/lib/notify-owner";

// Temporary test endpoint — remove after confirming notifications work
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await notifyOwnerNewUser({
    name: "ישראל ישראלי",
    email: "test@example.com",
    plan: "basic",
    phone: "054-1234567",
  });

  return NextResponse.json({ ok: true, message: "Notification sent — check WhatsApp + email" });
}
