import { isExpectedMcpError, mcpSystemErrorWhere } from "@/lib/mcp-error-kind";

describe("isExpectedMcpError", () => {
  it.each([
    "not found",
    "Not Found",
    "חיית מחמד לא נמצאה",
    "החדר מלא בתאריכים אלו",
    "לקוח עם מספר טלפון זה כבר קיים במערכת (דנה)",
    "ההעברה נדחתה — החלון החדש מתנגש",
  ])("expected: %s", (m) => expect(isExpectedMcpError(m)).toBe(true));

  it.each(["Prisma connection timeout", "Internal error", null, ""])("system: %s", (m) =>
    expect(isExpectedMcpError(m)).toBe(false),
  );

  it("prisma filter keeps status error and excludes every pattern", () => {
    const w = mcpSystemErrorWhere();
    expect(w.status).toBe("error");
    expect(w.NOT.OR.length).toBeGreaterThan(5);
  });
});
