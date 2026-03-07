export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/service-dogs/alerts
// Returns categorized alerts for service dogs:
//   medical  — overdue protocols + protocols due within 30 days
//   training — active SERVICE_DOG programs with no session in last 14 days
//   compliance — pending compliance events (48-hr gov report)

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const ago14Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // ── 1. Medical alerts ──────────────────────────────────────────────────
    const medicalProtos = await prisma.serviceDogMedicalProtocol.findMany({
      where: {
        businessId,
        status: { in: ["PENDING", "OVERDUE"] },
        OR: [
          { status: "OVERDUE" },
          { dueDate: { lte: in30Days } },
        ],
      },
      include: {
        serviceDog: {
          include: { pet: { select: { name: true } } },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    const medical = medicalProtos.map((p) => ({
      id: p.id,
      dogId: p.serviceDogId,
      dogName: p.serviceDog.pet.name,
      label: p.protocolLabel,
      category: p.category,
      dueDate: p.dueDate,
      isOverdue: p.status === "OVERDUE" || (p.dueDate ? p.dueDate < now : false),
    }));

    // ── 2. Training alerts ────────────────────────────────────────────────
    const activePrograms = await prisma.trainingProgram.findMany({
      where: {
        businessId,
        trainingType: "SERVICE_DOG",
        status: "ACTIVE",
      },
      include: {
        dog: { select: { id: true, name: true } },
        sessions: {
          where: { status: "COMPLETED" },
          orderBy: { sessionDate: "desc" },
          take: 1,
        },
      },
    });

    const training = activePrograms
      .filter((p) => {
        const lastSession = p.sessions[0];
        if (!lastSession) return true; // never had a session
        return new Date(lastSession.sessionDate) < ago14Days;
      })
      .map((p) => ({
        id: p.id,
        dogId: p.dogId,
        dogName: p.dog.name,
        lastSessionDate: p.sessions[0]?.sessionDate ?? null,
        daysSinceLastSession: p.sessions[0]
          ? Math.floor((now.getTime() - new Date(p.sessions[0].sessionDate).getTime()) / 86400000)
          : null,
      }));

    // ── 3. Compliance alerts ──────────────────────────────────────────────
    const complianceEvents = await prisma.serviceDogComplianceEvent.findMany({
      where: {
        businessId,
        notificationStatus: "PENDING",
      },
      include: {
        serviceDog: {
          include: { pet: { select: { name: true } } },
        },
      },
      orderBy: { notificationDue: "asc" },
    });

    const compliance = complianceEvents.map((e) => ({
      id: e.id,
      dogId: e.serviceDogId,
      dogName: e.serviceDog.pet.name,
      eventType: e.eventType,
      eventDescription: e.eventDescription,
      notificationDue: e.notificationDue,
      isOverdue: e.notificationDue ? e.notificationDue < now : false,
    }));

    return NextResponse.json({
      medical: { count: medical.length, items: medical },
      training: { count: training.length, items: training },
      compliance: { count: compliance.length, items: compliance },
      total: medical.length + training.length + compliance.length,
    });
  } catch (error) {
    console.error("GET /api/service-dogs/alerts error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת התראות" }, { status: 500 });
  }
}
