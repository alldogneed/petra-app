export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isGuardError, requireBusinessPermission } from "@/lib/auth-guards";
import { TENANT_PERMS } from "@/lib/permissions";
import { cancelScheduledMessage, ServiceError } from "@/services/notifications";
import { getPlatformTemplateTexts } from "@/lib/whatsapp-connections";
import { chainFromPayload, contextForScheduledMessage, buildTemplateChain } from "@/lib/whatsapp-template-chain";
import { META_TEMPLATES } from "@/lib/reminder-service";
import { interpolateTemplate } from "@/lib/whatsapp";
import { messageLabel, firstStep, type MessagePreview } from "@/lib/scheduled-message-preview";

// GET /api/scheduled-messages/[id] — what the customer received (or will receive):
// custom text as-is, or the approved Meta template text filled with its params.
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessPermission(request, TENANT_PERMS.VIEW_MESSAGES);
    if (isGuardError(authResult)) return authResult;

    const msg = await prisma.scheduledMessage.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: { customer: { select: { name: true } } },
    });
    if (!msg) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payload: Record<string, any> = {};
    try { payload = JSON.parse(msg.payloadJson || "{}") ?? {}; } catch { /* corrupted JSON — treat as empty */ }

    const flow = contextForScheduledMessage(payload, msg.relatedEntityType);
    const label = messageLabel(msg.templateKey, msg.relatedEntityType === "APPT_CONFIRMATION" ? "appointment_confirmation" : flow);
    const base: MessagePreview = { source: "none", label, text: null, footer: null, templateName: null, reconstructed: false };

    // 1) explicit text stored on the row
    let steps = chainFromPayload(payload);
    if (payload.body && steps.length === 0) {
      return NextResponse.json({ ...base, source: "custom", text: String(payload.body) });
    }

    // 2) old confirmation log rows kept no payload — rebuild the params from the appointment
    let reconstructed = false;
    if (steps.length === 0 && msg.relatedEntityType === "APPT_CONFIRMATION" && msg.relatedEntityId) {
      const appt = await prisma.appointment.findFirst({
        where: { id: msg.relatedEntityId, businessId: authResult.businessId },
        select: {
          date: true,
          startTime: true,
          customer: { select: { name: true } },
          service: { select: { name: true } },
          priceListItem: { select: { name: true } },
        },
      });
      if (appt) {
        const biz = await prisma.business.findUnique({ where: { id: authResult.businessId }, select: { phone: true } });
        const [h, m] = appt.startTime.split(":").map(Number);
        const d = new Date(appt.date);
        if (Number.isFinite(h) && Number.isFinite(m)) d.setHours(h, m, 0, 0);
        const date = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" }).format(d);
        const [v2, legacy] = META_TEMPLATES.appointmentConfirmation;
        const name = appt.customer?.name ?? "";
        const service = appt.service?.name ?? appt.priceListItem?.name ?? "תור";
        steps = buildTemplateChain([
          { name: v2, params: [name, date, appt.startTime, service, biz?.phone ?? ""] },
          { name: legacy, params: [name, date, appt.startTime, service] },
        ]);
        reconstructed = true;
      }
    }

    // 3) approved template text from Meta + params
    if (steps.length > 0) {
      const texts = await getPlatformTemplateTexts();
      const hit = firstStep(steps, texts);
      if (hit) {
        return NextResponse.json({ ...base, source: "template", text: hit.body, footer: hit.footer, templateName: hit.step.name, reconstructed });
      }
      return NextResponse.json({ ...base, source: "unavailable", templateName: steps[0].name, reconstructed });
    }

    // 4) free-text fallback the same way the "send now" route builds it
    if (payload.body) return NextResponse.json({ ...base, source: "custom", text: String(payload.body) });
    const template = await prisma.messageTemplate.findFirst({
      where: { businessId: msg.businessId, channel: "whatsapp", isActive: true, name: msg.templateKey },
    });
    if (template) {
      return NextResponse.json({ ...base, source: "custom", text: interpolateTemplate(template.body, { customerName: msg.customer?.name ?? "" }) });
    }
    return NextResponse.json(base);
  } catch (error) {
    console.error("GET scheduled-message preview error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת ההודעה" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessPermission(request, TENANT_PERMS.VIEW_MESSAGES);
    if (isGuardError(authResult)) return authResult;

    let updated;
    try {
      updated = await cancelScheduledMessage(authResult.businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
      }
      if (e instanceof ServiceError && e.code === "VALIDATION") {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH scheduled-message error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון הודעה" }, { status: 500 });
  }
}
