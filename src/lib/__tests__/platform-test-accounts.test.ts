jest.mock("@/lib/prisma", () => ({ prisma: {} }));

import { isTestEmail, wantsTestData } from "@/lib/platform-test-accounts";
import { activityActionLabel, auditActionLabel } from "@/lib/platform-labels";

describe("isTestEmail", () => {
  const original = process.env.PLATFORM_TEST_EMAILS;
  afterEach(() => {
    process.env.PLATFORM_TEST_EMAILS = original;
  });

  it("flags internal test domains, case-insensitively", () => {
    expect(isTestEmail("qa-test@petra.local")).toBe(true);
    expect(isTestEmail("Test-Onboarding-QA@Petra-Test.com")).toBe(true);
    expect(isTestEmail("testuser@petra-app.com")).toBe(true);
  });

  it("does not flag real customers or lookalike domains", () => {
    expect(isTestEmail("owner@gmail.com")).toBe(false);
    expect(isTestEmail("info@petra-app.com")).toBe(false);
    expect(isTestEmail("someone@notpetra.local.evil.com")).toBe(false);
    expect(isTestEmail("petra.local@gmail.com")).toBe(false);
    expect(isTestEmail(null)).toBe(false);
    expect(isTestEmail("")).toBe(false);
  });

  it("honours PLATFORM_TEST_EMAILS", () => {
    process.env.PLATFORM_TEST_EMAILS = " Demo@Example.com , other@example.com";
    expect(isTestEmail("demo@example.com")).toBe(true);
    expect(isTestEmail("third@example.com")).toBe(false);
  });
});

describe("wantsTestData", () => {
  it("is opt-in only with includeTest=1", () => {
    expect(wantsTestData(new URLSearchParams("includeTest=1"))).toBe(true);
    expect(wantsTestData(new URLSearchParams("includeTest=true"))).toBe(false);
    expect(wantsTestData(new URLSearchParams(""))).toBe(false);
  });
});

describe("platform labels", () => {
  it("never returns a raw SCREAMING_CASE code", () => {
    expect(auditActionLabel("SUPER_ADMIN_TENANT_ACCESS")).toBe("כניסת אדמין לעסק");
    expect(auditActionLabel("SOME_UNKNOWN_CODE")).toBe("some unknown code");
    expect(activityActionLabel("DELETE_LEAD")).toBe("מחק ליד");
    expect(activityActionLabel("NOT_MAPPED")).toBe("not mapped");
  });
});
