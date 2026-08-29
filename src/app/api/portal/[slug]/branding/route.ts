export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getPublicBranding } from "@/services/portal";
import {
  enforcePortalRateLimit,
  getClientIp,
  portalErrorResponse,
} from "../_shared";

// GET /api/portal/[slug]/branding — PUBLIC (no portal session required)
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const ip = getClientIp(request);
    const limited = await enforcePortalRateLimit(
      "portal:branding",
      ip,
      RATE_LIMITS.PUBLIC_READ
    );
    if (limited) return limited;

    const result = await getPublicBranding(params.slug);
    if (!result) {
      return NextResponse.json({ error: "הפורטל לא נמצא" }, { status: 404 });
    }

    const { business, branding } = result;
    return NextResponse.json({
      business: { name: business.name, logo: business.logo },
      branding: {
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        logoUrl: branding.logoUrl,
        aboutText: branding.aboutText,
        paymentLinkUrl: branding.paymentLinkUrl,
        senderName: branding.senderName,
      },
    });
  } catch (error) {
    return portalErrorResponse(error, "portal branding GET");
  }
}
