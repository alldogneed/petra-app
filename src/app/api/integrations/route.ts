import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// GET /api/integrations – list connected integrations
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return integration status (placeholder - full implementation requires
    // Google OAuth tokens to be stored in PlatformUser model)
    const integrations = [
      {
        id: "google-calendar",
        name: "Google Calendar",
        description: "סנכרון תורים עם גוגל קלנדר",
        icon: "calendar",
        connected: false,
        connectUrl: "/api/integrations/google/connect",
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
