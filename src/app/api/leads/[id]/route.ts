export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";
import { createPendingApproval } from "@/lib/pending-approvals";
import { shouldSyncContacts, upsertLeadContact } from "@/lib/google-contacts";

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

    const { id } = params;
    const raw = await request.json();
    const parsed = PatchLeadSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }
    // Use raw (any) for Prisma after Zod validation — avoids nullable/optional type conflicts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = raw;
    const { stage, name, phone, email, city, address, requestedService, source, notes, lostReasonCode, lostReasonText, lastContactedAt, wonAt, lostAt, nextFollowUpAt, followUpStatus, previousStageId } = body;

    const existing = await prisma.lead.findFirst({
      where: { id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Validate stage belongs to this business
    if (stage !== undefined) {
      const validStage = await prisma.leadStage.findFirst({
        where: { id: stage, businessId: authResult.businessId },
      });
      if (!validStage) {
        return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
      }
    }

    const lead = await prisma.lead.update({
      where: { id, businessId: authResult.businessId },
      data: {
        ...(stage !== undefined && { stage }),
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(city !== undefined && { city }),
        ...(address !== undefined && { address }),
        ...(requestedService !== undefined && { requestedService }),
        ...(source !== undefined && { source }),
        ...(notes !== undefined && { notes }),
        ...(lostReasonCode !== undefined && { lostReasonCode }),
        ...(lostReasonText !== undefined && { lostReasonText }),
        ...(lastContactedAt !== undefined && {
          lastContactedAt: new Date(lastContactedAt),
        }),
        ...(wonAt !== undefined && { wonAt: wonAt ? new Date(wonAt) : null }),
        ...(lostAt !== undefined && {
          lostAt: lostAt ? new Date(lostAt) : null,
        }),
        ...(nextFollowUpAt !== undefined && {
          nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : null,
        }),
        ...(followUpStatus !== undefined && { followUpStatus }),
        ...(previousStageId !== undefined && { previousStageId }),
      },
      include: {
        customer: true,
        callLogs: true,
      },
    });

    // ── Auto-task sync for follow-up date ──────────────────────────────────────
    if (nextFollowUpAt !== undefined) {
      // Delete previous follow-up task if it exists and not yet completed
      if (existing.followUpTaskId) {
        await prisma.task.deleteMany({
          where: {
            id: existing.followUpTaskId,
            businessId: authResult.businessId,
            status: { not: "COMPLETED" },
          },
        });
      }

      if (nextFollowUpAt) {
        // Create a new linked follow-up task
        const newTask = await prisma.task.create({
          data: {
            businessId: authResult.businessId,
            title: `מעקב עם ${existing.name}`,
            description: `מעקב עם ${existing.name}${existing.phone ? ` — ${existing.phone}` : ""}`,
            category: "LEADS",
            priority: "MEDIUM",
            status: "OPEN",
            dueDate: new Date(nextFollowUpAt),
            relatedEntityType: "LEAD",
            relatedEntityId: existing.id,
          },
        });
        await prisma.lead.update({
          where: { id, businessId: authResult.businessId },
          data: { followUpTaskId: newTask.id },
        });
      } else {
        // Follow-up cleared — remove reference
        await prisma.lead.update({
          where: { id, businessId: authResult.businessId },
          data: { followUpTaskId: null },
        });
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    const { session } = authResult;
    logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.UPDATE_LEAD);

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
          googleContactId: (lead as { googleContactId?: string | null }).googleContactId ?? null,
          businessId: lead.businessId,
        });
        if (resourceName && resourceName !== (lead as { googleContactId?: string | null }).googleContactId) {
          await prisma.lead.update({ where: { id: lead.id }, data: { googleContactId: resourceName } });
        }
      }).catch(() => {});
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error("Error updating lead:", error);
    return NextResponse.json(
      { error: "Failed to update lead" },
      { status: 500 }
    );
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

    // Staff/volunteer cannot delete leads
    if (!hasTenantPermission(callerRole, TENANT_PERMS.CONTENT_WRITE) ||
        callerRole === "user" || callerRole === "volunteer") {
      return NextResponse.json({ error: "אין הרשאה למחיקת ליד" }, { status: 403 });
    }

    const { id } = params;

    const existing = await prisma.lead.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Manager → route to pending approval
    if (callerRole === "manager") {
      const approval = await createPendingApproval({
        businessId,
        requestedByUserId: session.user.id,
        action: "DELETE_LEAD",
        description: `מחיקת ליד: ${existing.name}${existing.phone ? ` — ${existing.phone}` : ""}`,
        payload: { leadId: id, leadName: existing.name },
      });
      return NextResponse.json(
        { pendingApproval: true, approvalId: approval.id, message: "הבקשה נשלחה לאישור הבעלים" },
        { status: 202 }
      );
    }

    // Owner → require typed confirmation header
    const confirmHeader = request.headers.get("x-confirm-action");
    if (confirmHeader !== `DELETE_LEAD_${id}`) {
      return NextResponse.json(
        { error: "נדרש אישור מפורש למחיקה", requireConfirmation: true },
        { status: 428 }
      );
    }

    await prisma.lead.delete({ where: { id, businessId } });
    logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.DELETE_LEAD);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting lead:", error);
    return NextResponse.json(
      { error: "Failed to delete lead" },
      { status: 500 }
    );
  }
}
