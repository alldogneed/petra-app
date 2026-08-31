export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";
import { hasFeatureWithOverrides } from "@/lib/feature-flags";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

/** Staff cannot access contract templates */
function staffGuard(authResult: { session: { memberships: Array<{ businessId: string; role: string; isActive: boolean }> }; businessId: string }) {
  const m = authResult.session.memberships.find((mb) => mb.businessId === authResult.businessId && mb.isActive);
  if (m && !hasTenantPermission(m.role as TenantRole, TENANT_PERMS.SETTINGS_WRITE)) {
    return NextResponse.json({ error: "אין הרשאה לצפות בחוזים" }, { status: 403 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const blocked = staffGuard(authResult);
  if (blocked) return blocked;

  try {
    const templates = await prisma.contractTemplate.findMany({
      where: { businessId: authResult.businessId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(templates);
  } catch (error) {
    console.error("GET contract templates error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const blockedPost = staffGuard(authResult);
  if (blockedPost) return blockedPost;

  try {
    // Tier gate: digital contracts are BASIC+ only
    const business = await prisma.business.findUnique({
      where: { id: authResult.businessId },
      select: { tier: true, featureOverrides: true },
    });
    const overrides = (business?.featureOverrides as Record<string, boolean> | null) ?? null;
    if (!hasFeatureWithOverrides(business?.tier, "contracts", overrides)) {
      return NextResponse.json(
        { error: "חוזים דיגיטליים זמינים ממסלול בייסיק ומעלה", code: "TIER" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = (formData.get("name") as string | null)?.trim();
    const signaturePage = parseInt((formData.get("signaturePage") as string) || "1", 10);
    const signatureX = parseFloat((formData.get("signatureX") as string) || "0.1");
    const signatureY = parseFloat((formData.get("signatureY") as string) || "0.8");
    const signatureWidth = parseFloat((formData.get("signatureWidth") as string) || "0.35");
    const signatureHeight = parseFloat((formData.get("signatureHeight") as string) || "0.07");
    const fieldsRaw = (formData.get("fields") as string) || "[]";

    if (!file) return NextResponse.json({ error: "לא צורף קובץ" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "שם התבנית חסר" }, { status: 400 });
    if (name.length > 200) return NextResponse.json({ error: "שם תבנית ארוך מדי (מקסימום 200 תווים)" }, { status: 400 });

    // Validate fields JSON
    let fields: string;
    try {
      const parsed = JSON.parse(fieldsRaw);
      if (!Array.isArray(parsed)) return NextResponse.json({ error: "fields must be a JSON array" }, { status: 400 });
      if (fieldsRaw.length > 100_000) return NextResponse.json({ error: "fields payload too large" }, { status: 400 });
      fields = fieldsRaw;
    } catch {
      return NextResponse.json({ error: "fields is not valid JSON" }, { status: 400 });
    }
    if (file.type !== "application/pdf") return NextResponse.json({ error: "יש להעלות קובץ PDF בלבד" }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "קובץ גדול מדי — מקסימום 20MB" }, { status: 400 });

    // Blob storage preflight — fail with a specific message instead of a generic 500
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "אחסון הקבצים אינו מוגדר — פנה לתמיכה" }, { status: 503 });
    }

    const blobPath = `contracts/${authResult.businessId}/templates/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const blob = await put(blobPath, file, { access: "public" });

    const template = await prisma.contractTemplate.create({
      data: {
        businessId: authResult.businessId,
        name,
        fileUrl: blob.url,
        fileName: file.name,
        fileSize: file.size,
        signaturePage: Math.max(1, signaturePage),
        signatureX: Math.max(0, Math.min(1, signatureX)),
        signatureY: Math.max(0, Math.min(1, signatureY)),
        signatureWidth: Math.max(0.01, Math.min(1, signatureWidth)),
        signatureHeight: Math.max(0.01, Math.min(1, signatureHeight)),
        fields,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("POST contract template error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
