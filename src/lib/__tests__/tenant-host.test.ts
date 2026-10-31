import { isValidCustomSubdomain, punycodeDecodeLabel, punycodeEncodeLabel, isDnsSafeSlug, sessionCookieDomain, tenantSlugFromHost, tenantUrl } from "@/lib/verticals/tenant-host";

describe("tenantSlugFromHost", () => {
  const R = "petra.app";
  it("off without a root domain (zero change)", () => {
    expect(tenantSlugFromHost("noa.petra.app", undefined)).toBeNull();
    expect(tenantSlugFromHost("noa.petra.app", "")).toBeNull();
  });
  it("extracts a business slug", () => {
    expect(tenantSlugFromHost("noa-1a2b.petra.app", R)).toBe("noa-1a2b");
    expect(tenantSlugFromHost("NOA-1A2B.Petra.App:443", R)).toBe("noa-1a2b");
    expect(tenantSlugFromHost("noa.petra.app.", R)).toBe("noa");
  });
  it.each([
    "petra.app", "www.petra.app", "app.petra.app", "api.petra.app", "a.b.petra.app", "petra-app.com",
    "noa.petra-app.com", "evilpetra.app", "-x.petra.app", "localhost:3000", "",
  ])("ignores %s", (host) => {
    expect(tenantSlugFromHost(host, R)).toBeNull();
  });
});

describe("sessionCookieDomain", () => {
  it("only on hosts under the configured domain", () => {
    expect(sessionCookieDomain("noa.petra.app", ".petra.app")).toBe(".petra.app");
    expect(sessionCookieDomain("petra.app", "petra.app")).toBe(".petra.app");
    expect(sessionCookieDomain("petra-app.com", ".petra.app")).toBeUndefined();
    expect(sessionCookieDomain("localhost:3000", ".petra.app")).toBeUndefined();
    expect(sessionCookieDomain("noa.petra.app", undefined)).toBeUndefined();
  });
});

describe("tenantUrl", () => {
  it("only for DNS-safe slugs", () => {
    expect(tenantUrl("noa-1a2b", "petra.app")).toBe("https://noa-1a2b.petra.app");
    expect(tenantUrl("סטודיו-1a2b", "petra.app")).toBeNull(); // Hebrew + Latin = invalid IDN (BIDI)
    expect(tenantUrl("www", "petra.app")).toBeNull();
    expect(tenantUrl("noa", undefined)).toBeNull();
    expect(isDnsSafeSlug("a".repeat(64))).toBe(false);
  });
});

describe("punycode (RFC 3492)", () => {
  it.each([["bücher", "xn--bcher-kva"], ["סטודיו-12", "xn---12-1pejbsk2e"], ["münchen", "xn--mnchen-3ya"]])("%s ⇄ %s", (u, a) => {
    expect(punycodeEncodeLabel(u)).toBe(a);
    expect(punycodeDecodeLabel(a)).toBe(u);
  });
  it("Hebrew slug with digits only → sub-domain", () => {
    const label = punycodeEncodeLabel("סטודיו-12");
    expect(tenantSlugFromHost(`${label}.petra.app`, "petra.app")).toBe("סטודיו-12");
    expect(tenantUrl("סטודיו-12", "petra.app")).toBe(`https://${label}.petra.app`);
  });
  it("garbage punycode → null", () => {
    expect(tenantSlugFromHost("xn--!!!.petra.app", "petra.app")).toBeNull();
  });
});

describe("custom sub-domain", () => {
  it("latin, 3+ chars, not reserved", () => {
    expect(isValidCustomSubdomain("noa-studio")).toBe(true);
    for (const v of ["ab", "www", "Noa", "נועה", "-noa", "noa_", ""]) expect(isValidCustomSubdomain(v)).toBe(false);
  });
});
