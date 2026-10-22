jest.mock("@/lib/prisma", () => ({ __esModule: true, default: {} }));
import { appointmentFollowupChain, META_TEMPLATES } from "@/lib/reminder-service";

describe("appointmentFollowupChain", () => {
  it("uses the approved follow-up template with name, pet and business phone", () => {
    expect(appointmentFollowupChain({ customerName: "חי", petName: "ג'קס", businessPhone: "0547983175" })).toEqual([
      { name: META_TEMPLATES.appointmentFollowup[0], params: ["חי", "ג'קס", "0547983175"] },
    ]);
  });
  it("keeps the step valid when the appointment has no dog", () => {
    expect(appointmentFollowupChain({ customerName: "חי", petName: null, businessPhone: "050" })[0].params[1]).toBe("הכלב שלכם");
  });
  it("drops the step when a required param is empty (free text stays the fallback)", () => {
    expect(appointmentFollowupChain({ customerName: "חי", petName: "x", businessPhone: "" })).toEqual([]);
  });
});
