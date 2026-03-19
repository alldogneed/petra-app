export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// GET /api/integrations – list connected integrations with real gcal status
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const businessId = session.memberships.find((m) => m.isActive)?.businessId;
    if (!businessId) {
      return NextResponse.json({ error: "No active business" }, { status: 403 });
    }

    // Fetch real gcal status from PlatformUser
    const [user, invoicingSettings, stripeSettings] = await Promise.all([
      prisma.platformUser.findUnique({
        where: { id: session.user.id },
        select: {
          gcalConnected: true,
          gcalConnectedEmail: true,
          gcalSyncEnabled: true,
          gcalLastConnectedAt: true,
        },
      }),
      prisma.invoicingSettings.findUnique({
        where: { businessId },
        select: { providerName: true, status: true, connectedAt: true },
      }),
      prisma.stripeSettings.findUnique({
        where: { businessId },
        select: { publishableKey: true, accountId: true, status: true, connectedAt: true },
      }),
    ]);

    const invoicingConnected =
      !!invoicingSettings && invoicingSettings.status === "active";

    const integrations = [
      {
        id: "google-calendar",
        name: "Google Calendar",
        description: "פגישות חדשות יסונכרנו אוטומטית ללוח Petra Bookings ב-Google Calendar שלך",
        icon: "calendar",
        connected: user?.gcalConnected ?? false,
        connectedEmail: user?.gcalConnectedEmail ?? null,
        syncEnabled: user?.gcalSyncEnabled ?? false,
        lastConnectedAt: user?.gcalLastConnectedAt ?? null,
        connectUrl: "/api/integrations/google/connect",
        disconnectUrl: "/api/integrations/google/disconnect",
      },
      {
        id: "invoicing",
        name: "חשבוניות (Morning)",
        description: "הפקת חשבוניות וקבלות אוטומטית",
        icon: "file-text",
        connected: invoicingConnected,
        providerName: invoicingSettings?.providerName ?? null,
        connectedAt: invoicingSettings?.connectedAt ?? null,
        connectUrl: null, // handled by inline modal
        disconnectUrl: invoicingConnected ? "/api/invoicing/settings" : null,
      },
      {
        id: "stripe",
        name: "Stripe — תשלומים מקוונים",
        description: "שלח ללקוחות קישור לתשלום בכרטיס אשראי ועקוב אחר תשלומים אוטומטית",
        icon: "credit-card",
        connected: !!stripeSettings && stripeSettings.status === "active",
        publishableKey: stripeSettings?.publishableKey ?? null,
        accountId: stripeSettings?.accountId ?? null,
        connectedAt: stripeSettings?.connectedAt ?? null,
        connectUrl: null, // handled by inline settings form
        disconnectUrl: stripeSettings ? "/api/integrations/stripe" : null,
      },
      {
        id: "whatsapp",
        name: "WhatsApp Business",
        description: "שליחת הודעות WhatsApp אוטומטיות — תזכורות, ימי הולדת, חיסונים",
        icon: "message-circle",
        connected: !!(
          (process.env.META_WHATSAPP_TOKEN && process.env.META_PHONE_NUMBER_ID) ||
          (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
        ),
        fromNumber: null,
        connectUrl: null,
      },
      {
        id: "resend",
        name: "דוא״ל (Resend)",
        description: "שליחת מיילים ללקוחות",
        icon: "mail",
        connected: !!process.env.RESEND_API_KEY,
        connectUrl: null,
      },
    ];

    return NextResponse.json(integrations);
  } catch (error) {
    console.error("GET integrations error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת אינטגרציות" }, { status: 500 });
  }
}
