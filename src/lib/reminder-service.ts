import { prisma } from "@/lib/prisma";
import { interpolateTemplate } from "@/lib/whatsapp";
import { REMINDER_TEMPLATES } from "@/lib/training-groups";
import { hasFeatureWithOverrides } from "@/lib/feature-flags";

// ─── Appointment reminder scheduling ─────────────────────────────────────────

interface AppointmentForReminder {
  id: string;
  businessId: string;
  customerId: string;
  date: Date;
  startTime: string; // "HH:mm"
  service: { name: string };
  customer: { name: string };
  pet?: { name: string } | null;
}

/**
 * Schedule a WhatsApp reminder 48h before an appointment.
 * Returns the created ScheduledMessage or null if the send time is in the past.
 * Idempotent — skips creation if a PENDING reminder already exists for this appointment.
 */
export async function scheduleAppointmentReminder(appt: AppointmentForReminder) {
  // Check business WhatsApp reminder settings
  const bizSettings = await prisma.business.findUnique({
    where: { id: appt.businessId },
    select: { whatsappRemindersEnabled: true, whatsappReminderLeadHours: true, phone: true, tier: true, featureOverrides: true },
  });
  if (!bizSettings?.whatsappRemindersEnabled) return null;
  // Enforce tier gate: WhatsApp reminders require PRO+ (groomer/service_dog)
  const overrides = (bizSettings.featureOverrides as Record<string, boolean> | null) ?? null;
  if (!hasFeatureWithOverrides(bizSettings.tier, "whatsapp_reminders", overrides)) return null;

  const [h, m] = appt.startTime.split(":").map(Number);
  const apptDatetime = new Date(appt.date);
  apptDatetime.setHours(h, m, 0, 0);

  // Look up active appointment_reminder rule for this business
  const rule = await prisma.automationRule.findFirst({
    where: { businessId: appt.businessId, trigger: "appointment_reminder", isActive: true },
    include: {
      template: { select: { body: true } },
      business: { select: { phone: true } },
    },
  });

  // Compute sendAt using rule offset (hours) or business setting
  const offsetHours = rule?.triggerOffset ?? bizSettings.whatsappReminderLeadHours ?? 48;
  const sendAt = new Date(apptDatetime.getTime() - offsetHours * 60 * 60 * 1000);
  if (sendAt <= new Date()) return null;

  // Deduplicate: skip if a pending reminder already exists
  const existing = await prisma.scheduledMessage.findFirst({
    where: {
      relatedEntityType: "APPOINTMENT",
      relatedEntityId: appt.id,
      status: "PENDING",
    },
  });
  if (existing) return null;

  const formattedDate = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(apptDatetime);

  let body: string;
  if (rule?.template?.body) {
    body = interpolateTemplate(rule.template.body, {
      customerName: appt.customer.name,
      petName: appt.pet?.name ?? "",
      date: formattedDate,
      time: appt.startTime,
      serviceName: appt.service.name,
      businessPhone: rule.business?.phone ?? "",
    });
  } else {
    const petPart = appt.pet ? ` עם ${appt.pet.name}` : "";
    const bizPhone = rule?.business?.phone ?? bizSettings.phone ?? "";
    const footer = `\n\n_הודעה אוטומטית – אין להשיב להודעה זו.\nלפניות ויצירת קשר ישיר עם בית העסק: ${bizPhone}_`;
    body = `שלום ${appt.customer.name}! 🐾\n\nתזכורת לתור שלך ב-${formattedDate} בשעה ${appt.startTime}.\nשירות: ${appt.service.name}${petPart}.\n\nנתראה! 😊${footer}`;
  }

  return prisma.scheduledMessage.create({
    data: {
      businessId: appt.businessId,
      customerId: appt.customerId,
      channel: "whatsapp",
      templateKey: rule ? `automation-rule-${rule.id}` : "appointment_reminder_48h",
      payloadJson: JSON.stringify({ body }),
      sendAt,
      status: "PENDING",
      relatedEntityType: "APPOINTMENT",
      relatedEntityId: appt.id,
    },
  });
}

/**
 * Cancel all pending reminders for an appointment.
 */
export async function cancelAppointmentReminders(appointmentId: string) {
  return prisma.scheduledMessage.updateMany({
    where: {
      relatedEntityType: "APPOINTMENT",
      relatedEntityId: appointmentId,
      status: "PENDING",
    },
    data: { status: "CANCELED" },
  });
}

