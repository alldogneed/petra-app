import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";

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
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
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
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const category = (formData.get("category") as string) || "other";
    const label = (formData.get("label") as string) || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large (max 10MB)" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
      select: { documents: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Save file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const fileId = crypto.randomBytes(16).toString("hex");
    const filename = `${fileId}.${ext}`;
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "customers",
      params.id
    );
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);

    // Build document metadata
    const newDoc = {
      id: fileId,
      name: label || file.name,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      url: `/uploads/customers/${params.id}/${filename}`,
      category,
      createdAt: new Date().toISOString(),
    };

    // Update customer documents
    let docs = [];
    try {
      docs = JSON.parse(customer.documents || "[]");
    } catch {
      docs = [];
    }
    docs.push(newDoc);

    await prisma.customer.update({
      where: { id: params.id },
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
    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("docId");

    if (!docId) {
      return NextResponse.json({ error: "Missing docId" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
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

    // Find the doc to delete its file
    const docToDelete = docs.find((d) => d.id === docId);
    if (docToDelete?.url) {
      try {
        const filePath = path.join(process.cwd(), "public", docToDelete.url);
        await unlink(filePath);
      } catch {
        // File may not exist — continue anyway
      }
    }

    const filtered = docs.filter((d) => d.id !== docId);

    await prisma.customer.update({
      where: { id: params.id },
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
