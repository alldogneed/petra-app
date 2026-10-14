jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/reminder-service", () => ({
  cancelLeadFollowup: jest.fn().mockResolvedValue(undefined),
  cancelLeadMeetingReminder: jest.fn().mockResolvedValue(undefined),
  scheduleLeadMeetingReminder: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/services/clients", () => ({ clearLeadFollowUps: jest.fn().mockResolvedValue({ tasksCanceled: 0 }) }));

import { recordLeadMeetingOutcome, createLeadMeeting } from "@/services/lead-meetings";
import { cancelLeadMeetingReminder } from "@/lib/reminder-service";

function makeDb(over: Record<string, unknown> = {}) {
  const meetingRow = { id: "m1", status: "scheduled", date: new Date("2026-10-20T00:00:00Z"), startTime: "17:00", endTime: "18:00", serviceId: null, notes: null, location: "הרצל 12" };
  return {
    leadMeeting: {
      findFirst: jest.fn().mockResolvedValue(meetingRow),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn(),
    },
    lead: {
      findFirst: jest.fn().mockResolvedValue({ id: "l1", name: "דנה", phone: "0501234567", email: null, notes: null, source: "website", customerId: null, wonAt: null, lostAt: null }),
      update: jest.fn().mockResolvedValue({ id: "l1" }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    leadStage: { findFirst: jest.fn().mockResolvedValue({ id: "won" }), count: jest.fn(), create: jest.fn() },
    customer: { findFirst: jest.fn(), create: jest.fn().mockResolvedValue({ id: "c1", name: "דנה" }) },
    timelineEvent: { create: jest.fn() },
    appointment: { create: jest.fn().mockResolvedValue({ id: "a1" }) },
    service: { findFirst: jest.fn() },
    ...over,
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe("recordLeadMeetingOutcome", () => {
  beforeEach(() => jest.clearAllMocks());

  test("completed → lead converted, completed appointment on the meeting's time, meeting linked", async () => {
    const db = makeDb();
    const res = await recordLeadMeetingOutcome("b1", db, "l1", "m1", "completed", "u1");
    expect(res).toEqual({ outcome: "completed", customer: { id: "c1", name: "דנה" }, appointmentId: "a1" });
    expect(db.leadMeeting.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "m1", businessId: "b1", status: "scheduled" },
    }));
    const appt = db.appointment.create.mock.calls[0][0].data;
    expect(appt).toMatchObject({ businessId: "b1", customerId: "c1", startTime: "17:00", endTime: "18:00", status: "completed" });
    expect(appt.notes).toContain("[פגישת ליד]");
    expect(db.lead.update.mock.calls[0][0].data).toMatchObject({ wonAt: expect.any(Date), customerId: "c1", stage: "won" });
    expect(cancelLeadMeetingReminder).toHaveBeenCalledWith("m1");
  });

  test("no_show → lead stays a lead, follow-up set, nothing converted", async () => {
    const db = makeDb();
    const res = await recordLeadMeetingOutcome("b1", db, "l1", "m1", "no_show", "u1");
    expect(res.customer).toBeNull();
    expect(db.customer.create).not.toHaveBeenCalled();
    expect(db.appointment.create).not.toHaveBeenCalled();
    expect(db.lead.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "l1", businessId: "b1" },
      data: { nextFollowUpAt: expect.any(Date), followUpStatus: "pending" },
    });
  });

  test("double click: the second claim finds nothing and converts nothing", async () => {
    const db = makeDb();
    db.leadMeeting.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(recordLeadMeetingOutcome("b1", db, "l1", "m1", "completed", "u1")).rejects.toThrow("כבר נסגרה");
    expect(db.customer.create).not.toHaveBeenCalled();
  });

  test("another business's meeting is not found", async () => {
    const db = makeDb();
    db.leadMeeting.findFirst.mockResolvedValueOnce(null);
    await expect(recordLeadMeetingOutcome("other", db, "l1", "m1", "completed", "u1")).rejects.toThrow("לא נמצאה");
    expect(db.leadMeeting.findFirst.mock.calls[0][0].where).toMatchObject({ businessId: "other", leadId: "l1" });
  });

  test("conversion failure releases the claim so the owner can retry", async () => {
    const db = makeDb();
    db.appointment.create.mockRejectedValueOnce(new Error("db down"));
    await expect(recordLeadMeetingOutcome("b1", db, "l1", "m1", "completed", "u1")).rejects.toThrow("db down");
    const release = db.leadMeeting.updateMany.mock.calls.at(-1)[0];
    expect(release.data).toEqual({ status: "scheduled", outcomeAt: null });
  });
});

describe("createLeadMeeting", () => {
  test("refuses a lead that is already a customer", async () => {
    const db = makeDb();
    db.lead.findFirst.mockResolvedValueOnce({ id: "l1", customerId: "c9" });
    await expect(createLeadMeeting("b1", db, "l1", { date: "2026-10-20", startTime: "17:00", endTime: "18:00" }, "u1"))
      .rejects.toThrow("כבר לקוח");
  });

  test("rejects a bad slot before writing", async () => {
    const db = makeDb();
    await expect(createLeadMeeting("b1", db, "l1", { date: "2026-10-20", startTime: "18:00", endTime: "17:00" }, "u1"))
      .rejects.toThrow("לפני");
    expect(db.leadMeeting.create).not.toHaveBeenCalled();
  });
});
