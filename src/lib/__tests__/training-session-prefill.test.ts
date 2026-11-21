import { scheduledSessionPrefill } from "../training-session-prefill"

describe("scheduledSessionPrefill", () => {
  const sessions = [
    { sessionNumber: 4, sessionDate: new Date(2026, 9, 8, 17, 0).toISOString(), durationMinutes: 60, status: "COMPLETED" },
    { sessionNumber: 5, sessionDate: new Date(2026, 10, 2, 18, 0).toISOString(), durationMinutes: 45, status: "SCHEDULED" },
  ]
  it("uses the scheduled meeting's date, time and duration (שחר: 2/11 18:00, not today 10:00)", () => {
    expect(scheduledSessionPrefill(sessions, 5)).toEqual({ sessionDate: "2026-11-02", sessionTime: "18:00", durationMinutes: 45 })
  })
  it("null when the number has no scheduled meeting (form keeps today)", () => {
    expect(scheduledSessionPrefill(sessions, 4)).toBeNull()
    expect(scheduledSessionPrefill(sessions, 6)).toBeNull()
    expect(scheduledSessionPrefill(undefined, 1)).toBeNull()
  })
})
