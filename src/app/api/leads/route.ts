export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getMaxLeads, normalizeTier } from "@/lib/feature-flags";
import { getFirstLeadStageId } from "@/lib/lead-stages";
import { shouldSyncContacts, upsertLeadContact } from "@/lib/google-contacts";
import { validateIsraeliPhone, validateEmail, sanitizeName, normalizeIsraeliPhone } from "@/lib/validation";

/** Normalize a phone to the canonical 972XXXXXXXXX format used in Customer.phoneNorm */
function phoneToNorm(raw: string): string | null {
  try {
    const normalized = normalizeIsraeliPhone(raw);
    const digits = normalized.replace(/\D/g, "");
    if (digits.startsWith("972") && digits.length >= 11) return digits;
    if (digits.startsWith("0") && digits.length >= 9) return "972" + digits.slice(1);
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const leads = await prisma.lead.findMany({
      where: { businessId: authResult.businessId },
      include: {
        customer: true,
        callLogs: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // ── Duplicate detection ────────────────────────────────────────────────
    // Build leadId → phoneNorm map
    const normByLeadId = new Map<string, string>();
    for (const lead of leads) {
      if (lead.phone) {
        const norm = phoneToNorm(lead.phone);
        if (norm) normByLeadId.set(lead.id, norm);
      }
    }
    const allNorms = [...new Set(normByLeadId.values())];

    // Batch-check customers
    const matchingCustomers = allNorms.length > 0
      ? await prisma.customer.findMany({
          where: { businessId: authResult.businessId, phoneNorm: { in: allNorms } },
          select: { id: true, name: true, phoneNorm: true },
        })
      : [];
    const normToCustomer = new Map(
      matchingCustomers.filter(c => c.phoneNorm).map(c => [c.phoneNorm!, { id: c.id, name: c.name }])
    );

    // Detect lead-to-lead duplicates (same norm → multiple leads)
    const normToLeads = new Map<string, { id: string; name: string }[]>();
    for (const lead of leads) {
      const norm = normByLeadId.get(lead.id);
      if (norm) {
        if (!normToLeads.has(norm)) normToLeads.set(norm, []);
        normToLeads.get(norm)!.push({ id: lead.id, name: lead.name });
      }
    }

    // Enrich each lead
    const enrichedLeads = leads.map((lead) => {
      const norm = normByLeadId.get(lead.id) ?? null;
      const existingCustomer = norm ? (normToCustomer.get(norm) ?? null) : null;
      const duplicateLead = norm
        ? (normToLeads.get(norm)?.find(l => l.id !== lead.id) ?? null)
        : null;
      return { ...lead, existingCustomer, duplicateLead };
    });

    return NextResponse.json(enrichedLeads);
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 }
    );
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

    // Enforce lead limit for free tier
    const business = await prisma.business.findUnique({ where: { id: authResult.businessId }, select: { tier: true } });
    const maxLeads = getMaxLeads(normalizeTier(business?.tier));
    if (maxLeads !== null) {
      const currentCount = await prisma.lead.count({ where: { businessId: authResult.businessId } });
      if (currentCount >= maxLeads) {
        return NextResponse.json(
          { error: `הגעת לתקרת ${maxLeads} הלידים במסלול החינמי. שדרג לבייסיק כדי להוסיף ללא הגבלה.`, code: "LIMIT_REACHED" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const { name, phone, email, city, address, requestedService, source, stage, notes, customerId } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    // Validate and sanitize inputs
    const sanitizedName = sanitizeName(name);
    if (!sanitizedName || sanitizedName.length < 2) {
      return NextResponse.json({ error: "שם לא תקין — נא להזין לפחות 2 תווים" }, { status: 400 });
    }

    if (email) {
      const emailErr = validateEmail(email);
      if (emailErr) {
        return NextResponse.json({ error: emailErr }, { status: 400 });
      }
    }

    if (phone) {
      const phoneErr = validateIsraeliPhone(phone);
      if (phoneErr) {
        return NextResponse.json({ error: phoneErr }, { status: 400 });
      }
    }

    // Enforce string length limits to prevent abuse
    if (notes && typeof notes === "string" && notes.length > 5000) {
      return NextResponse.json({ error: "הערות ארוכות מדי (מקסימום 5000 תווים)" }, { status: 400 });
    }

    // ── Duplicate detection ──────────────────────────────────────────────────
    let existingCustomer: { id: string; name: string } | null = null;
    let duplicateLead: { id: string; name: string } | null = null;
    if (phone) {
      const norm = phoneToNorm(phone);
      if (norm) {
        const dupCust = await prisma.customer.findFirst({
          where: { businessId: authResult.businessId, phoneNorm: norm },
          select: { id: true, name: true },
        });
        if (dupCust) existingCustomer = dupCust;

        const existingLeads = await prisma.lead.findMany({
          where: { businessId: authResult.businessId, phone: { not: null } },
          select: { id: true, name: true, phone: true },
        });
        for (const l of existingLeads) {
          if (l.phone && phoneToNorm(l.phone) === norm) {
            duplicateLead = { id: l.id, name: l.name };
            break;
          }
        }
      }
    }

    let resolvedStage = stage;
    if (stage) {
      const validStage = await prisma.leadStage.findFirst({
        where: { id: stage, businessId: authResult.businessId },
      });
      if (!validStage) {
        return NextResponse.json({ error: "Invalid stage value" }, { status: 400 });
      }
    } else {
      // Default to "ליד חדש" (first stage), auto-creating stages if needed
      resolvedStage = await getFirstLeadStageId(authResult.businessId);
    }

    const lead = await prisma.lead.create({
      data: {
        businessId: authResult.businessId,
        name: sanitizedName,
        phone,
        email,
        city: city || null,
        address: address || null,
        requestedService: requestedService || null,
        source,
        stage: resolvedStage,
        notes,
        customerId: customerId || undefined,
      },
      include: {
        customer: true,
        callLogs: true,
      },
    });

    logCurrentUserActivity("CREATE_LEAD");

    // Fire-and-forget: sync to Google Contacts if enabled
    if (lead.phone || lead.email) {
      shouldSyncContacts(authResult.businessId).then(async (enabled) => {
        if (!enabled) return;
        const resourceName = await upsertLeadContact({
          id: lead.id,
          name: lead.name,
          phone: lead.phone ?? null,
          email: lead.email ?? null,
          notes: lead.notes ?? null,
          requestedService: lead.requestedService ?? null,
          city: lead.city ?? null,
          googleContactId: null,
          businessId: lead.businessId,
        });
        if (resourceName) {
          await prisma.lead.update({ where: { id: lead.id }, data: { googleContactId: resourceName } });
        }
      }).catch(() => {});
    }

    return NextResponse.json({ ...lead, existingCustomer, duplicateLead }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    console.error("Error creating lead:", error);
    return NextResponse.json(
      { error: "Failed to create lead" },
      { status: 500 }
    );
  }
}
