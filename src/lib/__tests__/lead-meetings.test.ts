import {
  addMinutesHHmm,
  canTransition,
  isMeetingDue,
  isValidYmd,
  validateMeetingSlot,
} from "../lead-meetings";

describe("lead meetings — pure helpers", () => {
  test("slot validation: real dates, HH:mm, start before end", () => {
    expect(validateMeetingSlot({ date: "2026-10-20", startTime: "17:00", endTime: "18:00" })).toBeNull();
    expect(validateMeetingSlot({ date: "2026-02-30", startTime: "17:00", endTime: "18:00" })).toBe("תאריך לא תקין");
    expect(validateMeetingSlot({ date: "2026-10-20", startTime: "7:00", endTime: "18:00" })).toMatch(/HH:MM/);
    expect(validateMeetingSlot({ date: "2026-10-20", startTime: "18:00", endTime: "18:00" })).toMatch(/לפני/);
  });

  test("isValidYmd rejects malformed and impossible dates", () => {
    expect(isValidYmd("2026-10-20")).toBe(true);
    expect(isValidYmd("2026-13-01")).toBe(false);
    expect(isValidYmd("20-10-2026")).toBe(false);
  });

  test("end time defaults never cross midnight", () => {
    expect(addMinutesHHmm("17:00", 60)).toBe("18:00");
    expect(addMinutesHHmm("09:45", 30)).toBe("10:15");
    expect(addMinutesHHmm("23:30", 60)).toBe("23:59");
  });

  test("only a scheduled meeting can be closed; closed meetings are final", () => {
    expect(canTransition("scheduled", "completed")).toBe(true);
    expect(canTransition("scheduled", "no_show")).toBe(true);
    expect(canTransition("scheduled", "canceled")).toBe(true);
    expect(canTransition("completed", "no_show")).toBe(false);
    expect(canTransition("canceled", "completed")).toBe(false);
    expect(canTransition("scheduled", "scheduled")).toBe(false);
  });

  test("outcome buttons appear once the meeting has started", () => {
    const start = new Date("2026-10-20T14:00:00Z");
    expect(isMeetingDue(start, new Date("2026-10-20T13:59:00Z"))).toBe(false);
    expect(isMeetingDue(start, new Date("2026-10-20T14:00:00Z"))).toBe(true);
  });
});
