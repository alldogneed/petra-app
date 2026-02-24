/**
 * Tests for the reminder scheduling service.
 *
 * These tests verify the core logic of building reminder messages
 * and the scheduling/rescheduling/cancellation flows.
 *
 * We mock Prisma to isolate the service logic.
 */

import { prisma } from "@/lib/prisma";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    trainingGroupSession: {
      findUnique: jest.fn(),
    },
    trainingGroup: {
      findUnique: jest.fn(),
    },
    trainingGroupParticipant: {
      findUnique: jest.fn(),
    },
    scheduledMessage: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    analyticsEvent: {
      create: jest.fn(),
    },
  },
}));

// Import after mocking
import {
  scheduleGroupSessionReminders,
  rescheduleGroupSessionReminders,
  cancelGroupSessionReminders,
  scheduleRemindersForNewParticipant,
} from "@/lib/reminder-service";

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe("Reminder Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementations
    (mockPrisma.scheduledMessage.create as jest.Mock).mockResolvedValue({ id: "msg-1" });
    (mockPrisma.scheduledMessage.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (mockPrisma.analyticsEvent.create as jest.Mock).mockResolvedValue({ id: "evt-1" });
  });

  describe("scheduleGroupSessionReminders", () => {
    it("should create reminders for all active participants", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // 7 days from now

      (mockPrisma.trainingGroupSession.findUnique as jest.Mock).mockResolvedValue({
        id: "session-1",
        sessionDatetime: futureDate,
        status: "SCHEDULED",
        trainingGroup: {
          id: "group-1",
          businessId: "demo-business-001",
          name: "כיתת גורים",
          location: "פארק הירקון",
          reminderEnabled: true,
          reminderLeadHours: 48,
          reminderSameDay: false,
          participants: [
            {
              id: "participant-1",
              status: "ACTIVE",
              customer: { id: "cust-1", name: "ישראל ישראלי" },
              dog: { id: "dog-1", name: "רקס" },
            },
            {
              id: "participant-2",
              status: "ACTIVE",
              customer: { id: "cust-2", name: "רחל כהן" },
              dog: { id: "dog-2", name: "בלה" },
            },
          ],
        },
      });

      const result = await scheduleGroupSessionReminders("session-1");

      // Should create 2 reminders (one per active participant), no same-day
      expect(result).toHaveLength(2);
      expect(mockPrisma.scheduledMessage.create).toHaveBeenCalledTimes(2);

      // Verify first call
      const firstCall = (mockPrisma.scheduledMessage.create as jest.Mock).mock.calls[0][0].data;
      expect(firstCall.customerId).toBe("cust-1");
      expect(firstCall.templateKey).toBe("GROUP_SESSION_REMINDER_48H");
      expect(firstCall.status).toBe("PENDING");
      expect(firstCall.relatedEntityType).toBe("GROUP_SESSION");
      expect(firstCall.relatedEntityId).toBe("session-1");

      // Verify payload contains correct variables
      const payload = JSON.parse(firstCall.payloadJson);
      expect(payload.customer_name).toBe("ישראל ישראלי");
      expect(payload.dog_name).toBe("רקס");
      expect(payload.group_name).toBe("כיתת גורים");
      expect(payload.location).toBe("פארק הירקון");

      // Analytics event created
      expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledTimes(1);
    });

    it("should create same-day reminders when enabled", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      futureDate.setHours(18, 0, 0, 0); // 6pm, so same-day 8am is different

      (mockPrisma.trainingGroupSession.findUnique as jest.Mock).mockResolvedValue({
        id: "session-1",
        sessionDatetime: futureDate,
        status: "SCHEDULED",
        trainingGroup: {
          id: "group-1",
          businessId: "demo-business-001",
          name: "תגובתיות",
          location: null,
          reminderEnabled: true,
          reminderLeadHours: 48,
          reminderSameDay: true,
          participants: [
            {
              id: "p-1",
              status: "ACTIVE",
              customer: { id: "c-1", name: "דוד" },
              dog: { id: "d-1", name: "לוקי" },
            },
          ],
        },
      });

      const result = await scheduleGroupSessionReminders("session-1");

      // 1 participant * 2 messages (48h + same-day) = 2
      expect(result).toHaveLength(2);
      expect(mockPrisma.scheduledMessage.create).toHaveBeenCalledTimes(2);

      // Check both template keys
      const calls = (mockPrisma.scheduledMessage.create as jest.Mock).mock.calls;
      const templateKeys = calls.map((c: Array<{ data: { templateKey: string } }>) => c[0].data.templateKey);
      expect(templateKeys).toContain("GROUP_SESSION_REMINDER_48H");
      expect(templateKeys).toContain("GROUP_SESSION_REMINDER_SAME_DAY");
    });

    it("should not create reminders when reminderEnabled is false", async () => {
      (mockPrisma.trainingGroupSession.findUnique as jest.Mock).mockResolvedValue({
        id: "session-1",
        sessionDatetime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: "SCHEDULED",
        trainingGroup: {
          id: "group-1",
          businessId: "demo-business-001",
          name: "Test Group",
          location: null,
          reminderEnabled: false,
          reminderLeadHours: 48,
          reminderSameDay: false,
          participants: [
            { id: "p-1", status: "ACTIVE", customer: { id: "c-1", name: "A" }, dog: { id: "d-1", name: "B" } },
          ],
        },
      });

      const result = await scheduleGroupSessionReminders("session-1");

      expect(result).toHaveLength(0);
      expect(mockPrisma.scheduledMessage.create).not.toHaveBeenCalled();
    });

    it("should not create reminders for canceled sessions", async () => {
      (mockPrisma.trainingGroupSession.findUnique as jest.Mock).mockResolvedValue({
        id: "session-1",
        sessionDatetime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: "CANCELED",
        trainingGroup: {
          id: "group-1",
          businessId: "demo-business-001",
          name: "Test",
          location: null,
          reminderEnabled: true,
          reminderLeadHours: 48,
          reminderSameDay: false,
          participants: [],
        },
      });

      const result = await scheduleGroupSessionReminders("session-1");
      expect(result).toHaveLength(0);
    });

    it("should not schedule reminders if sendAt is in the past", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // yesterday

      (mockPrisma.trainingGroupSession.findUnique as jest.Mock).mockResolvedValue({
        id: "session-1",
        sessionDatetime: pastDate,
        status: "SCHEDULED",
        trainingGroup: {
          id: "group-1",
          businessId: "demo-business-001",
          name: "Past Session Group",
          location: null,
          reminderEnabled: true,
          reminderLeadHours: 48,
          reminderSameDay: false,
          participants: [
            { id: "p-1", status: "ACTIVE", customer: { id: "c-1", name: "A" }, dog: { id: "d-1", name: "B" } },
          ],
        },
      });

      const result = await scheduleGroupSessionReminders("session-1");

      // Send-at would be yesterday - 48h, which is in the past
      expect(result).toHaveLength(0);
      expect(mockPrisma.scheduledMessage.create).not.toHaveBeenCalled();
    });

    it("should use default location text when location is null", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      (mockPrisma.trainingGroupSession.findUnique as jest.Mock).mockResolvedValue({
        id: "session-1",
        sessionDatetime: futureDate,
        status: "SCHEDULED",
        trainingGroup: {
          id: "group-1",
          businessId: "demo-business-001",
          name: "No Location Group",
          location: null,
          reminderEnabled: true,
          reminderLeadHours: 48,
          reminderSameDay: false,
          participants: [
            { id: "p-1", status: "ACTIVE", customer: { id: "c-1", name: "Test" }, dog: { id: "d-1", name: "Dog" } },
          ],
        },
      });

      await scheduleGroupSessionReminders("session-1");

      const call = (mockPrisma.scheduledMessage.create as jest.Mock).mock.calls[0][0].data;
      const payload = JSON.parse(call.payloadJson);
      expect(payload.location).toBe("המיקום שנקבע");
    });
  });

  describe("cancelGroupSessionReminders", () => {
    it("should cancel all pending messages for a session", async () => {
      (mockPrisma.scheduledMessage.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

      const result = await cancelGroupSessionReminders("session-1");

      expect(result).toBe(3);
      expect(mockPrisma.scheduledMessage.updateMany).toHaveBeenCalledWith({
        where: {
          relatedEntityType: "GROUP_SESSION",
          relatedEntityId: "session-1",
          status: "PENDING",
        },
        data: { status: "CANCELED" },
      });
    });

    it("should return 0 when no pending messages exist", async () => {
      (mockPrisma.scheduledMessage.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      const result = await cancelGroupSessionReminders("session-1");
      expect(result).toBe(0);
    });
  });

  describe("rescheduleGroupSessionReminders", () => {
    it("should cancel existing reminders and create new ones", async () => {
      (mockPrisma.scheduledMessage.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      (mockPrisma.trainingGroupSession.findUnique as jest.Mock).mockResolvedValue({
        id: "session-1",
        sessionDatetime: futureDate,
        status: "SCHEDULED",
        trainingGroup: {
          id: "group-1",
          businessId: "demo-business-001",
          name: "Rescheduled Group",
          location: "New Location",
          reminderEnabled: true,
          reminderLeadHours: 24,
          reminderSameDay: false,
          participants: [
            { id: "p-1", status: "ACTIVE", customer: { id: "c-1", name: "A" }, dog: { id: "d-1", name: "B" } },
          ],
        },
      });

      const result = await rescheduleGroupSessionReminders("session-1");

      // First cancel
      expect(mockPrisma.scheduledMessage.updateMany).toHaveBeenCalledWith({
        where: {
          relatedEntityType: "GROUP_SESSION",
          relatedEntityId: "session-1",
          status: "PENDING",
        },
        data: { status: "CANCELED" },
      });

      // Then create new ones
      expect(result).toHaveLength(1);
    });
  });

  describe("scheduleRemindersForNewParticipant", () => {
    it("should schedule reminders for future sessions only", async () => {
      const futureSessions = [
        { id: "s-1", sessionDatetime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), status: "SCHEDULED" },
        { id: "s-2", sessionDatetime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), status: "SCHEDULED" },
      ];

      (mockPrisma.trainingGroupParticipant.findUnique as jest.Mock).mockResolvedValue({
        id: "p-new",
        status: "ACTIVE",
        customer: { id: "c-1", name: "New Customer" },
        dog: { id: "d-1", name: "New Dog" },
      });

      (mockPrisma.trainingGroup.findUnique as jest.Mock).mockResolvedValue({
        id: "group-1",
        businessId: "demo-business-001",
        name: "Group with New Participant",
        location: "Somewhere",
        reminderEnabled: true,
        reminderLeadHours: 48,
        reminderSameDay: false,
        sessions: futureSessions,
      });

      const result = await scheduleRemindersForNewParticipant("group-1", "p-new");

      // 2 future sessions * 1 message each = 2
      expect(result).toHaveLength(2);
      expect(mockPrisma.scheduledMessage.create).toHaveBeenCalledTimes(2);
    });

    it("should not schedule reminders for non-ACTIVE participants", async () => {
      (mockPrisma.trainingGroupParticipant.findUnique as jest.Mock).mockResolvedValue({
        id: "p-paused",
        status: "PAUSED",
        customer: { id: "c-1", name: "Paused" },
        dog: { id: "d-1", name: "Dog" },
      });

      const result = await scheduleRemindersForNewParticipant("group-1", "p-paused");

      expect(result).toHaveLength(0);
      expect(mockPrisma.scheduledMessage.create).not.toHaveBeenCalled();
    });

    it("should not schedule reminders when group has reminders disabled", async () => {
      (mockPrisma.trainingGroupParticipant.findUnique as jest.Mock).mockResolvedValue({
        id: "p-1",
        status: "ACTIVE",
        customer: { id: "c-1", name: "A" },
        dog: { id: "d-1", name: "B" },
      });

      (mockPrisma.trainingGroup.findUnique as jest.Mock).mockResolvedValue({
        id: "group-1",
        businessId: "demo-business-001",
        name: "No Reminders",
        location: null,
        reminderEnabled: false,
        reminderLeadHours: 48,
        reminderSameDay: false,
        sessions: [],
      });

      const result = await scheduleRemindersForNewParticipant("group-1", "p-1");

      expect(result).toHaveLength(0);
    });
  });
});
