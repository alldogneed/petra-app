export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";
import { createPendingApproval } from "@/lib/pending-approvals";
import { shouldSyncContacts, upsertLeadContact } from "@/lib/google-contacts";
import { cancelLeadFollowup } from "@/lib/reminder-service";
import { updateLead, deleteLead, ServiceError, type UpdateLeadInput } from "@/services/clients";

const PatchLeadSchema = z.object({
  stage: z.string().optional(),
  name: z.string().max(200).optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  requestedService: z.string().max(200).nullable().optional(),
  source: z.string().max(50).optional(),
  notes: z.string().max(5000).nullable().optional(),
  lostReasonCode: z.string().max(50).nullable().optional(),
  lostReasonText: z.string().max(500).nullable().optional(),
  lastContactedAt: z.string().datetime().nullable().optional(),
  wonAt: z.string().datetime().nullable().optional(),
  lostAt: z.string().datetime().nullable().optional(),
  nextFollowUpAt: z.string().datetime().nullable().optional(),
  followUpStatus: z.string().max(50).nullable().optional(),
  previousStageId: z.string().max(100).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const raw = await request.json();
    const parsed = PatchLeadSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    let lead;
    try {
      lead = await updateLead(authResult.businessId, prisma, params.id, parsed.data as UpdateLeadInput);
    } catch (e) {
      if (e instanceof ServiceError) {
        const status = e.code === "NOT_FOUND" ? 404 : e.code === "VALIDATION" ? 400 : 400;
        return NextResponse.json({ error: e.message }, { status });
      }
      throw e;
    }

    const { session } = authResult;
    logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.UPDATE_LEAD);

    // Fire-and-forget: Google Contacts sync
    if (lead.phone || lead.email) {
      shouldSyncContacts(authResult.businessId).then(async (enabled) => {
        if (!enabled) return;
        const resourceName = await upsertLeadContact({
          id: lead.id, name: lead.name, phone: lead.phone ?? null,
          email: lead.email ?? null, notes: lead.notes ?? null,
          requestedService: lead.requestedService ?? null,
          city: (lead as { city?: string | null }).city ?? null,
          googleContactId: (lead as { googleContactId?: string | null }).googleContactId ?? null,
          businessId: lead.businessId,
        });
        if (resourceName && resourceName !== (lead as { googleContactId?: string | null }).googleContactId) {
          await prisma.lead.update({ where: { id: lead.id }, data: { googleContactId: resourceName } });
        }
      }).catch((err) => console.error("Google Contacts sync (lead update) failed:", err));
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error("Error updating lead:", error);
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { session, businessId } = authResult;

    const membership = session.memberships.find((m) => m.businessId === businessId);
    const callerRole = (membership?.role ?? "user") as TenantRole;

    if (
      !hasTenantPermission(callerRole, TENANT_PERMS.CONTENT_WRITE) ||
      callerRole === "user" ||
      callerRole === "volunteer"
    ) {
      return NextResponse.json({ error: "אין הרשאה למחיקת ליד" }, { status: 403 });
    }

    if (callerRole === "manager") {
      const existing = await prisma.lead.findFirst({ where: { id: params.id, businessId } });
      if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      const approval = await createPendingApproval({
        businessId, requestedByUserId: session.user.id, action: "DELETE_LEAD",
        description: `מחיקת ליד: ${existing.name}${existing.phone ? ` — ${existing.phone}` : ""}`,
        payload: { leadId: params.id, leadName: existing.name },
      });
      return NextResponse.json(
        { pendingApproval: true, approvalId: approval.id, message: "הבקשה נשלחה לאישור הבעלים" },
        { status: 202 }
      );
    }

    const confirmHeader = request.headers.get("x-confirm-action");
    if (confirmHeader !== `DELETE_LEAD_${params.id}`) {
      return NextResponse.json({ error: "נדרש אישור מפורש למחיקה", requireConfirmation: true }, { status: 428 });
    }

    let deleteResult;
    try {
      deleteResult = await deleteLead(businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }
      throw e;
    }

    // Lead deleted — cancel any pending lead_followup message
    await cancelLeadFollowup(params.id).catch((err) =>
      console.error("cancelLeadFollowup (delete) failed (non-critical):", err)
    );

    logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.DELETE_LEAD);
    return NextResponse.json({ success: true, ...(deleteResult.alreadyDeleted ? { alreadyDeleted: true } : {}) });
  } catch (error) {
    console.error("Error deleting lead:", error);
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
  }
}
