import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

// GET /api/integrations – list connected integrations with real gcal status
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch real gcal status from PlatformUser
    const [user, invoicingSettings] = await Promise.all([
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
        where: { businessId: DEMO_BUSINESS_ID },
        select: { providerName: true, status: true, connectedAt: true },
      }),
    ]);

    const invoicingConnected =
      !!invoicingSettings && invoicingSettings.status === "active";

    const integrations = [
      {
        id: "google-calendar",
        name: "Google Calendar",
        description: "סנכרון תורים עם גוגל קלנדר",
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
        id: "whatsapp",
        name: "WhatsApp Business",
        description: "שליחת הודעות אוטומטיות",
        icon: "message-circle",
        connected: false,
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
