/**
 * Training service — groups, programs, packages, attendance.
 *
 * All functions are business-scoped (businessId first param).
 * No Request/Response knowledge. Throws ServiceError on failure.
 *
 * Side effects that stay in routes:
 *   - scheduleGroupSessionReminders / rescheduleGroupSessionReminders / cancelGroupSessionReminders
 *   - scheduleRemindersForNewParticipant
 *   - scheduleTrainingSessionReminder / cancelTrainingSessionReminder
 *   - rateLimit, createPendingApproval, x-confirm-action header checks
 */

import type { DbClient } from "./supabase";
import { ServiceError } from "./types";
import { deleteOrder, updateOrder } from "./orders";

export { ServiceError };
export type { DbClient };

// ─── Order side-effects for training process delete / convert ───────────────

export type OrderAction = "keep" | "cancel" | "delete";

/**
 * Apply the chosen side-effect to a training process's linked order.
 * Returns `{ orderDowngraded: true }` when a requested delete fell back to
 * cancel because the order was already confirmed/paid (deleteOrder rejects
 * non-draft/cancelled orders).
 */
export async function applyOrderAction(
  businessId: string,
  db: DbClient,
  orderId: string | null | undefined,
  action: OrderAction | undefined
): Promise<{ orderDowngraded: boolean }> {
  if (!orderId || !action || action === "keep") return { orderDowngraded: false };

  if (action === "cancel") {
    try {
      await updateOrder(businessId, db, orderId, { status: "cancelled" });
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") return { orderDowngraded: false };
      throw e;
    }
    return { orderDowngraded: false };
  }

  // action === "delete"
  try {
    await deleteOrder(businessId, db, orderId);
    return { orderDowngraded: false };
  } catch (e) {
    if (e instanceof ServiceError && e.code === "NOT_FOUND") return { orderDowngraded: false };
    // Confirmed/paid order can't be deleted → cancel instead and signal the UI.
    if (e instanceof ServiceError && e.code === "VALIDATION") {
      try {
        await updateOrder(businessId, db, orderId, { status: "cancelled" });
      } catch (e2) {
        if (!(e2 instanceof ServiceError && e2.code === "NOT_FOUND")) throw e2;
      }
      return { orderDowngraded: true };
    }
    throw e;
  }
}

// ─── Training Groups ───────────────────────────────────────────────────────

