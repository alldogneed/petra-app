export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/exports – list export jobs
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const exports = await prisma.exportJob.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json(exports);
  } catch (error) {
    console.error("GET exports error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת ייצואים" }, { status: 500 });
  }
}

// POST /api/exports – create a new export job
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    const body = await request.json();
    const { exportType, format, outputMode, filterFromDate, filterToDate } = body;

    const VALID_EXPORT_TYPES = ["customers", "appointments", "orders", "payments", "leads", "boarding", "invoices", "pets", "service-dogs", "training-programs"];
    const VALID_FORMATS = ["xlsx", "csv", "pdf"];
    const VALID_OUTPUT_MODES = ["separate", "combined"];

    if (!exportType || !VALID_EXPORT_TYPES.includes(exportType)) {
      return NextResponse.json({ error: "exportType is required and must be valid" }, { status: 400 });
    }

    const exportJob = await prisma.exportJob.create({
      data: {
        businessId,
        userId: session.user.id,
        exportType,
        format: VALID_FORMATS.includes(format) ? format : "xlsx",
        outputMode: VALID_OUTPUT_MODES.includes(outputMode) ? outputMode : "separate",
        status: "pending",
        filterFromDate: filterFromDate ? new Date(filterFromDate) : null,
        filterToDate: filterToDate ? new Date(filterToDate) : null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      },
    });

    return NextResponse.json(exportJob, { status: 201 });
  } catch (error) {
    console.error("POST export error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת ייצוא" }, { status: 500 });
  }
}
