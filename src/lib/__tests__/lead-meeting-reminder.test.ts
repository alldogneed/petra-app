const biz = { findUnique: jest.fn() };
const rule = { findFirst: jest.fn() };
const sm = { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn() };
jest.mock("@/lib/prisma", () => ({
  prisma: { business: biz, automationRule: rule, scheduledMessage: sm },
}));

import { scheduleLeadMeetingReminder, cancelLeadMeetingReminder } from "../reminder-service";

const future = new Date(Date.now() + 5 * 24 * 3600 * 1000);
const meeting = (over: Record<string, unknown> = {}) => ({
  id: "m1",
  businessId: "b1",
  date: new Date(`${future.toISOString().slice(0, 10)}T00:00:00Z`),
  startTime: "17:00",
  location: "הרצל 12",
  lead: { name: "דנה", phone: "050-1234567", customerId: null },
  service: { name: "אילוף גורים" },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  biz.findUnique.mockResolvedValue({ whatsappRemindersEnabled: true, phone: "03-5555555", tier: "pro", featureOverrides: null });
  rule.findFirst.mockResolvedValue(null);
  sm.findFirst.mockResolvedValue(null);
  sm.create.mockImplementation(({ data }: { data: unknown }) => Promise.resolve(data));
});

describe("scheduleLeadMeetingReminder", () => {
  test("queues a reminder 24h before, to the lead's phone, with no customer", async () => {
    const msg = (await scheduleLeadMeetingReminder(meeting())) as Record<string, unknown>;
    expect(msg).toBeTruthy();
    expect(msg.customerId).toBeNull();
    expect(msg.relatedEntityType).toBe("LEAD_MEETING");
    expect(msg.relatedEntityId).toBe("m1");
    const payload = JSON.parse(msg.payloadJson as string);
    expect(payload.to).toBe("972501234567");
    expect(payload.flow).toBe("lead_meeting_reminder");
    expect(payload.templateChain[0].name).toBe("petra_appointment_reminder_v2");
    expect(payload.templateChain[0].params[3]).toBe("אילוף גורים");
    const meetingAt = new Date(`${future.toISOString().slice(0, 10)}T17:00:00`).getTime();
    const hoursBefore = (meetingAt - (msg.sendAt as Date).getTime()) / 3600_000;
    expect(Math.round(hoursBefore)).toBeGreaterThanOrEqual(23);
    expect(Math.round(hoursBefore)).toBeLessThanOrEqual(27); // TZ of the test runner vs Israel
  });

  test("no service → 'הפגישה שלנו' fills the template's service slot (item 40.4, was 'פגישת היכרות')", async () => {
    const msg = (await scheduleLeadMeetingReminder(meeting({ service: null }))) as Record<string, unknown>;
    const payload = JSON.parse(msg.payloadJson as string);
    expect(payload.templateChain[0].params[3]).toBe("הפגישה שלנו");
    expect(payload.body).not.toContain("פגישת היכרות");
  });

  test("item 40.4: the business's customer contact phone (03-3818670) goes out, not the owner's mobile", async () => {
    biz.findUnique.mockResolvedValueOnce({ whatsappRemindersEnabled: true, phone: "054-2560964", customerContactPhone: "03-3818670", tier: "pro", featureOverrides: null });
    const msg = (await scheduleLeadMeetingReminder(meeting({ service: { name: "אבחון בבית" } }))) as Record<string, unknown>;
    const payload = JSON.parse(msg.payloadJson as string);
    expect(payload.templateChain[0].params[3]).toBe("אבחון בבית");
    expect(payload.templateChain[0].params[4]).toBe("03-3818670");
    expect(payload.body).toContain("03-3818670");
    expect(payload.body).not.toContain("2560964");
  });

  test("item 40.4: no contact phone set → the business phone, as before (other businesses unchanged)", async () => {
    const msg = (await scheduleLeadMeetingReminder(meeting())) as Record<string, unknown>;
    expect(JSON.parse(msg.payloadJson as string).templateChain[0].params[4]).toBe("03-5555555");
  });

  test("skipped: lead already a customer, no phone, reminders off, tier without reminders, duplicate", async () => {
    expect(await scheduleLeadMeetingReminder(meeting({ lead: { name: "x", phone: "0501234567", customerId: "c1" } }))).toBeNull();
    expect(await scheduleLeadMeetingReminder(meeting({ lead: { name: "x", phone: null, customerId: null } }))).toBeNull();
    biz.findUnique.mockResolvedValueOnce({ whatsappRemindersEnabled: false, phone: "", tier: "pro", featureOverrides: null });
    expect(await scheduleLeadMeetingReminder(meeting())).toBeNull();
    biz.findUnique.mockResolvedValueOnce({ whatsappRemindersEnabled: true, phone: "", tier: "free", featureOverrides: null });
    expect(await scheduleLeadMeetingReminder(meeting())).toBeNull();
    sm.findFirst.mockResolvedValueOnce({ id: "existing" });
    expect(await scheduleLeadMeetingReminder(meeting())).toBeNull();
    expect(sm.create).not.toHaveBeenCalled();
  });

  test("meeting too soon for the 24h reminder → nothing queued", async () => {
    const soon = new Date(Date.now() + 2 * 3600 * 1000);
    expect(await scheduleLeadMeetingReminder(meeting({ date: new Date(`${soon.toISOString().slice(0, 10)}T00:00:00Z`), startTime: "00:01" }))).toBeNull();
  });

  test("cancel targets only this meeting's pending reminder", async () => {
    sm.updateMany.mockResolvedValue({ count: 1 });
    await cancelLeadMeetingReminder("m1");
    expect(sm.updateMany).toHaveBeenCalledWith({
      where: { relatedEntityType: "LEAD_MEETING", relatedEntityId: "m1", status: "PENDING" },
      data: { status: "CANCELED" },
    });
  });
});
