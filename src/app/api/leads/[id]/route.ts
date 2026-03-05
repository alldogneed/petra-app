export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";

const PatchLeadSchema = z.object({
  stage: z.string().optional(),
  notes: z.string().max(5000).nullable().optional(),
  lostReasonCode: z.string().max(50).nullable().optional(),
  lostReasonText: z.string().max(500).nullable().optional(),
  lastContactedAt: z.string().datetime().nullable().optional(),
  wonAt: z.string().datetime().nullable().optional(),
  lostAt: z.string().datetime().nullable().optional(),
  nextFollowUpAt: z.string().datetime().nullable().optional(),
  followUpStatus: z.string().max(50).nullable().optional(),
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
    const { stage, notes, lostReasonCode, lostReasonText, lastContactedAt, wonAt, lostAt, nextFollowUpAt, followUpStatus } = body;

    const existing = await prisma.lead.findFirst({
      where: { id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const lead = await prisma.lead.update({
      where: { id, businessId: authResult.businessId },
      data: {
        ...(stage !== undefined && { stage }),
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

    const { id } = params;

    const existing = await prisma.lead.findFirst({
      where: { id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    await prisma.lead.delete({ where: { id, businessId: authResult.businessId } });

    const { session } = authResult;
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
