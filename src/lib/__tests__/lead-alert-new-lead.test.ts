/**
 * alertNewLeadIfEnabled — the "ליד חדש נכנס" alert for leads created outside the API
 * route (the AllDog WhatsApp bot). Same tier gate as POST /api/leads.
 */
const findUnique = jest.fn();
const createMany = jest.fn();
const findMany = jest.fn();
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    business: { findUnique: (...a: unknown[]) => findUnique(...a) },
    businessUser: { findMany: (...a: unknown[]) => findMany(...a) },
    notification: { createMany: (...a: unknown[]) => createMany(...a) },
  },
}));
const sendWhatsAppTemplate = jest.fn(async () => ({ success: true }));
jest.mock("@/lib/whatsapp", () => ({
  sendWhatsAppTemplate: (...a: unknown[]) => sendWhatsAppTemplate(...(a as [])),
  sendWhatsAppMessage: jest.fn(async () => ({ success: true })),
}));

import { alertNewLeadIfEnabled } from "@/lib/lead-alert";

const lead = { name: "דנה", phone: "0541234567", requestedService: null, city: "כפר סבא", source: "וואטסאפ · בוט" };

beforeEach(() => {
  jest.clearAllMocks();
  findMany.mockResolvedValue([{ userId: "u1", user: { email: "" } }]);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("alertNewLeadIfEnabled", () => {
  it("PRO business: WhatsApp to the business phone + bell for the owners", async () => {
    findUnique.mockResolvedValue({ tier: "pro", phone: "0501112222", featureOverrides: null });
    await alertNewLeadIfEnabled("b1", lead);
    expect(sendWhatsAppTemplate).toHaveBeenCalledWith(expect.objectContaining({ businessId: "b1", context: "lead_alert" }));
    expect(createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ userId: "u1", title: "ליד חדש נכנס" })],
    });
  });

  it("free business: nothing is sent", async () => {
    findUnique.mockResolvedValue({ tier: "free", phone: "0501112222", featureOverrides: null });
    await alertNewLeadIfEnabled("b1", lead);
    expect(sendWhatsAppTemplate).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });

  it("feature override wins over the tier", async () => {
    findUnique.mockResolvedValue({ tier: "free", phone: "0501112222", featureOverrides: { lead_notifications: true } });
    await alertNewLeadIfEnabled("b1", lead);
    expect(createMany).toHaveBeenCalled();
  });

  it("never throws", async () => {
    findUnique.mockRejectedValue(new Error("db down"));
    await expect(alertNewLeadIfEnabled("b1", lead)).resolves.toBeUndefined();
  });
});
