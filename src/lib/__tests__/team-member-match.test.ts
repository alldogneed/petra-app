import { memberNotFoundMessage, parseAssignedToParam } from "../team-member-match";

describe("parseAssignedToParam", () => {
  it("keeps undefined, clears null / empty, trims", () => {
    expect(parseAssignedToParam(undefined)).toBeUndefined();
    expect(parseAssignedToParam(null)).toBeNull();
    expect(parseAssignedToParam("   ")).toBeNull();
    expect(parseAssignedToParam(" דנה ")).toBe("דנה");
  });
});

describe("memberNotFoundMessage", () => {
  it("lists the active member names", () => {
    const msg = memberNotFoundMessage("יוסי", ["דנה כהן", "אבי לוי", ""]);
    expect(msg).toContain("יוסי");
    expect(msg).toContain("דנה כהן, אבי לוי");
  });
  it("says when there are no members", () => {
    expect(memberNotFoundMessage("x", [])).toContain("אין אנשי צוות פעילים");
  });
  it("strips newlines from the query", () => {
    expect(memberNotFoundMessage("a\nb", ["x"])).not.toContain("\n");
  });
});
