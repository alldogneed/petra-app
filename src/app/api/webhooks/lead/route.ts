/**
 * POST /api/webhooks/lead
 *
 * Public webhook endpoint for receiving leads from external sources (e.g. Make.com).
 * Secured via x-api-key header matching MAKE_WEBHOOK_SECRET env var.
 *
 * Body (all optional except name or phone):
 *   name     – full name of the lead
 *   phone    – Israeli phone number
 *   email    – email address
 *   source   – lead source label (e.g. "all-dog", "website")
 *   notes    – free-text message / form content
 *   petName  – pet's name (appended to notes)
 *   petBreed – pet's breed (appended to notes)
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const secret = process.env.MAKE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }

  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
  const email = typeof body.email === "string" ? body.email.trim() : undefined;
  const source = typeof body.source === "string" ? body.source.trim() : "all-dog";
  const petName = typeof body.petName === "string" ? body.petName.trim() : undefined;
  const petBreed = typeof body.petBreed === "string" ? body.petBreed.trim() : undefined;
  const rawNotes = typeof body.notes === "string" ? body.notes.trim() : undefined;

  if (!name && !phone) {
    return NextResponse.json(
      { error: "At least one of: name, phone is required" },
      { status: 400 }
    );
  }

  // Build notes — include pet info if provided
  const notesParts: string[] = [];
  if (rawNotes) notesParts.push(rawNotes);
  if (petName) notesParts.push(`שם כלב: ${petName}`);
  if (petBreed) notesParts.push(`גזע: ${petBreed}`);
  const notes = notesParts.length > 0 ? notesParts.join("\n") : undefined;

  // ── Create lead ─────────────────────────────────────────────────────────────
  try {
    const lead = await prisma.lead.create({
      data: {
        businessId: DEMO_BUSINESS_ID,
        name: name || phone || "ליד מהאתר",
        phone: phone || undefined,
        email: email || undefined,
        source,
        stage: "new",
        notes: notes || undefined,
      },
      select: { id: true, name: true, stage: true, createdAt: true },
    });

    return NextResponse.json(
      { success: true, leadId: lead.id, name: lead.name, stage: lead.stage },
      { status: 201 }
    );
  } catch (error) {
    console.error("[webhook/lead] DB error:", error);
    return NextResponse.json(
      { error: "Failed to create lead" },
      { status: 500 }
    );
  }
}
