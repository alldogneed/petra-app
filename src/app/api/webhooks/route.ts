import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

// POST /api/webhooks – incoming webhook handler
// Handles callbacks from external services (WhatsApp, payment gateways, etc.)
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const source = request.headers.get("x-webhook-source") || "unknown";

    console.log(`Webhook received from: ${source}`, JSON.stringify(body).slice(0, 200));

    // Route to specific handler based on source
    switch (source) {
      case "whatsapp":
        // Handle WhatsApp delivery status updates
        return NextResponse.json({ received: true, handler: "whatsapp" });

      case "payment":
        // Handle payment gateway callbacks
        return NextResponse.json({ received: true, handler: "payment" });

      default:
        return NextResponse.json({ received: true, handler: "default" });
    }
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

// GET /api/webhooks – webhook status/info
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (isGuardError(authResult)) return authResult;

  return NextResponse.json({
    status: "active",
    endpoints: {
      whatsapp: "/api/webhooks (x-webhook-source: whatsapp)",
      payment: "/api/webhooks (x-webhook-source: payment)",
    },
  });
}
