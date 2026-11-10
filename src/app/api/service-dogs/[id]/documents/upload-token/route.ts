export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { DIRECT_UPLOAD_CONTENT_TYPES, MAX_FILE_SIZE, fileExtension, isAllowedUploadExtension } from "@/lib/blob-direct-upload";

/**
 * POST /api/service-dogs/[id]/documents/upload-token
 * Issues a short-lived Vercel Blob client token so the browser uploads the file
 * directly (files up to 10MB — an API route body is capped at 4.5MB by Vercel).
 * Only for this business's dog, only under service-dogs/<id>/, allowed types, ≤ 10MB.
 * No upload-completed callback: the page records the document with POST …/documents.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  const dog = await prisma.serviceDogProfile.findFirst({
    where: { id: params.id, businessId: authResult.businessId },
    select: { id: true },
  });
  if (!dog) return NextResponse.json({ error: "כלב לא נמצא" }, { status: 404 });

  let body: HandleUploadBody;
  try { body = (await request.json()) as HandleUploadBody; } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }
  if (body?.type !== "blob.generate-client-token") {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(`service-dogs/${params.id}/`) || pathname.includes("..")) {
          throw new Error("נתיב לא תקין");
        }
        if (!isAllowedUploadExtension(fileExtension(pathname))) throw new Error("סוג קובץ לא מורשה");
        return {
          allowedContentTypes: DIRECT_UPLOAD_CONTENT_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "שגיאה בהכנת ההעלאה";
    console.error("[service-dog upload-token]", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
