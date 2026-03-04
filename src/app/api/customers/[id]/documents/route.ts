export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { put, del } from "@vercel/blob";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const customer = await prisma.customer.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      select: { documents: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    let docs = [];
    try {
      docs = JSON.parse(customer.documents || "[]");
    } catch {
      docs = [];
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
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const category = (formData.get("category") as string) || "other";
    const label = (formData.get("label") as string) || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `קובץ גדול מדי – גודל מקסימלי 10MB (קובץ זה: ${(file.size / 1024 / 1024).toFixed(1)}MB)` },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      select: { documents: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Upload to Vercel Blob
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const fileId = crypto.randomBytes(16).toString("hex");
    const blobPath = `customers/${params.id}/${fileId}.${ext}`;
    const blob = await put(blobPath, file, { access: "public" });

    const newDoc = {
      id: fileId,
      name: label || file.name,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      url: blob.url,
      category,
      createdAt: new Date().toISOString(),
    };

    let docs = [];
    try {
      docs = JSON.parse(customer.documents || "[]");
    } catch {
      docs = [];
    }
    docs.push(newDoc);

    await prisma.customer.update({
      where: { id: params.id, businessId: authResult.businessId },
      data: { documents: JSON.stringify(docs) },
    });

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
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("docId");

    if (!docId) {
      return NextResponse.json({ error: "Missing docId" }, { status: 400 });
    }

    const customer = await prisma.customer.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      select: { documents: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    let docs: { id: string; url: string }[] = [];
    try {
      docs = JSON.parse(customer.documents || "[]");
    } catch {
      docs = [];
    }

    const docToDelete = docs.find((d) => d.id === docId);
    if (docToDelete?.url?.includes("vercel-storage.com")) {
      try {
        await del(docToDelete.url);
      } catch {
        // Blob may not exist — continue anyway
      }
    }

    const filtered = docs.filter((d) => d.id !== docId);

    await prisma.customer.update({
      where: { id: params.id, businessId: authResult.businessId },
      data: { documents: JSON.stringify(filtered) },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE customer document error:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
