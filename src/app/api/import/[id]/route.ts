export const dynamic = "force-dynamic";
/**
 * GET    /api/import/[id]  – פרטי batch + רשימת issues
 * DELETE /api/import/[id]  – מחיקת batch (rollback אם בתוך rollbackDeadline)
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(req);
  if (isGuardError(authResult)) return authResult;
  const { businessId } = authResult;

  try {
    const batch = await prisma.importBatch.findFirst({
      where: { id: params.id, businessId },
      include: { issues: true },
    });

    if (!batch) {
      return NextResponse.json({ error: "ייבוא לא נמצא" }, { status: 404 });
    }

    let stats: Record<string, unknown> = {};
    try {
      stats = JSON.parse(batch.statsJson);
    } catch {}

    const now = new Date();
    return NextResponse.json({
      id: batch.id,
      sourceFilename: batch.sourceFilename,
      status: batch.status,
      createdAt: batch.createdAt,
      rollbackDeadline: batch.rollbackDeadline,
      canRollback:
        batch.status === "imported" && now < new Date(batch.rollbackDeadline),
      stats: {
        total: (stats.total as number) ?? 0,
        valid: (stats.valid as number) ?? 0,
        created: (stats.created as number) ?? null,
        errors: (stats.errors as number) ?? 0,
        createdCustomerIds: (stats.createdCustomerIds as string[]) ?? [],
        createdPetIds: (stats.createdPetIds as string[]) ?? [],
      },
      issues: batch.issues.map((issue) => ({
        id: issue.id,
        rowNumber: issue.rowNumber,
        entityType: issue.entityType,
        issueCode: issue.issueCode,
        message: issue.message,
        rawJson: issue.rawJson,
      })),
    });
  } catch (error) {
    console.error("Import GET [id] error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת הייבוא" }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(req);
  if (isGuardError(authResult)) return authResult;
  const { businessId } = authResult;

  try {
    const batch = await prisma.importBatch.findFirst({
      where: { id: params.id, businessId },
    });

    if (!batch) {
      return NextResponse.json({ error: "ייבוא לא נמצא" }, { status: 404 });
    }

    if (batch.status !== "imported") {
      return NextResponse.json(
        { error: "ניתן לבטל רק ייבוא שכבר בוצע" },
        { status: 409 }
      );
    }

    const now = new Date();
    const deadline = new Date(batch.rollbackDeadline);
    const isWithinDeadline = now < deadline;

    // Rollback: delete created records if within deadline
    if (isWithinDeadline) {
      let stats: Record<string, unknown> = {};
      try {
        stats = JSON.parse(batch.statsJson);
      } catch {}

      const createdPetIds = (stats.createdPetIds as string[]) ?? [];
      const createdCustomerIds = (stats.createdCustomerIds as string[]) ?? [];

      // Delete pets first (FK constraint), then customers
      if (createdPetIds.length > 0) {
        await prisma.pet.deleteMany({
          where: { id: { in: createdPetIds } },
        });
      }

      if (createdCustomerIds.length > 0) {
        await prisma.customer.deleteMany({
          where: {
            id: { in: createdCustomerIds },
            businessId,
          },
        });
      }

      await prisma.importBatch.update({
        where: { id: params.id },
        data: { status: "rolled_back" },
      });

      return NextResponse.json({
        success: true,
        rolledBack: true,
        deletedCustomers: createdCustomerIds.length,
        deletedPets: createdPetIds.length,
      });
    }

    // Past deadline – delete only the batch record (no rollback)
    await prisma.importBatch.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      rolledBack: false,
      message: "הרשומה נמחקה (חלון הביטול עבר, הנתונים נשמרו)",
    });
  } catch (error) {
    console.error("Import DELETE [id] error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת הייבוא" }, { status: 500 });
  }
}
