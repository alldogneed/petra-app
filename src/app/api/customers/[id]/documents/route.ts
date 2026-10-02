export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { put, del } from "@vercel/blob";
import { isGuardError } from "@/lib/auth-guards";
import { requireCustomerAccess } from "@/lib/customer-access";
import { getCustomerDocuments, mutateCustomerDocuments } from "@/services/customer-detail";
import { ServiceError } from "@/services/types";
import { MAX_FILE_SIZE, ALLOWED_FILE_EXTENSIONS, ALLOWED_MIME_TYPES } from "@/lib/file-upload-constants";

const DOCUMENT_CATEGORIES = [
  "contract",      // חוזה
  "invoice",       // חשבונית
  "receipt",       // קבלה
  "agreement",     // הסכם
  "medical",       // רפואי
  "insurance",     // ביטוח
  "other",         // אחר
] as const;


export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireCustomerAccess(request, "read");
    if (isGuardError(authResult)) return authResult;

    let docs;
    try {
      docs = await getCustomerDocuments(authResult.businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(docs);
  } catch (error) {
    console.error("GET customer documents error:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireCustomerAccess(request, "write");
    if (isGuardError(authResult)) return authResult;

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const category = (formData.get("category") as string) || "other";
    const rawLabel = (formData.get("label") as string) || null;
    const label = rawLabel ? rawLabel.replace(/[<>"'&]/g, "").slice(0, 255) : null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `קובץ גדול מדי – גודל מקסימלי 10MB (קובץ זה: ${(file.size / 1024 / 1024).toFixed(1)}MB)` },
        { status: 400 }
      );
    }

    // Validate file extension and MIME type
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_FILE_EXTENSIONS.includes(ext as typeof ALLOWED_FILE_EXTENSIONS[number]) || !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `סוג קובץ לא נתמך (.${ext}). סוגים מותרים: ${ALLOWED_FILE_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate category
    if (!DOCUMENT_CATEGORIES.includes(category as typeof DOCUMENT_CATEGORIES[number])) {
      return NextResponse.json(
        { error: "קטגוריה לא תקינה" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Upload to Vercel Blob
    const fileId = crypto.randomBytes(16).toString("hex");
    const blobPath = `customers/${params.id}/${fileId}.${ext}`;
    const blob = await put(blobPath, file, { access: "public" });

    const newDoc = {
      id: fileId,
      name: label || file.name.replace(/[<>"'&]/g, "").slice(0, 255),
      originalName: file.name.replace(/[<>"'&]/g, "").slice(0, 255),
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      url: blob.url,
      category,
      createdAt: new Date().toISOString(),
    };

    // Compare-and-swap append (concurrent uploads must not drop each other).
    try {
      await mutateCustomerDocuments(authResult.businessId, prisma, params.id, (docs) => ({
        docs: [...docs, newDoc],
        result: null,
      }));
    } catch (e) {
      // The row write failed → don't leave an orphan blob behind.
      await del(blob.url).catch(() => {});
      if (e instanceof ServiceError) {
        const status = e.code === "NOT_FOUND" ? 404 : e.code === "CONFLICT" ? 409 : 400;
        return NextResponse.json({ error: e.message }, { status });
      }
      throw e;
    }

    return NextResponse.json(newDoc, { status: 201 });
  } catch (error) {
    console.error("POST customer document error:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireCustomerAccess(request, "write");
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("docId");

    if (!docId) {
      return NextResponse.json({ error: "Missing docId" }, { status: 400 });
    }

    // Compare-and-swap removal; the blob is deleted only after the row no longer references it.
    let removed: { id: string; url?: string } | null;
    try {
      removed = await mutateCustomerDocuments(authResult.businessId, prisma, params.id, (docs) => ({
        docs: docs.filter((d) => d.id !== docId),
        result: docs.find((d) => d.id === docId) ?? null,
      }));
    } catch (e) {
      if (e instanceof ServiceError) {
        const status = e.code === "NOT_FOUND" ? 404 : e.code === "CONFLICT" ? 409 : 400;
        return NextResponse.json({ error: e.code === "NOT_FOUND" ? "Customer not found" : e.message }, { status });
      }
      throw e;
    }

    if (typeof removed?.url === "string" && removed.url.includes("vercel-storage.com")) {
      try {
        await del(removed.url);
      } catch {
        // Blob may not exist — continue anyway
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE customer document error:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