/**
 * Cancel existing reminders and reschedule (call when date/time changes).
 */
export async function rescheduleAppointmentReminder(appt: AppointmentForReminder) {
  await cancelAppointmentReminders(appt.id);
  return scheduleAppointmentReminder(appt);
}

// ─── Boarding checkout reminder scheduling ────────────────────────────────────

interface BoardingStayForReminder {
  id: string;
  businessId: string;
  customerId: string | null;
  checkOut: Date | null;
  pet: { name: string };
  customer: { name: string };
}

/**
 * Schedule a WhatsApp reminder 24h before boarding checkout.
 * Returns null if checkOut is null or send time is already in the past.
 */
export async function scheduleBoardingCheckoutReminder(stay: BoardingStayForReminder) {
  if (!stay.checkOut || !stay.customerId) return null;

  const sendAt = new Date(stay.checkOut.getTime() - 24 * 60 * 60 * 1000);
  if (sendAt <= new Date()) return null;

  const formattedDate = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(stay.checkOut);

  const body = `שלום ${stay.customer.name}! תזכורת לאיסוף ${stay.pet.name} מהפנסיון מחר (${formattedDate}). נשמח לראותכם! 🐾`;

  return prisma.scheduledMessage.create({
    data: {
      businessId: stay.businessId,
      customerId: stay.customerId,
      channel: "whatsapp",
      templateKey: "boarding_checkout_reminder_24h",
      payloadJson: JSON.stringify({ body }),
      sendAt,
      status: "PENDING",
      relatedEntityType: "BOARDING",
      relatedEntityId: stay.id,
    },
  });
}

/**
 * Cancel all pending checkout reminders for a boarding stay.
 */
export async function cancelBoardingCheckoutReminders(stayId: string) {
  return prisma.scheduledMessage.updateMany({
    where: {
      relatedEntityType: "BOARDING",
      relatedEntityId: stayId,
      status: "PENDING",
    },
    data: { status: "CANCELED" },
  });
}

/**
 * Cancel existing reminders and reschedule (call when checkOut date changes).
 */
export async function rescheduleBoardingCheckoutReminder(stay: BoardingStayForReminder) {
  await cancelBoardingCheckoutReminders(stay.id);
  return scheduleBoardingCheckoutReminder(stay);
}

/**
 * Schedule a "thank you for staying" WhatsApp message after checkout.
 * Sends 1 hour after checkout.
 * Idempotent — uses relatedEntityId for deduplication.
 */
export async function scheduleBoardingThankYou(stay: BoardingStayForReminder) {
  if (!stay.customerId) return null;
  const relatedEntityId = `boarding-thankyou-${stay.id}`;

  const existing = await prisma.scheduledMessage.findFirst({
    where: {
      relatedEntityType: "BOARDING_THANKYOU",
      relatedEntityId,
      status: { in: ["PENDING", "SENT"] },
    },
  });
  if (existing) return null;

  const sendAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
  const body = `שלום ${stay.customer.name}! 🐾 תודה ש-${stay.pet.name} שהה/שהתה אצלנו. היה לנו כיף ואנחנו מקווים שגם ${stay.pet.name} נהנה/נהנתה! נשמח לארח אתכם שוב 💛`;

  return prisma.scheduledMessage.create({
    data: {
      businessId: stay.businessId,
      customerId: stay.customerId,
      channel: "whatsapp",
      templateKey: "boarding_thank_you",
      payloadJson: JSON.stringify({ body }),
      sendAt,
      status: "PENDING",
      relatedEntityType: "BOARDING_THANKYOU",
      relatedEntityId,
    },
  });
}

// ─── Reminder scheduling service for training group sessions ───

/**
 * Schedule reminders for all active participants of a given session.
 * Creates PENDING scheduled messages at (session_datetime - lead_hours)
 * and optionally at same-day morning.
 */
