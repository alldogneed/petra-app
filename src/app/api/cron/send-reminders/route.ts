export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { processPendingReminders } from "@/lib/scheduled-messages";

// GET /api/cron/send-reminders  (pass secret via x-cron-secret header)
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const a = Buffer.from(secret);
  const b = Buffer.from(cronSecret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processPendingReminders();

    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("CRON send-reminders error:", error);
    return NextResponse.json({ error: "Failed to process reminders" }, { status: 500 });
  }
}
