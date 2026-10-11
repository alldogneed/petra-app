import { followupSendAt, FOLLOWUP_LATE_COMPLETION_WINDOW_MS } from "../reminder-service";

const H = 60 * 60 * 1000;
const appt = new Date("2026-10-08T13:00:00.000Z"); // 16:00 Israel

describe("followupSendAt", () => {
  it("schedules start + offset when that is still ahead", () => {
    const now = new Date("2026-10-08T14:00:00.000Z");
    expect(followupSendAt(appt, 24, now, false)?.toISOString()).toBe("2026-10-09T13:00:00.000Z");
    expect(followupSendAt(appt, 24, now, true)?.toISOString()).toBe("2026-10-09T13:00:00.000Z");
  });

  it("drops it on creation when the moment already passed", () => {
    const now = new Date("2026-10-10T08:00:00.000Z");
    expect(followupSendAt(appt, 24, now, false)).toBeNull();
  });

  it("on completion after the planned moment, sends shortly after completion (the reported case)", () => {
    const now = new Date("2026-10-10T08:00:00.000Z"); // completed two days later
    const at = followupSendAt(appt, 24, now, true);
    expect(at).not.toBeNull();
    expect(at!.getTime() - now.getTime()).toBe(10 * 60 * 1000);
  });

  it("on completion long after the appointment, does not send", () => {
    const now = new Date(appt.getTime() + FOLLOWUP_LATE_COMPLETION_WINDOW_MS + H);
    expect(followupSendAt(appt, 24, now, true)).toBeNull();
  });
});
