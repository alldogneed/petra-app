import { isVolunteerWriteBlocked } from "../permissions";

describe("isVolunteerWriteBlocked", () => {
  it("blocks volunteer writes on business routes", () => {
    expect(isVolunteerWriteBlocked("volunteer", null, "POST", "/api/automations")).toBe(true);
    expect(isVolunteerWriteBlocked("volunteer", null, "DELETE", "/api/tasks/abc")).toBe(true);
    expect(isVolunteerWriteBlocked("volunteer", {}, "PATCH", "/api/service-dogs/x/phase")).toBe(true);
  });
  it("lets volunteers read", () => {
    expect(isVolunteerWriteBlocked("volunteer", null, "GET", "/api/automations")).toBe(false);
    expect(isVolunteerWriteBlocked("volunteer", null, "HEAD", "/api/tasks")).toBe(false);
  });
  it("keeps personal routes open", () => {
    expect(isVolunteerWriteBlocked("volunteer", null, "POST", "/api/notifications/read")).toBe(false);
    expect(isVolunteerWriteBlocked("volunteer", null, "POST", "/api/auth/logout")).toBe(false);
    expect(isVolunteerWriteBlocked("volunteer", null, "POST", "/api/authx")).toBe(true);
  });
  it("honours a CONTENT_WRITE override", () => {
    expect(isVolunteerWriteBlocked("volunteer", { "tenant.content.write": true } as never, "POST", "/api/tasks")).toBe(false);
  });
  it("never affects other roles", () => {
    for (const r of ["owner", "manager", "user"]) {
      expect(isVolunteerWriteBlocked(r, null, "DELETE", "/api/tasks/abc")).toBe(false);
    }
  });
});
