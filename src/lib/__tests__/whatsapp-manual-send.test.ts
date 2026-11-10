import { manualSendFailureText, waitForDeliveryOutcome } from "../whatsapp-failure"

const noSleep = async () => {}

describe("waitForDeliveryOutcome", () => {
  it("returns failed as soon as the webhook marks the row failed (Nadav 8/11: 131047 after 3s)", async () => {
    const seq = [
      { status: "accepted", errorCode: null, errorMessage: null },
      { status: "failed", errorCode: "131047", errorMessage: "Re-engagement message" },
    ]
    let i = 0
    const out = await waitForDeliveryOutcome(async () => seq[Math.min(i++, seq.length - 1)], { sleep: noSleep })
    expect(out).toEqual({ state: "failed", errorCode: "131047", errorMessage: "Re-engagement message" })
  })
  it("returns accepted on sent / delivered", async () => {
    const out = await waitForDeliveryOutcome(async () => ({ status: "delivered", errorCode: null, errorMessage: null }), { sleep: noSleep })
    expect(out).toEqual({ state: "accepted", status: "delivered" })
  })
  it("unknown when nothing arrives before the timeout (row missing or still accepted)", async () => {
    let calls = 0
    const out = await waitForDeliveryOutcome(async () => { calls++; return null }, { sleep: noSleep, timeoutMs: 2100, intervalMs: 700 })
    expect(out).toEqual({ state: "unknown" })
    expect(calls).toBe(4)
  })
  it("a DB error is treated as no answer, never throws", async () => {
    const out = await waitForDeliveryOutcome(async () => { throw new Error("db") }, { sleep: noSleep, timeoutMs: 0 })
    expect(out).toEqual({ state: "unknown" })
  })
})

describe("manualSendFailureText", () => {
  it("explains the 24h window and points to the business's own WhatsApp", () => {
    const t = manualSendFailureText("131047")
    expect(t).toContain("24 השעות")
    expect(t).toContain("מהוואטסאפ שלכם")
  })
  it("has a fallback", () => {
    expect(manualSendFailureText(null)).toContain("לא מסר")
  })
})

import { overwritableStatuses } from "../whatsapp-failure"

describe("overwritableStatuses (status webhook moves forward only)", () => {
  it("delivered never overwrites read; read overwrites delivered", () => {
    expect(overwritableStatuses("delivered")).not.toContain("read")
    expect(overwritableStatuses("read")).toEqual(["accepted", "sent", "delivered"])
  })
  it("failed overwrites progress before read, never read or failed (one alert)", () => {
    expect(overwritableStatuses("failed")).toEqual(["accepted", "sent", "delivered"])
  })
  it("accepted / unknown change nothing", () => {
    expect(overwritableStatuses("accepted")).toEqual([])
    expect(overwritableStatuses("weird")).toEqual([])
  })
})
