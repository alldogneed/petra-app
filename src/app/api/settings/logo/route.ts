export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { put } from "@vercel/blob";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
// SVG excluded — can contain embedded JavaScript (stored XSS risk)
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "לא נשלח קובץ" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "סוג קובץ לא נתמך – יש להשתמש ב-PNG, JPG, WebP או GIF" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `קובץ גדול מדי – גודל מקסימלי 5MB (קובץ זה: ${(file.size / 1024 / 1024).toFixed(1)}MB)` },
        { status: 400 }
      );
    }

    const MIME_TO_EXT: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const ext = MIME_TO_EXT[file.type] || "png";
    const fileId = crypto.randomBytes(12).toString("hex");
    const blobPath = `logos/${authResult.businessId}/${fileId}.${ext}`;
    const blob = await put(blobPath, file, { access: "public" });

    // Save URL to business record
    await prisma.business.update({
      where: { id: authResult.businessId },
      data: { logo: blob.url },
    });

    return NextResponse.json({ url: blob.url }, { status: 201 });
  } catch (error) {
    console.error("POST logo upload error:", error);
    return NextResponse.json({ error: "שגיאה בהעלאת הלוגו" }, { status: 500 });
  }
}
