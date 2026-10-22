export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth, verifyCronAuthWithVault } from "@/lib/cron-auth";
import { ensurePlatformTemplates } from "@/lib/whatsapp-connections";

/**
 * GET /api/cron/sync-platform-templates — creates the Meta templates listed in
 * src/lib/meta-template-catalog.ts that the platform WABA does not have yet, and returns
 * the review status of each (APPROVED / PENDING / REJECTED + reason). Daily (vercel.json)
 * and on demand. Never edits or deletes an existing template.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request) && !(await verifyCronAuthWithVault(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await ensurePlatformTemplates();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
