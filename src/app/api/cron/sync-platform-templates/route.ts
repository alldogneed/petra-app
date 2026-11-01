export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth, verifyCronAuthWithVault } from "@/lib/cron-auth";
import { ensurePlatformTemplates, getPlatformTemplateTexts } from "@/lib/whatsapp-connections";
import { META_TEMPLATES } from "@/lib/reminder-service";
import { auditTemplatesForGeneric } from "@/lib/verticals/template-audit";

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
  // Verticals phase 5: approved customer templates a "generic" business can't send as-is
  // (Petra / dog wording in the body). Empty list = nothing to resubmit.
  const verticalAudit = await getPlatformTemplateTexts()
    .then((texts) => auditTemplatesForGeneric(texts, [...Object.values(META_TEMPLATES).flat(), "petra_payment_request"]))
    .catch(() => null);
  return NextResponse.json({ ...result, verticalAudit }, { status: result.ok ? 200 : 502 });
}
