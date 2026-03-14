export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";
import { parseRecipientFile } from "@/lib/import-utils";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    // Recipients require RECIPIENTS_SENSITIVE permission
    const membership = session.memberships.find((m) => m.businessId === businessId && m.isActive);
    if (membership && !hasTenantPermission(membership.role as TenantRole, TENANT_PERMS.RECIPIENTS_SENSITIVE)) {
      return NextResponse.json({ error: "אין הרשאה לייבוא זכאים" }, { status: 403 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:service-recipients:import", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const dryRun = formData.get("dryRun") !== "false";

    if (!file) {
      return NextResponse.json({ error: "נדרש קובץ" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { recipients, issues, confidence } = parseRecipientFile(buffer, file.name);

    if (dryRun) {
      return NextResponse.json({
        total: recipients.length + issues.filter((i) => i.issueCode === "MISSING_NAME").length,
        valid: recipients.length,
        issues,
        confidence,
      });
    }

    // ── Execute import ──────────────────────────────────────────────
    const createdIds: string[] = [];
    const importErrors: typeof issues = [];

    for (const rec of recipients) {
      try {
        const created = await prisma.serviceDogRecipient.create({
          data: {
            businessId,
            name: rec.name,
            phone: rec.phone || null,
            email: rec.email || null,
            idNumber: rec.idNumber || null,
            address: rec.address || null,
            disabilityType: rec.disabilityType || null,
            disabilityNotes: rec.disabilityNotes || null,
            fundingSource: rec.fundingSource || null,
            notes: rec.notes || null,
            status: "LEAD",
          },
        });
        createdIds.push(created.id);
      } catch (err) {
        console.error(`Import recipient row ${rec.rowNumber} error:`, err);
        importErrors.push({
          rowNumber: rec.rowNumber,
          entityType: "recipient",
          issueCode: "CREATE_ERROR",
          message: "שגיאה פנימית בשמירת השורה",
          raw: rec.raw,
        });
      }
    }

    // Save ImportBatch
    const rollbackDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const allIssues = [...issues, ...importErrors];
    const statsJson = JSON.stringify({
      total: recipients.length,
      valid: recipients.length,
      created: createdIds.length,
      errors: allIssues.length,
      createdIds,
    });

    const batch = await prisma.importBatch.create({
      data: {
        businessId,
        sourceFilename: file.name,
        status: "imported",
        statsJson,
        rollbackDeadline,
      },
    });

    if (allIssues.length > 0) {
      await prisma.importRowIssue.createMany({
        data: allIssues.map((e) => ({
          batchId: batch.id,
          rowNumber: e.rowNumber,
          entityType: "recipient",
          issueCode: e.issueCode,
          message: e.message,
          rawJson: JSON.stringify(e.raw),
        })),
      });
    }

    return NextResponse.json({
      total: recipients.length,
      valid: recipients.length,
      created: createdIds.length,
      issues: allIssues,
      batchId: batch.id,
    });
  } catch (error) {
    console.error("POST /api/service-recipients/import error:", error);
    return NextResponse.json({ error: "שגיאה פנימית בשרת" }, { status: 500 });
  }
}
