import { buildWhatsAppUrl } from "@/lib/utils";

describe("buildWhatsAppUrl", () => {
  it("with text → api.whatsapp.com/send (wa.me turns 🐾 into �)", () => {
    const url = buildWhatsAppUrl("050-123-4567", "שלום 🐾 💳");
    expect(url.startsWith("https://api.whatsapp.com/send?phone=972501234567&text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1])).toBe("שלום 🐾 💳");
  });
  it("without text → plain wa.me chat link", () => {
    expect(buildWhatsAppUrl("0501234567")).toBe("https://wa.me/972501234567");
  });
});
