/**
 * Boarding service — stays, rooms, yards, care logs.
 *
 * businessId first, db second, then args.
 * No Request/Response. Throws ServiceError on failure.
 *
 * Side effects (WhatsApp, reminders, GCal, activity logging, rate limiting)
 * stay in routes. Room status auto-update on check-in/out is domain logic.
 */

import type { PrismaClient } from "@prisma/client";
import { ServiceError } from "./types";

export type DbClient = PrismaClient;
export { ServiceError };

const CARE_LOG_TYPES = ["FEEDING", "MEDICATION", "WALK", "NOTE"];
const VALID_ROOM_STATUSES = ["available", "needs_cleaning"];
const VALID_YARD_STATUSES = ["available", "needs_cleaning"];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ListBoardingOptions {
  from?: string;
  to?: string;
}

export interface CreateBoardingStayInput {
  checkIn: string;
  checkOut?: string | null;
  petId: string;
  customerId?: string | null;
  roomId?: string | null;
  yardId?: string | null;
  status?: string;
  notes?: string | null;
  assignedToUserId?: string | null;
}

export interface UpdateBoardingStayInput {
  checkIn?: string;
  actualCheckinTime?: string;
  checkOut?: string | null;
  actualCheckoutTime?: string;
  status?: "reserved" | "checked_in" | "checked_out" | "canceled";
  roomId?: string | null;
  yardId?: string | null;
  notes?: string | null;
  checkinNotes?: string;
  checkoutNotes?: string;
  feedingPlan?: string | null;
  medicalNeeds?: string | null;
  dailyTrainingMinutes?: number | null;
}

export interface CreateCareLogInput {
  boardingStayId: string;
  petId: string;
  type: string;
  title: string;
  notes?: string | null;
}

export interface CreateStayCareLogInput {
  type: string;
  title: string;
  notes?: string | null;
}

export interface CreateRoomInput {
  name: string;
  capacity?: number;
  type?: string;
  pricePerNight?: number | null;
}

export type UpdateRoomData = {
  name?: string;
  capacity?: number;
  type?: string;
  status?: string;
  pricePerNight?: number | null;
};

export interface CreateYardInput {
  name: string;
  capacity?: number;
  type?: string;
  pricePerSession?: number | null;
}

export type UpdateYardData = {
  name?: string;
  capacity?: number;
  type?: string;
  status?: string;
  pricePerSession?: number | null;
};

// Shared pet select for stay list/create queries (boolean values — no as const needed)
const PET_SELECT_FULL = {
  id: true, name: true, species: true, breed: true,
  foodNotes: true, foodBrand: true, foodGramsPerDay: true, foodFrequency: true, medicalNotes: true,
  health: { select: { allergies: true, medicalConditions: true, activityLimitations: true } },
  behavior: { select: { dogAggression: true, humanAggression: true, biteHistory: true, biteDetails: true, separationAnxiety: true, leashReactivity: true, resourceGuarding: true } },
  medications: { select: { medName: true, dosage: true, frequency: true, times: true } },
  serviceDogProfile: { select: { id: true } },
};

// ─────────────────────────────────────────────────────────────────────────────
// Boarding stays
// ─────────────────────────────────────────────────────────────────────────────