export async function scheduleGroupSessionReminders(sessionId: string) {
  const session = await prisma.trainingGroupSession.findUnique({
    where: { id: sessionId },
    include: {
      trainingGroup: {
        include: {
          participants: {
            where: { status: "ACTIVE" },
            include: {
              customer: true,
              dog: true,
            },
          },
        },
      },
    },
  });

  if (!session || session.status === "CANCELED") return [];

  const group = session.trainingGroup;
  if (!group.reminderEnabled) return [];

  const createdMessages: string[] = [];

  for (const participant of group.participants) {
    const messages = buildReminderMessages(
      group,
      session,
      participant.customer,
      participant.dog,
      participant.id
    );

    for (const msg of messages) {
      // Only schedule if sendAt is in the future
      if (msg.sendAt > new Date()) {
        const created = await prisma.scheduledMessage.create({ data: msg });
        createdMessages.push(created.id);
      }
    }
  }

  // Emit analytics event
  if (createdMessages.length > 0) {
    await prisma.analyticsEvent.create({
      data: {
        businessId: group.businessId,
        type: "group_session_reminder_scheduled",
        entityType: "training_group_session",
        entityId: sessionId,
        metadataJson: JSON.stringify({ count: createdMessages.length }),
      },
    });
  }

  return createdMessages;
}

/**
 * Cancel all pending reminders for a session and regenerate.
 * Used when session datetime changes.
 */
export async function rescheduleGroupSessionReminders(sessionId: string) {
  await cancelGroupSessionReminders(sessionId);
  return scheduleGroupSessionReminders(sessionId);
}

/**
 * Cancel all pending reminders for a session.
 */
export async function cancelGroupSessionReminders(sessionId: string) {
  const result = await prisma.scheduledMessage.updateMany({
    where: {
      relatedEntityType: "GROUP_SESSION",
      relatedEntityId: sessionId,
      status: "PENDING",
    },
    data: { status: "CANCELED" },
  });
  return result.count;
}

/**
 * Schedule reminders for a new participant added to a group.
 * Only creates reminders for future sessions.
 */
export async function scheduleRemindersForNewParticipant(
  groupId: string,
  participantId: string
) {
  const participant = await prisma.trainingGroupParticipant.findUnique({
    where: { id: participantId },
    include: { customer: true, dog: true },
  });

  if (!participant || participant.status !== "ACTIVE") return [];

  const group = await prisma.trainingGroup.findUnique({
    where: { id: groupId },
    include: {
      sessions: {
        where: {
          status: "SCHEDULED",
          sessionDatetime: { gt: new Date() },
        },
      },
    },
  });

  if (!group || !group.reminderEnabled) return [];

  const createdMessages: string[] = [];

  for (const session of group.sessions) {
    const messages = buildReminderMessages(
      group,
      session,
      participant.customer,
      participant.dog,
      participant.id
    );

    for (const msg of messages) {
      if (msg.sendAt > new Date()) {
        const created = await prisma.scheduledMessage.create({ data: msg });
        createdMessages.push(created.id);
      }
    }
  }

  return createdMessages;
}

// ─── Internal helpers ───

interface GroupLike {
  id: string;
  name: string;
  location: string | null;
  reminderLeadHours: number;
  reminderSameDay: boolean;
  businessId: string;
}

interface SessionLike {
  id: string;
  sessionDatetime: Date;
}

interface CustomerLike {
  id: string;
  name: string;
}

interface DogLike {
  id: string;
  name: string;
}

function buildReminderMessages(
  group: GroupLike,
  session: SessionLike,
  customer: CustomerLike,
  dog: DogLike,
  _participantId: string // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  const messages: Array<{
    businessId: string;
    customerId: string;
    channel: string;
    templateKey: string;
    payloadJson: string;
    sendAt: Date;
    status: string;
    relatedEntityType: string;
    relatedEntityId: string;
  }> = [];

  const sessionDate = new Date(session.sessionDatetime);
  const formattedDatetime = new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(sessionDate);

  const formattedTime = new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(sessionDate);

  const payload = {
    customer_name: customer.name,
    dog_name: dog.name,
    group_name: group.name,
    session_datetime: formattedDatetime,
    session_time: formattedTime,
    location: group.location || "המיקום שנקבע",
  };

  // Lead-hours reminder (e.g. 48h before)
  const leadMs = group.reminderLeadHours * 60 * 60 * 1000;
  const leadSendAt = new Date(sessionDate.getTime() - leadMs);

  messages.push({
    businessId: group.businessId,
    customerId: customer.id,
    channel: "whatsapp",
    templateKey: REMINDER_TEMPLATES.GROUP_SESSION_REMINDER_48H.key,
    payloadJson: JSON.stringify(payload),
    sendAt: leadSendAt,
    status: "PENDING",
    relatedEntityType: "GROUP_SESSION",
    relatedEntityId: session.id,
  });

  // Same-day morning reminder (08:00 on session day, in UTC — adjust to local tz as needed)
  if (group.reminderSameDay) {
    const sameDaySendAt = new Date(sessionDate);
    sameDaySendAt.setUTCHours(8, 0, 0, 0);

    // Only if the same-day reminder is different from the lead-hours one
    if (sameDaySendAt.getTime() !== leadSendAt.getTime()) {
      messages.push({
        businessId: group.businessId,
        customerId: customer.id,
        channel: "whatsapp",
        templateKey: REMINDER_TEMPLATES.GROUP_SESSION_REMINDER_SAME_DAY.key,
        payloadJson: JSON.stringify(payload),
        sendAt: sameDaySendAt,
        status: "PENDING",
        relatedEntityType: "GROUP_SESSION",
        relatedEntityId: session.id,
      });
    }
  }

  return messages;
}

