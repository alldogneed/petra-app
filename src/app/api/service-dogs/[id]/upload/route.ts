export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { put } from "@vercel/blob";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { MAX_FILE_SIZE, ALLOWED_FILE_EXTENSIONS, ALLOWED_MIME_TYPES } from "@/lib/file-upload-constants";

// Upload a file to Vercel Blob and return the URL — does NOT add to the documents list.
// Used by training test file attachments so they appear only in the tests tab.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) return NextResponse.json({ error: "לא נבחר קובץ" }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `קובץ גדול מדי – מקסימום 10MB (קובץ זה: ${(file.size / 1024 / 1024).toFixed(1)}MB)` },
        { status: 400 }
      );
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!(ALLOWED_FILE_EXTENSIONS as readonly string[]).includes(ext) || !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "סוג קובץ לא מורשה" }, { status: 400 });
    }

    // Verify the dog belongs to this business
    const profile = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      select: { id: true },
    });
    if (!profile) return NextResponse.json({ error: "כלב לא נמצא" }, { status: 404 });

    const fileId = crypto.randomBytes(16).toString("hex");
    const blobPath = `service-dogs/${params.id}/${fileId}.${ext}`;
    const blob = await put(blobPath, file, { access: "public" });

    return NextResponse.json({ url: blob.url, fileName: file.name }, { status: 201 });
  } catch (error) {
    console.error("POST service-dog upload error:", error);
    return NextResponse.json({ error: "שגיאה בהעלאת הקובץ" }, { status: 500 });
  }
}
