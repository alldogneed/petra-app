export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { processPendingReminders } from "@/lib/scheduled-messages";

// GET /api/cron/send-reminders  (pass secret via x-cron-secret header)
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret") || new URL(request.url).searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || secret !== cronSecret) {
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