// ─── Service Dog Meeting reminder scheduling ──────────────────────────────────

const MEETING_TYPE_LABELS: Record<string, string> = {
  ASSESSMENT: "הערכה ראשונית",
  INITIAL_TRAINING: "הדרכה ראשונית",
  RECIPIENT_TRAINING: "אימון עם כלב השירות",
  COMPATIBILITY_CHECK: "בדיקת התאמה",
  FOLLOW_UP: "מעקב",
  ANNUAL_REVIEW: "בדיקה שנתית",
  OTHER: "פגישה",
};

interface ServiceDogMeetingForReminder {
  meetingId: string;           // synthetic ID — use recipientId + meeting.date
  recipientId: string;
  businessId: string;
  recipientName: string;
  recipientPhone: string | null;
  meetingDate: Date;
  meetingType: string;
  trainerName: string;
}

/**
 * Schedule a WhatsApp reminder 24h before a joint training session with the service dog recipient.
 * Idempotent — skips if a PENDING reminder already exists (keyed by recipientId+date).
 * The WhatsApp message will fire as soon as Meta Business Verification is approved.
 */
export async function scheduleServiceDogMeetingReminder(meeting: ServiceDogMeetingForReminder) {
  if (!meeting.recipientPhone) return null; // no phone → skip

  const sendAt = new Date(meeting.meetingDate.getTime() - 24 * 60 * 60 * 1000);
  if (sendAt <= new Date()) return null;

  // Look up active automation rule for this trigger
  const rule = await prisma.automationRule.findFirst({
    where: { businessId: meeting.businessId, trigger: "service_dog_meeting_reminder", isActive: true },
    include: {
      template: { select: { body: true } },
      business: { select: { phone: true } },
    },
  });

  // Deduplicate by relatedEntityId (recipientId + ISO date)
  const entityId = `${meeting.recipientId}__${meeting.meetingDate.toISOString()}`;
  const existing = await prisma.scheduledMessage.findFirst({
    where: { relatedEntityType: "SERVICE_DOG_MEETING", relatedEntityId: entityId, status: "PENDING" },
  });
  if (existing) return null;

  const formattedDate = new Intl.DateTimeFormat("he-IL", {
    weekday: "long", day: "numeric", month: "long",
  }).format(meeting.meetingDate);
  const formattedTime = meeting.meetingDate.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
  const typeLabel = MEETING_TYPE_LABELS[meeting.meetingType] ?? MEETING_TYPE_LABELS.OTHER;

  let body: string;
  if (rule?.template?.body) {
    body = interpolateTemplate(rule.template.body, {
      customerName: meeting.recipientName,
      date: formattedDate,
      time: formattedTime,
      serviceName: typeLabel,
      businessPhone: rule.business?.phone ?? "",
    });
  } else {
    body = `שלום ${meeting.recipientName}! 🐾 תזכורת: מחר (${formattedDate}) בשעה ${formattedTime} יש לנו ${typeLabel} עם כלב השירות. מאמן: ${meeting.trainerName}. נתראה!`;
  }

  return prisma.scheduledMessage.create({
    data: {
      businessId: meeting.businessId,
      customerId: null,
      channel: "whatsapp",
      templateKey: rule ? `automation-rule-${rule.id}` : "service_dog_meeting_reminder_24h",
      payloadJson: JSON.stringify({ body, to: meeting.recipientPhone }),
      sendAt,
      status: "PENDING",
      relatedEntityType: "SERVICE_DOG_MEETING",
      relatedEntityId: entityId,
    },
  });
}
