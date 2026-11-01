import { PDFDocument } from "pdf-lib";
import { applyPdfBranding } from "@/lib/verticals/pdf";

const sent: Array<Record<string, unknown>> = [];
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn(async (p: Record<string, unknown>) => { sent.push(p); return { data: { id: "x" }, error: null }; }) },
  })),
}));

describe("signed PDF metadata", () => {
  async function roundTrip(vertical: string | null) {
    const doc = await PDFDocument.create();
    doc.addPage();
    const before = { author: doc.getAuthor(), producer: doc.getProducer() };
    applyPdfBranding(doc, { vertical, businessName: "סטודיו נועה" });
    const loaded = await PDFDocument.load(await doc.save(), { updateMetadata: false });
    return { before, author: loaded.getAuthor(), creator: loaded.getCreator(), producer: loaded.getProducer() };
  }
  it("generic → the business is author / creator / producer, no Petra", async () => {
    const r = await roundTrip("generic");
    expect(r.author).toBe("סטודיו נועה");
    expect(r.creator).toBe("סטודיו נועה");
    expect(r.producer).toBe("סטודיו נועה");
  });
  it("dogs → pdf-lib defaults, unchanged", async () => {
    const r = await roundTrip("dogs");
    expect(r.author).toBe(r.before.author);
    expect(r.producer).toBe(r.before.producer);
    expect(String(r.producer)).not.toContain("נועה");
  });
});

describe("sendEmail", () => {
  beforeAll(() => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Petra <noreply@petra-app.com>";
  });
  it("generic: business display name + branded html; dogs (no fromName): Petra sender, as before", async () => {
    const { sendEmail, applyEmailBranding, EMAIL_BRAND_HEADER, EMAIL_BRAND_FOOTER } = await import("@/lib/email");
    const { resolveBranding } = await import("@/lib/verticals/branding");
    const generic = resolveBranding({ vertical: "generic", businessName: "סטודיו נועה", branding: { primaryColor: "#2563EB", senderName: "נועה" } });
    const html = applyEmailBranding(`${EMAIL_BRAND_HEADER}<p>שיעור</p>${EMAIL_BRAND_FOOTER}`, generic);
    await sendEmail({ to: "a@b.c", subject: "s", html, fromName: generic.senderName });
    await sendEmail({ to: "a@b.c", subject: "s", html: "<p>x</p>" });
    expect(sent[0].from).toBe('"נועה" <noreply@petra-app.com>');
    expect(String(sent[0].html)).toContain("סטודיו נועה");
    expect(String(sent[0].html)).not.toMatch(/Petra/);
    expect(sent[1].from).toBe("Petra <noreply@petra-app.com>");
  });
});
