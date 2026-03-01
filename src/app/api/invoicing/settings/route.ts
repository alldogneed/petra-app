export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { InvoicingService } from "@/lib/invoicing/invoicing-service";

// GET /api/invoicing/settings — get current invoicing settings (never exposes decrypted keys)
export async function GET(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    const settings = await prisma.invoicingSettings.findUnique({
      where: { businessId: authResult.businessId },
      select: {
        id: true,
        providerName: true,
        documentMapping: true,
        configJson: true,
        status: true,
        lastError: true,
        lastTestedAt: true,
        lastTestResult: true,
        lastTestError: true,
        connectedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("GET invoicing settings error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת הגדרות" }, { status: 500 });
  }
}

// POST /api/invoicing/settings — save credentials or update mapping only
export async function POST(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    const body = await request.json();
    const { providerName, apiKey, apiSecret, documentMapping, updateMappingOnly } = body;

    // Mapping-only update (no credential re-test needed)
    if (updateMappingOnly && documentMapping) {
      await prisma.invoicingSettings.update({
        where: { businessId: authResult.businessId },
        data: { documentMapping: JSON.stringify(documentMapping) },
      });
      return NextResponse.json({ success: true });
    }

    if (!providerName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "חסרים שדות חובה: providerName, apiKey, apiSecret" },
        { status: 400 }
      );
    }

    // Test credentials first
    const test = await InvoicingService.testCredentials(providerName, apiKey, apiSecret);
    if (!test.success) {
      return NextResponse.json({ error: test.error }, { status: 400 });
    }

    // Save
    await InvoicingService.saveSettings(
      authResult.businessId,
      providerName,
      apiKey,
      apiSecret,
      { documentMapping }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST invoicing settings error:", error);
    return NextResponse.json({ error: "שגיאה בשמירת הגדרות" }, { status: 500 });
  }
}

// DELETE /api/invoicing/settings — disconnect invoicing
export async function DELETE(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    await prisma.invoicingSettings.deleteMany({
      where: { businessId: authResult.businessId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE invoicing settings error:", error);
    return NextResponse.json({ error: "שגיאה בניתוק" }, { status: 500 });
  }
}
