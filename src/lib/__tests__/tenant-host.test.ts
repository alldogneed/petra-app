import { isDnsSafeSlug, sessionCookieDomain, tenantSlugFromHost, tenantUrl } from "@/lib/verticals/tenant-host";

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
    expect(tenantUrl("סטודיו-1a2b", "petra.app")).toBeNull();
    expect(tenantUrl("www", "petra.app")).toBeNull();
    expect(tenantUrl("noa", undefined)).toBeNull();
    expect(isDnsSafeSlug("a".repeat(64))).toBe(false);
  });
});
