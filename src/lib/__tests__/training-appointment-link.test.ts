import {
  isLinkableProgram,
  sessionToAppointmentTimes,
  appointmentToSessionTimes,
  nextSessionNumber,
  linkedAppointmentNotes,
} from "../training-appointment-link";

describe("training-appointment-link", () => {
  it("links only HOME programs with a customer", () => {
    expect(isLinkableProgram({ trainingType: "HOME", customerId: "c1" })).toBe(true);
    expect(isLinkableProgram({ trainingType: "HOME", customerId: null })).toBe(false);
    expect(isLinkableProgram({ trainingType: "BOARDING", customerId: "c1" })).toBe(false);
    expect(isLinkableProgram({ trainingType: "SERVICE_DOG", customerId: "c1" })).toBe(false);
  });

  it("converts a session instant to Israel-local appointment fields (summer, UTC+3)", () => {
    // 2026-10-14 07:30Z = 10:30 Israel (IDT)
    const t = sessionToAppointmentTimes(new Date("2026-10-14T07:30:00Z"), 45);
    expect(t).toEqual({
      ymd: "2026-10-14",
      date: new Date("2026-10-14T00:00:00.000Z"),
      startTime: "10:30",
      endTime: "11:15",
    });
  });

  it("uses the local day near midnight and caps the end at 23:59", () => {
    // 2026-12-01 21:30Z = 23:30 Israel (IST, UTC+2) on Dec 1
    const t = sessionToAppointmentTimes(new Date("2026-12-01T21:30:00Z"), 60);
    expect(t.ymd).toBe("2026-12-01");
    expect(t.startTime).toBe("23:30");
    expect(t.endTime).toBe("23:59");
  });

  it("round-trips appointment → session", () => {
    const s = appointmentToSessionTimes(new Date("2026-10-14T00:00:00.000Z"), "10:30", "11:15");
    expect(s.sessionDate.toISOString()).toBe("2026-10-14T07:30:00.000Z");
    expect(s.durationMinutes).toBe(45);
    const back = sessionToAppointmentTimes(s.sessionDate, s.durationMinutes);
    expect(back.startTime).toBe("10:30");
    expect(back.endTime).toBe("11:15");
    expect(appointmentToSessionTimes("2026-12-01", "09:00", "09:00").durationMinutes).toBe(60);
  });

  it("picks the lowest free meeting number, ignoring canceled rows", () => {
    expect(nextSessionNumber([])).toBe(1);
    expect(nextSessionNumber([{ sessionNumber: 1, status: "COMPLETED" }, { sessionNumber: 2, status: "SCHEDULED" }])).toBe(3);
    expect(nextSessionNumber([{ sessionNumber: 1, status: "COMPLETED" }, { sessionNumber: 3, status: "SCHEDULED" }])).toBe(2);
    expect(nextSessionNumber([{ sessionNumber: 1, status: "CANCELED" }])).toBe(1);
    expect(nextSessionNumber([{ sessionNumber: null, status: "COMPLETED" }])).toBe(1);
  });

  it("builds the appointment notes line", () => {
    expect(linkedAppointmentNotes("אילוף בסיסי", 3, 6)).toBe("[אילוף] מפגש 3/6 · אילוף בסיסי");
    expect(linkedAppointmentNotes("אילוף", null, null)).toBe("[אילוף] מפגש · אילוף");
  });
});
