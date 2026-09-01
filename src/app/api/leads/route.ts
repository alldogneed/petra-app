export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { hasFeatureWithOverrides } from "@/lib/feature-flags";
import { sendLeadAlert } from "@/lib/lead-alert";
import { toWhatsAppPhone } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { listLeads, createLead, ServiceError } from "@/services/clients";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const leads = await listLeads(authResult.businessId, prisma);
    return NextResponse.json(leads);
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:leads:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });
    }

    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { name, phone, email, city, address, requestedService, source, stage, notes, customerId } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
    }

    let result;
    try {
      result = await createLead(authResult.businessId, prisma, {
        name, phone, email, city, address, requestedService, source, stage, notes, customerId,
      });
    } catch (e) {
      if (e instanceof ServiceError) {
        const status = e.code === "CONFLICT" ? 409 : e.code === "NOT_FOUND" ? 404 : 400;
        return NextResponse.json({ error: e.message, ...(e.details as object | null ?? {}) }, { status });
      }
      throw e;
    }

    const { lead, existingCustomer, duplicateLead, business } = result;
    logCurrentUserActivity("CREATE_LEAD");

    // ── Side effect: multi-channel lead alert (WhatsApp + email + bell) ──
    const bizOverrides = (business?.featureOverrides as Record<string, unknown> | null) ?? null;
    const canNotify = hasFeatureWithOverrides(
      business?.tier ?? "free",
      "lead_notifications",
      bizOverrides as Record<string, boolean> | null
    );
    if (business && canNotify) {
      await sendLeadAlert({
        businessId: authResult.businessId,
        businessPhone: business.phone ?? null,
        featureOverrides: bizOverrides,
        lead: {
          name: lead.name,
          phone: lead.phone ?? null,
          requestedService: lead.requestedService ?? null,
          city: (lead as { city?: string | null }).city ?? null,
          source: lead.source ?? null,
        },
      });
    }


    return NextResponse.json({ ...lead, existingCustomer, duplicateLead }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    console.error("Error creating lead:", error);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
