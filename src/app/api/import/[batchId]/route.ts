/**
 * GET  /api/import/[batchId]          → batch status + stats
 * GET  /api/import/[batchId]?issues=csv → download issues as CSV
 * DELETE /api/import/[batchId]        → rollback (delete created records)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const batch = await prisma.importBatch.findFirst({
      where: { id: params.batchId, businessId: DEMO_BUSINESS_ID },
      include: { issues: true },
    });
    if (!batch) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

    const issuesCsv = req.nextUrl.searchParams.get("issues");
    if (issuesCsv === "csv") {
      // Return issues as CSV download
      const lines = [
        ["שורה", "סוג", "קוד שגיאה", "הודעה", "נתונים גולמיים"].join(","),
        ...batch.issues.map((i) =>
          [i.rowNumber, i.entityType, i.issueCode, `"${i.message.replace(/"/g, '""')}"`, `"${i.rawJson.replace(/"/g, '""')}"`].join(",")
        ),
      ];
      return new Response(lines.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="import-issues-${params.batchId.slice(0, 8)}.csv"`,
        },
      });
    }

    const stats = JSON.parse(batch.statsJson);
    return NextResponse.json({
      id: batch.id,
      status: batch.status,
      sourceFilename: batch.sourceFilename,
      createdAt: batch.createdAt,
      rollbackDeadline: batch.rollbackDeadline,
      canRollback: batch.status === "imported" && new Date() < new Date(batch.rollbackDeadline),
      stats: {
        totalCustomers: stats.totalCustomers,
        totalPets: stats.totalPets,
        skippedRows: stats.skippedRows,
        dbDuplicates: stats.dbDuplicates,
        createdCustomers: stats.createdCustomerIds?.length ?? null,
        createdPets: stats.createdPetIds?.length ?? null,
      },
      issueCount: batch.issues.length,
    });
  } catch (error) {
    console.error("Import GET error:", error);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const batch = await prisma.importBatch.findFirst({
      where: { id: params.batchId, businessId: DEMO_BUSINESS_ID },
    });
    if (!batch) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    if (batch.status !== "imported") {
      return NextResponse.json({ error: "ניתן לבטל רק יבוא שכבר בוצע" }, { status: 409 });
    }
    if (new Date() > new Date(batch.rollbackDeadline)) {
      return NextResponse.json({ error: "חלון הביטול של 24 שעות פג" }, { status: 409 });
    }

    const stats = JSON.parse(batch.statsJson);
    const createdPetIds: string[] = stats.createdPetIds ?? [];
    const createdCustomerIds: string[] = stats.createdCustomerIds ?? [];

    // Delete pets first (FK), then customers
    if (createdPetIds.length > 0) {
      await prisma.pet.deleteMany({ where: { id: { in: createdPetIds } } });
    }
    if (createdCustomerIds.length > 0) {
      await prisma.customer.deleteMany({
        where: { id: { in: createdCustomerIds }, businessId: DEMO_BUSINESS_ID },
      });
    }

    await prisma.importBatch.update({
      where: { id: params.batchId },
      data: { status: "rolled_back" },
    });

    return NextResponse.json({
      success: true,
      deletedCustomers: createdCustomerIds.length,
      deletedPets: createdPetIds.length,
    });
  } catch (error) {
    console.error("Import rollback error:", error);
    return NextResponse.json({ error: "שגיאה בביטול" }, { status: 500 });
  }
}
