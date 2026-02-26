/**
 * GET /api/webhooks/lead/key
 *
 * Returns the MAKE_WEBHOOK_SECRET for display in the settings UI.
 * Protected by session auth (middleware handles this).
 */

import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.MAKE_WEBHOOK_SECRET;
  if (!key) {
    return NextResponse.json({ key: "לא הוגדר — הוסף MAKE_WEBHOOK_SECRET ל-.env" });
  }
  return NextResponse.json({ key });
}
