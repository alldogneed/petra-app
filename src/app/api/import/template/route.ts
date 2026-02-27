/**
 * GET /api/import/template
 * Returns a downloadable XLSX template with Customers + Pets sheets.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateCustomerTemplate } from "@/lib/import-utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (isGuardError(authResult)) return authResult;

  try {
    const buffer = generateCustomerTemplate();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="petra-import-template.xlsx"',
      },
    });
  } catch (error) {
    console.error("Template generation error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת תבנית" }, { status: 500 });
  }
}
