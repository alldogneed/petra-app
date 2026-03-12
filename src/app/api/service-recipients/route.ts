export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";

type Recipient = Record<string, unknown>;

function maskRecipientSensitive(r: Recipient): Recipient {
  return {
    ...r,
    idNumber:         null,
    address:          null,
    disabilityType:   null,
    disabilityNotes:  null,
    fundingSource:    null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const recipients = await prisma.serviceDogRecipient.findMany({
      where: {
        businessId,
        ...(status && { status }),
      },
      include: {
        customer: true,
        placements: {
          where: { status: { in: ["ACTIVE", "TRIAL"] } },
          include: { serviceDog: { include: { pet: true } } },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Mask sensitive fields for staff (user/volunteer)
    const membership = session.memberships.find((m) => m.businessId === businessId);
    const callerRole = (membership?.role ?? "user") as TenantRole;
    const canSeeSensitive = hasTenantPermission(callerRole, TENANT_PERMS.RECIPIENTS_SENSITIVE);

    const data = canSeeSensitive
      ? recipients
      : recipients.map((r) => maskRecipientSensitive(r as Recipient));

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/service-recipients error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת זכאים" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:service-recipients:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json();
    const { name, phone, email, idNumber, address, disabilityType, disabilityNotes, customerId, notes, fundingSource, intakeDate } = body;

    if (!name) {
      return NextResponse.json({ error: "נדרש שם" }, { status: 400 });
    }

    const recipient = await prisma.serviceDogRecipient.create({
      data: {
        businessId: authResult.businessId,
        name,
        phone: phone || null,
        email: email || null,
        idNumber: idNumber || null,
        address: address || null,
        disabilityType: disabilityType || null,
        disabilityNotes: disabilityNotes || null,
        customerId: customerId || null,
        notes: notes || null,
        fundingSource: fundingSource || null,
        intakeDate: intakeDate ? new Date(intakeDate) : null,
        status: "LEAD",
      },
    });

    return NextResponse.json(recipient, { status: 201 });
  } catch (error) {
    console.error("POST /api/service-recipients error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת מקבל" }, { status: 500 });
  }
}
