import { readFileSync } from "fs";
import { join } from "path";
import {
  BRAND_SHADES,
  PETRA_BRAND_SCALE,
  brandCssVariables,
  brandPalette,
  isValidHexColor,
  resolveBranding,
  rgbTriplet,
} from "@/lib/verticals/branding";

describe("brandPalette", () => {
  it("Petra's colour (and anything invalid) → Petra's own scale, unchanged", () => {
    expect(brandPalette("#F97316")).toEqual(PETRA_BRAND_SCALE);
    expect(brandPalette("#f97316")).toEqual(PETRA_BRAND_SCALE);
    expect(brandPalette("nope")).toEqual(PETRA_BRAND_SCALE);
  });
  it("500 = the colour itself, lighter below, darker above", () => {
    const p = brandPalette("#2563EB");
    expect(p[500]).toBe("#2563EB");
    const lum = (hex: string) => rgbTriplet(hex).split(" ").map(Number).reduce((a, b) => a + b, 0);
    for (let i = 1; i < BRAND_SHADES.length; i++) {
      expect(lum(p[BRAND_SHADES[i - 1]])).toBeGreaterThanOrEqual(lum(p[BRAND_SHADES[i]]));
    }
  });
});

describe("CSS variables", () => {
  it("default variables equal tailwind.config.ts brand.* (dogs look unchanged)", () => {
    // tailwind brand-500 = #F97316 = 249 115 22
    expect(brandCssVariables("#F97316")).toContain("--brand-500: 249 115 22;");
    expect(brandCssVariables("#F97316")).toContain("--brand-50: 255 247 237;");
    expect(brandCssVariables("#F97316")).toContain("--brand-900: 124 45 18;");
  });
});

describe("resolveBranding", () => {
  const branding = { logoUrl: "https://x/logo.png", primaryColor: "#2563EB", secondaryColor: "#111111", senderName: "סטודיו" };
  it("dogs → Petra even with a BrandingSettings row", () => {
    const r = resolveBranding({ vertical: "dogs", businessName: "כלבים בע״מ", branding });
    expect(r).toMatchObject({ enabled: false, name: "Petra", logoUrl: "/logo.svg", primaryColor: "#F97316" });
    expect(resolveBranding({ businessName: "x", branding }).enabled).toBe(false);
  });
  it("generic → the business's name, logo and colours", () => {
    const r = resolveBranding({ vertical: "generic", businessName: "סטודיו נועה", businessLogo: "/b.png", branding });
    expect(r).toEqual({
      enabled: true, name: "סטודיו נועה", logoUrl: "https://x/logo.png", primaryColor: "#2563EB",
      secondaryColor: "#111111", senderName: "סטודיו",
    });
  });
  it("generic without a row → business logo, Petra colour, business name as sender", () => {
    const r = resolveBranding({ vertical: "generic", businessName: "נועה", businessLogo: "/b.png" });
    expect(r).toMatchObject({ enabled: true, logoUrl: "/b.png", primaryColor: "#F97316", senderName: "נועה" });
    expect(resolveBranding({ vertical: "generic", businessName: "נועה" }).logoUrl).toBe("");
  });
  it("rejects a bad colour", () => {
    expect(isValidHexColor("#12345")).toBe(false);
    expect(resolveBranding({ vertical: "generic", businessName: "n", branding: { primaryColor: "red" } }).primaryColor).toBe("#F97316");
  });
});

describe("globals.css defaults = Petra's scale (dogs look byte-identical)", () => {
  it("every --brand-N in :root is the rgb of PETRA_BRAND_SCALE[N]", () => {
    const css = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");
    for (const shade of BRAND_SHADES) {
      expect(css).toContain(`--brand-${shade}: ${rgbTriplet(PETRA_BRAND_SCALE[shade])};`);
    }
  });
  it("tailwind brand tokens read the variables", () => {
    const tw = readFileSync(join(__dirname, "../../../tailwind.config.ts"), "utf8");
    for (const shade of BRAND_SHADES) expect(tw).toContain(`'${shade}': 'rgb(var(--brand-${shade}) / <alpha-value>)'`);
  });
});

import { applyEmailBranding, brandFooter, brandHeader, EMAIL_BRAND_FOOTER, EMAIL_BRAND_HEADER, withDisplayName } from "@/lib/email";
import { neutralizeForVertical } from "@/lib/verticals/catalog";

describe("e-mail branding", () => {
  const generic = resolveBranding({ vertical: "generic", businessName: "סטודיו <נועה>", businessLogo: "https://cdn/x.png", branding: { primaryColor: "#2563EB" } });
  const dogs = resolveBranding({ vertical: "dogs", businessName: "כלבים" });
  it("dogs / no branding → the Petra header + footer, unchanged", () => {
    expect(brandHeader(dogs)).toBe(brandHeader());
    expect(brandFooter(dogs)).toBe(brandFooter());
    expect(brandHeader()).toContain("Petra");
    expect(applyEmailBranding(`${EMAIL_BRAND_HEADER}x${EMAIL_BRAND_FOOTER}`, null)).toBe(`${brandHeader()}x${brandFooter()}`);
  });
  it("generic → business name (escaped), logo, colour; no Petra", () => {
    const h = brandHeader(generic) + brandFooter(generic);
    expect(h).toContain("סטודיו &lt;נועה&gt;");
    expect(h).toContain("#2563EB");
    expect(h).toContain("https://cdn/x.png");
    expect(h).not.toMatch(/Petra|petra|חיות מחמד/);
  });
  it("display name keeps the verified address", () => {
    expect(withDisplayName("Petra <noreply@petra-app.com>", "סטודיו נועה")).toBe('"סטודיו נועה" <noreply@petra-app.com>');
    expect(withDisplayName("noreply@x.com", 'a"b<c>')).toBe('"abc" <noreply@x.com>');
  });
  it("pet emoji dropped for generic only", () => {
    expect(neutralizeForVertical("נתראה בשיעור! 🐾", "generic")).toBe("נתראה בשיעור!");
    expect(neutralizeForVertical("נתראה בשיעור! 🐾", "dogs")).toBe("נתראה בשיעור! 🐾");
  });
});
