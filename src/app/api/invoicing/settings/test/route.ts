export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { InvoicingService } from "@/lib/invoicing/invoicing-service";

// POST /api/invoicing/settings/test — test credentials without saving
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    const body = await request.json();
    const { providerName, apiKey, apiSecret } = body;

    if (!providerName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "חסרים שדות חובה" },
        { status: 400 }
      );
    }

    const result = await InvoicingService.testCredentials(providerName, apiKey, apiSecret);

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
  } catch (error) {
    console.error("Test invoicing credentials error:", error);
    return NextResponse.json({ error: "שגיאה בבדיקת החיבור" }, { status: 500 });
  }
}
