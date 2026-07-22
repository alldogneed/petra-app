export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { toWhatsAppPhone } from "@/lib/utils";
import { resolvePublicOrigin } from "@/lib/env";
import { hasFeatureWithOverrides } from "@/lib/feature-flags";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";

/** Staff cannot resend contracts — customer PII is embedded in the document */
function staffGuard(authResult: { session: { memberships: Array<{ businessId: string; role: string; isActive: boolean }> }; businessId: string }) {
  const m = authResult.session.memberships.find((mb) => mb.businessId === authResult.businessId && mb.isActive);
  if (m && !hasTenantPermission(m.role as TenantRole, TENANT_PERMS.CUSTOMERS_PII)) {
    return NextResponse.json({ error: "אין הרשאה לשלוח חוזים" }, { status: 403 });
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { businessId } = authResult;
  const blocked = staffGuard(authResult);
  if (blocked) return blocked;

  try {
    const contractReq = await prisma.contractRequest.findFirst({
      where: { id: params.id, businessId },
      include: {
        customer: { select: { name: true, phone: true } },
        template: { select: { id: true, name: true } },
      },
    });

    if (!contractReq) {
      return NextResponse.json({ error: "חוזה לא נמצא" }, { status: 404 });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, tier: true, featureOverrides: true },
    });

    // Tier gate: digital contracts are BASIC+ only
    const overrides = (business?.featureOverrides as Record<string, boolean> | null) ?? null;
    if (!hasFeatureWithOverrides(business?.tier, "contracts", overrides)) {
      return NextResponse.json(
        { error: "חוזים דיגיטליים זמינים ממסלול בייסיק ומעלה", code: "TIER" },
        { status: 403 }
      );
    }

    const isExpired =
      contractReq.status === "EXPIRED" ||
      new Date(contractReq.expiresAt) < new Date();

    if (contractReq.status === "SIGNED") {
      return NextResponse.json({ error: "החוזה כבר נחתם" }, { status: 400 });
    }

    if (!contractReq.customer?.phone) {
      return NextResponse.json(
        { error: "ללקוח אין מספר טלפון" },
        { status: 400 }
      );
    }

    // Expired → create a new contract request with fresh token
    if (isExpired) {
      const plainToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(plainToken)
        .digest("hex");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const signUrl = `${resolvePublicOrigin(request)}/sign/${plainToken}`;

      const newReq = await prisma.contractRequest.create({
        data: {
          businessId,
          customerId: contractReq.customerId,
          templateId: contractReq.templateId,
          petId: contractReq.petId,
          tokenHash,
          expiresAt,
          sentAt: new Date(),
          signUrl,
        },
      });

      // Mark the old one as EXPIRED
      await prisma.contractRequest.update({
        where: { id: contractReq.id },
        data: { status: "EXPIRED" },
      });

      let waDelivered = false;
      try {
        const waResult = await sendWhatsAppMessage({
          to: toWhatsAppPhone(contractReq.customer.phone),
          body: `שלום ${contractReq.customer.name}! 📄\n${business?.name ?? ""} שלחו לך חוזה חדש לחתימה דיגיטלית.\n\nלחץ לצפייה ולחתימה:\n${signUrl}\n\nהקישור תקף ל-30 יום.`,
        });
        waDelivered = waResult.success;
      } catch (waError) {
        // WhatsApp failure shouldn't fail the request
        console.error("POST contract resend — WhatsApp error:", waError);
      }

      return NextResponse.json(
        { id: newReq.id, signUrl, renewed: true, waDelivered },
        { status: 201 }
      );
    }

    // PENDING / VIEWED → send reminder with existing signUrl.
    // Track delivery so the UI can offer a copy-link fallback.
    let waDelivered = false;
    try {
      const waResult = await sendWhatsAppMessage({
        to: toWhatsAppPhone(contractReq.customer.phone),
        body: `שלום ${contractReq.customer.name}! 📄\nתזכורת: ${business?.name ?? ""} שלחו לך חוזה לחתימה.\n\nלחץ לצפייה ולחתימה:\n${contractReq.signUrl}\n\nאנא חתום בהקדם.`,
      });
      waDelivered = waResult.success;
    } catch (waError) {
      console.error("POST contract resend — WhatsApp error:", waError);
    }

    return NextResponse.json({
      id: contractReq.id,
      reminded: true,
      signUrl: contractReq.signUrl,
      waDelivered,
    });
  } catch (error) {
    console.error("POST contract resend error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