export async function listTrainingGroups(
  businessId: string,
  db: DbClient,
  opts: { activeOnly?: boolean } = {}
) {
  return db.trainingGroup.findMany({
    where: {
      businessId,
      ...(opts.activeOnly ? { isActive: true } : {}),
    },
    include: {
      participants: {
        include: {
          dog: { select: { id: true, name: true, species: true, breed: true } },
          customer: { select: { id: true, name: true, phone: true } },
        },
      },
      sessions: {
        orderBy: { sessionDatetime: "desc" },
        take: 5,
        include: { attendance: { select: { id: true } } },
      },
      _count: { select: { participants: true, sessions: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTrainingGroup(businessId: string, db: DbClient, id: string) {
  const group = await db.trainingGroup.findFirst({
    where: { id, businessId },
    include: {
      participants: {
        include: {
          dog: { select: { id: true, name: true, species: true, breed: true } },
          customer: { select: { id: true, name: true, phone: true } },
        },
      },
      sessions: {
        orderBy: { sessionDatetime: "asc" },
        include: {
          attendance: {
            include: {
              participant: {
                include: {
                  dog: { select: { id: true, name: true } },
                  customer: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
      _count: { select: { participants: true, sessions: true } },
    },
  });
  if (!group) throw new ServiceError("קבוצת אימון לא נמצאה", "NOT_FOUND");
  return group;
}

export interface CreateTrainingGroupInput {
  name: string;
  groupType: string;
  maxParticipants?: number | null;
  location?: string | null;
  defaultDayOfWeek?: number | null;
  defaultTime?: string | null;
  notes?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  reminderEnabled?: boolean;
  reminderLeadHours?: number | null;
  reminderSameDay?: boolean;
  isActive?: boolean;
}

export async function createTrainingGroup(
  businessId: string,
  db: DbClient,
  input: CreateTrainingGroupInput,
  opts: { maxGroups?: number | null } = {}
) {
  if (opts.maxGroups !== null && opts.maxGroups !== undefined) {
    const count = await db.trainingGroup.count({ where: { businessId } });
    if (count >= opts.maxGroups) {
      throw new ServiceError(
        `הגעת לתקרת ${opts.maxGroups} קבוצות האילוף במסלול החינמי. שדרג לבייסיק כדי להוסיף ללא הגבלה.`,
        "VALIDATION",
        { code: "LIMIT_REACHED" }
      );
    }
  }

  return db.trainingGroup.create({
    data: {
      businessId,
      name: input.name,
      groupType: input.groupType,
      ...(input.maxParticipants !== undefined && { maxParticipants: input.maxParticipants }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.defaultDayOfWeek !== undefined && { defaultDayOfWeek: input.defaultDayOfWeek }),
      ...(input.defaultTime !== undefined && { defaultTime: input.defaultTime }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.startDate !== undefined && { startDate: input.startDate ? new Date(input.startDate) : null }),
      ...(input.endDate !== undefined && { endDate: input.endDate ? new Date(input.endDate) : null }),
      reminderEnabled: input.reminderEnabled ?? false,
      ...(input.reminderLeadHours !== undefined && { reminderLeadHours: input.reminderLeadHours }),
      reminderSameDay: input.reminderSameDay ?? false,
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    } as any,
    include: { _count: { select: { participants: true, sessions: true } } },
  });
}

export interface UpdateTrainingGroupData {
  name?: string;
  groupType?: string;
  maxParticipants?: number | null;
  location?: string | null;
  defaultDayOfWeek?: number | null;
  defaultTime?: string | null;
  notes?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isActive?: boolean;
  reminderEnabled?: boolean;
  reminderLeadHours?: number | null;
  reminderSameDay?: boolean;
}

export async function updateTrainingGroup(
  businessId: string,
  db: DbClient,
  id: string,
  data: UpdateTrainingGroupData
) {
  const existing = await db.trainingGroup.findFirst({
    where: { id, businessId },
    select: { id: true, reminderEnabled: true },
  });
  if (!existing) throw new ServiceError("קבוצת אימון לא נמצאה", "NOT_FOUND");

  const hadReminderEnabled = existing.reminderEnabled;

  const group = await db.trainingGroup.update({
    where: { id, businessId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.groupType !== undefined && { groupType: data.groupType }),
      ...(data.maxParticipants !== undefined && { maxParticipants: data.maxParticipants }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.defaultDayOfWeek !== undefined && { defaultDayOfWeek: data.defaultDayOfWeek }),
      ...(data.defaultTime !== undefined && { defaultTime: data.defaultTime }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
      ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.reminderEnabled !== undefined && { reminderEnabled: data.reminderEnabled }),
      ...(data.reminderLeadHours !== undefined && { reminderLeadHours: data.reminderLeadHours }),
      ...(data.reminderSameDay !== undefined && { reminderSameDay: data.reminderSameDay }),
    } as any,
    include: {
      participants: {
        include: {
          dog: { select: { id: true, name: true, species: true, breed: true } },
          customer: { select: { id: true, name: true, phone: true } },
        },
      },
      sessions: {
        orderBy: { sessionDatetime: "asc" },
        include: { attendance: { select: { id: true } } },
      },
      _count: { select: { participants: true, sessions: true } },
    },
  });

  const reminderSettingsChanged =
    data.reminderEnabled !== undefined ||
    data.reminderLeadHours !== undefined ||
    data.reminderSameDay !== undefined;

  return { group, reminderSettingsChanged, hadReminderEnabled };
}

export async function deleteTrainingGroup(
  businessId: string,
  db: DbClient,
  id: string
): Promise<{ sessionIds: string[] }> {
  const group = await db.trainingGroup.findFirst({
    where: { id, businessId },
    select: { id: true, sessions: { select: { id: true } } },
  });
  if (!group) throw new ServiceError("קבוצת אימון לא נמצאה", "NOT_FOUND");

  const sessionIds = group.sessions.map((s) => s.id);
  await db.trainingGroup.delete({ where: { id } });
  return { sessionIds };
}

// ─── Training Group Participants ───────────────────────────────────────────

export async function addGroupParticipant(
  businessId: string,
  db: DbClient,
  groupId: string,
  input: { customerId: string; dogId: string }
) {
  const group = await db.trainingGroup.findFirst({
    where: { id: groupId, businessId },
    select: { maxParticipants: true, _count: { select: { participants: true } } },
  });
  if (!group) throw new ServiceError("קבוצת אימון לא נמצאה", "NOT_FOUND");
  if (group.maxParticipants && group._count.participants >= group.maxParticipants) {
    throw new ServiceError("Group is full", "VALIDATION");
  }

  const customer = await db.customer.findFirst({
    where: { id: input.customerId, businessId },
    select: { id: true },
  });
  if (!customer) throw new ServiceError("לקוח לא נמצא", "NOT_FOUND");

  const dog = await db.pet.findFirst({
    where: { id: input.dogId, customerId: input.customerId },
    select: { id: true },
  });
  if (!dog) throw new ServiceError("הכלב אינו שייך ללקוח שנבחר", "NOT_FOUND");

  const existing = await db.trainingGroupParticipant.findUnique({
    where: { trainingGroupId_dogId: { trainingGroupId: groupId, dogId: input.dogId } },
  });
  if (existing) throw new ServiceError("הכלב כבר רשום לקבוצה זו", "CONFLICT");

  return db.trainingGroupParticipant.create({
    data: { trainingGroupId: groupId, customerId: input.customerId, dogId: input.dogId },
    include: {
      dog: { select: { id: true, name: true, species: true, breed: true } },
      customer: { select: { id: true, name: true, phone: true } },
    },
  });
}

export async function removeGroupParticipant(
  businessId: string,
  db: DbClient,
  participantId: string
) {
  const participant = await db.trainingGroupParticipant.findUnique({
    where: { id: participantId },
    select: { trainingGroup: { select: { businessId: true } } },
  });
  if (!participant || participant.trainingGroup.businessId !== businessId) {
    throw new ServiceError("Participant not found", "NOT_FOUND");
  }
  await db.trainingGroupParticipant.delete({ where: { id: participantId } });
}

// ─── Training Group Sessions ───────────────────────────────────────────────

export async function createGroupSession(
  businessId: string,
  db: DbClient,
  groupId: string,
  input: { sessionDatetime: Date; status?: string; notes?: string | null }
) {
  const group = await db.trainingGroup.findFirst({ where: { id: groupId, businessId } });
  if (!group) throw new ServiceError("קבוצת אימון לא נמצאה", "NOT_FOUND");

  const duplicate = await db.trainingGroupSession.findFirst({
    where: { trainingGroupId: groupId, sessionDatetime: input.sessionDatetime },
  });
  if (duplicate) {
    throw new ServiceError("כבר קיים מפגש בקבוצה במועד הזה", "CONFLICT");
  }

  const count = await db.trainingGroupSession.count({ where: { trainingGroupId: groupId } });

  const session = await db.trainingGroupSession.create({
    data: {
      trainingGroupId: groupId,
      sessionDatetime: input.sessionDatetime,
      sessionNumber: count + 1,
      status: input.status ?? "SCHEDULED",
      notes: input.notes ?? null,
    },
    include: { attendance: true },
  });

  const participants = await db.trainingGroupParticipant.findMany({
    where: { trainingGroupId: groupId, status: "ACTIVE" },
  });
  if (participants.length > 0) {
    await db.trainingGroupAttendance.createMany({
      data: participants.map((p) => ({
        trainingGroupSessionId: session.id,
        participantId: p.id,
        dogId: p.dogId,
        customerId: p.customerId,
        attendanceStatus: "NO_SHOW",
      })),
      skipDuplicates: true,
    });
  }

  return session;
}

export async function updateGroupSession(
  businessId: string,
  db: DbClient,
  groupId: string,
  sessionId: string,
  data: { status?: string; notes?: string | null; sessionDatetime?: Date }
) {
  const existing = await db.trainingGroupSession.findFirst({
    where: { id: sessionId, trainingGroupId: groupId, trainingGroup: { businessId } },
  });
  if (!existing) throw new ServiceError("מפגש לא נמצא", "NOT_FOUND");

  const session = await db.trainingGroupSession.update({
    where: { id: sessionId, trainingGroupId: groupId },
    data: {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.sessionDatetime !== undefined && { sessionDatetime: data.sessionDatetime }),
    },
    include: { attendance: true },
  });

  const datetimeChanged =
    data.sessionDatetime !== undefined &&
    data.sessionDatetime.getTime() !== existing.sessionDatetime.getTime();
  const movedToInactive = data.status === "CANCELED" || data.status === "COMPLETED";

  return { session, datetimeChanged, movedToInactive };
}

export async function deleteGroupSession(
  businessId: string,
  db: DbClient,
  groupId: string,
  sessionId: string
) {
  const existing = await db.trainingGroupSession.findFirst({
    where: { id: sessionId, trainingGroupId: groupId, trainingGroup: { businessId } },
  });
  if (!existing) throw new ServiceError("מפגש לא נמצא", "NOT_FOUND");
  await db.trainingGroupSession.delete({ where: { id: sessionId } });
}

export async function generateGroupSessions(
  businessId: string,
  db: DbClient,
  groupId: string,
  input: { count: number; startDate?: Date; time?: string }
): Promise<{ created: string[] }> {
  const group = await db.trainingGroup.findFirst({ where: { id: groupId, businessId } });
  if (!group) throw new ServiceError("קבוצה לא נמצאה", "NOT_FOUND");

  const time = input.time || group.defaultTime || "10:00";
  const [hh, mm] = time.split(":").map((n: string) => parseInt(n, 10));

  let firstDate: Date;
  if (input.startDate) {
    firstDate = new Date(input.startDate);
  } else {
    if (group.defaultDayOfWeek == null) {
      throw new ServiceError(
        "יש להגדיר יום קבוע לקבוצה או לבחור תאריך התחלה",
        "VALIDATION"
      );
    }
    const now = new Date();
    firstDate = new Date(now);
    firstDate.setHours(hh, mm, 0, 0);
    const dayDiff = (group.defaultDayOfWeek - firstDate.getDay() + 7) % 7;
    firstDate.setDate(firstDate.getDate() + dayDiff);
    if (dayDiff === 0 && firstDate <= now) firstDate.setDate(firstDate.getDate() + 7);
  }

  const existing = await db.trainingGroupSession.findMany({
    where: { trainingGroupId: groupId },
    select: { sessionDatetime: true },
  });
  const existingTimes = new Set(existing.map((s) => s.sessionDatetime.getTime()));

  let sessionNumber = await db.trainingGroupSession.count({ where: { trainingGroupId: groupId } });

  const participants = await db.trainingGroupParticipant.findMany({
    where: { trainingGroupId: groupId, status: "ACTIVE" },
  });

  const created: string[] = [];
  for (let i = 0; i < input.count; i++) {
    const dt = new Date(firstDate);
    dt.setDate(dt.getDate() + i * 7);
    dt.setHours(hh, mm, 0, 0);
    if (existingTimes.has(dt.getTime())) continue;

    sessionNumber += 1;
    const session = await db.trainingGroupSession.create({
      data: { trainingGroupId: groupId, sessionDatetime: dt, sessionNumber, status: "SCHEDULED" },
    });

    if (participants.length > 0) {
      await db.trainingGroupAttendance.createMany({
        data: participants.map((p) => ({
          trainingGroupSessionId: session.id,
          participantId: p.id,
          dogId: p.dogId,
          customerId: p.customerId,
          attendanceStatus: "NO_SHOW",
        })),
        skipDuplicates: true,
      });
    }

    created.push(session.id);
  }

  return { created };
}

export async function listGroupSessionsForCalendar(
  businessId: string,
  db: DbClient,
  opts: { from?: string; to?: string } = {}
) {
  return db.trainingGroupSession.findMany({
    where: {
      trainingGroup: { businessId },
      ...(opts.from || opts.to
        ? {
            sessionDatetime: {
              ...(opts.from ? { gte: new Date(opts.from) } : {}),
              ...(opts.to ? { lte: new Date(opts.to + "T23:59:59") } : {}),
            },
          }
        : {}),
    },
    include: {
      trainingGroup: { select: { id: true, name: true, groupType: true, location: true } },
      attendance: { select: { id: true } },
    },
    orderBy: { sessionDatetime: "asc" },
  });
}

// ─── Training Attendance ───────────────────────────────────────────────────

export async function updateAttendance(
  businessId: string,
  db: DbClient,
  attendanceId: string,
  data: { attendanceStatus?: string; notes?: string | null }
) {
  const existing = await db.trainingGroupAttendance.findUnique({
    where: { id: attendanceId },
    select: { session: { select: { trainingGroup: { select: { businessId: true } } } } },
  });
  if (!existing || existing.session.trainingGroup.businessId !== businessId) {
    throw new ServiceError("לא נמצא", "NOT_FOUND");
  }

  return db.trainingGroupAttendance.update({
    where: { id: attendanceId },
    data: {
      ...(data.attendanceStatus !== undefined && { attendanceStatus: data.attendanceStatus }),
      ...(data.notes !== undefined && { notes: data.notes }),
      markedAt: new Date(),
    },
  });
}

// ─── Training Programs ─────────────────────────────────────────────────────

export async function listTrainingPrograms(
  businessId: string,
  db: DbClient,
  opts: { status?: string; trainingType?: string } = {}
) {
  const statusFilter = opts.status
    ? opts.status.includes(",")
      ? { status: { in: opts.status.split(",") } }
      : { status: opts.status }
    : {};

  return db.trainingProgram.findMany({
    where: {
      businessId,
      ...statusFilter,
      ...(opts.trainingType
        ? { trainingType: opts.trainingType }
        : { trainingType: { not: "SERVICE_DOG" } }),
    },
    include: {
      dog: true,
      customer: true,
      goals: { orderBy: { sortOrder: "asc" } },
      sessions: { orderBy: { sessionDate: "desc" } },
      homework: { orderBy: { assignedDate: "desc" }, take: 5 },
      _count: { select: { goals: true, sessions: true, homework: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTrainingProgram(businessId: string, db: DbClient, id: string) {
  const program = await db.trainingProgram.findFirst({
    where: { id, businessId },
    include: {
      dog: true,
      customer: true,
      goals: { orderBy: { sortOrder: "asc" } },
      sessions: { orderBy: { sessionDate: "desc" } },
      homework: { orderBy: { assignedDate: "desc" } },
    },
  });
  if (!program) throw new ServiceError("תוכנית לא נמצאה", "NOT_FOUND");
  return program;
}

export interface CreateTrainingProgramInput {
  name: string;
  dogId: string;
  customerId?: string | null;
  packageId?: string | null;
  programType?: string;
  trainingType?: string;
  startDate?: string | null;
  endDate?: string | null;
  totalSessions?: number | null;
  price?: number | null;
  notes?: string | null;
  workPlan?: string | null;
  behaviorBaseline?: string | null;
  customerExpectations?: string | null;
  boardingStayId?: string | null;
  isPackage?: boolean;
}

export async function createTrainingProgram(
  businessId: string,
  db: DbClient,
  input: CreateTrainingProgramInput,
  opts: { maxPrograms?: number | null } = {}
) {
  if (opts.maxPrograms !== null && opts.maxPrograms !== undefined) {
    const count = await db.trainingProgram.count({ where: { businessId } });
    if (count >= opts.maxPrograms) {
      throw new ServiceError(
        `הגעת לתקרת ${opts.maxPrograms} תוכניות האילוף במסלול החינמי. שדרג לבייסיק כדי להוסיף ללא הגבלה.`,
        "VALIDATION",
        { code: "LIMIT_REACHED" }
      );
    }
  }

  const dogCheck = await db.pet.findFirst({
    where: { id: input.dogId, OR: [{ customer: { businessId } }, { businessId }] },
    select: { id: true },
  });
  if (!dogCheck) throw new ServiceError("כלב לא נמצא", "NOT_FOUND");

  if (input.customerId) {
    const customerCheck = await db.customer.findFirst({
      where: { id: input.customerId, businessId },
      select: { id: true },
    });
    if (!customerCheck) throw new ServiceError("לקוח לא נמצא", "NOT_FOUND");
  }

  let totalSessions = input.totalSessions ?? null;
  let price = input.price ?? null;

  if (input.packageId) {
    const pkg = await db.trainingPackage.findFirst({ where: { id: input.packageId, businessId } });
    if (!pkg) throw new ServiceError("חבילה לא נמצאה", "NOT_FOUND");
    if (totalSessions == null) totalSessions = pkg.sessions;
    if (price == null) price = pkg.price;
  }

  if (input.boardingStayId) {
    const stay = await db.boardingStay.findFirst({
      where: { id: input.boardingStayId, businessId },
      select: { id: true },
    });
    if (!stay) throw new ServiceError("שהיית פנסיון לא נמצאה", "NOT_FOUND");
  }

  return db.trainingProgram.create({
    data: {
      businessId,
      dogId: input.dogId,
      customerId: input.customerId ?? null,
      packageId: input.packageId ?? null,
      name: input.name,
      programType: input.programType ?? "BASIC_OBEDIENCE",
      trainingType: input.trainingType ?? "HOME",
      startDate: input.startDate ? new Date(input.startDate) : new Date(),
      endDate: input.endDate ? new Date(input.endDate) : null,
      totalSessions,
      price,
      notes: input.notes ?? null,
      workPlan: input.workPlan ?? null,
      behaviorBaseline: input.behaviorBaseline ?? null,
      customerExpectations: input.customerExpectations ?? null,
      boardingStayId: input.boardingStayId ?? null,
      isPackage: !!(input.isPackage || input.packageId),
    },
    include: { dog: true, customer: true, goals: true, sessions: true, homework: true },
  });
}

export async function updateTrainingProgram(
  businessId: string,
  db: DbClient,
  id: string,
  data: {
    name?: string;
    status?: string;
    programType?: string;
    trainingType?: string;
    notes?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    totalSessions?: number | null;
    price?: number | null;
    location?: string | null;
    frequency?: string | null;
    workPlan?: string | null;
    behaviorBaseline?: string | null;
    customerExpectations?: string | null;
    boardingStayId?: string | null;
    isPackage?: boolean;
  }
) {
  const existing = await db.trainingProgram.findFirst({ where: { id, businessId } });
  if (!existing) throw new ServiceError("תוכנית לא נמצאה", "NOT_FOUND");

  if (data.boardingStayId) {
    const stay = await db.boardingStay.findFirst({ where: { id: data.boardingStayId, businessId } });
    if (!stay) throw new ServiceError("שהייה בפנסיון לא נמצאה", "VALIDATION");
  }

  return db.trainingProgram.update({
    where: { id, businessId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.programType !== undefined && { programType: data.programType }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : undefined }),
      ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
      ...(data.totalSessions !== undefined && { totalSessions: data.totalSessions }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.frequency !== undefined && { frequency: data.frequency }),
      ...(data.workPlan !== undefined && { workPlan: data.workPlan || null }),
      ...(data.behaviorBaseline !== undefined && { behaviorBaseline: data.behaviorBaseline || null }),
      ...(data.customerExpectations !== undefined && { customerExpectations: data.customerExpectations || null }),
      ...(data.boardingStayId !== undefined && { boardingStayId: data.boardingStayId || null }),
      ...(data.trainingType !== undefined && { trainingType: data.trainingType }),
      ...(data.isPackage !== undefined && { isPackage: data.isPackage }),
    } as any,
    include: {
      dog: true,
      customer: true,
      goals: { orderBy: { sortOrder: "asc" } },
      sessions: { orderBy: { sessionDate: "desc" } },
      homework: { orderBy: { assignedDate: "desc" } },
    },
  });
}

export async function deleteTrainingProgram(
  businessId: string,
  db: DbClient,
  id: string,
  opts: { orderAction?: OrderAction } = {}
) {
  const existing = await db.trainingProgram.findFirst({
    where: { id, businessId },
    select: { id: true, name: true, dogId: true, orderId: true, dog: { select: { name: true } } },
  });
  if (!existing) throw new ServiceError("תוכנית לא נמצאה", "NOT_FOUND");

  // Sequential deletes — Supabase PgBouncer incompatible with Prisma $transaction
  await db.trainingGoal.deleteMany({ where: { trainingProgramId: id } });
  await db.trainingProgramSession.deleteMany({ where: { trainingProgramId: id } });
  await db.trainingHomework.deleteMany({ where: { trainingProgramId: id } });
  await db.trainingProgram.delete({ where: { id, businessId } });

  // Apply the chosen effect to the linked order (keep / cancel / delete).
  const { orderDowngraded } = await applyOrderAction(businessId, db, existing.orderId, opts.orderAction);

  return { ...existing, orderDowngraded };
}

/**
 * Convert an individual training program into group participation.
 * Adds the program's dog as a participant of the target group (preserving the
 * order link), then deletes the source program. Price is NOT recalculated.
 */
export async function convertProgramToGroup(
  businessId: string,
  db: DbClient,
  programId: string,
  input: { trainingGroupId: string; orderAction?: OrderAction }
) {
  const program = await db.trainingProgram.findFirst({
    where: { id: programId, businessId },
    select: { id: true, dogId: true, customerId: true, orderId: true, name: true },
  });
  if (!program) throw new ServiceError("תוכנית לא נמצאה", "NOT_FOUND");
  if (!program.customerId) {
    throw new ServiceError("לתוכנית אין לקוח משויך — לא ניתן להמיר לקבוצה", "VALIDATION");
  }

  const group = await db.trainingGroup.findFirst({
    where: { id: input.trainingGroupId, businessId },
    select: { id: true },
  });
  if (!group) throw new ServiceError("קבוצת אימון לא נמצאה", "NOT_FOUND");

  const participant = await db.trainingGroupParticipant.upsert({
    where: { trainingGroupId_dogId: { trainingGroupId: group.id, dogId: program.dogId } },
    create: {
      trainingGroupId: group.id,
      dogId: program.dogId,
      customerId: program.customerId,
      status: "ACTIVE",
      orderId: program.orderId,
    },
    update: { status: "ACTIVE", customerId: program.customerId, orderId: program.orderId },
  });

  // Delete the source program (sequential — Supabase PgBouncer)
  await db.trainingGoal.deleteMany({ where: { trainingProgramId: programId } });
  await db.trainingProgramSession.deleteMany({ where: { trainingProgramId: programId } });
  await db.trainingHomework.deleteMany({ where: { trainingProgramId: programId } });
  await db.trainingProgram.delete({ where: { id: programId, businessId } });

  // Optional order side-effect (default keep — price stays as-is)
  const { orderDowngraded } = await applyOrderAction(businessId, db, program.orderId, input.orderAction);

  return { participant, groupId: group.id, orderDowngraded };
}

/**
 * Convert a group participant into an individual training program.
 * Creates a HOME program for the dog (preserving the order link), then removes
 * the participant (attendance cascades). Price is NOT recalculated.
 */
export async function convertParticipantToProgram(
  businessId: string,
  db: DbClient,
  participantId: string,
  input: { programType?: string; orderAction?: OrderAction } = {}
) {
  const participant = await db.trainingGroupParticipant.findFirst({
    where: { id: participantId, trainingGroup: { businessId } },
    select: {
      id: true,
      dogId: true,
      customerId: true,
      orderId: true,
      dog: { select: { name: true } },
      trainingGroup: { select: { id: true, name: true } },
    },
  });
  if (!participant) throw new ServiceError("משתתף לא נמצא", "NOT_FOUND");

  const program = await db.trainingProgram.create({
    data: {
      businessId,
      dogId: participant.dogId,
      customerId: participant.customerId,
      name: `אילוף פרטני - ${participant.dog?.name ?? "כלב"}`,
      programType: input.programType || "BASIC_OBEDIENCE",
      trainingType: "HOME",
      status: "ACTIVE",
      startDate: new Date(),
      orderId: participant.orderId,
      isPackage: false,
    },
    include: { dog: true, customer: true },
  });

  // Remove the participant (attendance cascades via FK)
  await db.trainingGroupParticipant.delete({ where: { id: participantId } });

  const { orderDowngraded } = await applyOrderAction(businessId, db, participant.orderId, input.orderAction);

  return { program, orderDowngraded };
}

// ─── Training Program Sessions ─────────────────────────────────────────────

export interface CreateProgramSessionInput {
  sessionDate: Date;
  durationMinutes?: number;
  sessionNumber?: number | null;
  summary?: string | null;
  rating?: number | null;
  status?: string;
  practiceItems?: string | null;
  nextSessionGoals?: string | null;
  homeworkForCustomer?: string | null;
  trainerName?: string | null;
}

export async function createProgramSession(
  businessId: string,
  db: DbClient,
  programId: string,
  input: CreateProgramSessionInput
) {
  const program = await db.trainingProgram.findFirst({
    where: { id: programId, businessId },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      dog: { select: { name: true } },
    },
  });
  if (!program) throw new ServiceError("Training program not found", "NOT_FOUND");

  const sessionStatus = input.status ?? "COMPLETED";
  const mins = input.durationMinutes ?? 60;

  // Completing a session that already has a SCHEDULED row with the same
  // number must UPDATE that row — otherwise two rows share one sessionNumber,
  // the UI card shows the scheduled one, and the recorded content "vanishes".
  const scheduledMatch =
    sessionStatus === "COMPLETED" && input.sessionNumber
      ? await db.trainingProgramSession.findFirst({
          where: {
            trainingProgramId: programId,
            sessionNumber: input.sessionNumber,
            status: "SCHEDULED",
          },
        })
      : null;

  const duplicate = await db.trainingProgramSession.findFirst({
    where: {
      trainingProgramId: programId,
      sessionDate: input.sessionDate,
      ...(scheduledMatch ? { id: { not: scheduledMatch.id } } : {}),
    },
  });
  if (duplicate) {
    throw new ServiceError("כבר קיים מפגש בתוכנית במועד הזה", "CONFLICT");
  }

  const sessionData = {
    sessionDate: input.sessionDate,
    durationMinutes: mins,
    sessionNumber: input.sessionNumber ?? null,
    summary: input.summary ?? null,
    rating: input.rating ?? null,
    status: sessionStatus,
    practiceItems: input.practiceItems ?? null,
    nextSessionGoals: input.nextSessionGoals ?? null,
    homeworkForCustomer: input.homeworkForCustomer ?? null,
    trainerName: input.trainerName ?? null,
  };

  const session = scheduledMatch
    ? await db.trainingProgramSession.update({
        where: { id: scheduledMatch.id },
        data: sessionData,
      })
    : await db.trainingProgramSession.create({
        data: { trainingProgramId: programId, ...sessionData },
      });

  // Accumulate training hours for service dog programs
  if (sessionStatus === "COMPLETED" && program.trainingType === "SERVICE_DOG") {
    const sdProfile = await db.serviceDogProfile.findFirst({
      where: { petId: program.dogId, businessId },
    });
    if (sdProfile) {
      await db.serviceDogProfile.update({
        where: { id: sdProfile.id },
        data: { trainingTotalHours: { increment: mins / 60 } },
      });
    }
  }

  return { session, program };
}

/**
 * Generate a recurring series of SCHEDULED program sessions (e.g. every Friday
 * at 09:00). Spaces sessions by `intervalDays` (default 7 = weekly) starting
 * from `startDate`. Skips slots that already have a session at the same time.
 */
export async function generateProgramSessions(
  businessId: string,
  db: DbClient,
  programId: string,
  input: { count: number; startDate: Date; durationMinutes?: number; intervalDays?: number }
) {
  const program = await db.trainingProgram.findFirst({
    where: { id: programId, businessId },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      dog: { select: { name: true } },
    },
  });
  if (!program) throw new ServiceError("Training program not found", "NOT_FOUND");

  const interval = input.intervalDays && input.intervalDays > 0 ? input.intervalDays : 7;
  const mins = input.durationMinutes ?? 60;

  const existing = await db.trainingProgramSession.findMany({
    where: { trainingProgramId: programId },
    select: { sessionDate: true },
  });
  const existingTimes = new Set(existing.map((s) => s.sessionDate.getTime()));

  let sessionNumber = await db.trainingProgramSession.count({
    where: { trainingProgramId: programId },
  });

  const created: { id: string; sessionDate: Date }[] = [];
  for (let i = 0; i < input.count; i++) {
    const dt = new Date(input.startDate);
    dt.setDate(dt.getDate() + i * interval);
    if (existingTimes.has(dt.getTime())) continue;

    sessionNumber += 1;
    const session = await db.trainingProgramSession.create({
      data: {
        trainingProgramId: programId,
        sessionDate: dt,
        durationMinutes: mins,
        sessionNumber,
        status: "SCHEDULED",
      },
    });
    created.push({ id: session.id, sessionDate: dt });
  }

  return { created, program };
}

export async function updateProgramSession(
  businessId: string,
  db: DbClient,
  programId: string,
  sessionId: string,
  data: {
    sessionDate?: Date;
    durationMinutes?: number;
    summary?: string | null;
    rating?: number | null;
    practiceItems?: string | null;
    nextSessionGoals?: string | null;
    homeworkForCustomer?: string | null;
    trainerName?: string | null;
  }
) {
  const program = await db.trainingProgram.findFirst({
    where: { id: programId, businessId },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      dog: { select: { name: true } },
    },
  });
  if (!program) throw new ServiceError("Training program not found", "NOT_FOUND");

  const session = await db.trainingProgramSession.findFirst({
    where: { id: sessionId, trainingProgramId: programId },
  });
  if (!session) throw new ServiceError("Session not found", "NOT_FOUND");

  const updateData: Record<string, unknown> = {};
  let dateChanged = false;
  if (data.sessionDate !== undefined) {
    updateData.sessionDate = data.sessionDate;
    dateChanged = data.sessionDate.getTime() !== session.sessionDate.getTime();
  }
  if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;
  if (data.summary !== undefined) updateData.summary = data.summary ?? null;
  if (data.rating !== undefined) updateData.rating = data.rating;
  if (data.practiceItems !== undefined) updateData.practiceItems = data.practiceItems ?? null;
  if (data.nextSessionGoals !== undefined) updateData.nextSessionGoals = data.nextSessionGoals ?? null;
  if (data.homeworkForCustomer !== undefined) updateData.homeworkForCustomer = data.homeworkForCustomer ?? null;
  if (data.trainerName !== undefined) updateData.trainerName = data.trainerName ?? null;

  const updated = await db.trainingProgramSession.update({
    where: { id: session.id },
    data: updateData,
  });

  return { updated, dateChanged, program };
}

export async function deleteProgramSession(
  businessId: string,
  db: DbClient,
  programId: string,
  sessionId: string
) {
  const program = await db.trainingProgram.findFirst({ where: { id: programId, businessId } });
  if (!program) throw new ServiceError("Training program not found", "NOT_FOUND");

  const session = await db.trainingProgramSession.findFirst({
    where: { id: sessionId, trainingProgramId: programId },
  });
  if (!session) throw new ServiceError("Session not found", "NOT_FOUND");

  // Revert accumulated training hours for service dog programs
  if (
    session.status === "COMPLETED" &&
    program.trainingType === "SERVICE_DOG" &&
    session.durationMinutes
  ) {
    const sdProfile = await db.serviceDogProfile.findFirst({
      where: { petId: program.dogId, businessId },
    });
    if (sdProfile) {
      await db.serviceDogProfile.update({
        where: { id: sdProfile.id },
        data: { trainingTotalHours: { decrement: session.durationMinutes / 60 } },
      });
    }
  }

  await db.trainingProgramSession.delete({ where: { id: session.id } });

  return { session, program };
}

export async function listProgramSessionsForCalendar(
  businessId: string,
  db: DbClient,
  opts: { from?: string; to?: string } = {}
) {
  return db.trainingProgramSession.findMany({
    where: {
      program: { businessId },
      ...(opts.from || opts.to
        ? {
            sessionDate: {
              ...(opts.from ? { gte: new Date(opts.from) } : {}),
              ...(opts.to ? { lte: new Date(opts.to + "T23:59:59") } : {}),
            },
          }
        : {}),
    },
    select: {
      id: true,
      sessionDate: true,
      sessionNumber: true,
      durationMinutes: true,
      status: true,
      program: {
        select: {
          id: true,
          name: true,
          trainingType: true,
          location: true,
          dog: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { sessionDate: "asc" },
  });
}

// ─── Training Goals ────────────────────────────────────────────────────────

export async function createProgramGoal(
  businessId: string,
  db: DbClient,
  programId: string,
  input: { title: string; description?: string | null; targetDate?: Date | null }
) {
  const program = await db.trainingProgram.findFirst({ where: { id: programId, businessId } });
  if (!program) throw new ServiceError("Training program not found", "NOT_FOUND");

  const existing = await db.trainingGoal.findMany({
    where: { trainingProgramId: programId },
    select: { sortOrder: true },
    orderBy: { sortOrder: "desc" },
    take: 1,
  });
  const nextOrder = existing.length > 0 ? existing[0].sortOrder + 1 : 0;

  return db.trainingGoal.create({
    data: {
      trainingProgramId: programId,
      title: input.title,
      description: input.description ?? null,
      targetDate: input.targetDate ?? null,
      sortOrder: nextOrder,
    },
  });
}

export async function updateProgramGoal(
  businessId: string,
  db: DbClient,
  goalId: string,
  data: {
    title?: string;
    description?: string | null;
    status?: string;
    progressPercent?: number;
    targetDate?: Date | null;
  }
) {
  const existing = await db.trainingGoal.findFirst({
    where: { id: goalId, program: { businessId } },
  });
  if (!existing) throw new ServiceError("Goal not found", "NOT_FOUND");

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.progressPercent !== undefined) updateData.progressPercent = data.progressPercent;
  if (data.targetDate !== undefined) updateData.targetDate = data.targetDate;

  return db.trainingGoal.update({
    where: { id: goalId, trainingProgramId: existing.trainingProgramId },
    data: updateData,
  });
}

export async function deleteProgramGoal(businessId: string, db: DbClient, goalId: string) {
  const goal = await db.trainingGoal.findFirst({ where: { id: goalId, program: { businessId } } });
  if (!goal) throw new ServiceError("Goal not found", "NOT_FOUND");
  await db.trainingGoal.delete({ where: { id: goalId, trainingProgramId: goal.trainingProgramId } });
}

// ─── Training Homework ─────────────────────────────────────────────────────

export async function createProgramHomework(
  businessId: string,
  db: DbClient,
  programId: string,
  input: { title: string; description?: string | null; dueDate?: Date | null }
) {
  const program = await db.trainingProgram.findFirst({ where: { id: programId, businessId } });
  if (!program) throw new ServiceError("Training program not found", "NOT_FOUND");

  return db.trainingHomework.create({
    data: {
      trainingProgramId: programId,
      title: input.title,
      description: input.description ?? null,
      dueDate: input.dueDate ?? null,
    },
  });
}

export async function updateProgramHomework(
  businessId: string,
  db: DbClient,
  homeworkId: string,
  data: { isCompleted?: boolean; customerNotes?: string | null }
) {
  const existing = await db.trainingHomework.findFirst({
    where: { id: homeworkId, program: { businessId } },
  });
  if (!existing) throw new ServiceError("Homework not found", "NOT_FOUND");

  const updateData: Record<string, unknown> = {};
  if (data.isCompleted !== undefined) {
    updateData.isCompleted = data.isCompleted;
    updateData.completedAt = data.isCompleted ? new Date() : null;
  }
  if (data.customerNotes !== undefined) updateData.customerNotes = data.customerNotes;

  return db.trainingHomework.update({
    where: { id: homeworkId, trainingProgramId: existing.trainingProgramId },
    data: updateData,
  });
}

export async function deleteProgramHomework(businessId: string, db: DbClient, homeworkId: string) {
  const existing = await db.trainingHomework.findFirst({
    where: { id: homeworkId, program: { businessId } },
  });
  if (!existing) throw new ServiceError("Homework not found", "NOT_FOUND");
  await db.trainingHomework.delete({
    where: { id: homeworkId, trainingProgramId: existing.trainingProgramId },
  });
}

// ─── Training Packages ─────────────────────────────────────────────────────

export async function listTrainingPackages(
  businessId: string,
  db: DbClient,
  opts: { includeInactive?: boolean } = {}
) {
  return db.trainingPackage.findMany({
    where: { businessId, ...(opts.includeInactive ? {} : { isActive: true }) },
    include: { _count: { select: { programs: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export interface CreateTrainingPackageInput {
  name: string;
  type?: string;
  sessions: number;
  durationDays?: number | null;
  price: number;
  description?: string | null;
}

export async function createTrainingPackage(
  businessId: string,
  db: DbClient,
  input: CreateTrainingPackageInput
) {
  return db.trainingPackage.create({
    data: {
      businessId,
      name: input.name,
      type: input.type ?? "HOME",
      sessions: input.sessions,
      ...(input.durationDays !== undefined && { durationDays: input.durationDays }),
      price: input.price,
      description: input.description ?? null,
    } as any,
    include: { _count: { select: { programs: true } } },
  });
}

export async function updateTrainingPackage(
  businessId: string,
  db: DbClient,
  id: string,
  data: {
    name?: string;
    type?: string;
    sessions?: number;
    durationDays?: number | null;
    price?: number;
    description?: string | null;
    isActive?: boolean;
  }
) {
  const existing = await db.trainingPackage.findFirst({ where: { id, businessId } });
  if (!existing) throw new ServiceError("חבילה לא נמצאה", "NOT_FOUND");

  return db.trainingPackage.update({
    where: { id, businessId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.sessions !== undefined && { sessions: data.sessions }),
      ...(data.durationDays !== undefined && { durationDays: data.durationDays }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.description !== undefined && { description: data.description ?? null }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    } as any,
    include: { _count: { select: { programs: true } } },
  });
}

export async function deleteTrainingPackage(businessId: string, db: DbClient, id: string) {
  const existing = await db.trainingPackage.findFirst({
    where: { id, businessId },
    include: { _count: { select: { programs: true } } },
  });
  if (!existing) throw new ServiceError("חבילה לא נמצאה", "NOT_FOUND");

  if (existing._count.programs > 0) {
    throw new ServiceError(
      `לא ניתן למחוק — יש ${existing._count.programs} תוכניות המשויכות לחבילה זו`,
      "CONFLICT"
    );
  }

  await db.trainingPackage.delete({ where: { id, businessId } });
}
