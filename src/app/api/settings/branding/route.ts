export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, requireBusinessPermission, isGuardError } from "@/lib/auth-guards";
import { TENANT_PERMS } from "@/lib/permissions";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";
import { getBusinessVertical } from "@/lib/verticals/server";
import { getBrandingSettingsForEdit, updateBusinessBranding, updateBusinessSubdomain } from "@/services/branding";
import { ServiceError } from "@/services/types";

/**
 * Business branding (docs/verticals phase 3) — logo, colours, sender name of a
 * "generic"-vertical business. A "dogs" business keeps the Petra brand → 404 here
 * (same as any module its vertical doesn't have).
 */
export async function GET(request: NextRequest) {
  const auth = await requireBusinessAuth(request);
  if (isGuardError(auth)) return auth;
  if ((await getBusinessVertical(auth.businessId)) !== "generic") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    return NextResponse.json(await getBrandingSettingsForEdit(auth.businessId));
  } catch (error) {
    if (error instanceof ServiceError) return NextResponse.json({ error: error.message }, { status: 404 });
    console.error("GET /api/settings/branding error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת המיתוג" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  // Same gate as PATCH /api/settings (rule #35): owner, or an owner-granted override.
  const auth = await requireBusinessPermission(request, TENANT_PERMS.SETTINGS_CRITICAL);
  if (isGuardError(auth)) return auth;
  if ((await getBusinessVertical(auth.businessId)) !== "generic") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
  }

  const input: Parameters<typeof updateBusinessBranding>[1] = {};
  const str = (v: unknown) => (v === null ? null : typeof v === "string" ? v.trim() : undefined);
  if (body.primaryColor !== undefined) {
    const v = str(body.primaryColor);
    if (!v) return NextResponse.json({ error: "צבע ראשי לא תקין" }, { status: 400 });
    input.primaryColor = v;
  }
  if (body.secondaryColor !== undefined) input.secondaryColor = str(body.secondaryColor) || null;
  if (body.senderName !== undefined) input.senderName = str(body.senderName) || null;
  if (body.logoUrl !== undefined) {
    const v = str(body.logoUrl) || null;
    if (v && v.length > 500) return NextResponse.json({ error: "כתובת הלוגו ארוכה מדי" }, { status: 400 });
    input.logoUrl = v;
  }
  const subdomain = typeof body.subdomain === "string" ? body.subdomain : undefined;
  if (Object.keys(input).length === 0 && subdomain === undefined) {
    return NextResponse.json({ error: "לא נשלחו שדות לעדכון" }, { status: 400 });
  }

  try {
    let slug: string | undefined;
    if (subdomain !== undefined) slug = await updateBusinessSubdomain(auth.businessId, subdomain);
    const result = Object.keys(input).length
      ? await updateBusinessBranding(auth.businessId, input)
      : await getBrandingSettingsForEdit(auth.businessId);
    logActivity(auth.session.user.id, auth.session.user.name, ACTIVITY_ACTIONS.UPDATE_SETTINGS, {
      businessId: auth.businessId,
      entityType: "BUSINESS",
      entityId: auth.businessId,
      entityLabel: slug ? `מיתוג · כתובת ${slug}` : "מיתוג",
    });
    return NextResponse.json({ ...result, ...(slug ? { slug } : {}) });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.code === "CONFLICT" ? 409 : 400 });
    }
    console.error("PATCH /api/settings/branding error:", error);
    return NextResponse.json({ error: "שגיאה בשמירת המיתוג" }, { status: 500 });
  }
}
