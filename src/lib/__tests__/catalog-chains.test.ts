jest.mock("@/lib/prisma", () => ({ __esModule: true, default: {} }));
import {
  bookingRequestReceivedChain, bookingDeclinedChain, contractToSignChain, vaccinationReminderChain, petBirthdayChain,
} from "@/lib/reminder-service";
import { PETRA_TEMPLATE_CATALOG } from "@/lib/meta-template-catalog";

const varCount = (name: string) =>
  [...(PETRA_TEMPLATE_CATALOG.find((t) => t.name === name)?.body ?? "").matchAll(/\{\{\d+\}\}/g)].length;

describe("catalog template chains send exactly the variables the template has", () => {
  it.each([
    bookingRequestReceivedChain({ customerName: "דנה", serviceName: "אילוף", date: "24.10.2026", time: "17:30", businessName: "נדב" }),
    bookingDeclinedChain({ customerName: "דנה", date: "24.10.2026", time: "17:30", businessName: "נדב" }),
    contractToSignChain({ customerName: "דנה", businessName: "נדב", signUrl: "https://x/sign/1" }),
    vaccinationReminderChain({ customerName: "דנה", vaccineLabel: "כלבת", petName: "רקסי", expiry: "5 בנובמבר" }),
    petBirthdayChain({ petName: "רקסי", ageSentence: "חוגגים 3 שנים", businessName: "נדב" }),
  ].map((c) => [c[0].name, c]))("%s", (name, chain) => {
    expect((chain as { params: string[] }[])[0].params).toHaveLength(varCount(name as string));
  });
  it("missing service falls back to a generic word; missing business name drops the step", () => {
    expect(bookingRequestReceivedChain({ customerName: "a", serviceName: "", date: "d", time: "t", businessName: "b" })[0].params[1]).toBe("התור");
    expect(bookingDeclinedChain({ customerName: "a", date: "d", time: "t", businessName: "" })).toEqual([]);
  });
});