export async function listBoardingStays(businessId: string, db: DbClient, opts: ListBoardingOptions = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { businessId };

  if (opts.from && opts.to) {
    where.checkIn = { lte: new Date(opts.to + "T23:59:59") };
    where.OR = [{ checkOut: { gte: new Date(opts.from) } }, { checkOut: null }];
    where.status = { in: ["reserved", "checked_in"] };
  }

  return db.boardingStay.findMany({
    where,
    include: {
      room: true,
      yard: { select: { id: true, name: true } },
      pet: { select: PET_SELECT_FULL },
      customer: { select: { id: true, name: true, phone: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { checkIn: "desc" },
    take: 200,
  });
}

export async function getBoardingStay(businessId: string, db: DbClient, id: string) {
  const stay = await db.boardingStay.findFirst({
    where: { id, businessId },
    include: {
      room: true,
      pet: true,
      customer: { select: { id: true, name: true, phone: true, email: true } },
    },
  });
  if (!stay) throw new ServiceError("שהייה לא נמצאה", "NOT_FOUND");
  return stay;
}

export async function createBoardingStay(
  businessId: string,
  db: DbClient,
  input: CreateBoardingStayInput,
  opts: { boardingEnabled?: boolean } = {}
) {
  if (opts.boardingEnabled === false) {
    throw new ServiceError("פנסיון זמין רק בתוכנית בסיסית ומעלה", "UNAUTHORIZED");
  }

  const { checkIn, checkOut, petId, customerId, roomId, yardId, status, notes, assignedToUserId } = input;

  if (!checkIn || !petId) throw new ServiceError("Missing required fields: checkIn, petId", "VALIDATION");
  if (notes && (typeof notes !== "string" || notes.length > 2000)) {
    throw new ServiceError("הערות ארוכות מדי (מקסימום 2000 תווים)", "VALIDATION");
  }

  const resolvedCustomerId = customerId || null;

  if (assignedToUserId) {
    const membership = await db.businessUser.findUnique({
      where: { businessId_userId: { businessId, userId: assignedToUserId } },
      select: { id: true, isActive: true },
    });
    if (!membership || !membership.isActive) throw new ServiceError("איש הצוות לא נמצא בעסק זה", "NOT_FOUND");
  }

  const petCheck = await db.pet.findFirst({
    where: { id: petId, OR: [{ customer: { businessId } }, { businessId }] },
    select: { id: true },
  });
  if (!petCheck) throw new ServiceError("חיית מחמד לא נמצאה", "NOT_FOUND");

  if (resolvedCustomerId) {
    const customerCheck = await db.customer.findFirst({ where: { id: resolvedCustomerId, businessId }, select: { id: true } });
    if (!customerCheck) throw new ServiceError("לקוח לא נמצא", "NOT_FOUND");
  }

  if (roomId) {
    const roomCheck = await db.room.findFirst({ where: { id: roomId, businessId }, select: { id: true } });
    if (!roomCheck) throw new ServiceError("חדר לא נמצא", "NOT_FOUND");
  }

  if (yardId) {
    const yardCheck = await db.yard.findFirst({ where: { id: yardId, businessId }, select: { id: true } });
    if (!yardCheck) throw new ServiceError("חצר לא נמצאה", "NOT_FOUND");
  }

  // Room capacity check before create
  if (roomId) {
    const room = await db.room.findFirst({ where: { id: roomId, businessId } });
    if (!room) throw new ServiceError("חדר לא נמצא", "NOT_FOUND");

    const activeCount = await db.boardingStay.count({
      where: {
        roomId,
        status: { in: ["reserved", "checked_in"] },
        checkIn: { lt: checkOut ? new Date(checkOut) : new Date("2099-12-31") },
        OR: [{ checkOut: { gt: new Date(checkIn) } }, { checkOut: null }],
      },
    });
    if (activeCount >= room.capacity) throw new ServiceError("החדר מלא בתאריכים אלו", "CONFLICT");
  }

  const stay = await db.boardingStay.create({
    data: {
      businessId,
      checkIn: new Date(checkIn),
      checkOut: checkOut ? new Date(checkOut) : undefined,
      petId,
      customerId: resolvedCustomerId,
      roomId: roomId || null,
      yardId: yardId || null,
      status: (status && ["reserved", "checked_in", "checked_out", "canceled"].includes(status) ? status : "reserved") as string,
      notes: notes || null,
      assignedToUserId: assignedToUserId || null,
    },
    include: {
      room: true,
      yard: { select: { id: true, name: true } },
      pet: { select: PET_SELECT_FULL },
      customer: { select: { id: true, name: true, phone: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  // Post-create race-condition guard: re-check capacity; delete our stay if a concurrent request slipped through
  if (roomId && stay.room) {
    const postCount = await db.boardingStay.count({
      where: {
        roomId,
        status: { in: ["reserved", "checked_in"] },
        checkIn: { lt: checkOut ? new Date(checkOut) : new Date("2099-12-31") },
        OR: [{ checkOut: { gt: new Date(checkIn) } }, { checkOut: null }],
      },
    });
    if (postCount > stay.room.capacity) {
      await db.boardingStay.delete({ where: { id: stay.id } });
      throw new ServiceError("החדר מלא בתאריכים אלו", "CONFLICT");
    }
  }

  return stay;
}

export async function updateBoardingStay(
  businessId: string,
  db: DbClient,
  id: string,
  input: UpdateBoardingStayInput
) {
  const existing = await db.boardingStay.findFirst({
    where: { id, businessId },
    select: { id: true, notes: true, status: true, roomId: true, businessId: true },
  });
  if (!existing) throw new ServiceError("שהייה לא נמצאה", "NOT_FOUND");

  if (input.roomId) {
    const room = await db.room.findFirst({ where: { id: input.roomId, businessId } });
    if (!room) throw new ServiceError("חדר לא נמצא", "NOT_FOUND");
  }
  if (input.yardId) {
    const yard = await db.yard.findFirst({ where: { id: input.yardId, businessId } });
    if (!yard) throw new ServiceError("חצר לא נמצאה", "NOT_FOUND");
  }

  // Notes append logic
  let notesUpdate: string | null | undefined;
  if (input.notes !== undefined) notesUpdate = input.notes;
  if (input.checkinNotes) {
    const prefix = `[צ׳ק-אין ${new Date().toLocaleString("he-IL")}] `;
    const prev = notesUpdate ?? existing.notes ?? "";
    notesUpdate = prev ? `${prev}\n${prefix}${input.checkinNotes}` : `${prefix}${input.checkinNotes}`;
  }
  if (input.checkoutNotes) {
    const prefix = `[צ׳ק-אאוט ${new Date().toLocaleString("he-IL")}] `;
    const prev = notesUpdate ?? existing.notes ?? "";
    notesUpdate = prev ? `${prev}\n${prefix}${input.checkoutNotes}` : `${prefix}${input.checkoutNotes}`;
  }

  const stay = await db.boardingStay.update({
    where: { id, businessId },
    data: {
      ...(input.checkIn !== undefined && { checkIn: new Date(input.checkIn) }),
      ...(input.actualCheckinTime && { checkIn: new Date(input.actualCheckinTime) }),
      ...(input.checkOut !== undefined && { checkOut: input.checkOut ? new Date(input.checkOut) : null }),
      ...(input.actualCheckoutTime && { checkOut: new Date(input.actualCheckoutTime) }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.roomId !== undefined && { roomId: input.roomId }),
      ...(input.yardId !== undefined && { yardId: input.yardId }),
      ...(notesUpdate !== undefined && { notes: notesUpdate }),
      ...(input.feedingPlan !== undefined && { feedingPlan: input.feedingPlan }),
      ...(input.medicalNeeds !== undefined && { medicalNeeds: input.medicalNeeds }),
      ...(input.dailyTrainingMinutes !== undefined && { dailyTrainingMinutes: input.dailyTrainingMinutes }),
    },
    select: {
      id: true, checkIn: true, checkOut: true, status: true, notes: true,
      feedingPlan: true, medicalNeeds: true, dailyTrainingMinutes: true,
      businessId: true, customerId: true, petId: true, roomId: true,
      room: { select: { id: true, name: true } },
      pet: {
        select: {
          id: true, name: true, species: true, breed: true,
          foodNotes: true, medicalNotes: true,
          health: { select: { allergies: true, medicalConditions: true, activityLimitations: true } },
          behavior: { select: { dogAggression: true, humanAggression: true, biteHistory: true, biteDetails: true, separationAnxiety: true, leashReactivity: true, resourceGuarding: true } },
          medications: { select: { medName: true, dosage: true, frequency: true, times: true } },
        },
      },
      customer: { select: { id: true, name: true, phone: true } },
    },
  });

  // Room status auto-update (domain logic — not a side effect)
  if (existing.roomId) {
    if (input.status === "checked_out") {
      const otherActive = await db.boardingStay.count({
        where: { roomId: existing.roomId, businessId, id: { not: id }, status: { in: ["reserved", "checked_in"] } },
      });
      if (otherActive === 0) {
        await db.room.update({ where: { id: existing.roomId, businessId }, data: { status: "needs_cleaning" } });
      }
    } else if (input.status === "checked_in") {
      const room = await db.room.findFirst({ where: { id: existing.roomId, businessId } });
      if (room && room.status === "needs_cleaning") {
        await db.room.update({ where: { id: existing.roomId, businessId }, data: { status: "available" } });
      }
    }
  }

  return stay;
}

export async function deleteBoardingStay(businessId: string, db: DbClient, id: string) {
  const existing = await db.boardingStay.findFirst({ where: { id, businessId } });
  if (!existing) throw new ServiceError("שהייה לא נמצאה", "NOT_FOUND");
  await db.boardingStay.delete({ where: { id, businessId } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Care logs
// ─────────────────────────────────────────────────────────────────────────────

export async function listDailyCareBoard(businessId: string, db: DbClient, dateStr: string) {
  const dayStart = new Date(dateStr + "T00:00:00.000Z");
  const dayEnd   = new Date(dateStr + "T23:59:59.999Z");

  return db.boardingStay.findMany({
    where: {
      businessId,
      status: { in: ["checked_in", "reserved"] },
      checkIn: { lte: dayEnd },
      OR: [{ checkOut: { gte: dayStart } }, { checkOut: null }],
    },
    include: {
      room: { select: { id: true, name: true, pricePerNight: true } },
      pet: {
        select: {
          id: true, name: true, breed: true, species: true,
          foodNotes: true, foodBrand: true, foodGramsPerDay: true, foodFrequency: true, medicalNotes: true,
          medications: {
            where: { OR: [{ endDate: null }, { endDate: { gte: new Date(dateStr) } }] },
            select: { id: true, medName: true, dosage: true, frequency: true, times: true, instructions: true },
          },
        },
      },
      customer: { select: { id: true, name: true, phone: true } },
      careLogs: {
        where: { doneAt: { gte: dayStart, lte: dayEnd } },
        orderBy: { doneAt: "asc" },
      },
    },
    orderBy: { checkIn: "asc" },
  });
}

export async function createCareLog(
  businessId: string,
  db: DbClient,
  input: CreateCareLogInput,
  userId: string | null
) {
  const { boardingStayId, petId, type, title, notes } = input;
  if (!boardingStayId || !petId || !type || !title) throw new ServiceError("חסרים שדות חובה", "VALIDATION");
  if (!CARE_LOG_TYPES.includes(type)) throw new ServiceError("סוג לא תקין", "VALIDATION");
  if (typeof title !== "string" || title.trim().length > 200) throw new ServiceError("כותרת ארוכה מדי (מקסימום 200 תווים)", "VALIDATION");
  if (notes !== undefined && notes !== null && (typeof notes !== "string" || notes.length > 2000)) {
    throw new ServiceError("הערות ארוכות מדי (מקסימום 2000 תווים)", "VALIDATION");
  }

  const stay = await db.boardingStay.findFirst({ where: { id: boardingStayId, businessId } });
  if (!stay) throw new ServiceError("שהייה לא נמצאה", "NOT_FOUND");

  return db.boardingCareLog.create({
    data: { boardingStayId, petId, businessId, type, title: title.trim(), notes: notes || null, doneByUserId: userId },
  });
}

export async function deleteCareLogById(businessId: string, db: DbClient, logId: string) {
  const log = await db.boardingCareLog.findFirst({ where: { id: logId, businessId } });
  if (!log) throw new ServiceError("רשומה לא נמצאה", "NOT_FOUND");
  await db.boardingCareLog.delete({ where: { id: logId, businessId } });
}

export async function listStayCareLogs(businessId: string, db: DbClient, stayId: string) {
  const stay = await db.boardingStay.findFirst({ where: { id: stayId, businessId } });
  if (!stay) throw new ServiceError("שהייה לא נמצאה", "NOT_FOUND");
  const logs = await db.boardingCareLog.findMany({
    where: { boardingStayId: stayId, businessId },
    orderBy: { doneAt: "desc" },
  });
  return { logs };
}

export async function createStayCareLog(
  businessId: string,
  db: DbClient,
  stayId: string,
  input: CreateStayCareLogInput,
  userId: string | null
) {
  const stay = await db.boardingStay.findFirst({ where: { id: stayId, businessId } });
  if (!stay) throw new ServiceError("שהייה לא נמצאה", "NOT_FOUND");

  const { type, title, notes } = input;
  if (!type || !title?.trim()) throw new ServiceError("type ו-title חובה", "VALIDATION");
  if (typeof title !== "string" || title.trim().length > 200) throw new ServiceError("כותרת ארוכה מדי (מקסימום 200 תווים)", "VALIDATION");
  if (notes !== undefined && notes !== null && (typeof notes !== "string" || notes.length > 2000)) {
    throw new ServiceError("הערות ארוכות מדי (מקסימום 2000 תווים)", "VALIDATION");
  }
  if (!CARE_LOG_TYPES.includes(type)) throw new ServiceError("סוג לא תקין", "VALIDATION");

  return db.boardingCareLog.create({
    data: {
      boardingStayId: stayId,
      petId: stay.petId,
      businessId,
      type,
      title: title.trim(),
      notes: notes?.trim() ?? null,
      doneByUserId: userId,
    },
  });
}

export async function deleteStayCareLog(businessId: string, db: DbClient, stayId: string, logId: string) {
  await db.boardingCareLog.deleteMany({ where: { id: logId, boardingStayId: stayId, businessId } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Rooms
// ─────────────────────────────────────────────────────────────────────────────

export async function listRooms(businessId: string, db: DbClient) {
  return db.room.findMany({
    where: { businessId },
    include: {
      _count: { select: { boardingStays: { where: { status: { in: ["reserved", "checked_in"] } } } } },
      boardingStays: {
        where: { status: { in: ["reserved", "checked_in"] } },
        include: {
          pet: { select: { id: true, name: true, breed: true, species: true } },
          customer: { select: { id: true, name: true } },
        },
        orderBy: { checkIn: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function createRoom(businessId: string, db: DbClient, input: CreateRoomInput) {
  const { name, capacity, type, pricePerNight } = input;
  if (!name?.trim()) throw new ServiceError("שם החדר הוא שדה חובה", "VALIDATION");
  if (pricePerNight !== null && pricePerNight !== undefined && (isNaN(pricePerNight) || pricePerNight < 0)) {
    throw new ServiceError("מחיר ללילה לא תקין", "VALIDATION");
  }
  return db.room.create({
    data: { businessId, name: name.trim(), capacity: capacity || 1, type: type || "standard", pricePerNight: pricePerNight ?? null },
    include: {
      _count: { select: { boardingStays: { where: { status: { in: ["reserved", "checked_in"] } } } } },
      boardingStays: {
        where: { status: { in: ["reserved", "checked_in"] } },
        include: {
          pet: { select: { id: true, name: true, breed: true, species: true } },
          customer: { select: { id: true, name: true } },
        },
        orderBy: { checkIn: "asc" },
      },
    },
  });
}

export async function updateRoom(businessId: string, db: DbClient, id: string, data: UpdateRoomData) {
  if (data.status !== undefined && !VALID_ROOM_STATUSES.includes(data.status)) {
    throw new ServiceError("סטטוס חדר לא תקין", "VALIDATION");
  }
  if (data.pricePerNight !== null && data.pricePerNight !== undefined &&
      (isNaN(data.pricePerNight) || data.pricePerNight < 0)) {
    throw new ServiceError("מחיר ללילה לא תקין", "VALIDATION");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.capacity !== undefined) update.capacity = data.capacity;
  if (data.type !== undefined) update.type = data.type;
  if (data.status !== undefined) update.status = data.status;
  if ("pricePerNight" in data) update.pricePerNight = data.pricePerNight;
  return db.room.update({
    where: { id, businessId },
    data: update,
    include: {
      _count: { select: { boardingStays: { where: { status: { in: ["reserved", "checked_in"] } } } } },
      boardingStays: {
        where: { status: { in: ["reserved", "checked_in"] } },
        include: {
          pet: { select: { id: true, name: true, breed: true, species: true } },
          customer: { select: { id: true, name: true } },
        },
        orderBy: { checkIn: "asc" },
      },
    },
  });
}

export async function deleteRoom(businessId: string, db: DbClient, id: string) {
  const activeStays = await db.boardingStay.count({ where: { roomId: id, businessId, status: { in: ["reserved", "checked_in"] } } });
  if (activeStays > 0) throw new ServiceError("לא ניתן למחוק חדר עם שהיות פעילות", "CONFLICT");
  await db.room.delete({ where: { id, businessId } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Yards
// ─────────────────────────────────────────────────────────────────────────────

export async function listYards(businessId: string, db: DbClient) {
  return db.yard.findMany({
    where: { businessId },
    include: {
      _count: { select: { boardingStays: { where: { status: { in: ["reserved", "checked_in"] } } } } },
      boardingStays: {
        where: { status: { in: ["reserved", "checked_in"] } },
        include: {
          pet: { select: { id: true, name: true, breed: true, species: true } },
          customer: { select: { id: true, name: true } },
        },
        orderBy: { checkIn: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function createYard(businessId: string, db: DbClient, input: CreateYardInput) {
  const { name, capacity, type, pricePerSession } = input;
  if (!name?.trim()) throw new ServiceError("שם החצר הוא שדה חובה", "VALIDATION");
  if (pricePerSession !== null && pricePerSession !== undefined && (isNaN(pricePerSession) || pricePerSession < 0)) {
    throw new ServiceError("מחיר לשהייה לא תקין", "VALIDATION");
  }
  return db.yard.create({
    data: { businessId, name: name.trim(), capacity: capacity || 1, type: type || "standard", pricePerSession: pricePerSession ?? null },
    include: {
      _count: { select: { boardingStays: { where: { status: { in: ["reserved", "checked_in"] } } } } },
      boardingStays: {
        where: { status: { in: ["reserved", "checked_in"] } },
        include: {
          pet: { select: { id: true, name: true, breed: true, species: true } },
          customer: { select: { id: true, name: true } },
        },
        orderBy: { checkIn: "asc" },
      },
    },
  });
}

export async function updateYard(businessId: string, db: DbClient, id: string, data: UpdateYardData) {
  if (data.status !== undefined && !VALID_YARD_STATUSES.includes(data.status)) {
    throw new ServiceError("סטטוס חצר לא תקין", "VALIDATION");
  }
  if (data.pricePerSession !== null && data.pricePerSession !== undefined &&
      (isNaN(data.pricePerSession) || data.pricePerSession < 0)) {
    throw new ServiceError("מחיר לשהייה לא תקין", "VALIDATION");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.capacity !== undefined) update.capacity = data.capacity;
  if (data.type !== undefined) update.type = data.type;
  if (data.status !== undefined) update.status = data.status;
  if ("pricePerSession" in data) update.pricePerSession = data.pricePerSession;
  return db.yard.update({
    where: { id, businessId },
    data: update,
    include: {
      _count: { select: { boardingStays: { where: { status: { in: ["reserved", "checked_in"] } } } } },
      boardingStays: {
        where: { status: { in: ["reserved", "checked_in"] } },
        include: {
          pet: { select: { id: true, name: true, breed: true, species: true } },
          customer: { select: { id: true, name: true } },
        },
        orderBy: { checkIn: "asc" },
      },
    },
  });
}

export async function deleteYard(businessId: string, db: DbClient, id: string) {
  const activeStays = await db.boardingStay.count({ where: { yardId: id, businessId, status: { in: ["reserved", "checked_in"] } } });
  if (activeStays > 0) throw new ServiceError("לא ניתן למחוק חצר עם שהיות פעילות", "CONFLICT");
  await db.yard.delete({ where: { id, businessId } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Availability
// ─────────────────────────────────────────────────────────────────────────────

export async function checkRoomAvailability(
  businessId: string,
  db: DbClient,
  roomId: string,
  from: string,
  to: string
) {
  const room = await db.room.findFirst({ where: { id: roomId, businessId } });
  if (!room) throw new ServiceError("חדר לא נמצא", "NOT_FOUND");

  const conflicts = await db.boardingStay.findMany({
    where: {
      roomId,
      status: { in: ["reserved", "checked_in"] },
      checkIn: { lt: new Date(to + "T23:59:59") },
      OR: [{ checkOut: { gt: new Date(from) } }, { checkOut: null }],
    },
    include: {
      pet: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
    },
  });

  return {
    available: conflicts.length < room.capacity,
    capacity: room.capacity,
    occupiedSlots: conflicts.length,
    conflicts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Export (returns raw data; XLSX generation stays in the route)
// ─────────────────────────────────────────────────────────────────────────────

export async function getBoardingExportData(businessId: string, db: DbClient) {
  return db.boardingStay.findMany({
    where: { businessId, status: { in: ["reserved", "checked_in"] } },
    include: {
      pet: {
        select: {
          name: true, breed: true, species: true, foodNotes: true, medicalNotes: true,
          medications: { select: { medName: true, dosage: true, frequency: true, times: true } },
          serviceDogProfile: { select: { id: true } },
        },
      },
      customer: { select: { name: true, phone: true } },
      room: { select: { name: true } },
    },
    orderBy: { checkIn: "asc" },
  });
}
